const db = require('../config/database');

const DEFAULT_FOLDERS = [
  { folder_name: 'Drawings', sort_order: 0 },
  { folder_name: 'Specifications', sort_order: 1 },
  { folder_name: 'Addenda', sort_order: 2 },
  { folder_name: 'RFQs', sort_order: 3 },
];

const EstimateFolder = {
  /**
   * Ensure default folders exist for an estimate (idempotent)
   */
  async ensureDefaults(estimateId, tenantId) {
    for (const folder of DEFAULT_FOLDERS) {
      await db.query(
        `INSERT INTO estimate_folders (estimate_id, tenant_id, folder_name, folder_type, sort_order, parent_folder_id)
         VALUES ($1, $2, $3, 'default', $4, NULL)
         ON CONFLICT (estimate_id, COALESCE(parent_folder_id, 0), folder_name) DO NOTHING`,
        [estimateId, tenantId, folder.folder_name, folder.sort_order]
      );
    }
  },

  /**
   * Get all folders for an estimate with file counts (flat list, frontend builds tree)
   */
  async findByEstimate(estimateId, tenantId) {
    const result = await db.query(
      `SELECT ef.*,
        (SELECT COUNT(*) FROM estimate_files WHERE folder_id = ef.id) AS file_count
       FROM estimate_folders ef
       WHERE ef.estimate_id = $1 AND ef.tenant_id = $2
       ORDER BY ef.parent_folder_id NULLS FIRST, ef.sort_order, ef.folder_name`,
      [estimateId, tenantId]
    );
    return result.rows;
  },

  /**
   * Create a custom folder (optionally nested under a parent)
   */
  async create(estimateId, tenantId, folderName, parentFolderId = null) {
    const maxResult = await db.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
       FROM estimate_folders
       WHERE estimate_id = $1 AND COALESCE(parent_folder_id, 0) = COALESCE($2, 0)`,
      [estimateId, parentFolderId]
    );
    const sortOrder = maxResult.rows[0].next_order;

    const result = await db.query(
      `INSERT INTO estimate_folders (estimate_id, tenant_id, folder_name, folder_type, sort_order, parent_folder_id)
       VALUES ($1, $2, $3, 'custom', $4, $5)
       RETURNING *`,
      [estimateId, tenantId, folderName, sortOrder, parentFolderId]
    );
    return result.rows[0];
  },

  /**
   * Rename a custom folder (rejects default folders)
   */
  async rename(folderId, tenantId, newName) {
    const result = await db.query(
      `UPDATE estimate_folders
       SET folder_name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3 AND folder_type = 'custom'
       RETURNING *`,
      [newName, folderId, tenantId]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a custom folder (rejects default folders).
   * Returns file storage keys for cleanup (includes files from child folders via CASCADE).
   */
  async delete(folderId, tenantId) {
    // Recursively collect all files in this folder and all descendants
    const filesResult = await db.query(
      `WITH RECURSIVE folder_tree AS (
         SELECT id FROM estimate_folders WHERE id = $1 AND tenant_id = $2
         UNION ALL
         SELECT ef.id FROM estimate_folders ef
         JOIN folder_tree ft ON ef.parent_folder_id = ft.id
       )
       SELECT filename FROM estimate_files WHERE folder_id IN (SELECT id FROM folder_tree)`,
      [folderId, tenantId]
    );
    const fileKeys = filesResult.rows.map(f => f.filename);

    // Delete folder (cascade deletes child folders and files from DB)
    const result = await db.query(
      `DELETE FROM estimate_folders
       WHERE id = $1 AND tenant_id = $2 AND folder_type = 'custom'
       RETURNING *`,
      [folderId, tenantId]
    );

    return { deleted: result.rows[0] || null, fileKeys };
  },

  /**
   * Get files in a folder
   */
  async getFiles(folderId, tenantId) {
    const result = await db.query(
      `SELECT ef.*,
        u.first_name || ' ' || u.last_name AS uploaded_by_name
       FROM estimate_files ef
       LEFT JOIN users u ON u.id = ef.uploaded_by
       WHERE ef.folder_id = $1 AND ef.tenant_id = $2
       ORDER BY ef.created_at DESC`,
      [folderId, tenantId]
    );
    return result.rows;
  },

  /**
   * Create a file record
   */
  async createFile(data) {
    const { folderId, estimateId, tenantId, filename, originalName, mimeType, size, uploadedBy } = data;
    const result = await db.query(
      `INSERT INTO estimate_files (folder_id, estimate_id, tenant_id, filename, original_name, mime_type, size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [folderId, estimateId, tenantId, filename, originalName, mimeType, size, uploadedBy]
    );
    return result.rows[0];
  },

  /**
   * Get a file by ID
   */
  async getFileById(fileId, tenantId) {
    const result = await db.query(
      `SELECT * FROM estimate_files WHERE id = $1 AND tenant_id = $2`,
      [fileId, tenantId]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a file record. Returns file info for storage cleanup.
   */
  async deleteFile(fileId, tenantId) {
    const result = await db.query(
      `DELETE FROM estimate_files WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [fileId, tenantId]
    );
    return result.rows[0] || null;
  },
};

module.exports = EstimateFolder;
