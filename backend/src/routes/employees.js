const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const User = require('../models/User');
const { authenticate, authorize, authorizeHR } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Get all employees with optional filtering - requires HR read access
router.get('/', authorizeHR('read'), async (req, res) => {
  try {
    const filters = {
      department_id: req.query.department_id,
      office_location_id: req.query.office_location_id,
      employment_status: req.query.employment_status,
      search: req.query.search,
    };
    const employees = await Employee.getAll(filters, req.tenantId);
    res.json({ data: employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get employee by user ID - allows users to look up their own record, HR read for others
// IMPORTANT: This route must come BEFORE /:id to prevent /user/:userId from matching /:id
router.get('/user/:userId', async (req, res) => {
  try {
    const requestedUserId = parseInt(req.params.userId, 10);
    const currentUserId = req.user.id;

    // Allow users to look up their own employee record without HR permissions
    // For looking up other users' employee records, check HR read access
    if (requestedUserId !== currentUserId) {
      // Check if user has HR read access for looking up other employees
      const hasHRAccess = req.user.role === 'admin' ||
        (req.user.hrAccess && (req.user.hrAccess === 'read' || req.user.hrAccess === 'write'));
      if (!hasHRAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const employee = await Employee.getByUserId(req.params.userId, req.tenantId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found for this user' });
    }
    res.json({ data: employee });
  } catch (error) {
    console.error('Error fetching employee by user ID:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Get employee by ID - requires HR read access
router.get('/:id', authorizeHR('read'), async (req, res) => {
  try {
    const employee = await Employee.getByIdAndTenant(req.params.id, req.tenantId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ data: employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Create employee - requires HR write access
router.post('/', authorizeHR('write'), async (req, res) => {
  try {
    console.log('=== CREATE EMPLOYEE DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('===========================');

    let userId = req.body.user_id;

    // If createUserAccount is true, create a new user account
    if (req.body.createUserAccount && req.body.userPassword) {
      // Normalize email to lowercase for consistency with login
      const normalizedEmail = req.body.email.toLowerCase();

      // Check if user with this email already exists in this tenant
      const existingUser = await User.findByEmailAndTenant(normalizedEmail, req.tenantId);
      if (existingUser) {
        return res.status(400).json({ error: 'A user account with this email already exists' });
      }

      // Create the user account with tenant ID
      const user = await User.create({
        email: normalizedEmail,
        password: req.body.userPassword,
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        role: req.body.userRole || 'user',
        tenantId: req.tenantId
      });

      userId = user.id;
    }

    // Create the employee with the user_id and tenant ID
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
    }, req.tenantId);
    res.status(201).json({ data: employee });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee - requires HR write access
router.put('/:id', authorizeHR('write'), async (req, res) => {
  try {
    console.log('=== UPDATE EMPLOYEE DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('createUserAccount:', req.body.createUserAccount);
    console.log('userPassword:', req.body.userPassword ? '[SET]' : '[NOT SET]');
    console.log('first_name:', req.body.first_name);
    console.log('last_name:', req.body.last_name);
    console.log('===========================');

    // Verify employee belongs to tenant first
    const existingEmployee = await Employee.getByIdAndTenant(req.params.id, req.tenantId);
    if (!existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let userId = req.body.user_id;

    // If createUserAccount is true, create a new user account
    if (req.body.createUserAccount && req.body.userPassword) {
      // Normalize email to lowercase for consistency with login
      const normalizedEmail = req.body.email.toLowerCase();

      // Check if user with this email already exists in this tenant
      const existingUser = await User.findByEmailAndTenant(normalizedEmail, req.tenantId);
      if (existingUser) {
        return res.status(400).json({ error: 'A user account with this email already exists' });
      }

      // Create the user account with tenant ID
      const user = await User.create({
        email: normalizedEmail,
        password: req.body.userPassword,
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        role: req.body.userRole || 'user',
        tenantId: req.tenantId
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
    }, req.tenantId);
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
router.delete('/:id', authorizeHR('write'), async (req, res) => {
  try {
    const deleted = await Employee.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

module.exports = router;
