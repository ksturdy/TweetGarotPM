const express = require('express');
const { body, validationResult } = require('express-validator');
const FieldPurchaseOrder = require('../models/FieldPurchaseOrder');
const Project = require('../models/Project');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId || req.body.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

// Get FPOs for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status };
    const orders = await FieldPurchaseOrder.findByProject(req.params.projectId, filters);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Get project totals
router.get('/project/:projectId/totals', verifyProjectOwnership, async (req, res, next) => {
  try {
    const totals = await FieldPurchaseOrder.getProjectTotals(req.params.projectId);
    res.json(totals);
  } catch (error) {
    next(error);
  }
});

// Get single FPO with items
router.get('/:id', async (req, res, next) => {
  try {
    const order = await FieldPurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const project = await Project.findByIdAndTenant(order.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const items = await FieldPurchaseOrder.getItems(req.params.id);
    res.json({ ...order, items });
  } catch (error) {
    next(error);
  }
});

// Create FPO
router.post(
  '/',
  [
    body('project_id').isInt(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const projectId = req.body.project_id || req.body.projectId;
      const number = await FieldPurchaseOrder.getNextNumber(projectId);
      const order = await FieldPurchaseOrder.create({
        projectId,
        tenantId: req.tenantId,
        number,
        vendorId: req.body.vendor_id,
        vendorName: req.body.vendor_name,
        vendorContact: req.body.vendor_contact,
        vendorPhone: req.body.vendor_phone,
        vendorEmail: req.body.vendor_email,
        description: req.body.description,
        deliveryDate: req.body.delivery_date,
        deliveryLocation: req.body.delivery_location,
        shippingMethod: req.body.shipping_method,
        subtotal: req.body.subtotal,
        taxRate: req.body.tax_rate,
        taxAmount: req.body.tax_amount,
        shippingCost: req.body.shipping_cost,
        total: req.body.total,
        costCode: req.body.cost_code,
        phaseCode: req.body.phase_code,
        notes: req.body.notes,
        createdBy: req.user.id,
      });
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Update FPO
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await FieldPurchaseOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const order = await FieldPurchaseOrder.update(req.params.id, req.body);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Submit for approval
router.post('/:id/submit', async (req, res, next) => {
  try {
    const existing = await FieldPurchaseOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const order = await FieldPurchaseOrder.update(req.params.id, { status: 'submitted' });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Approve
router.post('/:id/approve', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const existing = await FieldPurchaseOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const order = await FieldPurchaseOrder.approve(req.params.id, { approvedBy: req.user.id });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Delete (draft only)
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await FieldPurchaseOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft purchase orders can be deleted' });
    }
    await FieldPurchaseOrder.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Add line item
router.post(
  '/:id/items',
  [body('description').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const existing = await FieldPurchaseOrder.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
      const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
      const item = await FieldPurchaseOrder.addItem(req.params.id, req.body);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Update line item
router.put('/:id/items/:itemId', async (req, res, next) => {
  try {
    const existing = await FieldPurchaseOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const item = await FieldPurchaseOrder.updateItem(req.params.itemId, req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Delete line item
router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const existing = await FieldPurchaseOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    await FieldPurchaseOrder.deleteItem(req.params.itemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
