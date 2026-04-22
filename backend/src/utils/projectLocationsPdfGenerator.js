/**
 * Generate HTML for Project Locations Report PDF (server-side, Puppeteer)
 *
 * @param {Array}  projects    - Map location rows
 * @param {Object} options
 * @param {Object} options.filters     - Active filter values for display
 * @param {string} options.mapImage    - Base64-encoded PNG of the map (data:image/png;base64,…)
 * @param {boolean} options.includeList - Whether to append the project detail table
 */

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

function buildStateStats(projects) {
  const stateMap = {};
  projects.forEach(p => {
    const state = p.ship_state || 'Unknown';
    if (!stateMap[state]) stateMap[state] = { state, count: 0, totalContract: 0 };
    stateMap[state].count++;
    stateMap[state].totalContract += Number(p.contract_value) || 0;
  });
  return Object.values(stateMap).sort((a, b) => b.count - a.count);
}

function buildMarketStats(projects) {
  const marketMap = {};
  projects.forEach(p => {
    const market = p.market || 'Unassigned';
    if (!marketMap[market]) marketMap[market] = { market, count: 0, totalContract: 0 };
    marketMap[market].count++;
    marketMap[market].totalContract += Number(p.contract_value) || 0;
  });
  return Object.values(marketMap).sort((a, b) => b.totalContract - a.totalContract);
}

function generateProjectLocationsPdfHtml(projects, options = {}) {
  const { filters = {}, mapImage, includeList = false } = options;
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Filter description
  const filterParts = [];
  if (filters.status) filterParts.push(`Status: ${filters.status}`);
  if (filters.markets && filters.markets.length > 0) filterParts.push(`Market: ${filters.markets.join(', ')}`);
  if (filters.manager) filterParts.push(`Manager: ${filters.manager}`);
  if (filters.customer) filterParts.push(`Customer: ${filters.customer}`);
  if (filters.dateFrom) filterParts.push(`From: ${filters.dateFrom}`);
  if (filters.dateTo) filterParts.push(`To: ${filters.dateTo}`);
  const filterStr = filterParts.length > 0 ? filterParts.join(' &nbsp;|&nbsp; ') : '';

  // Totals
  const states = new Set();
  let totalContract = 0;
  const marketCounts = {};
  projects.forEach(p => {
    if (p.ship_state) states.add(p.ship_state);
    totalContract += Number(p.contract_value) || 0;
    if (p.market) marketCounts[p.market] = (marketCounts[p.market] || 0) + 1;
  });
  const topMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0];

  const stateStats = buildStateStats(projects);
  const marketStats = buildMarketStats(projects);

  // Helpers
  const kpiCard = (label, value, bgColor, borderColor, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px 14px; min-width: 0;">
      <div style="font-size: 7pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.04em;">${label}</div>
      <div style="font-size: 14pt; font-weight: 700; color: ${valueColor}; white-space: nowrap; margin-top: 2px;">${value}</div>
    </div>`;

  const statusBadge = (status) => {
    const colors = {
      'Open': { bg: 'rgba(16,185,129,0.1)', text: '#059669' },
      'Soft-Closed': { bg: 'rgba(245,158,11,0.1)', text: '#d97706' },
      'Hard-Closed': { bg: 'rgba(107,114,128,0.1)', text: '#6b7280' },
    };
    const c = colors[status] || { bg: '#f1f5f9', text: '#64748b' };
    return `<span style="padding: 1px 6px; border-radius: 9999px; font-weight: 600; font-size: 7pt; background: ${c.bg}; color: ${c.text};">${status}</span>`;
  };

  const thStyle = 'background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 6px 8px; text-transform: uppercase; letter-spacing: 0.05em;';
  const fs = '8pt';
  const cp = '5px 8px';

  // ── Map section ──────────────────────────────────────────────────────────
  const mapHtml = mapImage
    ? `<div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
         <img src="${mapImage}" style="width: 100%; display: block;" />
       </div>`
    : '';

  // ── State breakdown rows ────────────────────────────────────────────────
  const stateRows = stateStats.slice(0, 15).map((s, i) => {
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const barWidth = stateStats[0].count > 0 ? Math.round((s.count / stateStats[0].count) * 100) : 0;
    return `<tr style="background: ${bgColor};">
      <td style="padding: 4px 8px; font-size: ${fs}; font-weight: 600; color: #1e293b;">${s.state}</td>
      <td style="padding: 4px 8px; font-size: ${fs}; text-align: center; color: #334155;">${s.count}</td>
      <td style="padding: 4px 8px; font-size: ${fs}; text-align: right; color: #059669; font-weight: 500;">${fmtCurrencyShort(s.totalContract)}</td>
      <td style="padding: 4px 6px; width: 120px;">
        <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; width: ${barWidth}%; background: #3b82f6; border-radius: 4px;"></div>
        </div>
      </td>
    </tr>`;
  }).join('');

  // ── Market breakdown rows ───────────────────────────────────────────────
  const marketRows = marketStats.map((m, i) => {
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const maxContract = marketStats[0].totalContract || 1;
    const barWidth = Math.round((m.totalContract / maxContract) * 100);
    return `<tr style="background: ${bgColor};">
      <td style="padding: 4px 8px; font-size: ${fs}; font-weight: 600; color: #1e293b;">${m.market}</td>
      <td style="padding: 4px 8px; font-size: ${fs}; text-align: center; color: #334155;">${m.count}</td>
      <td style="padding: 4px 8px; font-size: ${fs}; text-align: right; color: #059669; font-weight: 500;">${fmtCurrencyShort(m.totalContract)}</td>
      <td style="padding: 4px 6px; width: 120px;">
        <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; width: ${barWidth}%; background: #8b5cf6; border-radius: 4px;"></div>
        </div>
      </td>
    </tr>`;
  }).join('');

  // ── Project detail table (optional) ─────────────────────────────────────
  let projectDetailHtml = '';
  if (includeList) {
    const sorted = [...projects].sort((a, b) => {
      const stateA = (a.ship_state || '').localeCompare(b.ship_state || '');
      if (stateA !== 0) return stateA;
      return (a.ship_city || '').localeCompare(b.ship_city || '');
    });

    const projectRows = sorted.map((p, i) => {
      const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      const location = p.ship_city && p.ship_state
        ? `${p.ship_city}, ${p.ship_state}`
        : (p.address || '-');
      return `<tr style="background: ${bgColor};">
        <td style="padding: ${cp}; font-size: ${fs}; color: #64748b; white-space: nowrap;">${p.number || '-'}</td>
        <td style="padding: ${cp}; font-size: ${fs}; font-weight: 600; color: #1e293b; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name || '-'}</td>
        <td style="padding: ${cp}; font-size: ${fs}; color: #334155;">${p.customer_name || '-'}</td>
        <td style="padding: ${cp}; font-size: ${fs}; color: #334155; white-space: nowrap;">${location}</td>
        <td style="padding: ${cp}; font-size: ${fs}; color: #334155;">${p.market || '-'}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: center;">${statusBadge(p.status)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right; font-weight: 500; color: #059669;">${fmtCurrency(p.contract_value)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; color: #334155; white-space: nowrap;">${p.manager_name || '-'}</td>
      </tr>`;
    }).join('');

    projectDetailHtml = `
    <div style="page-break-before: always;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 3px solid #002356; padding-bottom: 8px;">
        <div>
          <div style="font-size: 16pt; font-weight: 700; color: #002356;">PROJECT DETAIL</div>
          <div style="font-size: 8.5pt; color: #6b7280;">Sorted by State, City</div>
        </div>
        <div style="font-size: 8pt; color: #94a3b8;">${projects.length} projects | Total: ${fmtCurrencyShort(totalContract)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="${thStyle} text-align: left;">Project #</th>
            <th style="${thStyle} text-align: left;">Name</th>
            <th style="${thStyle} text-align: left;">Customer</th>
            <th style="${thStyle} text-align: left;">Location</th>
            <th style="${thStyle} text-align: left;">Market</th>
            <th style="${thStyle} text-align: center;">Status</th>
            <th style="${thStyle} text-align: right;">Contract Value</th>
            <th style="${thStyle} text-align: left;">Manager</th>
          </tr>
        </thead>
        <tbody>${projectRows}</tbody>
        <tfoot>
          <tr style="background: #f0f9ff; border-top: 2px solid #002356;">
            <td colspan="6" style="padding: 6px 8px; font-size: 8.5pt; font-weight: 700; color: #002356;">TOTAL (${projects.length} projects)</td>
            <td style="padding: 6px 8px; font-size: 8.5pt; font-weight: 700; color: #059669; text-align: right;">${fmtCurrency(totalContract)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }

  // ── Shared page header helper ──────────────────────────────────────────
  const pageHeader = (title, subtitle) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; border-bottom: 3px solid #002356; padding-bottom: 10px;">
      <div>
        <div style="font-size: 22pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">${title}</div>
        <div style="font-size: 10pt; color: #6b7280; margin-top: 2px;">Generated ${dateLabel}</div>
        ${subtitle ? `<div style="font-size: 8.5pt; color: #6b7280; margin-top: 2px;">${subtitle}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 9pt; color: #6b7280;">${projects.length} project${projects.length !== 1 ? 's' : ''}</div>
        <div style="font-size: 8pt; color: #94a3b8;">${states.size} state${states.size !== 1 ? 's' : ''}</div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 0.4in; }
    table { width: 100%; border-collapse: collapse; }
    @page { size: Letter landscape; margin: 0.4in; }
  </style>
</head>
<body>
  <!-- PAGE 1: Map -->
  <div style="page-break-after: always;">
    ${pageHeader('PROJECT LOCATIONS', filterStr)}

    <!-- KPI Cards -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      ${kpiCard('Projects', String(projects.length), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
      ${kpiCard('States Covered', String(states.size), '#ecfeff', '#a5f3fc', '#155e75', '#0891b2')}
      ${kpiCard('Total Contract Value', fmtCurrencyShort(totalContract), '#f0fdf4', '#bbf7d0', '#166534', '#059669')}
      ${kpiCard('Top Market', topMarket ? topMarket[0] : '-', '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
    </div>

    <!-- Map Screenshot -->
    ${mapHtml}
  </div>

  <!-- PAGE 2: Breakdowns -->
  <div ${includeList ? 'style="page-break-after: always;"' : ''}>
    ${pageHeader('STATE & MARKET BREAKDOWN', filterStr)}

    <div style="display: flex; gap: 16px;">
      <div style="flex: 1;">
        <div style="font-size: 10pt; font-weight: 700; color: #002356; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; padding-left: 2px;">
          State Breakdown${stateStats.length > 15 ? ' (Top 15)' : ''}
        </div>
        <table>
          <thead><tr>
            <th style="${thStyle} text-align: left;">State</th>
            <th style="${thStyle} text-align: center;">Projects</th>
            <th style="${thStyle} text-align: right;">Contract Value</th>
            <th style="${thStyle} width: 120px;"></th>
          </tr></thead>
          <tbody>${stateRows}</tbody>
        </table>
      </div>
      <div style="flex: 1;">
        <div style="font-size: 10pt; font-weight: 700; color: #002356; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; padding-left: 2px;">
          Market Breakdown
        </div>
        <table>
          <thead><tr>
            <th style="${thStyle} text-align: left;">Market</th>
            <th style="${thStyle} text-align: center;">Projects</th>
            <th style="${thStyle} text-align: right;">Contract Value</th>
            <th style="${thStyle} width: 120px;"></th>
          </tr></thead>
          <tbody>${marketRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  ${projectDetailHtml}
</body>
</html>`;
}

module.exports = { generateProjectLocationsPdfHtml };
