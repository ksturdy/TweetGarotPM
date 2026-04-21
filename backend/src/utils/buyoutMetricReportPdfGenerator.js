/**
 * Generate HTML for Buyout Metric Report PDF (server-side, Puppeteer)
 */

const COST_TYPE_NAMES = {
  1: 'Labor',
  2: 'Material',
  3: 'Subcontracts',
  4: 'Rentals',
  5: 'MEP Equipment',
  6: 'General Conditions',
};

const fmtCurrency = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '$0';
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmtCurrencyShort = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmtPercent = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return `${Math.round(Number(v) * 100)}%`;
};

/**
 * Build per-PM aggregated buyout stats from project rows
 */
function buildPmStats(projects) {
  const pmMap = {};

  projects.forEach(p => {
    const name = p.manager_name || 'Unassigned';
    if (!pmMap[name]) {
      pmMap[name] = {
        name,
        projects: [],
        est: 0,
        jtd: 0,
        committed: 0,
        projected: 0,
        buyoutRemaining: 0,
      };
    }
    const pm = pmMap[name];
    pm.projects.push(p);
    pm.est += p.est_cost || 0;
    pm.jtd += p.jtd_cost || 0;
    pm.committed += p.committed_cost || 0;
    pm.projected += p.projected_cost || 0;
    pm.buyoutRemaining += p.buyout_remaining || 0;
  });

  // Compute buyout % and weighted % complete per PM
  Object.values(pmMap).forEach(pm => {
    pm.buyoutPct = pm.est > 0 ? Math.round((pm.committed / pm.est) * 100) : 0;

    const pctNum = pm.projects.reduce((s, p) => {
      const pct = Number(p.percent_complete) || 0;
      const proj = p.projected_cost || 0;
      return s + pct * proj;
    }, 0);
    pm.avgPctComplete = pm.projected > 0 ? pctNum / pm.projected : 0;
  });

  // Sort by most buyout remaining first
  return Object.values(pmMap).sort((a, b) => b.buyoutRemaining - a.buyoutRemaining);
}

/**
 * Generate the cover page HTML with team totals and per-PM breakdown
 */
function generateCoverPageHtml(projects, filters, filterStr) {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const costTypes = filters.cost_types || [3, 5];
  const costTypeLabel = costTypes.map(ct => COST_TYPE_NAMES[ct] || `Type ${ct}`).join(', ');

  // Team totals
  const totals = { est: 0, jtd: 0, committed: 0, projected: 0, buyoutRemaining: 0 };
  projects.forEach(p => {
    totals.est += p.est_cost || 0;
    totals.jtd += p.jtd_cost || 0;
    totals.committed += p.committed_cost || 0;
    totals.projected += p.projected_cost || 0;
    totals.buyoutRemaining += p.buyout_remaining || 0;
  });

  const overallBuyoutPct = totals.est > 0 ? Math.round((totals.committed / totals.est) * 100) : 0;

  // Per-PM stats
  const pmStats = buildPmStats(projects);

  // Max buyout remaining for bar scaling
  const maxAbsBr = Math.max(...pmStats.map(pm => Math.abs(pm.buyoutRemaining)), 1);

  // KPI card helper (larger for cover page)
  const kpiCard = (label, value, bgColor, borderColor, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px 14px; min-width: 0;">
      <div style="font-size: 7pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.04em;">${label}</div>
      <div style="font-size: 14pt; font-weight: 700; color: ${valueColor}; white-space: nowrap; margin-top: 2px;">${value}</div>
    </div>`;

  // PM scorecard rows
  const fs = '8.5pt';
  const cp = '6px 7px';
  const thStyle = 'background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-transform: uppercase; letter-spacing: 0.05em;';

  const pmRows = pmStats.map((pm, i) => {
    const br = pm.buyoutRemaining;
    const brColor = br > 0 ? '#d97706' : br < 0 ? '#dc2626' : '#059669';
    const barWidth = Math.round((Math.abs(br) / maxAbsBr) * 100);
    const barColor = br > 0 ? '#d97706' : br < 0 ? '#dc2626' : '#059669';
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <tr style="background: ${bgColor};">
        <td style="padding: ${cp}; font-size: ${fs}; font-weight: 600; color: #1e293b; white-space: nowrap;">${pm.name}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: center; color: #334155;">${pm.projects.length}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtPercent(pm.avgPctComplete)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right; font-weight: 500;">${fmtCurrencyShort(pm.est)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtCurrencyShort(pm.projected)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtCurrencyShort(pm.jtd)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtCurrencyShort(pm.committed)}</td>
        <td style="padding: 6px 5px; font-size: ${fs}; text-align: right;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
            <div style="width: 50px; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; flex-shrink: 0;">
              <div style="height: 100%; width: ${barWidth}%; background: ${barColor}; border-radius: 4px;"></div>
            </div>
            <span style="font-weight: 700; color: ${brColor}; white-space: nowrap; min-width: 60px; text-align: right;">${fmtCurrencyShort(br)}</span>
          </div>
        </td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: center;">
          <span style="padding: 1px 6px; border-radius: 9999px; font-weight: 600; font-size: 7.5pt;
            background: ${pm.buyoutPct >= 75 ? 'rgba(5,150,105,0.1)' : pm.buyoutPct >= 50 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)'};
            color: ${pm.buyoutPct >= 75 ? '#059669' : pm.buyoutPct >= 50 ? '#d97706' : '#dc2626'};">
            ${pm.buyoutPct}%
          </span>
        </td>
      </tr>`;
  }).join('');

  // Weighted % complete for footer
  const pctNumerator = projects.reduce((s, p) => {
    const pct = Number(p.percent_complete) || 0;
    const proj = p.projected_cost || 0;
    return s + pct * proj;
  }, 0);
  const weightedPct = totals.projected > 0 ? pctNumerator / totals.projected : 0;

  return `
  <!-- COVER PAGE -->
  <div style="page-break-after: always;">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; border-bottom: 3px solid #002356; padding-bottom: 10px;">
      <div>
        <div style="font-size: 22pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">BUYOUT METRIC</div>
        <div style="font-size: 10pt; color: #6b7280; margin-top: 2px;">Generated ${dateLabel}</div>
        <div style="font-size: 9pt; color: #475569; margin-top: 2px;">${costTypeLabel}</div>
        ${filterStr ? `<div style="font-size: 8.5pt; color: #6b7280; margin-top: 2px;">${filterStr}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 9pt; color: #6b7280;">${projects.length} project${projects.length !== 1 ? 's' : ''}</div>
        <div style="font-size: 8pt; color: #94a3b8;">${pmStats.length} project manager${pmStats.length !== 1 ? 's' : ''}</div>
      </div>
    </div>

    <!-- Section: Team Summary -->
    <div style="margin-bottom: 16px;">
      <div style="font-size: 10pt; font-weight: 700; color: #002356; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; padding-left: 2px;">
        Team Summary
      </div>

      <div style="display: flex; gap: 8px;">
        ${kpiCard('Projects', String(projects.length), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
        ${kpiCard('Estimated Cost', fmtCurrencyShort(totals.est), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
        ${kpiCard('Projected Cost', fmtCurrencyShort(totals.projected), '#ecfeff', '#a5f3fc', '#155e75', '#0891b2')}
        ${kpiCard('JTD Cost', fmtCurrencyShort(totals.jtd), '#fff7ed', '#fed7aa', '#9a3412', '#ea580c')}
        ${kpiCard('Committed', `${fmtCurrencyShort(totals.committed)} (${overallBuyoutPct}%)`, '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
        ${kpiCard('Buyout Remaining', fmtCurrencyShort(totals.buyoutRemaining),
          totals.buyoutRemaining >= 0 ? '#fffbeb' : '#fef2f2',
          totals.buyoutRemaining >= 0 ? '#fde68a' : '#fecaca',
          totals.buyoutRemaining >= 0 ? '#92400e' : '#991b1b',
          totals.buyoutRemaining >= 0 ? '#d97706' : '#dc2626')}
      </div>
    </div>

    <!-- Section: PM Breakdown -->
    <div>
      <div style="font-size: 10pt; font-weight: 700; color: #002356; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; padding-left: 2px;">
        Project Manager Breakdown
        <span style="font-size: 8pt; font-weight: 400; color: #94a3b8; text-transform: none; letter-spacing: normal; margin-left: 8px;">Sorted by buyout remaining (highest first)</span>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="${thStyle} text-align: left;">PM</th>
            <th style="${thStyle} text-align: center;">Jobs</th>
            <th style="${thStyle} text-align: right;">% Comp</th>
            <th style="${thStyle} text-align: right;">Estimated</th>
            <th style="${thStyle} text-align: right;">Projected</th>
            <th style="${thStyle} text-align: right;">JTD</th>
            <th style="${thStyle} text-align: right;">Committed</th>
            <th style="${thStyle} text-align: right;">Buyout Rem</th>
            <th style="${thStyle} text-align: center;">Buyout %</th>
          </tr>
        </thead>
        <tbody>
          ${pmRows}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1;">
            <td style="padding: 8px 10px; font-size: 9pt; font-weight: 700; color: #334155;">Team Totals</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: center; font-weight: 700;">${projects.length}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtPercent(weightedPct)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.est)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.projected)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.jtd)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.committed)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700; color: ${totals.buyoutRemaining >= 0 ? '#d97706' : '#dc2626'};">${fmtCurrencyShort(totals.buyoutRemaining)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: center; font-weight: 700;">
              <span style="color: ${overallBuyoutPct >= 75 ? '#059669' : overallBuyoutPct >= 50 ? '#d97706' : '#dc2626'};">${overallBuyoutPct}%</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>`;
}

function generateBuyoutMetricReportPdfHtml(projects, filters = {}) {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Cost type label
  const costTypes = filters.cost_types || [3, 5];
  const costTypeLabel = costTypes.map(ct => COST_TYPE_NAMES[ct] || `Type ${ct}`).join(', ');
  const minPct = filters.min_percent_complete !== undefined ? parseFloat(filters.min_percent_complete) : 0.10;
  const minPctDisplay = Math.round(minPct * 100);

  // Compute totals
  const totals = { est: 0, jtd: 0, committed: 0, projected: 0, buyoutRemaining: 0 };
  projects.forEach(p => {
    totals.est += p.est_cost || 0;
    totals.jtd += p.jtd_cost || 0;
    totals.committed += p.committed_cost || 0;
    totals.projected += p.projected_cost || 0;
    totals.buyoutRemaining += p.buyout_remaining || 0;
  });

  const overallBuyoutPct = totals.est > 0 ? Math.round((totals.committed / totals.est) * 100) : 0;

  // Weighted % complete
  const pctNumerator = projects.reduce((s, p) => {
    const pct = Number(p.percent_complete) || 0;
    const proj = p.projected_cost || 0;
    return s + pct * proj;
  }, 0);
  const weightedPct = totals.projected > 0 ? pctNumerator / totals.projected : 0;

  // Filter labels
  const filterLabels = [];
  filterLabels.push(`Cost Types: ${costTypeLabel}`);
  if (minPctDisplay > 0) filterLabels.push(`Min % Complete: ${minPctDisplay}%`);
  if (filters.status && filters.status !== 'all') filterLabels.push(`Status: ${filters.status}`);
  if (filters.pm && filters.pm !== 'all') filterLabels.push(`PM: ${filters.pm}`);
  if (filters.department && filters.department !== 'all') filterLabels.push(`Dept: ${filters.department}`);
  if (filters.market && filters.market !== 'all') filterLabels.push(`Market: ${filters.market}`);
  if (filters.teamName) filterLabels.push(`Team: ${filters.teamName}`);
  else if (filters.team) filterLabels.push(`Team: ${filters.team}`);
  if (filters.search) filterLabels.push(`Search: "${filters.search}"`);
  const filterStr = filterLabels.length > 0 ? `Filters: ${filterLabels.join('  |  ')}` : '';

  // KPI card helper
  const kpiCard = (label, value, bgColor, borderColor, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 6px 10px; min-width: 0;">
      <div style="font-size: 6.5pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap;">${label}</div>
      <div style="font-size: 11pt; font-weight: 700; color: ${valueColor}; white-space: nowrap;">${value}</div>
    </div>`;

  // Table rows
  const rows = projects.map((p, i) => {
    const pct = Number(p.percent_complete) || 0;
    const br = p.buyout_remaining || 0;
    const buyoutPct = p.est_cost > 0 ? Math.round((p.committed_cost / p.est_cost) * 100) : 0;
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const brColor = br > 0 ? '#d97706' : br < 0 ? '#dc2626' : '#059669';

    return `
      <tr style="background: ${bgColor};">
        <td style="padding: 4px 6px; font-size: 7.5pt; color: #475569;">${p.number || ''}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt;">
          <div style="font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${p.name || ''}</div>
        </td>
        <td style="padding: 4px 6px; font-size: 7pt; color: #64748b;">${p.manager_name || '-'}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${pct ? `${Math.round(pct * 100)}%` : '-'}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right; font-weight: 500;">${fmtCurrency(p.est_cost)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(p.jtd_cost)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(p.committed_cost)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(p.projected_cost)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right; font-weight: 600; color: ${brColor};">${fmtCurrency(br)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${buyoutPct}%</td>
        <td style="padding: 4px 6px; font-size: 7pt;">
          <span style="padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 6.5pt;
            background: ${p.status === 'Open' ? 'rgba(16,185,129,0.12)' : p.status === 'Soft-Closed' ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.12)'};
            color: ${p.status === 'Open' ? '#059669' : p.status === 'Soft-Closed' ? '#d97706' : '#6b7280'};">
            ${p.status || '-'}
          </span>
        </td>
      </tr>`;
  }).join('');

  // Footer totals
  const footerBuyoutPct = totals.est > 0 ? `${Math.round((totals.committed / totals.est) * 100)}%` : '-';

  // Generate cover page (only when multiple PMs present)
  const uniquePMs = new Set(projects.map(p => p.manager_name || 'Unassigned'));
  const coverHtml = uniquePMs.size > 1
    ? generateCoverPageHtml(projects, filters, filterStr)
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: landscape Letter; margin: 0.4in; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 6px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; }
    th.right { text-align: right; }
  </style>
</head>
<body>
  ${coverHtml}

  <!-- Detail pages header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; border-bottom: 3px solid #002356; padding-bottom: 8px;">
    <div>
      <div style="font-size: 18pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">BUYOUT METRIC</div>
      <div style="font-size: 9pt; color: #6b7280;">Generated ${dateLabel}</div>
      <div style="font-size: 8.5pt; color: #475569; margin-top: 1px;">${costTypeLabel}</div>
      ${filterStr ? `<div style="font-size: 8pt; color: #6b7280; margin-top: 2px;">${filterStr}</div>` : ''}
    </div>
    <div style="text-align: right; font-size: 8pt; color: #6b7280;">
      ${projects.length} project${projects.length !== 1 ? 's' : ''}<br>
      <span style="font-size: 7pt; color: #94a3b8;">Sorted by Buyout Remaining (highest first)</span>
    </div>
  </div>

  <!-- KPI Summary -->
  <div style="display: flex; gap: 6px; margin-bottom: 10px;">
    ${kpiCard('Projects', String(projects.length), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
    ${kpiCard('Estimated Cost', fmtCurrencyShort(totals.est), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
    ${kpiCard('Projected Cost', fmtCurrencyShort(totals.projected), '#ecfeff', '#a5f3fc', '#155e75', '#0891b2')}
    ${kpiCard('JTD Cost', fmtCurrencyShort(totals.jtd), '#fff7ed', '#fed7aa', '#9a3412', '#ea580c')}
    ${kpiCard('Committed', `${fmtCurrencyShort(totals.committed)} (${overallBuyoutPct}%)`, '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
    ${kpiCard('Buyout Remaining', fmtCurrencyShort(totals.buyoutRemaining),
      totals.buyoutRemaining >= 0 ? '#fffbeb' : '#fef2f2',
      totals.buyoutRemaining >= 0 ? '#fde68a' : '#fecaca',
      totals.buyoutRemaining >= 0 ? '#92400e' : '#991b1b',
      totals.buyoutRemaining >= 0 ? '#d97706' : '#dc2626')}
  </div>

  <!-- Table -->
  <table>
    <thead>
      <tr>
        <th style="width: 4.5%;">#</th>
        <th style="width: 16%;">Project</th>
        <th style="width: 8%;">PM</th>
        <th class="right" style="width: 6%;">% Comp</th>
        <th class="right" style="width: 9.5%;">Est Cost</th>
        <th class="right" style="width: 9%;">JTD Cost</th>
        <th class="right" style="width: 10%;">Committed</th>
        <th class="right" style="width: 9.5%;">Projected</th>
        <th class="right" style="width: 10%;">Buyout Rem</th>
        <th class="right" style="width: 7%;">Buyout %</th>
        <th style="width: 6%;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1;">
        <td colspan="3" style="padding: 6px; font-size: 7.5pt; text-align: right; color: #334155;">Totals:</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtPercent(weightedPct)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.est)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.jtd)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.committed)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.projected)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right; font-weight: 700; color: ${totals.buyoutRemaining >= 0 ? '#d97706' : '#dc2626'};">${fmtCurrency(totals.buyoutRemaining)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${footerBuyoutPct}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

module.exports = { generateBuyoutMetricReportPdfHtml };
