const db = require('../config/database');
const { normalizeSize } = require('../utils/sizeNormalizer');
const { detectFittingType, parseCompoundSize } = require('../utils/estFittingDetector');

const BATCH_SIZE = 100;

/**
 * Deduplicate rows within a batch by product_id, keeping the last occurrence.
 * PostgreSQL's ON CONFLICT DO UPDATE cannot affect the same row twice in one INSERT.
 */
const deduplicateBatch = (batch) => {
  const map = new Map();
  for (const row of batch) {
    map.set(row.product_id, row);
  }
  return Array.from(map.values());
};

const EstProduct = {
  // ==================== IMPORT BATCHES ====================

  async createImportBatch(data, tenantId) {
    const result = await db.query(
      `INSERT INTO vp_import_batches (
        tenant_id, file_name, file_type, records_total, records_new,
        records_updated, records_auto_matched, imported_by
      ) VALUES ($1, $2, 'est_products', $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        tenantId,
        data.file_name,
        data.records_total || 0,
        data.records_new || 0,
        data.records_updated || 0,
        data.records_auto_matched || 0,
        data.imported_by
      ]
    );
    return result.rows[0];
  },

  async updateImportBatch(id, data) {
    const result = await db.query(
      `UPDATE vp_import_batches SET
        records_total = COALESCE($1, records_total),
        records_new = COALESCE($2, records_new),
        records_updated = COALESCE($3, records_updated),
        records_auto_matched = COALESCE($4, records_auto_matched)
      WHERE id = $5
      RETURNING *`,
      [data.records_total, data.records_new, data.records_updated, data.records_auto_matched, id]
    );
    return result.rows[0];
  },

  async getImportHistory(tenantId, limit = 20) {
    const result = await db.query(
      `SELECT ib.*, u.first_name || ' ' || u.last_name as imported_by_name
       FROM vp_import_batches ib
       LEFT JOIN users u ON ib.imported_by = u.id
       WHERE ib.tenant_id = $1 AND ib.file_type = 'est_products'
       ORDER BY ib.imported_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  },

  // ==================== BATCH UPSERTS ====================

  /**
   * Bulk upsert rows from the MapProd sheet.
   * Uses multi-row INSERT ... ON CONFLICT for performance.
   * Returns { newCount, updatedCount }
   */
  async bulkUpsertMapProd(rows, tenantId, batchId) {
    let newCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = deduplicateBatch(rows.slice(i, i + BATCH_SIZE));
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const row of batch) {
        const sizeNorm = normalizeSize(row.size);
        values.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}, $${paramIdx + 10}, $${paramIdx + 11}, $${paramIdx + 12}, $${paramIdx + 13})`
        );
        params.push(
          tenantId,
          row.product_id,
          row.group_name || null,
          row.manufacturer || null,
          row.product || null,
          row.description || null,
          row.size || null,
          sizeNorm,
          row.material || null,
          row.spec || null,
          row.install_type || null,
          row.source_description || null,
          row.range || null,
          row.finish || null
        );
        paramIdx += 14;
      }

      const result = await db.query(
        `INSERT INTO est_products (
          tenant_id, product_id, group_name, manufacturer, product,
          description, size, size_normalized, material, spec,
          install_type, source_description, range, finish
        ) VALUES ${values.join(', ')}
        ON CONFLICT (tenant_id, product_id)
        DO UPDATE SET
          group_name = EXCLUDED.group_name,
          manufacturer = EXCLUDED.manufacturer,
          product = EXCLUDED.product,
          description = EXCLUDED.description,
          size = EXCLUDED.size,
          size_normalized = EXCLUDED.size_normalized,
          material = EXCLUDED.material,
          spec = EXCLUDED.spec,
          install_type = EXCLUDED.install_type,
          source_description = EXCLUDED.source_description,
          range = EXCLUDED.range,
          finish = EXCLUDED.finish
        RETURNING (xmax = 0) AS is_new`,
        params
      );

      for (const r of result.rows) {
        if (r.is_new) newCount++;
        else updatedCount++;
      }
    }

    return { newCount, updatedCount };
  },

  /**
   * Bulk upsert rows from the Cost sheet.
   * Updates cost columns on existing rows or creates new rows with cost data only.
   */
  async bulkUpsertCost(rows, tenantId, batchId) {
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = deduplicateBatch(rows.slice(i, i + BATCH_SIZE));
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const row of batch) {
        values.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`
        );
        params.push(
          tenantId,
          row.product_id,
          row.cost != null ? row.cost : null,
          row.cost_factor || null,
          row.cost_unit || null,
          row.cost_date || null,
          row.cost_status || null
        );
        paramIdx += 7;
      }

      const result = await db.query(
        `INSERT INTO est_products (
          tenant_id, product_id, cost, cost_factor, cost_unit, cost_date, cost_status
        ) VALUES ${values.join(', ')}
        ON CONFLICT (tenant_id, product_id)
        DO UPDATE SET
          cost = EXCLUDED.cost,
          cost_factor = EXCLUDED.cost_factor,
          cost_unit = EXCLUDED.cost_unit,
          cost_date = EXCLUDED.cost_date,
          cost_status = EXCLUDED.cost_status
        RETURNING (xmax = 0) AS is_new`,
        params
      );

      for (const r of result.rows) {
        if (r.is_new) unmatchedCount++;
        else matchedCount++;
      }
    }

    return { matchedCount, unmatchedCount };
  },

  /**
   * Bulk upsert rows from the Labor sheet.
   * Updates labor columns on existing rows or creates new rows with labor data only.
   */
  async bulkUpsertLabor(rows, tenantId, batchId) {
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = deduplicateBatch(rows.slice(i, i + BATCH_SIZE));
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const row of batch) {
        values.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`
        );
        params.push(
          tenantId,
          row.product_id,
          row.labor_time != null ? row.labor_time : null,
          row.labor_units || null
        );
        paramIdx += 4;
      }

      const result = await db.query(
        `INSERT INTO est_products (
          tenant_id, product_id, labor_time, labor_units
        ) VALUES ${values.join(', ')}
        ON CONFLICT (tenant_id, product_id)
        DO UPDATE SET
          labor_time = EXCLUDED.labor_time,
          labor_units = EXCLUDED.labor_units
        RETURNING (xmax = 0) AS is_new`,
        params
      );

      for (const r of result.rows) {
        if (r.is_new) unmatchedCount++;
        else matchedCount++;
      }
    }

    return { matchedCount, unmatchedCount };
  },

  /**
   * Update import_batch_id for all products belonging to this tenant
   * that were just imported (have no batch or a different batch).
   */
  async setBatchId(tenantId, batchId) {
    await db.query(
      `UPDATE est_products SET import_batch_id = $1, imported_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $2`,
      [batchId, tenantId]
    );
  },

  // ==================== QUERIES ====================

  async getStats(tenantId) {
    const result = await db.query(
      `SELECT
        COUNT(*) AS total_products,
        COUNT(cost) AS products_with_cost,
        COUNT(labor_time) AS products_with_labor,
        COUNT(CASE WHEN cost IS NOT NULL AND labor_time IS NOT NULL THEN 1 END) AS products_with_both,
        MAX(imported_at) AS last_import
      FROM est_products
      WHERE tenant_id = $1`,
      [tenantId]
    );

    const groupResult = await db.query(
      `SELECT group_name, COUNT(*) AS count
       FROM est_products
       WHERE tenant_id = $1 AND group_name IS NOT NULL
       GROUP BY group_name
       ORDER BY count DESC`,
      [tenantId]
    );

    const stats = result.rows[0];
    stats.groups = groupResult.rows;
    return stats;
  },

  async search(tenantId, filters = {}) {
    const { group, material, size, installType, manufacturer, search, page = 1, limit = 50 } = filters;

    let query = `SELECT * FROM est_products WHERE tenant_id = $1`;
    let countQuery = `SELECT COUNT(*) FROM est_products WHERE tenant_id = $1`;
    const params = [tenantId];
    const countParams = [tenantId];
    let paramIdx = 2;

    if (group) {
      const clause = ` AND group_name = $${paramIdx}`;
      query += clause;
      countQuery += clause;
      params.push(group);
      countParams.push(group);
      paramIdx++;
    }

    if (material) {
      const clause = ` AND material = $${paramIdx}`;
      query += clause;
      countQuery += clause;
      params.push(material);
      countParams.push(material);
      paramIdx++;
    }

    if (size) {
      const clause = ` AND (size_normalized = $${paramIdx} OR size ILIKE $${paramIdx + 1})`;
      query += clause;
      countQuery += clause;
      const normalized = normalizeSize(size);
      params.push(normalized || size, `%${size}%`);
      countParams.push(normalized || size, `%${size}%`);
      paramIdx += 2;
    }

    if (installType) {
      const clause = ` AND install_type = $${paramIdx}`;
      query += clause;
      countQuery += clause;
      params.push(installType);
      countParams.push(installType);
      paramIdx++;
    }

    if (manufacturer) {
      const clause = ` AND manufacturer = $${paramIdx}`;
      query += clause;
      countQuery += clause;
      params.push(manufacturer);
      countParams.push(manufacturer);
      paramIdx++;
    }

    if (search) {
      const clause = ` AND (
        product_id ILIKE $${paramIdx}
        OR to_tsvector('english', COALESCE(product_id, '') || ' ' || COALESCE(product, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(manufacturer, ''))
           @@ plainto_tsquery('english', $${paramIdx + 1})
        OR description ILIKE $${paramIdx}
        OR product ILIKE $${paramIdx}
      )`;
      query += clause;
      countQuery += clause;
      params.push(`%${search}%`, search);
      countParams.push(`%${search}%`, search);
      paramIdx += 2;
    }

    // Get total count
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const offset = (page - 1) * limit;
    query += ` ORDER BY group_name, product, size_normalized LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return {
      items: result.rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  },

  async findById(id, tenantId) {
    const result = await db.query(
      'SELECT * FROM est_products WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] || null;
  },

  async findByProductId(productId, tenantId) {
    const result = await db.query(
      'SELECT * FROM est_products WHERE product_id = $1 AND tenant_id = $2',
      [productId, tenantId]
    );
    return result.rows[0] || null;
  },

  // ==================== DISTINCT VALUES (for filter dropdowns) ====================

  async getDistinctGroups(tenantId) {
    const result = await db.query(
      `SELECT DISTINCT group_name FROM est_products
       WHERE tenant_id = $1 AND group_name IS NOT NULL
       ORDER BY group_name`,
      [tenantId]
    );
    return result.rows.map(r => r.group_name);
  },

  async getDistinctMaterials(tenantId, group = null) {
    let query = `SELECT DISTINCT material FROM est_products WHERE tenant_id = $1 AND material IS NOT NULL`;
    const params = [tenantId];
    if (group) {
      query += ` AND group_name = $2`;
      params.push(group);
    }
    query += ` ORDER BY material`;
    const result = await db.query(query, params);
    return result.rows.map(r => r.material);
  },

  async getDistinctSizes(tenantId, group = null, material = null) {
    let query = `SELECT DISTINCT size_normalized FROM est_products WHERE tenant_id = $1 AND size_normalized IS NOT NULL`;
    const params = [tenantId];
    let paramIdx = 2;
    if (group) {
      query += ` AND group_name = $${paramIdx}`;
      params.push(group);
      paramIdx++;
    }
    if (material) {
      query += ` AND material = $${paramIdx}`;
      params.push(material);
      paramIdx++;
    }
    query += ` ORDER BY size_normalized`;
    const result = await db.query(query, params);
    return result.rows.map(r => r.size_normalized);
  },

  async getDistinctInstallTypes(tenantId, group = null) {
    let query = `SELECT DISTINCT install_type FROM est_products WHERE tenant_id = $1 AND install_type IS NOT NULL`;
    const params = [tenantId];
    if (group) {
      query += ` AND group_name = $2`;
      params.push(group);
    }
    query += ` ORDER BY install_type`;
    const result = await db.query(query, params);
    return result.rows.map(r => r.install_type);
  },

  async getDistinctManufacturers(tenantId, group = null) {
    let query = `SELECT DISTINCT manufacturer FROM est_products WHERE tenant_id = $1 AND manufacturer IS NOT NULL`;
    const params = [tenantId];
    if (group) {
      query += ` AND group_name = $2`;
      params.push(group);
    }
    query += ` ORDER BY manufacturer`;
    const result = await db.query(query, params);
    return result.rows.map(r => r.manufacturer);
  },

  // ==================== SPEC FILTER OPTIONS ====================

  /**
   * Get distinct install_types and materials that have labor data,
   * for populating dropdown selectors in the EST import modal.
   */
  async getSpecFilterOptions(tenantId, filters = {}) {
    const { installType, product, material } = filters;

    const baseWhere = `tenant_id = $1 AND labor_time IS NOT NULL AND labor_time > 0`;

    // Build install types query
    let itQuery = `SELECT install_type, COUNT(*) as cnt FROM est_products WHERE ${baseWhere} AND install_type IS NOT NULL`;
    const itParams = [tenantId];
    let itIdx = 2;
    if (product) { itQuery += ` AND product = $${itIdx}`; itParams.push(product); itIdx++; }
    itQuery += ` GROUP BY install_type ORDER BY cnt DESC`;

    // Build materials query (filtered by installType if provided)
    let matQuery = `SELECT material, COUNT(*) as cnt FROM est_products WHERE ${baseWhere} AND material IS NOT NULL`;
    const matParams = [tenantId];
    let matIdx = 2;
    if (product) { matQuery += ` AND product = $${matIdx}`; matParams.push(product); matIdx++; }
    if (installType) { matQuery += ` AND install_type = $${matIdx}`; matParams.push(installType); matIdx++; }
    matQuery += ` GROUP BY material ORDER BY cnt DESC`;

    // Build specs query (filtered by installType and material if provided)
    let specQuery = `SELECT spec, COUNT(*) as cnt FROM est_products WHERE ${baseWhere} AND spec IS NOT NULL AND spec != '-'`;
    const specParams = [tenantId];
    let specIdx = 2;
    if (product) { specQuery += ` AND product = $${specIdx}`; specParams.push(product); specIdx++; }
    if (installType) { specQuery += ` AND install_type = $${specIdx}`; specParams.push(installType); specIdx++; }
    if (material) { specQuery += ` AND material = $${specIdx}`; specParams.push(material); specIdx++; }
    specQuery += ` GROUP BY spec ORDER BY cnt DESC`;

    // Run all three queries in parallel
    const [itResult, matResult, specResult] = await Promise.all([
      db.query(itQuery, itParams),
      db.query(matQuery, matParams),
      db.query(specQuery, specParams),
    ]);

    return {
      installTypes: itResult.rows.map(r => ({ value: r.install_type, count: parseInt(r.cnt) })),
      materials: matResult.rows.map(r => ({ value: r.material, count: parseInt(r.cnt) })),
      specs: specResult.rows.map(r => ({ value: r.spec, count: parseInt(r.cnt) })),
    };
  },

  // ==================== RATES FOR SPEC ====================

  /**
   * Build cost maps for a pipe spec by querying est_products.
   *
   * Uses the product_id to join MapProd metadata (size, description) with Cost
   * pricing data. Returns a cost_maps object compatible with the pipe_specs
   * cost_maps JSONB column:
   *   { pipeCosts, fittingCosts, reducingFittingCosts, reducingTeeCosts }
   *
   * Unlike getRatesForSpec, this does NOT require labor_time — it only
   * requires cost data to exist.
   */
  async buildCostMapsForSpec(tenantId, installType, material, estFilters) {
    if (!installType || !material) return null;

    const result = await db.query(
      `SELECT product_id, product, description, size, size_normalized,
              install_type, material, unit_type, cost, group_name, spec
       FROM est_products
       WHERE tenant_id = $1
         AND install_type = $2
         AND material = $3
         AND cost IS NOT NULL
         AND cost > 0
       ORDER BY unit_type, size_normalized, description`,
      [tenantId, installType, material]
    );

    // Build spec-number matchers from est_filters so pipe and fittings
    // can each filter to their own ASTM spec.  Normalizes both sides:
    //   "ASTM A-53" → "53",  "ASTM A/SA53" → "53"
    function extractSpecNum(s) {
      if (!s) return null;
      const m = String(s).match(/(\d+)\s*$/);
      return m ? m[1] : null;
    }
    const pipeSpecNum = extractSpecNum(estFilters?.pipe?.spec);
    const fittingSpecNum = extractSpecNum(estFilters?.fittings?.spec);

    function specMatches(rowSpec, filterNum) {
      if (!filterNum) return true;            // no filter → accept all
      if (!rowSpec) return true;              // row has no spec → accept (don't exclude unknowns)
      return extractSpecNum(rowSpec) === filterNum;
    }

    if (result.rows.length === 0) return null;

    // ── Size key normalization ──
    // The frontend uses fraction-style sizes: "1/2", "1 1/4", "2 1/2", "10"
    // with "|" separator for compound keys: "4|2", "1 1/2|3/4"
    // The DB size_normalized uses decimals: "0.5", "1.25", "2.5"
    // We must convert to the frontend format for lookup compatibility.

    const DECIMAL_TO_FRACTION = {
      '0.125': '1/8', '0.25': '1/4', '0.375': '3/8', '0.5': '1/2',
      '0.625': '5/8', '0.75': '3/4', '0.875': '7/8',
      '1.25': '1 1/4', '1.375': '1 3/8', '1.5': '1 1/2', '1.75': '1 3/4',
      '2.25': '2 1/4', '2.5': '2 1/2', '2.75': '2 3/4',
      '3.5': '3 1/2', '4.5': '4 1/2', '5.5': '5 1/2',
    };

    function sizeToFrontendKey(rawSize) {
      if (!rawSize) return null;
      // Strip all types of quote marks
      let s = String(rawSize).replace(/[''""'\u2018\u2019\u201C\u201D]+/g, '').trim();
      // Replace dashes in mixed numbers (1-1/2 → 1 1/2) but not in other contexts
      s = s.replace(/(\d)-(\d)/g, '$1 $2');
      return s || null;
    }

    function normalizedDecimalToFraction(decStr) {
      if (!decStr) return null;
      // Check if it's a compound decimal (contains 'x')
      if (decStr.includes('x')) return null; // handled separately
      return DECIMAL_TO_FRACTION[decStr] || decStr;
    }

    // For pipe + standard fitting sizes, convert decimal size_normalized to fraction
    function singleSizeKey(row) {
      // Prefer converting from size_normalized (decimal) to fraction
      const fromDecimal = normalizedDecimalToFraction(row.size_normalized);
      if (fromDecimal) return fromDecimal;
      // Fallback: parse from raw size
      return sizeToFrontendKey(row.size);
    }

    // For reducing fittings: parse compound size → "main|reducing"
    function reducingKey(row) {
      const parsed = parseCompoundSize(row.size || '');
      if (!parsed) return null;
      const main = sizeToFrontendKey(parsed[0]);
      const reducing = sizeToFrontendKey(parsed[1]);
      if (!main || !reducing) return null;
      return `${main}|${reducing}`;
    }

    // For reducing tees: compound is "main x main x branch" → "main|branch"
    function reducingTeeKey(row) {
      const rawSize = String(row.size || '').replace(/[''""'\u2018\u2019\u201C\u201D]+/g, '').trim();
      const parts = rawSize.split(/\s*x\s*/);
      if (parts.length >= 3) {
        const main = sizeToFrontendKey(parts[0]);
        const branch = sizeToFrontendKey(parts[2]);
        if (main && branch) return `${main}|${branch}`;
      }
      // Fallback to 2-part compound
      const parsed = parseCompoundSize(row.size || '');
      if (parsed) {
        const main = sizeToFrontendKey(parsed[0]);
        const reducing = sizeToFrontendKey(parsed[1]);
        if (main && reducing) return `${main}|${reducing}`;
      }
      return null;
    }

    const pipeCosts = {};
    const fittingCosts = {};
    const reducingFittingCosts = {};
    const reducingTeeCosts = {};

    // Track seen keys to deduplicate (keep first per key)
    const seenPipeSizes = new Set();

    for (const row of result.rows) {
      const cost = parseFloat(row.cost);
      if (isNaN(cost) || cost <= 0) continue;

      if (row.unit_type === 'per_ft') {
        // Pipe cost by size — filter by pipe spec if configured
        if (!specMatches(row.spec, pipeSpecNum)) continue;
        const key = singleSizeKey(row);
        if (key && !seenPipeSizes.has(key)) {
          seenPipeSizes.add(key);
          pipeCosts[key] = cost;
        }
      } else {
        // Skip pipe products misclassified as "each"
        if (/\bPipe[-\s]/i.test(row.description || '')) continue;
        // Filter by fitting spec if configured
        if (!specMatches(row.spec, fittingSpecNum)) continue;

        const detected = detectFittingType(row);

        if (detected.kind === 'fitting') {
          const key = singleSizeKey(row);
          if (!fittingCosts[detected.type]) fittingCosts[detected.type] = {};
          if (key && !(key in fittingCosts[detected.type])) {
            fittingCosts[detected.type][key] = cost;
          }
        } else if (detected.kind === 'reducing') {
          const key = reducingKey(row);
          if (!reducingFittingCosts[detected.type]) reducingFittingCosts[detected.type] = {};
          if (key && !(key in reducingFittingCosts[detected.type])) {
            reducingFittingCosts[detected.type][key] = cost;
          }
        } else if (detected.kind === 'reducing_tee') {
          const key = reducingTeeKey(row);
          if (key && !(key in reducingTeeCosts)) {
            reducingTeeCosts[key] = cost;
          }
        }
        // 'unknown' items are skipped — same as the frontend import modal
      }
    }

    // Only return the map if at least one category has data
    const hasData = Object.keys(pipeCosts).length > 0
      || Object.keys(fittingCosts).length > 0
      || Object.keys(reducingFittingCosts).length > 0
      || Object.keys(reducingTeeCosts).length > 0;

    if (!hasData) return null;

    return { pipeCosts, fittingCosts, reducingFittingCosts, reducingTeeCosts };
  },

  /**
   * Get products suitable for populating pipe spec rates.
   * Filters by exact install_type and material values (from dropdown selections).
   * Splits into per-ft (pipe), per-each fittings, and per-each reducing items.
   * Groups fittings by description to avoid schedule-variant duplicates.
   */
  async getRatesForSpec(tenantId, filters = {}) {
    const { installType, material, group, manufacturer, product } = filters;

    let query = `SELECT product_id, product, description, size, size_normalized,
                        install_type, material, labor_time, labor_units, unit_type,
                        cost, cost_unit, group_name, spec
                 FROM est_products
                 WHERE tenant_id = $1 AND labor_time IS NOT NULL AND labor_time > 0`;
    const params = [tenantId];
    let paramIdx = 2;

    if (installType) {
      query += ` AND install_type = $${paramIdx}`;
      params.push(installType);
      paramIdx++;
    }

    if (material) {
      query += ` AND material = $${paramIdx}`;
      params.push(material);
      paramIdx++;
    }

    if (group) {
      query += ` AND group_name = $${paramIdx}`;
      params.push(group);
      paramIdx++;
    }

    if (manufacturer) {
      query += ` AND manufacturer = $${paramIdx}`;
      params.push(manufacturer);
      paramIdx++;
    }

    if (product) {
      query += ` AND product = $${paramIdx}`;
      params.push(product);
      paramIdx++;
    }

    query += ` ORDER BY unit_type, size_normalized, description`;

    const result = await db.query(query, params);

    // Split into pipe rates (per_ft) and fitting products (each)
    const pipeRates = [];
    const fittingProducts = [];
    const seenPipeSizes = new Set();
    const schedules = new Set();

    // Regex to extract schedule/weight from description (e.g. "CS Elbow 90 LR STD (BV)" → "STD")
    const schedulePattern = /\b(STD|XS|XXS|SCH\s*10|SCH\s*40|SCH\s*80|SCH\s*120|SCH\s*160)\b/i;

    for (const row of result.rows) {
      // Extract schedule from description
      const schedMatch = (row.description || '').match(schedulePattern);
      if (schedMatch) {
        schedules.add(schedMatch[1].toUpperCase().replace(/\s+/g, ''));
      }

      if (row.unit_type === 'per_ft') {
        // Deduplicate pipe rates by size — keep first (lowest labor_time)
        if (row.size_normalized && !seenPipeSizes.has(row.size_normalized)) {
          seenPipeSizes.add(row.size_normalized);
          pipeRates.push({
            size: row.size,
            size_normalized: row.size_normalized,
            labor_time: parseFloat(row.labor_time),
            product_id: row.product_id,
            product: row.product,
            description: row.description,
            cost: row.cost ? parseFloat(row.cost) : null,
          });
        }
      } else {
        // Skip pipe products misclassified as "each"
        if (/\bPipe[-\s]/i.test(row.description || '')) continue;

        fittingProducts.push({
          size: row.size,
          size_normalized: row.size_normalized,
          labor_time: parseFloat(row.labor_time),
          product_id: row.product_id,
          product: row.product,
          description: row.description,
          group_name: row.group_name,
          cost: row.cost ? parseFloat(row.cost) : null,
        });
      }
    }

    return {
      pipeRates,
      fittingProducts,
      schedules: Array.from(schedules).sort(),
      summary: {
        total: pipeRates.length + fittingProducts.length,
        perFt: pipeRates.length,
        perEach: fittingProducts.length,
      },
    };
  },
};

module.exports = EstProduct;
