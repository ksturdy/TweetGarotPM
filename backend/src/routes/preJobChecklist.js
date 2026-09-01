const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const PreJobChecklist = require('../models/PreJobChecklist');
const ProjectAssignment = require('../models/ProjectAssignment');
const ProjectScheduleSegment = require('../models/ProjectScheduleSegment');
const Project = require('../models/Project');
const db = require('../config/database');
const { fetchLogoBase64 } = require('../utils/logoFetcher');
const { generatePreJobChecklistPdfBuffer } = require('../utils/preJobChecklistPdfBuffer');
const { getFileStream, getFileUrl } = require('../utils/fileStorage');
const { isR2Enabled } = require('../config/r2Client');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const verifyProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndTenant(req.params.projectId, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

// GET /api/pre-job-checklist/project/:projectId/readiness
router.get('/project/:projectId/readiness', verifyProject, async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const [contractResult, estimateResult, projectionResult] = await Promise.all([
      db.query(
        `SELECT id, contract_number FROM vp_contracts
         WHERE linked_project_id = $1 AND tenant_id = $2 LIMIT 1`,
        [projectId, req.tenantId]
      ),
      // Estimate is uploaded when at least one phase code has est_cost > 0
      db.query(
        `SELECT id FROM vp_phase_codes
         WHERE linked_project_id = $1 AND tenant_id = $2 AND est_cost > 0 LIMIT 1`,
        [projectId, req.tenantId]
      ),
      // Projection is complete when at least one phase code has projected_cost > 0
      db.query(
        `SELECT id FROM vp_phase_codes
         WHERE linked_project_id = $1 AND tenant_id = $2 AND projected_cost > 0 LIMIT 1`,
        [projectId, req.tenantId]
      ),
    ]);

    const contract = contractResult.rows[0] ?? null;
    const vistaLinked = estimateResult.rows.length > 0;
    const hasProjection = projectionResult.rows.length > 0;

    res.json({
      vistaLinked,
      vistaContractNumber: vistaLinked ? (contract?.contract_number || null) : null,
      hasProjection,
      ready: vistaLinked && hasProjection,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/pre-job-checklist/project/:projectId
router.get('/project/:projectId', verifyProject, async (req, res) => {
  try {
    const checklist = await PreJobChecklist.getByProjectId(req.params.projectId, req.tenantId);
    res.json(checklist || {
      project_info: {},
      labor: {},
      material: {},
      subcontracts: {},
      rental: {},
      mep_equipment: {},
      general_conditions: {},
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pre-job-checklist/project/:projectId/section/:section
router.put('/project/:projectId/section/:section', verifyProject, async (req, res) => {
  try {
    const checklist = await PreJobChecklist.updateSection(
      req.params.projectId,
      req.tenantId,
      req.params.section,
      req.body
    );
    res.json(checklist);
  } catch (err) {
    if (err.message.startsWith('Invalid section')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pre-job-checklist/project/:projectId/pdf-download
router.get('/project/:projectId/pdf-download', verifyProject, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const [checklist, assignments, segments, segCosts, laborResult, logoBase64] = await Promise.all([
      PreJobChecklist.getByProjectId(projectId, req.tenantId),
      ProjectAssignment.findByProjectId(projectId, req.tenantId),
      ProjectScheduleSegment.getByProject(projectId, req.tenantId),
      ProjectScheduleSegment.getCostsByProject(projectId, req.tenantId),
      db.query(
        `SELECT
           CASE
             WHEN phase LIKE '30-%' OR phase LIKE '35-%' THEN 'sm'
             WHEN phase LIKE '40-%' OR phase LIKE '45-%' THEN 'pf'
             WHEN phase LIKE '50-%' OR phase LIKE '55-%' THEN 'pl'
             ELSE 'other'
           END AS trade,
           COALESCE(SUM(est_hours), 0)  AS est_hours,
           COALESCE(SUM(jtd_hours), 0)  AS jtd_hours
         FROM vp_phase_codes
         WHERE linked_project_id = $1 AND tenant_id = $2 AND cost_type = 1
         GROUP BY 1`,
        [projectId, req.tenantId]
      ),
      fetchLogoBase64(req.tenantId),
    ]);

    const laborData = laborResult.rows.map(r => ({
      trade: r.trade,
      est_hours: parseFloat(r.est_hours),
      jtd_hours: parseFloat(r.jtd_hours),
    }));

    // Fetch site map attachment as base64 for embedding in PDF (images only)
    let siteMapBase64 = null;
    let siteMapMimeType = null;
    const siteMapId = checklist?.orientation?.site_map_attachment_id;
    if (siteMapId) {
      try {
        const attResult = await db.query('SELECT * FROM attachments WHERE id = $1', [siteMapId]);
        if (attResult.rows.length > 0) {
          const att = attResult.rows[0];
          const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
          if (IMAGE_TYPES.includes(att.mime_type)) {
            let imgBuffer = null;

            if (isR2Enabled()) {
              // Read from R2 stream — chunks may be Uint8Array, coerce to Buffer
              const { stream } = await getFileStream(att.filename);
              const chunks = [];
              for await (const chunk of stream) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              }
              imgBuffer = Buffer.concat(chunks);
            } else {
              // __dirname = backend/src/routes; ../../ → backend/ where uploads/ lives
              const normalized = att.filename.replace(/\\/g, '/');
              const idx = normalized.indexOf('uploads/');
              const rel = idx !== -1 ? normalized.substring(idx) : att.filename;
              const localPath = path.resolve(__dirname, '../../', rel);
              if (fs.existsSync(localPath)) {
                imgBuffer = fs.readFileSync(localPath);
              } else {
                // Prod: file may be in R2 — fetch via public URL
                const fileUrl = await getFileUrl(att.filename);
                if (fileUrl?.startsWith('https://')) {
                  const resp = await fetch(fileUrl);
                  if (resp.ok) imgBuffer = Buffer.from(await resp.arrayBuffer());
                }
              }
            }

            if (imgBuffer) {
              siteMapBase64 = imgBuffer.toString('base64');
              siteMapMimeType = att.mime_type;
            }
          }
        }
      } catch (e) {
        console.error('Failed to load site map for PDF:', e.message);
      }
    }

    const pdfBuffer = await generatePreJobChecklistPdfBuffer(
      { project: req.project, checklist, assignments, segments, segCosts, laborData, siteMapBase64, siteMapMimeType },
      logoBase64
    );

    const safeName = (req.project.name || 'project').replace(/[^a-z0-9]/gi, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PreJob-${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
