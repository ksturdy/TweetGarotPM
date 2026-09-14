const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { generatePhaseReportPdfBuffer } = require('../utils/phaseReportPdfBuffer');
const { generatePhaseReportExcel } = require('../utils/phaseReportExcelGenerator');

router.use(authenticate);
router.use(tenantContext);

async function buildPhaseReportData(tenantId, filters = {}) {
  const params = [tenantId];
  let paramIdx = 2;
  const whereClauses = ['vpc.tenant_id = $1'];

  if (filters.department) {
    whereClauses.push(`vc.department_code = $${paramIdx++}`);
    params.push(filters.department);
  }
  if (filters.status) {
    whereClauses.push(`vc.status = $${paramIdx++}`);
    params.push(filters.status);
  }
  if (filters.bill_method) {
    whereClauses.push(`vc.bill_method = $${paramIdx++}`);
    params.push(filters.bill_method);
  }
  if (filters.phases && filters.phases.length > 0) {
    const placeholders = filters.phases.map(() => `$${paramIdx++}`).join(', ');
    whereClauses.push(`vpc.phase IN (${placeholders})`);
    params.push(...filters.phases);
  }

  // Team filter: restrict to jobs whose linked project has a manager on the team
  if (filters.team) {
    const Team = require('../models/Team');
    const members = await Team.getMembers(Number(filters.team), tenantId);
    if (members.length > 0) {
      const empIds = members.map(m => m.employee_id);
      const placeholders = empIds.map(() => `$${paramIdx++}`).join(', ');
      whereClauses.push(`vc.linked_employee_id IN (${placeholders})`);
      params.push(...empIds);
    } else {
      // Team exists but has no members — return nothing
      return [];
    }
  }

  // cost_type = 1 (labor) so est_hours/jtd_hours are meaningful
  whereClauses.push('vpc.cost_type = 1');

  const result = await db.query(
    `SELECT
       vpc.job                                          AS job_number,
       vpc.job_description                              AS job_name,
       vpc.phase                                        AS phase_code,
       vpc.phase_description                            AS phase_name,
       vc.department_code,
       vc.status,
       vc.bill_method,
       e.first_name || ' ' || e.last_name              AS manager_name,
       COALESCE(vpc.est_hours, 0)                       AS est_hours,
       COALESCE(vpc.jtd_hours, 0)                       AS jtd_hours
     FROM vp_phase_codes vpc
     LEFT JOIN vp_contracts vc
       ON vpc.contract = vc.contract_number AND vc.tenant_id = vpc.tenant_id
     LEFT JOIN employees e ON vc.linked_employee_id = e.id
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY vpc.job ASC, vpc.phase ASC`,
    params
  );

  return result.rows;
}

async function buildFilterOptions(tenantId) {
  const [depts, statuses, billMethods, phases] = await Promise.all([
    db.query(
      `SELECT DISTINCT department_code FROM vp_contracts
       WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code <> ''
       ORDER BY department_code`,
      [tenantId]
    ),
    db.query(
      `SELECT DISTINCT status FROM vp_contracts
       WHERE tenant_id = $1 AND status IS NOT NULL AND status <> ''
       ORDER BY status`,
      [tenantId]
    ),
    db.query(
      `SELECT DISTINCT bill_method FROM vp_contracts
       WHERE tenant_id = $1 AND bill_method IS NOT NULL AND bill_method <> ''
       ORDER BY bill_method`,
      [tenantId]
    ),
    db.query(
      `SELECT DISTINCT phase FROM vp_phase_codes
       WHERE tenant_id = $1 AND phase IS NOT NULL AND phase <> ''
       ORDER BY phase`,
      [tenantId]
    ),
  ]);

  return {
    departments: depts.rows.map(r => r.department_code),
    statuses: statuses.rows.map(r => r.status),
    billMethods: billMethods.rows.map(r => r.bill_method),
    phases: phases.rows.map(r => r.phase),
  };
}

function parseFilters(query) {
  return {
    department: query.department || null,
    status: query.status || null,
    bill_method: query.bill_method || null,
    team: query.team ? Number(query.team) : null,
    teamName: query.teamName || null,
    phases: query.phases ? String(query.phases).split(',').map(p => p.trim()).filter(Boolean) : [],
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await buildPhaseReportData(req.tenantId, parseFilters(req.query));
    res.json(rows);
  } catch (err) {
    console.error('Phase report error:', err);
    res.status(500).json({ error: 'Failed to load phase report data' });
  }
});

router.get('/filters', async (req, res) => {
  try {
    const options = await buildFilterOptions(req.tenantId);
    res.json(options);
  } catch (err) {
    console.error('Phase report filter options error:', err);
    res.status(500).json({ error: 'Failed to load filter options' });
  }
});

router.get('/pdf-download', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const rows = await buildPhaseReportData(req.tenantId, filters);
    const pdfBuffer = await generatePhaseReportPdfBuffer(rows, filters);
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Phase-Report-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Phase report PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

router.get('/excel-download', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const rows = await buildPhaseReportData(req.tenantId, filters);
    const buffer = await generatePhaseReportExcel(rows, filters);
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Phase-Report-${dateStr}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Phase report Excel error:', err);
    res.status(500).json({ error: 'Failed to generate Excel' });
  }
});

module.exports = router;
module.exports.buildPhaseReportData = buildPhaseReportData;
