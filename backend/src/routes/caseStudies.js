const express = require('express');
const router = express.Router();
const CaseStudy = require('../models/CaseStudy');
const CaseStudyImage = require('../models/CaseStudyImage');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { getFileInfo, deleteFile, getFileUrl } = require('../utils/fileStorage');
const CaseStudyTemplate = require('../models/CaseStudyTemplate');
const { generateCaseStudyPdfHtml } = require('../utils/caseStudyPdfGenerator');
const { generateCaseStudyPdfBuffer } = require('../utils/caseStudyPdfBuffer');
const { fetchLogoBase64 } = require('../utils/logoFetcher');

// Configure upload middleware for case study images
const caseStudyImageUpload = createUploadMiddleware({
  destination: 'uploads/case-studies',
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxSize: 10 * 1024 * 1024, // 10MB
});

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

/**
 * GET /api/case-studies
 * List all case studies (tenant-scoped, filterable)
 */
router.get('/', async (req, res) => {
  try {
    const { status, featured, market, customer_id, project_id } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (featured !== undefined) filters.featured = featured === 'true';
    if (market) filters.market = market;
    if (customer_id) filters.customer_id = parseInt(customer_id);
    if (project_id) filters.project_id = parseInt(project_id);

    const caseStudies = await CaseStudy.findAllByTenant(req.tenantId, filters);

    // Resolve hero image URLs for list display
    const withUrls = await Promise.all(
      caseStudies.map(async (cs) => ({
        ...cs,
        hero_image_url: cs.hero_image_path ? await getFileUrl(cs.hero_image_path) : null,
      }))
    );

    res.json(withUrls);
  } catch (error) {
    console.error('Error fetching case studies:', error);
    res.status(500).json({ error: 'Failed to fetch case studies' });
  }
});

/**
 * GET /api/case-studies/featured
 * Get featured case studies
 */
router.get('/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const caseStudies = await CaseStudy.getFeatured(req.tenantId, limit);
    const withUrls = await Promise.all(
      caseStudies.map(async (cs) => ({
        ...cs,
        hero_image_url: cs.hero_image_path ? await getFileUrl(cs.hero_image_path) : null,
      }))
    );
    res.json(withUrls);
  } catch (error) {
    console.error('Error fetching featured case studies:', error);
    res.status(500).json({ error: 'Failed to fetch featured case studies' });
  }
});

/**
 * GET /api/case-studies/:id
 * Get single case study with images
 */
router.get('/:id', async (req, res) => {
  try {
    const caseStudy = await CaseStudy.findByIdAndTenant(req.params.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    // Get images for this case study, with resolved URLs
    const images = await CaseStudyImage.findByCaseStudy(caseStudy.id);
    const imagesWithUrls = await Promise.all(
      images.map(async (img) => ({
        ...img,
        image_url: await getFileUrl(img.file_path),
      }))
    );

    res.json({ ...caseStudy, images: imagesWithUrls });
  } catch (error) {
    console.error('Error fetching case study:', error);
    res.status(500).json({ error: 'Failed to fetch case study' });
  }
});

/**
 * POST /api/case-studies
 * Create a new case study
 */
router.post('/', async (req, res) => {
  try {
    const caseStudy = await CaseStudy.create(
      {
        ...req.body,
        created_by: req.user.id
      },
      req.tenantId
    );

    res.status(201).json(caseStudy);
  } catch (error) {
    console.error('Error creating case study:', error);
    res.status(500).json({ error: 'Failed to create case study' });
  }
});

/**
 * PUT /api/case-studies/:id
 * Update a case study
 */
router.put('/:id', async (req, res) => {
  try {
    // Check if case study exists and belongs to tenant
    const existing = await CaseStudy.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    const caseStudy = await CaseStudy.update(req.params.id, req.body, req.tenantId);
    res.json(caseStudy);
  } catch (error) {
    console.error('Error updating case study:', error);
    res.status(500).json({ error: 'Failed to update case study' });
  }
});

/**
 * PATCH /api/case-studies/:id/publish
 * Publish a case study (manager/admin only)
 */
router.patch('/:id/publish', authorize('admin', 'manager'), async (req, res) => {
  try {
    const caseStudy = await CaseStudy.publish(req.params.id, req.user.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    res.json(caseStudy);
  } catch (error) {
    console.error('Error publishing case study:', error);
    res.status(500).json({ error: 'Failed to publish case study' });
  }
});

/**
 * PATCH /api/case-studies/:id/submit
 * Submit case study for review
 */
router.patch('/:id/submit', async (req, res) => {
  try {
    const caseStudy = await CaseStudy.submitForReview(req.params.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    res.json(caseStudy);
  } catch (error) {
    console.error('Error submitting case study:', error);
    res.status(500).json({ error: 'Failed to submit case study' });
  }
});

/**
 * PATCH /api/case-studies/:id/archive
 * Archive a case study (manager/admin only)
 */
router.patch('/:id/archive', authorize('admin', 'manager'), async (req, res) => {
  try {
    const caseStudy = await CaseStudy.archive(req.params.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    res.json(caseStudy);
  } catch (error) {
    console.error('Error archiving case study:', error);
    res.status(500).json({ error: 'Failed to archive case study' });
  }
});

/**
 * DELETE /api/case-studies/:id
 * Delete a case study (creator or admin)
 */
router.delete('/:id', async (req, res) => {
  try {
    const caseStudy = await CaseStudy.findByIdAndTenant(req.params.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    // Check permission: creator or admin
    if (caseStudy.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this case study' });
    }

    // Get all images first for file cleanup
    const images = await CaseStudyImage.findByCaseStudy(caseStudy.id);

    // Delete the case study (cascades to images in DB)
    await CaseStudy.delete(req.params.id, req.tenantId);

    // Clean up image files
    for (const image of images) {
      try {
        await deleteFile(image.file_path);
      } catch (error) {
        console.error('Error deleting image file:', error);
        // Continue even if file deletion fails
      }
    }

    res.json({ message: 'Case study deleted successfully' });
  } catch (error) {
    console.error('Error deleting case study:', error);
    res.status(500).json({ error: 'Failed to delete case study' });
  }
});

// ===== PDF ROUTES =====

/**
 * GET /api/case-studies/:id/pdf
 * Get case study as HTML for browser print
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const caseStudy = await CaseStudy.findByIdAndTenant(req.params.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    const rawImages = await CaseStudyImage.findByCaseStudy(caseStudy.id);
    const images = await Promise.all(
      rawImages.map(async (img) => ({ ...img, image_url: await getFileUrl(img.file_path) }))
    );
    let template = null;
    if (caseStudy.template_id) {
      template = await CaseStudyTemplate.findByIdAndTenant(caseStudy.template_id, req.tenantId);
    }
    const logoBase64 = await fetchLogoBase64(req.tenantId);

    const html = generateCaseStudyPdfHtml(caseStudy, template, images, logoBase64);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error generating case study PDF HTML:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

/**
 * GET /api/case-studies/:id/pdf-download
 * Download case study as PDF file
 */
router.get('/:id/pdf-download', async (req, res) => {
  try {
    const caseStudy = await CaseStudy.findByIdAndTenant(req.params.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    const rawImages = await CaseStudyImage.findByCaseStudy(caseStudy.id);
    const images = await Promise.all(
      rawImages.map(async (img) => ({ ...img, image_url: await getFileUrl(img.file_path) }))
    );
    let template = null;
    if (caseStudy.template_id) {
      template = await CaseStudyTemplate.findByIdAndTenant(caseStudy.template_id, req.tenantId);
    }
    const logoBase64 = await fetchLogoBase64(req.tenantId);

    const pdfBuffer = await generateCaseStudyPdfBuffer(caseStudy, template, images, logoBase64);
    const filename = `Case-Study-${caseStudy.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating case study PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ===== IMAGE ROUTES =====

/**
 * GET /api/case-studies/:id/images
 * Get all images for a case study
 */
router.get('/:id/images', async (req, res) => {
  try {
    // Verify case study exists and belongs to tenant
    const caseStudy = await CaseStudy.findByIdAndTenant(req.params.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    const images = await CaseStudyImage.findByCaseStudy(req.params.id);
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

/**
 * POST /api/case-studies/:id/images
 * Upload image for a case study (multipart/form-data)
 */
router.post('/:id/images', caseStudyImageUpload.single('file'), async (req, res) => {
  try {
    // Verify case study exists and belongs to tenant
    const caseStudy = await CaseStudy.findByIdAndTenant(req.params.id, req.tenantId);
    if (!caseStudy) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get file info from multer upload
    const fileInfo = getFileInfo(req.file);

    // Get current image count for display order
    const existingImages = await CaseStudyImage.findByCaseStudy(req.params.id);
    const displayOrder = existingImages.length + 1;

    // Create image record
    const image = await CaseStudyImage.create({
      case_study_id: parseInt(req.params.id),
      file_name: fileInfo.fileName,
      file_path: fileInfo.filePath,
      file_size: fileInfo.fileSize,
      file_type: fileInfo.fileType,
      caption: req.body.caption || '',
      display_order: displayOrder,
      is_hero_image: req.body.is_hero_image === 'true',
      is_before_photo: req.body.is_before_photo === 'true',
      is_after_photo: req.body.is_after_photo === 'true',
      uploaded_by: req.user.id
    });

    res.status(201).json(image);
  } catch (error) {
    console.error('Error uploading image:', error);

    // Clean up uploaded file if database insert failed
    if (req.file) {
      const fileInfo = getFileInfo(req.file);
      try {
        await deleteFile(fileInfo.filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up file after failed upload:', cleanupError);
      }
    }

    res.status(500).json({ error: 'Failed to upload image' });
  }
});

/**
 * PUT /api/case-study-images/:id
 * Update image metadata (caption, order, flags)
 */
router.put('/images/:id', async (req, res) => {
  try {
    const image = await CaseStudyImage.update(req.params.id, req.body);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json(image);
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

/**
 * DELETE /api/case-study-images/:id
 * Delete an image
 */
router.delete('/images/:id', async (req, res) => {
  try {
    const image = await CaseStudyImage.delete(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

/**
 * GET /api/case-study-images/:id/download
 * Download/view an image
 */
router.get('/images/:id/download', async (req, res) => {
  try {
    const image = await CaseStudyImage.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get file URL (presigned for R2, local path for filesystem)
    const fileUrl = await getFileUrl(image.file_path);

    // If R2, redirect to presigned URL
    if (fileUrl.startsWith('http')) {
      return res.redirect(fileUrl);
    }

    // For local storage, serve the file
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../', image.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, image.file_name);
  } catch (error) {
    console.error('Error downloading image:', error);
    res.status(500).json({ error: 'Failed to download image' });
  }
});

module.exports = router;
