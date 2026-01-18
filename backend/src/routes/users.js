const express = require('express');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all users (for dropdowns)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get single user
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { email, first_name, last_name, role, hr_access, is_active } = req.body;
    const user = await User.update(req.params.id, {
      email,
      firstName: first_name,
      lastName: last_name,
      role,
      hrAccess: hr_access,
      isActive: is_active
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user status (activate/deactivate)
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const user = await User.updateStatus(req.params.id, is_active);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await User.delete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
 
