const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const Tenant = require('../models/Tenant');
const VistaData = require('../models/VistaData');
const opportunities = require('../models/opportunities');
const { buildBacklogAnalysis } = require('../utils/backlogAnalysisCalculator');
const { generateBacklogAnalysisPdfBuffer } = require('../utils/backlogAnalysisPdfBuffer');
const { generateBacklogAnalysisExcel } = require('../utils/backlogAnalysisExcelGenerator');

router.use(authenticate);
router.use(tenantContext);

/**
 * Resolve a team's members + lead to a Set of lowercased "first last" name strings.
 * Vista contracts store PMs as "Last, First" — pmInTeam() handles the reversal.
 * (Same approach as pmWorkloadReport — linked_employee_id is not populated on vp_contracts.)
 */
async function loadTeamMemberNames(teamId, tenantId) {
  if (!teamId) return null;
  const result = await db.query(
    `SELECT DISTINCT LOWER(e.first_name || ' ' || e.last_name) AS full_name
     FROM (
       SELECT employee_id FROM team_members WHERE team_id = $1
       UNION
       SELECT team_lead_id AS employee_id FROM teams WHERE id = $1 AND team_lead_id IS NOT NULL
     ) m
     JOIN employees e ON e.id = m.employee_id AND e.tenant_id = $2
     WHERE e.first_name IS NOT NULL AND e.last_name IS NOT NULL`,
    [teamId, tenantId]
  );
  return new Set(result.rows.map(r => r.full_name));
}

async function getTeamName(teamId, tenantId) {
  if (!teamId) return null;
  const result = await db.query(
    `SELECT name FROM teams WHERE id = $1 AND tenant_id = $2`,
    [teamId, tenantId]
  );
  return result.rows[0]?.name || null;
}

async function buildData(tenantId, filters = {}) {
  const teamId = filters.team && filters.team !== 'all' ? Number(filters.team) : null;

  const [contracts, allOpps, tenant, teamMemberNames, teamName, overrideRows] = await Promise.all([
    VistaData.getAllContracts({}, tenantId),
    opportunities.findAll({}, tenantId),
    Tenant.findById(tenantId),
    loadTeamMemberNames(teamId, tenantId),
    teamId ? getTeamName(teamId, tenantId) : Promise.resolve(null),
    db.query(
      `SELECT vc.id AS contract_id, p.override_gm_percent
         FROM projects p
         JOIN vp_contracts vc ON vc.linked_project_id = p.id
        WHERE p.tenant_id = $1 AND p.override_gm_percent IS NOT NULL`,
      [tenantId]
    ),
  ]);

  const gmOverrideMap = {};
  for (const r of overrideRows.rows) {
    gmOverrideMap[r.contract_id] = parseFloat(r.override_gm_percent);
  }

  const saved = tenant?.settings?.backlogAnalysisSettings || {};
  const settings = {
    monthlySgAndA:   saved.monthlySgAndA || 0,
    sgaMode:         saved.sgaMode        || 'dollar',
    sgaPct:          saved.sgaPct         || 0,
    scenario:        saved.scenario       || 'actual',
    conservativePct: saved.conservativePct ?? 10,
    aggressivePct:   saved.aggressivePct  ?? 10,
    divisionFilter:  filters.division || 'all',
    teamMemberNames,
    gmOverrideMap,
  };

  const result = buildBacklogAnalysis(contracts, allOpps, settings);
  return { ...result, teamFilter: filters.team || 'all', teamName };
}

/**
 * GET /api/backlog-analysis/data
 */
router.get('/data', async (req, res, next) => {
  try {
    const result = await buildData(req.tenantId, {
      division: req.query.division,
      team:     req.query.team,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/backlog-analysis/pdf
 */
router.get('/pdf', async (req, res, next) => {
  try {
    const result = await buildData(req.tenantId, {
      division: req.query.division,
      team:     req.query.team,
    });
    const generatedBy = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
    const pdfBuffer = await generateBacklogAnalysisPdfBuffer(result, generatedBy);
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Backlog-Analysis-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating Backlog Analysis PDF:', err);
    next(err);
  }
});

/**
 * GET /api/backlog-analysis/excel
 */
router.get('/excel', async (req, res, next) => {
  try {
    const result = await buildData(req.tenantId, {
      division: req.query.division,
      team:     req.query.team,
    });
    const buffer = await generateBacklogAnalysisExcel(result);
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Backlog-Analysis-${dateStr}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating Backlog Analysis Excel:', err);
    next(err);
  }
});

module.exports = router;
module.exports.buildData = buildData;
