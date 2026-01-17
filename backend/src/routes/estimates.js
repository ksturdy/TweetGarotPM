const express = require('express');
const { authenticate } = require('../middleware/auth');
const Estimate = require('../models/Estimate');
const EstimateSection = require('../models/EstimateSection');
const EstimateLineItem = require('../models/EstimateLineItem');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Get all estimates
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      estimator_id: req.query.estimator_id,
      customer_id: req.query.customer_id,
      search: req.query.search,
    };
    const estimates = await Estimate.findAll(filters);
    res.json(estimates);
  } catch (error) {
    next(error);
  }
});

// Get next estimate number
router.get('/next-number', async (req, res, next) => {
  try {
    const nextNumber = await Estimate.getNextEstimateNumber();
    res.json({ estimate_number: nextNumber });
  } catch (error) {
    next(error);
  }
});

// Get single estimate with sections and line items
router.get('/:id', async (req, res, next) => {
  try {
    const estimate = await Estimate.findById(req.params.id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const sections = await EstimateSection.findByEstimate(req.params.id);
    const lineItems = await EstimateLineItem.findByEstimate(req.params.id);

    // Group line items by section
    const sectionsWithItems = sections.map(section => ({
      ...section,
      items: lineItems.filter(item => item.section_id === section.id),
    }));

    res.json({
      ...estimate,
      sections: sectionsWithItems,
    });
  } catch (error) {
    next(error);
  }
});

// Create new estimate
router.post('/', async (req, res, next) => {
  try {
    const estimateData = {
      ...req.body,
      estimator_id: req.user.id,
      estimator_name: `${req.user.firstName} ${req.user.lastName}`,
      created_by: req.user.id,
    };

    // Get next estimate number if not provided
    if (!estimateData.estimate_number) {
      estimateData.estimate_number = await Estimate.getNextEstimateNumber();
    }

    const estimate = await Estimate.create(estimateData);

    // Create sections if provided
    if (req.body.sections && req.body.sections.length > 0) {
      for (const section of req.body.sections) {
        const createdSection = await EstimateSection.create({
          estimate_id: estimate.id,
          ...section,
        });

        // Create line items for this section if provided
        if (section.items && section.items.length > 0) {
          for (const item of section.items) {
            await EstimateLineItem.create({
              estimate_id: estimate.id,
              section_id: createdSection.id,
              ...item,
            });
          }
        }
      }
    }

    // Fetch complete estimate with sections and items
    const completeEstimate = await Estimate.findById(estimate.id);
    const sections = await EstimateSection.findByEstimate(estimate.id);
    const lineItems = await EstimateLineItem.findByEstimate(estimate.id);

    const sectionsWithItems = sections.map(section => ({
      ...section,
      items: lineItems.filter(item => item.section_id === section.id),
    }));

    res.status(201).json({
      ...completeEstimate,
      sections: sectionsWithItems,
    });
  } catch (error) {
    next(error);
  }
});

// Update estimate
router.put('/:id', async (req, res, next) => {
  try {
    const estimate = await Estimate.update(req.params.id, req.body);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.json(estimate);
  } catch (error) {
    next(error);
  }
});

// Update estimate status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const estimate = await Estimate.updateStatus(req.params.id, status, req.user.id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    res.json(estimate);
  } catch (error) {
    next(error);
  }
});

// Delete estimate
router.delete('/:id', async (req, res, next) => {
  try {
    await Estimate.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// --- SECTION ROUTES ---

// Get sections for an estimate
router.get('/:estimateId/sections', async (req, res, next) => {
  try {
    const sections = await EstimateSection.findByEstimate(req.params.estimateId);
    res.json(sections);
  } catch (error) {
    next(error);
  }
});

// Create section
router.post('/:estimateId/sections', async (req, res, next) => {
  try {
    const section = await EstimateSection.create({
      estimate_id: req.params.estimateId,
      ...req.body,
    });
    res.status(201).json(section);
  } catch (error) {
    next(error);
  }
});

// Update section
router.put('/sections/:id', async (req, res, next) => {
  try {
    const section = await EstimateSection.update(req.params.id, req.body);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    res.json(section);
  } catch (error) {
    next(error);
  }
});

// Delete section
router.delete('/sections/:id', async (req, res, next) => {
  try {
    await EstimateSection.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Reorder sections
router.patch('/:estimateId/sections/reorder', async (req, res, next) => {
  try {
    const { sectionOrders } = req.body;
    await EstimateSection.reorder(req.params.estimateId, sectionOrders);
    res.json({ message: 'Sections reordered successfully' });
  } catch (error) {
    next(error);
  }
});

// --- LINE ITEM ROUTES ---

// Get line items for an estimate
router.get('/:estimateId/items', async (req, res, next) => {
  try {
    const items = await EstimateLineItem.findByEstimate(req.params.estimateId);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Get line items for a section
router.get('/sections/:sectionId/items', async (req, res, next) => {
  try {
    const items = await EstimateLineItem.findBySection(req.params.sectionId);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Create line item
router.post('/:estimateId/items', async (req, res, next) => {
  try {
    const item = await EstimateLineItem.create({
      estimate_id: req.params.estimateId,
      ...req.body,
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

// Bulk create line items
router.post('/:estimateId/items/bulk', async (req, res, next) => {
  try {
    const { items } = req.body;
    const itemsWithEstimateId = items.map(item => ({
      estimate_id: req.params.estimateId,
      ...item,
    }));
    const createdItems = await EstimateLineItem.bulkCreate(itemsWithEstimateId);
    res.status(201).json(createdItems);
  } catch (error) {
    next(error);
  }
});

// Update line item
router.put('/items/:id', async (req, res, next) => {
  try {
    const item = await EstimateLineItem.update(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Line item not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Bulk update line items
router.put('/:estimateId/items/bulk', async (req, res, next) => {
  try {
    const { items } = req.body;
    const updatedItems = await EstimateLineItem.bulkUpdate(items);
    res.json(updatedItems);
  } catch (error) {
    next(error);
  }
});

// Delete line item
router.delete('/items/:id', async (req, res, next) => {
  try {
    await EstimateLineItem.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Reorder line items
router.patch('/sections/:sectionId/items/reorder', async (req, res, next) => {
  try {
    const { itemOrders } = req.body;
    await EstimateLineItem.reorder(req.params.sectionId, itemOrders);
    res.json({ message: 'Line items reordered successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
