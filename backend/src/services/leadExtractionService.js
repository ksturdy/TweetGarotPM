const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a lead data extraction specialist for Tweet Garot Mechanical, a mechanical contracting company specializing in plumbing, HVAC, process piping, and refrigeration.

Your job is to extract structured opportunity data from incoming lead emails.

CRITICAL RULES:
- Extract ONLY information explicitly stated in the email
- Do NOT fabricate, assume, or infer information not present in the email
- Use null for any missing fields
- Parse dollar values into numbers (e.g., "$1.5M" → 1500000, "$270 million" → 270000000)
- Extract dates in YYYY-MM-DD format when possible
- Infer project_type and construction_type from context clues when reasonable
- Extract all contact information carefully (name, email, phone, company)
- If the email mentions a total project value, estimate mechanical scope at 20% unless explicitly stated otherwise

CONFIDENCE LEVELS:
- high: Email contains clear project details, contact info, and project value/scope
- medium: Some key details present but missing important information
- low: Very limited information, unclear if legitimate lead

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "string (concise project name based on email content)",
  "description": "string (project details and context from email)",
  "client_name": "string (contact person name)",
  "client_email": "string (valid email address)",
  "client_phone": "string (phone number if mentioned)",
  "client_company": "string (company or organization name)",
  "estimated_value": number or null (estimated mechanical scope value in dollars),
  "location": "string (city, state or address)",
  "project_type": "Healthcare|Industrial|Manufacturing|Data Center|Commercial|Education|Government|Residential|Other|null",
  "construction_type": "New Construction|Renovation|Expansion|Tenant Improvement|Other|null",
  "market": "string (market sector if identifiable)",
  "source": "Email Inquiry|Referral|Website|Bid Invitation|Other",
  "general_contractor": "string or null",
  "architect": "string or null",
  "engineer": "string or null",
  "estimated_start_date": "YYYY-MM-DD or null",
  "priority": "low|medium|high|urgent (based on urgency indicators in email)",
  "confidence": "high|medium|low (your confidence in the extracted data)",
  "extraction_notes": "string (brief notes about confidence level and any assumptions made)"
}`;

function extractJsonFromResponse(text) {
  try {
    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonText = text;

    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    } else {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    return JSON.parse(jsonText);
  } catch (e) {
    console.error('[Lead Extraction] Failed to parse JSON from response:', e);
    return null;
  }
}

function buildExtractionPrompt(emailData) {
  const { fromEmail, fromName, subject, bodyText, strippedText } = emailData;

  // Prefer stripped text (without signature/replies) but fall back to full body
  const emailBody = strippedText || bodyText || '(empty email body)';

  const prompt = `Extract lead data from this email:

FROM: ${fromName || fromEmail || 'Unknown'}
EMAIL: ${fromEmail || 'Not provided'}
SUBJECT: ${subject || '(No Subject)'}

BODY:
${emailBody}

Extract all relevant opportunity information and return as JSON only.`;

  return prompt;
}

async function extractLeadData(emailData) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        success: false,
        error: 'ANTHROPIC_API_KEY not configured',
        data: null,
        confidence: null,
      };
    }

    const userPrompt = buildExtractionPrompt(emailData);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      temperature: 0.2, // Low temperature for consistent extraction
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: userPrompt,
      }],
      timeout: 60000, // 60 second timeout
    });

    let responseText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }

    const extractedData = extractJsonFromResponse(responseText);

    if (!extractedData) {
      return {
        success: false,
        error: 'Failed to parse AI response as JSON',
        data: null,
        confidence: null,
      };
    }

    // Extract confidence from the response
    const confidence = extractedData.confidence || 'low';

    return {
      success: true,
      data: extractedData,
      confidence,
      error: null,
    };

  } catch (error) {
    console.error('[Lead Extraction] Error during AI extraction:', error);

    return {
      success: false,
      error: error.message || 'Unknown error during AI extraction',
      data: null,
      confidence: null,
    };
  }
}

module.exports = {
  extractLeadData,
};
