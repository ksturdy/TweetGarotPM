const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createMemoryUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl } = require('../utils/fileStorage');
const { processAndStoreVariants } = require('../utils/imageProcessor');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const config = require('../config');
const ProjectPhoto = require('../models/ProjectPhoto');
const db = require('../config/database');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DAILY_RATE_LIMIT = 50;

const photoUpload = createMemoryUploadMiddleware({
  allowedTypes: ALLOWED_TYPES,
  maxSize: MAX_SIZE,
});

router.use(authenticate);
router.use(tenantContext);

/** Store a buffer to R2 or local disk, returns the stored path/key */
async function storeOriginal(buffer, mimetype, originalname, destination) {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const sanitized = originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  // Always store original as JPEG (HEIC converted via sharp later); keep original ext for others
  const fileName = `${uniqueSuffix}-${sanitized}`;
  const key = `${destination}/${fileName}`;

  if (isR2Enabled()) {
    const r2 = getR2Client();
    await r2.send(new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }));
  } else {
    const uploadDir = path.join(__dirname, '../../', destination);
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
  }

  return key;
}

/**
 * GET /api/project-photos/project/:projectId
 */
router.get('/project/:projectId', async (req, res) => {
  try {
    const photos = await ProjectPhoto.findByProject(req.params.projectId, req.tenantId);
    res.json(photos);
  } catch (err) {
    console.error('Error fetching project photos:', err);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

/**
 * GET /api/project-photos/all
 * All photos across projects (for Marketing use)
 */
router.get('/all', async (req, res) => {
  try {
    const photos = await ProjectPhoto.findAllByTenant(req.tenantId);
    res.json(photos);
  } catch (err) {
    console.error('Error fetching all project photos:', err);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

/**
 * GET /api/project-photos/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const photo = await ProjectPhoto.findById(req.params.id, req.tenantId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    res.json(photo);
  } catch (err) {
    console.error('Error fetching photo:', err);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

/**
 * POST /api/project-photos/project/:projectId
 * Upload a photo (multipart/form-data, field: "file")
 */
router.post('/project/:projectId', photoUpload.single('file'), async (req, res) => {
  try {
    // Verify project belongs to tenant
    const projectCheck = await db.query(
      'SELECT id FROM projects WHERE id=$1 AND tenant_id=$2',
      [req.params.projectId, req.tenantId]
    );
    if (!projectCheck.rows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Daily rate limit
    const uploadedToday = await ProjectPhoto.countUploadedTodayByUser(req.user.id, req.tenantId);
    if (uploadedToday >= DAILY_RATE_LIMIT) {
      return res.status(429).json({
        error: `Upload limit reached. Maximum ${DAILY_RATE_LIMIT} photos per day per user.`,
      });
    }

    const dest = 'uploads/project-photos/originals';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitized = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const baseName = `${uniqueSuffix}-${sanitized.replace(/\.[^.]+$/, '')}`;

    // Store original
    const originalPath = await storeOriginal(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      dest
    );

    // Process variants (resize + EXIF strip)
    const { thumbPath, feedPath, width, height } = await processAndStoreVariants(
      req.file.buffer,
      'uploads/project-photos',
      baseName
    );

    const count = await ProjectPhoto.countByProject(req.params.projectId);

    const photo = await ProjectPhoto.create({
      tenant_id: req.tenantId,
      project_id: parseInt(req.params.projectId),
      file_name: req.file.originalname,
      file_path: originalPath,
      thumb_path: thumbPath,
      feed_path: feedPath,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      width,
      height,
      caption: req.body.caption || '',
      tags: req.body.tags || '',
      display_order: count + 1,
      uploaded_by: req.user.id,
    });

    res.status(201).json(photo);
  } catch (err) {
    console.error('Error uploading project photo:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

/**
 * PUT /api/project-photos/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const photo = await ProjectPhoto.update(req.params.id, req.tenantId, {
      caption: req.body.caption || '',
      tags: req.body.tags || '',
      display_order: req.body.display_order || 0,
    });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    res.json(photo);
  } catch (err) {
    console.error('Error updating photo:', err);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

/**
 * DELETE /api/project-photos/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const photo = await ProjectPhoto.delete(req.params.id, req.tenantId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    // Clean up all stored files
    await Promise.allSettled([
      deleteFile(photo.file_path),
      photo.thumb_path ? deleteFile(photo.thumb_path) : Promise.resolve(),
      photo.feed_path ? deleteFile(photo.feed_path) : Promise.resolve(),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
