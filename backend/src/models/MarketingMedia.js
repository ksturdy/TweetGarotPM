const db = require('../config/database');
const { getFileUrl } = require('../utils/fileStorage');

async function withUrls(row) {
  return {
    ...row,
    source: 'marketing',
    url: await getFileUrl(row.file_path),
    thumb_url: row.thumb_path ? await getFileUrl(row.thumb_path) : null,
    feed_url: row.feed_path ? await getFileUrl(row.feed_path) : null,
  };
}

const SELECT = `
  SELECT mm.*,
         u.first_name || ' ' || u.last_name AS uploaded_by_name
  FROM marketing_media mm
  LEFT JOIN users u ON u.id = mm.uploaded_by
`;

const MarketingMedia = {
  async findAll(tenantId) {
    const result = await db.query(
      `${SELECT} WHERE mm.tenant_id=$1 ORDER BY mm.created_at DESC`,
      [tenantId]
    );
    return Promise.all(result.rows.map(withUrls));
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `${SELECT} WHERE mm.id=$1 AND mm.tenant_id=$2`,
      [id, tenantId]
    );
    if (!result.rows[0]) return null;
    return withUrls(result.rows[0]);
  },

  async create(data) {
    const result = await db.query(
      `INSERT INTO marketing_media
         (tenant_id, title, file_name, file_path, thumb_path, feed_path,
          file_size, file_type, width, height, caption, tags, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        data.tenant_id,
        data.title || '',
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
        data.uploaded_by,
      ]
    );
    return withUrls(result.rows[0]);
  },

  async update(id, tenantId, data) {
    const result = await db.query(
      `UPDATE marketing_media SET title=$1, caption=$2, tags=$3
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [data.title, data.caption, data.tags, id, tenantId]
    );
    if (!result.rows[0]) return null;
    return withUrls(result.rows[0]);
  },

  async delete(id, tenantId) {
    const result = await db.query(
      `DELETE FROM marketing_media WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0] || null;
  },

  async countUploadedTodayByUser(userId, tenantId) {
    const result = await db.query(
      `SELECT COUNT(*) FROM marketing_media
       WHERE uploaded_by=$1 AND tenant_id=$2 AND created_at >= CURRENT_DATE`,
      [userId, tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = MarketingMedia;
