const express = require('express');
const router = express.Router();
const db = require('../config/database');
const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const STATUS_LABELS = {
  submitted: 'Submitted',
  read: 'Read',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
  rejected: 'Rejected',
};

// All routes require authentication and tenant context
router.use(authenticate);
router.use(tenantContext);

// GET /api/feedback - Get all feedback with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, module, type, sortBy, order } = req.query;
    const feedback = await Feedback.findAllByTenant({ status, module, type, sortBy, order }, req.tenantId);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ message: 'Error fetching feedback', error: error.message });
  }
});

// GET /api/feedback/stats - Get feedback statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Feedback.getStatsByTenant(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ message: 'Error fetching feedback stats', error: error.message });
  }
});

// GET /api/feedback/:id - Get feedback by ID
router.get('/:id', async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndTenant(req.params.id, req.tenantId);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ message: 'Error fetching feedback', error: error.message });
  }
});

// POST /api/feedback - Create new feedback
router.post('/', async (req, res) => {
  try {
    const { module, submodule, title, description, type, priority } = req.body;

    if (!module || !title || !description || !type) {
      return res.status(400).json({ message: 'Module, title, description, and type are required' });
    }

    const feedback = await Feedback.create({
      userId: req.user.id,
      module,
      submodule,
      title,
      description,
      type,
      priority
    }, req.tenantId);

    // Notify all admin users (fire-and-forget)
    (async () => {
      try {
        const adminResult = await db.query(
          `SELECT id, email, first_name, last_name FROM users
           WHERE tenant_id = $1 AND role = 'admin' AND is_active = true AND id != $2`,
          [req.tenantId, req.user.id]
        );
        const admins = adminResult.rows;

        const submitterName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'A user';
        const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

        for (const admin of admins) {
          let emailSent = false;

          if (admin.email) {
            const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #002356, #004080); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .info-row { display: flex; margin-bottom: 10px; }
    .info-label { font-weight: 600; color: #6b7280; width: 120px; flex-shrink: 0; }
    .info-value { color: #1f2937; }
    .btn { display: inline-block; background: #002356; color: white !important; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 15px; }
    .footer { background: #f3f4f6; padding: 15px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>New Feedback Submitted</h1>
    <p>${title}</p>
  </div>
  <div class="content">
    <div class="info-row"><span class="info-label">Submitted By:</span><span class="info-value">${submitterName}</span></div>
    <div class="info-row"><span class="info-label">Type:</span><span class="info-value">${typeLabel}</span></div>
    <div class="info-row"><span class="info-label">Module:</span><span class="info-value">${module || '-'}</span></div>
    <div class="info-row"><span class="info-label">Priority:</span><span class="info-value">${(priority || 'medium').charAt(0).toUpperCase() + (priority || 'medium').slice(1)}</span></div>
    <p style="margin-top: 15px; color: #374151;">${description}</p>
    ${appBaseUrl ? `<p><a href="${appBaseUrl}/feedback" class="btn">View in TITAN</a></p>` : ''}
  </div>
  <div class="footer">
    <p>This is an automated notification from TITAN Project Management.</p>
  </div>
</body>
</html>`;

            const result = await sendEmail({
              to: admin.email,
              subject: `[TITAN] New Feedback: ${title}`,
              html,
              text: `${submitterName} submitted new feedback: "${title}"\n\nType: ${typeLabel}\nModule: ${module || '-'}\nPriority: ${priority || 'medium'}\n\n${description}`,
            });
            emailSent = result.success === true;
          }

          await Notification.create({
            tenantId: req.tenantId,
            userId: admin.id,
            entityType: 'feedback',
            entityId: feedback.id,
            eventType: 'created',
            title: 'New Feedback Submitted',
            message: `${submitterName} submitted feedback: "${title}"`,
            link: '/feedback',
            createdBy: req.user.id,
            emailSent,
          });
        }
      } catch (err) {
        console.error('Feedback admin notification error:', err);
      }
    })();

    res.status(201).json(feedback);
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ message: 'Error creating feedback', error: error.message });
  }
});

// PUT /api/feedback/:id - Update feedback
router.put('/:id', async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndTenant(req.params.id, req.tenantId);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Only admins can update status and priority, users can update their own feedback content
    if (req.user.role !== 'admin' && feedback.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this feedback' });
    }

    // Non-admins can only update title, description, module, submodule, type
    const updates = { ...req.body };
    if (req.user.role !== 'admin') {
      delete updates.status;
      delete updates.priority;
    }

    const updatedFeedback = await Feedback.update(req.params.id, updates, req.tenantId);

    // Notify the submitter when status changes (and updater is not the submitter)
    if (updates.status && updates.status !== feedback.status) {
      const oldLabel = STATUS_LABELS[feedback.status] || feedback.status;
      const newLabel = STATUS_LABELS[updates.status] || updates.status;

      // Fire-and-forget: don't block the response
      (async () => {
        try {
          await Notification.create({
            tenantId: req.tenantId,
            userId: feedback.user_id,
            entityType: 'feedback',
            entityId: feedback.id,
            eventType: 'status_changed',
            title: 'Feedback Status Updated',
            message: `Your feedback "${feedback.title}" was updated from ${oldLabel} to ${newLabel}`,
            link: '/feedback',
            createdBy: req.user.id,
            emailSent: false,
          });

          // Send email to submitter
          if (feedback.submitter_email) {
            const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #002356, #004080); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .info-row { display: flex; margin-bottom: 10px; }
    .info-label { font-weight: 600; color: #6b7280; width: 120px; flex-shrink: 0; }
    .info-value { color: #1f2937; }
    .btn { display: inline-block; background: #002356; color: white !important; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 15px; }
    .footer { background: #f3f4f6; padding: 15px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Feedback Status Updated</h1>
    <p>${feedback.title}</p>
  </div>
  <div class="content">
    <div class="info-row"><span class="info-label">Status:</span><span class="info-value">${oldLabel} → ${newLabel}</span></div>
    <div class="info-row"><span class="info-label">Type:</span><span class="info-value">${feedback.type || '-'}</span></div>
    <div class="info-row"><span class="info-label">Module:</span><span class="info-value">${feedback.module || '-'}</span></div>
    ${(process.env.APP_URL || process.env.FRONTEND_URL) ? `<p><a href="${process.env.APP_URL || process.env.FRONTEND_URL}/feedback" class="btn">View in TITAN</a></p>` : ''}
  </div>
  <div class="footer">
    <p>This is an automated notification from TITAN Project Management.</p>
  </div>
</body>
</html>`;

            await sendEmail({
              to: feedback.submitter_email,
              subject: `[TITAN] Feedback "${feedback.title}" — ${newLabel}`,
              html,
              text: `Your feedback "${feedback.title}" was updated from ${oldLabel} to ${newLabel}.`,
            });
          }
        } catch (err) {
          console.error('Feedback notification error:', err);
        }
      })();
    }

    res.json(updatedFeedback);
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ message: 'Error updating feedback', error: error.message });
  }
});

// DELETE /api/feedback/:id - Delete feedback
router.delete('/:id', async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndTenant(req.params.id, req.tenantId);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Only admins or the original submitter can delete
    if (req.user.role !== 'admin' && feedback.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this feedback' });
    }

    await Feedback.delete(req.params.id, req.tenantId);
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ message: 'Error deleting feedback', error: error.message });
  }
});

// GET /api/feedback/:id/vote - Get user's vote on feedback
router.get('/:id/vote', async (req, res) => {
  try {
    const vote = await Feedback.getUserVote(req.params.id, req.user.id);
    res.json(vote || null);
  } catch (error) {
    console.error('Error fetching vote:', error);
    res.status(500).json({ message: 'Error fetching vote', error: error.message });
  }
});

// POST /api/feedback/:id/vote - Add or update vote
router.post('/:id/vote', async (req, res) => {
  try {
    const { voteType } = req.body;

    if (!voteType || !['up', 'down'].includes(voteType)) {
      return res.status(400).json({ message: 'Valid vote type (up/down) is required' });
    }

    const feedback = await Feedback.findByIdAndTenant(req.params.id, req.tenantId);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    const vote = await Feedback.vote(req.params.id, req.user.id, voteType);
    res.json(vote);
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ message: 'Error voting', error: error.message });
  }
});

// DELETE /api/feedback/:id/vote - Remove vote
router.delete('/:id/vote', async (req, res) => {
  try {
    await Feedback.removeVote(req.params.id, req.user.id);
    res.json({ message: 'Vote removed successfully' });
  } catch (error) {
    console.error('Error removing vote:', error);
    res.status(500).json({ message: 'Error removing vote', error: error.message });
  }
});

// GET /api/feedback/:id/comments - Get all comments for feedback
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await Feedback.getComments(req.params.id);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Error fetching comments', error: error.message });
  }
});

// POST /api/feedback/:id/comments - Add comment
router.post('/:id/comments', async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'Comment is required' });
    }

    const feedback = await Feedback.findByIdAndTenant(req.params.id, req.tenantId);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    const newComment = await Feedback.addComment(req.params.id, req.user.id, comment);
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Error adding comment', error: error.message });
  }
});

// PUT /api/feedback/:id/comments/:commentId - Update comment
router.put('/:id/comments/:commentId', async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'Comment is required' });
    }

    const updatedComment = await Feedback.updateComment(req.params.commentId, req.user.id, comment);
    if (!updatedComment) {
      return res.status(404).json({ message: 'Comment not found or not authorized' });
    }

    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Error updating comment', error: error.message });
  }
});

// DELETE /api/feedback/:id/comments/:commentId - Delete comment
router.delete('/:id/comments/:commentId', async (req, res) => {
  try {
    const deletedComment = await Feedback.deleteComment(req.params.commentId, req.user.id);
    if (!deletedComment) {
      return res.status(404).json({ message: 'Comment not found or not authorized' });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment', error: error.message });
  }
});

module.exports = router;
