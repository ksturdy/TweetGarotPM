/**
 * Generate HTML for the Project Manager Report PDF (server-side, Puppeteer).
 */

const fmt$ = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '$0';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3).toLocaleString('en-US')}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmtPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(1)}%`;
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HEALTH_STYLE = {
  red:    { color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', label: 'At Risk' },
  yellow: { color: '#b45309', bg: '#fffbeb', border: '#fcd34d', label: 'Watch' },
  green:  { color: '#15803d', bg: '#f0fdf4', border: '#86efac', label: 'Healthy' },
};

function healthPill(level, opts = {}) {
  const m = HEALTH_STYLE[level] || HEALTH_STYLE.green;
  const fontSize = opts.compact ? '7pt' : '8pt';
  const padding = opts.compact ? '1px 5px' : '2px 7px';
  return `<span style="display:inline-block; background:${m.bg}; color:${m.color}; border:1px solid ${m.border}; border-radius:9999px; font-size:${fontSize}; font-weight:600; padding:${padding}; text-transform:uppercase; letter-spacing:0.03em;">${m.label}</span>`;
}

function deltaCell(value, format = 'money') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '<span style="color:#94a3b8">—</span>';
  }
  const v = Number(value);
  const isFlat = Math.abs(v) < (format === 'pp' ? 0.05 : 1);
  const color = isFlat ? '#64748b' : (v > 0 ? '#15803d' : '#b91c1c');
  const arrow = isFlat ? '→' : (v > 0 ? '▲' : '▼');
  const text = format === 'pp'
    ? `${v > 0 ? '+' : ''}${v.toFixed(2)}pp`
    : `${v > 0 ? '+' : '-'}${fmt$(Math.abs(v))}`;
  return `<span style="color:${color}; font-weight:600; white-space:nowrap;">${arrow} ${text}</span>`;
}

function buildFilterLabels(filters) {
  const labels = [];
  if (filters?.pm_keys?.length) labels.push(`${filters.pm_keys.length} PM${filters.pm_keys.length === 1 ? '' : 's'} selected`);
  if (filters?.departments?.length) labels.push(`Dept: ${filters.departments.join(', ')}`);
  if (filters?.health) labels.push(`Health: ${filters.health}`);
  return labels;
}

function generateCoverPage(data, scheduleName) {
  const { pms, filters, meta } = data;
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Aggregate totals across all PMs in scope
  const totals = pms.reduce((acc, p) => {
    acc.activeJobs += p.totals.activeJobs;
    acc.contractAmount += p.totals.contractAmount;
    acc.projectedRevenue += p.totals.projectedRevenue;
    acc.earnedRevenue += p.totals.earnedRevenue;
    acc.projectedCost += p.totals.projectedCost;
    acc.estimatedCost += p.totals.estimatedCost;
    acc.backlog += p.totals.backlog;
    acc.openReceivables += p.totals.openReceivables;
    acc.cashFlow += p.totals.cashFlow;
    acc.greenJobs += p.healthCounts.green;
    acc.yellowJobs += p.healthCounts.yellow;
    acc.redJobs += p.healthCounts.red;
    return acc;
  }, { activeJobs: 0, contractAmount: 0, projectedRevenue: 0, earnedRevenue: 0, projectedCost: 0, estimatedCost: 0, backlog: 0, openReceivables: 0, cashFlow: 0, greenJobs: 0, yellowJobs: 0, redJobs: 0 });

  const aggGpPct = totals.projectedRevenue > 0
    ? (totals.projectedRevenue - totals.projectedCost) / totals.projectedRevenue * 100
    : 0;
  const aggCostVar = totals.estimatedCost > 0
    ? (totals.projectedCost - totals.estimatedCost) / totals.estimatedCost * 100
    : 0;

  const pmHealthCounts = pms.reduce((acc, p) => {
    acc[p.overallHealth] += 1;
    return acc;
  }, { red: 0, yellow: 0, green: 0 });

  const filterLabels = buildFilterLabels(filters);
  const filterStr = filterLabels.length ? `Filters: ${filterLabels.join('  |  ')}` : 'All PMs · All Departments';

  const kpi = (label, value, color) => `
    <div style="flex:1; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; min-width:0;">
      <div style="font-size:7pt; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; white-space:nowrap;">${label}</div>
      <div style="font-size:14pt; font-weight:700; color:${color || '#0f172a'}; white-space:nowrap; margin-top:2px;">${value}</div>
    </div>`;

  // Per-PM scorecard rows for cover page
  const cp = '6px 7px';
  const fs = '8.5pt';
  const scorecardRows = pms.map((pm, i) => {
    const m = HEALTH_STYLE[pm.overallHealth];
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    return `
      <tr style="background:${bg};">
        <td style="padding:${cp}; font-size:${fs}; font-weight:600; color:#1e293b; white-space:nowrap;">${esc(pm.pmName)}</td>
        <td style="padding:${cp}; font-size:${fs}; color:#64748b; white-space:nowrap;">${esc(pm.departmentName || '—')}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:center;">${healthPill(pm.overallHealth, { compact: true })}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:center; color:#334155;">${pm.totals.activeJobs}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:center;">
          <span style="color:#15803d; font-weight:600;">${pm.healthCounts.green}</span>
          <span style="color:#cbd5e1; margin:0 4px;">/</span>
          <span style="color:#b45309; font-weight:600;">${pm.healthCounts.yellow}</span>
          <span style="color:#cbd5e1; margin:0 4px;">/</span>
          <span style="color:#b91c1c; font-weight:600;">${pm.healthCounts.red}</span>
        </td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right; font-weight:500;">${fmt$(pm.totals.contractAmount)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right; color:${pm.totals.aggregateGrossProfitPct < 0 ? '#b91c1c' : '#15803d'}; font-weight:600;">${fmtPct(pm.totals.aggregateGrossProfitPct)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right; color:${pm.totals.aggregateCostVariance > 0.05 ? '#b91c1c' : pm.totals.aggregateCostVariance > 0 ? '#b45309' : '#15803d'}; font-weight:500;">${fmtPct(pm.totals.aggregateCostVariance * 100)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right;">${fmt$(pm.totals.backlog)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right; color:${pm.totals.cashFlow < 0 ? '#b91c1c' : '#15803d'}; font-weight:600;">${fmt$(pm.totals.cashFlow)}</td>
      </tr>`;
  }).join('');

  return `
    <div style="page-break-after: always;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #1e293b; padding-bottom:8px; margin-bottom:14px;">
        <div>
          <div style="font-size:9pt; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Tweet Garot Mechanical</div>
          <div style="font-size:22pt; font-weight:700; color:#0f172a; margin-top:2px;">Project Manager Report</div>
          ${scheduleName ? `<div style="font-size:10pt; color:#475569; margin-top:4px;">${esc(scheduleName)}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:10pt; color:#475569; font-weight:500;">${dateLabel}</div>
          <div style="font-size:8pt; color:#94a3b8; margin-top:2px;">${filterStr}</div>
        </div>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:14px;">
        ${kpi('PMs in Scope', String(meta.pmCount))}
        ${kpi('Open Jobs', String(meta.activeJobsCounted))}
        ${kpi('Contract Value', fmt$(totals.contractAmount))}
        ${kpi('Projected Rev', fmt$(totals.projectedRevenue))}
        ${kpi('Aggregate GP%', fmtPct(aggGpPct), aggGpPct < 0 ? '#b91c1c' : '#15803d')}
        ${kpi('Backlog', fmt$(totals.backlog))}
        ${kpi('Net Cash Flow', fmt$(totals.cashFlow), totals.cashFlow < 0 ? '#b91c1c' : '#15803d')}
      </div>

      <div style="display:flex; gap:10px; margin-bottom:14px;">
        <div style="flex:1; background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; padding:8px 12px;">
          <div style="font-size:7pt; color:#b91c1c; font-weight:700; text-transform:uppercase;">PMs At Risk</div>
          <div style="font-size:16pt; font-weight:700; color:#b91c1c;">${pmHealthCounts.red}</div>
          <div style="font-size:7.5pt; color:#7f1d1d; margin-top:2px;">${totals.redJobs} red job${totals.redJobs === 1 ? '' : 's'} across portfolio</div>
        </div>
        <div style="flex:1; background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:8px 12px;">
          <div style="font-size:7pt; color:#b45309; font-weight:700; text-transform:uppercase;">PMs to Watch</div>
          <div style="font-size:16pt; font-weight:700; color:#b45309;">${pmHealthCounts.yellow}</div>
          <div style="font-size:7.5pt; color:#78350f; margin-top:2px;">${totals.yellowJobs} yellow job${totals.yellowJobs === 1 ? '' : 's'}</div>
        </div>
        <div style="flex:1; background:#f0fdf4; border:1px solid #86efac; border-radius:6px; padding:8px 12px;">
          <div style="font-size:7pt; color:#15803d; font-weight:700; text-transform:uppercase;">Healthy PMs</div>
          <div style="font-size:16pt; font-weight:700; color:#15803d;">${pmHealthCounts.green}</div>
          <div style="font-size:7.5pt; color:#14532d; margin-top:2px;">${totals.greenJobs} healthy job${totals.greenJobs === 1 ? '' : 's'}</div>
        </div>
        <div style="flex:1; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px;">
          <div style="font-size:7pt; color:#475569; font-weight:700; text-transform:uppercase;">Cost Variance</div>
          <div style="font-size:16pt; font-weight:700; color:${aggCostVar > 5 ? '#b91c1c' : aggCostVar > 0 ? '#b45309' : '#15803d'};">${fmtPct(aggCostVar)}</div>
          <div style="font-size:7.5pt; color:#475569; margin-top:2px;">Projected vs Estimated</div>
        </div>
      </div>

      <div style="font-size:11pt; font-weight:700; color:#0f172a; margin-bottom:6px;">PM Scorecard</div>
      <table style="width:100%; border-collapse:collapse; background:#fff; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden;">
        <thead>
          <tr style="background:#1e293b; color:#fff;">
            <th style="padding:${cp}; font-size:7.5pt; text-align:left; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">PM</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:left; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Department</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:center; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Health</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:center; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Jobs</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:center; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">G/Y/R</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:right; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Contract $</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:right; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">GP %</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:right; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Cost Var</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:right; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Backlog</th>
            <th style="padding:${cp}; font-size:7.5pt; text-align:right; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Cash Flow</th>
          </tr>
        </thead>
        <tbody>${scorecardRows || `<tr><td colspan="10" style="padding:20px; text-align:center; color:#94a3b8; font-size:9pt;">No PMs match the current filters.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function generatePMSection(pm, index) {
  const m = HEALTH_STYLE[pm.overallHealth];
  const cp = '5px 6px';
  const fs = '7.5pt';

  const jobRows = pm.jobs.map((j, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const wow = j.trend?.weekOverWeek;
    const wowGp = wow ? deltaCell(wow.grossProfitPct, 'pp') : '<span style="color:#94a3b8">—</span>';
    const wowCost = wow ? deltaCell(wow.projectedCost) : '<span style="color:#94a3b8">—</span>';
    const wowBacklog = wow ? deltaCell(wow.backlog) : '<span style="color:#94a3b8">—</span>';

    return `
      <tr style="background:${bg};">
        <td style="padding:${cp}; font-size:${fs}; text-align:center;">${healthPill(j.health, { compact: true })}</td>
        <td style="padding:${cp}; font-size:${fs};">
          <div style="font-weight:600; color:#0f172a;">${esc(j.contractNumber)}</div>
          <div style="font-size:6.5pt; color:#64748b; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(j.description || '—')}</div>
        </td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right;">${fmt$(j.contractAmount)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right;">${fmtPct(j.pctComplete * 100)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right; color:${j.grossProfitPercent < j.originalEstimatedMarginPct ? '#b91c1c' : '#15803d'}; font-weight:600;">
          ${fmtPct(j.grossProfitPercent)}
          <div style="font-size:6pt; color:#94a3b8; font-weight:400;">orig ${fmtPct(j.originalEstimatedMarginPct)}</div>
        </td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right; color:${j.costVariance > 0.05 ? '#b91c1c' : j.costVariance > 0 ? '#b45309' : '#15803d'}; font-weight:600;">${fmtPct(j.costVariance * 100)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right; color:${j.overUnderBilled < 0 ? '#b91c1c' : j.overUnderBilled > 0 ? '#0891b2' : '#64748b'};">${fmt$(j.overUnderBilled)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right;">${fmt$(j.backlog)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:right; color:${j.cashFlow < 0 ? '#b91c1c' : '#15803d'};">${fmt$(j.cashFlow)}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:center;">${wowGp}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:center;">${wowCost}</td>
        <td style="padding:${cp}; font-size:${fs}; text-align:center;">${wowBacklog}</td>
      </tr>`;
  }).join('');

  const issueJobs = pm.jobs.filter(j => j.health !== 'green');
  const issuesList = issueJobs.length > 0
    ? `<div style="background:#fef9c3; border:1px solid #fde68a; border-radius:6px; padding:8px 12px; margin-top:8px;">
         <div style="font-size:8pt; font-weight:700; color:#854d0e; text-transform:uppercase; letter-spacing:0.03em; margin-bottom:4px;">Jobs Requiring Attention</div>
         ${issueJobs.slice(0, 8).map(j => `
           <div style="font-size:8pt; color:#1e293b; margin-bottom:3px;">
             <strong style="color:${HEALTH_STYLE[j.health].color};">[${HEALTH_STYLE[j.health].label}]</strong>
             ${esc(j.contractNumber)} — ${esc(j.description || '')}
             <span style="color:#64748b;">${j.healthReasons.length ? '· ' + esc(j.healthReasons.join('; ')) : ''}</span>
           </div>
         `).join('')}
       </div>`
    : '';

  return `
    <div style="${index > 0 ? 'page-break-before: always;' : ''} margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid ${m.border}; padding-bottom:6px; margin-bottom:10px;">
        <div>
          <div style="font-size:7.5pt; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Project Manager</div>
          <div style="display:flex; align-items:center; gap:10px; margin-top:2px;">
            <div style="font-size:16pt; font-weight:700; color:#0f172a;">${esc(pm.pmName)}</div>
            ${healthPill(pm.overallHealth)}
            ${pm.departmentName ? `<span style="font-size:9pt; color:#475569;">${esc(pm.departmentName)}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right; font-size:8pt; color:#475569;">
          <strong>${pm.totals.activeJobs}</strong> open job${pm.totals.activeJobs === 1 ? '' : 's'} ·
          <span style="color:#15803d; font-weight:600;">${pm.healthCounts.green}</span> healthy /
          <span style="color:#b45309; font-weight:600;">${pm.healthCounts.yellow}</span> watch /
          <span style="color:#b91c1c; font-weight:600;">${pm.healthCounts.red}</span> at risk
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px; margin-bottom:10px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:5px 8px;">
          <div style="font-size:6.5pt; color:#64748b; font-weight:600; text-transform:uppercase;">Contract $</div>
          <div style="font-size:10pt; font-weight:700; color:#0f172a;">${fmt$(pm.totals.contractAmount)}</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:5px 8px;">
          <div style="font-size:6.5pt; color:#64748b; font-weight:600; text-transform:uppercase;">Projected Rev</div>
          <div style="font-size:10pt; font-weight:700; color:#0f172a;">${fmt$(pm.totals.projectedRevenue)}</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:5px 8px;">
          <div style="font-size:6.5pt; color:#64748b; font-weight:600; text-transform:uppercase;">GP %</div>
          <div style="font-size:10pt; font-weight:700; color:${pm.totals.aggregateGrossProfitPct < 0 ? '#b91c1c' : '#15803d'};">${fmtPct(pm.totals.aggregateGrossProfitPct)}</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:5px 8px;">
          <div style="font-size:6.5pt; color:#64748b; font-weight:600; text-transform:uppercase;">Cost Var</div>
          <div style="font-size:10pt; font-weight:700; color:${pm.totals.aggregateCostVariance > 0.05 ? '#b91c1c' : pm.totals.aggregateCostVariance > 0 ? '#b45309' : '#15803d'};">${fmtPct(pm.totals.aggregateCostVariance * 100)}</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:5px 8px;">
          <div style="font-size:6.5pt; color:#64748b; font-weight:600; text-transform:uppercase;">Backlog</div>
          <div style="font-size:10pt; font-weight:700; color:#0f172a;">${fmt$(pm.totals.backlog)}</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:5px 8px;">
          <div style="font-size:6.5pt; color:#64748b; font-weight:600; text-transform:uppercase;">Cash Flow</div>
          <div style="font-size:10pt; font-weight:700; color:${pm.totals.cashFlow < 0 ? '#b91c1c' : '#15803d'};">${fmt$(pm.totals.cashFlow)}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; background:#fff; border:1px solid #e2e8f0; border-radius:4px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:${cp}; font-size:6.5pt; text-align:center; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Health</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:left; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Contract / Description</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:right; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Contract $</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:right; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">% Comp</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:right; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">GP %</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:right; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Cost Var</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:right; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">O/(U) Billed</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:right; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Backlog</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:right; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Cash Flow</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:center; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">WoW GP%</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:center; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">WoW Cost</th>
            <th style="padding:${cp}; font-size:6.5pt; text-align:center; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">WoW Backlog</th>
          </tr>
        </thead>
        <tbody>${jobRows}</tbody>
      </table>

      ${issuesList}
    </div>
  `;
}

function generatePMReportPdfHtml(data, scheduleName) {
  const cover = generateCoverPage(data, scheduleName);
  const sections = data.pms.map((pm, i) => generatePMSection(pm, i)).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Project Manager Report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; }
    table { border-spacing: 0; }
  </style>
</head>
<body>
  ${cover}
  ${sections}
</body>
</html>`;
}

module.exports = { generatePMReportPdfHtml };
