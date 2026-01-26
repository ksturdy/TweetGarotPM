const express = require('express');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

// Apply auth and tenant middleware
router.use(authenticate);
router.use(tenantContext);

// Get all users (for dropdowns) - tenant-scoped
router.get('/', async (req, res, next) => {
  try {
    const users = await User.findAllByTenant(req.tenantId);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get single user - verify belongs to same tenant
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findByIdAndTenant(req.params.id, req.tenantId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user - verify belongs to same tenant
router.put('/:id', async (req, res, next) => {
  try {
    // First verify the user belongs to the same tenant
    const existingUser = await User.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { email, first_name, last_name, role, hr_access, is_active } = req.body;
    const user = await User.update(req.params.id, {
      email,
      firstName: first_name,
      lastName: last_name,
      role,
      hrAccess: hr_access,
      isActive: is_active
    }, req.tenantId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user status (activate/deactivate) - verify belongs to same tenant
router.patch('/:id/status', async (req, res, next) => {
  try {
    // First verify the user belongs to the same tenant
    const existingUser = await User.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { is_active } = req.body;
    const user = await User.updateStatus(req.params.id, is_active, req.tenantId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Delete user - verify belongs to same tenant
router.delete('/:id', async (req, res, next) => {
  try {
    // First verify the user belongs to the same tenant
    const existingUser = await User.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.delete(req.params.id, req.tenantId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
 
