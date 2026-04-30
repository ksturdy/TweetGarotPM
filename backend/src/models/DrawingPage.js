const db = require('../config/database');

const DrawingPage = {
  async upsert(drawingId, pageNumber, data) {
    const result = await db.query(
      `INSERT INTO drawing_pages (drawing_id, page_number, discipline, confidence, drawing_number, title, ai_classified, classified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (drawing_id, page_number) DO UPDATE SET
         discipline = EXCLUDED.discipline,
         confidence = EXCLUDED.confidence,
         drawing_number = EXCLUDED.drawing_number,
         title = EXCLUDED.title,
         ai_classified = EXCLUDED.ai_classified,
         classified_at = EXCLUDED.classified_at,
         updated_at = NOW()
       RETURNING *`,
      [
        drawingId, pageNumber,
        data.discipline || null,
        data.confidence || null,
        data.drawing_number || null,
        data.title || null,
        data.ai_classified || false,
        data.ai_classified ? new Date() : null,
      ]
    );
    return result.rows[0];
  },

  async bulkUpsert(drawingId, pages) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const page of pages) {
        const result = await client.query(
          `INSERT INTO drawing_pages (drawing_id, page_number, discipline, confidence, drawing_number, title, ai_classified, classified_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (drawing_id, page_number) DO UPDATE SET
             discipline = EXCLUDED.discipline,
             confidence = EXCLUDED.confidence,
             drawing_number = EXCLUDED.drawing_number,
             title = EXCLUDED.title,
             ai_classified = EXCLUDED.ai_classified,
             classified_at = EXCLUDED.classified_at,
             updated_at = NOW()
           RETURNING *`,
          [
            drawingId, page.page_number || page.page,
            page.discipline || null,
            page.confidence || null,
            page.drawing_number || null,
            page.title || null,
            page.ai_classified !== undefined ? page.ai_classified : true,
            page.ai_classified !== false ? new Date() : null,
          ]
        );
        results.push(result.rows[0]);
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async findByDrawing(drawingId, filters = {}) {
    let query = 'SELECT * FROM drawing_pages WHERE drawing_id = $1';
    const params = [drawingId];
    let paramCount = 2;

    if (filters.discipline) {
      params.push(filters.discipline);
      query += ` AND discipline = $${paramCount++}`;
    }

    query += ' ORDER BY page_number';
    const result = await db.query(query, params);
    return result.rows;
  },

  async getDisciplineSummary(drawingId) {
    const result = await db.query(
      `SELECT discipline, COUNT(*)::int as count
       FROM drawing_pages
       WHERE drawing_id = $1 AND discipline IS NOT NULL
       GROUP BY discipline
       ORDER BY count DESC`,
      [drawingId]
    );
    const summary = {};
    for (const row of result.rows) {
      summary[row.discipline] = row.count;
    }
    return summary;
  },

  async updateDiscipline(drawingId, pageNumber, discipline) {
    const result = await db.query(
      `UPDATE drawing_pages
       SET discipline = $3, ai_classified = false, updated_at = NOW()
       WHERE drawing_id = $1 AND page_number = $2
       RETURNING *`,
      [drawingId, pageNumber, discipline]
    );
    return result.rows[0];
  },

  async deleteByDrawing(drawingId) {
    await db.query('DELETE FROM drawing_pages WHERE drawing_id = $1', [drawingId]);
  },
};

module.exports = DrawingPage;
