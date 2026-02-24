const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

// Apply middleware
router.use(authenticate);
router.use(tenantContext);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a construction project intelligence researcher for a mechanical contracting company specializing in plumbing, HVAC, process piping, and refrigeration. Your job is to find REAL, publicly announced construction projects using web search.

CRITICAL RULES:
- You MUST use web search to find actual projects. Do NOT generate, fabricate, or speculate on projects.
- Every project you return MUST be based on a real news article, press release, permit filing, or official announcement found via web search.
- If you cannot find verified projects matching the criteria, say so honestly. Do NOT invent projects to fill results.
- Include the source URL for every project.
- Run multiple searches to be thorough - search for news articles, owner press releases, permit filings, and GC announcements.
- Estimate the mechanical scope value as approximately 15-25% of total project value for healthcare/institutional projects.

For each verified project found, return ONLY a valid JSON object with this structure:
{"projects":[{"project_name":"string","owner":"string","location":"string","estimated_value":"string or null","estimated_mechanical_value":"string or null","project_type":"Healthcare|Industrial|Manufacturing|Data Center|Commercial|Education|Government","construction_type":"New Construction|Renovation|Expansion","estimated_start":"string or null","estimated_completion":"string or null","square_footage":"string or null","general_contractor":"string or null","architect":"string or null","source_url":"string","source_date":"string","confidence":"high|medium|low","mechanical_scope":"string describing estimated HVAC plumbing piping scope based on project type and size","intelligence_notes":"string explaining why this is a real opportunity with relevant context","recommended_contact":"string or null","next_steps":"string"}]}`;

function buildUserMessage(criteria) {
  const parts = ['Search the web for real, publicly announced construction projects with these criteria:'];

  if (criteria.market_sector) {
    parts.push(`- Market Sector: ${criteria.market_sector}`);
  }
  if (criteria.location) {
    parts.push(`- Location/Region: ${criteria.location}`);
  }
  if (criteria.construction_type) {
    parts.push(`- Construction Type: ${criteria.construction_type}`);
  }
  if (criteria.min_value || criteria.max_value) {
    const min = criteria.min_value ? `$${Number(criteria.min_value).toLocaleString()}` : 'any';
    const max = criteria.max_value ? `$${Number(criteria.max_value).toLocaleString()}` : 'any';
    parts.push(`- Project Size Range: ${min} to ${max}`);
  }
  if (criteria.keywords) {
    parts.push(`- Keywords/Focus: ${criteria.keywords}`);
  }
  if (criteria.additional_criteria) {
    parts.push(`- Additional Context: ${criteria.additional_criteria}`);
  }

  parts.push('\nUse web search to find real projects. Run multiple searches to be thorough. Return results as JSON only.');

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
  const mechValue = parseDollar(project.estimated_mechanical_value);

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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
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
    next(error);
  }
});

module.exports = router;
