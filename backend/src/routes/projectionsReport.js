const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { generateProjectionsReportPdfBuffer } = require('../utils/projectionsReportPdfBuffer');

router.use(authenticate);
router.use(tenantContext);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const delta = (a, b) => num(a) - num(b);

const pct = (n, d) => (d > 0 ? n / d : 0);

const SNAPSHOT_COLUMNS = `
  id, project_id, snapshot_date,
  orig_contract_amount, contract_amount, approved_changes, pending_change_orders, change_order_count,
  projected_revenue, earned_revenue, backlog, percent_complete,
  gross_profit_dollars, gross_profit_percent, original_estimated_margin, original_estimated_margin_pct,
  billed_amount, received_amount, open_receivables, cash_flow,
  actual_cost, projected_cost, current_est_cost,
  actual_labor_rate, estimated_labor_rate, current_est_labor_cost, ttl_labor_projected,
  total_hours_estimate, total_hours_jtd, total_hours_projected,
  pm_name, pm_employee_no, department_code, department_name
`;

/**
 * Build the projections report for the requested filters.
 * Each project section compares its latest two snapshots within the date range
 * (or its latest two snapshots overall if no range is given).
 */
async function buildProjectionsReport({
  tenantId,
  pmEmployeeNos = null,     // string[] of pm_employee_no
  departmentCodes = null,   // string[] of department_code
  teamIds = null,           // number[] of team ids
  startDate = null,
  endDate = null,
}) {
  // Resolve team filter into a set of project_ids (project belongs to a team
  // if its manager is a member of that team).
  let teamProjectIds = null;
  if (teamIds && teamIds.length > 0) {
    const teamRes = await db.query(
      `SELECT DISTINCT p.id
       FROM projects p
       JOIN team_members tm ON tm.employee_id = p.manager_id
       WHERE p.tenant_id = $1 AND tm.team_id = ANY($2::int[])`,
      [tenantId, teamIds]
    );
    teamProjectIds = teamRes.rows.map(r => r.id);
    if (teamProjectIds.length === 0) {
      return {
        generated_at: new Date().toISOString(),
        projects: [],
        rollup_by_pm: [],
        rollup_by_department: [],
      };
    }
  }

  const params = [tenantId];
  const where = ['tenant_id = $1'];

  if (startDate) {
    params.push(startDate);
    where.push(`snapshot_date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    where.push(`snapshot_date <= $${params.length}`);
  }
  if (pmEmployeeNos && pmEmployeeNos.length > 0) {
    params.push(pmEmployeeNos);
    where.push(`pm_employee_no = ANY($${params.length}::text[])`);
  }
  if (departmentCodes && departmentCodes.length > 0) {
    params.push(departmentCodes);
    where.push(`department_code = ANY($${params.length}::text[])`);
  }
  if (teamProjectIds) {
    params.push(teamProjectIds);
    where.push(`project_id = ANY($${params.length}::int[])`);
  }

  // Pull all snapshots matching the filters, newest first per project.
  const snapshotsRes = await db.query(
    `SELECT ${SNAPSHOT_COLUMNS}
     FROM project_snapshots
     WHERE ${where.join(' AND ')}
     ORDER BY project_id, snapshot_date DESC`,
    params
  );

  // Group by project; keep top 2 (current + prior).
  const byProject = new Map();
  for (const s of snapshotsRes.rows) {
    if (!byProject.has(s.project_id)) byProject.set(s.project_id, []);
    const arr = byProject.get(s.project_id);
    if (arr.length < 2) arr.push(s);
  }

  const projectIds = Array.from(byProject.keys());
  if (projectIds.length === 0) {
    return {
      generated_at: new Date().toISOString(),
      projects: [],
      rollup_by_pm: [],
      rollup_by_department: [],
    };
  }

  // Pull project metadata in one round trip.
  const projectsRes = await db.query(
    `SELECT id, number, name FROM projects
     WHERE tenant_id = $1 AND id = ANY($2::int[])`,
    [tenantId, projectIds]
  );
  const projectMeta = new Map(projectsRes.rows.map(p => [p.id, p]));

  // Pull notes for these projects, attached to the current snapshots,
  // plus any open carry-forward tasks.
  const currentSnapshotIds = Array.from(byProject.values())
    .map(arr => arr[0]?.id)
    .filter(Boolean);

  // Pull notes for these projects. Include:
  //   1. Notes attached to the current snapshot of each project (this cycle).
  //   2. Notes with snapshot_id IS NULL (drafted since the last capture; they
  //      will be attached on the next Capture Snapshot).
  //   3. Open tasks (assigned or due-dated) from any prior cycle, so the
  //      report carries forward unfinished homework.
  const notesRes = await db.query(
    `SELECT pn.*,
            u.first_name || ' ' || u.last_name AS created_by_name,
            a.first_name || ' ' || a.last_name AS assigned_to_name,
            ps.snapshot_date AS snapshot_date
     FROM projection_notes pn
     JOIN users u ON pn.created_by = u.id
     LEFT JOIN users a ON pn.assigned_to = a.id
     LEFT JOIN project_snapshots ps ON pn.snapshot_id = ps.id
     WHERE pn.tenant_id = $1
       AND pn.project_id = ANY($2::int[])
       AND (
            pn.snapshot_id IS NULL
            OR pn.snapshot_id = ANY($3::int[])
            OR (pn.status = 'open' AND (pn.assigned_to IS NOT NULL OR pn.due_date IS NOT NULL))
       )
     ORDER BY pn.created_at DESC`,
    [tenantId, projectIds, currentSnapshotIds.length > 0 ? currentSnapshotIds : [0]]
  );

  const notesByProject = new Map();
  for (const n of notesRes.rows) {
    if (!notesByProject.has(n.project_id)) notesByProject.set(n.project_id, []);
    notesByProject.get(n.project_id).push(n);
  }

  // Build per-project sections.
  const projects = [];
  for (const [projectId, snaps] of byProject.entries()) {
    const current = snaps[0];
    const prior = snaps[1] || null;
    const meta = projectMeta.get(projectId) || {};
    const notes = notesByProject.get(projectId) || [];

    const projNotes = notes.filter(n => n.type === 'note' && (n.assigned_to == null && n.due_date == null));
    const tasks = notes.filter(n => n.type === 'note' && (n.assigned_to != null || n.due_date != null));
    const gainFade = notes.filter(n => n.type === 'gain_fade');

    let gfGain = 0, gfFade = 0, gfRecognized = 0, gfUnrecognized = 0;
    for (const g of gainFade) {
      const v = num(g.amount);
      if (v > 0) gfGain += v; else gfFade += v;
      if (g.recognized_in_financials) gfRecognized += v; else gfUnrecognized += v;
    }

    const deltas = prior ? {
      orig_contract_amount: delta(current.orig_contract_amount, prior.orig_contract_amount),
      contract_amount: delta(current.contract_amount, prior.contract_amount),
      approved_changes: delta(current.approved_changes, prior.approved_changes),
      pending_change_orders: delta(current.pending_change_orders, prior.pending_change_orders),
      projected_revenue: delta(current.projected_revenue, prior.projected_revenue),
      earned_revenue: delta(current.earned_revenue, prior.earned_revenue),
      backlog: delta(current.backlog, prior.backlog),
      percent_complete: delta(current.percent_complete, prior.percent_complete),
      gross_profit_dollars: delta(current.gross_profit_dollars, prior.gross_profit_dollars),
      gross_profit_percent: delta(current.gross_profit_percent, prior.gross_profit_percent),
      billed_amount: delta(current.billed_amount, prior.billed_amount),
      received_amount: delta(current.received_amount, prior.received_amount),
      open_receivables: delta(current.open_receivables, prior.open_receivables),
      cash_flow: delta(current.cash_flow, prior.cash_flow),
      projected_cost: delta(current.projected_cost, prior.projected_cost),
      current_est_cost: delta(current.current_est_cost, prior.current_est_cost),
      actual_cost: delta(current.actual_cost, prior.actual_cost),
      total_hours_jtd: delta(current.total_hours_jtd, prior.total_hours_jtd),
      total_hours_projected: delta(current.total_hours_projected, prior.total_hours_projected),
      actual_labor_rate: delta(current.actual_labor_rate, prior.actual_labor_rate),
    } : null;

    projects.push({
      project_id: projectId,
      project_number: meta.number,
      project_name: meta.name,
      pm_name: current.pm_name,
      pm_employee_no: current.pm_employee_no,
      department_code: current.department_code,
      department_name: current.department_name,
      current_snapshot: current,
      prior_snapshot: prior,
      deltas,
      notes: projNotes,
      tasks,
      open_tasks: tasks.filter(t => t.status === 'open').length,
      gain_fade: {
        items: gainFade,
        totals: {
          gain: gfGain,
          fade: gfFade,
          net: gfGain + gfFade,
          recognized: gfRecognized,
          unrecognized: gfUnrecognized,
        },
      },
    });
  }

  // Sort projects by PM then by project number for stable display.
  projects.sort((a, b) => {
    const pmCmp = String(a.pm_name || '').localeCompare(String(b.pm_name || ''));
    if (pmCmp !== 0) return pmCmp;
    return String(a.project_number || '').localeCompare(String(b.project_number || ''));
  });

  // Roll-ups by PM and Department.
  const rollupByPM = aggregateBy(projects, 'pm_name', 'pm_employee_no');
  const rollupByDepartment = aggregateBy(projects, 'department_name', 'department_code');

  return {
    generated_at: new Date().toISOString(),
    projects,
    rollup_by_pm: rollupByPM,
    rollup_by_department: rollupByDepartment,
  };
}

function aggregateBy(projects, nameField, codeField) {
  const map = new Map();
  for (const p of projects) {
    const key = p[codeField] || p[nameField] || 'Unknown';
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: p[nameField] || 'Unknown',
        code: p[codeField] || null,
        project_count: 0,
        revenue_delta: 0,
        projected_cost_delta: 0,
        gross_profit_delta: 0,
        gross_profit_pct_delta: 0,
        open_tasks: 0,
        net_gain_fade: 0,
        unrecognized_gain_fade: 0,
      });
    }
    const r = map.get(key);
    r.project_count += 1;
    if (p.deltas) {
      r.revenue_delta += p.deltas.projected_revenue || 0;
      r.projected_cost_delta += p.deltas.projected_cost || 0;
      r.gross_profit_delta += p.deltas.gross_profit_dollars || 0;
    }
    r.open_tasks += p.open_tasks || 0;
    r.net_gain_fade += p.gain_fade.totals.net;
    r.unrecognized_gain_fade += p.gain_fade.totals.unrecognized;
  }
  // Average gp pct delta is meaningless to sum — recompute as count-weighted average
  for (const r of map.values()) {
    r.gross_profit_pct_delta = 0; // intentionally blank; per-project view shows this
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// GET /api/reports/projections-report
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { start_date, end_date } = req.query;

    const toArray = (val) => {
      if (val === undefined || val === null || val === '') return null;
      return Array.isArray(val) ? val : String(val).split(',').map(s => s.trim()).filter(Boolean);
    };

    const pmEmployeeNos = toArray(req.query.pm_employee_no);
    const departmentCodes = toArray(req.query.department_code);
    const teamIds = toArray(req.query.team_id)?.map(Number).filter(n => Number.isFinite(n)) || null;

    const report = await buildProjectionsReport({
      tenantId,
      pmEmployeeNos,
      departmentCodes,
      teamIds,
      startDate: start_date || null,
      endDate: end_date || null,
    });

    res.json(report);
  } catch (err) {
    console.error('Error building projections report:', err);
    res.status(500).json({ error: 'Failed to build projections report' });
  }
});

// GET /api/reports/projections-report/filters
//   returns the set of PMs and departments that have any snapshot data.
//   When team_id is provided, PMs and departments are constrained to those
//   whose projects belong to the selected teams.
router.get('/filters', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const toArray = (val) => {
      if (val === undefined || val === null || val === '') return null;
      return Array.isArray(val) ? val : String(val).split(',').map(s => s.trim()).filter(Boolean);
    };
    const teamIds = toArray(req.query.team_id)?.map(Number).filter(n => Number.isFinite(n)) || null;

    const params = [tenantId];
    const where = ['ps.tenant_id = $1'];

    if (teamIds && teamIds.length > 0) {
      params.push(teamIds);
      where.push(`ps.project_id IN (
        SELECT DISTINCT p.id FROM projects p
        JOIN team_members tm ON tm.employee_id = p.manager_id
        WHERE p.tenant_id = $1 AND tm.team_id = ANY($${params.length}::int[])
      )`);
    }

    const result = await db.query(
      `SELECT DISTINCT pm_employee_no, pm_name, department_code, department_name
       FROM project_snapshots ps
       WHERE ${where.join(' AND ')}
         AND (pm_employee_no IS NOT NULL OR department_code IS NOT NULL)`,
      params
    );

    const pms = new Map();
    const departments = new Map();
    for (const r of result.rows) {
      if (r.pm_employee_no && !pms.has(r.pm_employee_no)) {
        pms.set(r.pm_employee_no, { employee_no: r.pm_employee_no, name: r.pm_name });
      }
      if (r.department_code && !departments.has(r.department_code)) {
        departments.set(r.department_code, { code: r.department_code, name: r.department_name });
      }
    }

    res.json({
      pms: Array.from(pms.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
      departments: Array.from(departments.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    });
  } catch (err) {
    console.error('Error fetching projections report filters:', err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

// GET /api/reports/projections-report/pdf-download
//   downloads the report as a PDF. Same filter params as the JSON endpoint.
router.get('/pdf-download', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { start_date, end_date } = req.query;

    const toArray = (val) => {
      if (val === undefined || val === null || val === '') return null;
      return Array.isArray(val) ? val : String(val).split(',').map(s => s.trim()).filter(Boolean);
    };

    const pmEmployeeNos = toArray(req.query.pm_employee_no);
    const departmentCodes = toArray(req.query.department_code);
    const teamIds = toArray(req.query.team_id)?.map(Number).filter(n => Number.isFinite(n)) || null;

    const report = await buildProjectionsReport({
      tenantId,
      pmEmployeeNos,
      departmentCodes,
      teamIds,
      startDate: start_date || null,
      endDate: end_date || null,
    });

    // Resolve human-readable names for the cover-page subtitle.
    const filterContext = {
      startDate: start_date || null,
      endDate: end_date || null,
      teamNames: [],
      pmNames: [],
      departmentNames: [],
    };

    if (teamIds && teamIds.length) {
      const teamRes = await db.query(
        `SELECT name FROM teams WHERE tenant_id = $1 AND id = ANY($2::int[]) ORDER BY name`,
        [tenantId, teamIds]
      );
      filterContext.teamNames = teamRes.rows.map(r => r.name);
    }
    if (pmEmployeeNos && pmEmployeeNos.length) {
      const pmRes = await db.query(
        `SELECT DISTINCT pm_name FROM project_snapshots
         WHERE tenant_id = $1 AND pm_employee_no = ANY($2::text[]) AND pm_name IS NOT NULL
         ORDER BY pm_name`,
        [tenantId, pmEmployeeNos]
      );
      filterContext.pmNames = pmRes.rows.map(r => r.pm_name);
    }
    if (departmentCodes && departmentCodes.length) {
      const deptRes = await db.query(
        `SELECT DISTINCT department_name FROM project_snapshots
         WHERE tenant_id = $1 AND department_code = ANY($2::text[]) AND department_name IS NOT NULL
         ORDER BY department_name`,
        [tenantId, departmentCodes]
      );
      filterContext.departmentNames = deptRes.rows.map(r => r.department_name);
    }

    const pdfBuffer = await generateProjectionsReportPdfBuffer(report, filterContext);

    // Build a filename that reflects the filter context.
    const dateStr = new Date().toISOString().split('T')[0];
    let nameTag = 'All-Projects';
    if (filterContext.teamNames.length === 1) {
      nameTag = filterContext.teamNames[0].replace(/[^A-Za-z0-9-]+/g, '-');
    } else if (filterContext.pmNames.length === 1) {
      nameTag = filterContext.pmNames[0].replace(/[^A-Za-z0-9-]+/g, '-');
    } else if (filterContext.teamNames.length > 1) {
      nameTag = `${filterContext.teamNames.length}-Teams`;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Projections-Report-${nameTag}-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating projections report PDF:', err);
    res.status(500).json({ error: 'Failed to generate projections report PDF' });
  }
});

module.exports = router;
module.exports.buildProjectionsReport = buildProjectionsReport;
