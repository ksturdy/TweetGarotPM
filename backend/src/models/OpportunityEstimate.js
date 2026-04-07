const db = require('../config/database');

const PERCENTAGE_FIELDS = [
  'labor_pct', 'material_pct', 'subcontracts_pct', 'rentals_pct', 'mep_equip_pct', 'general_conditions_pct',
  'pf_labor_pct', 'sm_labor_pct', 'pl_labor_pct',
  'pf_shop_pct', 'pf_field_pct', 'sm_shop_pct', 'sm_field_pct', 'pl_shop_pct', 'pl_field_pct'
];

const RATE_FIELDS = ['pf_labor_rate', 'sm_labor_rate', 'pl_labor_rate'];

const ALL_FIELDS = [...PERCENTAGE_FIELDS, ...RATE_FIELDS];

// Hardcoded fallback defaults if no historical data exists
const FALLBACK_DEFAULTS = {
  labor_pct: 0.35,
  material_pct: 0.25,
  subcontracts_pct: 0.20,
  rentals_pct: 0.05,
  mep_equip_pct: 0.05,
  general_conditions_pct: 0.10,
  pf_labor_pct: 0.45,
  sm_labor_pct: 0.35,
  pl_labor_pct: 0.20,
  pf_shop_pct: 0.30,
  pf_field_pct: 0.70,
  sm_shop_pct: 0.35,
  sm_field_pct: 0.65,
  pl_shop_pct: 0.25,
  pl_field_pct: 0.75,
  pf_labor_rate: 85.00,
  sm_labor_rate: 82.00,
  pl_labor_rate: 78.00
};

const OpportunityEstimate = {
  async findByOpportunityId(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT * FROM opportunity_estimates
       WHERE opportunity_id = $1 AND tenant_id = $2`,
      [opportunityId, tenantId]
    );
    return result.rows[0] || null;
  },

  async upsert(opportunityId, tenantId, data, userId) {
    const fields = {};
    for (const key of ALL_FIELDS) {
      if (data[key] !== undefined) {
        fields[key] = parseFloat(data[key]) || 0;
      }
    }

    const result = await db.query(
      `INSERT INTO opportunity_estimates (
        opportunity_id, tenant_id, created_by,
        labor_pct, material_pct, subcontracts_pct, rentals_pct, mep_equip_pct, general_conditions_pct,
        pf_labor_pct, sm_labor_pct, pl_labor_pct,
        pf_shop_pct, pf_field_pct, sm_shop_pct, sm_field_pct, pl_shop_pct, pl_field_pct,
        pf_labor_rate, sm_labor_rate, pl_labor_rate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (opportunity_id) DO UPDATE SET
        labor_pct = EXCLUDED.labor_pct,
        material_pct = EXCLUDED.material_pct,
        subcontracts_pct = EXCLUDED.subcontracts_pct,
        rentals_pct = EXCLUDED.rentals_pct,
        mep_equip_pct = EXCLUDED.mep_equip_pct,
        general_conditions_pct = EXCLUDED.general_conditions_pct,
        pf_labor_pct = EXCLUDED.pf_labor_pct,
        sm_labor_pct = EXCLUDED.sm_labor_pct,
        pl_labor_pct = EXCLUDED.pl_labor_pct,
        pf_shop_pct = EXCLUDED.pf_shop_pct,
        pf_field_pct = EXCLUDED.pf_field_pct,
        sm_shop_pct = EXCLUDED.sm_shop_pct,
        sm_field_pct = EXCLUDED.sm_field_pct,
        pl_shop_pct = EXCLUDED.pl_shop_pct,
        pl_field_pct = EXCLUDED.pl_field_pct,
        pf_labor_rate = EXCLUDED.pf_labor_rate,
        sm_labor_rate = EXCLUDED.sm_labor_rate,
        pl_labor_rate = EXCLUDED.pl_labor_rate,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        opportunityId, tenantId, userId,
        fields.labor_pct || 0, fields.material_pct || 0, fields.subcontracts_pct || 0,
        fields.rentals_pct || 0, fields.mep_equip_pct || 0, fields.general_conditions_pct || 0,
        fields.pf_labor_pct || 0, fields.sm_labor_pct || 0, fields.pl_labor_pct || 0,
        fields.pf_shop_pct || 0, fields.pf_field_pct || 0,
        fields.sm_shop_pct || 0, fields.sm_field_pct || 0,
        fields.pl_shop_pct || 0, fields.pl_field_pct || 0,
        fields.pf_labor_rate || 0, fields.sm_labor_rate || 0, fields.pl_labor_rate || 0
      ]
    );
    return result.rows[0];
  },

  async delete(opportunityId, tenantId) {
    const result = await db.query(
      `DELETE FROM opportunity_estimates
       WHERE opportunity_id = $1 AND tenant_id = $2
       RETURNING id`,
      [opportunityId, tenantId]
    );
    return result.rowCount > 0;
  },

  /**
   * Compute default percentages from historical VP data.
   * @param {number} tenantId
   * @param {object} options
   * @param {string[]} options.trades - Active trades, e.g. ['pf','sm'] or ['pf','sm','pl']
   *   When provided, filters historical contracts to those matching the trade mix
   *   and uses weighted averages so larger projects count proportionally.
   */
  async getDefaultPercentages(tenantId, { trades } = {}) {
    const defaults = { ...FALLBACK_DEFAULTS };
    const activeTrades = trades || ['pf', 'sm', 'pl'];
    const hasPf = activeTrades.includes('pf');
    const hasSm = activeTrades.includes('sm');
    const hasPl = activeTrades.includes('pl');

    // Build a WHERE filter to select contracts matching the active trade mix.
    // A trade is "present" if it has >100 projected hours; "absent" if <=100 or null.
    const tradeFilters = [];
    const params = [tenantId];

    if (hasPf) tradeFilters.push('COALESCE(pf_hours_projected, 0) > 100');
    else tradeFilters.push('COALESCE(pf_hours_projected, 0) <= 100');

    if (hasSm) tradeFilters.push('COALESCE(sm_hours_projected, 0) > 100');
    else tradeFilters.push('COALESCE(sm_hours_projected, 0) <= 100');

    if (hasPl) tradeFilters.push('COALESCE(pl_hours_projected, 0) > 100');
    else tradeFilters.push('COALESCE(pl_hours_projected, 0) <= 100');

    const tradeWhere = tradeFilters.length > 0 ? ' AND ' + tradeFilters.join(' AND ') : '';

    // 1. Cost category percentages — WEIGHTED averages (sum / sum)
    //    This ensures large commercial projects count proportionally instead of
    //    being swamped by thousands of small jobs.
    const costResult = await db.query(
      `SELECT
        COALESCE(SUM(ttl_labor_projected), 0) AS sum_labor,
        COALESCE(SUM(material_projected), 0) AS sum_material,
        COALESCE(SUM(subcontracts_projected), 0) AS sum_sub,
        COALESCE(SUM(rentals_projected), 0) AS sum_rental,
        COALESCE(SUM(mep_equip_projected), 0) AS sum_mep,
        COALESCE(SUM(projected_cost), 0) AS sum_total
      FROM vp_contracts
      WHERE tenant_id = $1
        AND projected_cost > 0${tradeWhere}`,
      params
    );

    const c = costResult.rows[0];
    const total = parseFloat(c.sum_total) || 0;

    if (total > 0) {
      defaults.labor_pct = parseFloat(c.sum_labor) / total;
      defaults.material_pct = parseFloat(c.sum_material) / total;
      defaults.subcontracts_pct = parseFloat(c.sum_sub) / total;
      defaults.rentals_pct = parseFloat(c.sum_rental) / total;
      defaults.mep_equip_pct = parseFloat(c.sum_mep) / total;
      // General conditions = remainder
      const knownSum = defaults.labor_pct + defaults.material_pct + defaults.subcontracts_pct
        + defaults.rentals_pct + defaults.mep_equip_pct;
      defaults.general_conditions_pct = Math.max(0, 1 - knownSum);
    }

    // 2. Trade split within labor — weighted by hours
    const tradeResult = await db.query(
      `SELECT
        COALESCE(SUM(pf_hours_projected), 0) AS sum_pf,
        COALESCE(SUM(sm_hours_projected), 0) AS sum_sm,
        COALESCE(SUM(pl_hours_projected), 0) AS sum_pl
      FROM vp_contracts
      WHERE tenant_id = $1
        AND total_hours_projected > 0${tradeWhere}`,
      params
    );

    const t = tradeResult.rows[0];
    const totalHrs = parseFloat(t.sum_pf) + parseFloat(t.sum_sm) + parseFloat(t.sum_pl);
    if (totalHrs > 0) {
      defaults.pf_labor_pct = hasPf ? parseFloat(t.sum_pf) / totalHrs : 0;
      defaults.sm_labor_pct = hasSm ? parseFloat(t.sum_sm) / totalHrs : 0;
      defaults.pl_labor_pct = hasPl ? parseFloat(t.sum_pl) / totalHrs : 0;

      // Renormalize active trades to sum to 1.0
      const activeSum = defaults.pf_labor_pct + defaults.sm_labor_pct + defaults.pl_labor_pct;
      if (activeSum > 0) {
        defaults.pf_labor_pct /= activeSum;
        defaults.sm_labor_pct /= activeSum;
        defaults.pl_labor_pct /= activeSum;
      }
    }

    // Zero out disabled trades
    if (!hasPf) defaults.pf_labor_pct = 0;
    if (!hasSm) defaults.sm_labor_pct = 0;
    if (!hasPl) defaults.pl_labor_pct = 0;

    // 3. Shop/Field split per trade from phase codes
    const shopFieldResult = await db.query(
      `SELECT trade, location, SUM(hours) AS total_hours FROM (
        SELECT
          CASE
            WHEN phase LIKE '40-%' OR phase LIKE '45-%' THEN 'pf'
            WHEN phase LIKE '30-%' OR phase LIKE '35-%' THEN 'sm'
            WHEN phase LIKE '50-%' OR phase LIKE '55-%' THEN 'pl'
          END AS trade,
          CASE
            WHEN phase LIKE '30-%' OR phase LIKE '40-%' OR phase LIKE '50-%' THEN 'field'
            WHEN phase LIKE '35-%' OR phase LIKE '45-%' OR phase LIKE '55-%' THEN 'shop'
          END AS location,
          COALESCE(est_hours, 0) AS hours
        FROM vp_phase_codes
        WHERE tenant_id = $1
          AND cost_type = 1
          AND (phase LIKE '30-%' OR phase LIKE '35-%'
            OR phase LIKE '40-%' OR phase LIKE '45-%'
            OR phase LIKE '50-%' OR phase LIKE '55-%')
      ) sub
      WHERE trade IS NOT NULL AND location IS NOT NULL
      GROUP BY trade, location`,
      [tenantId]
    );

    const tradeTotals = {};
    for (const row of shopFieldResult.rows) {
      if (!tradeTotals[row.trade]) tradeTotals[row.trade] = { shop: 0, field: 0 };
      tradeTotals[row.trade][row.location] = parseFloat(row.total_hours) || 0;
    }

    for (const trade of ['pf', 'sm', 'pl']) {
      if (tradeTotals[trade]) {
        const tradeTotal = tradeTotals[trade].shop + tradeTotals[trade].field;
        if (tradeTotal > 0) {
          defaults[`${trade}_shop_pct`] = tradeTotals[trade].shop / tradeTotal;
          defaults[`${trade}_field_pct`] = tradeTotals[trade].field / tradeTotal;
        }
      }
    }

    // 4. Labor rates per trade from phase codes (weighted: total cost / total hours)
    const rateResult = await db.query(
      `SELECT trade, SUM(cost) AS total_cost, SUM(hours) AS total_hours FROM (
        SELECT
          CASE
            WHEN phase LIKE '40-%' OR phase LIKE '45-%' THEN 'pf'
            WHEN phase LIKE '30-%' OR phase LIKE '35-%' THEN 'sm'
            WHEN phase LIKE '50-%' OR phase LIKE '55-%' THEN 'pl'
          END AS trade,
          COALESCE(est_cost, 0) AS cost,
          COALESCE(est_hours, 0) AS hours
        FROM vp_phase_codes
        WHERE tenant_id = $1
          AND cost_type = 1
          AND (phase LIKE '30-%' OR phase LIKE '35-%'
            OR phase LIKE '40-%' OR phase LIKE '45-%'
            OR phase LIKE '50-%' OR phase LIKE '55-%')
      ) sub
      WHERE trade IS NOT NULL
      GROUP BY trade
      HAVING SUM(hours) > 0`,
      [tenantId]
    );

    for (const row of rateResult.rows) {
      const rate = parseFloat(row.total_cost) / parseFloat(row.total_hours);
      if (rate > 0 && isFinite(rate)) {
        defaults[`${row.trade}_labor_rate`] = Math.round(rate * 100) / 100;
      }
    }

    // Round all percentages to 4 decimal places
    for (const key of PERCENTAGE_FIELDS) {
      defaults[key] = Math.round(defaults[key] * 10000) / 10000;
    }

    return defaults;
  }
};

module.exports = OpportunityEstimate;
