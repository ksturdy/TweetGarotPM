const express = require('express');
const { body, validationResult } = require('express-validator');
const FieldFavoriteVendor = require('../models/FieldFavoriteVendor');
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

// Get all favorites for current user
router.get('/', async (req, res, next) => {
  try {
    const vendors = await FieldFavoriteVendor.findAll(req.user.id);
    res.json(vendors);
  } catch (error) {
    next(error);
  }
});

// Create
router.post(
  '/',
  [body('name').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const vendor = await FieldFavoriteVendor.create({
        tenantId: req.tenantId,
        name: req.body.name,
        location: req.body.location,
        phone: req.body.phone,
        contactName: req.body.contact_name,
        email: req.body.email,
        createdBy: req.user.id,
      });
      res.status(201).json(vendor);
    } catch (error) {
      next(error);
    }
  }
);

// Update
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await FieldFavoriteVendor.findById(req.params.id);
    if (!existing || existing.created_by !== req.user.id) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    const vendor = await FieldFavoriteVendor.update(req.params.id, {
      name: req.body.name,
      location: req.body.location,
      phone: req.body.phone,
      contactName: req.body.contact_name,
      email: req.body.email,
    });
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await FieldFavoriteVendor.findById(req.params.id);
    if (!existing || existing.created_by !== req.user.id) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    await FieldFavoriteVendor.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
