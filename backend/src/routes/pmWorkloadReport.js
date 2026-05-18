const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const VistaData = require('../models/VistaData');
const Tenant = require('../models/Tenant');
const { buildPMWorkload, DEFAULT_THRESHOLDS } = require('../utils/pmWorkloadCalculator');

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

    const [contracts, teamMembers, teamMemberNames, filterOptions, tenant] = await Promise.all([
      VistaData.getAllContracts({}, req.tenantId),
      loadTeamMembers(req.tenantId),
      loadTeamMemberNames(teamId, req.tenantId),
      loadFilterOptions(req.tenantId),
      Tenant.findById(req.tenantId),
    ]);

    const savedThresholds = tenant?.settings?.pmWorkloadThresholds || {};

    const result = buildPMWorkload(contracts, {
      departmentId,
      teamId,
      teamMembers,
      teamMemberNames,
      thresholds: savedThresholds,
    });

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
