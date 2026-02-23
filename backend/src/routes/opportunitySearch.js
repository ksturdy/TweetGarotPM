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

function buildSearchSystemPrompt() {
  return `You are Titan, an AI sales intelligence assistant for Tweet Garot Mechanical, a leading mechanical contracting company in Arizona specializing in HVAC, plumbing, piping, and mechanical systems for commercial and industrial construction.

Your role is to generate realistic, actionable construction-industry sales leads based on search criteria. You have deep knowledge of:
- The Arizona construction market (Phoenix metro, Tucson, Flagstaff, and surrounding areas)
- Major general contractors, developers, and building owners in the region
- Healthcare, education, commercial, industrial, retail, government, hospitality, and data center markets
- Typical HVAC/mechanical project scopes, values, and timelines
- Current construction trends and upcoming projects

## IMPORTANT GUIDELINES:
1. Generate 6-10 realistic leads per search
2. Each lead should be specific and detailed enough to be actionable
3. Use realistic company names, project descriptions, and contact info that feel authentic to the market
4. Contact information should be realistic but clearly fictional (use example.com emails)
5. Estimated values should be realistic for the project scope and market
6. Include a clear reasoning for why each lead is a good fit for a mechanical contractor
7. Vary confidence levels realistically (not all high)
8. Vary the project timeline across near-term and mid-term horizons
9. Consider seasonal construction patterns in Arizona (summer slowdowns for exterior work)
10. For mechanical contracting, typical project values range from $200K for small TI projects to $10M+ for large hospitals/data centers

## RESPONSE FORMAT:
Return ONLY a valid JSON object with this exact structure (no additional text before or after):

{
  "leads": [
    {
      "id": 1,
      "company_name": "string - the building owner or developer",
      "project_name": "string - specific project name",
      "project_description": "string - 2-3 sentence description of scope including HVAC/mechanical specifics",
      "estimated_value": number,
      "contact_name": "string - realistic name",
      "contact_title": "string - appropriate title (facilities director, project manager, etc.)",
      "contact_email": "string - use example.com domain",
      "contact_phone": "string - local area codes",
      "location": "string - city, state",
      "construction_type": "string - New Construction | Renovation | Tenant Improvement | Addition | Retrofit | Service/Maintenance",
      "market_sector": "string - Healthcare | Education | Commercial | Industrial | Retail | Government | Hospitality | Data Center",
      "general_contractor": "string - the GC or CM firm managing the project, if applicable (leave empty string if owner-direct or unknown)",
      "info_url": "string - a Google search URL to find more info about this lead. Format: https://www.google.com/search?q= followed by URL-encoded search terms combining company name, location, and project type. Example: https://www.google.com/search?q=Banner+Health+Mesa+AZ+hospital+expansion+construction",
      "estimated_start_date": "string - ISO date (YYYY-MM-DD) for projected start, use first day of the quarter (e.g. 2026-07-01 for Q3 2026, 2026-10-01 for Q4 2026, 2027-01-01 for Q1 2027)",
      "reasoning": "string - 1-2 sentences on why this is a good lead for a mechanical contractor",
      "confidence": "high | medium | low",
      "timeline": "string - estimated project timeline like Q3 2026 - Q1 2027"
    }
  ],
  "summary": {
    "total_leads": number,
    "total_estimated_value": number,
    "market_breakdown": { "sector": count },
    "search_criteria_used": "string - summary of search criteria"
  }
}`;
}

function buildUserMessage(criteria) {
  const parts = ['Search for mechanical contracting opportunities with these criteria:'];

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

  parts.push('\nGenerate realistic, actionable leads based on these criteria. Return the results in JSON format only.');

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

// POST /api/opportunity-search/generate
router.post('/generate', async (req, res, next) => {
  // Set longer timeout for AI generation
  req.setTimeout(180000);
  res.setTimeout(180000);

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

    console.log('[Opportunity Search] Generating leads for tenant:', req.tenantId);

    const systemPrompt = buildSearchSystemPrompt();
    const userMessage = buildUserMessage({
      market_sector, location, construction_type,
      min_value, max_value, keywords, additional_criteria
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const responseText = response.content[0].text;
    const leadsJson = extractJsonFromResponse(responseText);

    if (!leadsJson) {
      console.error('[Opportunity Search] Failed to parse response:', responseText.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse lead generation response',
        rawResponse: responseText
      });
    }

    console.log('[Opportunity Search] Generated', (leadsJson.leads || []).length, 'leads');

    res.json({
      leads: leadsJson.leads || [],
      summary: leadsJson.summary || {},
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
