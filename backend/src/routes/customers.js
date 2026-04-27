const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const opportunities = require('../models/opportunities');
const { authenticate } = require('../middleware/auth');
const { tenantContext, checkLimit } = require('../middleware/tenant');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Get all customers (optional ?type=customer|prospect filter)
router.get('/', async (req, res, next) => {
  try {
    let customers = await Customer.findAllByTenant(req.tenantId);
    if (req.query.type) {
      customers = customers.filter(c => c.customer_type === req.query.type);
    }
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

// Get all customer contacts (across all customers in tenant)
router.get('/contacts/all', async (req, res, next) => {
  try {
    const contacts = await Customer.getAllContacts(req.tenantId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Create a standalone contact (customer optional)
router.post('/contacts', async (req, res, next) => {
  try {
    // If customer_id provided, verify it belongs to tenant
    if (req.body.customer_id) {
      const customer = await Customer.findByIdAndTenant(req.body.customer_id, req.tenantId);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    }
    const contact = await Customer.createStandaloneContact(req.body, req.tenantId);
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

// Get customer statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await Customer.getStats(req.tenantId);
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
    const customers = await Customer.search(q, req.tenantId);
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

// Check if a name matches existing customers (for prospect dedup)
router.get('/match', async (req, res, next) => {
  try {
    const { name } = req.query;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name query param is required' });
    }
    const matches = await Customer.findPotentialMatches(name.trim(), req.tenantId);
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

// Quick-create a prospect (minimal: just name)
router.post('/quick', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const prospect = await Customer.createProspect(name.trim(), req.tenantId);
    res.status(201).json(prospect);
  } catch (error) {
    next(error);
  }
});

// Merge a prospect into an existing customer (re-links all FKs, deletes prospect)
router.post('/:id/merge', async (req, res, next) => {
  try {
    const prospect = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }
    if (prospect.customer_type !== 'prospect') {
      return res.status(400).json({ error: 'Only prospects can be merged into a customer' });
    }
    const { target_customer_id } = req.body;
    if (!target_customer_id) {
      return res.status(400).json({ error: 'target_customer_id is required' });
    }
    const target = await Customer.findByIdAndTenant(target_customer_id, req.tenantId);
    if (!target) {
      return res.status(404).json({ error: 'Target customer not found' });
    }
    const result = await Customer.mergeProspect(parseInt(req.params.id), parseInt(target_customer_id), req.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Location routes (must be before /:id) ──

// Get locations for a customer
router.get('/:id/locations', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const locations = await Customer.getLocations(req.params.id);
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

// Create location for a customer
router.post('/:id/locations', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }
    const location = await Customer.createLocation(req.params.id, req.body, req.tenantId);
    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
});

// Update a location
router.put('/locations/:locationId', async (req, res, next) => {
  try {
    const existing = await Customer.getLocationById(req.params.locationId, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }
    const location = await Customer.updateLocation(req.params.locationId, req.body);
    res.json(location);
  } catch (error) {
    next(error);
  }
});

// Delete a location
router.delete('/locations/:locationId', async (req, res, next) => {
  try {
    const existing = await Customer.getLocationById(req.params.locationId, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }
    await Customer.deleteLocation(req.params.locationId);
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get customer by ID
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// Get customer metrics
router.get('/:id/metrics', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const metrics = await Customer.getMetrics(req.params.id, req.tenantId);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get enhanced metrics for customer (replaces old company-metrics)
router.get('/:id/company-metrics', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const metrics = await Customer.getCompanyMetrics(req.params.id, req.tenantId);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get work orders for a customer
router.get('/:id/work-orders', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const workOrders = await Customer.getWorkOrders(req.params.id, req.tenantId);
    res.json(workOrders);
  } catch (error) {
    next(error);
  }
});

// Get projects for customer (also serves as company-projects endpoint)
router.get('/:id/projects', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const projects = await Customer.getProjects(req.params.id, req.tenantId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Backward compat: company-projects redirects to projects
router.get('/:id/company-projects', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const projects = await Customer.getProjects(req.params.id, req.tenantId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Get estimates/bids for customer
router.get('/:id/bids', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const bids = await Customer.getBids(req.params.id, req.tenantId);
    res.json(bids);
  } catch (error) {
    next(error);
  }
});

// Backward compat: company-bids redirects to bids
router.get('/:id/company-bids', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const bids = await Customer.getBids(req.params.id, req.tenantId);
    res.json(bids);
  } catch (error) {
    next(error);
  }
});

// Get customer touchpoints
router.get('/:id/touchpoints', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const touchpoints = await Customer.getTouchpoints(req.params.id);
    res.json(touchpoints);
  } catch (error) {
    next(error);
  }
});

// Create touchpoint for customer
router.post('/:id/touchpoints', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const touchpoint = await Customer.createTouchpoint(req.params.id, {
      ...req.body,
      created_by: req.user.id
    });
    res.status(201).json(touchpoint);
  } catch (error) {
    next(error);
  }
});

// Get customer opportunities
router.get('/:id/opportunities', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customerOpportunities = await opportunities.findByCustomerId(req.params.id, req.tenantId);
    res.json(customerOpportunities);
  } catch (error) {
    next(error);
  }
});

// Get customer contacts
router.get('/:id/contacts', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const contacts = await Customer.getContacts(req.params.id);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Get customer contacts with organizational hierarchy
router.get('/:id/contacts/hierarchy', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const contacts = await Customer.getContactsWithHierarchy(req.params.id, req.tenantId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// Create contact for customer
router.post('/:id/contacts', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const contact = await Customer.createContact(req.params.id, req.body, req.tenantId);
    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: error.message || 'Failed to create contact' });
  }
});

// Update contact for customer (nested route)
router.put('/:id/contacts/:contactId', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const existingContact = await Customer.getContactById(req.params.contactId, req.tenantId);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    if (existingContact.customer_id !== parseInt(req.params.id, 10)) {
      return res.status(400).json({ error: 'Contact does not belong to this customer' });
    }
    const contact = await Customer.updateContact(req.params.contactId, req.body, req.tenantId);
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Delete contact for customer (nested route)
router.delete('/:id/contacts/:contactId', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const existingContact = await Customer.getContactById(req.params.contactId, req.tenantId);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    if (existingContact.customer_id !== parseInt(req.params.id, 10)) {
      return res.status(400).json({ error: 'Contact does not belong to this customer' });
    }
    await Customer.deleteContact(req.params.contactId);
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get direct reports for a contact
router.get('/contacts/:contactId/reports', async (req, res, next) => {
  try {
    const contact = await Customer.getContactById(req.params.contactId, req.tenantId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    const reports = await Customer.getDirectReports(req.params.contactId, req.tenantId);
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// Update contact (standalone route with tenant verification)
router.put('/contacts/:contactId', async (req, res, next) => {
  try {
    const existingContact = await Customer.getContactById(req.params.contactId, req.tenantId);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    if (req.body.customer_id && req.body.customer_id !== existingContact.customer_id) {
      const customer = await Customer.findByIdAndTenant(req.body.customer_id, req.tenantId);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    }
    const updateData = {
      ...req.body,
      customer_id: req.body.customer_id !== undefined ? req.body.customer_id : existingContact.customer_id
    };
    const contact = await Customer.updateContact(req.params.contactId, updateData, req.tenantId);
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Delete contact (standalone route with tenant verification)
router.delete('/contacts/:contactId', async (req, res, next) => {
  try {
    const existingContact = await Customer.getContactById(req.params.contactId, req.tenantId);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    await Customer.deleteContact(req.params.contactId);
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Create new customer
router.post('/', checkLimit('max_customers', Customer.countByTenant), async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body, req.tenantId);
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

// Update customer
router.put('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // For Vista-sourced customers, only allow Titan-editable fields
    if (customer.source === 'vista') {
      const vistaOwnedFields = ['name', 'customer_number', 'address', 'city', 'state', 'zip_code', 'active_customer'];
      const attemptedVistaFields = vistaOwnedFields.filter(f => req.body[f] !== undefined);
      if (attemptedVistaFields.length > 0) {
        return res.status(400).json({
          error: 'Cannot modify Vista-synced fields. These fields are updated automatically from Vista data.',
          fields: attemptedVistaFields
        });
      }
    }

    const updated = await Customer.update(req.params.id, req.body, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete customer
router.delete('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndTenant(req.params.id, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    if (customer.source === 'vista') {
      return res.status(400).json({ error: 'Cannot delete Vista-synced customers. They will be updated on the next Vista data upload.' });
    }
    await Customer.delete(req.params.id, req.tenantId);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
