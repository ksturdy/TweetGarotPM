const express = require('express');
const router = express.Router();
const campaigns = require('../models/campaigns');
const campaignCompanies = require('../models/campaignCompanies');
const campaignContacts = require('../models/campaignContacts');
const campaignOpportunities = require('../models/campaignOpportunities');
const campaignEstimates = require('../models/campaignEstimates');
const campaignActivityLogs = require('../models/campaignActivityLogs');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('campaigns'));

// ===== CAMPAIGNS =====

// GET active employees for campaign team assignment (from employee directory)
router.get('/team-eligible', async (req, res, next) => {
  try {
    const Employee = require('../models/Employee');
    const employees = await Employee.getAll({ employment_status: 'active' }, req.tenantId);
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

// GET all campaigns
router.get('/', async (req, res, next) => {
  try {
    const allCampaigns = await campaigns.getAll(req.tenantId);
    res.json(allCampaigns);
  } catch (error) {
    next(error);
  }
});

// GET campaign by ID
router.get('/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

// CREATE campaign
router.post('/', async (req, res, next) => {
  try {
    const campaign = await campaigns.create(req.body, req.tenantId);
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

// UPDATE campaign
router.put('/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.update(req.params.id, req.body, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

// DELETE campaign
router.delete('/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.delete(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET campaign weeks
router.get('/:id/weeks', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const weeks = await campaigns.getWeeks(req.params.id);
    res.json(weeks);
  } catch (error) {
    next(error);
  }
});

// CREATE campaign week
router.post('/:id/weeks', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const week = await campaigns.createWeek(req.params.id, req.body);
    res.status(201).json(week);
  } catch (error) {
    next(error);
  }
});

// GET campaign team members
router.get('/:id/team', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const team = await campaigns.getTeamMembers(req.params.id);
    res.json(team);
  } catch (error) {
    next(error);
  }
});

// ADD team member
router.post('/:id/team', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const member = await campaigns.addTeamMember(
      req.params.id,
      req.body.employee_id,
      req.body.role
    );
    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

// REMOVE team member
router.delete('/:id/team/:employeeId', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const member = await campaigns.removeTeamMember(req.params.id, req.params.employeeId);
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ message: 'Team member removed', member });
  } catch (error) {
    next(error);
  }
});

// REASSIGN companies from one team member to another
router.put('/:id/team/reassign', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const { from_employee_id, to_employee_id } = req.body;
    if (!from_employee_id || !to_employee_id) {
      return res.status(400).json({ error: 'from_employee_id and to_employee_id are required' });
    }
    const reassigned = await campaigns.reassignCompanies(req.params.id, from_employee_id, to_employee_id);
    res.json({ message: `Reassigned ${reassigned.length} companies`, count: reassigned.length });
  } catch (error) {
    next(error);
  }
});

// GET campaign status stats
router.get('/:id/stats/status', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const stats = await campaigns.getStatusStats(req.params.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET campaign weekly stats
router.get('/:id/stats/weekly', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const stats = await campaigns.getWeeklyStats(req.params.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GENERATE campaign (auto-create weeks, distribute prospects to team)
router.post('/:id/generate', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const result = await campaigns.generate(req.params.id, req.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// REGENERATE campaign weeks (delete old, create new from dates, redistribute)
router.post('/:id/regenerate-weeks', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const result = await campaigns.regenerateWeeks(req.params.id, req.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GENERATE campaign report PDF
router.get('/:id/report-pdf', async (req, res, next) => {
  let browser = null;
  try {
    console.log('[Report] Starting PDF generation for campaign:', req.params.id, 'tenant:', req.tenantId);

    const campaign = await campaigns.getByIdAndTenant(req.params.id, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const db = require('../config/database');
    const [companiesList, weeksList, teamList, campaignOppsList, mainOppsResult] = await Promise.all([
      campaignCompanies.getByCampaignId(req.params.id),
      campaigns.getWeeks(req.params.id),
      campaigns.getTeamMembers(req.params.id),
      campaignOpportunities.getByCampaignId(req.params.id),
      db.query(`
        SELECT o.*, ps.name as stage_name, u.first_name || ' ' || u.last_name as assigned_to_name
        FROM opportunities o
        LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
        LEFT JOIN users u ON o.assigned_to = u.id
        WHERE o.campaign_id = $1
        ORDER BY o.estimated_value DESC
      `, [req.params.id])
    ]);
    console.log('[Report] Data loaded - companies:', companiesList.length, 'weeks:', weeksList.length, 'team:', teamList.length);

    // Merge campaign_opportunities + main opportunities (normalized to same shape)
    const mainOpps = mainOppsResult.rows.map(o => ({
      name: o.title,
      company_name: o.client_company || '',
      value: o.estimated_value,
      stage: o.stage_name || '',
      probability: o.probability || '',
      close_date: o.estimated_start_date,
      description: o.description
    }));
    const opportunitiesList = [...campaignOppsList, ...mainOpps];

    const { generateCampaignPdfHtml } = require('../utils/campaignPdfGenerator');

    const html = generateCampaignPdfHtml(campaign, companiesList, weeksList, teamList, opportunitiesList);
    console.log('[Report] HTML generated, length:', html.length);

    // In production (Render), use @sparticuz/chromium which bundles its own binary.
    // Locally, use full puppeteer which downloads its own Chrome.
    if (process.env.NODE_ENV === 'production') {
      const chromium = require('@sparticuz/chromium');
      const puppeteerCore = require('puppeteer-core');
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
    }
    console.log('[Report] Puppeteer launched');

    const page = await browser.newPage();
    await page.setViewport({ width: 1056, height: 816 });
    await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });
    console.log('[Report] PDF generated, size:', pdfBuffer.length);

    await browser.close();
    browser = null;

    const safeName = (campaign.name || 'Campaign').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Report.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('[Report] PDF generation failed:', error.message);
    console.error('[Report] Stack:', error.stack);
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
    next(error);
  }
});

// BULK CREATE campaign companies
router.post('/:campaignId/companies/bulk', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const result = await campaigns.bulkCreateCompanies(req.params.campaignId, req.body.companies);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// ===== CAMPAIGN COMPANIES =====

// GET all companies for a campaign
router.get('/:campaignId/companies', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const filters = {
      assigned_to_id: req.query.assigned_to_id,
      status: req.query.status,
      tier: req.query.tier,
      target_week: req.query.target_week
    };
    const companies = await campaignCompanies.getByCampaignId(req.params.campaignId, filters);
    res.json(companies);
  } catch (error) {
    next(error);
  }
});

// GET company by ID
router.get('/:campaignId/companies/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const company = await campaignCompanies.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// CREATE campaign company
router.post('/:campaignId/companies', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const data = { ...req.body, campaign_id: req.params.campaignId };
    const company = await campaignCompanies.create(data);
    res.status(201).json(company);
  } catch (error) {
    next(error);
  }
});

// UPDATE campaign company
router.put('/:campaignId/companies/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const company = await campaignCompanies.update(req.params.id, req.body);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// UPDATE company status
router.patch('/:campaignId/companies/:id/status', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const company = await campaignCompanies.updateStatus(
      req.params.id,
      req.body.status,
      req.user.id
    );
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// UPDATE company action
router.patch('/:campaignId/companies/:id/action', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const company = await campaignCompanies.updateAction(
      req.params.id,
      req.body.next_action,
      req.user.id
    );
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// ADD company to main database
router.post('/:campaignId/companies/:id/add-to-database', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const result = await campaignCompanies.addToDatabase(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE campaign company
router.delete('/:campaignId/companies/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const company = await campaignCompanies.delete(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== CAMPAIGN CONTACTS =====

// GET contacts for a company
router.get('/:campaignId/companies/:companyId/contacts', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const contacts = await campaignContacts.getByCompanyId(req.params.companyId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// CREATE contact
router.post('/:campaignId/companies/:companyId/contacts', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const data = { ...req.body, campaign_company_id: req.params.companyId };
    const contact = await campaignContacts.create(data);
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

// UPDATE contact
router.put('/:campaignId/companies/:companyId/contacts/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const contact = await campaignContacts.update(req.params.id, req.body);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// DELETE contact
router.delete('/:campaignId/companies/:companyId/contacts/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const contact = await campaignContacts.delete(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== CAMPAIGN OPPORTUNITIES =====

// GET opportunities for a campaign
router.get('/:campaignId/opportunities', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const opportunities = await campaignOpportunities.getByCampaignId(req.params.campaignId);
    res.json(opportunities);
  } catch (error) {
    next(error);
  }
});

// GET opportunities for a company
router.get('/:campaignId/companies/:companyId/opportunities', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const opportunities = await campaignOpportunities.getByCompanyId(req.params.companyId);
    res.json(opportunities);
  } catch (error) {
    next(error);
  }
});

// CREATE opportunity
router.post('/:campaignId/companies/:companyId/opportunities', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const data = { ...req.body, campaign_company_id: req.params.companyId };
    const opportunity = await campaignOpportunities.create(data, req.user.id);
    res.status(201).json(opportunity);
  } catch (error) {
    next(error);
  }
});

// UPDATE opportunity
router.put('/:campaignId/companies/:companyId/opportunities/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const opportunity = await campaignOpportunities.update(req.params.id, req.body);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    res.json(opportunity);
  } catch (error) {
    next(error);
  }
});

// DELETE opportunity
router.delete('/:campaignId/companies/:companyId/opportunities/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const opportunity = await campaignOpportunities.delete(req.params.id);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    res.json({ message: 'Opportunity deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== CAMPAIGN ESTIMATES =====

// GET estimates for a campaign
router.get('/:campaignId/estimates', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const estimates = await campaignEstimates.getByCampaignId(req.params.campaignId);
    res.json(estimates);
  } catch (error) {
    next(error);
  }
});

// GET estimates for a company
router.get('/:campaignId/companies/:companyId/estimates', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const estimates = await campaignEstimates.getByCompanyId(req.params.companyId);
    res.json(estimates);
  } catch (error) {
    next(error);
  }
});

// CREATE estimate
router.post('/:campaignId/companies/:companyId/estimates', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const data = { ...req.body, campaign_company_id: req.params.companyId };
    const estimate = await campaignEstimates.create(data, req.user.id);
    res.status(201).json(estimate);
  } catch (error) {
    next(error);
  }
});

// UPDATE estimate
router.put('/:campaignId/companies/:companyId/estimates/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const estimate = await campaignEstimates.update(req.params.id, req.body);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.json(estimate);
  } catch (error) {
    next(error);
  }
});

// DELETE estimate
router.delete('/:campaignId/companies/:companyId/estimates/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const estimate = await campaignEstimates.delete(req.params.id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.json({ message: 'Estimate deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== CAMPAIGN ACTIVITY LOGS =====

// GET activity logs for a campaign
router.get('/:campaignId/activity', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const logs = await campaignActivityLogs.getByCampaignId(req.params.campaignId, limit);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// GET activity logs for a company
router.get('/:campaignId/companies/:companyId/activity', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const logs = await campaignActivityLogs.getByCompanyId(req.params.companyId, limit);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// ADD note
router.post('/:campaignId/companies/:companyId/notes', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const log = await campaignActivityLogs.addNote(
      req.params.campaignId,
      req.params.companyId,
      req.user.id,
      req.body.note
    );
    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

// LOG contact attempt
router.post('/:campaignId/companies/:companyId/contact-attempt', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const log = await campaignActivityLogs.logContactAttempt(
      req.params.campaignId,
      req.params.companyId,
      req.user.id,
      req.body.method || 'phone',
      req.body.notes || ''
    );
    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
