const express = require('express');
const router = express.Router();
const OrgChart = require('../models/OrgChart');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

// GET /api/org-charts - List all org charts
router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.project_id) filters.project_id = parseInt(req.query.project_id);
    if (req.query.search) filters.search = req.query.search;

    const charts = await OrgChart.findAllByTenant(req.tenantId, filters);
    res.json(charts);
  } catch (err) {
    next(err);
  }
});

// POST /api/org-charts - Create org chart
router.post('/', async (req, res, next) => {
  try {
    const { name, description, project_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const chart = await OrgChart.create({
      name,
      description,
      project_id,
      created_by: req.userId
    }, req.tenantId);

    res.status(201).json(chart);
  } catch (err) {
    next(err);
  }
});

// GET /api/org-charts/:id - Get org chart with members
router.get('/:id', async (req, res, next) => {
  try {
    const chart = await OrgChart.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!chart) {
      return res.status(404).json({ error: 'Org chart not found' });
    }
    res.json(chart);
  } catch (err) {
    next(err);
  }
});

// PUT /api/org-charts/:id - Update org chart metadata
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, project_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const chart = await OrgChart.update(parseInt(req.params.id), {
      name,
      description,
      project_id
    }, req.tenantId);

    if (!chart) {
      return res.status(404).json({ error: 'Org chart not found' });
    }
    res.json(chart);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/org-charts/:id - Delete org chart
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await OrgChart.delete(parseInt(req.params.id), req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Org chart not found' });
    }
    res.json({ message: 'Org chart deleted' });
  } catch (err) {
    next(err);
  }
});

// ── Member routes ──

// GET /api/org-charts/:id/members - List members with hierarchy
router.get('/:id/members', async (req, res, next) => {
  try {
    const owns = await OrgChart.verifyChartOwnership(parseInt(req.params.id), req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Org chart not found' });
    }

    const members = await OrgChart.getMembersWithHierarchy(parseInt(req.params.id));
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// POST /api/org-charts/:id/members - Add member
router.post('/:id/members', async (req, res, next) => {
  try {
    const chartId = parseInt(req.params.id);
    const owns = await OrgChart.verifyChartOwnership(chartId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Org chart not found' });
    }

    const { first_name, last_name } = req.body;
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const member = await OrgChart.createMember(chartId, req.body);
    res.status(201).json(member);
  } catch (err) {
    if (err.message.includes('Circular') || err.message.includes('report to themselves')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// PUT /api/org-charts/:id/members/:memberId - Update member
router.put('/:id/members/:memberId', async (req, res, next) => {
  try {
    const chartId = parseInt(req.params.id);
    const owns = await OrgChart.verifyChartOwnership(chartId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Org chart not found' });
    }

    const { first_name, last_name } = req.body;
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const member = await OrgChart.updateMember(
      parseInt(req.params.memberId),
      req.body,
      chartId
    );

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (err) {
    if (err.message.includes('Circular') || err.message.includes('report to themselves')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/org-charts/:id/members/:memberId - Delete member
router.delete('/:id/members/:memberId', async (req, res, next) => {
  try {
    const chartId = parseInt(req.params.id);
    const owns = await OrgChart.verifyChartOwnership(chartId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Org chart not found' });
    }

    const deleted = await OrgChart.deleteMember(parseInt(req.params.memberId), chartId);
    if (!deleted) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ message: 'Member deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
