const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const PipeSpec = require('../models/PipeSpec');
const EstProduct = require('../models/EstProduct');

const router = express.Router();

// ── EST auto-detection: derive install_type + material from pipe spec fields ──

const JOINT_METHOD_TO_INSTALL_TYPES = {
  BW: ['Butt Weld', 'Butt Welded', 'Buttweld'],
  GRV: ['Grooved', 'Grooved Coupling'],
  THD: ['Threaded'],
  CU: ['Soldered', 'Solder'],
};

const MATERIAL_TO_EST_KEYWORDS = {
  carbon_steel: ['Carbon Steel'],
  stainless_steel: ['Stainless Steel', '304 Stainless Steel', '316L Stainless Steel', '316 Stainless Steel'],
  copper: ['Copper', 'Wrot Copper'],
  pvc: ['PVC'],
  cpvc: ['CPVC'],
  cast_iron: ['Cast Iron'],
  ductile_iron: ['Ductile Iron'],
};

/**
 * Find the best matching EST install_type from available values in the database.
 */
async function resolveEstInstallType(tenantId, jointMethod) {
  const aliases = JOINT_METHOD_TO_INSTALL_TYPES[jointMethod];
  if (!aliases) return null;
  const result = await EstProduct.getDistinctInstallTypes(tenantId);
  for (const alias of aliases) {
    const match = result.find(v => v.toLowerCase() === alias.toLowerCase());
    if (match) return match;
  }
  return null;
}

/**
 * Find the best matching EST material from available values in the database.
 */
async function resolveEstMaterial(tenantId, specMaterial) {
  const keywords = MATERIAL_TO_EST_KEYWORDS[specMaterial];
  if (!keywords) return null;
  const result = await EstProduct.getDistinctMaterials(tenantId);
  for (const keyword of keywords) {
    const match = result.find(v => v.toLowerCase() === keyword.toLowerCase());
    if (match) return match;
  }
  return null;
}

router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// List all pipe specs for tenant (?include=rates to attach all rate sub-tables)
router.get('/', async (req, res, next) => {
  try {
    const specs = await PipeSpec.findAll(req.tenantId);
    if (req.query.include === 'rates') {
      await Promise.all(specs.map(async (spec) => {
        const [pipeRates, fittingRates, reducingRates, reducingTeeRates, crossReducingRates] = await Promise.all([
          PipeSpec.getPipeRates(spec.id),
          PipeSpec.getFittingRates(spec.id),
          PipeSpec.getReducingRates(spec.id),
          PipeSpec.getReducingTeeRates(spec.id),
          PipeSpec.getCrossReducingRates(spec.id),
        ]);
        spec.pipe_rates = pipeRates;
        spec.fitting_rates = fittingRates;
        spec.reducing_rates = reducingRates;
        spec.reducing_tee_rates = reducingTeeRates;
        spec.cross_reducing_rates = crossReducingRates;

        // Auto-populate cost_maps from est_products using the product_id
        // linkage (MapProd → Cost). This ensures report exports always
        // reflect the latest EST catalog pricing without requiring a
        // manual import step.
        let installType = spec.est_install_type;
        let material = spec.est_material;

        // Auto-detect EST filters from spec's joint_method + material
        // if the user hasn't manually configured them yet
        if (!installType) {
          installType = await resolveEstInstallType(req.tenantId, spec.joint_method);
        }
        if (!material) {
          material = await resolveEstMaterial(req.tenantId, spec.material);
        }

        if (installType && material) {
          const liveCosts = await EstProduct.buildCostMapsForSpec(
            req.tenantId, installType, material, spec.est_filters
          );
          if (liveCosts) {
            spec.cost_maps = liveCosts;
          }
        }
      }));
    }
    res.json(specs);
  } catch (error) {
    next(error);
  }
});

// Get single pipe spec with all rates
router.get('/:id', async (req, res, next) => {
  try {
    const spec = await PipeSpec.findById(req.params.id, req.tenantId);
    if (!spec) {
      return res.status(404).json({ error: 'Pipe spec not found' });
    }
    // Auto-populate cost_maps from est_products
    let installType = spec.est_install_type;
    let material = spec.est_material;
    if (!installType) {
      installType = await resolveEstInstallType(req.tenantId, spec.joint_method);
    }
    if (!material) {
      material = await resolveEstMaterial(req.tenantId, spec.material);
    }
    if (installType && material) {
      const liveCosts = await EstProduct.buildCostMapsForSpec(
        req.tenantId, installType, material, spec.est_filters
      );
      if (liveCosts) {
        spec.cost_maps = liveCosts;
      }
    }
    res.json(spec);
  } catch (error) {
    next(error);
  }
});

// Create pipe spec
router.post('/', async (req, res, next) => {
  try {
    const { name, joint_method, material, schedule, stock_pipe_length, joint_type, pipe_material, is_default } = req.body;
    if (!name || !joint_method || !material || !schedule || !joint_type || !pipe_material) {
      return res.status(400).json({ error: 'name, joint_method, material, schedule, joint_type, and pipe_material are required' });
    }
    const spec = await PipeSpec.create(req.tenantId, req.body);
    res.status(201).json(spec);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A pipe spec with this name already exists' });
    }
    next(error);
  }
});

// Update pipe spec metadata
router.put('/:id', async (req, res, next) => {
  try {
    const spec = await PipeSpec.update(req.params.id, req.tenantId, req.body);
    if (!spec) {
      return res.status(404).json({ error: 'Pipe spec not found' });
    }
    res.json(spec);
  } catch (error) {
    next(error);
  }
});

// Duplicate pipe spec with all rates
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required for the duplicate' });
    }
    const spec = await PipeSpec.duplicate(req.params.id, req.tenantId, name);
    if (!spec) {
      return res.status(404).json({ error: 'Source pipe spec not found' });
    }
    res.status(201).json(spec);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A pipe spec with this name already exists' });
    }
    next(error);
  }
});

// Delete pipe spec
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await PipeSpec.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Pipe spec not found' });
    }
    res.json({ message: 'Pipe spec deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Pipe Rates ───

router.put('/:id/pipe-rates', async (req, res, next) => {
  try {
    const { rates } = req.body;
    if (!Array.isArray(rates)) {
      return res.status(400).json({ error: 'rates array is required' });
    }
    await PipeSpec.bulkUpsertPipeRates(req.params.id, rates);
    const updated = await PipeSpec.getPipeRates(req.params.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ─── Fitting Rates ───

router.put('/:id/fitting-rates', async (req, res, next) => {
  try {
    const { rates } = req.body;
    if (!Array.isArray(rates)) {
      return res.status(400).json({ error: 'rates array is required' });
    }
    if (rates.length === 0) {
      return res.status(400).json({ error: 'No rates to import' });
    }
    // Validate each rate entry
    for (let i = 0; i < rates.length; i++) {
      const r = rates[i];
      if (!r.fitting_type || typeof r.fitting_type !== 'string') {
        return res.status(400).json({
          error: `Invalid rate at row ${i + 1}: missing fitting_type`,
          detail: `Got: ${JSON.stringify(r)}`,
        });
      }
      if (!r.pipe_size || typeof r.pipe_size !== 'string') {
        return res.status(400).json({
          error: `Invalid rate at row ${i + 1}: missing pipe_size`,
          detail: `Got: ${JSON.stringify(r)}`,
        });
      }
      if (typeof r.hours_per_unit !== 'number' || isNaN(r.hours_per_unit) || r.hours_per_unit <= 0) {
        return res.status(400).json({
          error: `Invalid rate at row ${i + 1}: hours_per_unit must be a positive number`,
          detail: `Got ${r.hours_per_unit} for ${r.fitting_type} ${r.pipe_size}`,
        });
      }
    }
    await PipeSpec.bulkUpsertFittingRates(req.params.id, rates);
    const updated = await PipeSpec.getFittingRates(req.params.id);
    res.json(updated);
  } catch (error) {
    // Add context to database/query errors
    const detail = error.detail || error.hint || '';
    const msg = `Failed to import ${req.body?.rates?.length || 0} fitting rates for spec ${req.params.id}: ${error.message}`;
    console.error(msg, detail);
    error.message = msg;
    if (detail) error.detail = detail;
    next(error);
  }
});

// ─── Reducing Rates ───

router.put('/:id/reducing-rates', async (req, res, next) => {
  try {
    const { rates } = req.body;
    if (!Array.isArray(rates)) {
      return res.status(400).json({ error: 'rates array is required' });
    }
    await PipeSpec.bulkUpsertReducingRates(req.params.id, rates);
    const updated = await PipeSpec.getReducingRates(req.params.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ─── Reducing Tee Rates ───

router.put('/:id/reducing-tee-rates', async (req, res, next) => {
  try {
    const { rates } = req.body;
    if (!Array.isArray(rates)) {
      return res.status(400).json({ error: 'rates array is required' });
    }
    await PipeSpec.bulkUpsertReducingTeeRates(req.params.id, rates);
    const updated = await PipeSpec.getReducingTeeRates(req.params.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ─── Cross Reducing Rates ───

router.put('/:id/cross-reducing-rates', async (req, res, next) => {
  try {
    const { rates } = req.body;
    if (!Array.isArray(rates)) {
      return res.status(400).json({ error: 'rates array is required' });
    }
    await PipeSpec.bulkUpsertCrossReducingRates(req.params.id, rates);
    const updated = await PipeSpec.getCrossReducingRates(req.params.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ─── Rate Lookups ───

router.get('/:id/lookup/pipe', async (req, res, next) => {
  try {
    const { size } = req.query;
    if (!size) return res.status(400).json({ error: 'size query parameter is required' });
    const rate = await PipeSpec.lookupPipeRate(req.params.id, size);
    if (!rate) return res.json({ hours_per_foot: 0, found: false });
    res.json({ ...rate, found: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/lookup/fitting', async (req, res, next) => {
  try {
    const { type, size } = req.query;
    if (!type || !size) return res.status(400).json({ error: 'type and size query parameters are required' });
    const rate = await PipeSpec.lookupFittingRate(req.params.id, type, size);
    if (!rate) return res.json({ hours_per_unit: 0, found: false });
    res.json({ ...rate, found: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/lookup/reducing', async (req, res, next) => {
  try {
    const { type, main_size, reducing_size } = req.query;
    if (!type || !main_size || !reducing_size) {
      return res.status(400).json({ error: 'type, main_size, and reducing_size are required' });
    }
    const rate = await PipeSpec.lookupReducingRate(req.params.id, type, main_size, reducing_size);
    if (!rate) return res.json({ hours_per_unit: 0, found: false });
    res.json({ ...rate, found: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/lookup/reducing-tee', async (req, res, next) => {
  try {
    const { main_size, branch_size } = req.query;
    if (!main_size || !branch_size) {
      return res.status(400).json({ error: 'main_size and branch_size are required' });
    }
    const rate = await PipeSpec.lookupReducingTeeRate(req.params.id, main_size, branch_size);
    if (!rate) return res.json({ hours_per_unit: 0, found: false });
    res.json({ ...rate, found: true });
  } catch (error) {
    next(error);
  }
});

// ─── Import from Rate Tables ───

router.post('/:id/import-from-tables', async (req, res, next) => {
  try {
    const specId = Number(req.params.id);
    const { sources } = req.body;
    // sources: [{ columnId, targetField, targetKey }]
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ error: 'sources array is required' });
    }

    const RateTable = require('../models/RateTable');
    const db = require('../config/database');

    // Collect fitting rates and pipe rates from the referenced columns
    const fittingRates = [];
    const pipeRates = [];

    for (const src of sources) {
      const col = (await db.query(
        `SELECT * FROM rate_table_columns WHERE id = $1`, [src.columnId]
      )).rows[0];
      if (!col) continue;

      const rates = typeof col.rates === 'string' ? JSON.parse(col.rates) : col.rates;

      if (src.targetField === 'pipe') {
        for (const [size, value] of Object.entries(rates)) {
          pipeRates.push({ pipe_size: size, hours_per_foot: value });
        }
      } else if (src.targetField === 'fitting') {
        for (const [size, value] of Object.entries(rates)) {
          fittingRates.push({ fitting_type: src.targetKey, pipe_size: size, hours_per_unit: value });
        }
      }

      // Record provenance
      await db.query(
        `INSERT INTO pipe_spec_rate_sources (pipe_spec_id, rate_table_column_id, target_field, target_key)
         VALUES ($1, $2, $3, $4)`,
        [specId, src.columnId, src.targetField, src.targetKey || null]
      );
    }

    // Upsert the rates into the spec
    if (fittingRates.length > 0) {
      await PipeSpec.bulkUpsertFittingRates(specId, fittingRates);
    }
    if (pipeRates.length > 0) {
      await PipeSpec.bulkUpsertPipeRates(specId, pipeRates);
    }

    res.json({
      imported: {
        fitting_rates: fittingRates.length,
        pipe_rates: pipeRates.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
