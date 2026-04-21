const express = require('express');
const { authenticate } = require('../middleware/auth');
const DirectMessage = require('../models/DirectMessage');
const Presence = require('../models/Presence');

const router = express.Router();
router.use(authenticate);

// GET /api/dm/conversations - list user's conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await DirectMessage.getConversationsForUser(
      req.user.id, req.user.tenantId
    );
    res.json(conversations);
  } catch (err) { next(err); }
});

// GET /api/dm/conversations/:id/messages - get messages (paginated)
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const isParticipant = await DirectMessage.isParticipant(req.params.id, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this conversation' });
    }

    const messages = await DirectMessage.getMessages(parseInt(req.params.id), {
      limit: parseInt(req.query.limit) || 50,
      before: req.query.before || null,
    });
    res.json(messages);
  } catch (err) { next(err); }
});

// POST /api/dm/conversations/dm - find or create a 1-on-1 conversation
router.post('/conversations/dm', async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ error: 'recipientId is required' });
    }
    const convId = await DirectMessage.findOrCreateConversation(
      req.user.tenantId, req.user.id, recipientId
    );
    const conversations = await DirectMessage.getConversationsForUser(req.user.id, req.user.tenantId);
    const full = conversations.find(c => c.id === convId);
    res.json(full || { id: convId });
  } catch (err) { next(err); }
});

// POST /api/dm/conversations/group - create a group conversation
router.post('/conversations/group', async (req, res, next) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds || memberIds.length < 1) {
      return res.status(400).json({ error: 'Group name and at least one other member required' });
    }
    const conversation = await DirectMessage.createGroupConversation(
      req.user.tenantId, req.user.id, name, memberIds
    );
    // Fetch full conversation with participants
    const conversations = await DirectMessage.getConversationsForUser(req.user.id, req.user.tenantId);
    const full = conversations.find(c => c.id === conversation.id);
    res.status(201).json(full || conversation);
  } catch (err) { next(err); }
});

// PUT /api/dm/conversations/:id - update group name
router.put('/conversations/:id', async (req, res, next) => {
  try {
    const isParticipant = await DirectMessage.isParticipant(req.params.id, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this conversation' });
    }
    const updated = await DirectMessage.updateGroupName(parseInt(req.params.id), req.body.name);
    res.json(updated);
  } catch (err) { next(err); }
});

// PUT /api/dm/conversations/:id/members - add members
router.put('/conversations/:id/members', async (req, res, next) => {
  try {
    const isParticipant = await DirectMessage.isParticipant(req.params.id, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this conversation' });
    }
    const { addIds, removeIds } = req.body;
    if (addIds && addIds.length > 0) {
      await DirectMessage.addMembers(parseInt(req.params.id), addIds);
    }
    if (removeIds && removeIds.length > 0) {
      for (const uid of removeIds) {
        await DirectMessage.removeMember(parseInt(req.params.id), uid);
      }
    }
    const participants = await DirectMessage.getParticipants(parseInt(req.params.id));
    res.json(participants);
  } catch (err) { next(err); }
});

// GET /api/dm/unread-count - total unread across all conversations
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await DirectMessage.getTotalUnreadCount(
      req.user.id, req.user.tenantId
    );
    res.json({ count });
  } catch (err) { next(err); }
});

// GET /api/dm/presence - get all user presence for tenant
router.get('/presence', async (req, res, next) => {
  try {
    const presence = await Presence.getAllPresence(req.user.tenantId);
    res.json(presence);
  } catch (err) { next(err); }
});

module.exports = router;
