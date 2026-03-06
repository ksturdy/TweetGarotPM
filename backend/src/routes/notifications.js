const express = require('express');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

// Get notifications for current user
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    const [notifications, unreadCount] = await Promise.all([
      Notification.findByUser(req.user.id, req.tenantId, { limit, offset, unreadOnly }),
      Notification.countUnread(req.user.id, req.tenantId),
    ]);

    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

// Get unread count only
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countUnread(req.user.id, req.tenantId);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

// Mark single notification as read
router.put('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.markAsRead(req.params.id, req.user.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

// Mark all as read
router.put('/read-all', async (req, res, next) => {
  try {
    await Notification.markAllAsRead(req.user.id, req.tenantId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
