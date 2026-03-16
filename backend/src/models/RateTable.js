const db = require('../config/database');

const RateTable = {
  async findAll(tenantId) {
    const result = await db.query(
      `SELECT rt.*,
              COUNT(rtc.id)::int AS column_count
       FROM rate_tables rt
       LEFT JOIN rate_table_columns rtc ON rtc.rate_table_id = rt.id
       WHERE rt.tenant_id = $1
       GROUP BY rt.id
       ORDER BY rt.category, rt.name`,
      [tenantId]
    );
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `SELECT * FROM rate_tables WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    const table = result.rows[0];
    if (!table) return null;

    table.columns = await this.getColumns(id);
    return table;
  },

  async getColumns(tableId) {
    const result = await db.query(
      `SELECT * FROM rate_table_columns WHERE rate_table_id = $1 ORDER BY sort_order, id`,
      [tableId]
    );
    return result.rows;
  },

  async create(tenantId, { name, category, notes, columns }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const tableResult = await client.query(
        `INSERT INTO rate_tables (tenant_id, name, category, notes)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [tenantId, name, category, notes || '']
      );
      const table = tableResult.rows[0];

      if (columns && columns.length > 0) {
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          await client.query(
            `INSERT INTO rate_table_columns (rate_table_id, column_key, column_label, sort_order, rates)
             VALUES ($1, $2, $3, $4, $5)`,
            [table.id, col.column_key, col.column_label, col.sort_order ?? i, JSON.stringify(col.rates || {})]
          );
        }
      }

      await client.query('COMMIT');

      // Return with columns populated
      table.columns = await this.getColumns(table.id);
      return table;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id, tenantId, data) {
    const fields = [];
    const params = [id, tenantId];
    let paramIdx = 3;

    const allowed = ['name', 'category', 'notes'];
    for (const field of allowed) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIdx++}`);
        params.push(data[field]);
      }
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    const result = await db.query(
      `UPDATE rate_tables SET ${fields.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      `DELETE FROM rate_tables WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async duplicate(id, tenantId, newName) {
    const source = await this.findById(id, tenantId);
    if (!source) return null;

    return this.create(tenantId, {
      name: newName,
      category: source.category,
      notes: source.notes,
      columns: source.columns.map((c) => ({
        column_key: c.column_key,
        column_label: c.column_label,
        sort_order: c.sort_order,
        rates: c.rates,
      })),
    });
  },

  // ─── Column CRUD ───

  async updateColumn(columnId, data) {
    const fields = [];
    const params = [columnId];
    let paramIdx = 2;

    if (data.column_key !== undefined) {
      fields.push(`column_key = $${paramIdx++}`);
      params.push(data.column_key);
    }
    if (data.column_label !== undefined) {
      fields.push(`column_label = $${paramIdx++}`);
      params.push(data.column_label);
    }
    if (data.rates !== undefined) {
      fields.push(`rates = $${paramIdx++}`);
      params.push(JSON.stringify(data.rates));
    }
    if (data.sort_order !== undefined) {
      fields.push(`sort_order = $${paramIdx++}`);
      params.push(data.sort_order);
    }

    if (fields.length === 0) return null;

    const result = await db.query(
      `UPDATE rate_table_columns SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async addColumns(tableId, columns) {
    if (!columns || columns.length === 0) return [];

    // Get current max sort_order
    const maxResult = await db.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM rate_table_columns WHERE rate_table_id = $1`,
      [tableId]
    );
    let nextOrder = maxResult.rows[0].max_order + 1;

    const added = [];
    for (const col of columns) {
      const result = await db.query(
        `INSERT INTO rate_table_columns (rate_table_id, column_key, column_label, sort_order, rates)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (rate_table_id, column_key) DO UPDATE SET
           column_label = EXCLUDED.column_label,
           rates = EXCLUDED.rates,
           sort_order = EXCLUDED.sort_order
         RETURNING *`,
        [tableId, col.column_key, col.column_label, col.sort_order ?? nextOrder++, JSON.stringify(col.rates || {})]
      );
      added.push(result.rows[0]);
    }
    return added;
  },

  async removeColumn(columnId) {
    const result = await db.query(
      `DELETE FROM rate_table_columns WHERE id = $1 RETURNING id`,
      [columnId]
    );
    return result.rows[0];
  },
};

module.exports = RateTable;
