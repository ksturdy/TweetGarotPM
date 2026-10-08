const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Get all teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.getAll(req.tenantId);
    res.json({ data: teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get all team member IDs for the current user's teams
// This is used for "My Team" filtering on the dashboard
// Returns employee IDs (for project filtering), user IDs (for opportunity/estimate filtering),
// and names (for matching estimates by estimator_name text field)
router.get('/my-team-members', async (req, res) => {
  try {
    const [employeeIds, userIds, names] = await Promise.all([
      Team.getMyTeamMemberEmployeeIds(req.user.id, req.tenantId),
      Team.getMyTeamMemberUserIds(req.user.id, req.tenantId),
      Team.getMyTeamMemberNames(req.user.id, req.tenantId)
    ]);
    res.json({ data: { employeeIds, userIds, names } });
  } catch (error) {
    console.error('Error fetching team member IDs:', error);
    res.status(500).json({ error: 'Failed to fetch team member IDs' });
  }
});

// Get team by ID
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json({ data: team });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Get team members
router.get('/:id/members', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const members = await Team.getMembers(req.params.id, req.tenantId);
    res.json({ data: members });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get team dashboard metrics
router.get('/:id/dashboard', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const statuses = req.query.statuses
      ? String(req.query.statuses).split(',').map(s => s.trim()).filter(Boolean)
      : ['Open'];
    const metrics = await Team.getDashboardMetrics(req.params.id, req.tenantId, statuses);
    res.json({ data: metrics });
  } catch (error) {
    console.error('Error fetching team dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch team dashboard' });
  }
});

// Get team's opportunities
router.get('/:id/opportunities', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const filter = req.query.filter || 'active';
    const opportunities = await Team.getOpportunities(req.params.id, req.tenantId, filter);
    res.json({ data: opportunities });
  } catch (error) {
    console.error('Error fetching team opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch team opportunities' });
  }
});

// Get team's customers
router.get('/:id/customers', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const filter = req.query.filter || 'active';
    const customers = await Team.getCustomers(req.params.id, req.tenantId, filter);
    res.json({ data: customers });
  } catch (error) {
    console.error('Error fetching team customers:', error);
    res.status(500).json({ error: 'Failed to fetch team customers' });
  }
});

// Get team's estimates
router.get('/:id/estimates', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const filter = req.query.filter || 'active';
    const estimates = await Team.getEstimates(req.params.id, req.tenantId, filter);
    res.json({ data: estimates });
  } catch (error) {
    console.error('Error fetching team estimates:', error);
    res.status(500).json({ error: 'Failed to fetch team estimates' });
  }
});

// Get team's projects
router.get('/:id/projects', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const filter = req.query.filter || 'active';
    const projects = await Team.getProjects(req.params.id, req.tenantId, filter);
    res.json({ data: projects });
  } catch (error) {
    console.error('Error fetching team projects:', error);
    res.status(500).json({ error: 'Failed to fetch team projects' });
  }
});

// Create team - requires admin or manager role
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const team = await Team.create({
      name: req.body.name.trim(),
      description: req.body.description,
      team_lead_id: req.body.team_lead_id,
      color: req.body.color,
      is_active: req.body.is_active,
      created_by: req.user.id
    }, req.tenantId);

    res.status(201).json({ data: team });
  } catch (error) {
    console.error('Error creating team:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update team - requires admin or manager role
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const existingTeam = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!existingTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = await Team.update(req.params.id, {
      name: req.body.name,
      description: req.body.description,
      team_lead_id: req.body.team_lead_id,
      color: req.body.color,
      is_active: req.body.is_active
    }, req.tenantId);

    res.json({ data: team });
  } catch (error) {
    console.error('Error updating team:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete team - requires admin role
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const deleted = await Team.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Add member to team - requires admin or manager role
router.post('/:id/members', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!req.body.employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const member = await Team.addMember(
      req.params.id,
      req.body.employee_id,
      req.body.role || 'member'
    );
    res.status(201).json({ data: member });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove member from team - requires admin or manager role
router.delete('/:id/members/:employeeId', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const removed = await Team.removeMember(req.params.id, req.params.employeeId);
    if (!removed) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Update member role - requires admin or manager role
router.patch('/:id/members/:employeeId/role', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!req.body.role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const member = await Team.updateMemberRole(
      req.params.id,
      req.params.employeeId,
      req.body.role
    );
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ data: member });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// GET /api/teams/:id/financials — revenue breakdowns by market, PM, customer, and year
router.get('/:id/financials', async (req, res, next) => {
  try {
    const db = require('../config/database');

    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const employeeIds = await Team.getMemberEmployeeIds(req.params.id, req.tenantId);
    if (employeeIds.length === 0) {
      return res.json({
        by_market: [], by_manager: [], by_customer: [], by_year: [],
        summary: { total_projects: 0, total_contract_value: 0, total_backlog: 0, avg_gm_pct: null },
      });
    }

    const rawStatuses = req.query.statuses
      ? String(req.query.statuses).split(',').map(s => s.trim()).filter(Boolean)
      : ['Open', 'Soft-Closed'];

    const result = await db.query(`
      WITH project_data AS (
        SELECT DISTINCT ON (p.id)
          p.id,
          COALESCE(p.market, 'Unspecified') AS market,
          EXTRACT(YEAR FROM COALESCE(p.start_date, p.created_at))::int AS year,
          COALESCE(e.first_name || ' ' || e.last_name, 'Unknown') AS manager_name,
          COALESCE(c.name, c.customer_owner, p.client, 'Unknown') AS customer_name,
          COALESCE(vc.contract_amount, p.contract_value, 0)::numeric AS contract_value,
          COALESCE(vc.gross_profit_percent, p.gross_margin_percent)::numeric AS gm_pct,
          (CASE WHEN vc.id IS NOT NULL
            THEN COALESCE(vc.backlog, 0) + COALESCE(vc.ipd_amount, 0)
            ELSE COALESCE(p.backlog, 0) END)::numeric AS backlog
        FROM projects p
        LEFT JOIN employees e ON p.manager_id = e.id
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
        WHERE p.tenant_id = $1 AND p.manager_id = ANY($2) AND p.status = ANY($3)
        ORDER BY p.id, vc.id DESC NULLS LAST
      )
      SELECT
        (SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (
          SELECT market, COUNT(*)::int AS project_count,
            ROUND(COALESCE(SUM(contract_value), 0)) AS contract_value,
            ROUND(COALESCE(SUM(backlog), 0)) AS backlog,
            CASE WHEN SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END) > 0
              THEN ROUND((SUM(COALESCE(gm_pct, 0) * contract_value)
                / NULLIF(SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END), 0)
                * 100)::numeric, 1)
              ELSE NULL END AS gm_pct
          FROM project_data GROUP BY market ORDER BY SUM(contract_value) DESC
        ) m) AS by_market,

        (SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (
          SELECT manager_name, COUNT(*)::int AS project_count,
            ROUND(COALESCE(SUM(contract_value), 0)) AS contract_value,
            ROUND(COALESCE(SUM(backlog), 0)) AS backlog,
            CASE WHEN SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END) > 0
              THEN ROUND((SUM(COALESCE(gm_pct, 0) * contract_value)
                / NULLIF(SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END), 0)
                * 100)::numeric, 1)
              ELSE NULL END AS gm_pct
          FROM project_data GROUP BY manager_name ORDER BY SUM(contract_value) DESC
        ) m) AS by_manager,

        (SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (
          SELECT customer_name, COUNT(*)::int AS project_count,
            ROUND(COALESCE(SUM(contract_value), 0)) AS contract_value,
            ROUND(COALESCE(SUM(backlog), 0)) AS backlog,
            CASE WHEN SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END) > 0
              THEN ROUND((SUM(COALESCE(gm_pct, 0) * contract_value)
                / NULLIF(SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END), 0)
                * 100)::numeric, 1)
              ELSE NULL END AS gm_pct
          FROM project_data GROUP BY customer_name ORDER BY SUM(contract_value) DESC LIMIT 10
        ) m) AS by_customer,

        (SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (
          SELECT year, COUNT(*)::int AS project_count,
            ROUND(COALESCE(SUM(contract_value), 0)) AS contract_value,
            ROUND(COALESCE(SUM(backlog), 0)) AS backlog,
            CASE WHEN SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END) > 0
              THEN ROUND((SUM(COALESCE(gm_pct, 0) * contract_value)
                / NULLIF(SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END), 0)
                * 100)::numeric, 1)
              ELSE NULL END AS gm_pct
          FROM project_data WHERE year IS NOT NULL GROUP BY year ORDER BY year ASC LIMIT 10
        ) m) AS by_year,

        (SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (
          SELECT year, manager_name,
            ROUND(COALESCE(SUM(contract_value), 0)) AS contract_value
          FROM project_data WHERE year IS NOT NULL
          GROUP BY year, manager_name ORDER BY year ASC
        ) m) AS by_year_manager,

        (SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (
          SELECT year, market,
            ROUND(COALESCE(SUM(contract_value), 0)) AS contract_value
          FROM project_data WHERE year IS NOT NULL
          GROUP BY year, market ORDER BY year ASC
        ) m) AS by_year_market,

        (SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (
          SELECT pd.year, pd.customer_name,
            ROUND(COALESCE(SUM(pd.contract_value), 0)) AS contract_value,
            CASE WHEN SUM(CASE WHEN pd.gm_pct IS NOT NULL THEN pd.contract_value ELSE 0 END) > 0
              THEN ROUND((SUM(COALESCE(pd.gm_pct, 0) * pd.contract_value)
                / NULLIF(SUM(CASE WHEN pd.gm_pct IS NOT NULL THEN pd.contract_value ELSE 0 END), 0)
                * 100)::numeric, 1)
              ELSE NULL END AS gm_pct
          FROM project_data pd
          INNER JOIN (
            SELECT customer_name FROM project_data
            GROUP BY customer_name ORDER BY SUM(contract_value) DESC LIMIT 10
          ) top ON top.customer_name = pd.customer_name
          WHERE pd.year IS NOT NULL
          GROUP BY pd.year, pd.customer_name ORDER BY pd.year ASC
        ) m) AS by_year_customer,

        (SELECT row_to_json(m) FROM (
          SELECT COUNT(*)::int AS total_projects,
            ROUND(COALESCE(SUM(contract_value), 0)) AS total_contract_value,
            ROUND(COALESCE(SUM(backlog), 0)) AS total_backlog,
            CASE WHEN SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END) > 0
              THEN ROUND((SUM(COALESCE(gm_pct, 0) * contract_value)
                / NULLIF(SUM(CASE WHEN gm_pct IS NOT NULL THEN contract_value ELSE 0 END), 0)
                * 100)::numeric, 1)
              ELSE NULL END AS avg_gm_pct,
            CASE WHEN SUM(CASE WHEN gm_pct IS NOT NULL AND backlog > 0 THEN backlog ELSE 0 END) > 0
              THEN ROUND((SUM(CASE WHEN backlog > 0 THEN COALESCE(gm_pct, 0) * backlog ELSE 0 END)
                / NULLIF(SUM(CASE WHEN gm_pct IS NOT NULL AND backlog > 0 THEN backlog ELSE 0 END), 0)
                * 100)::numeric, 1)
              ELSE NULL END AS backlog_gm_pct
          FROM project_data
        ) m) AS summary
    `, [req.tenantId, employeeIds, rawStatuses]);

    const row = result.rows[0] || {};
    res.json({
      by_market: row.by_market || [],
      by_manager: row.by_manager || [],
      by_customer: row.by_customer || [],
      by_year: row.by_year || [],
      by_year_manager: row.by_year_manager || [],
      by_year_market: row.by_year_market || [],
      by_year_customer: row.by_year_customer || [],
      summary: row.summary || { total_projects: 0, total_contract_value: 0, total_backlog: 0, avg_gm_pct: null },
    });
  } catch (error) {
    next(error);
  }
});

// ── Team Metric Configs ───────────────────────────────────────────────────────

router.get('/:id/metric-configs', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const configs = await Team.getMetricConfigs(req.params.id, req.tenantId);
    res.json({ data: configs });
  } catch (error) {
    console.error('Error fetching metric configs:', error);
    res.status(500).json({ error: 'Failed to fetch metric configs' });
  }
});

router.post('/:id/metric-configs', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const config = await Team.addMetricConfig(req.params.id, req.tenantId, req.body);
    res.status(201).json({ data: config });
  } catch (error) {
    console.error('Error adding metric config:', error);
    res.status(500).json({ error: 'Failed to add metric config' });
  }
});

router.patch('/:id/metric-configs/:configId', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const config = await Team.updateMetricConfig(req.params.id, req.tenantId, req.params.configId, req.body);
    res.json({ data: config });
  } catch (error) {
    console.error('Error updating metric config:', error);
    res.status(500).json({ error: 'Failed to update metric config' });
  }
});

router.delete('/:id/metric-configs/:configId', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    await Team.deleteMetricConfig(req.params.id, req.tenantId, req.params.configId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting metric config:', error);
    res.status(500).json({ error: 'Failed to delete metric config' });
  }
});

router.put('/:id/metric-configs/reorder', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    await Team.reorderMetricConfigs(req.params.id, req.tenantId, req.body.orderedIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering metric configs:', error);
    res.status(500).json({ error: 'Failed to reorder metric configs' });
  }
});

// ── Team Metric Snapshots ─────────────────────────────────────────────────────

router.get('/:id/metric-snapshots', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const snapshots = await Team.getMetricSnapshots(req.params.id, req.tenantId, 12);
    res.json({ data: snapshots });
  } catch (error) {
    console.error('Error fetching metric snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch metric snapshots' });
  }
});

router.post('/:id/metric-snapshots/capture', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const saved = await Team.captureMetricSnapshot(req.params.id, req.tenantId);
    res.json({ data: saved });
  } catch (error) {
    console.error('Error capturing metric snapshots:', error);
    res.status(500).json({ error: 'Failed to capture metric snapshots' });
  }
});

// Live current values — computes without saving to DB
router.get('/:id/metric-current', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const configs = await Team.getMetricConfigs(req.params.id, req.tenantId);
    if (configs.length === 0) return res.json({ data: [] });

    const scopeMap = new Map();
    for (const c of configs) {
      const key = `${c.member_user_id ?? 'null'}_${c.member_team_id ?? 'null'}`;
      if (!scopeMap.has(key)) {
        scopeMap.set(key, { member_user_id: c.member_user_id, member_team_id: c.member_team_id });
      }
    }

    const metricsByScope = {};
    for (const [key, scope] of scopeMap) {
      metricsByScope[key] = await Team._computeCurrentMetrics(
        req.params.id, req.tenantId, scope.member_user_id, scope.member_team_id
      );
    }

    const current = configs.map(c => {
      const key = `${c.member_user_id ?? 'null'}_${c.member_team_id ?? 'null'}`;
      const value = Team._extractMetricValue(metricsByScope[key], c.metric_key);
      return {
        member_user_id: c.member_user_id,
        member_team_id: c.member_team_id,
        metric_key: c.metric_key,
        value,
      };
    });

    res.json({ data: current });
  } catch (error) {
    console.error('Error fetching current metrics:', error);
    res.status(500).json({ error: 'Failed to fetch current metrics' });
  }
});

// ── Snapshot Settings ─────────────────────────────────────────────────────────

router.get('/:id/snapshot-settings', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const settings = await Team.getSnapshotSettings(req.params.id, req.tenantId);
    res.json({ data: settings });
  } catch (error) {
    console.error('Error fetching snapshot settings:', error);
    res.status(500).json({ error: 'Failed to fetch snapshot settings' });
  }
});

router.put('/:id/snapshot-settings', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const settings = await Team.upsertSnapshotSettings(req.params.id, req.tenantId, req.body);
    res.json({ data: settings });
  } catch (error) {
    console.error('Error saving snapshot settings:', error);
    res.status(500).json({ error: 'Failed to save snapshot settings' });
  }
});

module.exports = router;
