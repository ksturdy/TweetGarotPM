const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const Company = require('../models/Company');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Get contacts for a company
router.get('/company/:companyId', async (req, res, next) => {
  try {
    // Verify company belongs to tenant
    const company = await Company.findByIdAndTenant(req.params.companyId, req.tenantId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const contacts = await Contact.findByCompany(req.params.companyId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Get contacts for a project (all contacts from companies associated with the project)
router.get('/project/:projectId', async (req, res, next) => {
  try {
    // Verify project belongs to tenant
    const project = await Project.findByIdAndTenant(req.params.projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const contacts = await Contact.findByProject(req.params.projectId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Get single contact
router.get('/:id', async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    // Verify contact's company belongs to tenant
    if (contact.company_id) {
      const company = await Company.findByIdAndTenant(contact.company_id, req.tenantId);
      if (!company) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    }
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Create new contact
router.post('/', async (req, res, next) => {
  try {
    const { companyId, firstName, lastName, title, email, phone, mobile, isPrimary, notes } = req.body;

    if (!companyId || !firstName || !lastName) {
      return res.status(400).json({ error: 'Company ID, first name, and last name are required' });
    }

    // Verify company belongs to tenant
    const company = await Company.findByIdAndTenant(companyId, req.tenantId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const contact = await Contact.create({
      companyId,
      firstName,
      lastName,
      title,
      email,
      phone,
      mobile,
      isPrimary,
      notes,
    });

    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

// Update contact
router.put('/:id', async (req, res, next) => {
  try {
    const { companyId, firstName, lastName, title, email, phone, mobile, isPrimary, notes } = req.body;

    // First verify the contact exists and belongs to tenant
    const existingContact = await Contact.findById(req.params.id);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    if (existingContact.company_id) {
      const company = await Company.findByIdAndTenant(existingContact.company_id, req.tenantId);
      if (!company) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    }

    // If changing company, verify new company belongs to tenant
    if (companyId && companyId !== existingContact.company_id) {
      const newCompany = await Company.findByIdAndTenant(companyId, req.tenantId);
      if (!newCompany) {
        return res.status(404).json({ error: 'Company not found' });
      }
    }

    const contact = await Contact.update(req.params.id, {
      companyId,
      firstName,
      lastName,
      title,
      email,
      phone,
      mobile,
      isPrimary,
      notes,
    });

    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Delete contact
router.delete('/:id', async (req, res, next) => {
  try {
    // First verify the contact exists and belongs to tenant
    const existingContact = await Contact.findById(req.params.id);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    if (existingContact.company_id) {
      const company = await Company.findByIdAndTenant(existingContact.company_id, req.tenantId);
      if (!company) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    }

    await Contact.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
