const express = require('express');
const { body, validationResult } = require('express-validator');
const SafetyObservation = require('../models/SafetyObservation');
const Project = require('../models/Project');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { fetchLogoBase64 } = require('../utils/logoFetcher');
const { fetchImageBase64 } = require('../utils/fetchImageBase64');
const { generateObservationPdfBuffer } = require('../utils/safetyObservationPdfBuffer');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.project_id;
    if (!projectId) return res.status(400).json({ error: 'Project ID is required' });
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

// GET /api/safety-observations/project/:projectId
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status || undefined };
    const obs = await SafetyObservation.findByProject(req.params.projectId, filters);
    res.json(obs);
  } catch (err) {
    next(err);
  }
});

// GET /api/safety-observations  (tenant-wide — for the Safety Dashboard)
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || undefined,
      projectId: req.query.project_id ? parseInt(req.query.project_id) : undefined,
    };
    const obs = await SafetyObservation.findByTenant(req.tenantId, filters);
    res.json(obs);
  } catch (err) {
    next(err);
  }
});

// GET /api/safety-observations/stats  (open count for dashboard card)
router.get('/stats', async (req, res, next) => {
  try {
    const openCount = await SafetyObservation.countOpen(req.tenantId);
    res.json({ open: openCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/safety-observations/:id/pdf
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const obs = await SafetyObservation.findById(req.params.id);
    if (!obs) return res.status(404).json({ error: 'Observation not found' });
    const project = await Project.findByIdAndTenant(obs.project_id, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Observation not found' });

    const logoBase64 = await fetchLogoBase64(req.tenantId);

    // Fetch section photos as base64 for embedding in the PDF
    const photoRows = await db.query(
      `SELECT filename, mime_type, section_area FROM attachments
       WHERE entity_type = 'safety_observation' AND entity_id = $1
         AND section_area IS NOT NULL AND mime_type LIKE 'image/%'
       ORDER BY created_at ASC`,
      [obs.id]
    );
    const photoEntries = await Promise.all(
      photoRows.rows.map(async row => ({
        section_area: row.section_area,
        b64: await fetchImageBase64(row.filename),
      }))
    );
    const sectionPhotos = {};
    for (const { section_area, b64 } of photoEntries) {
      if (b64) {
        if (!sectionPhotos[section_area]) sectionPhotos[section_area] = [];
        sectionPhotos[section_area].push(b64);
      }
    }

    const pdfBuffer = await generateObservationPdfBuffer(obs, logoBase64, sectionPhotos);
    const filename = `Safety-Observation-${obs.number}-${project.number || project.name || ''}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/safety-observations/:id
router.get('/:id', async (req, res, next) => {
  try {
    const obs = await SafetyObservation.findById(req.params.id);
    if (!obs) return res.status(404).json({ error: 'Observation not found' });
    const project = await Project.findByIdAndTenant(obs.project_id, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Observation not found' });
    res.json(obs);
  } catch (err) {
    next(err);
  }
});

// POST /api/safety-observations
router.post(
  '/',
  [
    body('project_id').isInt(),
    body('date_of_observation').isDate(),
    body('sections').isArray(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const projectId = req.body.project_id;
      const number = await SafetyObservation.getNextNumber(projectId);
      const obs = await SafetyObservation.create({
        projectId,
        tenantId: req.tenantId,
        number,
        observerId: req.user.id,
        dateOfObservation: req.body.date_of_observation,
        stretchAndFlex: req.body.stretch_and_flex,
        feedbackNotes: req.body.feedback_notes,
        sections: req.body.sections,
        status: req.body.status || 'submitted',
        createdBy: req.user.id,
      });
      res.status(201).json(obs);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/safety-observations/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await SafetyObservation.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Observation not found' });
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Observation not found' });

    const obs = await SafetyObservation.update(req.params.id, {
      dateOfObservation: req.body.date_of_observation,
      stretchAndFlex: req.body.stretch_and_flex,
      feedbackNotes: req.body.feedback_notes,
      sections: req.body.sections,
      status: req.body.status,
    });
    res.json(obs);
  } catch (err) {
    next(err);
  }
});

// POST /api/safety-observations/:id/review
router.post('/:id/review', async (req, res, next) => {
  try {
    const existing = await SafetyObservation.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Observation not found' });
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Observation not found' });
    const obs = await SafetyObservation.review(req.params.id, req.user.id);
    res.json(obs);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/safety-observations/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await SafetyObservation.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Observation not found' });
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Observation not found' });
    await SafetyObservation.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
