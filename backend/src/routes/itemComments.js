const express = require('express');
const router = express.Router();
const ItemComment = require('../models/ItemComment');
const { notify } = require('../utils/notificationService');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

function stripMentionMarkup(text) {
  return text.replace(/@\[([^\]]+)\]\(\d+\)/g, '@$1');
}

// GET /api/projects/:projectId/item-comments?entity_type=&entity_key=
router.get('/:projectId/item-comments', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { entity_type, entity_key } = req.query;

    if (!entity_type) {
      return res.status(400).json({ error: 'entity_type is required' });
    }

    if (entity_key) {
      const comments = await ItemComment.findByEntityKey(req.tenantId, projectId, entity_type, entity_key);
      return res.json(comments);
    }

    // Return counts grouped by entity_key for the whole entity_type (used for badge counts)
    const counts = await ItemComment.findCountsByEntityType(req.tenantId, projectId, entity_type);
    return res.json(counts);
  } catch (err) {
    console.error('Error fetching item comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/projects/:projectId/item-comments
router.post('/:projectId/item-comments', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { entity_type, entity_key, comment, link, mentioned_user_ids, row_label } = req.body;

    if (!entity_type || !entity_key || !comment || !comment.trim()) {
      return res.status(400).json({ error: 'entity_type, entity_key, and comment are required' });
    }

    const newComment = await ItemComment.create({
      tenantId: req.tenantId,
      projectId,
      userId: req.user.id,
      entityType: entity_type,
      entityKey: entity_key,
      comment: comment.trim(),
      link: link || null,
    });

    const commenterName = `${req.user.first_name} ${req.user.last_name}`.trim();
    const label = row_label || entity_key;
    const plainText = stripMentionMarkup(comment.trim());
    const notifMessage = plainText.length > 120 ? plainText.slice(0, 120) + '…' : plainText;

    const mentionedUserIds = Array.isArray(mentioned_user_ids) ? mentioned_user_ids : [];
    for (const mentionedUserId of mentionedUserIds) {
      notify({
        tenantId: req.tenantId,
        projectId,
        entityType: 'item_comment',
        entityId: newComment.id,
        eventType: 'mentioned_in_comment',
        title: `${commenterName} mentioned you — ${label}`,
        message: `mentioned you in a comment on ${label}`,
        link: link || null,
        createdBy: req.user.id,
        targetUserId: mentionedUserId,
        emailSubject: `Mentioned in a Comment — ${label}`,
        emailDetails: [{ label: 'Comment', value: notifMessage }],
      }).catch(err => console.error('Error sending mention notification:', err));
    }

    res.status(201).json(newComment);
  } catch (err) {
    console.error('Error creating item comment:', err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// DELETE /api/projects/:projectId/item-comments/:commentId
router.delete('/:projectId/item-comments/:commentId', async (req, res) => {
  try {
    const deleted = await ItemComment.delete(
      Number(req.params.commentId),
      req.user.id,
      req.tenantId
    );
    if (!deleted) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }
    res.json({ id: deleted.id });
  } catch (err) {
    console.error('Error deleting item comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
