/**
 * Generate HTML for Opportunity Search Report PDF (server-side, Puppeteer)
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

/**
 * Truncate text to max length with ellipsis
 */
const truncate = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Get badge color based on verification status
 */
const getVerificationBadge = (status) => {
  const badges = {
    'verifiable': { bg: 'rgba(5,150,105,0.12)', color: '#059669', label: 'Verified' },
    'unverified': { bg: 'rgba(245,158,11,0.12)', color: '#d97706', label: 'Unverified' },
    'suspect': { bg: 'rgba(220,38,38,0.12)', color: '#dc2626', label: 'Suspect' },
  };
  return badges[status] || badges['unverified'];
};

/**
 * Get confidence badge styling
 */
const getConfidenceBadge = (confidence) => {
  const badges = {
    'high': { bg: 'rgba(5,150,105,0.12)', color: '#059669' },
    'medium': { bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
    'low': { bg: 'rgba(220,38,38,0.12)', color: '#dc2626' },
  };
  return badges[confidence] || badges['medium'];
};

/**
 * Generate the Opportunity Search Report PDF HTML
 */
function generateOpportunitySearchPdfHtml(searchData, tenantDomain = 'app.titanpm.com') {
  const { name, criteria, results, summary } = searchData;
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const leads = results || [];

  // Build criteria summary string
  const criteriaLines = [];
  if (criteria?.market_sector) criteriaLines.push(`Market: ${criteria.market_sector}`);
  if (criteria?.location) criteriaLines.push(`Location: ${criteria.location}`);
  if (criteria?.construction_type) criteriaLines.push(`Type: ${criteria.construction_type}`);
  if (criteria?.min_value || criteria?.max_value) {
    const min = criteria.min_value ? fmtCurrencyShort(criteria.min_value) : 'any';
    const max = criteria.max_value ? fmtCurrencyShort(criteria.max_value) : 'any';
    criteriaLines.push(`Value Range: ${min} - ${max}`);
  }
  if (criteria?.keywords) criteriaLines.push(`Keywords: ${criteria.keywords}`);
  const criteriaStr = criteriaLines.join('  |  ');

  // Compute totals
  const totalValue = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  const verifiedCount = leads.filter(l => l.verification_status === 'verifiable').length;
  const marketBreakdown = {};
  leads.forEach(l => {
    const market = l.market_sector || 'Other';
    marketBreakdown[market] = (marketBreakdown[market] || 0) + 1;
  });

  // KPI card helper
  const kpiCard = (label, value, bgColor, borderColor, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 8px 12px; min-width: 0;">
      <div style="font-size: 7pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.04em;">${label}</div>
      <div style="font-size: 12pt; font-weight: 700; color: ${valueColor}; white-space: nowrap; margin-top: 2px;">${value}</div>
    </div>`;

  // Generate clickable link back to Titan (use saved search ID if available)
  const titanLink = searchData.id
    ? `https://${tenantDomain}/opportunity-search?saved=${searchData.id}`
    : `https://${tenantDomain}/opportunity-search`;

  // Table rows
  const rows = leads.map((lead, i) => {
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const verificationBadge = getVerificationBadge(lead.verification_status);
    const confidenceBadge = getConfidenceBadge(lead.confidence);

    // Truncate long text for table display
    const projectName = truncate(lead.project_name, 45);
    const ownerName = truncate(lead.company_name, 35);
    const location = truncate(lead.location, 30);
    const mechScope = truncate(lead.mechanical_scope, 60);

    return `
      <tr style="background: ${bgColor};">
        <td style="padding: 5px 7px; font-size: 7.5pt;">
          <div style="font-weight: 600; color: #1e293b;">${projectName}</div>
          ${mechScope ? `<div style="font-size: 6.5pt; color: #64748b; margin-top: 2px;">${mechScope}</div>` : ''}
        </td>
        <td style="padding: 5px 7px; font-size: 7.5pt; color: #475569;">${ownerName}</td>
        <td style="padding: 5px 7px; font-size: 7pt; color: #64748b;">${location}</td>
        <td style="padding: 5px 7px; font-size: 7.5pt; text-align: center;">
          <span style="padding: 2px 6px; border-radius: 9999px; font-weight: 600; font-size: 6.5pt;
            background: ${confidenceBadge.bg}; color: ${confidenceBadge.color}; text-transform: uppercase;">
            ${lead.confidence || 'medium'}
          </span>
        </td>
        <td style="padding: 5px 7px; font-size: 7.5pt; text-align: right; font-weight: 500;">${fmtCurrencyShort(lead.estimated_value)}</td>
        <td style="padding: 5px 7px; font-size: 7pt; text-align: center;">
          <span style="padding: 2px 6px; border-radius: 9999px; font-weight: 600; font-size: 6.5pt;
            background: ${verificationBadge.bg}; color: ${verificationBadge.color};">
            ${verificationBadge.label}
          </span>
        </td>
        <td style="padding: 5px 7px; font-size: 7pt; color: #64748b;">${lead.contact_name || 'Research Needed'}</td>
        <td style="padding: 5px 7px; font-size: 6.5pt; color: #64748b;">
          ${lead.source_url ? `<a href="${lead.source_url}" style="color: #0369a1; text-decoration: none;">View Source</a>` : '-'}
        </td>
      </tr>`;
  }).join('');

  // Market breakdown for summary
  const marketRows = Object.entries(marketBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([market, count]) => `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="font-size: 7.5pt; color: #334155;">${market}</span>
        <span style="font-size: 7.5pt; font-weight: 600; color: #002356;">${count}</span>
      </div>
    `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: landscape Letter; margin: 0.4in; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 7px 6px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; }
    th.center { text-align: center; }
    th.right { text-align: right; }
    a { color: #0369a1; text-decoration: underline; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 3px solid #002356; padding-bottom: 10px;">
    <div>
      <div style="font-size: 20pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">OPPORTUNITY SEARCH</div>
      <div style="font-size: 10pt; color: #6b7280; margin-top: 2px;">Generated ${dateLabel}</div>
      <div style="font-size: 9pt; color: #475569; margin-top: 2px; font-weight: 600;">${name || 'Untitled Search'}</div>
      ${criteriaStr ? `<div style="font-size: 8pt; color: #6b7280; margin-top: 2px;">${criteriaStr}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <div style="font-size: 9pt; color: #6b7280;">${leads.length} project${leads.length !== 1 ? 's' : ''} found</div>
      <div style="font-size: 8pt; color: #94a3b8;">${verifiedCount} verified</div>
      <div style="margin-top: 6px;">
        <a href="${titanLink}" style="font-size: 8pt; color: #0369a1; text-decoration: none; border: 1px solid #0369a1; padding: 4px 8px; border-radius: 4px; display: inline-block;">
          View in Titan →
        </a>
      </div>
    </div>
  </div>

  <!-- Summary Section -->
  <div style="display: flex; gap: 10px; margin-bottom: 14px;">
    <div style="flex: 2;">
      <!-- KPI Cards -->
      <div style="display: flex; gap: 6px; margin-bottom: 8px;">
        ${kpiCard('Projects', String(leads.length), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
        ${kpiCard('Total Value', fmtCurrencyShort(totalValue), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
        ${kpiCard('Verified', `${verifiedCount} (${Math.round(verifiedCount / Math.max(leads.length, 1) * 100)}%)`, '#ecfeff', '#a5f3fc', '#155e75', '#0891b2')}
        ${kpiCard('Avg Value', fmtCurrencyShort(totalValue / Math.max(leads.length, 1)), '#fff7ed', '#fed7aa', '#9a3412', '#ea580c')}
      </div>
    </div>
    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
      <div style="font-size: 8pt; font-weight: 700; color: #002356; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Market Breakdown</div>
      ${marketRows}
    </div>
  </div>

  <!-- Projects Table -->
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Project</th>
        <th style="width: 14%;">Owner</th>
        <th style="width: 12%;">Location</th>
        <th class="center" style="width: 8%;">Confidence</th>
        <th class="right" style="width: 10%;">Est. Value</th>
        <th class="center" style="width: 9%;">Verified</th>
        <th style="width: 12%;">Contact</th>
        <th class="center" style="width: 9%;">Source</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <!-- Footer -->
  <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #cbd5e1; text-align: center;">
    <p style="font-size: 7pt; color: #94a3b8; margin: 0;">
      This report was generated from AI-powered web search. All projects are based on publicly available information.
      <br>Visit <a href="${titanLink}" style="color: #0369a1;">${titanLink}</a> to view full details and convert to opportunities.
    </p>
  </div>
</body>
</html>`;
}

module.exports = { generateOpportunitySearchPdfHtml };
