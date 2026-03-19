const express = require('express');
const router = express.Router();
const EstProduct = require('../models/EstProduct');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Helper to parse numbers
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

// Helper to safely convert any cell value to a trimmed string (or null)
const str = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim() || null;
};

// Helper to parse Excel date strings (DD/MM/YYYY or already Date)
const parseDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    // DD/MM/YYYY format
    const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return s; // Already in a usable format
  }
  if (typeof value === 'number') {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return jsDate.toISOString().split('T')[0];
  }
  return null;
};

// Configure multer for Excel file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `est-upload-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) files are allowed.'));
    }
  },
});

// Multer error handler wrapper
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large. Maximum size is 100MB.' });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Admin check middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ==================== STATS ====================

// GET /api/est-products/stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await EstProduct.getStats(req.tenantId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ==================== IMPORT ====================

// GET /api/est-products/import/history
router.get('/import/history', async (req, res, next) => {
  try {
    const history = await EstProduct.getImportHistory(req.tenantId);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// POST /api/est-products/import/upload
router.post('/import/upload', requireAdmin, handleUpload, async (req, res, next) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    console.log(`[EST Import] Starting import of ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    const startTime = Date.now();

    // Read the entire workbook once (avoids re-parsing the file 3 times)
    console.log(`[EST Import] Parsing workbook...`);
    const parseStart = Date.now();
    const workbook = XLSX.readFile(tempFilePath);
    const sheetNames = workbook.SheetNames;
    console.log(`[EST Import] Parsed in ${((Date.now() - parseStart) / 1000).toFixed(1)}s. Sheets: ${sheetNames.join(', ')}`);

    // Helper to convert a sheet to JSON rows
    const loadSheet = (sheetName) => {
      return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    };

    const results = {
      mapProd: { total: 0, new: 0, updated: 0 },
      cost: { total: 0, matched: 0, unmatched: 0 },
      labor: { total: 0, matched: 0, unmatched: 0 },
      sheetsFound: [],
      sheetsProcessed: []
    };

    // Create import batch
    const batch = await EstProduct.createImportBatch({
      file_name: req.file.originalname,
      records_total: 0,
      imported_by: req.user.id
    }, req.tenantId);

    // ---- Process MapProd sheet first (creates/updates product catalog rows) ----
    if (sheetNames.includes('MapProd')) {
      console.log('[EST Import] Processing MapProd sheet...');
      results.sheetsFound.push('MapProd');
      const data = loadSheet('MapProd');
      console.log(`[EST Import] MapProd: ${data.length} rows to process`);

      if (data.length > 0) {
        // Log columns for debugging
        if (data[0]) {
          console.log(`[EST Import] MapProd columns: ${Object.keys(data[0]).join(', ')}`);
        }

        // Transform rows
        const CHUNK_SIZE = 500;
        let totalNew = 0;
        let totalUpdated = 0;

        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          const rows = chunk
            .filter(row => row['ID'])
            .map(row => ({
              product_id: String(row['ID']).trim(),
              group_name: str(row['Group']),
              manufacturer: str(row['Manufacturer']),
              product: str(row['Product']),
              description: str(row['Description']),
              size: str(row['Size']),
              material: str(row['Material']),
              spec: str(row['Spec']),
              install_type: str(row['Install Type']),
              source_description: str(row['Source Description']),
              range: str(row['Range']),
              finish: str(row['Finish']),
            }));

          if (rows.length > 0) {
            const { newCount, updatedCount } = await EstProduct.bulkUpsertMapProd(rows, req.tenantId, batch.id);
            totalNew += newCount;
            totalUpdated += updatedCount;
          }

          if ((i + CHUNK_SIZE) % 5000 === 0 || i + CHUNK_SIZE >= data.length) {
            console.log(`[EST Import] MapProd: processed ${Math.min(i + CHUNK_SIZE, data.length)}/${data.length} rows`);
          }
        }

        results.mapProd = { total: data.length, new: totalNew, updated: totalUpdated };
        results.sheetsProcessed.push('MapProd');
      }
    }

    // ---- Process Cost sheet (updates cost columns) ----
    if (sheetNames.includes('Cost')) {
      console.log('[EST Import] Processing Cost sheet...');
      results.sheetsFound.push('Cost');
      const data = loadSheet('Cost');
      console.log(`[EST Import] Cost: ${data.length} rows to process`);

      if (data.length > 0) {
        if (data[0]) {
          console.log(`[EST Import] Cost columns: ${Object.keys(data[0]).join(', ')}`);
        }

        const CHUNK_SIZE = 500;
        let totalMatched = 0;
        let totalUnmatched = 0;

        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          const rows = chunk
            .filter(row => row['ID'])
            .map(row => ({
              product_id: String(row['ID']).trim(),
              cost: parseNumber(row['Cost']),
              cost_factor: str(row['Factor']),
              cost_unit: str(row['Unit']),
              cost_date: parseDate(row['Date']),
              cost_status: str(row['Status']),
            }));

          if (rows.length > 0) {
            const { matchedCount, unmatchedCount } = await EstProduct.bulkUpsertCost(rows, req.tenantId, batch.id);
            totalMatched += matchedCount;
            totalUnmatched += unmatchedCount;
          }

          if ((i + CHUNK_SIZE) % 5000 === 0 || i + CHUNK_SIZE >= data.length) {
            console.log(`[EST Import] Cost: processed ${Math.min(i + CHUNK_SIZE, data.length)}/${data.length} rows`);
          }
        }

        results.cost = { total: data.length, matched: totalMatched, unmatched: totalUnmatched };
        results.sheetsProcessed.push('Cost');
      }
    }

    // ---- Process Labor sheet (updates labor columns) ----
    if (sheetNames.includes('Labor')) {
      console.log('[EST Import] Processing Labor sheet...');
      results.sheetsFound.push('Labor');
      const data = loadSheet('Labor');
      console.log(`[EST Import] Labor: ${data.length} rows to process`);

      if (data.length > 0) {
        if (data[0]) {
          console.log(`[EST Import] Labor columns: ${Object.keys(data[0]).join(', ')}`);
        }

        const CHUNK_SIZE = 500;
        let totalMatched = 0;
        let totalUnmatched = 0;

        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          const rows = chunk
            .filter(row => row['ID'])
            .map(row => ({
              product_id: String(row['ID']).trim(),
              labor_time: parseNumber(row['Time']),
              labor_units: str(row['Units']),
            }));

          if (rows.length > 0) {
            const { matchedCount, unmatchedCount } = await EstProduct.bulkUpsertLabor(rows, req.tenantId, batch.id);
            totalMatched += matchedCount;
            totalUnmatched += unmatchedCount;
          }

          if ((i + CHUNK_SIZE) % 5000 === 0 || i + CHUNK_SIZE >= data.length) {
            console.log(`[EST Import] Labor: processed ${Math.min(i + CHUNK_SIZE, data.length)}/${data.length} rows`);
          }
        }

        results.labor = { total: data.length, matched: totalMatched, unmatched: totalUnmatched };
        results.sheetsProcessed.push('Labor');
      }
    }

    // Update batch with final totals
    const totalRecords = results.mapProd.total + results.cost.total + results.labor.total;
    const totalNew = results.mapProd.new + results.cost.unmatched + results.labor.unmatched;
    const totalUpdated = results.mapProd.updated + results.cost.matched + results.labor.matched;
    await EstProduct.updateImportBatch(batch.id, {
      records_total: totalRecords,
      records_new: totalNew,
      records_updated: totalUpdated
    });

    // Set batch ID on all records
    await EstProduct.setBatchId(req.tenantId, batch.id);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[EST Import] Complete in ${elapsed}s. MapProd: ${results.mapProd.total}, Cost: ${results.cost.total}, Labor: ${results.labor.total}`);

    res.json({
      message: `Import complete in ${elapsed}s`,
      ...results,
      batch_id: batch.id
    });

  } catch (error) {
    console.error('[EST Import] Error:', error);
    next(error);
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.warn('[EST Import] Failed to clean up temp file:', err.message);
      });
    }
  }
});

// ==================== SPEC FILTER OPTIONS ====================

// GET /api/est-products/spec-filter-options
// Returns distinct install_types and materials for dropdown selectors
router.get('/spec-filter-options', async (req, res, next) => {
  try {
    const filters = {
      installType: req.query.installType || null,
      product: req.query.product || null,
      material: req.query.material || null,
    };
    const result = await EstProduct.getSpecFilterOptions(req.tenantId, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== RATES FOR SPEC ====================

// GET /api/est-products/rates-for-spec
// Returns products split into pipe rates (per-ft) and fitting products (per-each)
// for populating pipe spec rate tables
router.get('/rates-for-spec', async (req, res, next) => {
  try {
    const filters = {
      installType: req.query.installType || null,
      material: req.query.material || null,
      group: req.query.group || null,
      manufacturer: req.query.manufacturer || null,
      product: req.query.product || null,
    };
    const result = await EstProduct.getRatesForSpec(req.tenantId, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== SEARCH & QUERY ====================

// GET /api/est-products/search
router.get('/search', async (req, res, next) => {
  try {
    const filters = {
      group: req.query.group || null,
      material: req.query.material || null,
      size: req.query.size || null,
      installType: req.query.installType || null,
      manufacturer: req.query.manufacturer || null,
      search: req.query.search || null,
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 50, 200),
    };
    const result = await EstProduct.search(req.tenantId, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/est-products/groups
router.get('/groups', async (req, res, next) => {
  try {
    const groups = await EstProduct.getDistinctGroups(req.tenantId);
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

// GET /api/est-products/materials
router.get('/materials', async (req, res, next) => {
  try {
    const materials = await EstProduct.getDistinctMaterials(req.tenantId, req.query.group || null);
    res.json(materials);
  } catch (error) {
    next(error);
  }
});

// GET /api/est-products/sizes
router.get('/sizes', async (req, res, next) => {
  try {
    const sizes = await EstProduct.getDistinctSizes(req.tenantId, req.query.group || null, req.query.material || null);
    res.json(sizes);
  } catch (error) {
    next(error);
  }
});

// GET /api/est-products/install-types
router.get('/install-types', async (req, res, next) => {
  try {
    const types = await EstProduct.getDistinctInstallTypes(req.tenantId, req.query.group || null);
    res.json(types);
  } catch (error) {
    next(error);
  }
});

// GET /api/est-products/manufacturers
router.get('/manufacturers', async (req, res, next) => {
  try {
    const manufacturers = await EstProduct.getDistinctManufacturers(req.tenantId, req.query.group || null);
    res.json(manufacturers);
  } catch (error) {
    next(error);
  }
});

// GET /api/est-products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await EstProduct.findById(req.params.id, req.tenantId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
