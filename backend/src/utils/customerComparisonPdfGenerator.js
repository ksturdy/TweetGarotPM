/**
 * Generate HTML for Customer Comparison Report PDF (server-side, Puppeteer)
 *
 * @param {Array}  projects       - Map location rows (already filtered to selected customers)
 * @param {Object} options
 * @param {Array}  options.customers      - Selected customer names
 * @param {Object} options.customerColors - { customerName: '#hex' } color map
 * @param {Object} options.filters        - Active filter values for display
 * @param {string} options.mapImage       - Base64-encoded PNG of the map
 * @param {boolean} options.includeList   - Whether to append the project detail table
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

function buildCustomerStats(projects, customers) {
  return customers.map(name => {
    const custProjects = projects.filter(p => p.customer_name === name);
    const states = new Set();
    const marketCounts = {};
    let totalContract = 0;
    custProjects.forEach(p => {
      if (p.ship_state) states.add(p.ship_state);
      if (p.market) marketCounts[p.market] = (marketCounts[p.market] || 0) + 1;
      totalContract += Number(p.contract_value) || 0;
    });
    const topMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      name,
      projectCount: custProjects.length,
      totalContract,
      avgProjectSize: custProjects.length > 0 ? totalContract / custProjects.length : 0,
      statesCovered: states.size,
      topMarket: topMarket ? topMarket[0] : '-',
    };
  });
}

function buildStateBreakdown(projects, customers) {
  const stateMap = {};
  projects.forEach(p => {
    const state = p.ship_state || 'Unknown';
    const customer = p.customer_name || 'Unknown';
    if (!stateMap[state]) stateMap[state] = { state, total: 0, customers: {} };
    stateMap[state].total++;
    stateMap[state].customers[customer] = (stateMap[state].customers[customer] || 0) + 1;
  });
  return Object.values(stateMap).sort((a, b) => b.total - a.total);
}

function generateCustomerComparisonPdfHtml(projects, options = {}) {
  const { customers = [], customerColors = {}, filters = {}, mapImage, includeList = false } = options;
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Filter description
  const filterParts = [];
  if (filters.status) filterParts.push(`Status: ${filters.status}`);
  if (filters.markets && filters.markets.length > 0) filterParts.push(`Market: ${filters.markets.join(', ')}`);
  if (filters.department) filterParts.push(`Dept: ${filters.department}`);
  if (filters.dateFrom) filterParts.push(`From: ${filters.dateFrom}`);
  if (filters.dateTo) filterParts.push(`To: ${filters.dateTo}`);
  const filterStr = filterParts.length > 0 ? filterParts.join(' &nbsp;|&nbsp; ') : '';

  const stats = buildCustomerStats(projects, customers);
  const stateBreakdown = buildStateBreakdown(projects, customers);

  const thStyle = 'background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 6px 8px; text-transform: uppercase; letter-spacing: 0.05em;';
  const fs = '8pt';
  const cp = '5px 8px';

  // ── Page header helper ─────────────────────────────────────────────────
  const pageHeader = (title, subtitle) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; border-bottom: 3px solid #002356; padding-bottom: 10px;">
      <div>
        <div style="font-size: 22pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">${title}</div>
        <div style="font-size: 10pt; color: #6b7280; margin-top: 2px;">Generated ${dateLabel}</div>
        ${subtitle ? `<div style="font-size: 8.5pt; color: #6b7280; margin-top: 2px;">${subtitle}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 9pt; color: #6b7280;">${customers.length} customer${customers.length !== 1 ? 's' : ''} | ${projects.length} project${projects.length !== 1 ? 's' : ''}</div>
      </div>
    </div>`;

  // ── Map section ────────────────────────────────────────────────────────
  const mapHtml = mapImage
    ? `<div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
         <img src="${mapImage}" style="width: 100%; display: block;" />
       </div>`
    : '';

  // ── Customer KPI cards ─────────────────────────────────────────────────
  const kpiColumns = stats.map(s => {
    const color = customerColors[s.name] || '#6b7280';
    return `
      <div style="flex: 1; min-width: 0; border: 1px solid #e2e8f0; border-radius: 8px; border-top: 4px solid ${color}; padding: 10px 12px;">
        <div style="font-size: 9pt; font-weight: 700; color: ${color}; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.name}</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          <div style="flex: 1; min-width: 60px;">
            <div style="font-size: 6pt; color: #6b7280; text-transform: uppercase; font-weight: 600;">Projects</div>
            <div style="font-size: 13pt; font-weight: 700; color: #1e293b;">${s.projectCount}</div>
          </div>
          <div style="flex: 1; min-width: 60px;">
            <div style="font-size: 6pt; color: #6b7280; text-transform: uppercase; font-weight: 600;">Contract</div>
            <div style="font-size: 13pt; font-weight: 700; color: #059669;">${fmtCurrencyShort(s.totalContract)}</div>
          </div>
          <div style="flex: 1; min-width: 60px;">
            <div style="font-size: 6pt; color: #6b7280; text-transform: uppercase; font-weight: 600;">States</div>
            <div style="font-size: 13pt; font-weight: 700; color: #1e293b;">${s.statesCovered}</div>
          </div>
          <div style="flex: 1; min-width: 60px;">
            <div style="font-size: 6pt; color: #6b7280; text-transform: uppercase; font-weight: 600;">Avg Size</div>
            <div style="font-size: 13pt; font-weight: 700; color: #1e293b;">${fmtCurrencyShort(s.avgProjectSize)}</div>
          </div>
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #f1f5f9;">
          <div style="font-size: 6pt; color: #6b7280; text-transform: uppercase; font-weight: 600;">Top Market</div>
          <div style="font-size: 8pt; font-weight: 600; color: #334155;">${s.topMarket}</div>
        </div>
      </div>`;
  }).join('');

  // ── State breakdown rows ───────────────────────────────────────────────
  const stateRows = stateBreakdown.slice(0, 20).map((s, i) => {
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const custCells = customers.map(c => {
      const count = s.customers[c] || 0;
      return `<td style="padding: 4px 8px; font-size: ${fs}; text-align: center; color: ${count > 0 ? '#1e293b' : '#cbd5e1'}; font-weight: ${count > 0 ? '600' : '400'};">${count || '-'}</td>`;
    }).join('');
    return `<tr style="background: ${bgColor};">
      <td style="padding: 4px 8px; font-size: ${fs}; font-weight: 600; color: #1e293b;">${s.state}</td>
      <td style="padding: 4px 8px; font-size: ${fs}; text-align: center; color: #334155; font-weight: 600;">${s.total}</td>
      ${custCells}
    </tr>`;
  }).join('');

  const custHeaders = customers.map(c => {
    const color = customerColors[c] || '#6b7280';
    return `<th style="${thStyle} text-align: center;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px;vertical-align:middle;"></span>${c.length > 15 ? c.slice(0, 15) + '...' : c}</th>`;
  }).join('');

  // ── Project detail table (optional) ────────────────────────────────────
  let projectDetailHtml = '';
  if (includeList) {
    const sorted = [...projects].sort((a, b) => {
      const custA = (a.customer_name || '').localeCompare(b.customer_name || '');
      if (custA !== 0) return custA;
      const stateA = (a.ship_state || '').localeCompare(b.ship_state || '');
      if (stateA !== 0) return stateA;
      return (a.ship_city || '').localeCompare(b.ship_city || '');
    });

    let totalContract = 0;
    projects.forEach(p => { totalContract += Number(p.contract_value) || 0; });

    const projectRows = sorted.map((p, i) => {
      const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      const color = customerColors[p.customer_name] || '#6b7280';
      const location = p.ship_city && p.ship_state
        ? `${p.ship_city}, ${p.ship_state}`
        : (p.address || '-');
      return `<tr style="background: ${bgColor};">
        <td style="padding: ${cp}; font-size: ${fs}; color: #64748b; white-space: nowrap;">${p.number || '-'}</td>
        <td style="padding: ${cp}; font-size: ${fs}; font-weight: 600; color: #1e293b; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name || '-'}</td>
        <td style="padding: ${cp}; font-size: ${fs};"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px;vertical-align:middle;"></span>${p.customer_name || '-'}</td>
        <td style="padding: ${cp}; font-size: ${fs}; color: #334155; white-space: nowrap;">${location}</td>
        <td style="padding: ${cp}; font-size: ${fs}; color: #334155;">${p.market || '-'}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right; font-weight: 500; color: #059669;">${fmtCurrency(p.contract_value)}</td>
      </tr>`;
    }).join('');

    projectDetailHtml = `
    <div style="page-break-before: always;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 3px solid #002356; padding-bottom: 8px;">
        <div>
          <div style="font-size: 16pt; font-weight: 700; color: #002356;">PROJECT DETAIL</div>
          <div style="font-size: 8.5pt; color: #6b7280;">Sorted by Customer, State, City</div>
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
            <th style="${thStyle} text-align: right;">Contract Value</th>
          </tr>
        </thead>
        <tbody>${projectRows}</tbody>
        <tfoot>
          <tr style="background: #f0f9ff; border-top: 2px solid #002356;">
            <td colspan="5" style="padding: 6px 8px; font-size: 8.5pt; font-weight: 700; color: #002356;">TOTAL (${projects.length} projects)</td>
            <td style="padding: 6px 8px; font-size: 8.5pt; font-weight: 700; color: #059669; text-align: right;">${fmtCurrency(totalContract)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }

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
  <!-- PAGE 1: Map + KPIs -->
  <div style="page-break-after: always;">
    ${pageHeader('CUSTOMER COMPARISON', filterStr)}

    <!-- Customer KPI Cards -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      ${kpiColumns}
    </div>

    <!-- Map Screenshot -->
    ${mapHtml}
  </div>

  <!-- PAGE 2: State Breakdown -->
  <div ${includeList ? 'style="page-break-after: always;"' : ''}>
    ${pageHeader('STATE BREAKDOWN BY CUSTOMER', filterStr)}

    <table>
      <thead><tr>
        <th style="${thStyle} text-align: left;">State</th>
        <th style="${thStyle} text-align: center;">Total</th>
        ${custHeaders}
      </tr></thead>
      <tbody>${stateRows}</tbody>
    </table>
  </div>

  ${projectDetailHtml}
</body>
</html>`;
}

module.exports = { generateCustomerComparisonPdfHtml };
