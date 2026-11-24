const express = require('express');
const SafetyTeamMember = require('../models/SafetyTeamMember');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();
router.use(authenticate);
router.use(tenantContext);

// GET /api/safety-team-members
router.get('/', async (req, res, next) => {
  try {
    const members = await SafetyTeamMember.getAll(req.tenantId);
    res.json(members);
  } catch (err) { next(err); }
});

// POST /api/safety-team-members  { user_id }
router.post('/', async (req, res, next) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const member = await SafetyTeamMember.add(req.tenantId, user_id, req.user.id);
    res.status(201).json(member);
  } catch (err) { next(err); }
});

// PATCH /api/safety-team-members/:userId/color  { color }
router.patch('/:userId/color', async (req, res, next) => {
  try {
    const { color } = req.body;
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Invalid color' });
    const member = await SafetyTeamMember.updateColor(req.tenantId, parseInt(req.params.userId), color);
    res.json(member);
  } catch (err) { next(err); }
});

// DELETE /api/safety-team-members/:userId
router.delete('/:userId', async (req, res, next) => {
  try {
    await SafetyTeamMember.remove(req.tenantId, parseInt(req.params.userId));
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
