const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Only Excel files are allowed'));
    }
    cb(null, true);
  }
});

// Get all customers
router.get('/', async (req, res, next) => {
  try {
    const customers = await Customer.findAll();
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

// Get all customer contacts (across all customers)
router.get('/contacts/all', async (req, res, next) => {
  try {
    const contacts = await Customer.getAllContacts();
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Get customer statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await Customer.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Search customers
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    const customers = await Customer.search(q);
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

// Get customer by ID
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// Get customer metrics (revenue, hit rate, etc.)
router.get('/:id/metrics', async (req, res, next) => {
  try {
    const metrics = await Customer.getMetrics(req.params.id);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get customer projects
router.get('/:id/projects', async (req, res, next) => {
  try {
    const projects = await Customer.getProjects(req.params.id);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Get customer bids (historical projects)
router.get('/:id/bids', async (req, res, next) => {
  try {
    const bids = await Customer.getBids(req.params.id);
    res.json(bids);
  } catch (error) {
    next(error);
  }
});

// Get customer touchpoints
router.get('/:id/touchpoints', async (req, res, next) => {
  try {
    const touchpoints = await Customer.getTouchpoints(req.params.id);
    res.json(touchpoints);
  } catch (error) {
    next(error);
  }
});

// Create touchpoint for customer
router.post('/:id/touchpoints', async (req, res, next) => {
  try {
    const touchpoint = await Customer.createTouchpoint(req.params.id, req.body);
    res.status(201).json(touchpoint);
  } catch (error) {
    next(error);
  }
});

// Get customer contacts
router.get('/:id/contacts', async (req, res, next) => {
  try {
    const contacts = await Customer.getContacts(req.params.id);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Create contact for customer
router.post('/:id/contacts', async (req, res, next) => {
  try {
    const contact = await Customer.createContact(req.params.id, req.body);
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

// Update contact
router.put('/contacts/:contactId', async (req, res, next) => {
  try {
    const contact = await Customer.updateContact(req.params.contactId, req.body);
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Delete contact
router.delete('/contacts/:contactId', async (req, res, next) => {
  try {
    await Customer.deleteContact(req.params.contactId);
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Create new customer
router.post('/', async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

// Update customer
router.put('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const updated = await Customer.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete customer
router.delete('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    await Customer.delete(req.params.id);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete all customers (admin only)
router.delete('/all/delete', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await Customer.deleteAll();
    res.json({ message: 'All customers deleted' });
  } catch (error) {
    next(error);
  }
});

// Import customers from Excel
router.post('/import/excel', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Parse and transform data
    const customers = data.map(row => {
      // Parse account manager (remove SharePoint ID reference)
      let accountManager = row['Account manager'] || '';
      if (accountManager.includes(';#')) {
        accountManager = accountManager.split(';#')[0];
      }

      return {
        customer_facility: row['Customer_Owner-Facility'] || null,
        customer_owner: row['Customer_Owner'] || null,
        account_manager: accountManager || null,
        field_leads: row['Field Lead(s)'] || null,
        customer_number: row['CustomerNumber'] || null,
        address: row['Address'] || null,
        city: row['City_Province'] || null,
        state: row['State_Country'] || null,
        zip_code: row['ZipCode_PostalCode'] || null,
        controls: row['Controls'] || null,
        department: row['Department'] || null,
        customer_score: row['Customer Score'] || null,
        active_customer: row['Active Customer'] === true || row['Active Customer'] === 'Yes' || row['Active Customer'] === 1,
        notes: null
      };
    });

    // Bulk insert
    const inserted = await Customer.bulkCreate(customers);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Import successful',
      count: inserted.length,
      customers: inserted
    });
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

module.exports = router;
