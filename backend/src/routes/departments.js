const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { authenticate, authorize } = require('../middleware/auth');

// Get all departments
router.get('/', authenticate, async (req, res) => {
  try {
    const departments = await Department.getAll();
    res.json({ data: departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get department by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const department = await Department.getById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Get employee count
    const employeeCount = await Department.getEmployeeCount(req.params.id);
    department.employee_count = employeeCount;

    res.json({ data: department });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create department - Admin only
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const department = await Department.create(req.body);
    res.status(201).json({ data: department });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update department - Admin only
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const department = await Department.update(req.params.id, req.body);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ data: department });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department - Admin only
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Check if department has employees
    const employeeCount = await Department.getEmployeeCount(req.params.id);
    if (employeeCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete department with active employees'
      });
    }

    await Department.delete(req.params.id);
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

module.exports = router;
