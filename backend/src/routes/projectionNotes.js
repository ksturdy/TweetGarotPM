const express = require('express');
const router = express.Router();
const ProjectionNote = require('../models/ProjectionNote');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

// GET /api/projects/:projectId/projection-notes
//   query: type=note|homework|gain_fade, snapshot_id=<id>|null
router.get('/:projectId/projection-notes', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const tenantId = req.tenantId;
    const { type } = req.query;

    let snapshotId;
    if (req.query.snapshot_id === 'null') snapshotId = null;
    else if (req.query.snapshot_id !== undefined) snapshotId = Number(req.query.snapshot_id);

    const notes = await ProjectionNote.findByProject(projectId, tenantId, { type, snapshotId });
    res.json(notes);
  } catch (err) {
    console.error('Error fetching projection notes:', err);
    res.status(500).json({ error: 'Failed to fetch projection notes' });
  }
});

// GET /api/projects/:projectId/projection-notes/counts
//   returns aggregated counts per cost_type + type, used for row badges
router.get('/:projectId/projection-notes/counts', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const tenantId = req.tenantId;
    const counts = await ProjectionNote.countsByProject(projectId, tenantId);
    res.json(counts);
  } catch (err) {
    console.error('Error fetching projection note counts:', err);
    res.status(500).json({ error: 'Failed to fetch projection note counts' });
  }
});

// POST /api/projects/:projectId/projection-notes
router.post('/:projectId/projection-notes', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const {
      type, body,
      cost_type, trade,
      category, groups_affected,
      assigned_to, due_date,
      amount, recognized_in_financials, recognized_at,
      snapshot_id,
    } = req.body;

    if (!type || !['note', 'gain_fade'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Body is required' });
    }

    const note = await ProjectionNote.create({
      tenantId,
      projectId,
      snapshotId: snapshot_id ?? null,
      costType: cost_type ?? null,
      trade: trade || null,
      type,
      body: body.trim(),
      category: category || null,
      groupsAffected: Array.isArray(groups_affected) && groups_affected.length > 0 ? groups_affected : null,
      assignedTo: assigned_to ?? null,
      dueDate: due_date || null,
      amount: amount ?? null,
      recognizedInFinancials: !!recognized_in_financials,
      recognizedAt: recognized_at || null,
      createdBy: userId,
    });

    res.status(201).json(note);
  } catch (err) {
    console.error('Error creating projection note:', err);
    res.status(500).json({ error: 'Failed to create projection note' });
  }
});

// PATCH /api/projects/:projectId/projection-notes/:id
router.patch('/:projectId/projection-notes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = req.tenantId;
    const userId = req.user.id;

    const note = await ProjectionNote.update(id, tenantId, userId, req.body);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    console.error('Error updating projection note:', err);
    res.status(500).json({ error: 'Failed to update projection note' });
  }
});

// PATCH /api/projects/:projectId/projection-notes/:id/status
router.patch('/:projectId/projection-notes/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const { status } = req.body;

    if (!['open', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const note = await ProjectionNote.setStatus(id, tenantId, userId, status);
    res.json(note);
  } catch (err) {
    console.error('Error updating homework status:', err);
    res.status(500).json({ error: 'Failed to update homework status' });
  }
});

// DELETE /api/projects/:projectId/projection-notes/:id
router.delete('/:projectId/projection-notes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = req.tenantId;
    const userId = req.user.id;

    const deleted = await ProjectionNote.delete(id, tenantId, userId);
    if (!deleted) return res.status(404).json({ error: 'Note not found or not owned by user' });
    res.json({ id: deleted.id });
  } catch (err) {
    console.error('Error deleting projection note:', err);
    res.status(500).json({ error: 'Failed to delete projection note' });
  }
});

module.exports = router;
