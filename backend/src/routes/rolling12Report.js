const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const VistaData = require('../models/VistaData');
const {
  buildRevenueProjections,
  parseNum,
  getDurationForValue,
  DEFAULT_DURATION_RULES,
} = require('../utils/forecastProjections');
const { getContourMultipliers } = require('../utils/phaseScheduleContours');
const { generateRolling12PdfBuffer } = require('../utils/rolling12ReportPdfGenerator');

router.use(authenticate);
router.use(tenantContext);

const MONTHS = 12;
const PROB_MAP = { high: 0.85, medium: 0.50, low: 0.15 };
const probWeight = (label) => PROB_MAP[(label || '').toLowerCase()] ?? 0.25;

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function formatYYYYMM(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function parseDateToOffset(dateStr, now) {
  if (!dateStr) return null;
  const s = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().slice(0, 10);
  const d = new Date(s.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

function buildColumns(now) {
  const cols = [];
  for (let i = 0; i < MONTHS; i++) {
    const date = addMonths(now, i);
    const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    cols.push({ key: formatYYYYMM(date), label });
  }
  return cols;
}


function pickMonthlyFromMap(map, monthKeys) {
  const out = {};
  for (const k of monthKeys) out[k] = map.get(k) || 0;
  return out;
}

// ─── Core data builder ────────────────────────────────────────────────────────

async function buildRolling12Data(tenantId, { departments = [], teams = [] } = {}) {
  const now = startOfMonth(new Date());
  const columns = buildColumns(now);
  const monthKeys = columns.map(c => c.key);

  const init = () => Object.fromEntries(monthKeys.map(k => [k, 0]));
  const securedByMonth = init();
  const awardedByMonth = init();
  const pursuitsByMonth = init();

  // Resolve team filter for secured contracts via the Vista employee linkage:
  // vp_contracts.employee_number → vp_employees.employee_number → vp_employees.linked_employee_id → team_members
  let teamContractNumbers = null;
  let teamEmployeeIds = null;
  if (teams.length > 0) {
    const [contractRes, empRes] = await Promise.all([
      db.query(
        `SELECT DISTINCT vc.contract_number
         FROM vp_contracts vc
         JOIN vp_employees ve
           ON ve.employee_number = NULLIF(vc.employee_number, '')::integer
           AND ve.linked_employee_id IS NOT NULL
         JOIN team_members tm ON tm.employee_id = ve.linked_employee_id
         WHERE vc.tenant_id = $1 AND tm.team_id = ANY($2::int[])`,
        [tenantId, teams]
      ),
      db.query(
        `SELECT DISTINCT tm.employee_id FROM team_members tm WHERE tm.team_id = ANY($1::int[])`,
        [teams]
      ),
    ]);
    teamContractNumbers = new Set(contractRes.rows.map(r => r.contract_number));
    teamEmployeeIds = new Set(empRes.rows.map(r => r.employee_id));
  }

  // ── Secured: active Vista contracts ───────────────────────────────────────
  let contracts = await VistaData.getAllContracts({}, tenantId);
  if (teamContractNumbers !== null) {
    contracts = contracts.filter(c => teamContractNumbers.has(c.contract_number));
  }
  const revenueResult = buildRevenueProjections(
    contracts,
    { status: 'all', departments },
    {}
  );

  for (const col of columns) {
    securedByMonth[col.key] = revenueResult.columnTotals.get(col.key) || 0;
  }

  // Per-contract detail for Secured
  const securedProjects = revenueResult.projections
    .filter(p => {
      const monthly = Object.values(pickMonthlyFromMap(p.monthlyRevenue, monthKeys));
      return monthly.some(v => v > 0);
    })
    .map(p => {
      const monthly = pickMonthlyFromMap(p.monthlyRevenue, monthKeys);
      const total = Object.values(monthly).reduce((s, v) => s + v, 0);
      return {
        contract_number: p.contract.contract_number,
        description: p.contract.description || p.contract.customer_name || '',
        customer_name: p.contract.customer_name || '',
        project_manager_name: p.contract.project_manager_name || '',
        department_code: p.contract.department_code || '',
        backlog: parseNum(p.contract.backlog),
        pct_complete: Math.round(p.pctComplete),
        monthly,
        total,
      };
    })
    .sort((a, b) => b.backlog - a.backlog);

  // ── Awarded & Pursuits: from opportunities ────────────────────────────────
  const oppsParams = [tenantId];
  const oppsTeamClause = teamEmployeeIds !== null
    ? (() => { oppsParams.push([...teamEmployeeIds]); return `AND o.assigned_to = ANY($${oppsParams.length}::int[])`; })()
    : '';

  const oppsRes = await db.query(
    `SELECT
       o.id, o.title, o.client_name, o.client_company,
       o.estimated_value,
       o.estimated_start_date,
       o.estimated_end_date,
       o.estimated_duration_days,
       o.user_adjusted_start_date,
       o.user_adjusted_duration_months,
       o.contour_type,
       o.awarded_status,
       ps.name AS stage_name,
       ps.probability AS stage_probability_label
     FROM opportunities o
     JOIN pipeline_stages ps ON o.stage_id = ps.id
     WHERE o.tenant_id = $1
       AND ps.name NOT IN ('Lost', 'Passed')
       ${oppsTeamClause}
     ORDER BY o.estimated_value DESC NULLS LAST`,
    oppsParams
  );

  const awardedProjects = [];
  const pursuitProjects = [];

  for (const opp of oppsRes.rows) {
    const value = parseNum(opp.estimated_value);
    if (value <= 0) continue;

    const startOff = Math.max(0,
      parseDateToOffset(opp.user_adjusted_start_date, now) ??
      parseDateToOffset(opp.estimated_start_date, now) ??
      0
    );
    if (startOff >= MONTHS) continue;

    // Duration: user-adjusted months → end date → duration days → value-based default
    let duration;
    if (opp.user_adjusted_duration_months) {
      duration = Math.max(1, Number(opp.user_adjusted_duration_months));
    } else if (opp.estimated_end_date) {
      const endOff = parseDateToOffset(opp.estimated_end_date, now);
      duration = endOff != null ? Math.max(1, endOff - startOff) : getDurationForValue(value, DEFAULT_DURATION_RULES);
    } else if (opp.estimated_duration_days) {
      duration = Math.max(1, Math.round(opp.estimated_duration_days / 30));
    } else {
      duration = getDurationForValue(value, DEFAULT_DURATION_RULES);
    }

    const contour = opp.contour_type || 'flat';
    const multipliers = getContourMultipliers(duration, contour);
    const isWon = opp.stage_name === 'Won' || opp.stage_name === 'Awarded';
    const client = opp.client_company || opp.client_name || '';

    function distributeWithContour(amount) {
      const dist = {};
      const baseMonthly = amount / duration;
      for (let i = 0; i < duration; i++) {
        const idx = startOff + i;
        if (idx >= 0 && idx < monthKeys.length) {
          const key = monthKeys[idx];
          dist[key] = (dist[key] || 0) + baseMonthly * multipliers[i];
        }
      }
      return dist;
    }

    if (isWon) {
      if (opp.awarded_status === 'Completed') continue;
      const dist = distributeWithContour(value);
      for (const [key, val] of Object.entries(dist)) {
        awardedByMonth[key] = (awardedByMonth[key] || 0) + val;
      }
      const total = Object.values(dist).reduce((s, v) => s + v, 0);
      awardedProjects.push({
        title: opp.title || '',
        client,
        stage_name: opp.stage_name,
        estimated_value: value,
        monthly: Object.fromEntries(monthKeys.map(k => [k, dist[k] || 0])),
        total,
      });
    } else {
      const prob = probWeight(opp.stage_probability_label);
      const weighted = value * prob;
      const dist = distributeWithContour(weighted);
      for (const [key, val] of Object.entries(dist)) {
        pursuitsByMonth[key] = (pursuitsByMonth[key] || 0) + val;
      }
      const total = Object.values(dist).reduce((s, v) => s + v, 0);
      pursuitProjects.push({
        title: opp.title || '',
        client,
        stage_name: opp.stage_name,
        probability_label: opp.stage_probability_label || '',
        probability_pct: Math.round(prob * 100),
        estimated_value: value,
        weighted_value: weighted,
        monthly: Object.fromEntries(monthKeys.map(k => [k, dist[k] || 0])),
        total,
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    columns,
    secured: securedByMonth,
    awarded: awardedByMonth,
    pursuits: pursuitsByMonth,
    secured_projects: securedProjects,
    awarded_projects: awardedProjects,
    pursuit_projects: pursuitProjects,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/reports/rolling-12/filters
router.get('/filters', async (req, res) => {
  try {
    const [deptRes, teamRes] = await Promise.all([
      db.query(
        `SELECT DISTINCT department_code
         FROM vp_contracts
         WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != ''
         ORDER BY department_code`,
        [req.tenantId]
      ),
      db.query(
        `SELECT id, name, color
         FROM teams
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY name`,
        [req.tenantId]
      ),
    ]);
    res.json({
      departments: deptRes.rows.map(r => r.department_code),
      teams: teamRes.rows,
    });
  } catch (err) {
    console.error('Error fetching rolling-12 filters:', err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

async function resolveTeamNames(teamIds, tenantId) {
  if (!teamIds || !teamIds.length) return [];
  const res = await db.query(
    `SELECT id, name FROM teams WHERE id = ANY($1::int[]) AND tenant_id = $2 ORDER BY name`,
    [teamIds, tenantId]
  );
  return res.rows.map(r => r.name);
}

function parseFilters(query) {
  const departments = query.departments
    ? String(query.departments).split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const teams = query.teams
    ? String(query.teams).split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n))
    : [];
  return { departments, teams };
}

// GET /api/reports/rolling-12
router.get('/', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await buildRolling12Data(req.tenantId, filters);
    res.json(data);
  } catch (err) {
    console.error('Error building rolling-12 report:', err);
    res.status(500).json({ error: 'Failed to build rolling 12 report' });
  }
});

// GET /api/reports/rolling-12/pdf-download
router.get('/pdf-download', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const [data, teamNames] = await Promise.all([
      buildRolling12Data(req.tenantId, filters),
      resolveTeamNames(filters.teams, req.tenantId),
    ]);
    const pdfBytes = await generateRolling12PdfBuffer(data, { ...filters, teamNames });
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Rolling-12-Revenue-${dateStr}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Error generating rolling-12 PDF:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// GET /api/reports/rolling-12/excel-download
router.get('/excel-download', async (req, res) => {
  try {
    const { departments, teams } = parseFilters(req.query);
    const [data, teamNames] = await Promise.all([
      buildRolling12Data(req.tenantId, { departments, teams }),
      resolveTeamNames(teams, req.tenantId),
    ]);
    const { columns, secured, awarded, pursuits, secured_projects, awarded_projects, pursuit_projects } = data;

    const totalByMonth = Object.fromEntries(
      columns.map(c => [c.key, (secured[c.key] || 0) + (awarded[c.key] || 0)])
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Titan PM';
    wb.created = new Date();

    const currencyFmt = '"$"#,##0';

    // ── Sheet 1: Summary ────────────────────────────────────────────────────
    const ws = wb.addWorksheet('Rolling 12 Summary');
    ws.columns = [{ width: 30 }, ...columns.map(() => ({ width: 13 })), { width: 15 }];

    const titleRow = ws.addRow(['Rolling 12-Month Revenue Forecast']);
    ws.mergeCells(1, 1, 1, columns.length + 2);
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    titleRow.height = 24;

    const filterLabel = [
      departments.length ? `Dept: ${departments.join(', ')}` : '',
      teamNames.length ? `Team: ${teamNames.join(', ')}` : '',
    ].filter(Boolean).join('  |  ');
    const dateRow = ws.addRow([`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${filterLabel ? `  |  ${filterLabel}` : ''}`]);
    ws.mergeCells(2, 1, 2, columns.length + 2);
    dateRow.getCell(1).font = { size: 10, color: { argb: 'FF64748B' } };

    ws.addRow([]);

    const hdr = ws.addRow(['Revenue Category', ...columns.map(c => c.label), '12-Mo Total']);
    hdr.height = 22;
    hdr.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: col === 1 ? 'left' : 'right', vertical: 'middle' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF0F172A' } } };
    });

    function addSummaryRow(label, byMonth, bg, fg, bold = false) {
      const vals = columns.map(c => Math.round(byMonth[c.key] || 0));
      const total = vals.reduce((s, v) => s + v, 0);
      const row = ws.addRow([label, ...vals, total]);
      row.height = 18;
      row.eachCell((cell, col) => {
        if (bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { bold, color: { argb: fg }, size: 10 };
        cell.alignment = { horizontal: col === 1 ? 'left' : 'right', vertical: 'middle' };
        if (col > 1) cell.numFmt = currencyFmt;
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
    }

    addSummaryRow('Secured Revenue', secured, 'FFE0EDFF', 'FF1E40AF');
    addSummaryRow('Awarded', awarded, 'FFD1FAE5', 'FF065F46');
    addSummaryRow('Total  (Secured + Awarded)', totalByMonth, 'FF1E293B', 'FFFFFFFF', true);
    ws.addRow([]);
    addSummaryRow('Weighted Pursuits', pursuits, 'FFFEF3C7', 'FF92400E');
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];

    // ── Sheet 2: Secured Projects ────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Secured Projects');
    ws2.columns = [
      { width: 14 }, { width: 32 }, { width: 22 }, { width: 10 },
      { width: 12 }, { width: 8 },
      ...columns.map(() => ({ width: 12 })),
      { width: 14 },
    ];
    const hdr2 = ws2.addRow(['Contract #', 'Description', 'Project Manager', 'Dept', 'Backlog', '%', ...columns.map(c => c.label), 'Total']);
    hdr2.height = 20;
    hdr2.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      cell.alignment = { horizontal: col <= 4 ? 'left' : 'right', vertical: 'middle' };
    });
    for (const p of secured_projects) {
      const vals = columns.map(c => Math.round(p.monthly[c.key] || 0));
      const row = ws2.addRow([p.contract_number, p.description, p.project_manager_name, p.department_code, Math.round(p.backlog), p.pct_complete, ...vals, Math.round(p.total)]);
      row.height = 16;
      row.eachCell((cell, col) => {
        cell.font = { size: 9 };
        cell.alignment = { horizontal: col <= 4 ? 'left' : 'right' };
        if (col >= 5) cell.numFmt = col === 6 ? '0"%"' : currencyFmt;
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
      });
    }
    ws2.views = [{ state: 'frozen', xSplit: 4, ySplit: 1 }];

    // ── Sheet 3: Awarded Opportunities ──────────────────────────────────────
    const ws3 = wb.addWorksheet('Awarded');
    ws3.columns = [
      { width: 36 }, { width: 24 }, { width: 12 }, { width: 14 },
      ...columns.map(() => ({ width: 12 })),
      { width: 14 },
    ];
    const hdr3 = ws3.addRow(['Opportunity', 'Client', 'Stage', 'Full Value', ...columns.map(c => c.label), 'Total']);
    hdr3.height = 20;
    hdr3.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      cell.alignment = { horizontal: col <= 3 ? 'left' : 'right', vertical: 'middle' };
    });
    for (const p of awarded_projects) {
      const vals = columns.map(c => Math.round(p.monthly[c.key] || 0));
      const row = ws3.addRow([p.title, p.client, p.stage_name, Math.round(p.estimated_value), ...vals, Math.round(p.total)]);
      row.height = 16;
      row.eachCell((cell, col) => {
        cell.font = { size: 9 };
        cell.alignment = { horizontal: col <= 3 ? 'left' : 'right' };
        if (col >= 4) cell.numFmt = currencyFmt;
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
      });
    }
    ws3.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];

    // ── Sheet 4: Weighted Pursuits ───────────────────────────────────────────
    const ws4 = wb.addWorksheet('Weighted Pursuits');
    ws4.columns = [
      { width: 36 }, { width: 24 }, { width: 12 }, { width: 8 }, { width: 14 }, { width: 14 },
      ...columns.map(() => ({ width: 12 })),
      { width: 14 },
    ];
    const hdr4 = ws4.addRow(['Opportunity', 'Client', 'Stage', 'Prob%', 'Full Value', 'Weighted Value', ...columns.map(c => c.label), 'Total']);
    hdr4.height = 20;
    hdr4.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92400E' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      cell.alignment = { horizontal: col <= 3 ? 'left' : 'right', vertical: 'middle' };
    });
    for (const p of pursuit_projects) {
      const vals = columns.map(c => Math.round(p.monthly[c.key] || 0));
      const row = ws4.addRow([p.title, p.client, p.stage_name, p.probability_pct, Math.round(p.estimated_value), Math.round(p.weighted_value), ...vals, Math.round(p.total)]);
      row.height = 16;
      row.eachCell((cell, col) => {
        cell.font = { size: 9 };
        cell.alignment = { horizontal: col <= 3 ? 'left' : 'right' };
        if (col === 4) cell.numFmt = '0"%"';
        else if (col >= 5) cell.numFmt = currencyFmt;
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
      });
    }
    ws4.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Rolling-12-Revenue-${dateStr}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating rolling-12 excel:', err);
    res.status(500).json({ error: 'Failed to generate Excel export' });
  }
});

module.exports = router;
