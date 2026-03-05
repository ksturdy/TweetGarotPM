const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl, getFileInfo } = require('../utils/fileStorage');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const upload = createUploadMiddleware({
  destination: 'uploads/attachments',
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/pdf',
  ],
  maxSize: 20 * 1024 * 1024, // 20MB
});

// Get attachments for an entity
router.get('/:entityType/:entityId', async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const result = await db.query(
      `SELECT * FROM attachments WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
      [entityType, entityId]
    );

    // Add download URLs
    const attachments = await Promise.all(
      result.rows.map(async (att) => ({
        ...att,
        url: await getFileUrl(att.filename),
      }))
    );

    res.json(attachments);
  } catch (error) {
    next(error);
  }
});

// Upload attachment
router.post('/:entityType/:entityId', upload.single('file'), async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = getFileInfo(req.file);

    const result = await db.query(
      `INSERT INTO attachments (entity_type, entity_id, filename, original_name, mime_type, size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [entityType, entityId, fileInfo.filePath, fileInfo.fileName, fileInfo.fileType, fileInfo.fileSize, req.user.id]
    );

    const attachment = result.rows[0];
    attachment.url = await getFileUrl(attachment.filename);

    res.status(201).json(attachment);
  } catch (error) {
    if (req.file) {
      const fileInfo = getFileInfo(req.file);
      await deleteFile(fileInfo.filePath).catch(console.error);
    }
    next(error);
  }
});

// Delete attachment
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM attachments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];

    // Delete file from storage
    await deleteFile(attachment.filename).catch(console.error);

    // Delete DB record
    await db.query('DELETE FROM attachments WHERE id = $1', [req.params.id]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
