const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const ProjectCostModel = require('../models/ProjectCostModel');
const Drawing = require('../models/Drawing');
const Project = require('../models/Project');
// Lazy-loaded in scan endpoint to avoid DOMMatrix error at startup
// const { extractPDFText } = require('../utils/pdfExtractor');
const { getFileStream } = require('../utils/fileStorage');
const { isR2Enabled } = require('../config/r2Client');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

// Verify project belongs to tenant
const verifyProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

// GET /api/projects/:projectId/cost-model
router.get('/:projectId/cost-model', verifyProject, async (req, res, next) => {
  try {
    const data = await ProjectCostModel.findByProject(req.params.projectId, req.tenantId);
    const standardTypes = ProjectCostModel.getStandardTypes();
    res.json({ data: { ...data, standardTypes } });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:projectId/cost-model — upsert metadata
router.put('/:projectId/cost-model', verifyProject, async (req, res, next) => {
  try {
    const { total_sqft, building_type, project_type, notes } = req.body;
    const meta = await ProjectCostModel.upsertMeta(req.params.projectId, req.tenantId, {
      total_sqft,
      building_type,
      project_type,
      notes,
    });
    res.json({ data: meta });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:projectId/cost-model/equipment — bulk upsert equipment counts
router.put('/:projectId/cost-model/equipment', verifyProject, async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }
    const results = await ProjectCostModel.bulkUpsertEquipment(
      req.params.projectId,
      req.tenantId,
      items
    );
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:projectId/cost-model/equipment/:id
router.delete('/:projectId/cost-model/equipment/:id', verifyProject, async (req, res, next) => {
  try {
    const deleted = await ProjectCostModel.deleteEquipment(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Equipment entry not found' });
    }
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/cost-model/scan-drawings — AI scan drawings for equipment
router.post('/:projectId/cost-model/scan-drawings', verifyProject, async (req, res, next) => {
  try {
    const { drawing_ids } = req.body;
    if (!Array.isArray(drawing_ids) || drawing_ids.length === 0) {
      return res.status(400).json({ error: 'drawing_ids must be a non-empty array' });
    }

    if (drawing_ids.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 drawings per scan' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'AI scanning is not configured (missing API key)' });
    }

    // Fetch drawings and verify they belong to this project
    const drawings = [];
    for (const drawingId of drawing_ids) {
      const drawing = await Drawing.findById(drawingId);
      if (!drawing) {
        return res.status(404).json({ error: `Drawing ${drawingId} not found` });
      }
      if (String(drawing.project_id) !== String(req.params.projectId)) {
        return res.status(403).json({ error: `Drawing ${drawingId} does not belong to this project` });
      }
      drawings.push(drawing);
    }

    // Lazy-load pdf extractor to avoid DOMMatrix error at startup
    const { extractPDFText } = require('../utils/pdfExtractor');

    // Extract text from each drawing PDF
    const extractedTexts = [];
    for (const drawing of drawings) {
      try {
        let pdfText;

        if (drawing.file_type === 'application/pdf' && drawing.file_path) {
          if (isR2Enabled()) {
            // Download from R2 to temp file, then extract
            const { stream } = await getFileStream(drawing.file_path);
            const tmpFile = path.join(os.tmpdir(), `scan_${drawing.id}_${Date.now()}.pdf`);
            const chunks = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            await fs.writeFile(tmpFile, Buffer.concat(chunks));
            try {
              pdfText = await extractPDFText(tmpFile);
            } finally {
              await fs.unlink(tmpFile).catch(() => {});
            }
          } else {
            // Local file
            const localPath = path.isAbsolute(drawing.file_path)
              ? drawing.file_path
              : path.join(__dirname, '../../', drawing.file_path);
            pdfText = await extractPDFText(localPath);
          }

          extractedTexts.push({
            drawingId: drawing.id,
            drawingNumber: drawing.drawing_number,
            title: drawing.title,
            discipline: drawing.discipline,
            text: pdfText.fullText,
            numPages: pdfText.numPages,
          });
        }
      } catch (extractError) {
        console.error(`Failed to extract text from drawing ${drawing.id}:`, extractError.message);
        extractedTexts.push({
          drawingId: drawing.id,
          drawingNumber: drawing.drawing_number,
          title: drawing.title,
          discipline: drawing.discipline,
          text: '',
          error: extractError.message,
        });
      }
    }

    // Filter out drawings with no extracted text
    const validTexts = extractedTexts.filter(t => t.text && t.text.trim().length > 0);
    if (validTexts.length === 0) {
      return res.json({
        data: {
          equipment: [],
          notes: 'No text could be extracted from the selected drawings. The drawings may be image-based PDFs that require OCR.',
          scannedDrawings: extractedTexts.map(t => ({
            drawingId: t.drawingId,
            drawingNumber: t.drawingNumber,
            success: false,
            error: t.error || 'No extractable text',
          })),
        },
      });
    }

    // Build combined text for AI analysis
    const combinedText = validTexts
      .map(t => `=== Drawing: ${t.drawingNumber} - ${t.title} (${t.discipline || 'Unknown'}) ===\n${t.text}`)
      .join('\n\n');

    // Truncate if extremely long (Claude can handle ~100k tokens but let's be reasonable)
    const maxChars = 200000;
    const truncatedText = combinedText.length > maxChars
      ? combinedText.substring(0, maxChars) + '\n\n[Text truncated due to length]'
      : combinedText;

    const standardTypes = ProjectCostModel.getStandardTypes();
    const allTypes = [...standardTypes.hvac, ...standardTypes.plumbing];
    const typeList = allTypes.map(t => `${t.type}: ${t.label}`).join('\n');

    const systemPrompt = `You are an expert HVAC and mechanical construction estimator analyzing construction drawing text for equipment schedules.

Your task is to identify and count mechanical equipment from the extracted text of construction drawings. Equipment is typically found in:
- Equipment schedules (tables listing equipment tags, types, capacities)
- Mechanical schedules
- Equipment lists and legends
- Drawing notes referencing specific equipment

STANDARD EQUIPMENT TYPES (use these keys when possible):
${typeList}

COUNTING RULES:
- Count distinct equipment units by their tags (e.g., AHU-1, AHU-2, AHU-3 = 3 AHUs)
- If a schedule lists equipment with quantities, use those quantities
- Do NOT count the same equipment twice across different drawings
- If uncertain about a count, provide your best estimate and lower the confidence

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "equipment": [
    {
      "type": "ahu",
      "label": "Air Handling Units",
      "count": 3,
      "confidence": 0.95,
      "evidence": "AHU-1, AHU-2, AHU-3 listed in mechanical schedule"
    }
  ],
  "custom_equipment": [
    {
      "type": "custom_name_here",
      "label": "Display Name",
      "count": 2,
      "confidence": 0.8,
      "evidence": "Found in equipment schedule but not a standard type"
    }
  ],
  "notes": "Brief summary of what was found and any limitations"
}

Only include equipment types where you found actual evidence. Do not guess or include types with 0 count.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze the following construction drawing text and identify all mechanical equipment with counts:\n\n${truncatedText}`,
        },
      ],
    });

    let responseText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }

    // Parse AI response
    let aiResult;
    try {
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : responseText;
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError.message);
      return res.json({
        data: {
          equipment: [],
          notes: 'AI returned an unparseable response. Please try again.',
          rawResponse: responseText.substring(0, 500),
          scannedDrawings: validTexts.map(t => ({
            drawingId: t.drawingId,
            drawingNumber: t.drawingNumber,
            success: true,
          })),
        },
      });
    }

    // Normalize the result
    const equipment = [
      ...(aiResult.equipment || []).map(e => ({
        ...e,
        is_custom: false,
      })),
      ...(aiResult.custom_equipment || []).map(e => ({
        ...e,
        is_custom: true,
      })),
    ];

    res.json({
      data: {
        equipment,
        notes: aiResult.notes || '',
        scannedDrawings: extractedTexts.map(t => ({
          drawingId: t.drawingId,
          drawingNumber: t.drawingNumber,
          success: !t.error,
          error: t.error || null,
        })),
      },
    });
  } catch (error) {
    console.error('AI scan error:', error);
    next(error);
  }
});

module.exports = router;
