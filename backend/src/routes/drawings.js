const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const Drawing = require('../models/Drawing');
const DrawingPage = require('../models/DrawingPage');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile, getFileUrl, getFileInfo, getFileStream } = require('../utils/fileStorage');
const { isR2Enabled } = require('../config/r2Client');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Configure upload middleware with R2 or local storage
const upload = createUploadMiddleware({
  destination: 'uploads/drawings',
  allowedTypes: [
    'application/pdf',
    'application/octet-stream', // DWG, DXF, RVT files
    'image/png',
    'image/jpeg',
    'image/tiff',
  ],
  maxSize: 250 * 1024 * 1024, // 250MB limit for drawing sets
});

// Middleware to verify project belongs to tenant
const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.project_id;
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

// Middleware to verify drawing exists and belongs to tenant
const verifyDrawing = async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    const project = await Project.findByIdAndTenant(drawing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    req.drawing = drawing;
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

// Get all drawings for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const drawings = await Drawing.findByProject(
      req.params.projectId,
      {
        discipline: req.query.discipline,
        is_latest: req.query.is_latest === 'true' ? true : req.query.is_latest === 'false' ? false : undefined,
        drawing_number: req.query.drawing_number
      }
    );
    res.json({ data: drawings });
  } catch (error) {
    next(error);
  }
});

// Get single drawing
router.get('/:id', verifyDrawing, async (req, res, next) => {
  try {
    res.json({ data: req.drawing });
  } catch (error) {
    next(error);
  }
});

// Get version history for a drawing
router.get('/:id/versions', verifyDrawing, async (req, res, next) => {
  try {
    const versions = await Drawing.getVersionHistory(req.params.id);
    res.json({ data: versions });
  } catch (error) {
    next(error);
  }
});

// Get pages for a drawing set
router.get('/:id/pages', verifyDrawing, async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.discipline) filters.discipline = req.query.discipline;
    const pages = await DrawingPage.findByDrawing(req.params.id, filters);
    const summary = await DrawingPage.getDisciplineSummary(req.params.id);
    res.json({ data: { pages, summary } });
  } catch (error) {
    next(error);
  }
});

// Create drawing with file upload
router.post('/', upload.single('file'), verifyProjectOwnership, async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      uploaded_by: req.user.id
    };

    // Add file information if file was uploaded
    if (req.file) {
      const fileInfo = getFileInfo(req.file);
      data.file_name = fileInfo.fileName;
      data.file_path = fileInfo.filePath;
      data.file_size = fileInfo.fileSize;
      data.file_type = fileInfo.fileType;
    }

    // If this is a new version, mark the parent as not latest
    if (data.parent_drawing_id) {
      await Drawing.markAsNotLatest(data.parent_drawing_id);
    }

    const drawing = await Drawing.create(data);

    // For PDF uploads, extract text, get page count, and auto-classify by drawing number prefix
    if (req.file && data.file_type === 'application/pdf') {
      try {
        const { extractPDFText } = require('../utils/pdfExtractor');
        const { classifyAllPages } = require('../utils/drawingClassifier');
        let pdfData;

        if (isR2Enabled()) {
          const { stream } = await getFileStream(data.file_path);
          const tmpFile = path.join(os.tmpdir(), `pages_${drawing.id}_${Date.now()}.pdf`);
          const chunks = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          await fs.promises.writeFile(tmpFile, Buffer.concat(chunks));
          try {
            pdfData = await extractPDFText(tmpFile);
          } finally {
            await fs.promises.unlink(tmpFile).catch(() => {});
          }
        } else {
          const localPath = path.isAbsolute(data.file_path)
            ? data.file_path
            : path.join(__dirname, '../../', data.file_path);
          pdfData = await extractPDFText(localPath);
        }

        const numPages = pdfData?.numPages || 0;
        if (numPages > 0) {
          await Drawing.updatePageCount(drawing.id, numPages);
          drawing.page_count = numPages;
          drawing.is_drawing_set = numPages > 1;

          // Auto-classify pages by drawing number prefix (instant, no AI)
          if (pdfData.pageTexts && pdfData.pageTexts.length > 0) {
            const classified = classifyAllPages(pdfData.pageTexts);
            await DrawingPage.bulkUpsert(drawing.id, classified);
          } else {
            // No text — create empty page records
            const emptyPages = [];
            for (let i = 1; i <= numPages; i++) {
              emptyPages.push({ page_number: i, ai_classified: false });
            }
            await DrawingPage.bulkUpsert(drawing.id, emptyPages);
          }
        }
      } catch (extractError) {
        console.error('Failed to extract/classify pages:', extractError.message);
        // Non-fatal — drawing was still created successfully
      }
    }

    res.status(201).json({ data: drawing });
  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file) {
      const fileInfo = getFileInfo(req.file);
      await deleteFile(fileInfo.filePath).catch(console.error);
    }
    next(error);
  }
});

// Pattern-based classify (instant, no AI) — re-runs drawing number prefix matching
router.post('/:id/classify-pages-quick', verifyDrawing, async (req, res, next) => {
  try {
    const drawing = req.drawing;

    if (drawing.file_type !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF drawings can be classified' });
    }

    const { extractPDFText } = require('../utils/pdfExtractor');
    const { classifyAllPages } = require('../utils/drawingClassifier');
    let pdfData;

    if (isR2Enabled()) {
      const { stream } = await getFileStream(drawing.file_path);
      const tmpFile = path.join(os.tmpdir(), `quick_${drawing.id}_${Date.now()}.pdf`);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      await fs.promises.writeFile(tmpFile, Buffer.concat(chunks));
      try {
        pdfData = await extractPDFText(tmpFile);
      } finally {
        await fs.promises.unlink(tmpFile).catch(() => {});
      }
    } else {
      const localPath = path.isAbsolute(drawing.file_path)
        ? drawing.file_path
        : path.join(__dirname, '../../', drawing.file_path);
      pdfData = await extractPDFText(localPath);
    }

    if (!pdfData?.pageTexts?.length) {
      return res.json({
        data: { pages: [], summary: {}, notes: 'No text could be extracted from the PDF.' },
      });
    }

    const classified = classifyAllPages(pdfData.pageTexts);
    const savedPages = await DrawingPage.bulkUpsert(drawing.id, classified);
    const summary = await DrawingPage.getDisciplineSummary(drawing.id);

    if (!drawing.page_count || drawing.page_count === 0) {
      await Drawing.updatePageCount(drawing.id, pdfData.numPages);
    }

    res.json({
      data: {
        pages: savedPages,
        summary,
        notes: `Classified ${savedPages.length} pages by drawing number prefix.`,
      },
    });
  } catch (error) {
    console.error('Quick classification error:', error);
    next(error);
  }
});

// AI classify pages by discipline (slower, uses Claude API for ambiguous pages)
router.post('/:id/classify-pages', verifyDrawing, async (req, res, next) => {
  try {
    const drawing = req.drawing;

    if (drawing.file_type !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF drawings can be classified' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'AI classification is not configured (missing API key)' });
    }

    // Extract text from each page
    const { extractPDFText } = require('../utils/pdfExtractor');
    let pageTexts = [];
    let numPages = 0;

    if (isR2Enabled()) {
      const { stream } = await getFileStream(drawing.file_path);
      const tmpFile = path.join(os.tmpdir(), `classify_${drawing.id}_${Date.now()}.pdf`);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      await fs.promises.writeFile(tmpFile, Buffer.concat(chunks));
      try {
        const pdfData = await extractPDFText(tmpFile);
        pageTexts = pdfData.pageTexts || [];
        numPages = pdfData.numPages || 0;
      } finally {
        await fs.promises.unlink(tmpFile).catch(() => {});
      }
    } else {
      const localPath = path.isAbsolute(drawing.file_path)
        ? drawing.file_path
        : path.join(__dirname, '../../', drawing.file_path);
      const pdfData = await extractPDFText(localPath);
      pageTexts = pdfData.pageTexts || [];
      numPages = pdfData.numPages || 0;
    }

    if (pageTexts.length === 0) {
      return res.json({
        data: {
          pages: [],
          summary: {},
          notes: 'No text could be extracted from the PDF. The drawing may be image-based and require OCR.',
        },
      });
    }

    // Batch pages for AI classification
    // Keep batches small to stay within API rate limits (~30k input tokens/min)
    // 800 chars/page × 15 pages ≈ 12k chars ≈ 4k tokens per batch
    const BATCH_SIZE = 15;
    const MAX_CHARS_PER_PAGE = 800;
    const BATCH_DELAY_MS = 2000; // delay between batches to respect rate limits
    const allResults = [];

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are an expert construction document analyst. Classify each page of a multi-page construction drawing set by discipline.

DISCIPLINE CATEGORIES (use exactly these values):
- Mechanical (HVAC ductwork, mechanical piping, equipment schedules, M-series sheets)
- Plumbing (plumbing fixtures, drainage, water supply, P-series sheets)
- Sheet Metal (sheet metal ductwork, SM-series sheets)
- Electrical (power distribution, lighting, E-series sheets)
- Architectural (floor plans, elevations, sections, details, A-series sheets)
- Structural (foundations, framing, steel, S-series sheets)
- Civil (site plans, grading, utilities, C-series sheets)
- Fire Protection (sprinkler systems, FP-series sheets)
- General (cover sheets, legends, abbreviations, G-series sheets, table of contents)
- Specifications (spec pages, written schedules without clear discipline)
- Unknown (pages with no extractable text or unclear content)

CLASSIFICATION RULES:
- Drawing number prefix is the PRIMARY signal: M=Mechanical, P=Plumbing, E=Electrical, A=Architectural, S=Structural, C=Civil, FP=Fire Protection, G=General, SM=Sheet Metal
- Title block text is the SECONDARY signal (look for discipline keywords)
- Page content is the TERTIARY signal
- If a page has very little or no text, classify as "Unknown" with low confidence
- Extract the drawing number (e.g., M-101, P-201) and sheet title when visible

RESPONSE FORMAT - Return ONLY a valid JSON array:
[
  {"page": 1, "discipline": "General", "confidence": 0.95, "drawing_number": "G-001", "title": "Cover Sheet"},
  {"page": 2, "discipline": "Mechanical", "confidence": 0.90, "drawing_number": "M-101", "title": "First Floor HVAC Plan"}
]`;

    for (let batchStart = 0; batchStart < pageTexts.length; batchStart += BATCH_SIZE) {
      // Rate limit delay between batches (skip first batch)
      if (batchStart > 0) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }

      const batch = pageTexts.slice(batchStart, batchStart + BATCH_SIZE);
      console.log(`Classifying pages ${batchStart + 1}-${batchStart + batch.length} of ${pageTexts.length}...`);

      const batchText = batch
        .map(p => {
          const truncatedText = p.text.length > MAX_CHARS_PER_PAGE
            ? p.text.substring(0, MAX_CHARS_PER_PAGE) + '...[truncated]'
            : p.text;
          return `=== Page ${p.page} ===\n${truncatedText || '[No text content]'}`;
        })
        .join('\n\n');

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Classify each of the following ${batch.length} drawing pages by discipline:\n\n${batchText}`,
          },
        ],
      });

      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      try {
        const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : responseText;
        const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
        const batchResults = JSON.parse(jsonMatch ? jsonMatch[0] : jsonText);
        allResults.push(...batchResults);
      } catch (parseError) {
        console.error('Failed to parse AI batch response:', parseError.message);
        // Add Unknown entries for this batch
        for (const p of batch) {
          allResults.push({
            page: p.page,
            discipline: 'Unknown',
            confidence: 0,
            drawing_number: null,
            title: null,
          });
        }
      }
    }

    // Save classifications to database
    const pagesToSave = allResults.map(r => ({
      page_number: r.page,
      discipline: r.discipline,
      confidence: r.confidence,
      drawing_number: r.drawing_number || null,
      title: r.title || null,
      ai_classified: true,
    }));

    const savedPages = await DrawingPage.bulkUpsert(drawing.id, pagesToSave);
    const summary = await DrawingPage.getDisciplineSummary(drawing.id);

    // Update page count if not already set
    if (!drawing.page_count || drawing.page_count === 0) {
      await Drawing.updatePageCount(drawing.id, numPages);
    }

    res.json({
      data: {
        pages: savedPages,
        summary,
        notes: `Classified ${savedPages.length} pages across ${Object.keys(summary).length} disciplines.`,
      },
    });
  } catch (error) {
    console.error('AI classification error:', error);
    next(error);
  }
});

// Update single page discipline
router.put('/:id/pages/:pageNumber', verifyDrawing, async (req, res, next) => {
  try {
    const { discipline } = req.body;
    if (!discipline) {
      return res.status(400).json({ error: 'discipline is required' });
    }
    const page = await DrawingPage.updateDiscipline(
      req.params.id,
      parseInt(req.params.pageNumber),
      discipline
    );
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }
    res.json({ data: page });
  } catch (error) {
    next(error);
  }
});

// Bulk update page classifications
router.put('/:id/pages/bulk', verifyDrawing, async (req, res, next) => {
  try {
    const { pages } = req.body;
    if (!Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'pages must be a non-empty array' });
    }
    const saved = await DrawingPage.bulkUpsert(req.params.id, pages.map(p => ({
      ...p,
      ai_classified: false,
    })));
    const summary = await DrawingPage.getDisciplineSummary(req.params.id);
    res.json({ data: { pages: saved, summary } });
  } catch (error) {
    next(error);
  }
});

// Update drawing
router.put('/:id', verifyDrawing, async (req, res, next) => {
  try {
    const drawing = await Drawing.update(req.params.id, req.body);
    res.json({ data: drawing });
  } catch (error) {
    next(error);
  }
});

// Delete drawing
router.delete('/:id', verifyDrawing, async (req, res, next) => {
  try {
    // Delete the file from R2 or local storage
    if (req.drawing.file_path) {
      await deleteFile(req.drawing.file_path).catch(console.error);
    }

    await Drawing.delete(req.params.id);
    res.json({ message: 'Drawing deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Download drawing file
router.get('/:id/download', verifyDrawing, async (req, res, next) => {
  try {
    const drawing = req.drawing;

    if (!drawing.file_path) {
      return res.status(404).json({ error: 'File not found' });
    }

    // If using R2, redirect to presigned URL
    if (isR2Enabled()) {
      const url = await getFileUrl(drawing.file_path);
      return res.redirect(url);
    }

    // For local storage, serve the file directly
    if (!fs.existsSync(drawing.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(drawing.file_path, drawing.file_name);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
