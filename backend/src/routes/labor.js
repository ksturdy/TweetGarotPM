const express = require('express');
const ProjectAssignment = require('../models/ProjectAssignment');
const EmployeeTimeOff = require('../models/EmployeeTimeOff');
const LaborAccount = require('../models/LaborAccount');
const { getProjectEffectiveDates } = require('../utils/projectDates');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);
router.use(authorize('admin', 'manager'));

// GET /api/labor/projects/:projectId/default-dates
router.get('/projects/:projectId/default-dates', async (req, res, next) => {
  try {
    const dates = await getProjectEffectiveDates(req.params.projectId, req.tenantId);
    res.json(dates);
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/board — Labor Board grid data (1 row per active employee)
router.get('/board', async (req, res, next) => {
  try {
    const filters = {
      trade: req.query.trade || undefined,
      title: req.query.title || undefined,
      employee_group: req.query.group || undefined,
      profile_type: req.query.profile_type || undefined,
      search: req.query.search || undefined,
    };
    const rows = await ProjectAssignment.findAllForBoard(req.tenantId, filters);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/dashboard/summary — counts for the top stat cards
router.get('/dashboard/summary', async (req, res, next) => {
  try {
    const summary = await ProjectAssignment.summary(req.tenantId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

const applyEmployeeFilters = (rows, query) => {
  let filtered = rows;
  if (query.trade) {
    filtered = filtered.filter((r) => r.employee_trade === query.trade);
  }
  if (query.group) {
    filtered = filtered.filter((r) => r.employee_group === query.group);
  }
  if (query.title) {
    filtered = filtered.filter((r) => r.employee_title === query.title);
  }
  return filtered;
};

// GET /api/labor/headcount-chart?months=12 — monthly headcount by trade from project assignments
router.get('/headcount-chart', async (req, res, next) => {
  try {
    const months = Math.min(36, Math.max(3, parseInt(req.query.months || '12', 10)));
    const today = new Date(); today.setDate(1); today.setHours(0, 0, 0, 0);
    const from = today.toISOString().slice(0, 10);
    const toDate = new Date(today); toDate.setMonth(toDate.getMonth() + months);
    const to = toDate.toISOString().slice(0, 10);

    const rows = await ProjectAssignment.findByDateRange(req.tenantId, from, to);
    const active = rows.filter(r => r.status === 'active' || r.status === 'planned');

    // Build month keys for the window
    const monthKeys = [];
    const cur = new Date(today);
    for (let m = 0; m < months; m++) {
      monthKeys.push(cur.toISOString().slice(0, 7)); // YYYY-MM
      cur.setMonth(cur.getMonth() + 1);
    }

    // Trade key mapping
    const tradeKey = (trade) => {
      if (!trade) return 'other';
      const t = trade.toLowerCase();
      if (t.includes('pipefitter')) return 'pf';
      if (t.includes('sheet metal')) return 'sm';
      if (t.includes('plumb')) return 'pl';
      return 'other';
    };

    // Count distinct people per month per trade (one person = 1 headcount for any month they overlap)
    const buckets = new Map(); // monthKey -> { pf: Set<id>, sm: Set<id>, pl: Set<id>, other: Set<id> }
    for (const mk of monthKeys) buckets.set(mk, { pf: new Set(), sm: new Set(), pl: new Set(), other: new Set() });

    for (const row of active) {
      const assignStart = row.start_date ? new Date(row.start_date) : null;
      const assignEnd   = row.end_date   ? new Date(row.end_date)   : null;
      if (!assignStart) continue;
      const tk = tradeKey(row.employee_trade || row.trade);
      for (const mk of monthKeys) {
        const mStart = new Date(mk + '-01');
        const mEnd   = new Date(mStart); mEnd.setMonth(mEnd.getMonth() + 1); mEnd.setDate(mEnd.getDate() - 1);
        const overlapStart = assignStart <= mEnd;
        const overlapEnd   = !assignEnd || assignEnd >= mStart;
        if (overlapStart && overlapEnd) {
          buckets.get(mk)[tk].add(row.employee_id);
        }
      }
    }

    const result = monthKeys.map(mk => {
      const b = buckets.get(mk);
      const pf = b.pf.size; const sm = b.sm.size; const pl = b.pl.size; const other = b.other.size;
      return { month: mk, pf, sm, pl, other, total: pf + sm + pl + other };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&trade=&group=&title=
router.get('/calendar', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to query params required (YYYY-MM-DD)' });
    const rows = await ProjectAssignment.findByDateRange(req.tenantId, from, to);
    const filtered = applyEmployeeFilters(rows, req.query);
    res.json(filtered.map((r) => ({ ...r, ...computeEffectiveDates(r) })));
  } catch (error) {
    next(error);
  }
});

const PROJECT_DURATION_RULES = [
  { minValue: 0,        maxValue: 500000,   months: 3  },
  { minValue: 500000,   maxValue: 2000000,  months: 6  },
  { minValue: 2000000,  maxValue: 5000000,  months: 8  },
  { minValue: 5000000,  maxValue: 10000000, months: 12 },
  { minValue: 10000000, maxValue: Infinity,  months: 24 },
];
const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const getDuration = (val) => (PROJECT_DURATION_RULES.find((r) => val >= r.minValue && val < r.maxValue) || { months: 24 }).months;
const addMonths = (d, m) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r.toISOString().slice(0, 10); };

function computeEffectiveDates(row) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isoToday = today.toISOString().slice(0, 10);

  // effective start
  const project_start_date = row.contract_start_override
    ? new Date(row.contract_start_override).toISOString().slice(0, 10)
    : row.project_start_date
      ? new Date(row.project_start_date).toISOString().slice(0, 10)
      : isoToday;

  // effective end
  let project_end_date = null;
  if (row.contract_end_override) {
    project_end_date = new Date(row.contract_end_override).toISOString().slice(0, 10);
  } else if (row.contract_amount) {
    const contractValue = parseNum(row.contract_amount) || parseNum(row.projected_revenue);
    if (contractValue > 0) {
      const pct = parseNum(row.projected_revenue) > 0 ? parseNum(row.earned_revenue) / parseNum(row.projected_revenue) : 0;
      const remaining = Math.max(1, Math.min(36, Math.ceil(getDuration(contractValue) * (1 - pct))));
      project_end_date = addMonths(today, remaining);
    }
  }
  if (!project_end_date && row.project_end_date) {
    project_end_date = new Date(row.project_end_date).toISOString().slice(0, 10);
  }

  return { project_start_date, project_end_date };
}

// GET /api/labor/employees/:employeeId/history — all non-cancelled assignments for resume building
router.get('/employees/:employeeId/history', async (req, res, next) => {
  try {
    const employeeId = parseInt(req.params.employeeId, 10);
    if (!employeeId) return res.status(400).json({ error: 'Invalid employeeId' });
    const rows = await ProjectAssignment.findHistoryByEmployee(employeeId, req.tenantId);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/assignments?status=&search=&from=&to=&trade=&group=&title= — flat list
router.get('/assignments', async (req, res, next) => {
  try {
    const from = req.query.from || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const to = req.query.to || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    const rows = await ProjectAssignment.findByDateRange(req.tenantId, from, to);

    let filtered = applyEmployeeFilters(rows, req.query);
    if (req.query.status) {
      filtered = filtered.filter((r) => r.status === req.query.status);
    }
    if (req.query.search) {
      const s = String(req.query.search).toLowerCase();
      filtered = filtered.filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(s) ||
          (r.project_name || '').toLowerCase().includes(s) ||
          (r.role || '').toLowerCase().includes(s)
      );
    }
    if (req.query.project) {
      const s = String(req.query.project).toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.project_name || '').toLowerCase().includes(s) ||
          (r.project_number || '').toLowerCase().includes(s)
      );
    }
    res.json(filtered.map((r) => ({ ...r, ...computeEffectiveDates(r) })));
  } catch (error) {
    next(error);
  }
});

// ── Labor account routes (/api/labor/accounts) ─────────────────────────

// GET /api/labor/accounts
router.get('/accounts', async (req, res, next) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const rows = await LaborAccount.findAll(req.tenantId, includeInactive);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/accounts/:id
router.get('/accounts/:id', async (req, res, next) => {
  try {
    const row = await LaborAccount.findById(req.params.id, req.tenantId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

// POST /api/labor/accounts
router.post('/accounts', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const row = await LaborAccount.create(req.body, req.tenantId, req.user.id);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/labor/accounts/:id
router.patch('/accounts/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const updated = await LaborAccount.updateById(req.params.id, req.tenantId, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/labor/accounts/:id
router.delete('/accounts/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const deleted = await LaborAccount.deleteById(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted });
  } catch (error) {
    next(error);
  }
});

// POST /api/labor/accounts/:accountId/assign  (assign a crew member to an account)
router.post('/accounts/:accountId/assign', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const account = await LaborAccount.findById(accountId, req.tenantId);
    if (!account) return res.status(404).json({ error: 'Labor account not found' });

    const assignment = await ProjectAssignment.addToAccount({
      employeeId: req.body.employeeId,
      laborAccountId: accountId,
      trade: req.body.trade,
      role: req.body.role,
      startDate: req.body.startDate || req.body.start_date,
      endDate: req.body.endDate || req.body.end_date,
      shiftPattern: req.body.shiftPattern || req.body.shift_pattern,
      shiftStartTime: req.body.shiftStartTime || req.body.shift_start_time,
      shiftEndTime: req.body.shiftEndTime || req.body.shift_end_time,
      status: req.body.status,
      notes: req.body.notes,
      tags: req.body.tags,
    }, req.tenantId, req.user.id);

    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
});

// ── Time-off routes (/api/labor/time-off) ──────────────────────────────

// GET /api/labor/time-off?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/time-off', async (req, res, next) => {
  try {
    const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to   = req.query.to   || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const rows = await EmployeeTimeOff.findByDateRange(req.tenantId, from, to);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/time-off/employee/:employeeId
router.get('/time-off/employee/:employeeId', async (req, res, next) => {
  try {
    const rows = await EmployeeTimeOff.findByEmployee(req.params.employeeId, req.tenantId);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/labor/time-off
router.post('/time-off', async (req, res, next) => {
  try {
    const { employeeId, type, startDate, endDate, notes } = req.body;
    if (!employeeId || !type || !startDate || !endDate) {
      return res.status(400).json({ error: 'employeeId, type, startDate, endDate are required' });
    }
    const row = await EmployeeTimeOff.create(
      { employeeId, type, startDate, endDate, notes },
      req.tenantId,
      req.user.id
    );
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/labor/time-off/:id
router.patch('/time-off/:id', async (req, res, next) => {
  try {
    const updated = await EmployeeTimeOff.updateById(req.params.id, req.tenantId, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/labor/time-off/:id
router.delete('/time-off/:id', async (req, res, next) => {
  try {
    const deleted = await EmployeeTimeOff.deleteById(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
