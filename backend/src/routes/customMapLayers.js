const express = require('express');
const router = express.Router();
const CustomMapLayer = require('../models/CustomMapLayer');
const multer = require('multer');
const XLSX = require('xlsx');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  },
});

router.use(authenticate);
router.use(tenantContext);

// GET / — list all layers
router.get('/', async (req, res, next) => {
  try {
    const layers = await CustomMapLayer.getAll(req.tenantId);
    res.json(layers);
  } catch (error) {
    next(error);
  }
});

// GET /template — download CSV template
router.get('/template', (req, res) => {
  const wb = XLSX.utils.book_new();
  const data = [
    ['Name', 'Address', 'City', 'State', 'Zip', 'Category', 'Notes'],
    ['Chicago Office', '123 W Madison St', 'Chicago', 'IL', '60602', 'Office', 'Main HQ'],
    ['Milwaukee Branch', '456 N Water St', 'Milwaukee', 'WI', '53202', 'Office', ''],
    ['Field Tech - John', '789 Elm St', 'Madison', 'WI', '53703', 'Technician', 'North side'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="custom-map-template.csv"');
  res.send(buf);
});

// GET /:id — single layer
router.get('/:id', async (req, res, next) => {
  try {
    const layer = await CustomMapLayer.getByIdAndTenant(req.params.id, req.tenantId);
    if (!layer) return res.status(404).json({ error: 'Layer not found' });
    res.json(layer);
  } catch (error) {
    next(error);
  }
});

// POST / — create layer
router.post('/', async (req, res, next) => {
  try {
    const { name, pin_color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const layer = await CustomMapLayer.create({ name: name.trim(), pin_color }, req.user.id, req.tenantId);
    res.status(201).json(layer);
  } catch (error) {
    next(error);
  }
});

// PUT /:id — update layer
router.put('/:id', async (req, res, next) => {
  try {
    const { name, pin_color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const layer = await CustomMapLayer.update(req.params.id, { name: name.trim(), pin_color }, req.tenantId);
    if (!layer) return res.status(404).json({ error: 'Layer not found' });
    res.json(layer);
  } catch (error) {
    next(error);
  }
});

// DELETE /:id — delete layer (cascade pins)
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await CustomMapLayer.delete(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Layer not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /:id/pins — get all pins for layer
router.get('/:id/pins', async (req, res, next) => {
  try {
    const pins = await CustomMapLayer.getPins(req.params.id, req.tenantId);
    res.json(pins);
  } catch (error) {
    next(error);
  }
});

// Helper: flexible column name matching
function findColumn(row, candidates) {
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase().trim();
    if (candidates.includes(lower)) return row[key];
  }
  return undefined;
}

// POST /:id/upload — upload CSV/XLSX, parse, geocode, replace pins
router.post('/:id/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify layer belongs to tenant
    const layer = await CustomMapLayer.getByIdAndTenant(req.params.id, req.tenantId);
    if (!layer) return res.status(404).json({ error: 'Layer not found' });

    // Parse file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File contains no data rows' });
    }

    // Parse rows into pins
    const pins = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = findColumn(row, ['name', 'location', 'location name', 'site']);
      const address = findColumn(row, ['address', 'street', 'street address']);
      const city = findColumn(row, ['city']);
      const state = findColumn(row, ['state', 'st']);
      const zip = findColumn(row, ['zip', 'zip_code', 'zip code', 'zipcode', 'postal', 'postal code']);
      const category = findColumn(row, ['category', 'type', 'group']);
      const notes = findColumn(row, ['notes', 'note', 'description', 'comments']);

      if (!name || String(name).trim() === '') {
        errors.push(`Row ${i + 2}: Missing name`);
        continue;
      }

      if (!city || !state) {
        errors.push(`Row ${i + 2} (${name}): City and State are required`);
        continue;
      }

      pins.push({
        name: String(name).trim(),
        address: address ? String(address).trim() : null,
        city: String(city).trim(),
        state: String(state).trim(),
        zip_code: zip ? String(zip).trim() : null,
        latitude: null,
        longitude: null,
        category: category ? String(category).trim() : null,
        notes: notes ? String(notes).trim() : null,
        geocode_source: null,
      });
    }

    // Geocode all pins — try Geocodio batch first, fall back to Census one-by-one
    if (pins.length > 0) {
      const { batchGeocodeGeocodio, geocodeCensus } = require('../utils/geocoder');

      // 1. Try Geocodio batch (fast, needs API key)
      try {
        const addresses = pins.map(p => {
          const parts = [p.address, p.city, p.state, p.zip_code].filter(Boolean);
          return parts.join(', ');
        });
        const results = await batchGeocodeGeocodio(addresses);
        for (let i = 0; i < pins.length; i++) {
          if (results[i]) {
            pins[i].latitude = results[i].lat;
            pins[i].longitude = results[i].lng;
            pins[i].geocode_source = 'geocodio';
          }
        }
      } catch (geoErr) {
        console.error('[CustomMapLayers] Geocodio batch error:', geoErr.message);
      }

      // 2. Fall back to Census for any that Geocodio missed (free, no API key)
      for (const pin of pins) {
        if (pin.latitude) continue;
        try {
          const result = await geocodeCensus(
            pin.address || '',
            pin.city || '',
            pin.state || '',
            pin.zip_code || ''
          );
          if (result) {
            pin.latitude = result.lat;
            pin.longitude = result.lng;
            pin.geocode_source = 'census';
          } else {
            errors.push(`${pin.name}: Could not geocode address`);
          }
        } catch {
          errors.push(`${pin.name}: Could not geocode address`);
        }
      }
    }

    // Filter to only pins with coordinates
    const validPins = pins.filter(p => p.latitude && p.longitude);

    // Replace pins in DB
    const inserted = await CustomMapLayer.replacePins(layer.id, validPins, req.tenantId);

    res.json({
      total_rows: rows.length,
      imported: inserted,
      skipped: rows.length - inserted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
