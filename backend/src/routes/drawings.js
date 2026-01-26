const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Drawing = require('../models/Drawing');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl, getFileInfo, getFileStream } = require('../utils/fileStorage');
const { isR2Enabled } = require('../config/r2Client');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Configure upload middleware with R2 or local storage
const upload = createUploadMiddleware({
  destination: 'uploads/drawings',
  allowedTypes: [
    'application/pdf',
    'application/octet-stream', // DWG, DXF, RVT files
    'image/png',
    'image/jpeg',
    'image/tiff',
  ],
  maxSize: 100 * 1024 * 1024, // 100MB limit for drawings
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

// Get all drawings for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
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
router.get('/:id', async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    // Verify the drawing's project belongs to tenant
    const project = await Project.findByIdAndTenant(drawing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    res.json({ data: drawing });
  } catch (error) {
    next(error);
  }
});

// Get version history for a drawing
router.get('/:id/versions', async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    // Verify the drawing's project belongs to tenant
    const project = await Project.findByIdAndTenant(drawing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Drawing not found' });
    }

    const versions = await Drawing.getVersionHistory(req.params.id);
    res.json({ data: versions });
  } catch (error) {
    next(error);
  }
});

// Create drawing with file upload
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
    if (data.parent_drawing_id) {
      await Drawing.markAsNotLatest(data.parent_drawing_id);
    }

    const drawing = await Drawing.create(data);
    res.status(201).json({ data: drawing });
  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file) {
      const fileInfo = getFileInfo(req.file);
      await deleteFile(fileInfo.filePath).catch(console.error);
    }
    next(error);
  }
});

// Update drawing
router.put('/:id', async (req, res, next) => {
  try {
    const existingDrawing = await Drawing.findById(req.params.id);
    if (!existingDrawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    // Verify the drawing's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingDrawing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Drawing not found' });
    }

    const drawing = await Drawing.update(req.params.id, req.body);
    res.json({ data: drawing });
  } catch (error) {
    next(error);
  }
});

// Delete drawing
router.delete('/:id', async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    // Verify the drawing's project belongs to tenant
    const project = await Project.findByIdAndTenant(drawing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Drawing not found' });
    }

    // Delete the file from R2 or local storage
    if (drawing.file_path) {
      await deleteFile(drawing.file_path).catch(console.error);
    }

    await Drawing.delete(req.params.id);
    res.json({ message: 'Drawing deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Download drawing file
router.get('/:id/download', async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    // Verify the drawing's project belongs to tenant
    const project = await Project.findByIdAndTenant(drawing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Drawing not found' });
    }

    if (!drawing.file_path) {
      return res.status(404).json({ error: 'File not found' });
    }

    // If using R2, redirect to presigned URL
    if (isR2Enabled()) {
      const url = await getFileUrl(drawing.file_path);
      return res.redirect(url);
    }

    // For local storage, serve the file directly
    if (!fs.existsSync(drawing.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(drawing.file_path, drawing.file_name);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
