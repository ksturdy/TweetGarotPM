const express = require('express');
const PlumbingDesign = require('../models/PlumbingDesign');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();
router.use(authenticate);
router.use(tenantContext);

// List all designs for tenant
router.get('/', async (req, res, next) => {
  try {
    const designs = await PlumbingDesign.findByTenant(req.tenantId);
    res.json(designs);
  } catch (err) {
    next(err);
  }
});

// Get single design
router.get('/:id', async (req, res, next) => {
  try {
    const design = await PlumbingDesign.findById(req.params.id, req.tenantId);
    if (!design) return res.status(404).json({ error: 'Not found' });
    res.json(design);
  } catch (err) {
    next(err);
  }
});

// Create design
router.post('/', async (req, res, next) => {
  try {
    const { name, hubNumber, projectId, designData } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const design = await PlumbingDesign.create({
      tenantId: req.tenantId,
      name,
      hubNumber,
      projectId,
      createdBy: req.user.id,
      designData,
    });
    res.status(201).json(design);
  } catch (err) {
    next(err);
  }
});

// Update design
router.put('/:id', async (req, res, next) => {
  try {
    const { name, hubNumber, projectId, designData } = req.body;
    const design = await PlumbingDesign.update(req.params.id, req.tenantId, {
      name, hubNumber, projectId, designData,
    });
    if (!design) return res.status(404).json({ error: 'Not found' });
    res.json(design);
  } catch (err) {
    next(err);
  }
});

// Delete design
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await PlumbingDesign.delete(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
