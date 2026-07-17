const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

const GROUP_BY_COLS = {
  market: 'vc.primary_market',
  department: 'vc.department_code',
  pm: 'vc.project_manager_name',
  customer: 'vc.customer_name',
};

function parseCsv(val) {
  return val ? String(val).split(',').map(s => s.trim()).filter(Boolean) : [];
}

// GET /api/reports/historical-revenue/filters
router.get('/filters', async (req, res) => {
  try {
    const tid = req.tenantId;
    const [yearsRes, marketsRes, deptsRes, pmsRes, customersRes, teamsRes] = await Promise.all([
      db.query(
        `SELECT DISTINCT EXTRACT(YEAR FROM start_month)::integer AS year
         FROM vp_contracts WHERE tenant_id = $1 AND start_month IS NOT NULL
         ORDER BY year`,
        [tid]
      ),
      db.query(
        `SELECT DISTINCT primary_market FROM vp_contracts
         WHERE tenant_id = $1 AND primary_market IS NOT NULL AND primary_market != ''
         ORDER BY primary_market`,
        [tid]
      ),
      db.query(
        `SELECT DISTINCT department_code FROM vp_contracts
         WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != ''
         ORDER BY department_code`,
        [tid]
      ),
      db.query(
        `SELECT DISTINCT project_manager_name FROM vp_contracts
         WHERE tenant_id = $1 AND project_manager_name IS NOT NULL AND project_manager_name != ''
         ORDER BY project_manager_name`,
        [tid]
      ),
      db.query(
        `SELECT DISTINCT customer_name FROM vp_contracts
         WHERE tenant_id = $1 AND customer_name IS NOT NULL AND customer_name != ''
         ORDER BY customer_name
         LIMIT 300`,
        [tid]
      ),
      db.query(
        `SELECT id, name, color FROM teams WHERE tenant_id = $1 AND is_active = true ORDER BY name`,
        [tid]
      ),
    ]);
    res.json({
      years: yearsRes.rows.map(r => r.year),
      markets: marketsRes.rows.map(r => r.primary_market),
      departments: deptsRes.rows.map(r => r.department_code),
      pms: pmsRes.rows.map(r => r.project_manager_name),
      customers: customersRes.rows.map(r => r.customer_name),
      teams: teamsRes.rows,
    });
  } catch (err) {
    console.error('Error fetching historical-revenue filters:', err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

// GET /api/reports/historical-revenue
router.get('/', async (req, res) => {
  try {
    const tid = req.tenantId;
    const groupBy = GROUP_BY_COLS[req.query.groupBy] ? req.query.groupBy : 'market';
    const groupByCol = GROUP_BY_COLS[groupBy];

    const markets = parseCsv(req.query.markets);
    const departments = parseCsv(req.query.departments);
    const pms = parseCsv(req.query.pms);
    const customers = parseCsv(req.query.customers);
    const teams = parseCsv(req.query.teams).map(Number).filter(n => !isNaN(n));

    const currentYear = new Date().getFullYear();
    const startYear = Math.max(2000, parseInt(req.query.startYear) || currentYear - 5);
    const endYear = Math.min(currentYear + 1, parseInt(req.query.endYear) || currentYear);

    const params = [tid, startYear, endYear];
    const where = [
      `vc.tenant_id = $1`,
      `vc.start_month IS NOT NULL`,
      `EXTRACT(YEAR FROM vc.start_month) BETWEEN $2 AND $3`,
    ];

    if (markets.length) {
      params.push(markets);
      where.push(`vc.primary_market = ANY($${params.length})`);
    }
    if (departments.length) {
      params.push(departments);
      where.push(`vc.department_code = ANY($${params.length})`);
    }
    if (pms.length) {
      params.push(pms);
      where.push(`vc.project_manager_name = ANY($${params.length})`);
    }
    if (customers.length) {
      params.push(customers);
      where.push(`vc.customer_name = ANY($${params.length})`);
    }

    let teamJoin = '';
    if (teams.length) {
      params.push(teams);
      teamJoin = `
        JOIN vp_employees ve
          ON ve.employee_number = NULLIF(vc.employee_number, '')::integer
          AND ve.linked_employee_id IS NOT NULL
        JOIN team_members tm
          ON tm.employee_id = ve.linked_employee_id
          AND tm.team_id = ANY($${params.length}::int[])
      `;
    }

    const sql = `
      SELECT
        EXTRACT(YEAR FROM vc.start_month)::integer AS year,
        COALESCE(${groupByCol}, '(Unassigned)') AS group_value,
        SUM(COALESCE(vc.contract_amount, 0))::numeric AS contract_amount,
        SUM(COALESCE(vc.earned_revenue, 0))::numeric AS earned_revenue,
        SUM(COALESCE(vc.billed_amount, 0))::numeric AS billed_amount,
        COUNT(*)::integer AS contract_count
      FROM vp_contracts vc
      ${teamJoin}
      WHERE ${where.join(' AND ')}
      GROUP BY year, group_value
      ORDER BY year, group_value
    `;

    const result = await db.query(sql, params);

    const years = [...new Set(result.rows.map(r => r.year))].sort((a, b) => a - b);
    const groups = [...new Set(result.rows.map(r => r.group_value))].sort();

    const totalsByYear = {};
    for (const year of years) {
      totalsByYear[year] = result.rows
        .filter(r => r.year === year)
        .reduce((s, r) => s + parseFloat(r.contract_amount || 0), 0);
    }

    const grandTotal = Object.values(totalsByYear).reduce((s, v) => s + v, 0);
    const totalContracts = result.rows.reduce((s, r) => s + r.contract_count, 0);

    res.json({
      generated_at: new Date().toISOString(),
      groupBy,
      years,
      groups,
      data: result.rows.map(r => ({
        year: r.year,
        group_value: r.group_value,
        contract_amount: parseFloat(r.contract_amount || 0),
        earned_revenue: parseFloat(r.earned_revenue || 0),
        billed_amount: parseFloat(r.billed_amount || 0),
        contract_count: r.contract_count,
      })),
      totals_by_year: totalsByYear,
      grand_total: grandTotal,
      total_contracts: totalContracts,
    });
  } catch (err) {
    console.error('Error building historical-revenue report:', err);
    res.status(500).json({ error: 'Failed to build historical revenue report' });
  }
});

module.exports = router;
