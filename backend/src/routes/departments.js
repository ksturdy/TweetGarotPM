const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { authenticate, authorize, authorizeHR } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('hr_module'));

// Get all departments - requires HR read access
router.get('/', authorizeHR('read'), async (req, res) => {
  try {
    const departments = await Department.getAll(req.tenantId);
    res.json({ data: departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get department by ID - requires HR read access
router.get('/:id', authorizeHR('read'), async (req, res) => {
  try {
    const department = await Department.getByIdAndTenant(req.params.id, req.tenantId);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Get employee count
    const employeeCount = await Department.getEmployeeCount(req.params.id, req.tenantId);
    department.employee_count = employeeCount;

    res.json({ data: department });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create department - requires HR write access
router.post('/', authorizeHR('write'), async (req, res) => {
  try {
    const department = await Department.create(req.body, req.tenantId);
    res.status(201).json({ data: department });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update department - requires HR write access
router.put('/:id', authorizeHR('write'), async (req, res) => {
  try {
    const department = await Department.update(req.params.id, req.body, req.tenantId);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ data: department });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department - requires HR write access
router.delete('/:id', authorizeHR('write'), async (req, res) => {
  try {
    // Check if department has employees
    const employeeCount = await Department.getEmployeeCount(req.params.id, req.tenantId);
    if (employeeCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete department with active employees'
      });
    }

    const deleted = await Department.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

module.exports = router;
