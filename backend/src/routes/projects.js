const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const ProjectAssignment = require('../models/ProjectAssignment');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext, checkLimit } = require('../middleware/tenant');

const router = express.Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * Auto-geocode a single project in the background (non-blocking).
 * Called after project create/update when address fields change.
 */
function autoGeocodeProject(projectId) {
  // Fire and forget — don't await, don't block the response
  (async () => {
    try {
      const project = await Project.findById(projectId);
      if (!project) return;

      // Only geocode if we have address data
      if (!project.ship_city && !project.ship_state && !project.address) return;

      const { geocodeAddress } = require('../utils/geocoder');
      const coords = await geocodeAddress(project);
      if (coords) {
        await Project.updateGeocode(projectId, coords.lat, coords.lng);
        console.log(`[Auto-geocode] Project ${projectId}: ${coords.source} (${coords.lat}, ${coords.lng})`);
      }
    } catch (err) {
      console.error(`[Auto-geocode] Project ${projectId} failed:`, err.message);
    }
  })();
}

// Get all projects (within tenant)
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      managerId: req.query.managerId,
    };

    // Foremen only see assigned projects
    if (req.user.role === 'foreman') {
      const assignedIds = await ProjectAssignment.getProjectIdsForUser(req.user.id, req.tenantId);
      if (assignedIds.length === 0) {
        return res.json([]);
      }
      filters.projectIds = assignedIds;
    }

    const projects = await Project.findAllByTenant(req.tenantId, filters);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Get project locations for map view (within tenant)
router.get('/map-locations', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || undefined,
      managerId: req.query.managerId || undefined,
      market: req.query.market || undefined,
    };
    const locations = await Project.findMapLocations(req.tenantId, filters);
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

// Download Project Locations as PDF (map is rendered server-side in Puppeteer)
router.post('/map-locations/pdf', async (req, res) => {
  try {
    const { generateProjectLocationsPdfBuffer } = require('../utils/projectLocationsPdfBuffer');

    const filters = {
      status: req.body.status || undefined,
      markets: Array.isArray(req.body.markets) ? req.body.markets : undefined,
      manager: req.body.manager || undefined,
      customer: req.body.customer || undefined,
      dateFrom: req.body.dateFrom || undefined,
      dateTo: req.body.dateTo || undefined,
    };

    const includeList = req.body.includeList === true;

    // Map viewport & layer config from the frontend
    const mapConfig = req.body.mapConfig || undefined;

    // Get all map locations with server-side filters
    let locations = await Project.findMapLocations(req.tenantId, {
      status: filters.status,
    });

    // Apply client-side filters
    if (filters.markets && filters.markets.length > 0) {
      locations = locations.filter(l => filters.markets.includes(l.market));
    }
    if (filters.manager) {
      locations = locations.filter(l => l.manager_name === filters.manager);
    }
    if (filters.customer) {
      locations = locations.filter(l => l.customer_name === filters.customer);
    }
    if (filters.dateFrom) {
      locations = locations.filter(l => l.start_date && l.start_date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      locations = locations.filter(l => l.start_date && l.start_date <= filters.dateTo);
    }

    const pdfBuffer = await generateProjectLocationsPdfBuffer(locations, {
      filters,
      mapConfig,
      includeList,
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Project-Locations-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating project locations PDF:', error);
    res.status(500).json({ error: 'Failed to generate project locations PDF' });
  }
});

// Download Customer Comparison as PDF
router.post('/map-locations/comparison-pdf', async (req, res) => {
  try {
    const { generateCustomerComparisonPdfBuffer } = require('../utils/customerComparisonPdfBuffer');

    const customers = req.body.customers || [];
    const customerColors = req.body.customerColors || {};
    const filters = {
      status: req.body.status || undefined,
      markets: Array.isArray(req.body.markets) ? req.body.markets : undefined,
      department: req.body.department || undefined,
      dateFrom: req.body.dateFrom || undefined,
      dateTo: req.body.dateTo || undefined,
    };
    const includeList = req.body.includeList === true;
    const mapConfig = req.body.mapConfig || undefined;

    // Get all map locations with server-side filters
    let locations = await Project.findMapLocations(req.tenantId, {
      status: filters.status,
    });

    // Filter to selected customers
    locations = locations.filter(l => customers.includes(l.customer_name));

    // Apply client-side filters
    if (filters.markets && filters.markets.length > 0) {
      locations = locations.filter(l => filters.markets.includes(l.market));
    }
    if (filters.department) {
      locations = locations.filter(l => l.department_name === filters.department);
    }
    if (filters.dateFrom) {
      locations = locations.filter(l => l.start_date && l.start_date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      locations = locations.filter(l => l.start_date && l.start_date <= filters.dateTo);
    }

    const pdfBuffer = await generateCustomerComparisonPdfBuffer(locations, {
      customers,
      customerColors,
      filters,
      mapConfig,
      includeList,
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Customer-Comparison-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating customer comparison PDF:', error);
    res.status(500).json({ error: 'Failed to generate customer comparison PDF' });
  }
});

// Track background geocoding progress
let geocodeJob = { running: false, total: 0, geocoded: 0, failed: 0 };

// Geocode projects that are missing coordinates (admin/manager only)
// ?force=true to re-geocode all projects with street addresses
router.post('/geocode', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    if (geocodeJob.running) {
      return res.json({ status: 'running', ...geocodeJob });
    }

    const { geocodeAddress, batchGeocodeGeocodio, buildAddressString, normalizeState, isInState, STATE_CENTROIDS } = require('../utils/geocoder');
    const force = req.query.force === 'true';
    const projects = force
      ? await Project.findNeedsRegeocoding(req.tenantId)
      : await Project.findUngeocoded(req.tenantId);

    if (projects.length === 0) {
      return res.json({ total: 0, geocoded: 0, failed: 0, status: 'complete' });
    }

    // Start background processing
    geocodeJob = { running: true, total: projects.length, geocoded: 0, failed: 0 };
    res.json({ status: 'started', total: projects.length });

    // Process in background
    (async () => {
      // Try Geocodio batch first (much faster — all at once instead of one-by-one)
      if (process.env.GEOCODIO_API_KEY) {
        console.log(`[Geocode] Starting Geocodio batch for ${projects.length} projects...`);
        const addresses = projects.map(p => buildAddressString(p) || '');
        const batchResults = await batchGeocodeGeocodio(addresses);

        for (let i = 0; i < projects.length; i++) {
          const result = batchResults[i];
          const project = projects[i];
          const stateAbbr = normalizeState(project.ship_state);

          if (result && (!stateAbbr || isInState(result.lat, result.lng, stateAbbr))) {
            await Project.updateGeocode(project.id, result.lat, result.lng);
            geocodeJob.geocoded++;
          } else if (stateAbbr && STATE_CENTROIDS[stateAbbr]) {
            // Geocodio failed or wrong state — use state centroid
            const [lat, lng] = STATE_CENTROIDS[stateAbbr];
            await Project.updateGeocode(project.id, lat, lng);
            geocodeJob.geocoded++;
          } else {
            geocodeJob.failed++;
          }
        }
      } else {
        // No Geocodio key — fall back to one-by-one with Census
        console.log(`[Geocode] No GEOCODIO_API_KEY — falling back to Census for ${projects.length} projects...`);
        for (const project of projects) {
          try {
            const coords = await geocodeAddress(project);
            if (coords) {
              await Project.updateGeocode(project.id, coords.lat, coords.lng);
              geocodeJob.geocoded++;
            } else {
              geocodeJob.failed++;
            }
          } catch (err) {
            geocodeJob.failed++;
          }
        }
      }
      geocodeJob.running = false;
      console.log(`[Geocode] Complete: ${geocodeJob.geocoded} geocoded, ${geocodeJob.failed} failed`);
    })();
  } catch (error) {
    next(error);
  }
});

// Check geocoding progress
router.get('/geocode/status', authorize('admin', 'manager'), (req, res) => {
  res.json(geocodeJob);
});

// POST /api/projects/gm-override — bulk apply GM override to all ~100% GM projects
router.post('/gm-override', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const overridePercent = parseFloat(req.body.percent);
    if (isNaN(overridePercent) || overridePercent < 0 || overridePercent > 100) {
      return res.status(400).json({ error: 'Invalid override percentage' });
    }
    // Convert from display % (16.5) to decimal (0.165)
    const decimal = overridePercent / 100;
    const count = await Project.applyGmOverride(req.tenantId, decimal);
    res.json({ applied: count });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/gm-override — clear all GM overrides
router.delete('/gm-override', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const count = await Project.clearGmOverrides(req.tenantId);
    res.json({ cleared: count });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/gm-override/count — count active GM overrides
router.get('/gm-override/count', async (req, res, next) => {
  try {
    const count = await Project.countGmOverrides(req.tenantId);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/backlog-snapshot — backlog totals, 6/12mo projections, and weighted GM%
router.get('/backlog-snapshot', async (req, res, next) => {
  try {
    const db = require('../config/database');
    const VistaData = require('../models/VistaData');
    const { calcBacklogSnapshot } = require('../utils/backlogFitCalculator');

    // Use effective GM%: apply override when real GM is ~100%
    const GM_EXPR = `CASE WHEN COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
                          AND p.override_gm_percent IS NOT NULL
                     THEN p.override_gm_percent
                     ELSE COALESCE(vc.gross_profit_percent, p.gross_margin_percent) END`;

    const [backlogResult, contracts] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(COALESCE(vc.backlog, p.backlog)), 0)::numeric AS total_backlog,
          CASE
            WHEN SUM(COALESCE(vc.backlog, p.backlog)) > 0
            THEN (
              SUM(COALESCE(vc.backlog, p.backlog) * (${GM_EXPR}))
              / SUM(CASE WHEN (${GM_EXPR}) IS NOT NULL THEN COALESCE(vc.backlog, p.backlog) ELSE 0 END)
            ) * 100
            ELSE NULL
          END AS weighted_gm_pct,
          CASE
            WHEN COUNT(${GM_EXPR}) > 0
            THEN AVG(${GM_EXPR}) * 100
            ELSE NULL
          END AS avg_project_gm_pct
        FROM projects p
        LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
        WHERE p.tenant_id = $1
          AND COALESCE(vc.backlog, p.backlog) > 0
          AND p.status NOT IN ('completed', 'cancelled', 'Hard-Closed')
      `, [req.tenantId]),
      VistaData.getAllContracts({ status: '' }, req.tenantId),
    ]);

    const backlogRow = backlogResult.rows[0] || {};
    const totalBacklog = parseFloat(backlogRow.total_backlog) || 0;

    // Fetch GM overrides for linked projects so calcBacklogSnapshot can apply them
    const overrideRows = await db.query(`
      SELECT vc.id AS contract_id, p.override_gm_percent
      FROM projects p
      JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1 AND p.override_gm_percent IS NOT NULL
    `, [req.tenantId]);
    const overrideMap = {};
    for (const r of overrideRows.rows) {
      overrideMap[r.contract_id] = parseFloat(r.override_gm_percent);
    }

    const snapshot = calcBacklogSnapshot(contracts, overrideMap);

    const nonVpBacklog = Math.max(0, totalBacklog - contracts.reduce((s, c) => {
      const st = (c.status || '').toLowerCase();
      if (!st.includes('open') && !st.includes('soft')) return s;
      return s + (parseFloat(c.backlog) || 0);
    }, 0));

    res.json({
      total_backlog: totalBacklog,
      weighted_gm_pct: backlogRow.weighted_gm_pct != null ? parseFloat(backlogRow.weighted_gm_pct) : null,
      avg_project_gm_pct: backlogRow.avg_project_gm_pct != null ? parseFloat(backlogRow.avg_project_gm_pct) : null,
      backlog_6mo: snapshot.backlog_6mo + nonVpBacklog,
      backlog_6mo_gm_pct: snapshot.backlog_6mo_gm_pct,
      backlog_12mo: snapshot.backlog_12mo + nonVpBacklog,
      backlog_12mo_gm_pct: snapshot.backlog_12mo_gm_pct,
    });
  } catch (error) {
    next(error);
  }
});

// Get single project (with tenant check)
router.get('/:id', async (req, res, next) => {
  try {
    // Foremen can only access assigned projects
    if (req.user.role === 'foreman') {
      const isAssigned = await ProjectAssignment.isAssigned(req.user.id, req.params.id, req.tenantId);
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied - not assigned to this project' });
      }
    }

    const project = await Project.findByIdAndTenant(req.params.id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Create project (with tenant and limit check)
router.post(
  '/',
  authorize('admin', 'manager'),
  checkLimit('max_projects', async (tenantId) => Project.countByTenant(tenantId)),
  [
    body('name').trim().notEmpty(),
    body('number').trim().notEmpty(),
    body('client').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const project = await Project.create({
        ...req.body,
        managerId: req.body.managerId || req.user.id,
        tenantId: req.tenantId,
      });

      // Auto-geocode in background if address provided
      if (req.body.address) {
        autoGeocodeProject(project.id);
      }

      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Update project (with tenant check)
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const project = await Project.update(req.params.id, req.body, req.tenantId, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Auto-geocode in background if address changed
    if (req.body.address) {
      autoGeocodeProject(project.id);
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Note: Favorite functionality moved to /api/favorites endpoints for per-user tracking

// Delete project (with tenant check)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const deleted = await Project.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
