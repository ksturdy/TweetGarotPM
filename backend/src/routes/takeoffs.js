const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const Takeoff = require('../models/Takeoff');
const ProductivityRate = require('../models/ProductivityRate');
const ProjectSystem = require('../models/ProjectSystem');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// Productivity rate lookup (must be before /:id routes)
router.get('/productivity-rates/lookup', async (req, res, next) => {
  try {
    const { fitting_type, join_type, pipe_diameter } = req.query;
    if (!fitting_type || !pipe_diameter) {
      return res.status(400).json({ error: 'fitting_type and pipe_diameter are required' });
    }
    const rate = await ProductivityRate.lookup(req.tenantId, fitting_type, join_type || null, pipe_diameter);
    if (!rate) {
      return res.json({ hours_per_unit: 0, unit: 'EA', found: false });
    }
    res.json({ ...rate, found: true });
  } catch (error) {
    next(error);
  }
});

// List all productivity rates
router.get('/productivity-rates', async (req, res, next) => {
  try {
    const rates = await ProductivityRate.findAll(req.tenantId, {
      fitting_type: req.query.fitting_type,
    });
    res.json(rates);
  } catch (error) {
    next(error);
  }
});

// Get next takeoff number
router.get('/next-number', async (req, res, next) => {
  try {
    const nextNumber = await Takeoff.getNextNumber(req.tenantId);
    res.json({ takeoff_number: nextNumber });
  } catch (error) {
    next(error);
  }
});

// Get all takeoffs
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      estimate_id: req.query.estimate_id,
      search: req.query.search,
    };
    const takeoffs = await Takeoff.findAll(filters, req.tenantId);
    res.json(takeoffs);
  } catch (error) {
    next(error);
  }
});

// Get single takeoff with items
router.get('/:id', async (req, res, next) => {
  try {
    const takeoff = await Takeoff.findByIdAndTenant(req.params.id, req.tenantId);
    if (!takeoff) {
      return res.status(404).json({ error: 'Takeoff not found' });
    }
    res.json(takeoff);
  } catch (error) {
    next(error);
  }
});

// Create takeoff
router.post('/', async (req, res, next) => {
  try {
    const { name, description, estimate_id, performance_factor, notes, takeoff_type, pipe_spec_id, estimator_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const takeoffNumber = await Takeoff.getNextNumber(req.tenantId);
    const takeoff = await Takeoff.create({
      tenantId: req.tenantId,
      takeoffNumber,
      name,
      description,
      estimateId: estimate_id,
      performanceFactor: performance_factor || 0,
      notes,
      createdBy: req.user.id,
      takeoffType: takeoff_type,
      pipeSpecId: pipe_spec_id,
      estimatorId: estimator_id,
    });

    res.status(201).json(takeoff);
  } catch (error) {
    next(error);
  }
});

// Update takeoff
router.put('/:id', async (req, res, next) => {
  try {
    const takeoff = await Takeoff.findByIdAndTenant(req.params.id, req.tenantId);
    if (!takeoff) {
      return res.status(404).json({ error: 'Takeoff not found' });
    }

    const updated = await Takeoff.update(req.params.id, req.body, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Update takeoff status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const takeoff = await Takeoff.findByIdAndTenant(req.params.id, req.tenantId);
    if (!takeoff) {
      return res.status(404).json({ error: 'Takeoff not found' });
    }

    const updated = await Takeoff.update(req.params.id, { status: req.body.status }, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete takeoff
router.delete('/:id', async (req, res, next) => {
  try {
    const takeoff = await Takeoff.findByIdAndTenant(req.params.id, req.tenantId);
    if (!takeoff) {
      return res.status(404).json({ error: 'Takeoff not found' });
    }

    await Takeoff.delete(req.params.id, req.tenantId);
    res.json({ message: 'Takeoff deleted' });
  } catch (error) {
    next(error);
  }
});

// Recalculate all items (when performance factor changes)
router.post('/:id/recalculate', async (req, res, next) => {
  try {
    const takeoff = await Takeoff.findByIdAndTenant(req.params.id, req.tenantId);
    if (!takeoff) {
      return res.status(404).json({ error: 'Takeoff not found' });
    }

    const items = await Takeoff.recalculateItems(req.params.id, takeoff.performance_factor);
    // Re-fetch to get updated totals
    const updated = await Takeoff.findByIdAndTenant(req.params.id, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// --- Takeoff Items ---

// Get items for a takeoff
router.get('/:id/items', async (req, res, next) => {
  try {
    const items = await Takeoff.getItems(req.params.id);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Add item to takeoff
router.post('/:id/items', async (req, res, next) => {
  try {
    const takeoff = await Takeoff.findByIdAndTenant(req.params.id, req.tenantId);
    if (!takeoff) {
      return res.status(404).json({ error: 'Takeoff not found' });
    }

    const { sort_order, fitting_type, size, join_type, quantity, base_hours_per_unit, base_hours_total, adjusted_hours, material_unit_cost, material_cost, remarks } = req.body;

    const item = await Takeoff.addItem(req.params.id, {
      sortOrder: sort_order,
      fittingType: fitting_type,
      size,
      joinType: join_type,
      quantity,
      baseHoursPerUnit: base_hours_per_unit,
      baseHoursTotal: base_hours_total,
      adjustedHours: adjusted_hours,
      materialUnitCost: material_unit_cost,
      materialCost: material_cost,
      remarks,
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

// Update item
router.put('/:id/items/:itemId', async (req, res, next) => {
  try {
    const item = await Takeoff.updateItem(req.params.itemId, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Delete item
router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    await Takeoff.deleteItem(req.params.itemId);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Project Systems (per-takeoff) ───

router.get('/:id/systems', async (req, res, next) => {
  try {
    const systems = await ProjectSystem.findByTakeoff(req.params.id, req.tenantId);
    res.json(systems);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/systems', async (req, res, next) => {
  try {
    const takeoff = await Takeoff.findByIdAndTenant(req.params.id, req.tenantId);
    if (!takeoff) {
      return res.status(404).json({ error: 'Takeoff not found' });
    }
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const system = await ProjectSystem.create(req.params.id, req.tenantId, req.body);
    res.status(201).json(system);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/systems/:sysId', async (req, res, next) => {
  try {
    const system = await ProjectSystem.update(req.params.sysId, req.tenantId, req.body);
    if (!system) {
      return res.status(404).json({ error: 'Project system not found' });
    }
    res.json(system);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/systems/:sysId', async (req, res, next) => {
  try {
    const deleted = await ProjectSystem.delete(req.params.sysId, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Project system not found' });
    }
    res.json({ message: 'Project system deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
