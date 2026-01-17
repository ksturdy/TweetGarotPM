const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const { authenticate } = require('../middleware/auth');

// Get contacts for a company
router.get('/company/:companyId', authenticate, async (req, res, next) => {
  try {
    const contacts = await Contact.findByCompany(req.params.companyId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Get contacts for a project (all contacts from companies associated with the project)
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const contacts = await Contact.findByProject(req.params.projectId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Get single contact
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Create new contact
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { companyId, firstName, lastName, title, email, phone, mobile, isPrimary, notes } = req.body;

    if (!companyId || !firstName || !lastName) {
      return res.status(400).json({ error: 'Company ID, first name, and last name are required' });
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
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { companyId, firstName, lastName, title, email, phone, mobile, isPrimary, notes } = req.body;

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

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Delete contact
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await Contact.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
