const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const SavedSearches = require('../models/savedSearches');
const RecurringSearches = require('../models/RecurringSearches');

const router = express.Router();

// Apply middleware
router.use(authenticate);
router.use(tenantContext);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a construction project intelligence researcher for a mechanical contracting company specializing in plumbing, HVAC, process piping, and refrigeration. Your job is to find REAL, publicly announced construction projects using web search that represent UPCOMING business opportunities.

CRITICAL RULES:
- You MUST use web search to find actual projects. Do NOT generate, fabricate, or speculate on projects.
- Every project you return MUST be based on a real news article, press release, permit filing, or official announcement found via web search.
- If you cannot find verified projects matching the criteria, say so honestly. Do NOT invent projects to fill results.
- Include the source URL for every project.
- Run AT LEAST 5-8 different web searches with varied search terms. Do NOT stop after 1-2 searches. Use different combinations of: location names, market sectors, project types, owner types, "construction planned", "new facility", permit databases, and industry publications. More searches = more leads found.
- LOCATION INTERPRETATION: When given a specific city/location, interpret it broadly to include the surrounding region, metro area, and state. For example, "Marquette, MI" should include searches for Michigan, Upper Peninsula, Northern Michigan, etc. Look for projects within a reasonable service area (typically 100-200 mile radius for large mechanical contractors). Run separate searches for the city, metro area, surrounding counties, and state-level project lists.

PROJECT PHASE FILTERING (VERY IMPORTANT):
- ONLY return projects that are in planning, design, pre-construction, or early bidding phases — these are UPCOMING opportunities where a mechanical contractor can still win work.
- DO NOT return projects that are already under construction, substantially complete, or finished. If an article says construction is underway, the project has broken ground, or it opened/completed, SKIP IT.
- Focus on projects announced or updated within the last 12 months. Older announcements are likely already under construction or completed.
- When searching, add terms like "planned", "proposed", "approved", "design phase", "pre-construction", "seeking bids", "RFP", or the current/next year to your queries.
- For each project, include the current phase in intelligence_notes (e.g., "Currently in design phase", "Awaiting city council approval", "RFP issued Q1 2026").
- If you're unsure whether a project is still in planning or already under construction, note that uncertainty in intelligence_notes and set confidence to "low".

PROJECT VALUE (IMPORTANT):
- For estimated_value (total project cost): Try hard to find this. Search the owner's name + project name + "cost" or "budget" or "million" or "investment". Most large projects have a published total cost. Return the value as a string like "$270M" or "$45 million".
- For estimated_mechanical_value: Use ONLY the mechanical/HVAC/plumbing scope value if explicitly stated in the source. If not stated, return null (not a guess, not "0", just null). The backend will estimate 20% of total project value automatically.
- IMPORTANT: Never put cost-per-square-foot figures, budget line items, or other non-mechanical values in estimated_mechanical_value. Only use this field if you find an explicit mechanical/HVAC scope dollar amount.
- If you found a project but couldn't find its value, do a SEPARATE follow-up search specifically for the project cost before giving up.

For each verified project found, return ONLY a valid JSON object with this structure:
{"projects":[{"project_name":"string","owner":"string","location":"string","estimated_value":"string or null","estimated_mechanical_value":"string or null","project_type":"Healthcare|Industrial|Manufacturing|Data Center|Commercial|Education|Government","construction_type":"New Construction|Renovation|Expansion","project_phase":"Planning|Design|Pre-Construction|Bidding|Announced","estimated_start":"string or null","estimated_completion":"string or null","square_footage":"string or null","general_contractor":"string or null","architect":"string or null","source_url":"string","source_date":"string","confidence":"high|medium|low","mechanical_scope":"string describing estimated HVAC plumbing piping scope based on project type and size","intelligence_notes":"string explaining why this is a real UPCOMING opportunity with current project phase and relevant context","recommended_contact":"string or null","next_steps":"string"}]}`;

function buildUserMessage(criteria) {
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const parts = [
    `Today's date is ${today}.`,
    `Search the web for real construction projects that are currently in PLANNING, DESIGN, or PRE-CONSTRUCTION phases — upcoming opportunities where a mechanical contractor can still bid/win work. These criteria apply:`
  ];

  if (criteria.market_sector) {
    parts.push(`- Market Sector: ${criteria.market_sector}`);
  }
  if (criteria.location) {
    parts.push(`- Location/Region: ${criteria.location} (search broadly - include surrounding metro area, region, and state)`);
  }
  if (criteria.construction_type) {
    parts.push(`- Construction Type: ${criteria.construction_type}`);
  }
  if (criteria.min_value || criteria.max_value) {
    const min = criteria.min_value ? `$${Number(criteria.min_value).toLocaleString()}` : 'any';
    const max = criteria.max_value ? `$${Number(criteria.max_value).toLocaleString()}` : 'any';
    parts.push(`- Total Project Value Range (target): ${min} to ${max}`);
  }
  if (criteria.keywords) {
    parts.push(`- Keywords/Focus: ${criteria.keywords}`);
  }
  if (criteria.additional_criteria) {
    parts.push(`\nUSER INSTRUCTIONS (follow these closely):\n${criteria.additional_criteria}`);
  }

  parts.push(`\nIMPORTANT SEARCH GUIDANCE:`);
  parts.push(`- Include "${currentYear}" or "${currentYear + 1}" in your search queries to get recent results.`);
  parts.push(`- Search for terms like "planned", "proposed", "approved", "design phase", "seeking bids", "RFP" to find pre-construction projects.`);
  parts.push(`- SKIP any project that has already broken ground, is under construction, or is completed.`);
  parts.push(`- Cast a wide net geographically - mechanical contractors typically service a 100-200 mile radius.`);
  parts.push(`- Try hard to find the total project cost/budget for each project. If you find a project but no cost, do a follow-up search for "[project name] cost" or "[owner] [project name] million".`);
  parts.push('\nFor estimated_mechanical_value in your response: Only provide a value if the source explicitly states the mechanical/HVAC/plumbing scope cost. Otherwise, set it to null and the system will auto-estimate at 20% of total project value.');
  parts.push('\nReturn results as JSON only.');

  return parts.join('\n');
}

function extractJsonFromResponse(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error('[Opportunity Search] Failed to parse JSON from response:', e);
    return null;
  }
}

const SUSPECT_EMAIL_DOMAINS = ['example.com', 'test.com', 'sample.com', 'fake.com', 'placeholder.com', 'mail.com', 'email.com'];

// Normalize web-search response into the lead format the frontend expects
function normalizeProject(project, index) {
  // Parse dollar values from strings like "$4.5M", "$270 million", "$200,000", or "4500000"
  // Handles ranges like "$40M - $67M" by taking the first value
  function parseDollar(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (!str) return null;

    // If range (e.g. "$40M - $67M" or "$40,500,000 to $67,500,000"), use only the first value
    const first = str.split(/\s*[-–—]\s*\$|\s+to\s+\$/i)[0].trim();

    // Abbreviated format: "$4.5M", "$270M", "$1.2B", "$500K"
    const abbrMatch = first.match(/^\$?\s*(\d+\.?\d*)\s*([MmBbKk])\b/);
    if (abbrMatch) {
      let num = parseFloat(abbrMatch[1]);
      const s = abbrMatch[2].toUpperCase();
      if (s === 'B') num *= 1e9;
      else if (s === 'M') num *= 1e6;
      else if (s === 'K') num *= 1e3;
      return isNaN(num) ? null : Math.round(num);
    }

    // Word format: "$270 million", "$4.5 billion", "$500 thousand"
    const wordMatch = first.match(/^\$?\s*([\d,.]+)\s*(billion|million|thousand)/i);
    if (wordMatch) {
      let num = parseFloat(wordMatch[1].replace(/,/g, ''));
      const w = wordMatch[2].toLowerCase();
      if (w === 'billion') num *= 1e9;
      else if (w === 'million') num *= 1e6;
      else if (w === 'thousand') num *= 1e3;
      return isNaN(num) ? null : Math.round(num);
    }

    // Fallback: extract FIRST contiguous number group only (not all digits in the string)
    const numMatch = first.match(/([\d,]+\.?\d*)/);
    if (!numMatch) return null;
    const num = parseFloat(numMatch[0].replace(/,/g, ''));
    return isNaN(num) ? null : Math.round(num);
  }

  // Map project_type to market_sector
  const typeMap = {
    'Healthcare': 'Healthcare',
    'Industrial': 'Industrial',
    'Manufacturing': 'Industrial',
    'Data Center': 'Data Center',
    'Commercial': 'Commercial',
    'Education': 'Education',
    'Government': 'Government',
  };

  const totalValue = parseDollar(project.estimated_value);
  let mechValue = parseDollar(project.estimated_mechanical_value);

  // Validation: Reject mechanical values that are unreasonably small compared to total project value
  // (e.g., if total is $650M but mechValue is $98, that's clearly wrong)
  if (mechValue && totalValue && mechValue < totalValue * 0.05) {
    console.warn(`[Opportunity Search] Rejecting suspiciously low mechanical value $${mechValue.toLocaleString()} for total project value $${totalValue.toLocaleString()} (${(mechValue/totalValue*100).toFixed(2)}%). Will use 20% estimate instead.`);
    mechValue = null; // Force fallback to 20% estimate
  }

  // Estimate start date from estimated_start string
  let estimated_start_date = null;
  if (project.estimated_start) {
    // Try to parse quarter format like "Q3 2026"
    const qMatch = project.estimated_start.match(/Q([1-4])\s*(\d{4})/i);
    if (qMatch) {
      const quarterMonth = { '1': '01', '2': '04', '3': '07', '4': '10' };
      estimated_start_date = `${qMatch[2]}-${quarterMonth[qMatch[1]]}-01`;
    } else {
      // Try ISO or other date format
      const d = new Date(project.estimated_start);
      if (!isNaN(d.getTime())) {
        estimated_start_date = d.toISOString().split('T')[0];
      }
    }
  }

  // Log warning for projects with no value data at all
  if (!totalValue && !mechValue) {
    console.warn(`[Opportunity Search] Project "${project.project_name}" has no value data (estimated_value: ${project.estimated_value}, estimated_mechanical_value: ${project.estimated_mechanical_value})`);
  }

  return {
    id: index + 1,
    company_name: project.owner || 'Unknown Owner',
    project_name: project.project_name || 'Untitled Project',
    project_description: project.intelligence_notes || '',
    estimated_value: mechValue || (totalValue ? Math.round(totalValue * 0.2) : 0),
    estimated_total_project_value: totalValue || 0,
    value_is_estimated: !mechValue,
    contact_name: project.recommended_contact || null,
    contact_title: 'Director of Facilities',
    contact_email: null,
    contact_phone: null,
    source_url: project.source_url || null,
    location: project.location || '',
    construction_type: project.construction_type || 'New Construction',
    market_sector: typeMap[project.project_type] || project.project_type || 'Commercial',
    project_phase: project.project_phase || null,
    general_contractor: project.general_contractor || '',
    estimated_start_date,
    mechanical_scope: project.mechanical_scope || '',
    square_footage: project.square_footage || 'N/A',
    intelligence_source: project.intelligence_notes || '',
    next_steps: project.next_steps || '',
    confidence: project.confidence || 'medium',
    confidence_explanation: project.source_url
      ? `Based on verified source: ${project.source_url}`
      : 'Could not verify with a public source',
    timeline: [project.estimated_start, project.estimated_completion].filter(Boolean).join(' - ') || 'TBD',
  };
}

function classifyLead(lead) {
  const flags = [];

  // Check for suspect/placeholder email domains
  if (lead.contact_email) {
    const domain = lead.contact_email.split('@')[1]?.toLowerCase();
    if (domain && SUSPECT_EMAIL_DOMAINS.includes(domain)) {
      flags.push('suspect_email');
      lead.contact_email = null;
    }
  }

  if (!lead.contact_name) flags.push('no_contact_name');
  if (!lead.contact_email) flags.push('no_contact_email');
  if (!lead.contact_phone) flags.push('no_contact_phone');
  if (!lead.source_url) flags.push('no_source_url');
  if (lead.value_is_estimated) flags.push('estimated_values');

  let verification_status = 'unverified';
  if (lead.source_url && lead.confidence === 'high') {
    verification_status = 'verifiable';
  } else if (lead.source_url) {
    verification_status = 'unverified'; // has source but not high confidence
  } else if (flags.includes('suspect_email')) {
    verification_status = 'suspect';
  }

  return {
    ...lead,
    contact_email: lead.contact_email || null,
    contact_name: lead.contact_name || null,
    contact_phone: lead.contact_phone || null,
    source_url: lead.source_url || null,
    verification_status,
    verification_flags: flags,
  };
}

// Call Anthropic API with retry on rate-limit (429) errors
async function callAnthropicWithRetry(params, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err) {
      const isRateLimit = err.status === 429 || err?.error?.type === 'rate_limit_error';
      if (!isRateLimit || attempt === maxRetries) {
        throw err;
      }
      // Use retry-after header if available, otherwise exponential backoff
      const retryAfter = err.headers?.['retry-after'];
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(2000 * Math.pow(2, attempt), 30000);
      console.log(`[Opportunity Search] Rate limited (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${waitMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
}

// POST /api/opportunity-search/generate
router.post('/generate', async (req, res, next) => {
  // Set longer timeout for AI generation + web search
  req.setTimeout(300000);
  res.setTimeout(300000);

  try {
    const {
      market_sector,
      location,
      construction_type,
      min_value,
      max_value,
      keywords,
      additional_criteria
    } = req.body;

    // Validate at least one criteria is provided
    if (!market_sector && !location && !construction_type && !keywords && !additional_criteria) {
      return res.status(400).json({
        error: 'At least one search criteria is required'
      });
    }

    console.log('[Opportunity Search] Generating leads with web search for tenant:', req.tenantId);

    const userMessage = buildUserMessage({
      market_sector, location, construction_type,
      min_value, max_value, keywords, additional_criteria
    });

    // Build web search tool config with location-aware search and generous search budget
    const webSearchTool = {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 10,
    };

    // If a location was provided, set user_location to localize search results
    if (location) {
      const locParts = location.split(',').map(s => s.trim());
      const locConfig = { type: 'approximate' };
      if (locParts.length >= 2) {
        locConfig.city = locParts[0];
        locConfig.region = locParts[1];
        locConfig.country = 'US';
      } else if (locParts.length === 1) {
        locConfig.region = locParts[0];
        locConfig.country = 'US';
      }
      webSearchTool.user_location = locConfig;
      console.log('[Opportunity Search] User location set to:', JSON.stringify(locConfig));
    }

    const response = await callAnthropicWithRetry({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: [webSearchTool],
      messages: [{ role: 'user', content: userMessage }]
    });

    // Extract text from response content blocks (may include tool_use and text blocks)
    let responseText = '';
    const blockTypes = [];
    for (const block of response.content) {
      blockTypes.push(block.type);
      if (block.type === 'text') {
        responseText += block.text;
      }
    }
    console.log('[Opportunity Search] Response block types:', blockTypes.join(', '));
    console.log('[Opportunity Search] Stop reason:', response.stop_reason);
    console.log('[Opportunity Search] Text length:', responseText.length, 'chars');
    console.log('[Opportunity Search] Usage:', response.usage.input_tokens, 'in /', response.usage.output_tokens, 'out');

    const leadsJson = extractJsonFromResponse(responseText);

    if (!leadsJson) {
      console.error('[Opportunity Search] Failed to parse response. Full text:', responseText);
      return res.status(500).json({
        error: 'Failed to parse project search response. The AI may have returned a non-JSON explanation. Please try again.',
        rawResponse: responseText
      });
    }

    // Normalize from web-search format (projects) to frontend format (leads)
    // Try multiple possible keys the model might use
    const rawProjects = leadsJson.projects || leadsJson.leads || leadsJson.results || leadsJson.opportunities || [];

    if (rawProjects.length === 0) {
      console.warn('[Opportunity Search] Parsed JSON but found 0 projects. Keys in response:', Object.keys(leadsJson));
      console.warn('[Opportunity Search] Response text (first 1000 chars):', responseText.substring(0, 1000));
    }
    const normalizedLeads = rawProjects.map(normalizeProject);
    const classifiedLeads = normalizedLeads.map(classifyLead);

    console.log('[Opportunity Search] Found', classifiedLeads.length, 'verified projects');

    // Build summary
    const totalEstValue = classifiedLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
    const marketBreakdown = {};
    for (const lead of classifiedLeads) {
      marketBreakdown[lead.market_sector] = (marketBreakdown[lead.market_sector] || 0) + 1;
    }

    res.json({
      leads: classifiedLeads,
      summary: {
        total_leads: classifiedLeads.length,
        total_estimated_value: totalEstValue,
        market_breakdown: marketBreakdown,
        search_criteria_used: userMessage.split('\n').slice(1, -1).join(', '),
      },
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    });
  } catch (error) {
    console.error('[Opportunity Search] Error:', error);

    // Return user-friendly messages for known API errors
    const isRateLimit = error.status === 429 || error?.error?.type === 'rate_limit_error';
    if (isRateLimit) {
      return res.status(429).json({
        error: 'AI search is temporarily rate limited. Please wait a minute and try again.'
      });
    }

    const isAuth = error.status === 401 || error?.error?.type === 'authentication_error';
    if (isAuth) {
      return res.status(500).json({
        error: 'AI service authentication failed. Please check the API key configuration.'
      });
    }

    next(error);
  }
});

// GET /api/opportunity-search/saved - List all saved searches (lightweight, no full results)
router.get('/saved', async (req, res, next) => {
  try {
    const searches = await SavedSearches.findAllByTenant(req.tenantId);
    res.json(searches);
  } catch (error) {
    console.error('[Opportunity Search] Error fetching saved searches:', error);
    next(error);
  }
});

// GET /api/opportunity-search/saved/:id - Get a single saved search with full results
router.get('/saved/:id', async (req, res, next) => {
  try {
    const search = await SavedSearches.findById(Number(req.params.id), req.tenantId);
    if (!search) {
      return res.status(404).json({ error: 'Saved search not found' });
    }
    res.json(search);
  } catch (error) {
    console.error('[Opportunity Search] Error fetching saved search:', error);
    next(error);
  }
});

// POST /api/opportunity-search/saved - Save the current search results
router.post('/saved', async (req, res, next) => {
  try {
    const { name, criteria, results, summary } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'Results are required' });
    }

    const totalEstimatedValue = results.reduce(
      (sum, lead) => sum + (lead.estimated_value || 0), 0
    );

    const saved = await SavedSearches.create(
      {
        name: name.trim(),
        criteria,
        results,
        summary,
        leadCount: results.length,
        totalEstimatedValue
      },
      req.user.id,
      req.tenantId
    );

    res.status(201).json(saved);
  } catch (error) {
    console.error('[Opportunity Search] Error saving search:', error);
    next(error);
  }
});

// POST /api/opportunity-search/saved/bulk-delete - Delete multiple saved searches
router.post('/saved/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const deleted = await SavedSearches.deleteMany(ids.map(Number), req.tenantId);
    res.json({ success: true, deleted_count: deleted.length });
  } catch (error) {
    console.error('[Opportunity Search] Error bulk deleting saved searches:', error);
    next(error);
  }
});

// DELETE /api/opportunity-search/saved/:id - Delete a saved search
router.delete('/saved/:id', async (req, res, next) => {
  try {
    const deleted = await SavedSearches.delete(Number(req.params.id), req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Saved search not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Opportunity Search] Error deleting saved search:', error);
    next(error);
  }
});

// POST /api/opportunity-search/saved/:id/duplicate - Duplicate a saved search
router.post('/saved/:id/duplicate', async (req, res, next) => {
  try {
    const { name } = req.body;
    const duplicated = await SavedSearches.duplicate(
      Number(req.params.id), req.userId, req.tenantId, name
    );
    if (!duplicated) {
      return res.status(404).json({ error: 'Saved search not found' });
    }
    res.status(201).json(duplicated);
  } catch (error) {
    console.error('[Opportunity Search] Error duplicating saved search:', error);
    next(error);
  }
});

// GET /api/opportunity-search/saved/:id/pdf - Download PDF of a saved search
router.get('/saved/:id/pdf', async (req, res, next) => {
  try {
    console.log('[Opportunity Search PDF] Request for ID:', req.params.id, 'Tenant:', req.tenantId);

    const search = await SavedSearches.findById(Number(req.params.id), req.tenantId);
    if (!search) {
      console.log('[Opportunity Search PDF] Search not found');
      return res.status(404).json({ error: 'Saved search not found' });
    }

    console.log('[Opportunity Search PDF] Found search:', search.name, 'Results:', search.results?.length);

    const { generateOpportunitySearchPdfBuffer } = require('../utils/opportunitySearchPdfBuffer');

    // Use default domain (custom_domain column may not exist yet)
    const tenantDomain = 'app.titanpm.com';

    console.log('[Opportunity Search PDF] Generating PDF...');
    const pdfBuffer = await generateOpportunitySearchPdfBuffer(search, tenantDomain);
    console.log('[Opportunity Search PDF] PDF generated, size:', pdfBuffer.length);

    const safeName = (search.name || 'Opportunity-Search').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-${dateStr}.pdf"`);
    res.send(pdfBuffer);
    console.log('[Opportunity Search PDF] PDF sent successfully');
  } catch (error) {
    console.error('[Opportunity Search PDF] ERROR:', error.message);
    console.error('[Opportunity Search PDF] Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to generate PDF' });
  }
});

// ===== Recurring Searches Routes =====

// GET /api/opportunity-search/recurring - Get all recurring searches
router.get('/recurring', async (req, res, next) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    const searches = await RecurringSearches.findAllByTenant(req.tenantId, activeOnly);
    res.json(searches);
  } catch (error) {
    console.error('[Opportunity Search] Error fetching recurring searches:', error);
    next(error);
  }
});

// GET /api/opportunity-search/recurring/:id - Get a single recurring search
router.get('/recurring/:id', async (req, res, next) => {
  try {
    const search = await RecurringSearches.findById(Number(req.params.id), req.tenantId);
    if (!search) {
      return res.status(404).json({ error: 'Recurring search not found' });
    }
    res.json(search);
  } catch (error) {
    console.error('[Opportunity Search] Error fetching recurring search:', error);
    next(error);
  }
});

// POST /api/opportunity-search/recurring - Create a new recurring search
router.post('/recurring', async (req, res, next) => {
  try {
    const { name, description, criteria, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!criteria || Object.keys(criteria).length === 0) {
      return res.status(400).json({ error: 'Search criteria is required' });
    }

    const recurringSearch = await RecurringSearches.create(
      { name: name.trim(), description, criteria, is_active },
      req.user.id,
      req.tenantId
    );

    res.status(201).json(recurringSearch);
  } catch (error) {
    console.error('[Opportunity Search] Error creating recurring search:', error);
    next(error);
  }
});

// POST /api/opportunity-search/recurring/from-saved/:id - Create recurring search from a saved search
router.post('/recurring/from-saved/:id', async (req, res, next) => {
  try {
    const savedSearch = await SavedSearches.findById(Number(req.params.id), req.tenantId);
    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    const { name, description } = req.body;
    let recurringSearch = await RecurringSearches.create(
      {
        name: name || savedSearch.name,
        description: description || `Recurring version of: ${savedSearch.name}`,
        criteria: savedSearch.criteria,
        is_active: true,
      },
      req.user.id,
      req.tenantId
    );

    // Copy the results from the saved search to the recurring search
    if (savedSearch.results && savedSearch.results.length > 0) {
      recurringSearch = await RecurringSearches.updateLastRun(
        recurringSearch.id,
        savedSearch.lead_count || savedSearch.results.length,
        savedSearch.total_estimated_value || 0,
        savedSearch.results,
        req.tenantId
      );
    }

    res.status(201).json(recurringSearch);
  } catch (error) {
    console.error('[Opportunity Search] Error creating recurring search from saved:', error);
    next(error);
  }
});

// PUT /api/opportunity-search/recurring/:id - Update a recurring search
router.put('/recurring/:id', async (req, res, next) => {
  try {
    const { name, description, criteria, is_active } = req.body;
    const updated = await RecurringSearches.update(
      Number(req.params.id),
      { name, description, criteria, is_active },
      req.tenantId
    );

    if (!updated) {
      return res.status(404).json({ error: 'Recurring search not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Opportunity Search] Error updating recurring search:', error);
    next(error);
  }
});

// PATCH /api/opportunity-search/recurring/:id/toggle - Toggle active status
router.patch('/recurring/:id/toggle', async (req, res, next) => {
  try {
    const updated = await RecurringSearches.toggleActive(Number(req.params.id), req.tenantId);
    if (!updated) {
      return res.status(404).json({ error: 'Recurring search not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('[Opportunity Search] Error toggling recurring search:', error);
    next(error);
  }
});

// PATCH /api/opportunity-search/recurring/:id/update-results - Update last run results
router.patch('/recurring/:id/update-results', async (req, res, next) => {
  try {
    const { resultCount, resultValue, results } = req.body;
    const updated = await RecurringSearches.updateLastRun(
      Number(req.params.id),
      resultCount,
      resultValue,
      results,
      req.tenantId
    );

    if (!updated) {
      return res.status(404).json({ error: 'Recurring search not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Opportunity Search] Error updating recurring search results:', error);
    next(error);
  }
});

// DELETE /api/opportunity-search/recurring/:id - Delete a recurring search
router.delete('/recurring/:id', async (req, res, next) => {
  try {
    const deleted = await RecurringSearches.delete(Number(req.params.id), req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Recurring search not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Opportunity Search] Error deleting recurring search:', error);
    next(error);
  }
});

// POST /api/opportunity-search/recurring/:id/duplicate - Duplicate a recurring search
router.post('/recurring/:id/duplicate', async (req, res, next) => {
  try {
    const { name } = req.body;
    const duplicated = await RecurringSearches.duplicate(
      Number(req.params.id), req.userId, req.tenantId, name
    );
    if (!duplicated) {
      return res.status(404).json({ error: 'Recurring search not found' });
    }
    res.status(201).json(duplicated);
  } catch (error) {
    console.error('[Opportunity Search] Error duplicating recurring search:', error);
    next(error);
  }
});

// GET /api/opportunity-search/recurring/:id/pdf - Download PDF of a recurring search
router.get('/recurring/:id/pdf', async (req, res, next) => {
  try {
    const recurringSearch = await RecurringSearches.findById(Number(req.params.id), req.tenantId);
    if (!recurringSearch) {
      return res.status(404).json({ error: 'Recurring search not found' });
    }

    console.log('[Opportunity Search] Generating PDF for recurring search:', recurringSearch.name);

    // Check if we have saved results to use
    if (!recurringSearch.last_results || recurringSearch.last_results.length === 0) {
      return res.status(400).json({
        error: 'No results available for this recurring search. Please run the search first by clicking "Rerun".'
      });
    }

    // Use the saved results instead of running a fresh AI search
    const leads = recurringSearch.last_results;
    const summary = {
      lead_count: recurringSearch.last_result_count,
      total_estimated_value: recurringSearch.last_result_value
    };

    // Build a search object for PDF generation
    const searchData = {
      id: recurringSearch.id,
      name: recurringSearch.name,
      criteria: recurringSearch.criteria,
      results: leads,
      summary: summary,
      created_at: recurringSearch.created_at
    };

    const { generateOpportunitySearchPdfBuffer } = require('../utils/opportunitySearchPdfBuffer');
    const tenantDomain = 'app.titanpm.com';

    const pdfBuffer = await generateOpportunitySearchPdfBuffer(searchData, tenantDomain);

    const safeName = (recurringSearch.name || 'Recurring-Search').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[Opportunity Search] Error generating recurring search PDF:', error);
    next(error);
  }
});

module.exports = router;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
module.exports.buildUserMessage = buildUserMessage;
module.exports.normalizeProject = normalizeProject;
module.exports.classifyLead = classifyLead;
