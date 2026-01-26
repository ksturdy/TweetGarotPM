const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Specification = require('../models/Specification');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl, getFileInfo } = require('../utils/fileStorage');
const { isR2Enabled } = require('../config/r2Client');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

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

// Middleware to verify project belongs to tenant
const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

// Get all specifications for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
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
router.get('/:id', async (req, res, next) => {
  try {
    const specification = await Specification.findById(req.params.id);
    if (!specification) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    // Verify the specification's project belongs to tenant
    const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    res.json({ data: specification });
  } catch (error) {
    next(error);
  }
});

// Get version history for a specification
router.get('/:id/versions', async (req, res, next) => {
  try {
    const specification = await Specification.findById(req.params.id);
    if (!specification) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    // Verify the specification's project belongs to tenant
    const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Specification not found' });
    }

    const versions = await Specification.getVersionHistory(req.params.id);
    res.json({ data: versions });
  } catch (error) {
    next(error);
  }
});

// Create specification with file upload
router.post('/', upload.single('file'), verifyProjectOwnership, async (req, res, next) => {
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
router.put('/:id', async (req, res, next) => {
  try {
    const existingSpec = await Specification.findById(req.params.id);
    if (!existingSpec) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    // Verify the specification's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingSpec.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Specification not found' });
    }

    const specification = await Specification.update(req.params.id, req.body);
    res.json({ data: specification });
  } catch (error) {
    next(error);
  }
});

// Delete specification
router.delete('/:id', async (req, res, next) => {
  try {
    const spec = await Specification.findById(req.params.id);
    if (!spec) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    // Verify the specification's project belongs to tenant
    const project = await Project.findByIdAndTenant(spec.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Specification not found' });
    }

    // Delete the file from R2 or local storage
    if (spec.file_path) {
      await deleteFile(spec.file_path).catch(console.error);
    }

    await Specification.delete(req.params.id);
    res.json({ message: 'Specification deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Download specification file
router.get('/:id/download', async (req, res, next) => {
  try {
    const specification = await Specification.findById(req.params.id);
    if (!specification) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    // Verify the specification's project belongs to tenant
    const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
    if (!project) {
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
router.get('/:specId/questions', async (req, res, next) => {
  try {
    const specification = await Specification.findById(req.params.specId);
    if (!specification) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    // Verify the specification's project belongs to tenant
    const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Specification not found' });
    }

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
router.get('/questions/:id', async (req, res, next) => {
  try {
    const question = await Specification.findQuestionById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    // Verify the question's specification's project belongs to tenant
    const specification = await Specification.findById(question.specification_id);
    if (specification) {
      const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'Question not found' });
      }
    }
    res.json({ data: question });
  } catch (error) {
    next(error);
  }
});

// Create question
router.post('/:specId/questions', async (req, res, next) => {
  try {
    const specification = await Specification.findById(req.params.specId);
    if (!specification) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    // Verify the specification's project belongs to tenant
    const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Specification not found' });
    }

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
router.post('/questions/:id/answer', async (req, res, next) => {
  try {
    const existingQuestion = await Specification.findQuestionById(req.params.id);
    if (!existingQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }
    // Verify the question's specification's project belongs to tenant
    const specification = await Specification.findById(existingQuestion.specification_id);
    if (specification) {
      const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'Question not found' });
      }
    }

    const question = await Specification.answerQuestion(
      req.params.id,
      req.body.answer,
      req.user.id
    );
    res.json({ data: question });
  } catch (error) {
    next(error);
  }
});

// Update question
router.put('/questions/:id', async (req, res, next) => {
  try {
    const existingQuestion = await Specification.findQuestionById(req.params.id);
    if (!existingQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }
    // Verify the question's specification's project belongs to tenant
    const specification = await Specification.findById(existingQuestion.specification_id);
    if (specification) {
      const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'Question not found' });
      }
    }

    const question = await Specification.updateQuestion(req.params.id, req.body);
    res.json({ data: question });
  } catch (error) {
    next(error);
  }
});

// Delete question
router.delete('/questions/:id', async (req, res, next) => {
  try {
    const existingQuestion = await Specification.findQuestionById(req.params.id);
    if (!existingQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }
    // Verify the question's specification's project belongs to tenant
    const specification = await Specification.findById(existingQuestion.specification_id);
    if (specification) {
      const project = await Project.findByIdAndTenant(specification.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'Question not found' });
      }
    }

    await Specification.deleteQuestion(req.params.id);
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
