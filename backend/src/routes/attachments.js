const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl, getFileInfo, getFileStream } = require('../utils/fileStorage');
const { isR2Enabled } = require('../config/r2Client');

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
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
  ],
  maxSize: 20 * 1024 * 1024, // 20MB
});

// Get all attachments for a project, grouped by entity — for local folder sync
router.get('/project/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const attResult = await db.query(`
      WITH project_entities AS (
        SELECT 'rfi' AS entity_type, id AS entity_id,
               'RFIs' AS folder_name,
               LPAD(number::text, 3, '0') || ' - ' || COALESCE(subject, 'RFI') AS entity_label
        FROM rfis WHERE project_id = $1

        UNION ALL

        SELECT 'submittal', id, 'Submittals',
               LPAD(number::text, 3, '0') || ' - ' || spec_section || ' ' || description
        FROM submittals WHERE project_id = $1

        UNION ALL

        SELECT 'change_order', id, 'Change Orders',
               'CO-' || LPAD(number::text, 3, '0') || ' - ' || COALESCE(title, 'Change Order')
        FROM change_orders WHERE project_id = $1

        UNION ALL

        SELECT 'daily_report', id, 'Daily Reports',
               TO_CHAR(report_date, 'YYYY-MM-DD')
        FROM daily_reports WHERE project_id = $1

        UNION ALL

        SELECT 'field_issue', id, 'Field Issues',
               'Issue-' || LPAD(number::text, 3, '0') || ' - ' || COALESCE(title, 'Field Issue')
        FROM field_issues WHERE project_id = $1

        UNION ALL

        SELECT 'safety_observation', id, 'Safety Observations',
               'Safety-' || LPAD(number::text, 3, '0') || ' - ' || TO_CHAR(date_of_observation, 'YYYY-MM-DD')
        FROM safety_observations WHERE project_id = $1
      )
      SELECT a.*, pe.folder_name, pe.entity_label
      FROM attachments a
      JOIN project_entities pe ON pe.entity_type = a.entity_type AND pe.entity_id = a.entity_id
      ORDER BY pe.folder_name, pe.entity_label, a.created_at
    `, [projectId]);

    const attachments = await Promise.all(
      attResult.rows.map(async (att) => ({
        ...att,
        url: await getFileUrl(att.filename),
      }))
    );

    // Drawings live in their own table with file_path, served via the drawings download endpoint
    const drawResult = await db.query(`
      SELECT id, drawing_number, title, discipline, file_name, file_type, file_size
      FROM drawings
      WHERE project_id = $1 AND file_path IS NOT NULL AND is_latest = true
      ORDER BY COALESCE(discipline, 'General'), drawing_number
    `, [projectId]);

    const drawings = drawResult.rows.map((d) => ({
      id: d.id,
      entity_type: 'drawing',
      entity_id: d.id,
      filename: d.file_name || `${d.drawing_number}.pdf`,
      original_name: d.file_name || `${d.drawing_number}.pdf`,
      mime_type: d.file_type || 'application/pdf',
      size: d.file_size || 0,
      url: `/api/drawings/${d.id}/download`,
      folder_name: 'Drawings',
      entity_label: d.discipline || 'General',
    }));

    res.json([...attachments, ...drawings]);
  } catch (error) {
    next(error);
  }
});

// Stream attachment file through backend — avoids CORS issues when fetching from R2 directly
router.get('/:id/download', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT a.* FROM attachments a JOIN users u ON u.id = a.uploaded_by WHERE a.id = $1 AND u.tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });

    const att = result.rows[0];

    if (isR2Enabled()) {
      const { stream, contentType, contentLength } = await getFileStream(att.filename);
      res.setHeader('Content-Type', contentType || att.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${att.original_name}"`);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      stream.pipe(res);
      return;
    }

    const filePath = path.isAbsolute(att.filename)
      ? att.filename
      : path.join(__dirname, '../../', att.filename);

    const uploadRoot = path.resolve(path.join(__dirname, '../../uploads'));
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(uploadRoot + path.sep) && resolvedPath !== uploadRoot) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(resolvedPath)) return res.status(404).json({ error: 'File not found' });

    res.setHeader('Content-Disposition', `attachment; filename="${att.original_name}"`);
    res.sendFile(resolvedPath);
  } catch (error) {
    next(error);
  }
});

// Get single attachment by ID with URL — must be before /:entityType/:entityId to avoid shadowing
router.get('/id/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT a.* FROM attachments a JOIN users u ON u.id = a.uploaded_by WHERE a.id = $1 AND u.tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    const attachment = result.rows[0];
    attachment.url = await getFileUrl(attachment.filename);
    res.json(attachment);
  } catch (error) {
    next(error);
  }
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

    const sectionArea = req.body?.section_area || null;
    const result = await db.query(
      `INSERT INTO attachments (entity_type, entity_id, filename, original_name, mime_type, size, uploaded_by, section_area)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [entityType, entityId, fileInfo.filePath, fileInfo.fileName, fileInfo.fileType, fileInfo.fileSize, req.user.id, sectionArea]
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
    const result = await db.query(
      'SELECT a.* FROM attachments a JOIN users u ON u.id = a.uploaded_by WHERE a.id = $1 AND u.tenant_id = $2',
      [req.params.id, req.tenantId]
    );
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
