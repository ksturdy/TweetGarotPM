const express = require('express');
const router = express.Router();
const DashboardLayout = require('../models/DashboardLayout');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const row = await DashboardLayout.getByUserId(req.user.id);
    res.json(row || null);
  } catch (error) {
    console.error('Error fetching dashboard layout:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard layout' });
  }
});

router.put('/', authenticate, async (req, res) => {
  try {
    const { layout } = req.body;
    if (!Array.isArray(layout)) {
      return res.status(400).json({ error: 'layout must be an array' });
    }
    const saved = await DashboardLayout.upsert(req.user.id, layout);
    res.json(saved);
  } catch (error) {
    console.error('Error saving dashboard layout:', error);
    res.status(500).json({ error: 'Failed to save dashboard layout' });
  }
});

router.delete('/', authenticate, async (req, res) => {
  try {
    await DashboardLayout.remove(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting dashboard layout:', error);
    res.status(500).json({ error: 'Failed to reset dashboard layout' });
  }
});

module.exports = router;
