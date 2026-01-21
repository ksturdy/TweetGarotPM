const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Specification = require('../models/Specification');
const { authenticate } = require('../middleware/auth');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl, getFileInfo } = require('../utils/fileStorage');
const { isR2Enabled } = require('../config/r2Client');

// Configure upload middleware with R2 or local storage
const upload = createUploadMiddleware({
  destination: 'uploads/specifications',
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/octet-stream', // DWG, DXF, RVT files
  ],
  maxSize: 50 * 1024 * 1024, // 50MB limit
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
      const fileInfo = getFileInfo(req.file);
      data.file_name = fileInfo.fileName;
      data.file_path = fileInfo.filePath;
      data.file_size = fileInfo.fileSize;
      data.file_type = fileInfo.fileType;
    }

    // If this is a new version, mark the parent as not latest
    if (data.parent_spec_id) {
      await Specification.markAsNotLatest(data.parent_spec_id);
    }

    const specification = await Specification.create(data);
    res.status(201).json({ data: specification });
  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file) {
      const fileInfo = getFileInfo(req.file);
      await deleteFile(fileInfo.filePath).catch(console.error);
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

    // Delete the file from R2 or local storage
    if (spec && spec.file_path) {
      await deleteFile(spec.file_path).catch(console.error);
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

    if (!specification.file_path) {
      return res.status(404).json({ error: 'File not found' });
    }

    // If using R2, redirect to presigned URL
    if (isR2Enabled()) {
      const url = await getFileUrl(specification.file_path);
      return res.redirect(url);
    }

    // For local storage, serve the file directly
    if (!fs.existsSync(specification.file_path)) {
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
