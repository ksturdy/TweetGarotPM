const express = require('express');
const ProjectAssignment = require('../models/ProjectAssignment');
const AssignmentNotification = require('../models/AssignmentNotification');
const Employee = require('../models/Employee');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const emailService = require('../utils/emailService');
const smsService = require('../utils/smsService');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

// GET /api/project-assignments/search-employees?q=name
router.get('/search-employees', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const search = req.query.q || '';
    if (search.length < 2) return res.json([]);
    const db = require('../config/database');
    const result = await db.query(
      `SELECT id, first_name, last_name, email, job_title, title, trade, employee_group
       FROM employees
       WHERE tenant_id = $1
         AND (first_name || ' ' || last_name) ILIKE $2
       ORDER BY last_name, first_name
       LIMIT 15`,
      [req.tenantId, `%${search}%`]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/project-assignments/user/:userId
router.get('/user/:userId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const assignments = await ProjectAssignment.findByUserId(req.params.userId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// GET /api/project-assignments/project/:projectId
router.get('/project/:projectId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const assignments = await ProjectAssignment.findByProjectId(req.params.projectId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// GET /api/project-assignments/employee/:employeeId/assignments?scope=current|upcoming|past
router.get('/employee/:employeeId/assignments', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const scope = req.query.scope || 'current';
    if (!['current', 'upcoming', 'past'].includes(scope)) {
      return res.status(400).json({ error: 'scope must be current|upcoming|past' });
    }
    const assignments = await ProjectAssignment.findByEmployeeAndScope(
      req.params.employeeId, req.tenantId, scope
    );
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// POST /api/project-assignments/project/:projectId  (add crew member to project)
router.post('/project/:projectId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const payload = {
      employeeId: req.body.employeeId,
      projectId: req.params.projectId,
      trade: req.body.trade,
      role: req.body.role,
      startDate: req.body.startDate || req.body.start_date,
      endDate: req.body.endDate || req.body.end_date,
      startDateOverridden: req.body.startDateOverridden ?? req.body.start_date_overridden,
      endDateOverridden: req.body.endDateOverridden ?? req.body.end_date_overridden,
      shiftPattern: req.body.shiftPattern || req.body.shift_pattern,
      shiftStartTime: req.body.shiftStartTime || req.body.shift_start_time,
      shiftEndTime: req.body.shiftEndTime || req.body.shift_end_time,
      status: req.body.status,
      notes: req.body.notes,
      tags: req.body.tags,
    };
    await ProjectAssignment.addToProject(payload, req.tenantId, req.user.id);
    const assignments = await ProjectAssignment.findByProjectId(req.params.projectId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/project-assignments/:id  (edit any field on an assignment)
router.patch('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const updated = await ProjectAssignment.updateAssignment(
      req.params.id, req.tenantId, req.body
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/project-assignments/:id  (cancel an assignment by id)
router.delete('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const deleted = await ProjectAssignment.deleteById(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/project-assignments/project/:projectId/employee/:employeeId
router.delete('/project/:projectId/employee/:employeeId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    await ProjectAssignment.removeFromProject(req.params.employeeId, req.params.projectId, req.tenantId);
    const assignments = await ProjectAssignment.findByProjectId(req.params.projectId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/project-assignments/project/:projectId/employee/:employeeId/trade
router.patch('/project/:projectId/employee/:employeeId/trade', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { trade } = req.body;
    await ProjectAssignment.updateTrade(req.params.employeeId, req.params.projectId, req.tenantId, trade);
    const assignments = await ProjectAssignment.findByProjectId(req.params.projectId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// PUT /api/project-assignments/user/:userId  (legacy bulk sync — keep)
router.put('/user/:userId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { projectIds } = req.body;
    const assignments = await ProjectAssignment.syncForUser(
      req.params.userId, projectIds || [], req.tenantId, req.user.id
    );
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// POST /api/project-assignments/:id/notify  (send email/SMS to the assigned employee)
router.post('/:id/notify', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { channels, customMessage } = req.body;
    const wanted = Array.isArray(channels) && channels.length ? channels : ['email'];

    const assignment = await ProjectAssignment.findById(req.params.id, req.tenantId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const employee = await Employee.getByIdAndTenant(assignment.employee_id, req.tenantId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const merged = { ...assignment, ...employee, ...assignment };
    const results = [];

    if (wanted.includes('email')) {
      const recipient = employee.email;
      if (!recipient) {
        results.push({ channel: 'email', success: false, message: 'No email on file' });
      } else {
        const html = emailService.generateAssignmentEmailHtml(merged, customMessage);
        const text = emailService.generateAssignmentEmailText(merged, customMessage);
        const subject = `Assignment: ${assignment.project_name}${assignment.project_number ? ` (#${assignment.project_number})` : ''}`;
        const r = await emailService.sendEmail({ to: recipient, subject, html, text });
        results.push({ channel: 'email', ...r });
        await AssignmentNotification.create({
          assignmentId: assignment.id,
          tenantId: req.tenantId,
          channel: 'email',
          recipient,
          subject,
          body: text,
          status: r.success ? 'sent' : 'failed',
          error: r.error || null,
          sentBy: req.user.id,
        });
      }
    }

    if (wanted.includes('sms')) {
      const recipient = employee.mobile_phone || employee.phone;
      if (!recipient) {
        results.push({ channel: 'sms', success: false, message: 'No phone number on file' });
      } else {
        const body = emailService.generateAssignmentSmsText(merged, customMessage);
        const r = await smsService.sendSms({ to: recipient, body });
        results.push({ channel: 'sms', ...r });
        await AssignmentNotification.create({
          assignmentId: assignment.id,
          tenantId: req.tenantId,
          channel: 'sms',
          recipient,
          body,
          status: r.success ? 'sent' : (r.preview ? 'skipped' : 'failed'),
          error: r.error || null,
          sentBy: req.user.id,
        });
      }
    }

    const history = await AssignmentNotification.findByAssignment(assignment.id, req.tenantId);
    res.json({ results, history });
  } catch (error) {
    next(error);
  }
});

// GET /api/project-assignments/:id/notifications  (history for one assignment)
router.get('/:id/notifications', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const history = await AssignmentNotification.findByAssignment(req.params.id, req.tenantId);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
