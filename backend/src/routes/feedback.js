const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

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
