const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const VistaData = require('../models/VistaData');
const Tenant = require('../models/Tenant');
const { buildPMWorkload, DEFAULT_THRESHOLDS, INACTIVE_STATUSES } = require('../utils/pmWorkloadCalculator');

router.use(authenticate);
router.use(tenantContext);

async function loadTeamMembers(tenantId) {
  const result = await db.query(
    `SELECT tm.employee_id, tm.team_id
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE t.tenant_id = $1 AND t.is_active = true`,
    [tenantId]
  );
  const map = new Map();
  for (const row of result.rows) {
    if (!map.has(row.employee_id)) map.set(row.employee_id, new Set());
    map.get(row.employee_id).add(row.team_id);
  }
  return map;
}

/**
 * Resolve a team's members + lead to a set of lowercased "first last" name strings.
 * Used to match Vista contracts whose PMs aren't linked to an employee.
 */
async function loadTeamMemberNames(teamId, tenantId) {
  if (!teamId) return null;
  const result = await db.query(
    `SELECT DISTINCT LOWER(e.first_name || ' ' || e.last_name) AS full_name
     FROM (
       SELECT employee_id FROM team_members WHERE team_id = $1
       UNION
       SELECT team_lead_id AS employee_id FROM teams WHERE id = $1 AND team_lead_id IS NOT NULL
     ) m
     JOIN employees e ON e.id = m.employee_id AND e.tenant_id = $2
     WHERE e.first_name IS NOT NULL AND e.last_name IS NOT NULL`,
    [teamId, tenantId]
  );
  return new Set(result.rows.map(r => r.full_name));
}

/**
 * Load management phase-code remaining hours, joining through
 * vp_phase_codes.linked_project_id → projects.manager_id → employees
 * (vp_contracts.linked_employee_id is not populated, so we go via projects).
 *
 * Returns:
 *   byId   – Map<employee_id, hours>  for linked PM rows
 *   byKey  – Map<'last, first' lowercase, hours>  for unlinked PM rows
 *            (Vista stores names as "Last, First" in project_manager_name)
 */
async function loadMgmtHours(tenantId) {
  const [empResult, contractResult] = await Promise.all([
    // Per-employee totals (for PM-row attachment)
    db.query(
      `SELECT
         e.id AS employee_id,
         LOWER(e.last_name || ', ' || e.first_name) AS vista_key,
         COALESCE(SUM(GREATEST(0, pc.est_hours - pc.jtd_hours)), 0) AS mgmt_remaining_hours
       FROM vp_phase_codes pc
       JOIN projects p ON pc.linked_project_id = p.id
       JOIN employees e ON p.manager_id = e.id
       WHERE pc.tenant_id = $1
         AND (
           pc.phase LIKE '70-%'
           OR UPPER(pc.phase_description) LIKE '%MANAGEMENT%'
           OR UPPER(pc.phase_description) LIKE '%PROJ MGR%'
         )
       GROUP BY e.id, e.first_name, e.last_name`,
      [tenantId]
    ),
    // Per-contract totals (for project-list rows), keyed by Vista contract number
    db.query(
      `SELECT
         pc.contract AS contract_number,
         COALESCE(SUM(GREATEST(0, pc.est_hours - pc.jtd_hours)), 0) AS mgmt_remaining_hours,
         COALESCE(SUM(pc.est_hours), 0) AS mgmt_est_hours,
         COALESCE(SUM(pc.jtd_hours), 0) AS mgmt_jtd_hours
       FROM vp_phase_codes pc
       WHERE pc.tenant_id = $1
         AND (
           pc.phase LIKE '70-%'
           OR UPPER(pc.phase_description) LIKE '%MANAGEMENT%'
           OR UPPER(pc.phase_description) LIKE '%PROJ MGR%'
         )
       GROUP BY pc.contract`,
      [tenantId]
    ),
  ]);

  const byId = new Map();
  const byKey = new Map();
  for (const row of empResult.rows) {
    const hrs = Number(row.mgmt_remaining_hours);
    byId.set(row.employee_id, hrs);
    byKey.set(row.vista_key, hrs);
  }

  const byContract = new Map();
  for (const row of contractResult.rows) {
    byContract.set(row.contract_number, {
      mgmtRemainingHours: Number(row.mgmt_remaining_hours),
      mgmtEstHours: Number(row.mgmt_est_hours),
      mgmtJtdHours: Number(row.mgmt_jtd_hours),
    });
  }

  return { byId, byKey, byContract };
}

/**
 * Build the team-level management hours summary directly from the DB.
 * Returns an array sorted by totalMgmtRemainingHours desc.
 */
async function loadTeamMgmtSummary(tenantId) {
  const result = await db.query(
    `SELECT
       t.id   AS team_id,
       t.name AS team_name,
       COUNT(DISTINCT e.id) AS pm_count,
       COALESCE(SUM(GREATEST(0, pc.est_hours - pc.jtd_hours)), 0) AS total_mgmt_remaining_hours
     FROM vp_phase_codes pc
     JOIN projects p ON pc.linked_project_id = p.id
     JOIN employees e ON p.manager_id = e.id
     JOIN team_members tm ON tm.employee_id = e.id
     JOIN teams t ON t.id = tm.team_id AND t.tenant_id = $1 AND t.is_active = true
     WHERE pc.tenant_id = $1
       AND (
         pc.phase LIKE '70-%'
         OR UPPER(pc.phase_description) LIKE '%MANAGEMENT%'
         OR UPPER(pc.phase_description) LIKE '%PROJ MGR%'
       )
     GROUP BY t.id, t.name
     ORDER BY total_mgmt_remaining_hours DESC`,
    [tenantId]
  );
  return result.rows.map(r => ({
    teamId: r.team_id,
    teamName: r.team_name,
    pmCount: Number(r.pm_count),
    totalMgmtRemainingHours: Math.round(Number(r.total_mgmt_remaining_hours)),
    hoursPerPM: r.pm_count > 0 ? Math.round(Number(r.total_mgmt_remaining_hours) / Number(r.pm_count)) : 0,
  }));
}

async function loadFilterOptions(tenantId) {
  const [depts, teams] = await Promise.all([
    db.query(
      `SELECT id, name FROM departments WHERE tenant_id = $1 ORDER BY name`,
      [tenantId]
    ),
    db.query(
      `SELECT id, name FROM teams WHERE tenant_id = $1 AND is_active = true ORDER BY name`,
      [tenantId]
    ),
  ]);
  return {
    departments: depts.rows,
    teams: teams.rows,
  };
}

/**
 * GET /api/pm-workload-report
 * Query params:
 *   - departmentId (optional, integer)
 *   - teamId (optional, integer)
 */
router.get('/', async (req, res) => {
  try {
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId, 10) : null;
    const teamId = req.query.teamId ? parseInt(req.query.teamId, 10) : null;

    const [contracts, teamMembers, teamMemberNames, filterOptions, tenant, mgmtHours, teamSummary] = await Promise.all([
      VistaData.getAllContracts({}, req.tenantId),
      loadTeamMembers(req.tenantId),
      loadTeamMemberNames(teamId, req.tenantId),
      loadFilterOptions(req.tenantId),
      Tenant.findById(req.tenantId),
      loadMgmtHours(req.tenantId),
      loadTeamMgmtSummary(req.tenantId),
    ]);

    const savedThresholds = tenant?.settings?.pmWorkloadThresholds || {};

    const result = buildPMWorkload(contracts, {
      departmentId,
      teamId,
      teamMembers,
      teamMemberNames,
      thresholds: savedThresholds,
    });

    // Attach management phase hours to each PM row and each contract within it.
    for (const pm of result.pms) {
      // PM-level mgmt hours
      if (pm.employeeId) {
        pm.mgmtRemainingHours = mgmtHours.byId.get(pm.employeeId) ?? 0;
      } else {
        const raw = (pm.pmName || '').toLowerCase().trim();
        let hrs = mgmtHours.byKey.get(raw) ?? 0;
        if (!hrs && raw.includes(',')) {
          const [last, rest = ''] = raw.split(/,\s*/);
          const firstName = rest.trim().split(/\s+/)[0];
          hrs = mgmtHours.byKey.get(`${last}, ${firstName}`) ?? 0;
        }
        pm.mgmtRemainingHours = hrs;
      }

      // Contract-level mgmt hours
      for (const contract of pm.contracts) {
        const m = mgmtHours.byContract.get(contract.contractNumber);
        contract.mgmtRemainingHours = m?.mgmtRemainingHours ?? 0;
        contract.mgmtEstHours = m?.mgmtEstHours ?? 0;
        contract.mgmtJtdHours = m?.mgmtJtdHours ?? 0;
      }
    }

    res.json({
      generatedAt: new Date().toISOString(),
      filters: {
        departmentId,
        teamId,
        applied: !!(departmentId || teamId),
      },
      filterOptions,
      thresholds: result.thresholds,
      defaultThresholds: DEFAULT_THRESHOLDS,
      attention: result.attention,
      pms: result.pms,
      unmatched: result.unmatched,
      teamSummary,
      meta: {
        totalContractsScanned: contracts.length,
        activeContractsCounted: result.pms.reduce((s, p) => s + p.activeProjects, 0),
      },
    });
  } catch (error) {
    console.error('Error building PM workload report:', error);
    res.status(500).json({ error: 'Failed to build PM workload report' });
  }
});

module.exports = router;
