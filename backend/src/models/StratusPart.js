const db = require('../config/database');

const PART_COLUMNS = [
  'stratus_part_id', 'cad_id', 'model_id', 'assembly_id', 'assembly_name', 'part_number',
  'service_name', 'service_abbreviation', 'fabrication_service', 'item_description',
  'area', 'size', 'part_division', 'package_category', 'category', 'cost_category',
  'length', 'item_weight', 'install_hours',
  'material_cost', 'install_cost', 'fabrication_cost', 'total_cost',
  'part_tracking_status', 'part_field_phase_code', 'part_shop_phase_code',
  'weld_id', 'fit_id', 'qc_id',
  'part_issue_to_shop_dt', 'part_shipped_dt', 'part_field_installed_dt',
  'fab_complete_date', 'qaqc_complete_date',
  'raw',
];

const StratusPart = {
  async createImport({ tenantId, projectId, filename, sourceProjectName, rowCount, importedBy, snapshotAt }) {
    const result = await db.query(
      `INSERT INTO stratus_imports (tenant_id, project_id, filename, source_project_name, row_count, imported_by, snapshot_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, projectId, filename || null, sourceProjectName || null, rowCount, importedBy || null, snapshotAt || null]
    );
    return result.rows[0];
  },

  async bulkInsertParts({ tenantId, projectId, importId, parts }) {
    if (parts.length === 0) return 0;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const baseCols = ['tenant_id', 'project_id', 'import_id', ...PART_COLUMNS];
      const chunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < parts.length; i += chunkSize) {
        const chunk = parts.slice(i, i + chunkSize);
        const values = [];
        const placeholders = chunk.map((p, rowIdx) => {
          const row = [tenantId, projectId, importId, ...PART_COLUMNS.map((c) => (c === 'raw' ? JSON.stringify(p[c]) : p[c]))];
          const start = rowIdx * baseCols.length;
          values.push(...row);
          return '(' + baseCols.map((_, j) => `$${start + j + 1}`).join(',') + ')';
        });
        const sql = `INSERT INTO stratus_parts (${baseCols.join(',')}) VALUES ${placeholders.join(',')}`;
        await client.query(sql, values);
        inserted += chunk.length;
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getLatestImport(projectId, tenantId) {
    const result = await db.query(
      `SELECT si.*, u.first_name || ' ' || u.last_name AS imported_by_name
       FROM stratus_imports si
       LEFT JOIN users u ON si.imported_by = u.id
       WHERE si.tenant_id = $1 AND si.project_id = $2
       ORDER BY si.imported_at DESC
       LIMIT 1`,
      [tenantId, projectId]
    );
    return result.rows[0] || null;
  },

  async listImports(projectId, tenantId) {
    const result = await db.query(
      `SELECT si.*, u.first_name || ' ' || u.last_name AS imported_by_name
       FROM stratus_imports si
       LEFT JOIN users u ON si.imported_by = u.id
       WHERE si.tenant_id = $1 AND si.project_id = $2
       ORDER BY si.imported_at DESC`,
      [tenantId, projectId]
    );
    return result.rows;
  },

  async deleteImport(importId, tenantId) {
    const result = await db.query(
      `DELETE FROM stratus_imports WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [importId, tenantId]
    );
    return result.rowCount > 0;
  },

  async listParts({ projectId, tenantId, importId, filters = {}, limit = 100, offset = 0 }) {
    const conditions = ['tenant_id = $1', 'project_id = $2', 'import_id = $3'];
    const params = [tenantId, projectId, importId];
    let p = 4;
    const addEq = (col, val) => {
      if (val !== undefined && val !== null && val !== '') {
        conditions.push(`${col} = $${p++}`);
        params.push(val);
      }
    };
    addEq('part_tracking_status', filters.status);
    addEq('part_field_phase_code', filters.phase_code);
    addEq('service_name', filters.service);
    addEq('area', filters.area);
    addEq('size', filters.size);
    addEq('part_division', filters.division);
    addEq('package_category', filters.package_category);
    if (filters.search) {
      conditions.push(`(item_description ILIKE $${p} OR service_name ILIKE $${p} OR cad_id ILIKE $${p})`);
      params.push(`%${filters.search}%`);
      p++;
    }
    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM stratus_parts WHERE ${where}`,
      params
    );

    const dataResult = await db.query(
      `SELECT id, stratus_part_id, cad_id, part_number, service_name, service_abbreviation,
              item_description, area, size, part_division, package_category, category,
              length, item_weight, install_hours, material_cost, install_cost, total_cost,
              part_tracking_status, part_field_phase_code, part_shop_phase_code,
              part_issue_to_shop_dt, part_shipped_dt, part_field_installed_dt,
              fab_complete_date, qaqc_complete_date, assembly_name
       FROM stratus_parts
       WHERE ${where}
       ORDER BY part_field_phase_code NULLS LAST, service_name, item_description, id
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { total: countResult.rows[0].total, rows: dataResult.rows };
  },

  async getStatusByPhaseSummary({ projectId, tenantId, importId }) {
    const result = await db.query(
      `SELECT
         part_field_phase_code,
         part_tracking_status,
         COUNT(*)::int AS part_count,
         COALESCE(SUM(install_hours), 0)::numeric AS total_hours,
         COALESCE(SUM(item_weight), 0)::numeric AS total_weight,
         COALESCE(SUM(length), 0)::numeric AS total_length,
         COALESCE(SUM(total_cost), 0)::numeric AS total_cost
       FROM stratus_parts
       WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3
       GROUP BY part_field_phase_code, part_tracking_status
       ORDER BY part_field_phase_code NULLS LAST, part_tracking_status`,
      [tenantId, projectId, importId]
    );
    return result.rows;
  },

  async getFilterOptions({ projectId, tenantId, importId }) {
    const result = await db.query(
      `SELECT
         ARRAY(SELECT DISTINCT part_tracking_status FROM stratus_parts
               WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3 AND part_tracking_status IS NOT NULL
               ORDER BY part_tracking_status) AS statuses,
         ARRAY(SELECT DISTINCT part_field_phase_code FROM stratus_parts
               WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3 AND part_field_phase_code IS NOT NULL
               ORDER BY part_field_phase_code) AS phase_codes,
         ARRAY(SELECT DISTINCT service_name FROM stratus_parts
               WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3 AND service_name IS NOT NULL
               ORDER BY service_name) AS services,
         ARRAY(SELECT DISTINCT area FROM stratus_parts
               WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3 AND area IS NOT NULL
               ORDER BY area) AS areas,
         ARRAY(SELECT DISTINCT size FROM stratus_parts
               WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3 AND size IS NOT NULL
               ORDER BY size) AS sizes,
         ARRAY(SELECT DISTINCT part_division FROM stratus_parts
               WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3 AND part_division IS NOT NULL
               ORDER BY part_division) AS divisions,
         ARRAY(SELECT DISTINCT package_category FROM stratus_parts
               WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3 AND package_category IS NOT NULL
               ORDER BY package_category) AS package_categories`,
      [tenantId, projectId, importId]
    );
    return result.rows[0];
  },
};

module.exports = StratusPart;
