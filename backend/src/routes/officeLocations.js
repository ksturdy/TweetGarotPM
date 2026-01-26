const express = require('express');
const router = express.Router();
const OfficeLocation = require('../models/OfficeLocation');
const { authenticate, authorize, authorizeHR } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('hr_module'));

// Get all office locations - requires HR read access
router.get('/', authorizeHR('read'), async (req, res) => {
  try {
    const locations = await OfficeLocation.getAll(req.tenantId);
    res.json({ data: locations });
  } catch (error) {
    console.error('Error fetching office locations:', error);
    res.status(500).json({ error: 'Failed to fetch office locations' });
  }
});

// Get office location by ID - requires HR read access
router.get('/:id', authorizeHR('read'), async (req, res) => {
  try {
    const location = await OfficeLocation.getByIdAndTenant(req.params.id, req.tenantId);
    if (!location) {
      return res.status(404).json({ error: 'Office location not found' });
    }

    // Get employee count
    const employeeCount = await OfficeLocation.getEmployeeCount(req.params.id, req.tenantId);
    location.employee_count = employeeCount;

    res.json({ data: location });
  } catch (error) {
    console.error('Error fetching office location:', error);
    res.status(500).json({ error: 'Failed to fetch office location' });
  }
});

// Create office location - requires HR write access
router.post('/', authorizeHR('write'), async (req, res) => {
  try {
    const location = await OfficeLocation.create(req.body, req.tenantId);
    res.status(201).json({ data: location });
  } catch (error) {
    console.error('Error creating office location:', error);
    res.status(500).json({ error: 'Failed to create office location' });
  }
});

// Update office location - requires HR write access
router.put('/:id', authorizeHR('write'), async (req, res) => {
  try {
    const location = await OfficeLocation.update(req.params.id, req.body, req.tenantId);
    if (!location) {
      return res.status(404).json({ error: 'Office location not found' });
    }
    res.json({ data: location });
  } catch (error) {
    console.error('Error updating office location:', error);
    res.status(500).json({ error: 'Failed to update office location' });
  }
});

// Delete office location - requires HR write access
router.delete('/:id', authorizeHR('write'), async (req, res) => {
  try {
    // Check if location has employees
    const employeeCount = await OfficeLocation.getEmployeeCount(req.params.id, req.tenantId);
    if (employeeCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete office location with active employees'
      });
    }

    const deleted = await OfficeLocation.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Office location not found' });
    }
    res.json({ message: 'Office location deleted successfully' });
  } catch (error) {
    console.error('Error deleting office location:', error);
    res.status(500).json({ error: 'Failed to delete office location' });
  }
});

module.exports = router;
