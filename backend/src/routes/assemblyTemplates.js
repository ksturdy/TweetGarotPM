const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const AssemblyTemplate = require('../models/AssemblyTemplate');
const AssemblyInstance = require('../models/AssemblyInstance');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// ─── Assembly Templates (tenant-scoped) ───

// List all templates
router.get('/', async (req, res, next) => {
  try {
    const templates = await AssemblyTemplate.findAll(req.tenantId, {
      category: req.query.category,
    });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// Get distinct categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await AssemblyTemplate.getCategories(req.tenantId);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// Get single template
router.get('/:id', async (req, res, next) => {
  try {
    const template = await AssemblyTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Assembly template not found' });
    }
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// Create template
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const template = await AssemblyTemplate.create({
      tenant_id: req.tenantId,
      created_by: req.user.id,
      ...req.body,
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

// Update template
router.put('/:id', async (req, res, next) => {
  try {
    const template = await AssemblyTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Assembly template not found' });
    }

    const updated = await AssemblyTemplate.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Duplicate template
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const duplicate = await AssemblyTemplate.duplicate(req.params.id, req.body.name);
    if (!duplicate) {
      return res.status(404).json({ error: 'Assembly template not found' });
    }
    res.status(201).json(duplicate);
  } catch (error) {
    next(error);
  }
});

// Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await AssemblyTemplate.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Assembly template not found' });
    }
    res.json({ message: 'Assembly template deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Assembly Instances (scoped under takeoffs) ───
// These are mounted separately as sub-routes of takeoffs

const instanceRouter = express.Router({ mergeParams: true });

instanceRouter.use(authenticate);
instanceRouter.use(tenantContext);
instanceRouter.use(requireFeature('estimates'));

// List instances for a takeoff
instanceRouter.get('/', async (req, res, next) => {
  try {
    const { document_id, page_number } = req.query;
    let instances;

    if (document_id && page_number !== undefined) {
      instances = await AssemblyInstance.findByDocumentPage(parseInt(document_id), parseInt(page_number));
    } else {
      instances = await AssemblyInstance.findByTakeoff(req.params.takeoffId);
    }

    res.json(instances);
  } catch (error) {
    next(error);
  }
});

// Get single instance
instanceRouter.get('/:instId', async (req, res, next) => {
  try {
    const instance = await AssemblyInstance.findById(req.params.instId);
    if (!instance) {
      return res.status(404).json({ error: 'Assembly instance not found' });
    }
    res.json(instance);
  } catch (error) {
    next(error);
  }
});

// Create instance
instanceRouter.post('/', async (req, res, next) => {
  try {
    const { assembly_template_id } = req.body;
    if (!assembly_template_id) {
      return res.status(400).json({ error: 'assembly_template_id is required' });
    }

    const instance = await AssemblyInstance.create({
      tenant_id: req.tenantId,
      takeoff_id: parseInt(req.params.takeoffId),
      ...req.body,
    });

    res.status(201).json(instance);
  } catch (error) {
    next(error);
  }
});

// Update instance
instanceRouter.put('/:instId', async (req, res, next) => {
  try {
    const updated = await AssemblyInstance.update(req.params.instId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Assembly instance not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete instance
instanceRouter.delete('/:instId', async (req, res, next) => {
  try {
    const deleted = await AssemblyInstance.delete(req.params.instId);
    if (!deleted) {
      return res.status(404).json({ error: 'Assembly instance not found' });
    }
    res.json({ message: 'Assembly instance deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = { templateRouter: router, instanceRouter };
