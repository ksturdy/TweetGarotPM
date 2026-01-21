const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticate } = require('../middleware/auth');
const ContractReview = require('../models/ContractReview');
const ContractRiskFinding = require('../models/ContractRiskFinding');
const ContractAnnotation = require('../models/ContractAnnotation');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl, getFileInfo } = require('../utils/fileStorage');
const { isR2Enabled } = require('../config/r2Client');

const router = express.Router();

// Configure upload middleware with R2 or local storage
const upload = createUploadMiddleware({
  destination: 'uploads/contracts',
  allowedTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  maxSize: 50 * 1024 * 1024, // 50MB limit
});

// Check if server has Claude API key configured (before auth middleware)
router.get('/claude-config', async (req, res) => {
  res.json({
    hasServerKey: !!process.env.ANTHROPIC_API_KEY
  });
});

// Apply auth middleware to all routes
router.use(authenticate);

// Get all contract reviews
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      overall_risk: req.query.overall_risk,
      needs_legal_review: req.query.needs_legal_review === 'true' ? true : undefined,
      uploaded_by: req.query.uploaded_by,
      search: req.query.search,
    };
    const reviews = await ContractReview.findAll(filters);
    res.json(reviews);
  } catch (error) {
    next(error);
  }
});

// Get contract review statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await ContractReview.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Analyze contract with Claude API (proxy endpoint) - MUST BE BEFORE /:id route
router.post('/analyze', async (req, res, next) => {
  try {
    const { contractText, pageTexts, apiKey: userApiKey } = req.body;

    // Use server-side API key from environment variable (same as chatbot), or fall back to user-provided key
    const apiKey = process.env.ANTHROPIC_API_KEY || userApiKey;

    if (!apiKey) {
      return res.status(400).json({
        error: 'Claude API key not configured. Please contact your administrator or provide your own API key.'
      });
    }

    if (!contractText) {
      return res.status(400).json({ error: 'Contract text is required' });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `You are a contract review specialist for Tweet Garot Mechanical, a mechanical contracting company specializing in plumbing, HVAC, and piping for commercial and industrial projects. Analyze subcontracts from general contractors to identify risk factors.

Analyze the provided contract and identify risks in these categories:
- Payment Terms, Retainage, Liquidated Damages, Consequential Damages
- Indemnification, Flow-Down Provisions, Warranty, Termination
- Dispute Resolution, Notice Requirements, Change Orders, Schedule/Delays
- Insurance, Bonding, Lien Rights

CRITICAL INSTRUCTIONS:
1. Read the contract text VERY CAREFULLY and extract exact information
2. For payment terms, find the EXACT number of days stated in the contract
3. For each risk, quote the EXACT text from the contract
4. Identify the correct page number where each issue appears
5. Do NOT make assumptions or use placeholder values
6. If page-by-page text is provided, use it to determine accurate page numbers

For each risk found, provide:
1. category (use snake_case matching categories above)
2. title (human readable name)
3. risk_level (HIGH, MODERATE, or LOW)
4. finding (specific and accurate description of the issue)
5. recommendation (what to negotiate or change)
6. quoted_text (EXACT text from contract, minimum 10 words)
7. page_number (actual page where this text appears, if determinable)

Also extract:
- contractValue (number, extract exact value if stated, otherwise null)
- projectName (exact name from contract)
- generalContractor (exact name from contract)
- overallRisk (HIGH, MODERATE, or LOW based on findings)

Respond ONLY with valid JSON in this format:
{
  "contractValue": 1500000,
  "projectName": "Project Name",
  "generalContractor": "GC Name",
  "overallRisk": "HIGH",
  "risks": [
    {
      "category": "payment_terms",
      "title": "Payment Terms",
      "risk_level": "MODERATE",
      "finding": "Payment terms are Net 75 days from invoice date, which is longer than industry standard",
      "recommendation": "Negotiate to Net 30 days to improve cash flow",
      "quoted_text": "Payment shall be made within seventy-five (75) days of receipt of invoice",
      "page_number": 3
    }
  ]
}`;

    let userContent = 'Analyze this contract and respond with JSON only:\n\n';

    if (pageTexts && pageTexts.length > 0) {
      userContent += 'CONTRACT TEXT BY PAGE:\n\n';
      pageTexts.forEach((page) => {
        userContent += `=== PAGE ${page.page} ===\n${page.text}\n\n`;
      });
    } else {
      userContent += contractText;
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'No valid JSON found in Claude response' });
    }

    const analysisResults = JSON.parse(jsonMatch[0]);
    res.json(analysisResults);
  } catch (error) {
    console.error('Claude API error:', error);
    console.error('Error details:', error.message, error.stack);

    // Return more detailed error information
    if (error.status) {
      return res.status(error.status).json({
        error: error.message || 'Claude API error',
        details: error.error?.message || error.message
      });
    }

    next(error);
  }
});

// Get single contract review with risk findings and annotations
router.get('/:id', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    const findings = await ContractRiskFinding.findByContractReview(req.params.id);
    const annotations = await ContractAnnotation.findByContractReview(req.params.id);

    res.json({
      ...review,
      findings,
      annotations,
    });
  } catch (error) {
    next(error);
  }
});

// Create new contract review with optional file upload
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    console.log('POST /contract-reviews - Request body:', JSON.stringify(req.body, null, 2));
    console.log('POST /contract-reviews - User:', req.user);
    console.log('POST /contract-reviews - File:', req.file);

    const reviewData = {
      ...req.body,
      uploaded_by: req.user.id,
    };

    // Add file information if file was uploaded
    if (req.file) {
      const fileInfo = getFileInfo(req.file);
      reviewData.file_name = fileInfo.fileName;
      reviewData.file_path = fileInfo.filePath;
      reviewData.file_size = fileInfo.fileSize;
    }

    console.log('Creating contract review with data:', JSON.stringify(reviewData, null, 2));

    const review = await ContractReview.create(reviewData);
    console.log('Contract review created:', review);

    // Create risk findings if provided
    const findings = req.body.findings ? JSON.parse(req.body.findings) : [];
    if (findings && findings.length > 0) {
      console.log(`Creating ${findings.length} risk findings...`);
      for (const finding of findings) {
        const findingData = {
          contract_review_id: review.id,
          ...finding,
        };
        console.log('Creating finding:', findingData);
        await ContractRiskFinding.create(findingData);
      }
    }

    // Fetch the complete review with findings
    const fetchedFindings = await ContractRiskFinding.findByContractReview(review.id);
    console.log(`Fetched ${fetchedFindings.length} findings for review ${review.id}`);

    res.status(201).json({
      ...review,
      findings: fetchedFindings,
    });
  } catch (error) {
    console.error('Error in POST /contract-reviews:', error);
    next(error);
  }
});

// Update contract review
router.put('/:id', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    // Automatically set reviewed_at when status changes to under_review
    if (req.body.status === 'under_review' && !review.reviewed_at) {
      req.body.reviewed_at = new Date();
      req.body.reviewed_by = req.user.id;
    }

    // Automatically set approved_at when status changes to approved or rejected
    if ((req.body.status === 'approved' || req.body.status === 'rejected') && !review.approved_at) {
      req.body.approved_at = new Date();
      req.body.approved_by = req.user.id;
    }

    const updated = await ContractReview.update(req.params.id, req.body);
    const findings = await ContractRiskFinding.findByContractReview(req.params.id);

    res.json({
      ...updated,
      findings,
    });
  } catch (error) {
    next(error);
  }
});

// Delete contract review
router.delete('/:id', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    // Only allow deletion by uploader or admin
    if (review.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }

    // Delete the file from R2 or local storage
    if (review.file_path) {
      await deleteFile(review.file_path).catch(console.error);
    }

    await ContractReview.delete(req.params.id);
    res.json({ message: 'Contract review deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Risk Findings Routes

// Add new risk finding to existing contract review
router.post('/:id/findings', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    const finding = await ContractRiskFinding.create({
      contract_review_id: req.params.id,
      ...req.body,
    });

    res.status(201).json(finding);
  } catch (error) {
    next(error);
  }
});

// Update risk finding
router.put('/:id/findings/:findingId', async (req, res, next) => {
  try {
    const finding = await ContractRiskFinding.findById(req.params.findingId);
    if (!finding) {
      return res.status(404).json({ error: 'Risk finding not found' });
    }

    // Automatically set resolved_at when status changes to resolved
    if (req.body.status === 'resolved' && !finding.resolved_at) {
      req.body.resolved_at = new Date();
      req.body.resolved_by = req.user.id;
    }

    const updated = await ContractRiskFinding.update(req.params.findingId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete risk finding
router.delete('/:id/findings/:findingId', async (req, res, next) => {
  try {
    const finding = await ContractRiskFinding.findById(req.params.findingId);
    if (!finding) {
      return res.status(404).json({ error: 'Risk finding not found' });
    }

    await ContractRiskFinding.delete(req.params.findingId);
    res.json({ message: 'Risk finding deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Annotation Routes

// Get all annotations for a contract review
router.get('/:id/annotations', async (req, res, next) => {
  try {
    const annotations = await ContractAnnotation.findByContractReview(req.params.id);
    res.json(annotations);
  } catch (error) {
    next(error);
  }
});

// Create new annotation
router.post('/:id/annotations', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    const annotation = await ContractAnnotation.create({
      contract_review_id: req.params.id,
      created_by: req.user.id,
      ...req.body,
    });

    res.status(201).json(annotation);
  } catch (error) {
    next(error);
  }
});

// Update annotation
router.put('/:id/annotations/:annotationId', async (req, res, next) => {
  try {
    const annotation = await ContractAnnotation.findById(req.params.annotationId);
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const updated = await ContractAnnotation.update(req.params.annotationId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete annotation
router.delete('/:id/annotations/:annotationId', async (req, res, next) => {
  try {
    const annotation = await ContractAnnotation.findById(req.params.annotationId);
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    await ContractAnnotation.delete(req.params.annotationId);
    res.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Serve contract file
router.get('/:id/file', authenticate, async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    if (!review.file_path) {
      return res.status(404).json({ error: 'Contract file not found' });
    }

    // If using R2, redirect to presigned URL
    if (isR2Enabled()) {
      const url = await getFileUrl(review.file_path);
      return res.redirect(url);
    }

    // For local storage, serve the file directly
    const filePath = path.resolve(review.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'Contract file not found on server' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${review.file_name}"`);

    // Stream the file
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
