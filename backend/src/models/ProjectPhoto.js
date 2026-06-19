const db = require('../config/database');
const { getFileUrl } = require('../utils/fileStorage');

async function withUrls(row) {
  return {
    ...row,
    url: await getFileUrl(row.file_path),
    thumb_url: row.thumb_path ? await getFileUrl(row.thumb_path) : null,
    feed_url: row.feed_path ? await getFileUrl(row.feed_path) : null,
  };
}

const SELECT = `
  SELECT pp.*,
         u.first_name || ' ' || u.last_name AS uploaded_by_name,
         p.name AS project_name,
         p.number AS job_number
  FROM project_photos pp
  LEFT JOIN users u ON u.id = pp.uploaded_by
  LEFT JOIN projects p ON p.id = pp.project_id
`;

const ProjectPhoto = {
  async findByProject(projectId, tenantId) {
    const result = await db.query(
      `${SELECT} WHERE pp.project_id = $1 AND pp.tenant_id = $2 ORDER BY pp.display_order ASC, pp.created_at ASC`,
      [projectId, tenantId]
    );
    return Promise.all(result.rows.map(withUrls));
  },

  async findAllByTenant(tenantId) {
    const result = await db.query(
      `${SELECT} WHERE pp.tenant_id = $1 ORDER BY pp.created_at DESC`,
      [tenantId]
    );
    return Promise.all(result.rows.map(withUrls));
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `${SELECT} WHERE pp.id = $1 AND pp.tenant_id = $2`,
      [id, tenantId]
    );
    if (!result.rows[0]) return null;
    return withUrls(result.rows[0]);
  },

  async create(data) {
    const result = await db.query(
      `INSERT INTO project_photos
         (tenant_id, project_id, file_name, file_path, thumb_path, feed_path,
          file_size, file_type, width, height, caption, tags, display_order, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        data.tenant_id,
        data.project_id,
        data.file_name,
        data.file_path,
        data.thumb_path || null,
        data.feed_path || null,
        data.file_size || null,
        data.file_type || null,
        data.width || null,
        data.height || null,
        data.caption || '',
        data.tags || '',
        data.display_order || 0,
        data.uploaded_by,
      ]
    );
    return withUrls(result.rows[0]);
  },

  async update(id, tenantId, data) {
    const result = await db.query(
      `UPDATE project_photos SET caption=$1, tags=$2, display_order=$3
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [data.caption, data.tags, data.display_order, id, tenantId]
    );
    if (!result.rows[0]) return null;
    return withUrls(result.rows[0]);
  },

  async delete(id, tenantId) {
    const result = await db.query(
      `DELETE FROM project_photos WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0] || null;
  },

  async countByProject(projectId) {
    const result = await db.query(
      `SELECT COUNT(*) FROM project_photos WHERE project_id=$1`,
      [projectId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async countUploadedTodayByUser(userId, tenantId) {
    const result = await db.query(
      `SELECT COUNT(*) FROM project_photos
       WHERE uploaded_by=$1 AND tenant_id=$2 AND created_at >= CURRENT_DATE`,
      [userId, tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = ProjectPhoto;
