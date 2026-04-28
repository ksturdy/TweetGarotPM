const express = require('express');
const router = express.Router();
const db = require('../config/database');
const Team = require('../models/Team');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/dashboard/attention-items
 * Returns items needing attention for the logged-in user:
 * - Overdue RFIs assigned to user or on projects they manage
 * - RFIs due soon (within 3 days)
 * - Submittals pending review on projects user manages
 * - Submittals due soon
 */
router.get('/attention-items', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const { scope = 'my' } = req.query; // 'my', 'team', or 'company'

    const attentionItems = [];

    // Get the user's employee_id (for manager filtering, since manager_id now references employees)
    let employeeId = null;
    const empResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
    if (empResult.rows.length > 0) {
      employeeId = empResult.rows[0].id;
    }

    // For 'team' scope, get all team member employee IDs
    let teamMemberEmployeeIds = [];
    if (scope === 'team') {
      teamMemberEmployeeIds = await Team.getMyTeamMemberEmployeeIds(userId, tenantId);
    }

    // Build user filter based on scope
    let userFilter = '';
    const params = [tenantId];

    if (scope === 'my') {
      // Filter to user's items only
      if (employeeId) {
        userFilter = 'AND (r.assigned_to = $2 OR r.created_by = $2 OR p.manager_id = $3)';
        params.push(userId);
        params.push(employeeId);
      } else {
        userFilter = 'AND (r.assigned_to = $2 OR r.created_by = $2)';
        params.push(userId);
      }
    } else if (scope === 'team' && teamMemberEmployeeIds.length > 0) {
      // Filter to team members' items
      userFilter = 'AND p.manager_id = ANY($2)';
      params.push(teamMemberEmployeeIds);
    } else if (scope === 'team') {
      // No team members, fall back to user's items
      if (employeeId) {
        userFilter = 'AND (r.assigned_to = $2 OR r.created_by = $2 OR p.manager_id = $3)';
        params.push(userId);
        params.push(employeeId);
      } else {
        userFilter = 'AND (r.assigned_to = $2 OR r.created_by = $2)';
        params.push(userId);
      }
    }
    // For 'company', show all items (no filter)

    // Find overdue RFIs (past due date, not answered)
    const overdueRfisQuery = `
      SELECT
        r.id,
        r.number,
        r.subject,
        r.due_date,
        r.status,
        r.project_id,
        p.name as project_name,
        (CURRENT_DATE - r.due_date::date) as days_overdue,
        u.first_name || ' ' || u.last_name as responsible_person
      FROM rfis r
      JOIN projects p ON r.project_id = p.id
      LEFT JOIN users u ON r.assigned_to = u.id
      WHERE p.tenant_id = $1
        AND r.status = 'open'
        AND r.due_date < CURRENT_DATE
        ${userFilter}
      ORDER BY r.due_date ASC
      LIMIT 10
    `;

    const overdueRfis = await db.query(overdueRfisQuery, params);

    overdueRfis.rows.forEach(rfi => {
      const daysOverdue = Math.floor(rfi.days_overdue);
      attentionItems.push({
        id: `rfi-${rfi.id}`,
        type: 'rfi',
        message: `RFI #${rfi.number} overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`,
        project: rfi.project_name,
        path: `/projects/${rfi.project_id}/rfis`,
        severity: daysOverdue > 7 ? 'high' : daysOverdue > 3 ? 'medium' : 'low',
        dueDate: rfi.due_date,
        responsiblePerson: rfi.responsible_person || 'Unassigned'
      });
    });

    // Find RFIs due soon (within 3 days, not answered)
    const dueSoonRfisQuery = `
      SELECT
        r.id,
        r.number,
        r.subject,
        r.due_date,
        r.status,
        r.project_id,
        p.name as project_name,
        (r.due_date::date - CURRENT_DATE) as days_until_due,
        u.first_name || ' ' || u.last_name as responsible_person
      FROM rfis r
      JOIN projects p ON r.project_id = p.id
      LEFT JOIN users u ON r.assigned_to = u.id
      WHERE p.tenant_id = $1
        AND r.status = 'open'
        AND r.due_date >= CURRENT_DATE
        AND r.due_date <= CURRENT_DATE + INTERVAL '3 days'
        ${userFilter}
      ORDER BY r.due_date ASC
      LIMIT 10
    `;

    const dueSoonRfis = await db.query(dueSoonRfisQuery, params);

    dueSoonRfis.rows.forEach(rfi => {
      const daysUntil = Math.floor(rfi.days_until_due);
      const timeText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
      attentionItems.push({
        id: `rfi-due-${rfi.id}`,
        type: 'rfi',
        message: `RFI #${rfi.number} due ${timeText}`,
        project: rfi.project_name,
        path: `/projects/${rfi.project_id}/rfis`,
        severity: daysUntil === 0 ? 'high' : 'medium',
        dueDate: rfi.due_date,
        responsiblePerson: rfi.responsible_person || 'Unassigned'
      });
    });

    // Build submittal user filter
    let submittalUserFilter = '';
    const submittalParams = [tenantId];

    if (scope === 'my') {
      // Filter to user's items only
      if (employeeId) {
        submittalUserFilter = 'AND (s.created_by = $2 OR p.manager_id = $3)';
        submittalParams.push(userId);
        submittalParams.push(employeeId);
      } else {
        submittalUserFilter = 'AND s.created_by = $2';
        submittalParams.push(userId);
      }
    } else if (scope === 'team' && teamMemberEmployeeIds.length > 0) {
      // Filter to team members' items
      submittalUserFilter = 'AND p.manager_id = ANY($2)';
      submittalParams.push(teamMemberEmployeeIds);
    } else if (scope === 'team') {
      // No team members, fall back to user's items
      if (employeeId) {
        submittalUserFilter = 'AND (s.created_by = $2 OR p.manager_id = $3)';
        submittalParams.push(userId);
        submittalParams.push(employeeId);
      } else {
        submittalUserFilter = 'AND s.created_by = $2';
        submittalParams.push(userId);
      }
    }
    // For 'company', show all items (no filter)

    // Find submittals pending review
    const pendingSubmittalsQuery = `
      SELECT
        s.id,
        s.number,
        s.description,
        s.due_date,
        s.status,
        s.project_id,
        p.name as project_name,
        CASE
          WHEN s.due_date IS NULL THEN NULL
          WHEN s.due_date::date < CURRENT_DATE THEN (CURRENT_DATE - s.due_date::date)
          ELSE -(s.due_date::date - CURRENT_DATE)
        END as days_diff,
        u.first_name || ' ' || u.last_name as responsible_person
      FROM submittals s
      JOIN projects p ON s.project_id = p.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE p.tenant_id = $1
        AND s.status IN ('pending', 'under_review')
        AND (s.due_date IS NULL OR s.due_date <= CURRENT_DATE + INTERVAL '3 days')
        ${submittalUserFilter}
      ORDER BY s.due_date ASC NULLS LAST
      LIMIT 10
    `;

    const pendingSubmittals = await db.query(pendingSubmittalsQuery, submittalParams);

    pendingSubmittals.rows.forEach(sub => {
      let message;
      let severity;

      if (sub.due_date && sub.days_diff > 0) {
        const daysOverdue = Math.floor(sub.days_diff);
        message = `Submittal #${sub.number} review overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`;
        severity = daysOverdue > 7 ? 'high' : daysOverdue > 3 ? 'medium' : 'low';
      } else if (sub.due_date) {
        const daysUntil = Math.abs(Math.floor(sub.days_diff));
        const timeText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
        message = `Submittal #${sub.number} review due ${timeText}`;
        severity = daysUntil === 0 ? 'high' : 'medium';
      } else {
        message = `Submittal #${sub.number} pending review`;
        severity = 'low';
      }

      attentionItems.push({
        id: `submittal-${sub.id}`,
        type: 'submittal',
        message,
        project: sub.project_name,
        path: `/projects/${sub.project_id}/submittals`,
        severity,
        dueDate: sub.due_date,
        responsiblePerson: sub.responsible_person || 'Unassigned'
      });
    });

    // Sort by severity (high first) then by due date
    const severityOrder = { high: 0, medium: 1, low: 2 };
    attentionItems.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

    res.json(attentionItems.slice(0, 10));
  } catch (error) {
    console.error('Error fetching attention items:', error);
    res.status(500).json({ error: 'Failed to fetch attention items' });
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Returns a unified feed of recent company-wide activity across all modules.
 * Aggregates recent creates/updates from projects, opportunities, estimates,
 * RFIs, submittals, change orders, and daily reports.
 */
router.get('/recent-activity', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);

    // Use a UNION ALL to fetch recent activity from multiple tables in one query
    const query = `
      SELECT * FROM (
        (
          SELECT
            'project' as type,
            p.id as entity_id,
            p.name as title,
            NULL::text as parent_name,
            NULL::integer as parent_id,
            p.status,
            e.first_name || ' ' || e.last_name as actor_name,
            p.created_at,
            p.updated_at,
            CASE WHEN p.updated_at > p.created_at + interval '5 seconds' THEN 'updated' ELSE 'created' END as action
          FROM projects p
          LEFT JOIN employees e ON p.manager_id = e.id
          WHERE p.tenant_id = $1
          ORDER BY GREATEST(p.created_at, p.updated_at) DESC
          LIMIT 8
        )
        UNION ALL
        (
          SELECT
            'opportunity' as type,
            o.id as entity_id,
            o.title,
            NULL::text as parent_name,
            NULL::integer as parent_id,
            ps.name as status,
            e.first_name || ' ' || e.last_name as actor_name,
            o.created_at,
            o.updated_at,
            CASE WHEN o.updated_at > o.created_at + interval '5 seconds' THEN 'updated' ELSE 'created' END as action
          FROM opportunities o
          LEFT JOIN employees e ON o.assigned_to = e.id
          LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
          WHERE o.tenant_id = $1
          ORDER BY GREATEST(o.created_at, o.updated_at) DESC
          LIMIT 8
        )
        UNION ALL
        (
          SELECT
            'estimate' as type,
            est.id as entity_id,
            est.project_name as title,
            NULL::text as parent_name,
            NULL::integer as parent_id,
            est.status,
            u.first_name || ' ' || u.last_name as actor_name,
            est.created_at,
            est.updated_at,
            CASE WHEN est.updated_at > est.created_at + interval '5 seconds' THEN 'updated' ELSE 'created' END as action
          FROM estimates est
          LEFT JOIN users u ON est.created_by = u.id
          WHERE est.tenant_id = $1
          ORDER BY GREATEST(est.created_at, est.updated_at) DESC
          LIMIT 8
        )
        UNION ALL
        (
          SELECT
            'rfi' as type,
            r.id as entity_id,
            'RFI #' || r.number || ': ' || COALESCE(r.subject, '') as title,
            p.name as parent_name,
            r.project_id as parent_id,
            r.status,
            u.first_name || ' ' || u.last_name as actor_name,
            r.created_at,
            r.updated_at,
            CASE WHEN r.updated_at > r.created_at + interval '5 seconds' THEN 'updated' ELSE 'created' END as action
          FROM rfis r
          JOIN projects p ON r.project_id = p.id
          LEFT JOIN users u ON r.created_by = u.id
          WHERE p.tenant_id = $1
          ORDER BY GREATEST(r.created_at, r.updated_at) DESC
          LIMIT 8
        )
        UNION ALL
        (
          SELECT
            'submittal' as type,
            s.id as entity_id,
            'Submittal #' || s.number || ': ' || COALESCE(s.description, '') as title,
            p.name as parent_name,
            s.project_id as parent_id,
            s.status,
            u.first_name || ' ' || u.last_name as actor_name,
            s.created_at,
            s.updated_at,
            CASE WHEN s.updated_at > s.created_at + interval '5 seconds' THEN 'updated' ELSE 'created' END as action
          FROM submittals s
          JOIN projects p ON s.project_id = p.id
          LEFT JOIN users u ON s.created_by = u.id
          WHERE p.tenant_id = $1
          ORDER BY GREATEST(s.created_at, s.updated_at) DESC
          LIMIT 8
        )
        UNION ALL
        (
          SELECT
            'change_order' as type,
            co.id as entity_id,
            'CO #' || co.number || ': ' || COALESCE(co.title, '') as title,
            p.name as parent_name,
            co.project_id as parent_id,
            co.status,
            u.first_name || ' ' || u.last_name as actor_name,
            co.created_at,
            co.updated_at,
            CASE WHEN co.updated_at > co.created_at + interval '5 seconds' THEN 'updated' ELSE 'created' END as action
          FROM change_orders co
          JOIN projects p ON co.project_id = p.id
          LEFT JOIN users u ON co.created_by = u.id
          WHERE p.tenant_id = $1
          ORDER BY GREATEST(co.created_at, co.updated_at) DESC
          LIMIT 8
        )
        UNION ALL
        (
          SELECT
            'daily_report' as type,
            dr.id as entity_id,
            'Daily Report ' || dr.report_date::date as title,
            p.name as parent_name,
            dr.project_id as parent_id,
            NULL::text as status,
            u.first_name || ' ' || u.last_name as actor_name,
            dr.created_at,
            dr.updated_at,
            CASE WHEN dr.updated_at > dr.created_at + interval '5 seconds' THEN 'updated' ELSE 'created' END as action
          FROM daily_reports dr
          JOIN projects p ON dr.project_id = p.id
          LEFT JOIN users u ON dr.created_by = u.id
          WHERE p.tenant_id = $1
          ORDER BY GREATEST(dr.created_at, dr.updated_at) DESC
          LIMIT 8
        )
      ) activity
      ORDER BY GREATEST(created_at, updated_at) DESC
      LIMIT $2
    `;

    const result = await db.query(query, [tenantId, limit]);

    const activities = result.rows.map(row => ({
      type: row.type,
      entityId: row.entity_id,
      title: row.title,
      parentName: row.parent_name,
      parentId: row.parent_id,
      status: row.status,
      actorName: row.actor_name,
      action: row.action,
      timestamp: row.updated_at || row.created_at,
    }));

    res.json(activities);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

module.exports = router;
