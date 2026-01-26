const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { getPresignedUrl, deleteFile, getFileUrl } = require('../utils/fileStorage');
const { parseBidForm, mapToEstimateFormat, getSheetNames } = require('../services/bidFormParser');
const Estimate = require('../models/Estimate');
const EstimateSection = require('../models/EstimateSection');
const EstimateLineItem = require('../models/EstimateLineItem');

const router = express.Router();

// Configure upload middleware for Excel bid forms
const bidFormUpload = createUploadMiddleware({
  destination: 'estimates/bid-forms',
  allowedExtensions: ['.xlsm', '.xlsx', '.xls'],
  allowedTypes: [
    'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/octet-stream', // Sometimes sent by browsers for .xlsm
  ],
  maxSize: 50 * 1024 * 1024, // 50MB max
});

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

// --- BID FORM ROUTES ---

// Upload bid form Excel file and populate estimate
router.post('/:id/bid-form', bidFormUpload.single('bidForm'), async (req, res, next) => {
  try {
    const estimateId = req.params.id;

    // Verify estimate belongs to tenant
    const estimate = await Estimate.findByIdAndTenant(estimateId, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('=== BID FORM UPLOAD ===');
    console.log('Estimate ID:', estimateId);
    console.log('File:', req.file.originalname);
    console.log('Path/Key:', req.file.key || req.file.path);

    // Delete old bid form file if exists
    if (estimate.bid_form_path) {
      try {
        await deleteFile(estimate.bid_form_path);
      } catch (err) {
        console.warn('Could not delete old bid form:', err.message);
      }
    }

    // Read and parse the uploaded file
    const fs = require('fs');
    const { getR2Client, isR2Enabled } = require('../config/r2Client');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const config = require('../config');

    let fileBuffer;
    if (isR2Enabled()) {
      // Read from R2
      const r2Client = getR2Client();
      const command = new GetObjectCommand({
        Bucket: config.r2.bucketName,
        Key: req.file.key,
      });
      const response = await r2Client.send(command);
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      fileBuffer = Buffer.concat(chunks);
    } else {
      // Read from local filesystem
      fileBuffer = fs.readFileSync(req.file.path);
    }

    // Parse the Excel file
    const parsedData = parseBidForm(fileBuffer);

    if (parsedData.errors.length > 0) {
      console.warn('Bid form parse warnings:', parsedData.errors);
    }

    // Map parsed data to estimate format
    const { estimate: estimateUpdates, sections } = mapToEstimateFormat(parsedData);

    // Update estimate with parsed data and file info
    const updatedEstimate = await Estimate.update(estimateId, {
      ...estimateUpdates,
      bid_form_path: req.file.key || req.file.path,
      bid_form_filename: req.file.originalname,
      bid_form_uploaded_at: new Date(),
      bid_form_version: (estimate.bid_form_version || 0) + 1,
      build_method: 'excel_import',
    }, req.tenantId);

    // Delete existing sections and line items
    const existingSections = await EstimateSection.findByEstimate(estimateId);
    for (const section of existingSections) {
      await EstimateSection.delete(section.id);
    }

    // Create new sections and line items from parsed data
    for (const section of sections) {
      const createdSection = await EstimateSection.create({
        estimate_id: estimateId,
        section_name: section.section_name,
        section_order: section.section_order,
        description: section.description,
      });

      // Create line items for this section
      for (const item of section.line_items) {
        await EstimateLineItem.create({
          estimate_id: estimateId,
          section_id: createdSection.id,
          ...item,
        });
      }
    }

    // Fetch complete updated estimate
    const completeEstimate = await Estimate.findByIdAndTenant(estimateId, req.tenantId);
    const newSections = await EstimateSection.findByEstimate(estimateId);
    const lineItems = await EstimateLineItem.findByEstimate(estimateId);

    const sectionsWithItems = newSections.map(section => ({
      ...section,
      items: lineItems.filter(item => item.section_id === section.id),
    }));

    console.log('=== BID FORM UPLOAD COMPLETE ===');
    console.log('Sections created:', newSections.length);
    console.log('Line items created:', lineItems.length);
    console.log('Total cost:', completeEstimate.total_cost);

    res.json({
      ...completeEstimate,
      sections: sectionsWithItems,
      parseSummary: {
        sectionsImported: sections.length,
        lineItemsImported: sections.reduce((sum, s) => sum + s.line_items.length, 0),
        warnings: parsedData.errors,
      },
    });
  } catch (error) {
    console.error('Bid form upload error:', error);
    next(error);
  }
});

// Download bid form file - returns download info/URL
router.get('/:id/bid-form/download', async (req, res, next) => {
  try {
    const estimate = await Estimate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (!estimate.bid_form_path) {
      return res.status(404).json({ error: 'No bid form attached to this estimate' });
    }

    const { isR2Enabled } = require('../config/r2Client');

    let downloadUrl;
    if (isR2Enabled()) {
      // Generate presigned URL for R2 download
      downloadUrl = await getPresignedUrl(estimate.bid_form_path, 3600); // 1 hour expiry
    } else {
      // Return URL to file serving endpoint for local storage
      downloadUrl = `/api/estimates/${req.params.id}/bid-form/file`;
    }

    res.json({
      downloadUrl,
      filename: estimate.bid_form_filename,
      uploadedAt: estimate.bid_form_uploaded_at,
      version: estimate.bid_form_version,
    });
  } catch (error) {
    next(error);
  }
});

// Serve bid form file directly (for local storage)
router.get('/:id/bid-form/file', async (req, res, next) => {
  try {
    const estimate = await Estimate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (!estimate.bid_form_path) {
      return res.status(404).json({ error: 'No bid form attached to this estimate' });
    }

    const path = require('path');
    const fs = require('fs');

    // bid_form_path is already absolute for local storage
    const filePath = path.isAbsolute(estimate.bid_form_path)
      ? estimate.bid_form_path
      : path.join(__dirname, '../../', estimate.bid_form_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Bid form file not found on disk' });
    }

    res.download(filePath, estimate.bid_form_filename);
  } catch (error) {
    next(error);
  }
});

// Get bid form info without downloading
router.get('/:id/bid-form', async (req, res, next) => {
  try {
    const estimate = await Estimate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (!estimate.bid_form_path) {
      return res.json({
        hasBidForm: false,
      });
    }

    res.json({
      hasBidForm: true,
      filename: estimate.bid_form_filename,
      uploadedAt: estimate.bid_form_uploaded_at,
      version: estimate.bid_form_version,
      buildMethod: estimate.build_method,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh estimate values from current bid form (re-parse without re-uploading)
router.post('/:id/bid-form/refresh', async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const estimate = await Estimate.findByIdAndTenant(estimateId, req.tenantId);

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (!estimate.bid_form_path) {
      return res.status(400).json({ error: 'No bid form attached to this estimate' });
    }

    // Read the file from storage
    const { getR2Client, isR2Enabled } = require('../config/r2Client');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const config = require('../config');
    const fs = require('fs');

    let fileBuffer;
    if (isR2Enabled()) {
      const r2Client = getR2Client();
      const command = new GetObjectCommand({
        Bucket: config.r2.bucketName,
        Key: estimate.bid_form_path,
      });
      const response = await r2Client.send(command);
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      fileBuffer = Buffer.concat(chunks);
    } else {
      const path = require('path');
      // bid_form_path is already absolute for local storage
      const fullPath = path.isAbsolute(estimate.bid_form_path)
        ? estimate.bid_form_path
        : path.join(__dirname, '../../', estimate.bid_form_path);
      fileBuffer = fs.readFileSync(fullPath);
    }

    // Re-parse the Excel file
    const parsedData = parseBidForm(fileBuffer);
    const { estimate: estimateUpdates, sections } = mapToEstimateFormat(parsedData);

    // Update estimate values
    await Estimate.update(estimateId, estimateUpdates, req.tenantId);

    // Delete and recreate sections/line items
    const existingSections = await EstimateSection.findByEstimate(estimateId);
    for (const section of existingSections) {
      await EstimateSection.delete(section.id);
    }

    for (const section of sections) {
      const createdSection = await EstimateSection.create({
        estimate_id: estimateId,
        section_name: section.section_name,
        section_order: section.section_order,
        description: section.description,
      });

      for (const item of section.line_items) {
        await EstimateLineItem.create({
          estimate_id: estimateId,
          section_id: createdSection.id,
          ...item,
        });
      }
    }

    // Fetch complete updated estimate
    const completeEstimate = await Estimate.findByIdAndTenant(estimateId, req.tenantId);
    const newSections = await EstimateSection.findByEstimate(estimateId);
    const lineItems = await EstimateLineItem.findByEstimate(estimateId);

    const sectionsWithItems = newSections.map(section => ({
      ...section,
      items: lineItems.filter(item => item.section_id === section.id),
    }));

    res.json({
      ...completeEstimate,
      sections: sectionsWithItems,
      refreshedAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// Delete bid form attachment
router.delete('/:id/bid-form', async (req, res, next) => {
  try {
    const estimate = await Estimate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (!estimate.bid_form_path) {
      return res.status(404).json({ error: 'No bid form attached to this estimate' });
    }

    // Delete the file from storage
    await deleteFile(estimate.bid_form_path);

    // Clear bid form fields on estimate
    await Estimate.update(req.params.id, {
      bid_form_path: null,
      bid_form_filename: null,
      bid_form_uploaded_at: null,
      build_method: 'manual',
    }, req.tenantId);

    res.json({ message: 'Bid form deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Preview bid form parsing without saving (for validation)
router.post('/:id/bid-form/preview', bidFormUpload.single('bidForm'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the file
    const fs = require('fs');
    const { getR2Client, isR2Enabled } = require('../config/r2Client');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const config = require('../config');

    let fileBuffer;
    if (isR2Enabled()) {
      const r2Client = getR2Client();
      const command = new GetObjectCommand({
        Bucket: config.r2.bucketName,
        Key: req.file.key,
      });
      const response = await r2Client.send(command);
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      fileBuffer = Buffer.concat(chunks);

      // Delete the preview file from R2
      await deleteFile(req.file.key);
    } else {
      fileBuffer = fs.readFileSync(req.file.path);
      // Delete local preview file
      fs.unlinkSync(req.file.path);
    }

    // Get sheet names
    const sheetNames = getSheetNames(fileBuffer);

    // Parse the file
    const parsedData = parseBidForm(fileBuffer);
    const { estimate, sections } = mapToEstimateFormat(parsedData);

    res.json({
      filename: req.file.originalname,
      sheetNames,
      projectInfo: parsedData.projectInfo,
      summary: parsedData.summary,
      markupPercentages: parsedData.markupPercentages,
      sectionCount: sections.length,
      lineItemCount: sections.reduce((sum, s) => sum + s.line_items.length, 0),
      sections: sections.map(s => ({
        name: s.section_name,
        itemCount: s.line_items.length,
        laborCost: s.labor_cost,
        materialCost: s.material_cost,
      })),
      warnings: parsedData.errors,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
