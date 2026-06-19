const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createMemoryUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile } = require('../utils/fileStorage');
const { processAndStoreVariants } = require('../utils/imageProcessor');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const config = require('../config');
const MarketingMedia = require('../models/MarketingMedia');
const ProjectPhoto = require('../models/ProjectPhoto');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DAILY_RATE_LIMIT = 50;

const mediaUpload = createMemoryUploadMiddleware({
  allowedTypes: ALLOWED_TYPES,
  maxSize: MAX_SIZE,
});

router.use(authenticate);
router.use(tenantContext);

async function storeOriginal(buffer, mimetype, originalname, destination) {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const sanitized = originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
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
 * GET /api/marketing-media
 */
router.get('/', async (req, res) => {
  try {
    const media = await MarketingMedia.findAll(req.tenantId);
    res.json(media);
  } catch (err) {
    console.error('Error fetching marketing media:', err);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

/**
 * GET /api/marketing-media/combined
 * Marketing uploads + all project photos merged by date
 */
router.get('/combined', async (req, res) => {
  try {
    const [marketingMedia, projectPhotos] = await Promise.all([
      MarketingMedia.findAll(req.tenantId),
      ProjectPhoto.findAllByTenant(req.tenantId),
    ]);

    const projectItems = projectPhotos.map((p) => ({ ...p, source: 'project' }));
    const combined = [...marketingMedia, ...projectItems].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    res.json(combined);
  } catch (err) {
    console.error('Error fetching combined media:', err);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

/**
 * GET /api/marketing-media/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const item = await MarketingMedia.findById(req.params.id, req.tenantId);
    if (!item) return res.status(404).json({ error: 'Media not found' });
    res.json(item);
  } catch (err) {
    console.error('Error fetching media:', err);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

/**
 * POST /api/marketing-media
 * Upload marketing media (multipart/form-data, field: "file")
 */
router.post('/', mediaUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Daily rate limit
    const uploadedToday = await MarketingMedia.countUploadedTodayByUser(req.user.id, req.tenantId);
    if (uploadedToday >= DAILY_RATE_LIMIT) {
      return res.status(429).json({
        error: `Upload limit reached. Maximum ${DAILY_RATE_LIMIT} photos per day per user.`,
      });
    }

    const dest = 'uploads/marketing-media/originals';
    const sanitized = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const baseName = `${uniqueSuffix}-${sanitized.replace(/\.[^.]+$/, '')}`;

    const originalPath = await storeOriginal(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      dest
    );

    const { thumbPath, feedPath, width, height } = await processAndStoreVariants(
      req.file.buffer,
      'uploads/marketing-media',
      baseName
    );

    const item = await MarketingMedia.create({
      tenant_id: req.tenantId,
      title: req.body.title || req.file.originalname,
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
      uploaded_by: req.user.id,
    });

    res.status(201).json(item);
  } catch (err) {
    console.error('Error uploading marketing media:', err);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

/**
 * PUT /api/marketing-media/bulk
 */
router.put('/bulk', async (req, res) => {
  try {
    const { ids, title, caption, tags, tagMode } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }
    const rows = await MarketingMedia.bulkUpdate(req.tenantId, ids, { title, caption, tags, tagMode });
    res.json({ updated: rows.length });
  } catch (err) {
    console.error('Error bulk updating media:', err);
    res.status(500).json({ error: 'Failed to update media' });
  }
});

/**
 * PUT /api/marketing-media/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const item = await MarketingMedia.update(req.params.id, req.tenantId, {
      title: req.body.title || '',
      caption: req.body.caption || '',
      tags: req.body.tags || '',
    });
    if (!item) return res.status(404).json({ error: 'Media not found' });
    res.json(item);
  } catch (err) {
    console.error('Error updating media:', err);
    res.status(500).json({ error: 'Failed to update media' });
  }
});

/**
 * DELETE /api/marketing-media/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const item = await MarketingMedia.delete(req.params.id, req.tenantId);
    if (!item) return res.status(404).json({ error: 'Media not found' });

    await Promise.allSettled([
      deleteFile(item.file_path),
      item.thumb_path ? deleteFile(item.thumb_path) : Promise.resolve(),
      item.feed_path ? deleteFile(item.feed_path) : Promise.resolve(),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

module.exports = router;
