const express = require('express');
const router = express.Router();
const OfficeLocation = require('../models/OfficeLocation');
const { authenticate, authorize } = require('../middleware/auth');

// Get all office locations
router.get('/', authenticate, async (req, res) => {
  try {
    const locations = await OfficeLocation.getAll();
    res.json({ data: locations });
  } catch (error) {
    console.error('Error fetching office locations:', error);
    res.status(500).json({ error: 'Failed to fetch office locations' });
  }
});

// Get office location by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const location = await OfficeLocation.getById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Office location not found' });
    }

    // Get employee count
    const employeeCount = await OfficeLocation.getEmployeeCount(req.params.id);
    location.employee_count = employeeCount;

    res.json({ data: location });
  } catch (error) {
    console.error('Error fetching office location:', error);
    res.status(500).json({ error: 'Failed to fetch office location' });
  }
});

// Create office location - Admin only
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const location = await OfficeLocation.create(req.body);
    res.status(201).json({ data: location });
  } catch (error) {
    console.error('Error creating office location:', error);
    res.status(500).json({ error: 'Failed to create office location' });
  }
});

// Update office location - Admin only
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const location = await OfficeLocation.update(req.params.id, req.body);
    if (!location) {
      return res.status(404).json({ error: 'Office location not found' });
    }
    res.json({ data: location });
  } catch (error) {
    console.error('Error updating office location:', error);
    res.status(500).json({ error: 'Failed to update office location' });
  }
});

// Delete office location - Admin only
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Check if location has employees
    const employeeCount = await OfficeLocation.getEmployeeCount(req.params.id);
    if (employeeCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete office location with active employees'
      });
    }

    await OfficeLocation.delete(req.params.id);
    res.json({ message: 'Office location deleted successfully' });
  } catch (error) {
    console.error('Error deleting office location:', error);
    res.status(500).json({ error: 'Failed to delete office location' });
  }
});

module.exports = router;
