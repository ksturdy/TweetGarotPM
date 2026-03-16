const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { getFileUrl, deleteFile, getFileStream } = require('../utils/fileStorage');
const TraceoverDocument = require('../models/TraceoverDocument');
const Takeoff = require('../models/Takeoff');

const router = express.Router({ mergeParams: true }); // mergeParams to access :takeoffId

router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// Upload middleware for PDFs (100MB max, same as drawings)
const upload = createUploadMiddleware({
  destination: 'uploads/traceover-documents',
  allowedTypes: ['application/pdf'],
  allowedExtensions: ['.pdf'],
  maxSize: 100 * 1024 * 1024, // 100MB
});

// Helper: verify takeoff belongs to tenant
async function verifyTakeoff(req, res) {
  const takeoff = await Takeoff.findByIdAndTenant(req.params.takeoffId, req.tenantId);
  if (!takeoff) {
    res.status(404).json({ error: 'Takeoff not found' });
    return null;
  }
  return takeoff;
}

// ─── List documents for a takeoff ───
router.get('/', async (req, res, next) => {
  try {
    if (!await verifyTakeoff(req, res)) return;
    const docs = await TraceoverDocument.findByTakeoff(req.params.takeoffId);
    res.json(docs);
  } catch (error) {
    next(error);
  }
});

// ─── Get single document with pages and calibrations ───
router.get('/:docId', async (req, res, next) => {
  try {
    const doc = await TraceoverDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// ─── Upload a new PDF document ───
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!await verifyTakeoff(req, res)) return;

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const storageKey = req.file.key || req.file.path;
    const doc = await TraceoverDocument.create({
      tenantId: req.tenantId,
      takeoffId: req.params.takeoffId,
      fileName: req.file.filename || req.file.originalname,
      originalName: req.file.originalname,
      storageKey,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      pageCount: parseInt(req.body.page_count) || 0,
      uploadedBy: req.user.id,
    });

    res.status(201).json(doc);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      try { await deleteFile(req.file.key || req.file.path); } catch (e) { /* ignore */ }
    }
    next(error);
  }
});

// ─── Update document metadata ───
router.put('/:docId', async (req, res, next) => {
  try {
    const doc = await TraceoverDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const updated = await TraceoverDocument.update(req.params.docId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ─── Delete document (and its file) ───
router.delete('/:docId', async (req, res, next) => {
  try {
    const doc = await TraceoverDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete the file from storage
    try { await deleteFile(doc.storage_key); } catch (e) { console.error('File delete error:', e); }

    await TraceoverDocument.delete(req.params.docId);
    res.json({ message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Get download URL for document ───
router.get('/:docId/url', async (req, res, next) => {
  try {
    const doc = await TraceoverDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const url = await getFileUrl(doc.storage_key);
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

// ─── Stream document file (for PDF viewer) ───
router.get('/:docId/file', async (req, res, next) => {
  try {
    const doc = await TraceoverDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { isR2Enabled } = require('../config/r2Client');
    if (isR2Enabled()) {
      const { stream, contentType, contentLength } = await getFileStream(doc.storage_key);
      res.set('Content-Type', contentType || 'application/pdf');
      if (contentLength) res.set('Content-Length', contentLength);
      res.set('Content-Disposition', `inline; filename="${doc.original_name}"`);
      stream.pipe(res);
    } else {
      // Local file
      const path = require('path');
      const fs = require('fs');
      const normalized = doc.storage_key.replace(/\\/g, '/');
      const idx = normalized.indexOf('uploads/');
      const relativePath = idx !== -1 ? normalized.substring(idx) : doc.storage_key;
      const filePath = path.join(__dirname, '../../', relativePath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${doc.original_name}"`);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    next(error);
  }
});

// ─── Page Metadata ───

router.get('/:docId/pages', async (req, res, next) => {
  try {
    const pages = await TraceoverDocument.getPageMetadata(req.params.docId);
    res.json(pages);
  } catch (error) {
    next(error);
  }
});

router.put('/:docId/pages/:pageNumber', async (req, res, next) => {
  try {
    const page = await TraceoverDocument.upsertPageMetadata(
      req.params.docId, parseInt(req.params.pageNumber), req.body
    );
    res.json(page);
  } catch (error) {
    next(error);
  }
});

// ─── Calibrations ───

router.get('/:docId/calibrations', async (req, res, next) => {
  try {
    const cals = await TraceoverDocument.getCalibrations(req.params.docId);
    res.json(cals);
  } catch (error) {
    next(error);
  }
});

router.get('/:docId/calibrations/:pageNumber', async (req, res, next) => {
  try {
    const cal = await TraceoverDocument.getCalibration(req.params.docId, parseInt(req.params.pageNumber));
    if (!cal) {
      return res.status(404).json({ error: 'No calibration for this page' });
    }
    res.json(cal);
  } catch (error) {
    next(error);
  }
});

router.put('/:docId/calibrations/:pageNumber', async (req, res, next) => {
  try {
    const { start_point, end_point, pixel_distance, real_distance, unit, pixels_per_unit } = req.body;
    if (!start_point || !end_point || !pixel_distance || !real_distance || !pixels_per_unit) {
      return res.status(400).json({ error: 'Missing required calibration fields' });
    }
    const cal = await TraceoverDocument.upsertCalibration(
      req.params.docId, parseInt(req.params.pageNumber), req.body
    );
    res.json(cal);
  } catch (error) {
    next(error);
  }
});

router.delete('/:docId/calibrations/:pageNumber', async (req, res, next) => {
  try {
    const deleted = await TraceoverDocument.deleteCalibration(req.params.docId, parseInt(req.params.pageNumber));
    if (!deleted) {
      return res.status(404).json({ error: 'No calibration for this page' });
    }
    res.json({ message: 'Calibration deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
