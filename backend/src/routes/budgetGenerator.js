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
        limit: 5
      }),
      HistoricalProject.getCategoryAverages(buildingType, projectType)
    ]);

    res.json({
      similarProjects,
      averages
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
    const projectDetails = await Promise.all(
      topProjects.map(p => HistoricalProject.findById(p.id))
    );

    // Get category averages
    const averages = await HistoricalProject.getCategoryAverages(
      buildingType,
      projectType
    );

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
      similarProjects: topProjects.map(p => ({
        id: p.id,
        name: p.name,
        buildingType: p.building_type,
        projectType: p.project_type,
        sqft: parseFloat(p.total_sqft) || 0,
        totalCost: parseFloat(p.total_cost) || 0,
        costPerSqft: parseFloat(p.total_cost_per_sqft) || 0,
        similarityScore: p.similarity_score
      })),
      averages: {
        projectCount: averages.project_count,
        avgCost: parseFloat(averages.avg_total_cost) || 0,
        avgCostPerSqft: parseFloat(averages.avg_cost_per_sqft) || 0
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

  return `You are Titan, an expert HVAC estimator for Tweet Garot Mechanical. Generate detailed budget estimates based on historical project data.

## NEW PROJECT DETAILS:
- Project Name: ${projectName}
- Building Type: ${buildingType}
- Project Type: ${projectType}
- Bid Type: ${bidType || 'Not specified'}
- Square Footage: ${formatNumber(sqft)} SF
${scope ? `- Additional Scope Notes: ${scope}` : ''}

## HISTORICAL DATA ANALYSIS:
Based on ${averages.project_count || 0} similar ${buildingType} ${projectType} projects:
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

## TOP 3 COMPARABLE PROJECTS:
${projectDetails.map((p, i) => `
### Project ${i + 1}: ${p.name}
- Building Type: ${p.building_type}, Project Type: ${p.project_type}, Bid Type: ${p.bid_type || 'N/A'}
- Square Footage: ${formatNumber(p.total_sqft)} SF
- Total Cost: ${formatCurrency(p.total_cost)}
- Cost per SF: $${(parseFloat(p.total_cost_per_sqft) || 0).toFixed(2)}
- Bid Date: ${p.bid_date ? new Date(p.bid_date).toLocaleDateString() : 'N/A'}

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
`).join('\n')}

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
