const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const HistoricalProject = require('../models/HistoricalProject');

const router = express.Router();

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

// Get dropdown options (building types, project types, bid types)
router.get('/options', async (req, res, next) => {
  try {
    const [buildingTypes, projectTypes, bidTypes] = await Promise.all([
      HistoricalProject.getDistinctValues('building_type'),
      HistoricalProject.getDistinctValues('project_type'),
      HistoricalProject.getDistinctValues('bid_type')
    ]);

    res.json({
      buildingTypes,
      projectTypes,
      bidTypes
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
    const { buildingType, projectType, bidType, sqft } = req.body;

    if (!buildingType || !projectType) {
      return res.status(400).json({
        error: 'Building type and project type are required'
      });
    }

    const [similarProjects, averages] = await Promise.all([
      HistoricalProject.findSimilar({
        buildingType,
        projectType,
        bidType: bidType || null,
        sqft: sqft || null,
        limit: 20  // Return more projects for preview
      }),
      HistoricalProject.getCategoryAverages(buildingType, projectType)
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
          building_type: p.building_type === buildingType,
          project_type: p.project_type === projectType,
          bid_type: !bidType || p.bid_type === bidType,
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
router.post('/generate', async (req, res, next) => {
  try {
    const {
      projectName,
      buildingType,
      projectType,
      bidType,
      sqft,
      scope
    } = req.body;

    // Validation
    if (!projectName || !buildingType || !projectType || !sqft) {
      return res.status(400).json({
        error: 'Project name, building type, project type, and square footage are required'
      });
    }

    // Find similar projects
    const similarProjects = await HistoricalProject.findSimilar({
      buildingType,
      projectType,
      bidType: bidType || null,
      sqft,
      limit: 5
    });

    // Get top 3 for detailed analysis
    const topProjects = similarProjects.slice(0, 3);

    // Get full details of top 3 projects
    const projectDetailsRaw = await Promise.all(
      topProjects.map(p => HistoricalProject.findById(p.id))
    );

    // Apply inflation adjustment to project costs
    const projectDetails = projectDetailsRaw.map(p => adjustProjectCostsForInflation(p));

    // Get category averages
    const averagesRaw = await HistoricalProject.getCategoryAverages(
      buildingType,
      projectType
    );

    // Adjust averages for inflation based on average project age
    const averages = adjustAveragesForInflation(averagesRaw, projectDetailsRaw);

    // Build AI prompt
    const systemPrompt = buildBudgetSystemPrompt(
      projectName,
      buildingType,
      projectType,
      bidType,
      sqft,
      scope,
      projectDetails,
      averages
    );

    // Call Claude to generate budget
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Generate a detailed HVAC budget estimate for this ${sqft.toLocaleString()} square foot ${buildingType} ${projectType} project called "${projectName}". Return the budget in JSON format only, no additional text.`
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

    res.json({
      budget: budgetJson,
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
          // Inflation-adjusted values
          totalCost: parseFloat(p.total_cost) || 0,
          costPerSqft: parseFloat(p.total_cost_per_sqft) || 0,
          // Original values for reference
          originalTotalCost: parseFloat(p.original_total_cost) || 0,
          originalCostPerSqft: p.original_total_cost && p.total_sqft
            ? parseFloat(p.original_total_cost) / parseFloat(p.total_sqft)
            : 0,
          // Metadata
          bidYear,
          yearsSinceBid: yearsSinceBid ? parseFloat(yearsSinceBid) : null,
          inflationAdjusted: true,
          similarityScore: originalProject?.similarity_score || 0
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
});

// Helper function to build AI system prompt
function buildBudgetSystemPrompt(projectName, buildingType, projectType, bidType, sqft, scope, projectDetails, averages) {
  const formatCurrency = (val) => val ? `$${Math.round(val).toLocaleString()}` : '$0';
  const formatNumber = (val) => val ? Math.round(val).toLocaleString() : '0';

  // Calculate inflation info for prompt
  const inflationRate = (ANNUAL_INFLATION_RATE * 100).toFixed(1);
  const avgAge = averages.avg_project_age_years || 'N/A';

  return `You are Titan, an expert HVAC estimator for Tweet Garot Mechanical. Generate detailed budget estimates based on historical project data.

## NEW PROJECT DETAILS:
- Project Name: ${projectName}
- Building Type: ${buildingType}
- Project Type: ${projectType}
- Bid Type: ${bidType || 'Not specified'}
- Square Footage: ${formatNumber(sqft)} SF
${scope ? `- Additional Scope Notes: ${scope}` : ''}

## INFLATION ADJUSTMENT NOTICE:
All historical costs have been adjusted for inflation to ${new Date().getFullYear()} dollars using a ${inflationRate}% annual inflation rate.
Average project age in dataset: ${avgAge} years
This ensures the estimate reflects current market conditions.

## HISTORICAL DATA ANALYSIS:
Based on ${averages.project_count || 0} similar ${buildingType} ${projectType} projects (costs adjusted to today's dollars):
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

## TOP 3 COMPARABLE PROJECTS (All costs inflation-adjusted to ${new Date().getFullYear()} dollars):
${projectDetails.map((p, i) => {
  const bidYear = p.bid_date ? new Date(p.bid_date).getFullYear() : 'N/A';
  const yearsAgo = p.bid_date ? ((new Date() - new Date(p.bid_date)) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1) : 'N/A';
  return `
### Project ${i + 1}: ${p.name}
- Building Type: ${p.building_type}, Project Type: ${p.project_type}, Bid Type: ${p.bid_type || 'N/A'}
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
Generate a detailed HVAC budget estimate for the new ${formatNumber(sqft)} SF project. Scale costs proportionally based on the historical data and comparable projects.

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
      "subtotal": number,
      "items": []
    },
    {
      "name": "Sheet Metal - Exhaust Ductwork",
      "subtotal": number,
      "items": []
    },
    {
      "name": "Sheet Metal - Outside Air Ductwork",
      "subtotal": number,
      "items": []
    },
    {
      "name": "Sheet Metal Equipment",
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
      "subtotal": number,
      "items": []
    },
    {
      "name": "Piping - Chilled Water",
      "subtotal": number,
      "items": []
    },
    {
      "name": "Piping Equipment",
      "subtotal": number,
      "items": []
    },
    {
      "name": "Controls",
      "subtotal": number,
      "items": []
    },
    {
      "name": "Insulation",
      "subtotal": number,
      "items": []
    },
    {
      "name": "Balancing",
      "subtotal": number,
      "items": []
    },
    {
      "name": "Electrical",
      "subtotal": number,
      "items": []
    },
    {
      "name": "General Conditions",
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
