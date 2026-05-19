const db = require('../config/database');

// Run a SQL query with a per-statement timeout so a slow plan can't tie
// up a connection forever. The timeout is set inside a transaction on a
// dedicated client (SET LOCAL is transaction-scoped), then released back
// to the pool.
async function runWithTimeout(sql, params, timeoutSec = 20) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = '${timeoutSec}s'`);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

// Build the project-filter WHERE clause and params array.
// Returns { whereSql, params, nextParamIndex } — params already includes tenantId at $1.
function buildProjectFilter(tenantId, filters = {}) {
  const params = [tenantId];
  const conds = ['p.tenant_id = $1'];
  let i = 2;

  if (filters.statuses && filters.statuses.length) {
    conds.push(`p.status = ANY($${i})`);
    params.push(filters.statuses);
    i++;
  }

  if (filters.excludedProjectIds && filters.excludedProjectIds.length) {
    conds.push(`p.id <> ALL($${i})`);
    params.push(filters.excludedProjectIds);
    i++;
  }

  if (filters.departments && filters.departments.length) {
    conds.push(`(d.department_number = ANY($${i}) OR vd.department_number = ANY($${i}))`);
    params.push(filters.departments);
    i++;
  }

  if (filters.markets && filters.markets.length) {
    conds.push(`(p.market = ANY($${i}) OR vc.primary_market = ANY($${i}))`);
    params.push(filters.markets);
    i++;
  }

  if (filters.managerIds && filters.managerIds.length) {
    conds.push(`p.manager_id = ANY($${i})`);
    params.push(filters.managerIds);
    i++;
  }

  // Project date overlap: project's [start, end] intersects [dateFrom, dateTo].
  // NULL endpoints are treated as open-ended (i.e., not excluded by the missing bound).
  if (filters.dateFrom) {
    conds.push(`(p.end_date IS NULL OR p.end_date >= $${i})`);
    params.push(filters.dateFrom);
    i++;
  }
  if (filters.dateTo) {
    conds.push(`(COALESCE(p.start_date, vc.start_month::date) IS NULL OR COALESCE(p.start_date, vc.start_month::date) <= $${i})`);
    params.push(filters.dateTo);
    i++;
  }

  if (filters.valueMin != null) {
    conds.push(`COALESCE(vc.contract_amount, p.contract_value) >= $${i}`);
    params.push(filters.valueMin);
    i++;
  }
  if (filters.valueMax != null) {
    conds.push(`COALESCE(vc.contract_amount, p.contract_value) <= $${i}`);
    params.push(filters.valueMax);
    i++;
  }

  return { whereSql: conds.join(' AND '), params, nextParamIndex: i };
}

// CTE that resolves the filtered set of projects — one row per project.
// contract_numbers is aggregated so we can match phase codes via either
// direct linked_project_id or the contract path.
function projectFilterCte(whereSql) {
  return `
    WITH filtered_projects AS (
      SELECT p.id, p.name, p.number, p.status, p.start_date, p.end_date,
             p.manager_id, p.market AS p_market, p.contract_value AS p_contract_value,
             d.department_number AS d_department_number, d.name AS d_department_name,
             MAX(vd.department_number) AS vd_department_number,
             MAX(vd.name) AS vd_department_name,
             MAX(vc.primary_market) AS vc_market,
             MAX(vc.contract_amount) AS vc_contract_amount,
             MAX(vc.actual_cost) AS actual_cost,
             MAX(vc.projected_cost) AS projected_cost,
             MAX(vc.projected_revenue) AS projected_revenue,
             COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT vc.contract_number), NULL), '{}'::text[]) AS contract_numbers
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      LEFT JOIN departments vd ON vc.linked_department_id = vd.id
      WHERE ${whereSql}
      GROUP BY p.id, p.name, p.number, p.status, p.start_date, p.end_date,
               p.manager_id, p.market, p.contract_value,
               d.department_number, d.name
    ),
    fp AS (
      SELECT id, name, number, status, start_date, end_date, manager_id,
             COALESCE(d_department_number, vd_department_number) AS department_number,
             COALESCE(d_department_name, vd_department_name) AS department_name,
             COALESCE(p_market, vc_market) AS market,
             COALESCE(vc_contract_amount, p_contract_value) AS contract_value,
             actual_cost, projected_cost, projected_revenue, contract_numbers
      FROM filtered_projects
    )`;
}

// Inline join clause that finds phase codes for a project via direct
// linked_project_id. The previous OR fallback to the contract path was
// expensive at scale (forced hash join, no index help). The
// linkPhaseCodesByContract() routine runs after every Vista import and
// backfills linked_project_id, so the fallback is no longer load-bearing.
// If a phase code row lacks a linked_project_id, fix it with that routine
// rather than re-introducing the OR here.
const PHASE_JOIN = `pc.tenant_id = $1 AND pc.linked_project_id = fp.id`;

const CostDatabase = {
  // Distinct values + range info to populate the filter UI.
  async getFilterOptions(tenantId) {
    const { rows: statusRows } = await db.query(
      `SELECT DISTINCT status FROM projects WHERE tenant_id = $1 AND status IS NOT NULL ORDER BY status`,
      [tenantId]
    );
    const { rows: deptRows } = await db.query(
      `SELECT DISTINCT department_number, name
       FROM (
         SELECT d.department_number, d.name
         FROM projects p JOIN departments d ON p.department_id = d.id
         WHERE p.tenant_id = $1
         UNION
         SELECT vd.department_number, vd.name
         FROM projects p
         JOIN vp_contracts vc ON vc.linked_project_id = p.id
         JOIN departments vd ON vc.linked_department_id = vd.id
         WHERE p.tenant_id = $1
       ) d
       WHERE department_number IS NOT NULL
       ORDER BY department_number`,
      [tenantId]
    );
    const { rows: marketRows } = await db.query(
      `SELECT DISTINCT market FROM (
         SELECT p.market FROM projects p WHERE p.tenant_id = $1 AND p.market IS NOT NULL
         UNION
         SELECT vc.primary_market FROM vp_contracts vc
         JOIN projects p ON vc.linked_project_id = p.id
         WHERE p.tenant_id = $1 AND vc.primary_market IS NOT NULL
       ) m
       WHERE market IS NOT NULL AND market != ''
       ORDER BY market`,
      [tenantId]
    );
    const { rows: managerRows } = await db.query(
      `SELECT DISTINCT p.manager_id, e.first_name || ' ' || e.last_name AS name
       FROM projects p
       JOIN employees e ON p.manager_id = e.id
       WHERE p.tenant_id = $1 AND p.manager_id IS NOT NULL
       ORDER BY name`,
      [tenantId]
    );
    const { rows: rangeRows } = await db.query(
      `SELECT
         MIN(COALESCE(vc.contract_amount, p.contract_value)) AS min_value,
         MAX(COALESCE(vc.contract_amount, p.contract_value)) AS max_value,
         MIN(p.start_date) AS min_start, MAX(p.start_date) AS max_start,
         MIN(p.end_date) AS min_end, MAX(p.end_date) AS max_end
       FROM projects p LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
       WHERE p.tenant_id = $1`,
      [tenantId]
    );

    return {
      statuses: statusRows.map(r => r.status),
      departments: deptRows.map(r => ({ number: r.department_number, name: r.name })),
      markets: marketRows.map(r => r.market),
      managers: managerRows.map(r => ({ id: r.manager_id, name: r.name })),
      valueRange: {
        min: rangeRows[0]?.min_value != null ? parseFloat(rangeRows[0].min_value) : null,
        max: rangeRows[0]?.max_value != null ? parseFloat(rangeRows[0].max_value) : null,
      },
      dateRange: {
        minStart: rangeRows[0]?.min_start || null,
        maxStart: rangeRows[0]?.max_start || null,
        minEnd: rangeRows[0]?.min_end || null,
        maxEnd: rangeRows[0]?.max_end || null,
      },
    };
  },

  // Headline totals across all phase codes for filtered projects.
  // contract_value_total comes from fp (one row per project) so it isn't
  // multiplied by the phase-code join cardinality. Phase-code sums live in
  // their own CTE so we only join once.
  async getSummary(tenantId, filters) {
    const { whereSql, params } = buildProjectFilter(tenantId, filters);
    const sql = `${projectFilterCte(whereSql)},
      phase_totals AS (
        SELECT
          COALESCE(SUM(pc.est_cost), 0)       AS est_cost,
          COALESCE(SUM(pc.jtd_cost), 0)       AS jtd_cost,
          COALESCE(SUM(pc.committed_cost), 0) AS committed_cost,
          COALESCE(SUM(pc.projected_cost), 0) AS projected_cost,
          COALESCE(SUM(pc.est_hours), 0)      AS est_hours,
          COALESCE(SUM(pc.jtd_hours), 0)      AS jtd_hours
        FROM fp
        JOIN vp_phase_codes pc ON ${PHASE_JOIN}
      )
      SELECT
        (SELECT COUNT(*) FROM fp) AS project_count,
        (SELECT COALESCE(SUM(contract_value), 0) FROM fp) AS contract_value_total,
        pt.est_cost, pt.jtd_cost, pt.committed_cost, pt.projected_cost,
        pt.est_hours, pt.jtd_hours
      FROM phase_totals pt`;
    const { rows } = await runWithTimeout(sql, params);
    const r = rows[0] || {};
    return {
      project_count: parseInt(r.project_count || 0, 10),
      est_cost: parseFloat(r.est_cost || 0),
      jtd_cost: parseFloat(r.jtd_cost || 0),
      committed_cost: parseFloat(r.committed_cost || 0),
      projected_cost: parseFloat(r.projected_cost || 0),
      est_hours: parseFloat(r.est_hours || 0),
      jtd_hours: parseFloat(r.jtd_hours || 0),
      contract_value_total: parseFloat(r.contract_value_total || 0),
    };
  },

  // Aggregate by cost_type across filtered projects.
  async getByCostType(tenantId, filters) {
    const { whereSql, params } = buildProjectFilter(tenantId, filters);
    const sql = `${projectFilterCte(whereSql)}
      SELECT pc.cost_type,
        COUNT(DISTINCT fp.id) AS project_count,
        COUNT(DISTINCT pc.phase) AS phase_count,
        COALESCE(SUM(pc.est_cost), 0) AS est_cost,
        COALESCE(SUM(pc.jtd_cost), 0) AS jtd_cost,
        COALESCE(SUM(pc.committed_cost), 0) AS committed_cost,
        COALESCE(SUM(pc.projected_cost), 0) AS projected_cost,
        COALESCE(SUM(pc.est_hours), 0) AS est_hours,
        COALESCE(SUM(pc.jtd_hours), 0) AS jtd_hours
      FROM fp
      JOIN vp_phase_codes pc ON ${PHASE_JOIN}
      GROUP BY pc.cost_type
      ORDER BY pc.cost_type`;
    const { rows } = await runWithTimeout(sql, params);
    return rows.map(r => ({
      cost_type: parseInt(r.cost_type, 10),
      project_count: parseInt(r.project_count, 10),
      phase_count: parseInt(r.phase_count, 10),
      est_cost: parseFloat(r.est_cost),
      jtd_cost: parseFloat(r.jtd_cost),
      committed_cost: parseFloat(r.committed_cost),
      projected_cost: parseFloat(r.projected_cost),
      est_hours: parseFloat(r.est_hours),
      jtd_hours: parseFloat(r.jtd_hours),
    }));
  },

  // Aggregate by (phase, cost_type) across filtered projects.
  async getByPhase(tenantId, filters) {
    const { whereSql, params, nextParamIndex } = buildProjectFilter(tenantId, filters);
    let i = nextParamIndex;
    const extraConds = [];
    if (filters.costType) {
      extraConds.push(`pc.cost_type = $${i}`);
      params.push(filters.costType);
      i++;
    }
    if (filters.phasePrefix) {
      extraConds.push(`pc.phase LIKE $${i}`);
      params.push(`${filters.phasePrefix}%`);
      i++;
    }
    const extra = extraConds.length ? ` AND ${extraConds.join(' AND ')}` : '';

    const sql = `${projectFilterCte(whereSql)}
      SELECT pc.phase, pc.cost_type,
        MAX(pc.phase_description) AS phase_description,
        COUNT(DISTINCT fp.id) AS project_count,
        COALESCE(SUM(pc.est_cost), 0) AS est_cost,
        COALESCE(SUM(pc.jtd_cost), 0) AS jtd_cost,
        COALESCE(SUM(pc.committed_cost), 0) AS committed_cost,
        COALESCE(SUM(pc.projected_cost), 0) AS projected_cost,
        COALESCE(SUM(pc.est_hours), 0) AS est_hours,
        COALESCE(SUM(pc.jtd_hours), 0) AS jtd_hours,
        AVG(pc.percent_complete) AS avg_percent_complete
      FROM fp
      JOIN vp_phase_codes pc ON ${PHASE_JOIN}
      WHERE 1=1${extra}
      GROUP BY pc.phase, pc.cost_type
      ORDER BY pc.phase, pc.cost_type`;
    const { rows } = await runWithTimeout(sql, params);
    return rows.map(r => ({
      phase: r.phase,
      cost_type: parseInt(r.cost_type, 10),
      phase_description: r.phase_description,
      project_count: parseInt(r.project_count, 10),
      est_cost: parseFloat(r.est_cost),
      jtd_cost: parseFloat(r.jtd_cost),
      committed_cost: parseFloat(r.committed_cost),
      projected_cost: parseFloat(r.projected_cost),
      est_hours: parseFloat(r.est_hours),
      jtd_hours: parseFloat(r.jtd_hours),
      avg_percent_complete: r.avg_percent_complete != null ? parseFloat(r.avg_percent_complete) : null,
    }));
  },

  // Per-project contributions for a single (phase, cost_type) combination.
  async getPhaseProjects(tenantId, filters, phase, costType) {
    const { whereSql, params, nextParamIndex } = buildProjectFilter(tenantId, filters);
    let i = nextParamIndex;
    params.push(phase);
    const phaseParam = i; i++;
    let ctClause = '';
    if (costType != null) {
      params.push(costType);
      ctClause = ` AND pc.cost_type = $${i}`;
      i++;
    }

    const sql = `${projectFilterCte(whereSql)}
      SELECT fp.id AS project_id, fp.number, fp.name, fp.status,
             fp.department_number, fp.department_name, fp.market,
             fp.contract_value, fp.start_date, fp.end_date,
             pc.cost_type,
             pc.est_cost, pc.jtd_cost, pc.committed_cost, pc.projected_cost,
             pc.est_hours, pc.jtd_hours, pc.percent_complete
      FROM fp
      JOIN vp_phase_codes pc ON ${PHASE_JOIN}
      WHERE pc.phase = $${phaseParam}${ctClause}
      ORDER BY fp.number`;
    const { rows } = await runWithTimeout(sql, params);
    return rows.map(r => ({
      project_id: r.project_id,
      number: r.number,
      name: r.name,
      status: r.status,
      department_number: r.department_number,
      department_name: r.department_name,
      market: r.market,
      contract_value: r.contract_value != null ? parseFloat(r.contract_value) : null,
      start_date: r.start_date,
      end_date: r.end_date,
      cost_type: parseInt(r.cost_type, 10),
      est_cost: parseFloat(r.est_cost),
      jtd_cost: parseFloat(r.jtd_cost),
      committed_cost: parseFloat(r.committed_cost),
      projected_cost: parseFloat(r.projected_cost),
      est_hours: parseFloat(r.est_hours),
      jtd_hours: parseFloat(r.jtd_hours),
      percent_complete: r.percent_complete != null ? parseFloat(r.percent_complete) : null,
    }));
  },

  // List of projects matching filters (for the "Source Projects" tab).
  async getProjects(tenantId, filters) {
    const { whereSql, params } = buildProjectFilter(tenantId, filters);
    const sql = `${projectFilterCte(whereSql)}
      SELECT fp.id, fp.number, fp.name, fp.status,
             fp.department_number, fp.department_name, fp.market,
             fp.contract_value, fp.start_date, fp.end_date,
             fp.actual_cost, fp.projected_cost,
             COALESCE(pc_sum.jtd_cost, 0) AS phase_jtd_cost,
             COALESCE(pc_sum.est_cost, 0) AS phase_est_cost
      FROM fp
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pc.jtd_cost), 0) AS jtd_cost,
               COALESCE(SUM(pc.est_cost), 0) AS est_cost
        FROM vp_phase_codes pc
        WHERE ${PHASE_JOIN}
      ) pc_sum ON true
      ORDER BY fp.number`;
    const { rows } = await runWithTimeout(sql, params);
    return rows.map(r => ({
      id: r.id,
      number: r.number,
      name: r.name,
      status: r.status,
      department_number: r.department_number,
      department_name: r.department_name,
      market: r.market,
      contract_value: r.contract_value != null ? parseFloat(r.contract_value) : null,
      start_date: r.start_date,
      end_date: r.end_date,
      actual_cost: r.actual_cost != null ? parseFloat(r.actual_cost) : null,
      projected_cost: r.projected_cost != null ? parseFloat(r.projected_cost) : null,
      phase_jtd_cost: parseFloat(r.phase_jtd_cost),
      phase_est_cost: parseFloat(r.phase_est_cost),
    }));
  },
};

module.exports = CostDatabase;
