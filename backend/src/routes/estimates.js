const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const Estimate = require('../models/Estimate');
const EstimateSection = require('../models/EstimateSection');
const EstimateLineItem = require('../models/EstimateLineItem');

const router = express.Router();

// Apply auth and tenant middleware to all routes
router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// Get all estimates
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      estimator_id: req.query.estimator_id,
      customer_id: req.query.customer_id,
      search: req.query.search,
    };
    const estimates = await Estimate.findAll(filters, req.tenantId);

    console.log('=== ESTIMATES LIST DEBUG ===');
    estimates.forEach(est => {
      console.log(`${est.estimate_number}: total_cost=${est.total_cost}, subtotal=${est.subtotal}`);
    });
    console.log('===========================');

    res.json(estimates);
  } catch (error) {
    next(error);
  }
});

// Get next estimate number
router.get('/next-number', async (req, res, next) => {
  try {
    const nextNumber = await Estimate.getNextEstimateNumber(req.tenantId);
    res.json({ estimate_number: nextNumber });
  } catch (error) {
    next(error);
  }
});

// Get single estimate with sections and line items
router.get('/:id', async (req, res, next) => {
  try {
    const estimate = await Estimate.findByIdAndTenant(req.params.id, req.tenantId);
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

    console.log('=== GET ESTIMATE DEBUG ===');
    console.log('Estimate ID:', req.params.id);
    console.log('Estimate Number:', estimate.estimate_number);
    console.log('Total Cost from DB:', estimate.total_cost);
    console.log('Subtotal from DB:', estimate.subtotal);
    console.log('===========================');

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
      estimateData.estimate_number = await Estimate.getNextEstimateNumber(req.tenantId);
    }

    const estimate = await Estimate.create(estimateData, req.tenantId);

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
    const completeEstimate = await Estimate.findByIdAndTenant(estimate.id, req.tenantId);
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
    console.log('=== PUT ESTIMATE START ===');
    console.log('Estimate ID:', req.params.id);
    console.log('Has sections in request?', !!req.body.sections);
    console.log('Sections length:', req.body.sections?.length);
    console.log('===========================');

    // Verify estimate belongs to tenant
    const existingEstimate = await Estimate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existingEstimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Update estimate header
    const estimate = await Estimate.update(req.params.id, req.body, req.tenantId);

    // Update sections if provided
    if (req.body.sections && req.body.sections.length > 0) {
      // Get existing sections
      const existingSections = await EstimateSection.findByEstimate(req.params.id);
      const existingSectionIds = existingSections.map(s => s.id);

      // Track which sections are in the update
      const updatedSectionIds = [];

      for (const section of req.body.sections) {
        let createdSection;
        if (section.id && existingSectionIds.includes(section.id)) {
          // Update existing section
          await EstimateSection.update(section.id, section);
          createdSection = { id: section.id };
          updatedSectionIds.push(section.id);
        } else {
          // Create new section
          createdSection = await EstimateSection.create({
            estimate_id: req.params.id,
            ...section,
          });
          updatedSectionIds.push(createdSection.id);
        }

        // Handle line items for this section
        if (section.items && section.items.length > 0) {
          // Get existing items for this section
          const existingItems = await EstimateLineItem.findBySection(createdSection.id);
          const existingItemIds = existingItems.map(item => item.id);
          const updatedItemIds = [];

          for (const item of section.items) {
            if (item.id && existingItemIds.includes(item.id)) {
              // Update existing item
              await EstimateLineItem.update(item.id, item);
              updatedItemIds.push(item.id);
            } else {
              // Create new item
              const createdItem = await EstimateLineItem.create({
                estimate_id: req.params.id,
                section_id: createdSection.id,
                ...item,
              });
              updatedItemIds.push(createdItem.id);
            }
          }

          // Delete items that were removed
          const itemsToDelete = existingItemIds.filter(id => !updatedItemIds.includes(id));
          for (const itemId of itemsToDelete) {
            await EstimateLineItem.delete(itemId);
          }
        } else {
          // No items provided, delete all existing items for this section
          const existingItems = await EstimateLineItem.findBySection(createdSection.id);
          for (const item of existingItems) {
            await EstimateLineItem.delete(item.id);
          }
        }
      }

      // Delete sections that were removed
      const sectionsToDelete = existingSectionIds.filter(id => !updatedSectionIds.includes(id));
      for (const sectionId of sectionsToDelete) {
        await EstimateSection.delete(sectionId);
      }
    }

    // Fetch complete estimate with updated totals
    const completeEstimate = await Estimate.findByIdAndTenant(req.params.id, req.tenantId);
    const sections = await EstimateSection.findByEstimate(req.params.id);
    const lineItems = await EstimateLineItem.findByEstimate(req.params.id);

    const sectionsWithItems = sections.map(section => ({
      ...section,
      items: lineItems.filter(item => item.section_id === section.id),
    }));

    console.log('=== ESTIMATE UPDATE DEBUG ===');
    console.log('Estimate ID:', req.params.id);
    console.log('Estimate Number:', completeEstimate.estimate_number);
    console.log('Total Cost from DB:', completeEstimate.total_cost);
    console.log('Subtotal from DB:', completeEstimate.subtotal);
    console.log('Labor Cost from DB:', completeEstimate.labor_cost);
    console.log('Material Cost from DB:', completeEstimate.material_cost);
    console.log('Number of Sections:', sections.length);
    console.log('Number of Line Items:', lineItems.length);
    console.log('===========================');

    res.json({
      ...completeEstimate,
      sections: sectionsWithItems,
    });
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

    const estimate = await Estimate.updateStatus(req.params.id, status, req.user.id, req.tenantId);
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
    const deleted = await Estimate.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// --- SECTION ROUTES ---

// Get sections for an estimate
router.get('/:estimateId/sections', async (req, res, next) => {
  try {
    // Verify estimate belongs to tenant
    const estimate = await Estimate.findByIdAndTenant(req.params.estimateId, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    const sections = await EstimateSection.findByEstimate(req.params.estimateId);
    res.json(sections);
  } catch (error) {
    next(error);
  }
});

// Create section
router.post('/:estimateId/sections', async (req, res, next) => {
  try {
    // Verify estimate belongs to tenant
    const estimate = await Estimate.findByIdAndTenant(req.params.estimateId, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
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
    // Verify estimate belongs to tenant
    const estimate = await Estimate.findByIdAndTenant(req.params.estimateId, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
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
    // Verify estimate belongs to tenant
    const estimate = await Estimate.findByIdAndTenant(req.params.estimateId, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
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
    // Verify estimate belongs to tenant
    const estimate = await Estimate.findByIdAndTenant(req.params.estimateId, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
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
    // Verify estimate belongs to tenant
    const estimate = await Estimate.findByIdAndTenant(req.params.estimateId, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
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
    // Verify estimate belongs to tenant
    const estimate = await Estimate.findByIdAndTenant(req.params.estimateId, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
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
