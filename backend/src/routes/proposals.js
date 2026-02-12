const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Apply middleware to all routes
router.use(authenticate);
router.use(tenantContext);

// GET /api/proposals - List all proposals with filters
router.get('/', async (req, res, next) => {
  try {
    const filters = {};

    if (req.query.status) filters.status = req.query.status;
    if (req.query.customer_id) filters.customer_id = parseInt(req.query.customer_id);
    if (req.query.opportunity_id) filters.opportunity_id = parseInt(req.query.opportunity_id);
    if (req.query.created_by) filters.created_by = parseInt(req.query.created_by);
    if (req.query.is_latest !== undefined) filters.is_latest = req.query.is_latest === 'true';

    const proposals = await Proposal.findAllByTenant(req.tenantId, filters);
    res.json(proposals);
  } catch (error) {
    next(error);
  }
});

// GET /api/proposals/:id - Get single proposal with full details
router.get('/:id', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(
      parseInt(req.params.id),
      req.tenantId
    );

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(proposal);
  } catch (error) {
    next(error);
  }
});

// POST /api/proposals - Create new proposal
router.post('/', async (req, res, next) => {
  try {
    const proposal = await Proposal.create(req.body, req.user.id, req.tenantId);
    res.status(201).json(proposal);
  } catch (error) {
    next(error);
  }
});

// POST /api/proposals/from-template - Create proposal from template
router.post('/from-template', async (req, res, next) => {
  try {
    const { templateId, ...proposalData } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    const proposal = await Proposal.createFromTemplate(
      parseInt(templateId),
      proposalData,
      req.user.id,
      req.tenantId
    );

    res.status(201).json(proposal);
  } catch (error) {
    next(error);
  }
});

// PUT /api/proposals/:id - Update proposal
router.put('/:id', async (req, res, next) => {
  try {
    const proposal = await Proposal.update(
      parseInt(req.params.id),
      req.body,
      req.tenantId
    );
    res.json(proposal);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/proposals/:id/status - Update proposal status (workflow)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const proposal = await Proposal.updateStatus(
      parseInt(req.params.id),
      status,
      req.user.id,
      req.tenantId
    );

    res.json(proposal);
  } catch (error) {
    if (error.message.includes('Invalid status transition')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// POST /api/proposals/:id/revise - Create new version/revision
router.post('/:id/revise', async (req, res, next) => {
  try {
    const revision = await Proposal.createRevision(
      parseInt(req.params.id),
      req.user.id,
      req.tenantId
    );
    res.status(201).json(revision);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/proposals/:id - Delete proposal
router.delete('/:id', async (req, res, next) => {
  try {
    await Proposal.delete(parseInt(req.params.id), req.tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/proposals/:id/sections - Get proposal sections
router.get('/:id/sections', async (req, res, next) => {
  try {
    // Verify proposal belongs to tenant
    const proposal = await Proposal.findByIdAndTenant(
      parseInt(req.params.id),
      req.tenantId
    );

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const sections = await Proposal.getSections(parseInt(req.params.id));
    res.json(sections);
  } catch (error) {
    next(error);
  }
});

// PUT /api/proposals/:id/sections/:sectionId - Update section
router.put('/:id/sections/:sectionId', async (req, res, next) => {
  try {
    // Verify proposal belongs to tenant
    const proposal = await Proposal.findByIdAndTenant(
      parseInt(req.params.id),
      req.tenantId
    );

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const section = await Proposal.updateSection(
      parseInt(req.params.sectionId),
      req.body
    );

    res.json(section);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
