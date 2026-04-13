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
    const { from_employee_id, to_employee_id, company_ids } = req.body;
    if (!from_employee_id || !to_employee_id) {
      return res.status(400).json({ error: 'from_employee_id and to_employee_id are required' });
    }
    const reassigned = await campaigns.reassignCompanies(req.params.id, from_employee_id, to_employee_id, company_ids || null);
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
    const targetCounts = req.body.targetCounts || null;
    const result = await campaigns.regenerateWeeks(req.params.id, req.tenantId, targetCounts);
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
    const [companiesList, weeksList, teamList, campaignOppsList, mainOppsResult, scoreBreakdownResult] = await Promise.all([
      campaignCompanies.getByCampaignId(req.params.id, {}, req.tenantId),
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
      `, [req.params.id]),
      db.query(`
        SELECT
          CASE
            WHEN c.customer_score >= 85 THEN 'A'
            WHEN c.customer_score >= 70 THEN 'B'
            WHEN c.customer_score >= 50 THEN 'C'
            WHEN c.customer_score IS NOT NULL AND c.customer_score < 50 THEN 'D'
            ELSE 'Unscored'
          END as tier,
          COUNT(*) as count,
          COALESCE(SUM(o.estimated_value), 0) as total_value
        FROM opportunities o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.tenant_id = $1 AND o.campaign_id = $2
        GROUP BY tier
        ORDER BY tier
      `, [req.tenantId, req.params.id])
    ]);
    console.log('[Report] Data loaded - companies:', companiesList.length, 'weeks:', weeksList.length, 'team:', teamList.length);
    if (teamList.length > 0) {
      console.log('[Report] Team members:', teamList.map(m => `${m.name} (emp:${m.employee_id}, type:${typeof m.employee_id})`));
    } else {
      console.log('[Report] WARNING: team is empty, deriving from company assignments');
    }
    if (companiesList.length > 0) {
      const sample = companiesList[0];
      console.log('[Report] Sample company:', { assigned_to_id: sample.assigned_to_id, type_id: typeof sample.assigned_to_id, assigned_to_name: sample.assigned_to_name });
    }

    // If team query returned empty, derive team from company assignments as fallback
    let effectiveTeam = teamList;
    if (teamList.length === 0 && companiesList.length > 0) {
      const memberMap = {};
      companiesList.forEach(c => {
        if (c.assigned_to_name && c.assigned_to_id) {
          if (!memberMap[c.assigned_to_id]) {
            memberMap[c.assigned_to_id] = {
              employee_id: c.assigned_to_id,
              name: c.assigned_to_name,
              role: c.assigned_to_id === campaign.owner_id ? 'owner' : 'member'
            };
          }
        }
      });
      effectiveTeam = Object.values(memberMap);
      console.log('[Report] Derived team:', effectiveTeam.map(m => `${m.name} (emp:${m.employee_id})`));
    }

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

    // Enrich company statuses: mark companies with linked opportunities as new_opp
    // so the status breakdown reflects actual opportunity data
    const campOppCompanyIds = new Set(campaignOppsList.map(o => o.campaign_company_id));
    const mainOppCompanyNames = new Set(
      mainOpps.map(o => (o.company_name || '').toLowerCase().trim()).filter(Boolean)
    );
    companiesList.forEach(c => {
      if (c.status !== 'new_opp' && c.status !== 'no_interest' && c.status !== 'dead') {
        if (campOppCompanyIds.has(c.id) || mainOppCompanyNames.has((c.name || '').toLowerCase().trim())) {
          c.status = 'new_opp';
        }
      }
    });

    const { generateCampaignPdfHtml } = require('../utils/campaignPdfGenerator');
    const { fetchLogoBase64 } = require('../utils/logoFetcher');

    const logoBase64 = await fetchLogoBase64(req.tenantId);
    const html = generateCampaignPdfHtml(campaign, companiesList, weeksList, effectiveTeam, opportunitiesList, logoBase64, scoreBreakdownResult.rows);
    console.log('[Report] HTML generated, length:', html.length);

    const { launchBrowser } = require('../utils/launchBrowser');
    browser = await launchBrowser();
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
    const companies = await campaignCompanies.getByCampaignId(req.params.campaignId, filters, req.tenantId);
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
    // Auto-detect source: if campaign has no weeks yet (not generated), this is an
    // initial setup prospect ('seed'). Once the campaign is generated, new additions are 'manual'.
    const weeksList = await campaigns.getWeeks(req.params.campaignId);
    const source = weeksList.length === 0 ? 'seed' : 'manual';
    const data = { ...req.body, campaign_id: req.params.campaignId, source };
    const company = await campaignCompanies.create(data);

    // Log which week this prospect was credited to when added during an active campaign
    if (source === 'manual' && company.target_week) {
      const weekLabel = weeksList.find(w => w.week_number === company.target_week)?.label || `Week ${company.target_week}`;
      const db = require('../config/database');
      await db.query(
        `INSERT INTO campaign_activity_logs (campaign_id, campaign_company_id, user_id, activity_type, description, metadata)
         VALUES ($1, $2, $3, 'note', $4, $5)`,
        [
          req.params.campaignId,
          company.id,
          req.user.id,
          `New prospect added during campaign, credited to ${weekLabel}`,
          JSON.stringify({ week_added: company.target_week, source: 'manual' })
        ]
      );
    }
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

// UPDATE company assignment (reassign to different team member)
router.patch('/:campaignId/companies/:id/assign', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const company = await campaignCompanies.updateAssignment(
      req.params.id,
      req.body.assigned_to_id,
      req.user.id
    );
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// UPDATE company target week (reassign to different week)
router.patch('/:campaignId/companies/:id/week', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const company = await campaignCompanies.updateTargetWeek(
      req.params.id,
      req.body.target_week,
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
    const result = await campaignCompanies.addToDatabase(req.params.id, req.user.id, req.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE campaign company (owner only)
router.delete('/:campaignId/companies/:id', async (req, res, next) => {
  try {
    // Verify campaign belongs to tenant
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Only the campaign owner can delete prospects
    const db = require('../config/database');
    const ownerResult = await db.query('SELECT user_id FROM employees WHERE id = $1', [campaign.owner_id]);
    const ownerUserId = ownerResult.rows[0]?.user_id;
    if (ownerUserId !== req.user.id) {
      return res.status(403).json({ error: 'Only the campaign owner can delete prospects' });
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

// ===== CAMPAIGN CONTACTS (routes to customer_contacts when linked) =====

// Helper: ensure campaign company is linked to a real customer, auto-create if needed
async function ensureLinkedCustomer(companyId, userId, tenantId) {
  const company = await campaignCompanies.getById(companyId);
  if (!company) throw new Error('Campaign company not found');
  if (company.linked_company_id) return company;
  // Auto-add to database
  const result = await campaignCompanies.addToDatabase(companyId, userId, tenantId);
  return result.campaignCompany;
}

// Helper: map customer_contacts row to campaign contact shape
function mapCustomerContact(c, companyId) {
  return {
    id: c.id,
    campaign_company_id: parseInt(companyId),
    name: [c.first_name, c.last_name].filter(Boolean).join(' '),
    title: c.title,
    email: c.email,
    phone: c.phone || c.mobile,
    is_primary: c.is_primary,
    notes: c.notes,
    created_at: c.created_at,
    updated_at: c.updated_at,
    source: 'customer_contacts'
  };
}

// GET contacts for a company
router.get('/:campaignId/companies/:companyId/contacts', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const company = await campaignCompanies.getById(req.params.companyId);
    if (company && company.linked_company_id) {
      const Customer = require('../models/Customer');
      const realContacts = await Customer.getContacts(company.linked_company_id);
      res.json(realContacts.map(c => mapCustomerContact(c, req.params.companyId)));
    } else {
      // Fallback: not linked yet
      const contacts = await campaignContacts.getByCompanyId(req.params.companyId);
      res.json(contacts);
    }
  } catch (error) {
    next(error);
  }
});

// CREATE contact
router.post('/:campaignId/companies/:companyId/contacts', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const company = await ensureLinkedCustomer(req.params.companyId, req.user.id, req.tenantId);
    const Customer = require('../models/Customer');
    const nameParts = (req.body.name || '').trim().split(/\s+/);
    const contact = await Customer.createContact(company.linked_company_id, {
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      title: req.body.title,
      email: req.body.email,
      phone: req.body.phone,
      is_primary: req.body.is_primary || false,
      notes: req.body.notes
    }, req.tenantId);
    res.status(201).json(mapCustomerContact(contact, req.params.companyId));
  } catch (error) {
    next(error);
  }
});

// UPDATE contact
router.put('/:campaignId/companies/:companyId/contacts/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const company = await campaignCompanies.getById(req.params.companyId);
    if (company && company.linked_company_id) {
      const Customer = require('../models/Customer');
      const nameParts = (req.body.name || '').trim().split(/\s+/);
      const contact = await Customer.updateContact(req.params.id, {
        customer_id: company.linked_company_id,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        title: req.body.title,
        email: req.body.email,
        phone: req.body.phone,
        mobile: req.body.phone,
        is_primary: req.body.is_primary,
        notes: req.body.notes
      });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      res.json(mapCustomerContact(contact, req.params.companyId));
    } else {
      const contact = await campaignContacts.update(req.params.id, req.body);
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      res.json(contact);
    }
  } catch (error) {
    next(error);
  }
});

// DELETE contact
router.delete('/:campaignId/companies/:companyId/contacts/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const company = await campaignCompanies.getById(req.params.companyId);
    if (company && company.linked_company_id) {
      const Customer = require('../models/Customer');
      await Customer.deleteContact(req.params.id);
    } else {
      const contact = await campaignContacts.delete(req.params.id);
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== CAMPAIGN OPPORTUNITIES (routes to real opportunities table when linked) =====

// GET opportunities for a campaign (aggregate)
router.get('/:campaignId/opportunities', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const db = require('../config/database');
    // Get legacy campaign_opportunities
    const campOpps = await campaignOpportunities.getByCampaignId(req.params.campaignId);
    // Get real pipeline opportunities linked to this campaign
    const realResult = await db.query(`
      SELECT o.id, o.title as name, o.description, o.estimated_value as value,
             ps.name as stage, o.probability,
             c.name as company_name,
             CASE WHEN o.converted_to_project_id IS NOT NULL THEN true ELSE false END as is_converted,
             'pipeline' as source, o.created_at, o.updated_at
      FROM opportunities o
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.campaign_id = $1 AND o.tenant_id = $2
      ORDER BY o.estimated_value DESC
    `, [req.params.campaignId, req.tenantId]);
    res.json([...campOpps.map(o => ({ ...o, source: 'campaign' })), ...realResult.rows]);
  } catch (error) {
    next(error);
  }
});

// GET opportunities for a company
router.get('/:campaignId/companies/:companyId/opportunities', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const company = await campaignCompanies.getById(req.params.companyId);
    const db = require('../config/database');

    // Legacy campaign-specific opportunities
    const campOpps = await campaignOpportunities.getByCompanyId(req.params.companyId);

    // Real pipeline opportunities for this customer/campaign
    let pipelineOpps = [];
    if (company && company.linked_company_id) {
      const result = await db.query(`
        SELECT DISTINCT ON (o.id) o.id, o.title as name, o.description,
               o.estimated_value as value,
               ps.name as stage,
               COALESCE(o.probability, CASE ps.probability WHEN 'High' THEN 75 WHEN 'Medium' THEN 50 WHEN 'Low' THEN 25 ELSE 10 END) as probability,
               o.estimated_start_date as close_date,
               CASE WHEN o.converted_to_project_id IS NOT NULL THEN true ELSE false END as is_converted,
               'pipeline' as source, o.created_at, o.updated_at
        FROM opportunities o
        LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
        WHERE o.tenant_id = $1
          AND (o.customer_id = $2 OR o.gc_customer_id = $2 OR o.campaign_id = $3)
        ORDER BY o.id, o.created_at DESC
      `, [req.tenantId, company.linked_company_id, req.params.campaignId]);
      pipelineOpps = result.rows;
    }

    res.json([
      ...campOpps.map(o => ({ ...o, source: 'campaign' })),
      ...pipelineOpps
    ]);
  } catch (error) {
    next(error);
  }
});

// CREATE opportunity → creates in real opportunities table
router.post('/:campaignId/companies/:companyId/opportunities', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const company = await ensureLinkedCustomer(req.params.companyId, req.user.id, req.tenantId);
    const Opportunity = require('../models/opportunities');
    const db = require('../config/database');

    // Get default stage
    const stageResult = await db.query(
      `SELECT id FROM pipeline_stages WHERE LOWER(name) = 'qualification' AND tenant_id = $1 LIMIT 1`,
      [req.tenantId]
    );

    const opp = await Opportunity.create({
      title: req.body.name,
      description: req.body.description || null,
      estimated_value: req.body.value || 0,
      campaign_id: parseInt(req.params.campaignId),
      customer_id: company.linked_company_id,
      stage_id: stageResult.rows[0]?.id || null,
      priority: 'medium',
      source: 'campaign'
    }, req.user.id, req.tenantId);

    // Auto-update company status to new_opp
    const companyData = await campaignCompanies.getById(req.params.companyId);
    if (companyData && (companyData.status === 'prospect' || companyData.status === 'follow_up')) {
      await db.query('UPDATE campaign_companies SET status = $1 WHERE id = $2', ['new_opp', req.params.companyId]);
    }

    // Log activity
    await db.query(
      `INSERT INTO campaign_activity_logs (campaign_id, campaign_company_id, user_id, activity_type, description, metadata)
       VALUES ($1, $2, $3, 'opportunity_created', $4, $5)`,
      [req.params.campaignId, req.params.companyId, req.user.id,
       `New opportunity created: ${opp.title} ($${opp.estimated_value || 0})`,
       JSON.stringify({ opportunity_id: opp.id })]
    );

    // Return in campaign opportunity shape
    res.status(201).json({
      id: opp.id,
      name: opp.title,
      description: opp.description,
      value: opp.estimated_value,
      stage: 'Qualification',
      probability: 10,
      close_date: opp.estimated_start_date,
      is_converted: false,
      source: 'pipeline',
      created_at: opp.created_at,
      updated_at: opp.updated_at
    });
  } catch (error) {
    next(error);
  }
});

// UPDATE opportunity
router.put('/:campaignId/companies/:companyId/opportunities/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Try real opportunities table first
    const Opportunity = require('../models/opportunities');
    const db = require('../config/database');
    const realCheck = await db.query('SELECT id FROM opportunities WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (realCheck.rows.length > 0) {
      const updated = await Opportunity.update(req.params.id, {
        title: req.body.name,
        description: req.body.description,
        estimated_value: req.body.value,
        estimated_start_date: req.body.close_date
      }, req.tenantId);
      res.json({ ...updated, name: updated.title, value: updated.estimated_value, source: 'pipeline' });
    } else {
      // Legacy campaign_opportunities
      const opportunity = await campaignOpportunities.update(req.params.id, req.body);
      if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });
      res.json(opportunity);
    }
  } catch (error) {
    next(error);
  }
});

// DELETE opportunity
router.delete('/:campaignId/companies/:companyId/opportunities/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Try real opportunities table first
    const Opportunity = require('../models/opportunities');
    const db = require('../config/database');
    const realCheck = await db.query('SELECT id FROM opportunities WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (realCheck.rows.length > 0) {
      await Opportunity.delete(req.params.id, req.tenantId);
    } else {
      const opportunity = await campaignOpportunities.delete(req.params.id);
      if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });
    }
    res.json({ message: 'Opportunity deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== CAMPAIGN ESTIMATES (routes to real estimates table when linked) =====

// Helper: map real estimate to campaign estimate shape
function mapRealEstimate(e, companyId) {
  return {
    id: e.id,
    campaign_company_id: parseInt(companyId),
    estimate_number: e.estimate_number,
    name: e.project_name || e.name,
    amount: parseFloat(e.total_cost || e.amount || 0),
    status: e.status === 'in progress' ? 'draft' : e.status,
    sent_date: e.sent_date || null,
    valid_until: e.valid_until || null,
    notes: e.notes || null,
    source: 'estimates',
    created_at: e.created_at,
    updated_at: e.updated_at
  };
}

// GET estimates for a campaign (aggregate)
router.get('/:campaignId/estimates', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const db = require('../config/database');
    const campEsts = await campaignEstimates.getByCampaignId(req.params.campaignId);
    const realResult = await db.query(`
      SELECT e.id, e.estimate_number, e.project_name as name,
             COALESCE(e.total_cost, 0) as amount, e.status,
             c.name as company_name,
             'estimates' as source, e.created_at, e.updated_at
      FROM estimates e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.campaign_id = $1 AND e.tenant_id = $2
      ORDER BY e.created_at DESC
    `, [req.params.campaignId, req.tenantId]);
    res.json([...campEsts, ...realResult.rows]);
  } catch (error) {
    next(error);
  }
});

// GET estimates for a company
router.get('/:campaignId/companies/:companyId/estimates', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const company = await campaignCompanies.getById(req.params.companyId);
    const db = require('../config/database');

    let realEstimates = [];
    if (company && company.linked_company_id) {
      const result = await db.query(`
        SELECT e.id, e.estimate_number, e.project_name, e.total_cost, e.status,
               e.notes, e.created_at, e.updated_at
        FROM estimates e
        WHERE (e.customer_id = $1 OR e.campaign_id = $2) AND e.tenant_id = $3
        ORDER BY e.created_at DESC
      `, [company.linked_company_id, req.params.campaignId, req.tenantId]);
      realEstimates = result.rows.map(e => mapRealEstimate(e, req.params.companyId));
    }

    // Include legacy campaign_estimates for backward compat
    const legacyEstimates = await campaignEstimates.getByCompanyId(req.params.companyId);

    res.json([...realEstimates, ...legacyEstimates]);
  } catch (error) {
    next(error);
  }
});

// CREATE estimate → creates in real estimates table
router.post('/:campaignId/companies/:companyId/estimates', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const company = await ensureLinkedCustomer(req.params.companyId, req.user.id, req.tenantId);
    const Estimate = require('../models/Estimate');
    const db = require('../config/database');

    const estimateNumber = await Estimate.getNextEstimateNumber(req.tenantId);
    const estimate = await Estimate.create({
      estimate_number: estimateNumber,
      project_name: req.body.name,
      customer_id: company.linked_company_id,
      customer_name: company.linked_company_name || company.name,
      status: 'in progress',
      campaign_id: parseInt(req.params.campaignId),
      created_by: req.user.id
    }, req.tenantId);

    // Log activity
    await db.query(
      `INSERT INTO campaign_activity_logs (campaign_id, campaign_company_id, user_id, activity_type, description, metadata)
       VALUES ($1, $2, $3, 'estimate_sent', $4, $5)`,
      [req.params.campaignId, req.params.companyId, req.user.id,
       `New estimate created: ${estimate.estimate_number} - ${estimate.project_name}`,
       JSON.stringify({ estimate_id: estimate.id })]
    );

    res.status(201).json(mapRealEstimate(estimate, req.params.companyId));
  } catch (error) {
    next(error);
  }
});

// UPDATE estimate
router.put('/:campaignId/companies/:companyId/estimates/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const db = require('../config/database');
    const realCheck = await db.query('SELECT id FROM estimates WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (realCheck.rows.length > 0) {
      const Estimate = require('../models/Estimate');
      const updated = await Estimate.update(req.params.id, {
        project_name: req.body.name,
        status: req.body.status === 'draft' ? 'in progress' : req.body.status,
        notes: req.body.notes
      }, req.tenantId);
      res.json(mapRealEstimate(updated, req.params.companyId));
    } else {
      const estimate = await campaignEstimates.update(req.params.id, req.body);
      if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
      res.json(estimate);
    }
  } catch (error) {
    next(error);
  }
});

// DELETE estimate
router.delete('/:campaignId/companies/:companyId/estimates/:id', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const db = require('../config/database');
    const realCheck = await db.query('SELECT id FROM estimates WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (realCheck.rows.length > 0) {
      await db.query('DELETE FROM estimates WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    } else {
      const estimate = await campaignEstimates.delete(req.params.id);
      if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
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

// ============ CAMPAIGN COMPANY ASSESSMENTS ============

const CustomerAssessment = require('../models/CustomerAssessment');

// GET assessment for a campaign company
router.get('/:campaignId/companies/:companyId/assessment', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    // First check for a campaign-specific assessment
    let assessment = await CustomerAssessment.findByCampaignCompanyId(req.params.companyId);
    // If none, fall back to the linked customer's assessment
    if (!assessment) {
      const company = await campaignCompanies.getById(req.params.companyId);
      if (company && company.linked_company_id) {
        assessment = await CustomerAssessment.findByCustomerId(company.linked_company_id);
      }
    }
    if (!assessment) {
      return res.status(404).json({ error: 'No assessment found' });
    }
    res.json(assessment);
  } catch (error) {
    next(error);
  }
});

// CREATE assessment for a campaign company
router.post('/:campaignId/companies/:companyId/assessment', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    // Look up linked customer so score syncs bidirectionally
    const company = await campaignCompanies.getById(req.params.companyId);
    const linkedCustomerId = company?.linked_company_id || null;
    const assessment = await CustomerAssessment.createForCampaignCompany(
      req.params.companyId,
      req.body,
      req.user.id,
      linkedCustomerId
    );
    res.status(201).json(assessment);
  } catch (error) {
    next(error);
  }
});

// UPDATE assessment for a campaign company
router.put('/:campaignId/companies/:companyId/assessment/:assessmentId', async (req, res, next) => {
  try {
    const campaign = await campaigns.getByIdAndTenant(req.params.campaignId, req.tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    // Look up linked customer so score syncs bidirectionally
    const company = await campaignCompanies.getById(req.params.companyId);
    const linkedCustomerId = company?.linked_company_id || null;
    const assessment = await CustomerAssessment.update(
      req.params.assessmentId,
      req.body,
      req.user.id,
      linkedCustomerId
    );
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    res.json(assessment);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
