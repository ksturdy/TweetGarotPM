const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const { parseNarrative } = require('../utils/narrativeParser');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const config = require('../config');
const HistoricalProject = require('../models/HistoricalProject');

const router = express.Router();

// Multer middleware for optional narrative file upload (memory storage, no temp file written)
// Extension-first check because browsers may send application/octet-stream for DOCX
const NARRATIVE_ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const narrativeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (NARRATIVE_ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${NARRATIVE_ALLOWED_EXTENSIONS.join(', ')}`));
    }
  }
});

// Apply middleware
router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// Annual construction inflation rate (4% is typical, adjust as needed)
const ANNUAL_INFLATION_RATE = 0.04;

/**
 * Calculate inflation-adjusted cost from a historical date to today
 * @param {number} originalCost - The original cost value
 * @param {Date|string} bidDate - The date of the original bid/project
 * @returns {number} - The inflation-adjusted cost in today's dollars
 */
function adjustForInflation(originalCost, bidDate) {
  if (!originalCost || !bidDate) return originalCost || 0;

  const bidDateObj = new Date(bidDate);
  const today = new Date();

  // Calculate years between bid date and today
  const yearsDiff = (today - bidDateObj) / (1000 * 60 * 60 * 24 * 365.25);

  if (yearsDiff <= 0) return originalCost; // Future or current date

  // Apply compound inflation: adjustedCost = originalCost * (1 + rate)^years
  const inflationMultiplier = Math.pow(1 + ANNUAL_INFLATION_RATE, yearsDiff);

  return originalCost * inflationMultiplier;
}

/**
 * Apply inflation adjustment to all cost fields of a project
 * @param {Object} project - The historical project object
 * @returns {Object} - Project with all costs adjusted for inflation
 */
function adjustProjectCostsForInflation(project) {
  if (!project || !project.bid_date) return project;

  const bidDate = project.bid_date;

  // List of cost fields to adjust
  const costFields = [
    'total_cost', 'pm_cost', 'sm_equip_cost', 'pf_equip_cost',
    'controls', 'insulation', 'balancing', 'electrical', 'general', 'allowance',
    's_field_cost', 's_shop_cost', 's_material_cost', 's_materials_with_escalation',
    'r_field_cost', 'r_shop_cost', 'r_material_cost', 'r_materials_with_escalation',
    'e_field_cost', 'e_shop_cost', 'e_material_cost', 'e_material_with_escalation',
    'o_field_cost', 'o_shop_cost', 'o_material_cost', 'o_materials_with_escalation',
    'w_field_cost', 'w_shop_cost', 'w_material_cost', 'w_materials_with_escalation',
    'hw_field_cost', 'hw_material_cost', 'hw_material_with_esc',
    'chw_field_cost', 'chw_material_cost', 'chw_material_with_esc',
    'd_field_cost', 'd_material_cost', 'd_material_with_esc',
    'g_field_cost', 'g_material_cost', 'g_material_with_esc',
    'gs_field_cost', 'gs_material_cost', 'gs_material_with_esc',
    'cw_field_cost', 'cw_material_cost', 'cw_material_with_esc',
    'rad_field_cost', 'rad_material_cost', 'rad_material_with_esc',
    'ref_field_cost', 'ref_material_cost', 'ref_material_with_esc',
    'stmcond_field_cost', 'stmcond_material_cost', 'stmcond_material_with_esc',
    'truck_rental', 'temp_heat', 'geo_thermal'
  ];

  const adjusted = { ...project };

  for (const field of costFields) {
    if (adjusted[field]) {
      adjusted[field] = adjustForInflation(parseFloat(adjusted[field]), bidDate);
    }
  }

  // Recalculate cost per sqft based on adjusted total cost
  if (adjusted.total_cost && adjusted.total_sqft) {
    adjusted.total_cost_per_sqft = adjusted.total_cost / parseFloat(adjusted.total_sqft);
  }

  // Store original values for reference
  adjusted.original_total_cost = project.total_cost;
  adjusted.inflation_adjusted = true;

  return adjusted;
}

/**
 * Adjust category averages for inflation based on average project age
 * @param {Object} averages - The category averages object
 * @param {Array} projects - Array of projects to calculate average age
 * @returns {Object} - Averages adjusted for inflation
 */
function adjustAveragesForInflation(averages, projects) {
  if (!averages || !projects || projects.length === 0) return averages;

  // Calculate weighted average age of projects
  const today = new Date();
  let totalYears = 0;
  let validCount = 0;

  for (const project of projects) {
    if (project.bid_date) {
      const bidDate = new Date(project.bid_date);
      const years = (today - bidDate) / (1000 * 60 * 60 * 24 * 365.25);
      if (years > 0) {
        totalYears += years;
        validCount++;
      }
    }
  }

  const avgYears = validCount > 0 ? totalYears / validCount : 0;
  const inflationMultiplier = Math.pow(1 + ANNUAL_INFLATION_RATE, avgYears);

  // Cost fields in averages to adjust
  const avgCostFields = [
    'avg_total_cost', 'avg_pm_cost', 'avg_sm_equip_cost', 'avg_pf_equip_cost',
    'avg_controls', 'avg_insulation', 'avg_balancing', 'avg_electrical',
    'avg_general', 'avg_allowance',
    'avg_supply_labor', 'avg_supply_material',
    'avg_return_labor', 'avg_return_material',
    'avg_exhaust_labor', 'avg_exhaust_material',
    'avg_outside_air_labor', 'avg_outside_air_material',
    'avg_hw_labor', 'avg_hw_material',
    'avg_chw_labor', 'avg_chw_material'
  ];

  const adjusted = { ...averages };

  for (const field of avgCostFields) {
    if (adjusted[field]) {
      adjusted[field] = parseFloat(adjusted[field]) * inflationMultiplier;
    }
  }

  // Adjust cost per sqft
  if (adjusted.avg_cost_per_sqft) {
    adjusted.avg_cost_per_sqft = parseFloat(adjusted.avg_cost_per_sqft) * inflationMultiplier;
  }

  // Store inflation info
  adjusted.inflation_rate = ANNUAL_INFLATION_RATE;
  adjusted.avg_project_age_years = avgYears.toFixed(1);
  adjusted.inflation_multiplier = inflationMultiplier.toFixed(3);

  return adjusted;
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Get full detail for a single project card (historical or live)
router.get('/project-detail/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { source } = req.query;

    let project;
    if (source === 'project') {
      const result = await pool.query(
        `SELECT
          p.id, p.name, p.status, p.market, p.description,
          p.contract_value, p.square_footage,
          p.start_date, p.end_date,
          pcm.project_type, pcm.bid_type, pcm.total_sqft,
          pcm.notes, pcm.scopes, pcm.owner, pcm.architect, pcm.general_contractor,
          CASE WHEN COALESCE(pcm.total_sqft, p.square_footage::DECIMAL) > 0
            THEN p.contract_value / COALESCE(pcm.total_sqft, p.square_footage::DECIMAL)
            ELSE NULL END AS cost_per_sqft
        FROM projects p
        LEFT JOIN project_cost_models pcm ON pcm.project_id = p.id
        WHERE p.id = $1 AND p.tenant_id = $2`,
        [id, req.tenantId]
      );
      project = result.rows[0];
    } else {
      project = await HistoricalProject.findById(id);
    }

    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Get dropdown options (building types, project types, bid types)
router.get('/options', async (req, res, next) => {
  try {
    const [markets, buildingTypes, projectTypes, bidTypes, projectTypesByMarket] = await Promise.all([
      HistoricalProject.getDistinctValues('market'),
      HistoricalProject.getDistinctValues('building_type'),
      HistoricalProject.getDistinctValues('project_type'),
      HistoricalProject.getDistinctValues('bid_type'),
      HistoricalProject.getProjectTypesByMarket()
    ]);

    res.json({
      markets,
      buildingTypes,
      projectTypes,
      bidTypes,
      projectTypesByMarket
    });
  } catch (error) {
    console.error('Error getting budget options:', error);
    next(error);
  }
});

// Get statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await HistoricalProject.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    next(error);
  }
});

// Find similar projects (preview before generating)
router.post('/similar', async (req, res, next) => {
  try {
    const { market, bidType, sqft, sqftMin, sqftMax, yearFrom, yearTo } = req.body;
    const buildingTypes = req.body.buildingType
      ? String(req.body.buildingType).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const buildingType = buildingTypes.length > 0 ? buildingTypes[0] : null; // keep compat
    const projectTypes = Array.isArray(req.body.projectType)
      ? req.body.projectType.filter(Boolean)
      : (req.body.projectType ? [req.body.projectType] : []);
    const projectStatuses = Array.isArray(req.body.projectStatuses)
      ? req.body.projectStatuses.filter(Boolean)
      : (req.body.projectStatuses ? [req.body.projectStatuses] : []);

    if (!market && projectTypes.length === 0) {
      return res.status(400).json({
        error: 'At least a market or project type is required'
      });
    }

    const projectTypeParam = projectTypes.length > 0 ? projectTypes : null;
    const projectStatusParam = projectStatuses.length > 0 ? projectStatuses : null;

    const [similarProjects, averages] = await Promise.all([
      HistoricalProject.findSimilar({
        market: market || null,
        buildingType: buildingType || null,
        projectType: projectTypeParam,
        bidType: bidType || null,
        sqft: sqft || null,
        tenantId: req.tenantId,
        projectStatuses: projectStatusParam,
        sqftMin: sqftMin ? parseFloat(sqftMin) : null,
        sqftMax: sqftMax ? parseFloat(sqftMax) : null,
        yearFrom: yearFrom ? parseInt(yearFrom) : null,
        yearTo: yearTo ? parseInt(yearTo) : null,
      }),
      HistoricalProject.getCategoryAverages(market || null, projectTypeParam, req.tenantId)
    ]);

    // Add match criteria details and inflation adjustment to each project
    const projectsWithMatchDetails = similarProjects.map(p => {
      const sqftDiff = sqft && p.total_sqft
        ? Math.abs(parseFloat(p.total_sqft) - sqft) / sqft
        : null;

      // Calculate inflation-adjusted costs
      const originalCost = parseFloat(p.total_cost) || 0;
      const adjustedCost = adjustForInflation(originalCost, p.bid_date);
      const originalCostPerSqft = parseFloat(p.total_cost_per_sqft) || (originalCost / parseFloat(p.total_sqft)) || 0;
      const adjustedCostPerSqft = adjustForInflation(originalCostPerSqft, p.bid_date);

      // Calculate years since bid
      const yearsSinceBid = p.bid_date
        ? ((new Date() - new Date(p.bid_date)) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)
        : null;

      return {
        ...p,
        // Original values
        original_total_cost: originalCost,
        original_cost_per_sqft: originalCostPerSqft,
        // Inflation-adjusted values
        total_cost: adjustedCost,
        total_cost_per_sqft: adjustedCostPerSqft,
        // Metadata
        years_since_bid: yearsSinceBid,
        inflation_adjusted: true,
        match_details: {
          market: !market ? null : (p.market === market),
          building_type: buildingTypes.length === 0 ? null : buildingTypes.includes(p.building_type),
          project_type: projectTypes.length === 0 ? null : projectTypes.includes(p.project_type),
          bid_type: !bidType ? null : (p.bid_type === bidType),
          sqft_within_25: sqftDiff !== null && sqftDiff <= 0.25,
          sqft_within_50: sqftDiff !== null && sqftDiff <= 0.5,
          sqft_diff_percent: sqftDiff !== null ? Math.round(sqftDiff * 100) : null
        }
      };
    });

    // Also include avg_sqft in averages
    const avgSqft = similarProjects.length > 0
      ? similarProjects.reduce((sum, p) => sum + (parseFloat(p.total_sqft) || 0), 0) / similarProjects.length
      : 0;

    res.json({
      similarProjects: projectsWithMatchDetails,
      averages: {
        ...averages,
        avg_sqft: avgSqft
      }
    });
  } catch (error) {
    console.error('Error finding similar projects:', error);
    next(error);
  }
});

// Generate AI budget
router.post('/generate', (req, res, next) => {
  // Apply multer as a sub-middleware so we can handle its errors gracefully
  narrativeUpload.single('narrative')(req, res, (multerErr) => {
    if (multerErr) {
      const status = multerErr.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        error: multerErr.code === 'LIMIT_FILE_SIZE'
          ? 'Design narrative file is too large. Maximum size is 20MB.'
          : `Invalid file: ${multerErr.message}`
      });
    }
    generateHandler(req, res, next);
  });
});

async function generateHandler(req, res, next) {
  try {
    const {
      projectName,
      market,
      bidType,
      sqft,
      scope,
      location,
      selectedProjectIds
    } = req.body;
    const scopesOfWork = Array.isArray(req.body.scopesOfWork)
      ? req.body.scopesOfWork.filter(Boolean)
      : (req.body.scopesOfWork ? String(req.body.scopesOfWork).split(',').map(s => s.trim()).filter(Boolean) : []);
    const buildingTypeArr = req.body.buildingType
      ? String(req.body.buildingType).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const buildingType = buildingTypeArr.length > 0 ? buildingTypeArr.join(', ') : null;
    const projectTypes = Array.isArray(req.body.projectType)
      ? req.body.projectType.filter(Boolean)
      : (req.body.projectType ? [req.body.projectType] : []);
    const projectType = projectTypes.length > 0 ? projectTypes.join(', ') : null;
    const projectTypeParam = projectTypes.length > 0 ? projectTypes : null;
    const projectStatuses = Array.isArray(req.body.projectStatuses)
      ? req.body.projectStatuses.filter(Boolean)
      : (req.body.projectStatuses ? [req.body.projectStatuses] : []);
    const projectStatusParam = projectStatuses.length > 0 ? projectStatuses : null;

    // Validation
    if (!projectName || !sqft || (!market && projectTypes.length === 0)) {
      return res.status(400).json({
        error: 'Project name, square footage, and at least a market or project type are required'
      });
    }

    // Parse design narrative if uploaded
    let narrativeText = null;
    let narrativeWarning = null;
    if (req.file) {
      try {
        narrativeText = await parseNarrative(req.file.buffer, req.file.mimetype, req.file.originalname);
        console.log(`[BudgetGenerator] Narrative parsed: ${narrativeText.length} chars from ${req.file.originalname}`);
      } catch (parseErr) {
        console.error('[BudgetGenerator] Narrative parse failed:', parseErr.message);
        narrativeWarning = `Design narrative could not be read and was excluded from the estimate: ${parseErr.message}`;
      }
    }

    // Find similar projects for scoring (unified historical + live projects)
    const similarProjects = await HistoricalProject.findSimilar({
      market: market || null,
      buildingType: buildingType || null,
      projectType: projectTypeParam,
      bidType: bidType || null,
      sqft,
      limit: 20,
      tenantId: req.tenantId,
      projectStatuses: projectStatusParam
    });

    let topProjects, projectDetailsRaw;

    const fetchDetail = (p) => p.source === 'project'
      ? HistoricalProject.findProjectById(p.id, req.tenantId)
      : HistoricalProject.findById(p.id);

    if (selectedProjectIds && selectedProjectIds.length > 0) {
      // User selected specific projects — use those
      const ids = selectedProjectIds.map(id => parseInt(id, 10));
      topProjects = ids.map(id => {
        const scored = similarProjects.find(s => parseInt(s.id) === id);
        return scored || { id, similarity_score: 0, source: 'historical' };
      });
      projectDetailsRaw = (await Promise.all(topProjects.map(fetchDetail))).filter(p => p != null);
    } else {
      // Default: auto-select top 3
      topProjects = similarProjects.slice(0, 3);
      projectDetailsRaw = await Promise.all(topProjects.map(fetchDetail));
    }

    // Apply inflation adjustment to project costs
    const projectDetails = projectDetailsRaw.map(p => adjustProjectCostsForInflation(p));

    // Get category averages across both historical and live projects
    const averagesRaw = await HistoricalProject.getCategoryAverages(
      market || null,
      projectTypeParam,
      req.tenantId
    );

    // Adjust averages for inflation based on average project age
    const averages = adjustAveragesForInflation(averagesRaw, projectDetailsRaw);

    // Build AI prompt
    const systemPrompt = buildBudgetSystemPrompt(
      projectName,
      market,
      buildingType,
      projectType,
      bidType,
      sqft,
      scope,
      projectDetails,
      averages,
      location,
      narrativeText,
      !!(selectedProjectIds && selectedProjectIds.length > 0),
      scopesOfWork
    );

    // Call Claude to generate budget
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Generate a detailed HVAC budget estimate for this ${sqft.toLocaleString()} square foot ${[market, projectType, buildingType].filter(Boolean).join(' / ')} project called "${projectName}". Return the budget in JSON format only, no additional text.`
      }]
    });

    // Parse the JSON response
    const responseText = response.content[0].text;
    const budgetJson = extractJsonFromResponse(responseText);

    if (!budgetJson) {
      return res.status(500).json({
        error: 'Failed to parse budget response',
        rawResponse: responseText
      });
    }

    // Persist narrative file to storage and record in attachments table
    let narrativeAttachmentId = null;
    if (req.file) {
      try {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storageKey = `uploads/budget-narratives/${uniqueSuffix}-${safeName}`;

        if (isR2Enabled()) {
          const r2 = getR2Client();
          await r2.send(new PutObjectCommand({
            Bucket: config.r2.bucketName,
            Key: storageKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          }));
        } else {
          const dir = path.join(__dirname, '../../uploads/budget-narratives');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${uniqueSuffix}-${safeName}`), req.file.buffer);
        }

        // Insert a provisional attachments row; entity_id gets updated when the budget is saved
        const attResult = await pool.query(
          `INSERT INTO attachments (entity_type, entity_id, filename, original_name, mime_type, size, uploaded_by)
           VALUES ('budget_narrative_pending', 0, $1, $2, $3, $4, $5) RETURNING id`,
          [storageKey, req.file.originalname, req.file.mimetype, req.file.size, req.user.id]
        );
        narrativeAttachmentId = attResult.rows[0].id;
      } catch (storageErr) {
        console.error('[BudgetGenerator] Failed to persist narrative file:', storageErr.message);
        // Non-fatal — generation result is still returned
      }
    }

    res.json({
      budget: budgetJson,
      narrativeAttachmentId,
      ...(narrativeWarning ? { narrativeWarning } : {}),
      similarProjects: projectDetails.map((p, i) => {
        const originalProject = topProjects[i];
        const bidYear = p.bid_date ? new Date(p.bid_date).getFullYear() : null;
        const yearsSinceBid = p.bid_date
          ? ((new Date() - new Date(p.bid_date)) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)
          : null;
        return {
          id: p.id,
          name: p.name,
          buildingType: p.building_type,
          projectType: p.project_type,
          sqft: parseFloat(p.total_sqft) || 0,
          totalCost: parseFloat(p.total_cost) || 0,
          costPerSqft: parseFloat(p.total_cost_per_sqft) || 0,
          originalTotalCost: parseFloat(p.original_total_cost) || 0,
          originalCostPerSqft: p.original_total_cost && p.total_sqft
            ? parseFloat(p.original_total_cost) / parseFloat(p.total_sqft)
            : 0,
          bidYear,
          yearsSinceBid: yearsSinceBid ? parseFloat(yearsSinceBid) : null,
          inflationAdjusted: true,
          similarityScore: originalProject?.similarity_score || 0,
          source: originalProject?.source || 'historical'
        };
      }),
      averages: {
        projectCount: averages.project_count,
        avgCost: parseFloat(averages.avg_total_cost) || 0,
        avgCostPerSqft: parseFloat(averages.avg_cost_per_sqft) || 0,
        inflationRate: ANNUAL_INFLATION_RATE,
        avgProjectAgeYears: averages.avg_project_age_years ? parseFloat(averages.avg_project_age_years) : null
      },
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Budget generation error:', error);
    next(error);
  }
}

// Compute cost-type ratios and unit rates from comparable project detail
function calcCostTypeBreakdown(projectDetails) {
  const f = (v) => parseFloat(v) || 0;

  const rows = projectDetails.map(p => {
    const labor =
      f(p.pm_cost) + f(p.s_field_cost) + f(p.r_field_cost) + f(p.e_field_cost) +
      f(p.o_field_cost) + f(p.w_field_cost) + f(p.hw_field_cost) + f(p.chw_field_cost) +
      f(p.d_field_cost) + f(p.g_field_cost) + f(p.gs_field_cost) + f(p.cw_field_cost) +
      f(p.rad_field_cost) + f(p.ref_field_cost) + f(p.stm_cond_field_cost) + f(p.pf_misc_field_cost);

    const material =
      f(p.s_materials_with_escalation) + f(p.r_materials_with_escalation) +
      f(p.e_material_with_escalation) + f(p.o_materials_with_escalation) +
      f(p.w_materials_with_escalation) + f(p.hw_material_with_esc) + f(p.chw_material_with_esc) +
      f(p.d_material_with_esc) + f(p.g_material_with_esc) + f(p.gs_material_with_esc) +
      f(p.cw_material_with_esc) + f(p.rad_material_with_esc) + f(p.ref_material_with_esc) +
      f(p.stm_cond_material_with_esc);

    const equipment = f(p.sm_equip_cost) + f(p.pf_equip_cost);

    const other =
      f(p.controls) + f(p.insulation) + f(p.balancing) +
      f(p.electrical) + f(p.general) + f(p.allowance);

    const direct = labor + material + equipment + other;
    if (direct === 0) return null;

    // Unit rates for ductwork ($/lb) and piping ($/ft)
    const ductLbs = f(p.s_lbs) + f(p.r_lbs) + f(p.e_lbs) + f(p.o_lbs) + f(p.w_lbs);
    const ductLabor = f(p.s_field_cost) + f(p.r_field_cost) + f(p.e_field_cost) + f(p.o_field_cost) + f(p.w_field_cost);
    const ductMaterial = f(p.s_materials_with_escalation) + f(p.r_materials_with_escalation) +
      f(p.e_material_with_escalation) + f(p.o_materials_with_escalation) + f(p.w_materials_with_escalation);

    const pipingFt = f(p.hw_footage) + f(p.chw_footage) + f(p.d_footage) + f(p.g_footage) + f(p.cw_footage);
    const pipingLabor = f(p.hw_field_cost) + f(p.chw_field_cost) + f(p.d_field_cost) + f(p.g_field_cost) + f(p.cw_field_cost);
    const pipingMaterial = f(p.hw_material_with_esc) + f(p.chw_material_with_esc) + f(p.d_material_with_esc) + f(p.g_material_with_esc) + f(p.cw_material_with_esc);

    const equipUnits = f(p.ahu) + f(p.rtu) + f(p.mau) + f(p.eru) + f(p.chiller) + f(p.boilers);

    return {
      name: p.name,
      sqft: f(p.total_sqft),
      labor, material, equipment, other, direct,
      laborPct: labor / direct,
      materialPct: material / direct,
      equipmentPct: equipment / direct,
      otherPct: other / direct,
      ductLaborPerLb: ductLbs > 0 ? ductLabor / ductLbs : null,
      ductMaterialPerLb: ductLbs > 0 ? ductMaterial / ductLbs : null,
      ductLbsPerSqft: f(p.total_sqft) > 0 ? ductLbs / f(p.total_sqft) : null,
      pipingLaborPerFt: pipingFt > 0 ? pipingLabor / pipingFt : null,
      pipingMaterialPerFt: pipingFt > 0 ? pipingMaterial / pipingFt : null,
      pipingFtPerSqft: f(p.total_sqft) > 0 ? pipingFt / f(p.total_sqft) : null,
      equipCostPerUnit: equipUnits > 0 ? equipment / equipUnits : null,
      equipUnitsPerSqft: f(p.total_sqft) > 0 ? equipUnits / f(p.total_sqft) : null,
    };
  }).filter(Boolean);

  if (rows.length === 0) return null;

  const avg = (fn) => rows.reduce((s, r) => s + (fn(r) ?? 0), 0) / rows.length;
  const avgNonNull = (fn) => {
    const vals = rows.map(fn).filter(v => v != null);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  return {
    perProject: rows,
    avgLaborPct: avg(r => r.laborPct),
    avgMaterialPct: avg(r => r.materialPct),
    avgEquipmentPct: avg(r => r.equipmentPct),
    avgOtherPct: avg(r => r.otherPct),
    avgDuctLaborPerLb: avgNonNull(r => r.ductLaborPerLb),
    avgDuctMaterialPerLb: avgNonNull(r => r.ductMaterialPerLb),
    avgDuctLbsPerSqft: avgNonNull(r => r.ductLbsPerSqft),
    avgPipingLaborPerFt: avgNonNull(r => r.pipingLaborPerFt),
    avgPipingMaterialPerFt: avgNonNull(r => r.pipingMaterialPerFt),
    avgPipingFtPerSqft: avgNonNull(r => r.pipingFtPerSqft),
    avgEquipCostPerUnit: avgNonNull(r => r.equipCostPerUnit),
    avgEquipUnitsPerSqft: avgNonNull(r => r.equipUnitsPerSqft),
  };
}

// Helper function to build AI system prompt
function buildBudgetSystemPrompt(projectName, market, buildingType, projectType, bidType, sqft, scope, projectDetails, averages, location, narrativeText = null, userSelectedProjects = false, scopesOfWork = []) {
  const formatCurrency = (val) => val ? `$${Math.round(val).toLocaleString()}` : '$0';
  const formatNumber = (val) => val ? Math.round(val).toLocaleString() : '0';
  const fmtPct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : 'N/A';
  const fmtRate = (v) => v != null ? `$${v.toFixed(2)}` : 'N/A';

  // Pre-calculate cost type ratios and unit rates from comparables
  const costTypes = calcCostTypeBreakdown(projectDetails);

  // Calculate inflation info for prompt
  const inflationRate = (ANNUAL_INFLATION_RATE * 100).toFixed(1);
  const avgAge = averages.avg_project_age_years || 'N/A';

  return `You are Titan, an expert HVAC estimator for Tweet Garot Mechanical. Generate detailed budget estimates based on historical project data.

## NEW PROJECT DETAILS:
- Project Name: ${projectName}
${market ? `- Market: ${market}` : '- Market: Not specified'}
${projectType ? `- Project Type: ${projectType}` : '- Project Type: Not specified'}
${buildingType ? `- Scope: ${buildingType}` : ''}
- Bid Type: ${bidType || 'Not specified'}
${location ? `- Location: ${location}` : ''}
- Square Footage: ${formatNumber(sqft)} SF
${scopesOfWork.length > 0 ? `- Scopes of Work to Budget: ${scopesOfWork.join(', ')}` : '- Scopes of Work: All (Plumbing, Sheet Metal, Piping, BAS)'}
${scope ? `- Additional Scope Notes: ${scope}` : ''}
${narrativeText ? `
## PROJECT DESIGN NARRATIVE:
The following design narrative or specification document was provided for this project. Use it to inform equipment types, system configurations, piping and ductwork complexity, controls requirements, and any special scope items not captured in the standard fields above. Where the narrative specifies quantities, systems, or cost-driving details, weight these more heavily than the historical averages.

${narrativeText}

---` : ''}

## INFLATION ADJUSTMENT NOTICE:
All historical costs have been adjusted for inflation to ${new Date().getFullYear()} dollars using a ${inflationRate}% annual inflation rate.
Average project age in dataset: ${avgAge} years
This ensures the estimate reflects current market conditions.

## HISTORICAL DATA ANALYSIS:
Based on ${averages.project_count || 0} similar ${[market, projectType].filter(Boolean).join(' / ')} projects (costs adjusted to today's dollars):
- Average Total Cost: ${formatCurrency(averages.avg_total_cost)}
- Average Cost/SF: $${(parseFloat(averages.avg_cost_per_sqft) || 0).toFixed(2)}

Category Averages:
- PM Cost: ${formatCurrency(averages.avg_pm_cost)}
- Sheet Metal Equipment: ${formatCurrency(averages.avg_sm_equip_cost)}
- Plumbing Equipment: ${formatCurrency(averages.avg_pf_equip_cost)}
- Controls: ${formatCurrency(averages.avg_controls)}
- Insulation: ${formatCurrency(averages.avg_insulation)}
- Balancing: ${formatCurrency(averages.avg_balancing)}
- Electrical: ${formatCurrency(averages.avg_electrical)}
- Supply Ductwork (Labor): ${formatCurrency(averages.avg_supply_labor)}
- Supply Ductwork (Material): ${formatCurrency(averages.avg_supply_material)}
- Return Ductwork (Material): ${formatCurrency(averages.avg_return_material)}
- Exhaust Ductwork (Material): ${formatCurrency(averages.avg_exhaust_material)}
- Hot Water Piping (Material): ${formatCurrency(averages.avg_hw_material)}
- Chilled Water Piping (Material): ${formatCurrency(averages.avg_chw_material)}

## COST TYPE CLASSIFICATION (use these costType numbers on every section):
- 1 = Labor       → field labor for ductwork, piping, PM hours (sections that are primarily trade labor)
- 2 = Material    → raw ductwork sheet metal, pipe/fittings (use only if creating a standalone material section)
- 3 = Subcontracts → Controls, BAS, Insulation, Balancing, Electrical (work subcontracted to others)
- 4 = Rentals     → Truck rental, temp heat, equipment rental
- 5 = MEP Equipment → AHUs, RTUs, boilers, chillers, pumps, VFDs, and all major mechanical equipment
- 6 = General Conditions → General conditions, allowances, mobilization

Every section in the JSON MUST include a "costType" integer from the list above.
Ductwork and piping sections are costType 1 (Labor) — their items include both laborCost and materialCost within the same section; the material component is part of the labor trade scope.

## COST TYPE ANALYSIS FROM COMPARABLE PROJECTS:
${costTypes ? `
The following cost-type ratios are calculated directly from the comparable project data (inflation-adjusted). Use these as the PRIMARY constraint when allocating costs — do NOT let your section subtotals produce ratios that deviate more than ~5 percentage points from these averages without a documented reason.

| Cost Type | ${costTypes.perProject.map(r => r.name).join(' | ')} | **Average** |
|---|${costTypes.perProject.map(() => '---').join('|')}|---|
| Labor | ${costTypes.perProject.map(r => fmtPct(r.laborPct)).join(' | ')} | **${fmtPct(costTypes.avgLaborPct)}** |
| Material | ${costTypes.perProject.map(r => fmtPct(r.materialPct)).join(' | ')} | **${fmtPct(costTypes.avgMaterialPct)}** |
| Equipment | ${costTypes.perProject.map(r => fmtPct(r.equipmentPct)).join(' | ')} | **${fmtPct(costTypes.avgEquipmentPct)}** |
| Controls/Insul/Elec/Other | ${costTypes.perProject.map(r => fmtPct(r.otherPct)).join(' | ')} | **${fmtPct(costTypes.avgOtherPct)}** |

### Section-Level Unit Rates (use these to size individual sections):
${costTypes.avgDuctLbsPerSqft != null ? `- Ductwork density: ${costTypes.avgDuctLbsPerSqft.toFixed(2)} lbs/SF average across comparables` : ''}
${costTypes.avgDuctLaborPerLb != null ? `- Ductwork labor rate: ${fmtRate(costTypes.avgDuctLaborPerLb)}/lb` : ''}
${costTypes.avgDuctMaterialPerLb != null ? `- Ductwork material rate: ${fmtRate(costTypes.avgDuctMaterialPerLb)}/lb` : ''}
${costTypes.avgPipingFtPerSqft != null ? `- Piping density: ${costTypes.avgPipingFtPerSqft.toFixed(2)} ft/SF average across comparables` : ''}
${costTypes.avgPipingLaborPerFt != null ? `- Piping labor rate: ${fmtRate(costTypes.avgPipingLaborPerFt)}/ft` : ''}
${costTypes.avgPipingMaterialPerFt != null ? `- Piping material rate: ${fmtRate(costTypes.avgPipingMaterialPerFt)}/ft` : ''}
${costTypes.avgEquipUnitsPerSqft != null ? `- Major equipment density: ${(costTypes.avgEquipUnitsPerSqft * 1000).toFixed(2)} units per 1,000 SF` : ''}
${costTypes.avgEquipCostPerUnit != null ? `- Equipment cost per major unit (AHU/RTU/boiler/chiller): ${fmtRate(costTypes.avgEquipCostPerUnit)}` : ''}

Apply these unit rates to the new ${formatNumber(sqft)} SF project to size each section, then verify the resulting cost-type totals match the percentage targets above. Adjust rates modestly (±10–15%) for healthcare complexity or project-specific scope notes.
` : 'Cost type breakdown not available from comparable project data — use historical averages as a guide.'}

## COMPARABLE PROJECT DETAIL (All costs inflation-adjusted to ${new Date().getFullYear()} dollars):
${projectDetails.map((p, i) => {
  const bidYear = p.bid_date ? new Date(p.bid_date).getFullYear() : 'N/A';
  const yearsAgo = p.bid_date ? ((new Date() - new Date(p.bid_date)) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1) : 'N/A';
  return `
### Project ${i + 1}: ${p.name}
- Building Type: ${p.building_type}, Project Type: ${p.project_type}, Bid Type: ${p.bid_type || 'N/A'}
- Scopes in this contract: ${Array.isArray(p.scopes) && p.scopes.length > 0 ? p.scopes.join(', ') : 'Not specified'}
- Square Footage: ${formatNumber(p.total_sqft)} SF
- Total Cost (Adjusted): ${formatCurrency(p.total_cost)}${p.original_total_cost ? ` (Original ${bidYear}: ${formatCurrency(p.original_total_cost)})` : ''}
- Cost per SF (Adjusted): $${(parseFloat(p.total_cost_per_sqft) || 0).toFixed(2)}
- Bid Date: ${p.bid_date ? new Date(p.bid_date).toLocaleDateString() : 'N/A'} (${yearsAgo} years ago)

Cost Breakdown:
- PM Hours: ${p.pm_hours || 0}, PM Cost: ${formatCurrency(p.pm_cost)}
- SM Equipment Cost: ${formatCurrency(p.sm_equip_cost)}
- PF Equipment Cost: ${formatCurrency(p.pf_equip_cost)}
- Controls: ${formatCurrency(p.controls)}
- Insulation: ${formatCurrency(p.insulation)}
- Balancing: ${formatCurrency(p.balancing)}
- Electrical: ${formatCurrency(p.electrical)}
- General Conditions: ${formatCurrency(p.general)}
- Allowance: ${formatCurrency(p.allowance)}

Ductwork:
- Supply: Labor ${formatCurrency(p.s_field_cost)}, Material ${formatCurrency(p.s_materials_with_escalation)}, ${formatNumber(p.s_lbs)} lbs
- Return: Labor ${formatCurrency(p.r_field_cost)}, Material ${formatCurrency(p.r_materials_with_escalation)}, ${formatNumber(p.r_lbs)} lbs
- Exhaust: Labor ${formatCurrency(p.e_field_cost)}, Material ${formatCurrency(p.e_material_with_escalation)}, ${formatNumber(p.e_lbs)} lbs
- Outside Air: Labor ${formatCurrency(p.o_field_cost)}, Material ${formatCurrency(p.o_materials_with_escalation)}, ${formatNumber(p.o_lbs)} lbs

Piping:
- Hot Water: Labor ${formatCurrency(p.hw_field_cost)}, Material ${formatCurrency(p.hw_material_with_esc)}, ${formatNumber(p.hw_footage)} ft
- Chilled Water: Labor ${formatCurrency(p.chw_field_cost)}, Material ${formatCurrency(p.chw_material_with_esc)}, ${formatNumber(p.chw_footage)} ft

Equipment Counts:
- AHU: ${p.ahu || 0}, RTU: ${p.rtu || 0}, VAV: ${p.vav || 0}
- Boilers: ${p.boilers || 0}, Pumps: ${p.pumps || 0}, Chillers: ${p.chiller || 0}
`;
}).join('\n')}

## YOUR TASK:
Generate a detailed HVAC budget estimate for the new ${formatNumber(sqft)} SF project.

${scopesOfWork.length > 0 ? `
SCOPE CONSTRAINT: This budget must include ONLY the following scopes of work: **${scopesOfWork.join(', ')}**.
- Omit all sections unrelated to these scopes (e.g., if only "Sheet Metal" is requested, exclude Plumbing sections and Plumbing Equipment).
- The comparable projects listed above may have contracts covering additional scopes not in this budget. Their "Scopes in this contract" field shows what was included. When using a comparable project's total cost or $/SF as a benchmark, mentally subtract the cost contribution of scopes NOT in our budget before scaling. For example, if a comparable is Sheet Metal + Piping but this budget is Sheet Metal only, use only the ductwork-related costs from that comparable.
- If a comparable project has no scopes listed, include it as-is but note the uncertainty.
` : ''}

${userSelectedProjects
  ? `WEIGHTING INSTRUCTION: The user manually selected these specific comparable projects. They are the PRIMARY basis for this estimate. Anchor your total cost/SF to the range established by these comparables ($${Math.min(...projectDetails.map(p => parseFloat(p.total_cost_per_sqft) || 0)).toFixed(2)}–$${Math.max(...projectDetails.map(p => parseFloat(p.total_cost_per_sqft) || 0)).toFixed(2)}/SF after inflation adjustment). Adjust within that range for size differences — larger projects typically achieve modest economies of scale (5–15% reduction per doubling of SF), but do NOT go below the comparable range without a specific justification. The historical averages above are provided as secondary context for category-level breakdowns only; do not let them pull your total cost/SF outside the comparable range.`
  : `Scale costs proportionally based on both the historical data and comparable projects, using the comparable projects as the primary reference and the historical averages to calibrate individual cost categories.`
}

IMPORTANT: Return ONLY a valid JSON object with this exact structure (no additional text before or after):

{
  "summary": {
    "projectName": "string",
    "buildingType": "string",
    "projectType": "string",
    "squareFootage": number,
    "estimatedTotalCost": number,
    "costPerSquareFoot": number,
    "confidenceLevel": "high" | "medium" | "low",
    "methodology": "brief explanation of calculation approach"
  },
  "comparableProjects": [
    {
      "name": "string",
      "sqft": number,
      "totalCost": number,
      "costPerSqft": number,
      "relevanceNote": "why this project is comparable"
    }
  ],
  "sections": [
    {
      "name": "Project Management",
      "costType": 1,
      "subtotal": number,
      "items": [
        {
          "description": "PM Hours & Coordination",
          "hours": number,
          "laborCost": number,
          "materialCost": 0,
          "totalCost": number,
          "notes": "optional notes"
        }
      ]
    },
    {
      "name": "Sheet Metal - Supply Ductwork",
      "costType": 1,
      "subtotal": number,
      "items": [
        {
          "description": "Supply Duct Fabrication & Installation",
          "quantity": number,
          "unit": "lbs",
          "laborCost": number,
          "materialCost": number,
          "totalCost": number
        }
      ]
    },
    {
      "name": "Sheet Metal - Return Ductwork",
      "costType": 1,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Sheet Metal - Exhaust Ductwork",
      "costType": 1,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Sheet Metal - Outside Air Ductwork",
      "costType": 1,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Sheet Metal Equipment",
      "costType": 5,
      "subtotal": number,
      "items": [
        {
          "description": "AHU",
          "quantity": number,
          "materialCost": number,
          "totalCost": number
        }
      ]
    },
    {
      "name": "Piping - Hot Water",
      "costType": 1,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Piping - Chilled Water",
      "costType": 1,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Piping Equipment",
      "subtotal": number,
      "items": []
    },
    {
      "name": "Piping Equipment",
      "costType": 5,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Controls",
      "costType": 3,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Insulation",
      "costType": 3,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Balancing",
      "costType": 3,
      "subtotal": number,
      "items": []
    },
    {
      "name": "Electrical",
      "costType": 3,
      "subtotal": number,
      "items": []
    },
    {
      "name": "General Conditions",
      "costType": 6,
      "subtotal": number,
      "items": []
    }
  ],
  "totals": {
    "laborSubtotal": number,
    "materialSubtotal": number,
    "equipmentSubtotal": number,
    "subcontractSubtotal": number,
    "directCostSubtotal": number,
    "overhead": number,
    "profit": number,
    "contingency": number,
    "grandTotal": number
  },
  "assumptions": [
    "list key assumptions made in the estimate"
  ],
  "risks": [
    "list potential cost risks or unknowns"
  ]
}`;
}

// Extract JSON from AI response
function extractJsonFromResponse(text) {
  try {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error('Failed to parse JSON from response:', e);
    return null;
  }
}

module.exports = router;
