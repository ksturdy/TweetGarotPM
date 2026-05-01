const express = require('express');
const mammoth = require('mammoth');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createMemoryUploadMiddleware } = require('../middleware/uploadHandler');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const config = require('../config');
const CaseStudy = require('../models/CaseStudy');
const CaseStudyImage = require('../models/CaseStudyImage');
const Project = require('../models/Project');
const Customer = require('../models/Customer');

const router = express.Router();

// Apply auth and tenant middleware
router.use(authenticate);
router.use(tenantContext);

// Configure upload middleware for .docx files (memory storage for processing)
const docxUpload = createMemoryUploadMiddleware({
  allowedTypes: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  maxSize: 25 * 1024 * 1024, // 25MB total
});

// --- Utility functions ---

/**
 * Dice coefficient bigram similarity (0-1)
 */
function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (str) => {
    const bigrams = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const aBigrams = getBigrams(a);
  const bBigrams = getBigrams(b);
  let intersection = 0;
  for (const [bigram, count] of aBigrams) {
    if (bBigrams.has(bigram)) {
      intersection += Math.min(count, bBigrams.get(bigram));
    }
  }

  const totalBigrams = a.length - 1 + b.length - 1;
  return (2 * intersection) / totalBigrams;
}

/**
 * Extract text and embedded images from a .docx buffer using mammoth
 */
async function extractDocxContent(buffer) {
  // Extract plain text for Claude parsing
  const textResult = await mammoth.extractRawText({ buffer });

  // Extract embedded images
  const images = [];
  await mammoth.convertToHtml({ buffer }, {
    convertImage: mammoth.images.imgElement(function(image) {
      return image.read().then(function(imageBuffer) {
        images.push({
          buffer: imageBuffer,
          contentType: image.contentType,
          altText: image.altText || null,
        });
        return { src: '' };
      });
    })
  });

  return { text: textResult.value, images };
}

/**
 * Map MIME content type to file extension
 */
function getExtensionFromContentType(contentType) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/svg+xml': '.svg',
  };
  return map[contentType] || '.png';
}

/**
 * Save extracted images to storage (R2 or local disk)
 * Returns array of saved image info objects
 */
async function saveExtractedImages(images, sourceFilename) {
  const savedImages = [];
  const baseName = sourceFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9.-]/g, '_');

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const ext = getExtensionFromContentType(image.contentType);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const fileName = `${uniqueSuffix}-imported-${baseName}-${i + 1}${ext}`;
    const destination = 'uploads/case-studies';
    const key = `${destination}/${fileName}`;

    try {
      if (isR2Enabled()) {
        const r2Client = getR2Client();
        const command = new PutObjectCommand({
          Bucket: config.r2.bucketName,
          Key: key,
          Body: image.buffer,
          ContentType: image.contentType,
        });
        await r2Client.send(command);
      } else {
        const uploadDir = path.join(__dirname, '../../', destination);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadDir, fileName), image.buffer);
      }

      savedImages.push({
        file_name: `imported-${baseName}-${i + 1}${ext}`,
        file_path: isR2Enabled() ? key : path.join(__dirname, '../../', key),
        file_size: image.buffer.length,
        file_type: image.contentType,
      });
    } catch (err) {
      console.error(`[Case Study Import] Error saving image ${i + 1} from ${sourceFilename}:`, err.message);
    }
  }

  return savedImages;
}

/**
 * Parse case study text with Claude AI
 */
async function parseWithClaude(documentText, apiKey) {
  const anthropic = new Anthropic({
    apiKey,
    timeout: 120000,
    maxRetries: 2,
  });

  const systemPrompt = `You are a document parser for Tweet Garot Mechanical, a mechanical contracting company.
You will be given the text content of a case study document. Extract all structured information into JSON.

## Output Schema
{
  "title": "string — marketing-friendly title for the case study (e.g. 'Chippewa Valley Technical College HVAC Renovation')",
  "subtitle": "string or null — optional subtitle",
  "project_name": "string — the project/facility name as stated in the document",
  "location": "string or null — city, state if mentioned (e.g. 'Eau Claire, WI')",
  "market": "string or null — MUST be one of these exact values: Amusement/Recreation, Communication, Conservation/Development, Educational, Health Care, Highway/Street, Lodging, Manufacturing, MFG-Food, MFG-Other, MFG-Paper, Office, Power, Public Safety, Religious, Residential, Sewage/Waste Disposal, Transportation, Water Supply",
  "construction_type": ["array of strings — each MUST be one of: New Construction, Renovation, Retrofit, Addition, Service"],
  "services_provided": ["array of strings — each MUST be one of: HVAC, Plumbing, Industrial Piping, Process Piping, Industrial Sheet Metal, Industrial Ventilation, Custom Equipment Design, Engineering, Building Automation Systems, Air Purification, BIM, Medical Gas, Dust Collection"],
  "challenge": "string — the partnership/challenge narrative paragraphs. Wrap each paragraph in <p></p> tags.",
  "solution": "string — the scope of work/solution narrative paragraphs. Wrap each paragraph in <p></p> tags.",
  "results": "string — the results/outcomes narrative paragraphs. Wrap each paragraph in <p></p> tags.",
  "executive_summary": "string or null — a brief 1-2 sentence summary of the case study",
  "general_contractor": "string or null",
  "owner": "string or null — building owner or end client",
  "architect": "string or null",
  "engineer": "string or null",
  "square_footage": "number or null — as a plain number, no commas",
  "contract_value": "number or null — approximate contract value in dollars, as a plain number",
  "project_duration": "string or null — e.g. '4 Months'"
}

IMPORTANT:
- Map the document's stated market to the closest match from the allowed market list above. For example "Education" maps to "Educational", "Healthcare" maps to "Health Care".
- For narrative fields (challenge, solution, results), preserve paragraph structure with <p> tags.
- If the document has a single block of narrative text without clear sections, put the full narrative in "challenge" and set solution/results to short summaries extracted from the text.
- Extract monetary values as plain numbers (no $ or commas). "$710,400" becomes 710400.
- Extract square footage as a plain number. "28,000" becomes 28000.
- If a field is not present in the document, set it to null.
- Respond with ONLY valid JSON. No markdown code fences. No commentary.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Parse this case study document and respond with JSON only:\n\n${documentText}`,
      },
    ],
  });

  const responseText = message.content[0].text;

  // Strip markdown code fences if present
  let jsonText = responseText.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  return JSON.parse(jsonText);
}

/**
 * Fuzzy-match parsed data against tenant projects
 */
async function findProjectMatches(parsedData, tenantId) {
  const projects = await Project.findAllByTenant(tenantId);
  const candidates = [];

  for (const project of projects) {
    let score = 0;
    const reasons = [];

    // 1. Name similarity (up to 40 pts)
    const nameSim = stringSimilarity(parsedData.project_name, project.name);
    score += Math.round(nameSim * 40);
    if (nameSim > 0.3) reasons.push(`Name: ${Math.round(nameSim * 100)}%`);

    // 2. Client/customer match (up to 20 pts)
    const customerName = project.customer_name || project.client || '';
    if (parsedData.owner && customerName) {
      const clientSim = stringSimilarity(parsedData.owner, customerName);
      score += Math.round(clientSim * 20);
      if (clientSim > 0.3) reasons.push(`Client: ${Math.round(clientSim * 100)}%`);
    }

    // 3. Address/location match (up to 15 pts)
    if (parsedData.location && project.address) {
      const addrSim = stringSimilarity(parsedData.location, project.address);
      score += Math.round(addrSim * 15);
      if (addrSim > 0.2) reasons.push(`Location: ${Math.round(addrSim * 100)}%`);
    }

    // 4. Market match (10 pts)
    if (parsedData.market && project.market && parsedData.market.toLowerCase() === project.market.toLowerCase()) {
      score += 10;
      reasons.push('Market match');
    }

    // 5. Contract value proximity (up to 15 pts)
    if (parsedData.contract_value && project.contract_value) {
      const docVal = Number(parsedData.contract_value);
      const projVal = Number(project.contract_value);
      if (docVal > 0 && projVal > 0) {
        const ratio = Math.min(docVal, projVal) / Math.max(docVal, projVal);
        score += Math.round(ratio * 15);
        if (ratio > 0.5) reasons.push(`Value: ${Math.round(ratio * 100)}%`);
      }
    }

    if (score >= 15) {
      candidates.push({
        project_id: project.id,
        project_name: project.name,
        project_number: project.number,
        client: project.customer_name || project.client,
        market: project.market,
        contract_value: project.contract_value,
        confidence: Math.min(score, 100),
        match_reasons: reasons,
      });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 5);
}

/**
 * Fuzzy-match owner against tenant customers
 */
async function findCustomerMatches(parsedData, tenantId) {
  if (!parsedData.owner) return [];
  const customers = await Customer.findAllByTenant(tenantId);

  return customers
    .map((c) => {
      const name = c.name || c.customer_owner || '';
      const sim = stringSimilarity(parsedData.owner, name);
      return {
        customer_id: c.id,
        customer_name: name,
        confidence: Math.round(sim * 100),
      };
    })
    .filter((m) => m.confidence >= 30)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

// --- Routes ---

/**
 * POST /api/case-studies/import
 * Upload and parse multiple .docx case study files
 */
router.post('/import', docxUpload.array('files', 20), async (req, res, next) => {
  // 10-minute timeout for large batches
  req.setTimeout(600000);
  res.setTimeout(600000);

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Claude API key not configured. Please contact your administrator.',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`[Case Study Import] Processing ${req.files.length} file(s) for tenant ${req.tenantId}`);

    const results = [];

    for (const file of req.files) {
      try {
        console.log(`[Case Study Import] Extracting content from: ${file.originalname}`);
        const { text, images } = await extractDocxContent(file.buffer);

        if (!text || text.trim().length < 50) {
          results.push({
            filename: file.originalname,
            status: 'error',
            error: 'Document appears empty or contains no extractable text',
          });
          continue;
        }

        console.log(`[Case Study Import] Text extracted (${text.length} chars), ${images.length} image(s) found, sending to Claude...`);
        const parsed = await parseWithClaude(text, apiKey);

        // Save extracted images to storage
        let extractedImages = [];
        if (images.length > 0) {
          extractedImages = await saveExtractedImages(images, file.originalname);
          console.log(`[Case Study Import] Saved ${extractedImages.length} image(s) from ${file.originalname}`);
        }
        parsed.extracted_images = extractedImages;

        console.log(`[Case Study Import] Parsed successfully: "${parsed.title}"`);
        const projectMatches = await findProjectMatches(parsed, req.tenantId);
        const customerMatches = await findCustomerMatches(parsed, req.tenantId);

        console.log(`[Case Study Import] Found ${projectMatches.length} project matches, ${customerMatches.length} customer matches`);

        results.push({
          filename: file.originalname,
          status: 'success',
          parsed,
          project_matches: projectMatches,
          customer_matches: customerMatches,
        });
      } catch (err) {
        console.error(`[Case Study Import] Error processing ${file.originalname}:`, err.message);
        results.push({
          filename: file.originalname,
          status: 'error',
          error: err.message,
        });
      }
    }

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/case-studies/import/confirm
 * Create case studies from user-reviewed import data
 */
router.post('/import/confirm', async (req, res, next) => {
  try {
    const { case_studies } = req.body;

    if (!Array.isArray(case_studies) || case_studies.length === 0) {
      return res.status(400).json({ error: 'No case studies provided' });
    }

    console.log(`[Case Study Import] Confirming ${case_studies.length} case study imports for tenant ${req.tenantId}`);

    const created = [];
    const errors = [];

    for (const csData of case_studies) {
      try {
        const record = await CaseStudy.create(
          {
            title: csData.title,
            subtitle: csData.subtitle || null,
            project_ids: csData.project_ids || [],
            customer_id: csData.customer_id || null,
            challenge: csData.challenge || null,
            solution: csData.solution || null,
            results: csData.results || null,
            executive_summary: csData.executive_summary || null,
            market: csData.market || null,
            construction_type: csData.construction_type || [],
            services_provided: csData.services_provided || [],
            override_contract_value: csData.contract_value != null ? csData.contract_value : null,
            override_square_footage: csData.square_footage != null ? csData.square_footage : null,
            created_by: req.user.id,
          },
          req.tenantId
        );

        // Create case_study_images records for extracted images
        if (csData.extracted_images && csData.extracted_images.length > 0) {
          for (let i = 0; i < csData.extracted_images.length; i++) {
            try {
              await CaseStudyImage.create({
                case_study_id: record.id,
                file_name: csData.extracted_images[i].file_name,
                file_path: csData.extracted_images[i].file_path,
                file_size: csData.extracted_images[i].file_size,
                file_type: csData.extracted_images[i].file_type,
                display_order: i + 1,
                is_hero_image: i === 0,
                is_before_photo: false,
                is_after_photo: false,
                uploaded_by: req.user.id,
              });
            } catch (imgErr) {
              console.error(`[Case Study Import] Error creating image record for "${csData.title}":`, imgErr.message);
            }
          }
          console.log(`[Case Study Import] Created ${csData.extracted_images.length} image record(s) for "${csData.title}"`);
        }

        created.push({ filename: csData._source_filename, case_study: record });
      } catch (err) {
        console.error(`[Case Study Import] Error creating case study "${csData.title}":`, err.message);
        errors.push({ filename: csData._source_filename, title: csData.title, error: err.message });
      }
    }

    console.log(`[Case Study Import] Created ${created.length}, errors: ${errors.length}`);
    res.status(201).json({ created, errors });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
