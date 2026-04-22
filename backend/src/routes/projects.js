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

// Download Project Locations as PDF (POST to accept map image in body)
router.post('/map-locations/pdf', async (req, res) => {
  try {
    const { generateProjectLocationsPdfBuffer } = require('../utils/projectLocationsPdfBuffer');

    const filters = {
      status: req.body.status || undefined,
      market: req.body.market || undefined,
      manager: req.body.manager || undefined,
      customer: req.body.customer || undefined,
      dateFrom: req.body.dateFrom || undefined,
      dateTo: req.body.dateTo || undefined,
    };

    const mapImage = req.body.mapImage || undefined;
    const includeList = req.body.includeList === true;

    // Get all map locations with server-side filters
    let locations = await Project.findMapLocations(req.tenantId, {
      status: filters.status,
      market: filters.market,
    });

    // Apply client-side filters (manager, customer, date range)
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
      mapImage,
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
    const project = await Project.update(req.params.id, req.body, req.tenantId);
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
