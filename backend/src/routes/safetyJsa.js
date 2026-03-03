const express = require('express');
const { body, validationResult } = require('express-validator');
const SafetyJsa = require('../models/SafetyJsa');
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

const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId || req.body.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

// Get JSAs for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status };
    const jsas = await SafetyJsa.findByProject(req.params.projectId, filters);
    res.json(jsas);
  } catch (error) {
    next(error);
  }
});

// Get single JSA with hazards and signatures
router.get('/:id', async (req, res, next) => {
  try {
    const jsa = await SafetyJsa.findById(req.params.id);
    if (!jsa) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(jsa.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const hazards = await SafetyJsa.getHazards(req.params.id);
    const signatures = await SafetyJsa.getSignatures(req.params.id);
    res.json({ ...jsa, hazards, signatures });
  } catch (error) {
    next(error);
  }
});

// Create JSA
router.post(
  '/',
  [
    body('project_id').isInt(),
    body('task_description').trim().notEmpty(),
    body('date_of_work').isDate(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const projectId = req.body.project_id || req.body.projectId;
      const number = await SafetyJsa.getNextNumber(projectId);
      const jsa = await SafetyJsa.create({
        projectId,
        tenantId: req.tenantId,
        number,
        taskDescription: req.body.task_description,
        workLocation: req.body.work_location,
        dateOfWork: req.body.date_of_work,
        weather: req.body.weather,
        temperature: req.body.temperature,
        ppeRequired: req.body.ppe_required,
        notes: req.body.notes,
        createdBy: req.user.id,
      });
      res.status(201).json(jsa);
    } catch (error) {
      next(error);
    }
  }
);

// Update JSA
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const jsa = await SafetyJsa.update(req.params.id, req.body);
    res.json(jsa);
  } catch (error) {
    next(error);
  }
});

// Add hazard
router.post(
  '/:id/hazards',
  [
    body('step_description').trim().notEmpty(),
    body('hazard').trim().notEmpty(),
    body('control_measure').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existing = await SafetyJsa.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const hazard = await SafetyJsa.addHazard(req.params.id, {
        sortOrder: req.body.sort_order,
        stepDescription: req.body.step_description,
        hazard: req.body.hazard,
        controlMeasure: req.body.control_measure,
        responsiblePerson: req.body.responsible_person,
      });
      res.status(201).json(hazard);
    } catch (error) {
      next(error);
    }
  }
);

// Update hazard
router.put('/:id/hazards/:hazardId', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const hazard = await SafetyJsa.updateHazard(req.params.hazardId, req.body);
    res.json(hazard);
  } catch (error) {
    next(error);
  }
});

// Delete hazard
router.delete('/:id/hazards/:hazardId', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    await SafetyJsa.deleteHazard(req.params.hazardId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Add signature
router.post(
  '/:id/sign',
  [body('employee_name').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const existing = await SafetyJsa.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const signature = await SafetyJsa.addSignature(req.params.id, {
        employeeName: req.body.employee_name || req.body.employeeName,
        employeeId: req.body.employee_id || req.body.employeeId,
        signatureData: req.body.signature_data || req.body.signatureData,
      });
      res.status(201).json(signature);
    } catch (error) {
      next(error);
    }
  }
);

// Activate JSA
router.post('/:id/activate', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const jsa = await SafetyJsa.activate(req.params.id);
    res.json(jsa);
  } catch (error) {
    next(error);
  }
});

// Complete JSA
router.post('/:id/complete', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const jsa = await SafetyJsa.complete(req.params.id, { reviewedBy: req.user.id });
    res.json(jsa);
  } catch (error) {
    next(error);
  }
});

// Delete (draft only)
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft JSAs can be deleted' });
    }
    await SafetyJsa.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
