/**
 * Server-side port of the projection logic in:
 *   frontend/src/pages/projects/LaborForecast.tsx
 *   frontend/src/pages/projects/ProjectedRevenue.tsx
 *
 * Provides shared filtering + month-bucket distribution for both reports so the
 * scheduled-reports runner can produce identical numbers without the browser.
 */

const VistaData = require('../models/VistaData');
const Team = require('../models/Team');
const { getContourMultipliers } = require('./phaseScheduleContours');
const { LOCATION_GROUPS } = require('../constants/locationGroups');

const TRADES = [
  { key: 'pf', label: 'PF', color: '#3b82f6' },
  { key: 'sm', label: 'SM', color: '#8b5cf6' },
  { key: 'pl', label: 'PL', color: '#f59e0b' },
];

const DEFAULT_DURATION_RULES = [
  { minValue: 0,         maxValue: 500000,    months: 3,  label: '$0 - $500K' },
  { minValue: 500000,    maxValue: 2000000,   months: 6,  label: '$500K - $2M' },
  { minValue: 2000000,   maxValue: 5000000,   months: 8,  label: '$2M - $5M' },
  { minValue: 5000000,   maxValue: 10000000,  months: 12, label: '$5M - $10M' },
  { minValue: 10000000,  maxValue: Infinity,  months: 24, label: '$10M+' },
];

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function getDurationForValue(contractValue, rules = DEFAULT_DURATION_RULES) {
  for (const r of rules) {
    if (contractValue >= r.minValue && contractValue < r.maxValue) return r.months;
  }
  return 24;
}

function getDefaultContour(pctComplete) {
  if (pctComplete < 15) return 'scurve';
  if (pctComplete < 40) return 'bell';
  if (pctComplete < 70) return 'back';
  if (pctComplete < 90) return 'rampdown';
  return 'flat';
}

function getLocationGroup(departmentCode) {
  if (!departmentCode) return null;
  for (const g of LOCATION_GROUPS) {
    if (departmentCode.startsWith(g.prefix)) return g.value;
  }
  return null;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatYYYYMM(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(date) {
  const m = date.toLocaleDateString('en-US', { month: 'short' });
  const y = String(date.getFullYear()).slice(2);
  return `${m} ${y}`;
}

/**
 * Resolve a team_id filter to the set of PM-name patterns to match.
 * Returns lowercased "First Last" strings.
 */
async function resolveTeamPmNames(teamId, tenantId) {
  if (!teamId) return null;
  const members = await Team.getMembers(Number(teamId), tenantId);
  const names = new Set();
  for (const m of members) {
    const full = `${m.first_name || ''} ${m.last_name || ''}`.trim().toLowerCase();
    if (full) names.add(full);
  }
  return names;
}

/**
 * Given a Vista PM name (format: "Last, First M") and a set of team-member names
 * (format: "First Last"), return true if the PM is on the team.
 */
function pmInTeam(pmName, teamMemberNames) {
  if (!pmName || !teamMemberNames || teamMemberNames.size === 0) return false;
  const pm = pmName.toLowerCase();
  for (const name of teamMemberNames) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      const reversed = `${parts[parts.length - 1]}, ${parts[0]}`;
      if (pm.startsWith(reversed)) return true;
    }
    if (pm === name) return true;
  }
  return false;
}

/**
 * Apply scheduled-report filter set to a list of Vista contracts.
 * Filters supported (all optional):
 *   status:           'all' | 'Open' | 'Soft-Closed'
 *   departments:      string[] of department codes
 *   locationGroups:   string[] of LOCATION_GROUP values (NEW/CW/WW/AZ)
 *   market:           string
 *   pm:               string (exact match on project_manager_name)
 *   teamMemberNames:  Set<string> of "first last" lowercased
 *   search:           string
 *   projects:         string[] of contract numbers
 */
function filterContracts(contracts, filters) {
  const status = filters.status || 'all';
  const departments = filters.departments || [];
  const locationGroups = filters.locationGroups || [];
  const market = filters.market || '';
  const pm = filters.pm || '';
  const teamMemberNames = filters.teamMemberNames || null;
  const search = (filters.search || '').toLowerCase();
  const projects = filters.projects || [];

  return contracts.filter(c => {
    const cstatus = (c.status || '').toLowerCase();
    if (status === 'all') {
      if (!cstatus.includes('open') && !cstatus.includes('soft')) return false;
    } else if (status === 'Open') {
      if (!cstatus.includes('open')) return false;
    } else if (status === 'Soft-Closed') {
      if (!cstatus.includes('soft')) return false;
    }
    if (departments.length > 0 && (!c.department_code || !departments.includes(c.department_code))) return false;
    if (locationGroups.length > 0) {
      const g = getLocationGroup(c.department_code);
      if (!g || !locationGroups.includes(g)) return false;
    }
    if (market && c.primary_market !== market) return false;
    if (pm && c.project_manager_name !== pm) return false;
    if (teamMemberNames && !pmInTeam(c.project_manager_name, teamMemberNames)) return false;
    if (search) {
      const m1 = (c.contract_number || '').toLowerCase().includes(search);
      const m2 = (c.description || '').toLowerCase().includes(search);
      const m3 = (c.customer_name || '').toLowerCase().includes(search);
      if (!m1 && !m2 && !m3) return false;
    }
    if (projects.length > 0 && !projects.includes(c.contract_number)) return false;
    return true;
  });
}

/**
 * Build columns (next N months, YYYY-MM keys + "MMM yy" labels)
 */
function buildMonthColumns(timeHorizon) {
  const now = startOfMonth(new Date());
  const cols = [];
  for (let i = 0; i < timeHorizon; i++) {
    const date = addMonths(now, i);
    cols.push({ key: formatYYYYMM(date), label: formatMonthLabel(date) });
  }
  return cols;
}

/**
 * Build columns for the Projected Revenue report:
 * 12 months individually + yearly buckets out to current year + 3 (matches frontend behavior).
 */
function buildRevenueColumns() {
  const cols = [];
  const now = startOfMonth(new Date());
  const twelveOut = addMonths(now, 11);
  for (let i = 0; i < 12; i++) {
    const d = addMonths(now, i);
    cols.push({ key: formatYYYYMM(d), label: formatMonthLabel(d), isYear: false });
  }
  const currentYear = now.getFullYear();
  const maxYear = currentYear + 3;
  for (let y = currentYear; y <= maxYear; y++) {
    const lastMonth = new Date(y, 11, 1);
    if (lastMonth > twelveOut) {
      cols.push({ key: String(y), label: String(y), isYear: true });
    }
  }
  return cols;
}

/**
 * Build the labor forecast projection set (one row per contract with remaining hours).
 * Mirrors the `projections` useMemo in LaborForecast.tsx.
 */
function buildLaborProjections(contracts, shopFieldRows, filters, opts) {
  const locationFilter = opts.locationFilter || 'both'; // 'both' | 'shop' | 'field'
  const tradeFilter = new Set(opts.tradeFilter || ['pf', 'sm', 'pl']);
  const durationRules = opts.durationRules || DEFAULT_DURATION_RULES;
  const timeHorizon = opts.timeHorizon || 12;
  const now = startOfMonth(new Date());

  // Build shop/field map: contract_number -> trade -> { shop: {...}, field: {...} }
  const sfMap = new Map();
  for (const row of shopFieldRows) {
    if (!sfMap.has(row.contract_number)) sfMap.set(row.contract_number, {});
    const byTrade = sfMap.get(row.contract_number);
    if (!byTrade[row.trade]) byTrade[row.trade] = {};
    byTrade[row.trade][row.location] = {
      est: parseNum(row.est_hours),
      jtd: parseNum(row.jtd_hours),
      est_cost: parseNum(row.est_cost),
      jtd_cost: parseNum(row.jtd_cost),
      projected_cost: parseNum(row.projected_cost),
    };
  }

  const filtered = filterContracts(contracts, filters);
  const projections = [];

  for (const contract of filtered) {
    const earnedRevenue = parseNum(contract.earned_revenue);
    const projectedRevenue = parseNum(contract.projected_revenue);
    const backlog = parseNum(contract.backlog);
    const contractValue = parseNum(contract.contract_amount) || projectedRevenue;
    const sfData = sfMap.get(contract.contract_number);

    const tradeHours = TRADES.map(trade => {
      const td = sfData ? sfData[trade.key] : null;
      if (!td) return { key: trade.key, remaining: 0 };

      const estHours = (td.shop?.est || 0) + (td.field?.est || 0);
      const jtdHours = (td.shop?.jtd || 0) + (td.field?.jtd || 0);
      const estCost = (td.shop?.est_cost || 0) + (td.field?.est_cost || 0);
      const jtdCost = (td.shop?.jtd_cost || 0) + (td.field?.jtd_cost || 0);
      const projCost = (td.shop?.projected_cost || 0) + (td.field?.projected_cost || 0);

      let projectedHours;
      if (projCost > 0) {
        const rate = jtdHours > 0 ? jtdCost / jtdHours : (estHours > 0 ? estCost / estHours : 0);
        projectedHours = rate > 0 ? projCost / rate : estHours;
      } else {
        projectedHours = estHours;
      }
      const fullRemaining = Math.max(0, projectedHours - jtdHours);

      if (locationFilter === 'both') return { key: trade.key, remaining: fullRemaining };

      const estShop = td.shop?.est || 0;
      const estField = td.field?.est || 0;
      const estTotal = estShop + estField;
      let proportion;
      if (estTotal > 0) {
        proportion = locationFilter === 'shop' ? estShop / estTotal : estField / estTotal;
      } else {
        const jtdShop = td.shop?.jtd || 0;
        const jtdField = td.field?.jtd || 0;
        const jtdTotal = jtdShop + jtdField;
        proportion = jtdTotal > 0
          ? (locationFilter === 'shop' ? jtdShop / jtdTotal : jtdField / jtdTotal)
          : 0;
      }
      return { key: trade.key, remaining: fullRemaining * proportion };
    });

    const totalRemainingHours = tradeHours.reduce((s, t) => s + t.remaining, 0);
    if (totalRemainingHours <= 0) continue;

    const startOffset = parseNum(contract.user_adjusted_start_months) || 0;
    const userEnd = contract.user_adjusted_end_months;
    let endOffset;
    if (userEnd != null) {
      endOffset = Math.max(startOffset + 1, Math.min(36, userEnd));
    } else if (backlog > 0) {
      const totalDuration = getDurationForValue(contractValue, durationRules);
      const pct = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
      const monthsRemaining = Math.ceil(totalDuration * (1 - pct));
      endOffset = startOffset + Math.max(1, Math.min(36, monthsRemaining));
    } else {
      endOffset = startOffset + 3;
    }

    const remainingMonths = endOffset - startOffset;
    const pctComplete = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
    const contour = contract.user_selected_contour || getDefaultContour(pctComplete);

    const monthlyHours = new Map();
    if (remainingMonths > 0) {
      const multipliers = getContourMultipliers(remainingMonths, contour);
      for (let i = 0; i < remainingMonths; i++) {
        const monthDate = addMonths(now, startOffset + i);
        const monthKey = formatYYYYMM(monthDate);
        const pfHrs = (tradeHours[0].remaining / remainingMonths) * multipliers[i];
        const smHrs = (tradeHours[1].remaining / remainingMonths) * multipliers[i];
        const plHrs = (tradeHours[2].remaining / remainingMonths) * multipliers[i];
        const existing = monthlyHours.get(monthKey) || { pf: 0, sm: 0, pl: 0, total: 0 };
        monthlyHours.set(monthKey, {
          pf: existing.pf + pfHrs,
          sm: existing.sm + smHrs,
          pl: existing.pl + plHrs,
          total: existing.total + pfHrs + smHrs + plHrs,
        });
      }
    }

    projections.push({
      contract,
      startOffset,
      remainingMonths,
      contour,
      pctComplete,
      tradeHours,
      totalRemainingHours,
      monthlyHours,
    });
  }

  // Sort by remaining hours descending
  projections.sort((a, b) => b.totalRemainingHours - a.totalRemainingHours);

  // Build column totals (apply trade filter)
  const columns = buildMonthColumns(timeHorizon);
  const columnTotals = new Map();
  for (const col of columns) {
    const agg = { pf: 0, sm: 0, pl: 0, total: 0 };
    for (const p of projections) {
      const h = p.monthlyHours.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
      const pf = tradeFilter.has('pf') ? h.pf : 0;
      const sm = tradeFilter.has('sm') ? h.sm : 0;
      const pl = tradeFilter.has('pl') ? h.pl : 0;
      agg.pf += pf; agg.sm += sm; agg.pl += pl; agg.total += pf + sm + pl;
    }
    columnTotals.set(col.key, agg);
  }

  const grandTotalsByTrade = { pf: 0, sm: 0, pl: 0 };
  for (const p of projections) {
    for (const t of p.tradeHours) {
      if (tradeFilter.has(t.key)) grandTotalsByTrade[t.key] += t.remaining;
    }
  }
  const grandTotalHours = grandTotalsByTrade.pf + grandTotalsByTrade.sm + grandTotalsByTrade.pl;

  return { projections, columns, columnTotals, grandTotalsByTrade, grandTotalHours, tradeFilter: Array.from(tradeFilter) };
}

/**
 * Build the projected revenue projection set.
 * Mirrors the `projections` useMemo in ProjectedRevenue.tsx.
 */
function buildRevenueProjections(contracts, filters, opts) {
  const durationRules = opts.durationRules || DEFAULT_DURATION_RULES;
  const now = startOfMonth(new Date());
  const filtered = filterContracts(contracts, filters);
  const projections = [];

  for (const contract of filtered) {
    const earnedRevenue = parseNum(contract.earned_revenue);
    const projectedRevenue = parseNum(contract.projected_revenue);
    const backlog = parseNum(contract.backlog);
    const contractValue = parseNum(contract.contract_amount) || projectedRevenue;

    const startOffset = parseNum(contract.user_adjusted_start_months) || 0;
    const userEnd = contract.user_adjusted_end_months;

    let remainingMonths = 0;
    let monthlyBurnRate = 0;
    let projectedEndDate = null;

    if (backlog > 0) {
      if (userEnd != null) {
        const endMonths = Math.max(1, Math.min(36, userEnd));
        remainingMonths = Math.max(1, endMonths - startOffset);
      } else {
        const totalDuration = getDurationForValue(contractValue, durationRules);
        const pct = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
        const monthsRemaining = Math.ceil(totalDuration * (1 - pct));
        remainingMonths = Math.max(1, Math.min(36, monthsRemaining));
      }
      monthlyBurnRate = backlog / remainingMonths;
      projectedEndDate = addMonths(now, startOffset + remainingMonths);
    }

    const pctComplete = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
    const contour = contract.user_selected_contour || getDefaultContour(pctComplete);
    const monthlyRevenue = new Map();
    const twelveOut = addMonths(now, 11);

    if (backlog > 0 && remainingMonths > 0) {
      const multipliers = getContourMultipliers(remainingMonths, contour);
      const baseMonthly = backlog / remainingMonths;
      for (let i = 0; i < remainingMonths; i++) {
        const monthDate = addMonths(now, startOffset + i);
        const monthKey = formatYYYYMM(monthDate);
        const yearKey = String(monthDate.getFullYear());
        const monthRevenue = baseMonthly * multipliers[i];
        monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + monthRevenue);
        if (monthDate > twelveOut) {
          monthlyRevenue.set(yearKey, (monthlyRevenue.get(yearKey) || 0) + monthRevenue);
        }
      }
    }

    projections.push({
      contract,
      startOffset,
      monthlyBurnRate,
      remainingMonths,
      projectedEndDate,
      monthlyRevenue,
      contour,
      pctComplete,
    });
  }

  projections.sort((a, b) => parseNum(b.contract.backlog) - parseNum(a.contract.backlog));

  const columns = buildRevenueColumns();
  const columnTotals = new Map();
  for (const col of columns) {
    let total = 0;
    for (const p of projections) total += p.monthlyRevenue.get(col.key) || 0;
    columnTotals.set(col.key, total);
  }
  const grandTotal = projections.reduce((s, p) => s + parseNum(p.contract.backlog), 0);

  return { projections, columns, columnTotals, grandTotal };
}

/**
 * High-level entry points used by the scheduled-report runner.
 * Resolves Vista data + team membership and runs the projection.
 */
async function buildLaborForecastData(tenantId, rawFilters) {
  const filters = await prepareFilters(rawFilters, tenantId);
  const [contracts, shopFieldRows] = await Promise.all([
    VistaData.getAllContracts({}, tenantId),
    VistaData.getShopFieldHoursByContract(tenantId),
  ]);
  const opts = {
    locationFilter: rawFilters.locationFilter || 'both',
    tradeFilter: rawFilters.tradeFilter || ['pf', 'sm', 'pl'],
    timeHorizon: rawFilters.timeHorizon || 12,
  };
  return buildLaborProjections(contracts, shopFieldRows, filters, opts);
}

async function buildProjectedRevenueData(tenantId, rawFilters) {
  const filters = await prepareFilters(rawFilters, tenantId);
  const contracts = await VistaData.getAllContracts({}, tenantId);
  return buildRevenueProjections(contracts, filters, {});
}

/**
 * Resolve raw scheduled-report filter object → internal filter object,
 * including team_id → teamMemberNames lookup.
 */
async function prepareFilters(raw, tenantId) {
  const out = {
    status: raw.status || 'all',
    departments: Array.isArray(raw.departments) ? raw.departments : [],
    locationGroups: Array.isArray(raw.locationGroups) ? raw.locationGroups : [],
    market: raw.market || '',
    pm: raw.pm || '',
    search: raw.search || '',
    projects: Array.isArray(raw.projects) ? raw.projects : [],
  };
  if (raw.team) {
    out.teamMemberNames = await resolveTeamPmNames(raw.team, tenantId);
  }
  return out;
}

module.exports = {
  TRADES,
  DEFAULT_DURATION_RULES,
  parseNum,
  getDurationForValue,
  getDefaultContour,
  getLocationGroup,
  buildLaborForecastData,
  buildProjectedRevenueData,
  buildLaborProjections,
  buildRevenueProjections,
  buildMonthColumns,
  buildRevenueColumns,
  prepareFilters,
};
