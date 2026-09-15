const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { generatePhaseReportPdfBuffer } = require('../utils/phaseReportPdfBuffer');
const { generatePhaseReportExcel } = require('../utils/phaseReportExcelGenerator');

router.use(authenticate);
router.use(tenantContext);

// Build WHERE clauses for dept/status/bill_method/team (shared by main + missing queries)
function buildContextClauses(filters, empNumbers, startIdx) {
  const clauses = [];
  const values = [];
  let idx = startIdx;

  if (filters.departments && filters.departments.length > 0) {
    clauses.push(`vc.department_code IN (${filters.departments.map(() => `$${idx++}`).join(', ')})`);
    values.push(...filters.departments);
  }
  if (filters.statuses && filters.statuses.length > 0) {
    clauses.push(`vc.status IN (${filters.statuses.map(() => `$${idx++}`).join(', ')})`);
    values.push(...filters.statuses);
  }
  if (filters.bill_methods && filters.bill_methods.length > 0) {
    clauses.push(`vc.bill_method IN (${filters.bill_methods.map(() => `$${idx++}`).join(', ')})`);
    values.push(...filters.bill_methods);
  }
  if (empNumbers && empNumbers.length > 0) {
    clauses.push(`vc.employee_number IN (${empNumbers.map(() => `$${idx++}`).join(', ')})`);
    values.push(...empNumbers);
  }

  return { clauses, values, nextIdx: idx };
}

// Find jobs that match context filters but have ZERO phases matching phase_prefix
async function buildMissingRows(tenantId, filters, empNumbers) {
  const prefix = filters.phase_prefix;
  const params = [tenantId];
  let paramIdx = 2;
  const whereClauses = ['vpc.tenant_id = $1', 'vpc.cost_type = 1'];

  const { clauses, values, nextIdx } = buildContextClauses(filters, empNumbers, paramIdx);
  whereClauses.push(...clauses);
  params.push(...values);
  paramIdx = nextIdx;

  // Exclude jobs that already have at least one phase matching the prefix
  whereClauses.push(`NOT EXISTS (
    SELECT 1 FROM vp_phase_codes vpc2
    WHERE vpc2.job = vpc.job AND vpc2.tenant_id = vpc.tenant_id
      AND vpc2.cost_type = 1 AND vpc2.phase LIKE $${paramIdx++}
  )`);
  params.push(`${prefix}%`);

  const phaseNameIdx = paramIdx++;
  params.push(`— No ${prefix} phases —`);

  const result = await db.query(
    `SELECT DISTINCT ON (vpc.job)
       vpc.job                      AS job_number,
       vpc.job_description          AS job_name,
       vc.project_manager_name      AS manager_name,
       NULL                         AS phase_code,
       $${phaseNameIdx}             AS phase_name,
       vc.department_code,
       vc.status,
       vc.bill_method,
       NULL                         AS est_hours,
       NULL                         AS jtd_hours
     FROM vp_phase_codes vpc
     LEFT JOIN vp_contracts vc
       ON vpc.contract = vc.contract_number AND vc.tenant_id = vpc.tenant_id
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY vpc.job`,
    params
  );

  return result.rows.map(r => ({ ...r, is_missing: true }));
}

async function buildPhaseReportData(tenantId, filters = {}) {
  // Resolve team employee numbers up-front (reused by missing-row query)
  let empNumbers = null;
  if (filters.teams && filters.teams.length > 0) {
    const Team = require('../models/Team');
    const allEmpIds = new Set();
    for (const teamId of filters.teams) {
      const members = await Team.getMembers(Number(teamId), tenantId);
      members.forEach(m => allEmpIds.add(m.employee_id));
    }
    if (allEmpIds.size === 0) return [];

    const empNumResult = await db.query(
      `SELECT employee_number FROM employees
       WHERE id = ANY($1::int[]) AND employee_number IS NOT NULL AND employee_number <> ''`,
      [[...allEmpIds]]
    );
    empNumbers = empNumResult.rows.map(r => String(r.employee_number));
    if (empNumbers.length === 0) return [];
  }

  const params = [tenantId];
  let paramIdx = 2;
  const whereClauses = ['vpc.tenant_id = $1'];

  const { clauses, values, nextIdx } = buildContextClauses(filters, empNumbers, paramIdx);
  whereClauses.push(...clauses);
  params.push(...values);
  paramIdx = nextIdx;

  if (filters.phases && filters.phases.length > 0) {
    const placeholders = filters.phases.map(() => `$${paramIdx++}`).join(', ');
    whereClauses.push(`vpc.phase IN (${placeholders})`);
    params.push(...filters.phases);
  }
  if (filters.phase_prefix) {
    whereClauses.push(`vpc.phase LIKE $${paramIdx++}`);
    params.push(`${filters.phase_prefix}%`);
  }

  // cost_type = 1 (labor) so est_hours/jtd_hours are meaningful
  whereClauses.push('vpc.cost_type = 1');

  const result = await db.query(
    `SELECT
       vpc.job                                          AS job_number,
       vpc.job_description                              AS job_name,
       vc.project_manager_name                          AS manager_name,
       vpc.phase                                        AS phase_code,
       vpc.phase_description                            AS phase_name,
       vc.department_code,
       vc.status,
       vc.bill_method,
       COALESCE(vpc.est_hours, 0)                       AS est_hours,
       COALESCE(vpc.jtd_hours, 0)                       AS jtd_hours
     FROM vp_phase_codes vpc
     LEFT JOIN vp_contracts vc
       ON vpc.contract = vc.contract_number AND vc.tenant_id = vpc.tenant_id
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY vpc.job ASC, vpc.phase ASC`,
    params
  );

  if (filters.include_missing && filters.phase_prefix) {
    const missingRows = await buildMissingRows(tenantId, filters, empNumbers || []);
    return [...result.rows, ...missingRows];
  }

  return result.rows;
}

async function buildFilterOptions(tenantId, filters = {}) {
  // Resolve team employee numbers up-front so we can use them in the phase sub-query
  let teamEmpNumbers = [];
  if (filters.teams && filters.teams.length > 0) {
    const Team = require('../models/Team');
    const allEmpIds = new Set();
    for (const teamId of filters.teams) {
      const members = await Team.getMembers(Number(teamId), tenantId);
      members.forEach(m => allEmpIds.add(m.employee_id));
    }
    if (allEmpIds.size > 0) {
      const empNumResult = await db.query(
        `SELECT employee_number FROM employees
         WHERE id = ANY($1::int[]) AND employee_number IS NOT NULL AND employee_number <> ''`,
        [[...allEmpIds]]
      );
      teamEmpNumbers = empNumResult.rows.map(r => String(r.employee_number));
    }
  }

  // Build a phase query that respects the active dept/status/bill_method/team filters
  const hasCtx = filters.departments?.length > 0 || filters.statuses?.length > 0 ||
                 filters.bill_methods?.length > 0 || teamEmpNumbers.length > 0;

  let phaseQueryPromise;
  if (hasCtx) {
    const phaseParams = [tenantId];
    let pi = 2;
    const phaseWhere = ['vpc.tenant_id = $1', 'vpc.cost_type = 1'];

    if (filters.departments?.length > 0) {
      phaseWhere.push(`vc.department_code IN (${filters.departments.map(() => `$${pi++}`).join(', ')})`);
      phaseParams.push(...filters.departments);
    }
    if (filters.statuses?.length > 0) {
      phaseWhere.push(`vc.status IN (${filters.statuses.map(() => `$${pi++}`).join(', ')})`);
      phaseParams.push(...filters.statuses);
    }
    if (filters.bill_methods?.length > 0) {
      phaseWhere.push(`vc.bill_method IN (${filters.bill_methods.map(() => `$${pi++}`).join(', ')})`);
      phaseParams.push(...filters.bill_methods);
    }
    if (teamEmpNumbers.length > 0) {
      phaseWhere.push(`vc.employee_number IN (${teamEmpNumbers.map(() => `$${pi++}`).join(', ')})`);
      phaseParams.push(...teamEmpNumbers);
    }

    phaseQueryPromise = db.query(
      `SELECT DISTINCT vpc.phase
       FROM vp_phase_codes vpc
       LEFT JOIN vp_contracts vc ON vpc.contract = vc.contract_number AND vc.tenant_id = vpc.tenant_id
       WHERE ${phaseWhere.join(' AND ')} AND vpc.phase IS NOT NULL AND vpc.phase <> ''
       ORDER BY vpc.phase`,
      phaseParams
    );
  } else {
    phaseQueryPromise = db.query(
      `SELECT DISTINCT phase FROM vp_phase_codes
       WHERE tenant_id = $1 AND cost_type = 1 AND phase IS NOT NULL AND phase <> ''
       ORDER BY phase`,
      [tenantId]
    );
  }

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
    phaseQueryPromise,
  ]);

  return {
    departments: depts.rows.map(r => r.department_code),
    statuses: statuses.rows.map(r => r.status),
    billMethods: billMethods.rows.map(r => r.bill_method),
    phases: phases.rows.map(r => r.phase),
  };
}

function parseFilters(query) {
  const csv = (v) => v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [];
  return {
    departments: csv(query.departments),
    statuses: csv(query.statuses),
    bill_methods: csv(query.bill_methods),
    teams: csv(query.teams),
    teamNames: csv(query.teamNames),
    phases: csv(query.phases),
    phase_prefix: query.phase_prefix ? String(query.phase_prefix).trim() : null,
    include_missing: query.include_missing === 'true',
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
    const options = await buildFilterOptions(req.tenantId, parseFilters(req.query));
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
