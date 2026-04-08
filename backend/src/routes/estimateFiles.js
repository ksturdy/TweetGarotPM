const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl, getFileInfo } = require('../utils/fileStorage');
const EstimateFolder = require('../models/EstimateFolder');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// Upload middleware: any file type, 50MB max
const upload = createUploadMiddleware({
  destination: 'estimates/project-files',
  allowedTypes: [],
  allowedExtensions: [],
  maxSize: 50 * 1024 * 1024,
});

// ── Folder Routes ──────────────────────────────────────────────

// List all folders (with file counts) for an estimate
router.get('/:estimateId/folders', async (req, res, next) => {
  try {
    const estimateId = Number(req.params.estimateId);
    await EstimateFolder.ensureDefaults(estimateId, req.tenantId);
    const folders = await EstimateFolder.findByEstimate(estimateId, req.tenantId);
    res.json(folders);
  } catch (error) {
    next(error);
  }
});

// Create a custom folder
router.post('/:estimateId/folders', async (req, res, next) => {
  try {
    const estimateId = Number(req.params.estimateId);
    const { folder_name, parent_folder_id } = req.body;

    if (!folder_name || !folder_name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await EstimateFolder.create(estimateId, req.tenantId, folder_name.trim(), parent_folder_id || null);
    res.status(201).json(folder);
  } catch (error) {
    if (error.constraint === 'idx_estimate_folders_unique_name') {
      return res.status(409).json({ error: 'A folder with that name already exists' });
    }
    next(error);
  }
});

// Rename a custom folder
router.put('/:estimateId/folders/:folderId', async (req, res, next) => {
  try {
    const folderId = Number(req.params.folderId);
    const { folder_name } = req.body;

    if (!folder_name || !folder_name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await EstimateFolder.rename(folderId, req.tenantId, folder_name.trim());
    if (!folder) {
      return res.status(400).json({ error: 'Cannot rename default folders' });
    }
    res.json(folder);
  } catch (error) {
    if (error.constraint === 'idx_estimate_folders_unique_name') {
      return res.status(409).json({ error: 'A folder with that name already exists' });
    }
    next(error);
  }
});

// Delete a custom folder + all its files
router.delete('/:estimateId/folders/:folderId', async (req, res, next) => {
  try {
    const folderId = Number(req.params.folderId);
    const { deleted, fileKeys } = await EstimateFolder.delete(folderId, req.tenantId);

    if (!deleted) {
      return res.status(400).json({ error: 'Cannot delete default folders' });
    }

    // Clean up files from storage
    for (const key of fileKeys) {
      await deleteFile(key).catch(console.error);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ── File Routes ────────────────────────────────────────────────

// List files in a folder
router.get('/:estimateId/folders/:folderId/files', async (req, res, next) => {
  try {
    const folderId = Number(req.params.folderId);
    const files = await EstimateFolder.getFiles(folderId, req.tenantId);

    // Add download URLs
    const filesWithUrls = await Promise.all(
      files.map(async (file) => ({
        ...file,
        url: await getFileUrl(file.filename),
      }))
    );

    res.json(filesWithUrls);
  } catch (error) {
    next(error);
  }
});

// Upload files to a folder
router.post('/:estimateId/folders/:folderId/files', upload.array('files', 10), async (req, res, next) => {
  try {
    const estimateId = Number(req.params.estimateId);
    const folderId = Number(req.params.folderId);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const created = [];
    for (const file of req.files) {
      const fileInfo = getFileInfo(file);
      const record = await EstimateFolder.createFile({
        folderId,
        estimateId,
        tenantId: req.tenantId,
        filename: fileInfo.filePath,
        originalName: fileInfo.fileName,
        mimeType: fileInfo.fileType,
        size: fileInfo.fileSize,
        uploadedBy: req.user.id,
      });
      record.url = await getFileUrl(record.filename);
      created.push(record);
    }

    res.status(201).json(created);
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        const fileInfo = getFileInfo(file);
        await deleteFile(fileInfo.filePath).catch(console.error);
      }
    }
    next(error);
  }
});

// Delete a single file
router.delete('/:estimateId/files/:fileId', async (req, res, next) => {
  try {
    const fileId = Number(req.params.fileId);
    const file = await EstimateFolder.deleteFile(fileId, req.tenantId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await deleteFile(file.filename).catch(console.error);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Get download URL for a file
router.get('/:estimateId/files/:fileId/download', async (req, res, next) => {
  try {
    const fileId = Number(req.params.fileId);
    const file = await EstimateFolder.getFileById(fileId, req.tenantId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const url = await getFileUrl(file.filename);
    res.json({ url, originalName: file.original_name, mimeType: file.mime_type });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
