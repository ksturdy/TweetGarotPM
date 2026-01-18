const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const User = require('../models/User');
const { authenticate, authorize, authorizeHR } = require('../middleware/auth');

// Get all employees with optional filtering - requires HR read access
router.get('/', authenticate, authorizeHR('read'), async (req, res) => {
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

// Get employee by ID - requires HR read access
router.get('/:id', authenticate, authorizeHR('read'), async (req, res) => {
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

// Get employee by user ID - requires HR read access
router.get('/user/:userId', authenticate, authorizeHR('read'), async (req, res) => {
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

// Create employee - requires HR write access
router.post('/', authenticate, authorizeHR('write'), async (req, res) => {
  try {
    console.log('=== CREATE EMPLOYEE DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('===========================');

    let userId = req.body.user_id;

    // If createUserAccount is true, create a new user account
    if (req.body.createUserAccount && req.body.userPassword) {
      // Normalize email to lowercase for consistency with login
      const normalizedEmail = req.body.email.toLowerCase();

      // Check if user with this email already exists
      const existingUser = await User.findByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: 'A user account with this email already exists' });
      }

      // Create the user account
      const user = await User.create({
        email: normalizedEmail,
        password: req.body.userPassword,
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        role: req.body.userRole || 'user'
      });

      userId = user.id;
    }

    // Create the employee with the user_id
    const employee = await Employee.create({
      user_id: userId,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      phone: req.body.phone,
      mobile_phone: req.body.mobile_phone,
      department_id: req.body.department_id,
      office_location_id: req.body.office_location_id,
      job_title: req.body.job_title,
      hire_date: req.body.hire_date,
      employment_status: req.body.employment_status,
      notes: req.body.notes,
      role: req.body.role
    });
    res.status(201).json({ data: employee });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee - requires HR write access
router.put('/:id', authenticate, authorizeHR('write'), async (req, res) => {
  try {
    console.log('=== UPDATE EMPLOYEE DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('createUserAccount:', req.body.createUserAccount);
    console.log('userPassword:', req.body.userPassword ? '[SET]' : '[NOT SET]');
    console.log('first_name:', req.body.first_name);
    console.log('last_name:', req.body.last_name);
    console.log('===========================');

    let userId = req.body.user_id;

    // If createUserAccount is true, create a new user account
    if (req.body.createUserAccount && req.body.userPassword) {
      // Normalize email to lowercase for consistency with login
      const normalizedEmail = req.body.email.toLowerCase();

      // Check if user with this email already exists
      const existingUser = await User.findByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: 'A user account with this email already exists' });
      }

      // Create the user account
      const user = await User.create({
        email: normalizedEmail,
        password: req.body.userPassword,
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        role: req.body.userRole || 'user'
      });

      userId = user.id;
    }

    // Update the employee with the user_id if a new account was created
    const employee = await Employee.update(req.params.id, {
      user_id: userId || req.body.user_id,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      phone: req.body.phone,
      mobile_phone: req.body.mobile_phone,
      department_id: req.body.department_id,
      office_location_id: req.body.office_location_id,
      job_title: req.body.job_title,
      hire_date: req.body.hire_date,
      employment_status: req.body.employment_status,
      notes: req.body.notes,
      role: req.body.role
    });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ data: employee });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee - requires HR write access
router.delete('/:id', authenticate, authorizeHR('write'), async (req, res) => {
  try {
    await Employee.delete(req.params.id);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

module.exports = router;
