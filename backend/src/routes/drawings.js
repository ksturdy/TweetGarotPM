const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Drawing = require('../models/Drawing');
const { authenticate } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/drawings');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for drawings
  fileFilter: (req, file, cb) => {
    // Accept common drawing formats
    const allowedTypes = /pdf|dwg|dxf|rvt|png|jpg|jpeg|tiff|tif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/octet-stream' || file.mimetype.startsWith('image/');

    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, DWG, DXF, RVT, and image files are allowed'));
  }
});

// Get all drawings for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const drawings = await Drawing.findByProject(
      req.params.projectId,
      {
        discipline: req.query.discipline,
        is_latest: req.query.is_latest === 'true' ? true : req.query.is_latest === 'false' ? false : undefined,
        drawing_number: req.query.drawing_number
      }
    );
    res.json({ data: drawings });
  } catch (error) {
    next(error);
  }
});

// Get single drawing
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    res.json({ data: drawing });
  } catch (error) {
    next(error);
  }
});

// Get version history for a drawing
router.get('/:id/versions', authenticate, async (req, res, next) => {
  try {
    const versions = await Drawing.getVersionHistory(req.params.id);
    res.json({ data: versions });
  } catch (error) {
    next(error);
  }
});

// Create drawing with file upload
router.post('/', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      uploaded_by: req.user.id
    };

    // Add file information if file was uploaded
    if (req.file) {
      data.file_name = req.file.originalname;
      data.file_path = req.file.path;
      data.file_size = req.file.size;
      data.file_type = req.file.mimetype;
    }

    // If this is a new version, mark the parent as not latest
    if (data.parent_drawing_id) {
      await Drawing.markAsNotLatest(data.parent_drawing_id);
    }

    const drawing = await Drawing.create(data);
    res.status(201).json({ data: drawing });
  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// Update drawing
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const drawing = await Drawing.update(req.params.id, req.body);
    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    res.json({ data: drawing });
  } catch (error) {
    next(error);
  }
});

// Delete drawing
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);

    // Delete the file if it exists
    if (drawing && drawing.file_path && fs.existsSync(drawing.file_path)) {
      fs.unlinkSync(drawing.file_path);
    }

    await Drawing.delete(req.params.id);
    res.json({ message: 'Drawing deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Download drawing file
router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }

    if (!drawing.file_path || !fs.existsSync(drawing.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(drawing.file_path, drawing.file_name);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
