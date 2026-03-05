const express = require('express');
const ProjectAssignment = require('../models/ProjectAssignment');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

// GET /api/project-assignments/search-employees?q=name - Search employees for assignment (no HR access needed)
router.get('/search-employees', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const search = req.query.q || '';
    if (search.length < 2) return res.json([]);
    const db = require('../config/database');
    const result = await db.query(
      `SELECT id, first_name, last_name, email, job_title
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

// GET /api/project-assignments/user/:userId - Get assignments for a user
router.get('/user/:userId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const assignments = await ProjectAssignment.findByUserId(req.params.userId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// GET /api/project-assignments/project/:projectId - Get assigned foremen for a project
router.get('/project/:projectId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const assignments = await ProjectAssignment.findByProjectId(req.params.projectId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// POST /api/project-assignments/project/:projectId - Add employee to project
router.post('/project/:projectId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { employeeId, trade } = req.body;
    await ProjectAssignment.addToProject(employeeId, req.params.projectId, req.tenantId, trade, req.user.id);
    const assignments = await ProjectAssignment.findByProjectId(req.params.projectId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/project-assignments/project/:projectId/employee/:employeeId - Remove employee from project
router.delete('/project/:projectId/employee/:employeeId', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    await ProjectAssignment.removeFromProject(req.params.employeeId, req.params.projectId, req.tenantId);
    const assignments = await ProjectAssignment.findByProjectId(req.params.projectId, req.tenantId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/project-assignments/project/:projectId/employee/:employeeId/trade - Update trade
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

// PUT /api/project-assignments/user/:userId - Sync all assignments for a user
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

module.exports = router;
