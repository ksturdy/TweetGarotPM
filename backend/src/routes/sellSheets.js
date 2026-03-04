const express = require('express');
const router = express.Router();
const SellSheet = require('../models/SellSheet');
const SellSheetImage = require('../models/SellSheetImage');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { getFileInfo, deleteFile, getFileUrl } = require('../utils/fileStorage');
const { generateSellSheetPdfHtml } = require('../utils/sellSheetPdfGenerator');
const { generateSellSheetPdfBuffer } = require('../utils/sellSheetPdfBuffer');
const { fetchLogoBase64 } = require('../utils/logoFetcher');

const sellSheetImageUpload = createUploadMiddleware({
  destination: 'uploads/sell-sheets',
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxSize: 10 * 1024 * 1024,
});

router.use(authenticate);
router.use(tenantContext);

// GET /api/sell-sheets
router.get('/', async (req, res) => {
  try {
    const { status, service_name, featured } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (service_name) filters.service_name = service_name;
    if (featured !== undefined) filters.featured = featured === 'true';

    const sellSheets = await SellSheet.findAllByTenant(req.tenantId, filters);

    const withUrls = await Promise.all(
      sellSheets.map(async (ss) => {
        const images = ss.images
          ? await Promise.all(
              ss.images.map(async (img) => ({
                ...img,
                image_url: img.file_path ? await getFileUrl(img.file_path) : null,
              }))
            )
          : null;
        return { ...ss, images };
      })
    );

    res.json(withUrls);
  } catch (error) {
    console.error('Error fetching sell sheets:', error);
    res.status(500).json({ error: 'Failed to fetch sell sheets' });
  }
});

// GET /api/sell-sheets/:id
router.get('/:id', async (req, res) => {
  try {
    const sellSheet = await SellSheet.findByIdAndTenant(req.params.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }

    const images = await SellSheetImage.findBySellSheet(sellSheet.id);
    const imagesWithUrls = await Promise.all(
      images.map(async (img) => ({
        ...img,
        image_url: await getFileUrl(img.file_path),
      }))
    );

    res.json({ ...sellSheet, images: imagesWithUrls });
  } catch (error) {
    console.error('Error fetching sell sheet:', error);
    res.status(500).json({ error: 'Failed to fetch sell sheet' });
  }
});

// POST /api/sell-sheets
router.post('/', async (req, res) => {
  try {
    const sellSheet = await SellSheet.create(
      { ...req.body, created_by: req.user.id },
      req.tenantId
    );
    res.status(201).json(sellSheet);
  } catch (error) {
    console.error('Error creating sell sheet:', error);
    res.status(500).json({ error: 'Failed to create sell sheet' });
  }
});

// PUT /api/sell-sheets/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await SellSheet.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }
    const sellSheet = await SellSheet.update(req.params.id, req.body, req.tenantId);
    res.json(sellSheet);
  } catch (error) {
    console.error('Error updating sell sheet:', error);
    res.status(500).json({ error: 'Failed to update sell sheet' });
  }
});

// PATCH /api/sell-sheets/:id/publish
router.patch('/:id/publish', authorize('admin', 'manager'), async (req, res) => {
  try {
    const sellSheet = await SellSheet.publish(req.params.id, req.user.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }
    res.json(sellSheet);
  } catch (error) {
    console.error('Error publishing sell sheet:', error);
    res.status(500).json({ error: 'Failed to publish sell sheet' });
  }
});

// PATCH /api/sell-sheets/:id/archive
router.patch('/:id/archive', authorize('admin', 'manager'), async (req, res) => {
  try {
    const sellSheet = await SellSheet.archive(req.params.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }
    res.json(sellSheet);
  } catch (error) {
    console.error('Error archiving sell sheet:', error);
    res.status(500).json({ error: 'Failed to archive sell sheet' });
  }
});

// PATCH /api/sell-sheets/:id/unarchive
router.patch('/:id/unarchive', authorize('admin', 'manager'), async (req, res) => {
  try {
    const sellSheet = await SellSheet.unarchive(req.params.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found or not archived' });
    }
    res.json(sellSheet);
  } catch (error) {
    console.error('Error un-archiving sell sheet:', error);
    res.status(500).json({ error: 'Failed to un-archive sell sheet' });
  }
});

// DELETE /api/sell-sheets/:id
router.delete('/:id', async (req, res) => {
  try {
    const sellSheet = await SellSheet.findByIdAndTenant(req.params.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }
    if (sellSheet.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this sell sheet' });
    }

    const images = await SellSheetImage.findBySellSheet(sellSheet.id);
    await SellSheet.delete(req.params.id, req.tenantId);

    for (const image of images) {
      try { await deleteFile(image.file_path); } catch (e) { console.error('Error deleting image file:', e); }
    }

    res.json({ message: 'Sell sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting sell sheet:', error);
    res.status(500).json({ error: 'Failed to delete sell sheet' });
  }
});

// ===== PDF ROUTES =====

// GET /api/sell-sheets/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const sellSheet = await SellSheet.findByIdAndTenant(req.params.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }

    const rawImages = await SellSheetImage.findBySellSheet(sellSheet.id);
    const images = await Promise.all(
      rawImages.map(async (img) => ({ ...img, image_url: await getFileUrl(img.file_path) }))
    );
    const logoBase64 = await fetchLogoBase64(req.tenantId);

    const html = generateSellSheetPdfHtml(sellSheet, images, logoBase64);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error generating sell sheet PDF HTML:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// GET /api/sell-sheets/:id/pdf-download
router.get('/:id/pdf-download', async (req, res) => {
  try {
    const sellSheet = await SellSheet.findByIdAndTenant(req.params.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }

    const rawImages = await SellSheetImage.findBySellSheet(sellSheet.id);
    const images = await Promise.all(
      rawImages.map(async (img) => ({ ...img, image_url: await getFileUrl(img.file_path) }))
    );
    const logoBase64 = await fetchLogoBase64(req.tenantId);

    const pdfBuffer = await generateSellSheetPdfBuffer(sellSheet, images, logoBase64);
    const filename = `Sell-Sheet-${(sellSheet.service_name || sellSheet.title).replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating sell sheet PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ===== IMAGE ROUTES =====

// GET /api/sell-sheets/:id/images
router.get('/:id/images', async (req, res) => {
  try {
    const sellSheet = await SellSheet.findByIdAndTenant(req.params.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }
    const images = await SellSheetImage.findBySellSheet(req.params.id);
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// POST /api/sell-sheets/:id/images
router.post('/:id/images', sellSheetImageUpload.single('file'), async (req, res) => {
  try {
    const sellSheet = await SellSheet.findByIdAndTenant(req.params.id, req.tenantId);
    if (!sellSheet) {
      return res.status(404).json({ error: 'Sell sheet not found' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = getFileInfo(req.file);
    const existingImages = await SellSheetImage.findBySellSheet(req.params.id);
    const displayOrder = existingImages.length + 1;

    const image = await SellSheetImage.create({
      sell_sheet_id: parseInt(req.params.id),
      file_name: fileInfo.fileName,
      file_path: fileInfo.filePath,
      file_size: fileInfo.fileSize,
      file_type: fileInfo.fileType,
      caption: req.body.caption || '',
      display_order: displayOrder,
      is_hero_image: req.body.is_hero_image === 'true',
      uploaded_by: req.user.id
    });

    res.status(201).json(image);
  } catch (error) {
    console.error('Error uploading image:', error);
    if (req.file) {
      const fileInfo = getFileInfo(req.file);
      try { await deleteFile(fileInfo.filePath); } catch (e) { /* cleanup */ }
    }
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// PUT /api/sell-sheets/images/:id
router.put('/images/:id', async (req, res) => {
  try {
    const image = await SellSheetImage.update(req.params.id, req.body);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json(image);
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// DELETE /api/sell-sheets/images/:id
router.delete('/images/:id', async (req, res) => {
  try {
    const image = await SellSheetImage.delete(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
