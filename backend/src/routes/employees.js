const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { authenticate, authorize } = require('../middleware/auth');

// Get all employees with optional filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      department_id: req.query.department_id,
      office_location_id: req.query.office_location_id,
      employment_status: req.query.employment_status,
      search: req.query.search,
    };
    const employees = await Employee.getAll(filters);
    res.json({ data: employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get employee by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const employee = await Employee.getById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ data: employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Get employee by user ID
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const employee = await Employee.getByUserId(req.params.userId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found for this user' });
    }
    res.json({ data: employee });
  } catch (error) {
    console.error('Error fetching employee by user ID:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Create employee - Admin only
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const employee = await Employee.create(req.body);
    res.status(201).json({ data: employee });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee - Admin only
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const employee = await Employee.update(req.params.id, req.body);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ data: employee });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee - Admin only
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Employee.delete(req.params.id);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

module.exports = router;
