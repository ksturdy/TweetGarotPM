const express = require('express');
const multer = require('multer');
const router = express.Router();
const StratusPart = require('../models/StratusPart');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { parseStratusWorkbook } = require('../utils/stratusImporter');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    if (ok.includes(file.mimetype) || /\.xlsx?$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) files are allowed.'));
  },
});

router.use(authenticate);
router.use(tenantContext);

router.post('/project/:projectId/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) return res.status(400).json({ message: 'Invalid project id.' });

    const { sourceProjectName, rowCount, parts } = parseStratusWorkbook(req.file.buffer);

    const importRow = await StratusPart.createImport({
      tenantId: req.tenantId,
      projectId,
      filename: req.file.originalname,
      sourceProjectName,
      rowCount,
      importedBy: req.user && req.user.id,
      snapshotAt: new Date(),
    });

    await StratusPart.bulkInsertParts({
      tenantId: req.tenantId,
      projectId,
      importId: importRow.id,
      parts,
    });

    res.status(201).json({
      import: importRow,
      sourceProjectName,
      rowCount,
    });
  } catch (err) {
    console.error('Stratus import error:', err);
    res.status(500).json({ message: err.message || 'Failed to import Stratus workbook.' });
  }
});

router.get('/project/:projectId/imports', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const imports = await StratusPart.listImports(projectId, req.tenantId);
    res.json(imports);
  } catch (err) {
    console.error('Stratus list imports error:', err);
    res.status(500).json({ message: 'Failed to list imports.' });
  }
});

router.get('/project/:projectId/latest', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const latest = await StratusPart.getLatestImport(projectId, req.tenantId);
    res.json(latest);
  } catch (err) {
    console.error('Stratus latest import error:', err);
    res.status(500).json({ message: 'Failed to load latest import.' });
  }
});

async function resolveImportId(req) {
  const projectId = parseInt(req.params.projectId, 10);
  if (req.query.import_id) return { projectId, importId: parseInt(req.query.import_id, 10) };
  const latest = await StratusPart.getLatestImport(projectId, req.tenantId);
  return { projectId, importId: latest ? latest.id : null };
}

router.get('/project/:projectId/parts', async (req, res) => {
  try {
    const { projectId, importId } = await resolveImportId(req);
    if (!importId) return res.json({ total: 0, rows: [] });
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = parseInt(req.query.offset, 10) || 0;
    // Each filter accepts either a comma-separated string or repeated query params
    // (e.g. ?status=Shipped,Field Installed or ?status=Shipped&status=Field+Installed).
    const filters = {
      status: req.query.status,
      phase_code: req.query.phase_code,
      service: req.query.service,
      area: req.query.area,
      size: req.query.size,
      division: req.query.division,
      package_category: req.query.package_category,
      service_type: req.query.service_type,
      material_type: req.query.material_type,
      search: req.query.search,
    };
    const result = await StratusPart.listParts({
      projectId, tenantId: req.tenantId, importId, filters, limit, offset,
    });
    res.json({ ...result, import_id: importId, limit, offset });
  } catch (err) {
    console.error('Stratus list parts error:', err);
    res.status(500).json({ message: 'Failed to list parts.' });
  }
});

router.get('/project/:projectId/pipe-length', async (req, res) => {
  try {
    const { projectId, importId } = await resolveImportId(req);
    if (!importId) return res.json({ import_id: null, rows: [] });
    const installedStatuses = req.query.installed_statuses
      ? String(req.query.installed_statuses).split(',').map((s) => s.trim()).filter(Boolean)
      : ['Field Installed'];
    const rows = await StratusPart.getPipeLengthSummary({
      projectId, tenantId: req.tenantId, importId, installedStatuses,
    });
    res.json({ import_id: importId, installed_statuses: installedStatuses, rows });
  } catch (err) {
    console.error('Stratus pipe-length error:', err);
    res.status(500).json({ message: 'Failed to load pipe-length summary.' });
  }
});

router.put('/parts/:partId/material-type-override', async (req, res) => {
  try {
    const partId = parseInt(req.params.partId, 10);
    const updated = await StratusPart.setMaterialTypeOverride({
      partId, tenantId: req.tenantId, materialType: req.body && req.body.material_type,
    });
    if (!updated) return res.status(404).json({ message: 'Part not found.' });
    res.json(updated);
  } catch (err) {
    console.error('Stratus override error:', err);
    res.status(500).json({ message: 'Failed to update material type override.' });
  }
});

router.get('/project/:projectId/summary', async (req, res) => {
  try {
    const { projectId, importId } = await resolveImportId(req);
    if (!importId) return res.json({ import_id: null, rows: [] });
    const rows = await StratusPart.getStatusByPhaseSummary({
      projectId, tenantId: req.tenantId, importId,
    });
    res.json({ import_id: importId, rows });
  } catch (err) {
    console.error('Stratus summary error:', err);
    res.status(500).json({ message: 'Failed to load summary.' });
  }
});

router.get('/project/:projectId/filter-options', async (req, res) => {
  try {
    const { projectId, importId } = await resolveImportId(req);
    if (!importId) {
      return res.json({ statuses: [], phase_codes: [], services: [], areas: [], sizes: [], divisions: [], package_categories: [] });
    }
    const opts = await StratusPart.getFilterOptions({ projectId, tenantId: req.tenantId, importId });
    res.json(opts);
  } catch (err) {
    console.error('Stratus filter options error:', err);
    res.status(500).json({ message: 'Failed to load filter options.' });
  }
});

router.delete('/imports/:importId', async (req, res) => {
  try {
    const importId = parseInt(req.params.importId, 10);
    const ok = await StratusPart.deleteImport(importId, req.tenantId);
    if (!ok) return res.status(404).json({ message: 'Import not found.' });
    res.status(204).end();
  } catch (err) {
    console.error('Stratus delete import error:', err);
    res.status(500).json({ message: 'Failed to delete import.' });
  }
});

module.exports = router;
