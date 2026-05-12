const express = require('express');
const { body, param, validationResult } = require('express-validator');
const PhaseGCLink = require('../models/PhaseGCLink');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Verify the schedule item belongs to the caller's tenant.
const verifyItemTenant = async (req, res, next) => {
  try {
    const itemId = req.params.itemId;
    const item = await PhaseGCLink.getItemTenant(itemId);
    if (!item) return res.status(404).json({ error: 'Schedule item not found' });
    if (item.tenant_id !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });
    req.scheduleItemProjectId = item.project_id;
    next();
  } catch (err) {
    next(err);
  }
};

// Get the active GC version id for a project (latest 'completed' parse).
router.get('/project/:projectId/active-version',
  [param('projectId').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const project = await Project.findByIdAndTenant(req.params.projectId, req.tenantId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const versionId = await PhaseGCLink.getActiveVersionId(req.params.projectId, req.tenantId);
      res.json({ activeVersionId: versionId });
    } catch (err) {
      next(err);
    }
  }
);

// List links for a specific schedule item (with current activity_id values).
router.get('/item/:itemId',
  [param('itemId').isInt()],
  validate,
  verifyItemTenant,
  async (req, res, next) => {
    try {
      const links = await PhaseGCLink.listForItem(req.params.itemId, req.tenantId);
      res.json(links);
    } catch (err) {
      next(err);
    }
  }
);

// Replace the full set of links for a schedule item.
// Body: { gc_activity_ids: string[] }  (text activity_id values from gc_schedule_activities)
router.put('/item/:itemId',
  [
    param('itemId').isInt(),
    body('gc_activity_ids').isArray(),
  ],
  validate,
  verifyItemTenant,
  async (req, res, next) => {
    try {
      const inserted = await PhaseGCLink.replaceForItem({
        itemId: Number(req.params.itemId),
        projectId: req.scheduleItemProjectId,
        tenantId: req.tenantId,
        gcActivityIds: req.body.gc_activity_ids,
        userId: req.user?.id,
      });
      res.json({ links: inserted });
    } catch (err) {
      next(err);
    }
  }
);

// Remove a single link.
router.delete('/item/:itemId/activity/:gcActivityId',
  [param('itemId').isInt()],
  validate,
  verifyItemTenant,
  async (req, res, next) => {
    try {
      const ok = await PhaseGCLink.removeOne({
        itemId: Number(req.params.itemId),
        tenantId: req.tenantId,
        gcActivityId: req.params.gcActivityId,
      });
      if (!ok) return res.status(404).json({ error: 'Link not found' });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
