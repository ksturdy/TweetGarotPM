const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { authenticate } = require('../middleware/auth');

// Get all companies
router.get('/', authenticate, async (req, res, next) => {
  try {
    const companies = await Company.findAll();
    res.json(companies);
  } catch (error) {
    next(error);
  }
});

// Get companies for a specific project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const companies = await Company.findByProject(req.params.projectId);
    res.json(companies);
  } catch (error) {
    next(error);
  }
});

// Get single company
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// Create new company
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, address, city, state, zip, phone, email, website, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const company = await Company.create({
      name,
      address,
      city,
      state,
      zip,
      phone,
      email,
      website,
      notes,
    });

    res.status(201).json(company);
  } catch (error) {
    next(error);
  }
});

// Update company
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { name, address, city, state, zip, phone, email, website, notes } = req.body;

    const company = await Company.update(req.params.id, {
      name,
      address,
      city,
      state,
      zip,
      phone,
      email,
      website,
      notes,
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(company);
  } catch (error) {
    next(error);
  }
});

// Delete company
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await Company.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Add company to project
router.post('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const { companyId, role, isPrimary, notes } = req.body;

    if (!companyId || !role) {
      return res.status(400).json({ error: 'Company ID and role are required' });
    }

    const projectCompany = await Company.addToProject({
      projectId: req.params.projectId,
      companyId,
      role,
      isPrimary,
      notes,
    });

    res.status(201).json(projectCompany);
  } catch (error) {
    next(error);
  }
});

// Update project-company relationship
router.put('/project-company/:id', authenticate, async (req, res, next) => {
  try {
    const { role, isPrimary, notes } = req.body;

    const projectCompany = await Company.updateProjectCompany(req.params.id, {
      role,
      isPrimary,
      notes,
    });

    if (!projectCompany) {
      return res.status(404).json({ error: 'Project company relationship not found' });
    }

    res.json(projectCompany);
  } catch (error) {
    next(error);
  }
});

// Remove company from project
router.delete('/project-company/:id', authenticate, async (req, res, next) => {
  try {
    await Company.removeFromProject(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
