const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Specification = require('../models/Specification');
const { authenticate } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/specifications');
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Accept common document formats
    const allowedTypes = /pdf|doc|docx|txt|dwg|dxf|rvt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/octet-stream';

    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, DOC, DOCX, TXT, DWG, DXF, and RVT files are allowed'));
  }
});

// Get all specifications for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const specifications = await Specification.findByProject(
      req.params.projectId,
      {
        category: req.query.category,
        is_latest: req.query.is_latest === 'true' ? true : req.query.is_latest === 'false' ? false : undefined
      }
    );
    res.json({ data: specifications });
  } catch (error) {
    next(error);
  }
});

// Get single specification
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const specification = await Specification.findById(req.params.id);
    if (!specification) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    res.json({ data: specification });
  } catch (error) {
    next(error);
  }
});

// Get version history for a specification
router.get('/:id/versions', authenticate, async (req, res, next) => {
  try {
    const versions = await Specification.getVersionHistory(req.params.id);
    res.json({ data: versions });
  } catch (error) {
    next(error);
  }
});

// Create specification with file upload
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
    if (data.parent_spec_id) {
      await Specification.markAsNotLatest(data.parent_spec_id);
    }

    const specification = await Specification.create(data);
    res.status(201).json({ data: specification });
  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// Update specification
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const specification = await Specification.update(req.params.id, req.body);
    if (!specification) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    res.json({ data: specification });
  } catch (error) {
    next(error);
  }
});

// Delete specification
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const spec = await Specification.findById(req.params.id);

    // Delete the file if it exists
    if (spec && spec.file_path && fs.existsSync(spec.file_path)) {
      fs.unlinkSync(spec.file_path);
    }

    await Specification.delete(req.params.id);
    res.json({ message: 'Specification deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Download specification file
router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const specification = await Specification.findById(req.params.id);
    if (!specification) {
      return res.status(404).json({ error: 'Specification not found' });
    }

    if (!specification.file_path || !fs.existsSync(specification.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(specification.file_path, specification.file_name);
  } catch (error) {
    next(error);
  }
});

// ===== QUESTION ROUTES =====

// Get all questions for a specification
router.get('/:specId/questions', authenticate, async (req, res, next) => {
  try {
    const questions = await Specification.findQuestionsBySpec(
      req.params.specId,
      { status: req.query.status }
    );
    res.json({ data: questions });
  } catch (error) {
    next(error);
  }
});

// Get single question
router.get('/questions/:id', authenticate, async (req, res, next) => {
  try {
    const question = await Specification.findQuestionById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ data: question });
  } catch (error) {
    next(error);
  }
});

// Create question
router.post('/:specId/questions', authenticate, async (req, res, next) => {
  try {
    const data = {
      specification_id: req.params.specId,
      question: req.body.question,
      asked_by: req.user.id
    };
    const question = await Specification.createQuestion(data);
    res.status(201).json({ data: question });
  } catch (error) {
    next(error);
  }
});

// Answer question
router.post('/questions/:id/answer', authenticate, async (req, res, next) => {
  try {
    const question = await Specification.answerQuestion(
      req.params.id,
      req.body.answer,
      req.user.id
    );
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ data: question });
  } catch (error) {
    next(error);
  }
});

// Update question
router.put('/questions/:id', authenticate, async (req, res, next) => {
  try {
    const question = await Specification.updateQuestion(req.params.id, req.body);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ data: question });
  } catch (error) {
    next(error);
  }
});

// Delete question
router.delete('/questions/:id', authenticate, async (req, res, next) => {
  try {
    await Specification.deleteQuestion(req.params.id);
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
