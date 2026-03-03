const express = require('express');
const { body, validationResult } = require('express-validator');
const SmFittingOrder = require('../models/SmFittingOrder');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
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

// Verify order exists and belongs to tenant
const verifyOrderOwnership = async (req, res, next) => {
  try {
    const order = await SmFittingOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const project = await Project.findByIdAndTenant(order.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    req.order = order;
    next();
  } catch (error) {
    next(error);
  }
};

// Get orders for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status, priority: req.query.priority };
    const orders = await SmFittingOrder.findByProject(req.params.projectId, filters);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Get project stats
router.get('/project/:projectId/stats', verifyProjectOwnership, async (req, res, next) => {
  try {
    const stats = await SmFittingOrder.getProjectStats(req.params.projectId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get single order (with items)
router.get('/:id', verifyOrderOwnership, async (req, res, next) => {
  try {
    res.json(req.order);
  } catch (error) {
    next(error);
  }
});

// Create order
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
      const number = await SmFittingOrder.getNextNumber(projectId);
      const order = await SmFittingOrder.create({
        projectId,
        tenantId: req.tenantId,
        number,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        requiredByDate: req.body.required_by_date,
        drawingNumber: req.body.drawing_number,
        drawingRevision: req.body.drawing_revision,
        specSection: req.body.spec_section,
        locationOnSite: req.body.location_on_site,
        materialType: req.body.material_type,
        materialGauge: req.body.material_gauge,
        ductType: req.body.duct_type,
        dimensions: req.body.dimensions,
        insulationRequired: req.body.insulation_required,
        insulationSpec: req.body.insulation_spec,
        linerRequired: req.body.liner_required,
        quantity: req.body.quantity,
        unit: req.body.unit,
        costCode: req.body.cost_code,
        phaseCode: req.body.phase_code,
        notes: req.body.notes,
        createdBy: req.user.id,
        // New header fields
        requestedBy: req.body.requested_by,
        dateRequired: req.body.date_required,
        material: req.body.material,
        staticPressureClass: req.body.static_pressure_class,
        longitudinalSeam: req.body.longitudinal_seam,
        preparedBy: req.body.prepared_by,
        laborPhaseCode: req.body.labor_phase_code,
        materialPhaseCode: req.body.material_phase_code,
      });
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Update order
router.put('/:id', verifyOrderOwnership, async (req, res, next) => {
  try {
    const order = await SmFittingOrder.update(req.params.id, req.body);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Submit to shop
router.post('/:id/submit', verifyOrderOwnership, async (req, res, next) => {
  try {
    const order = await SmFittingOrder.update(req.params.id, { status: 'submitted' });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Update fabrication status
router.post('/:id/update-status', verifyOrderOwnership, async (req, res, next) => {
  try {
    const order = await SmFittingOrder.update(req.params.id, req.body);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Delete (draft only)
router.delete('/:id', verifyOrderOwnership, async (req, res, next) => {
  try {
    if (req.order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be deleted' });
    }
    await SmFittingOrder.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// --- Line item routes ---

// Add line item to order
router.post('/:id/items', verifyOrderOwnership, async (req, res, next) => {
  try {
    const item = await SmFittingOrder.addItem(req.params.id, {
      sortOrder: req.body.sort_order,
      quantity: req.body.quantity,
      fittingType: req.body.fitting_type,
      dimA: req.body.dim_a,
      dimB: req.body.dim_b,
      dimC: req.body.dim_c,
      dimD: req.body.dim_d,
      dimE: req.body.dim_e,
      dimF: req.body.dim_f,
      dimL: req.body.dim_l,
      dimR: req.body.dim_r,
      dimX: req.body.dim_x,
      gauge: req.body.gauge,
      liner: req.body.liner,
      connection: req.body.connection,
      remarks: req.body.remarks,
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

// Update line item
router.put('/:id/items/:itemId', verifyOrderOwnership, async (req, res, next) => {
  try {
    const existing = await SmFittingOrder.findItemById(req.params.itemId);
    if (!existing || existing.fitting_order_id !== parseInt(req.params.id)) {
      return res.status(404).json({ error: 'Line item not found' });
    }
    const item = await SmFittingOrder.updateItem(req.params.itemId, req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Delete line item
router.delete('/:id/items/:itemId', verifyOrderOwnership, async (req, res, next) => {
  try {
    const existing = await SmFittingOrder.findItemById(req.params.itemId);
    if (!existing || existing.fitting_order_id !== parseInt(req.params.id)) {
      return res.status(404).json({ error: 'Line item not found' });
    }
    await SmFittingOrder.deleteItem(req.params.itemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
