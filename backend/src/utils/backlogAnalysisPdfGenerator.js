/**
 * Generate HTML for the Backlog Analysis PDF Report.
 * Landscape Letter — summary metrics + contract detail table.
 */

function fmtCurrency(v) {
  if (!v && v !== 0) return '$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000)    return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function fmtDollars(v) {
  if (!v && v !== 0) return '$0';
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function fmtFixed(v, d = 1) {
  if (v === null || v === undefined) return '—';
  return Number(v).toFixed(d);
}

function buildMetricRow(label, value, category, isCalculated = false, description = '') {
  const categoryColor = {
    'Backlog':    '#1a2b4a',
    'Calculated': '#6b7280',
    'Pipeline':   '#f97316',
  }[category] || '#1a2b4a';

  const catBg = {
    'Backlog':    '#e8edf5',
    'Calculated': '#f1f5f9',
    'Pipeline':   '#fff7ed',
  }[category] || '#e8edf5';

  return `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 0.4rem 0.6rem; font-size: 0.72rem;">
        <span style="
          display: inline-block;
          padding: 0.12rem 0.45rem;
          border-radius: 3px;
          font-size: 0.62rem;
          font-weight: 600;
          color: ${categoryColor};
          background: ${catBg};
          letter-spacing: 0.02em;
        ">${category}</span>
      </td>
      <td style="padding: 0.4rem 0.6rem; font-size: 0.78rem; color: #1f2937; font-weight: ${isCalculated ? '600' : '400'};">${label}</td>
      <td style="padding: 0.4rem 0.6rem; font-size: 0.78rem; font-weight: 700; color: ${isCalculated ? '#1a2b4a' : '#374151'}; text-align: right;">${value}</td>
      <td style="padding: 0.4rem 0.6rem; font-size: 0.68rem; color: #6b7280;">${description}</td>
    </tr>
  `;
}

function buildSectionHeader(title) {
  return `
    <tr>
      <td colspan="4" style="
        padding: 0.45rem 0.6rem 0.25rem;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #ffffff;
        background: #1a2b4a;
      ">${title}</td>
    </tr>
  `;
}

function buildContractDetailSection(contractDetails) {
  if (!contractDetails || contractDetails.length === 0) return '';

  // Landscape width ~1060px — 11 cols, no Division
  const cols = [
    { label: 'Contract #',      right: false },
    { label: 'Customer',        right: false },
    { label: 'PM',              right: false },
    { label: '% Comp',          right: true  },
    { label: 'Total Backlog',   right: true  },
    { label: 'GM %',            right: true  },
    { label: 'Curr Fiscal Year Rev',   right: true  },
    { label: 'Curr Fiscal Year GM',    right: true  },
    { label: 'Future Fiscal Year Rev', right: true  },
    { label: 'Future Fiscal Year GM',  right: true  },
    { label: 'Total GM',        right: true  },
  ];
  const thBase = 'padding: 0.35rem 0.4rem; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #ffffff; background: #2d4a7a; white-space: normal; vertical-align: bottom; line-height: 1.2; text-align: center;';
  const headerRow = cols.map(c => `<th style="${thBase}">${c.label}</th>`).join('');

  const rows = contractDetails.map((c, idx) => {
    const bg  = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const td  = `padding: 0.32rem 0.4rem; font-size: 0.68rem; color: #1f2937; background: ${bg};`;
    const tdr = td + ' text-align: right;';
    const cust = c.customerName && c.customerName.length > 26 ? c.customerName.slice(0, 24) + '…' : (c.customerName || '');
    const pm   = c.pmName && c.pmName.length > 22 ? c.pmName.slice(0, 20) + '…' : (c.pmName || '');
    return `<tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="${td} font-weight: 600;">${c.contractNumber || ''}</td>
      <td style="${td}">${cust}</td>
      <td style="${td}">${pm}</td>
      <td style="${tdr}">${c.pctComplete ?? 0}%</td>
      <td style="${tdr}">${fmtDollars(c.totalBacklog)}</td>
      <td style="${tdr}">${fmtPct(c.gmPct)}</td>
      <td style="${tdr}">${fmtDollars(c.currentFYRevenue)}</td>
      <td style="${tdr} color: #16a34a;">${fmtDollars(c.currentFYGM)}</td>
      <td style="${tdr} color: #6b7280;">${fmtDollars(c.futureFYRevenue)}</td>
      <td style="${tdr} color: #6b7280;">${fmtDollars(c.futureFYGM)}</td>
      <td style="${tdr} font-weight: 600; color: #16a34a;">${fmtDollars(c.totalGM)}</td>
    </tr>`;
  }).join('');

  return `
    <div style="margin-top: 1.5rem;">
      <div style="
        background: #1a2b4a;
        color: #ffffff;
        padding: 0.45rem 0.6rem;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        border-radius: 4px 4px 0 0;
      ">Contract Detail Breakdown (${contractDetails.length} contracts)</div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-top: none; font-family: 'Segoe UI', Arial, sans-serif;">
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildPipelineSection(awardedOpps, highPotentialOpps) {
  if (!awardedOpps?.length && !highPotentialOpps?.length) return '';

  const thBase = 'padding: 0.32rem 0.4rem; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;';

  function oppTable(title, color, bg, border, opps, showStage) {
    if (!opps || opps.length === 0) return '';
    const total = opps.reduce((s, o) => s + (o.estValue || 0), 0);
    const stageCol = showStage ? `<th style="${thBase} color: ${color}; background: ${bg}; text-align: left;">Stage</th>` : '';
    const headers = `
      <th style="${thBase} color: ${color}; background: ${bg}; text-align: left;">Opportunity</th>
      <th style="${thBase} color: ${color}; background: ${bg}; text-align: left;">Customer</th>
      <th style="${thBase} color: ${color}; background: ${bg}; text-align: left;">Assigned To</th>
      ${stageCol}
      <th style="${thBase} color: ${color}; background: ${bg}; text-align: right;">Est. Value</th>
    `;
    const rows = opps.map((o, i) => {
      const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      const td = `padding: 0.28rem 0.4rem; font-size: 0.68rem; color: #1f2937; background: ${rowBg}; border-bottom: 1px solid #e5e7eb;`;
      const title_ = o.title && o.title.length > 38 ? o.title.slice(0, 36) + '…' : (o.title || '');
      const cust   = o.customerName && o.customerName.length > 26 ? o.customerName.slice(0, 24) + '…' : (o.customerName || '');
      const stageCell = showStage ? `<td style="${td}">${o.stageName || ''}</td>` : '';
      return `<tr>
        <td style="${td}">${title_}</td>
        <td style="${td} color: #6b7280;">${cust}</td>
        <td style="${td} color: #374151;">${o.assignedTo || ''}</td>
        ${stageCell}
        <td style="${td} text-align: right; font-weight: 600; color: ${color};">${fmtDollars(o.estValue)}</td>
      </tr>`;
    }).join('');
    const stageFooter = showStage ? '<td></td>' : '';
    const footer = `<tr style="background: ${bg}; border-top: 2px solid ${border};">
      <td colspan="3" style="padding: 0.32rem 0.4rem; font-size: 0.68rem; font-weight: 700; color: ${color};">Total (${opps.length})</td>
      ${stageFooter}
      <td style="padding: 0.32rem 0.4rem; font-size: 0.68rem; font-weight: 700; color: ${color}; text-align: right;">${fmtDollars(total)}</td>
    </tr>`;

    return `<div style="flex: 1; min-width: 0;">
      <div style="background: ${color}; color: #fff; padding: 0.4rem 0.5rem; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; border-radius: 4px 4px 0 0;">
        ${title} (${opps.length})
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid ${border}; border-top: none; font-family: 'Segoe UI', Arial, sans-serif;">
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>${footer}</tfoot>
      </table>
    </div>`;
  }

  const awarded = oppTable(
    'Backlog Sold — Not Yet Contracted', '#c2410c', '#fff7ed', '#fed7aa',
    awardedOpps, false
  );
  const highProb = oppTable(
    'High Potential Backlog', '#1a2b4a', '#eff6ff', '#bfdbfe',
    highPotentialOpps, true
  );

  return `
    <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
      ${awarded}
      ${highProb}
    </div>
  `;
}

function generateBacklogAnalysisPdfHtml(data, generatedBy) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const divLabel  = data.filters?.divisionFilter && data.filters.divisionFilter !== 'all'
    ? `Department: ${data.filters.divisionFilter}`
    : 'All Departments';
  const teamLabel = data.teamName
    ? `Team: ${data.teamName}`
    : (data.teamFilter && data.teamFilter !== 'all' ? `Team: ${data.teamFilter}` : 'All Teams');
  const filterLabel = `${divLabel} · ${teamLabel}`;

  const sgaDisplay = data.sgaMonthsCovered !== null
    ? `${fmtFixed(data.sgaMonthsCovered, 1)} months`
    : '— (SG&A not configured)';

  const rows = [
    buildSectionHeader('Backlog Burn by Fiscal Year'),
    buildMetricRow('Remaining Backlog to Burn in the Current Fiscal Year ($)', fmtDollars(data.currentFYRevenue),    'Backlog',    false, `Remaining backlog that will burn in ${data.currentFY}.`),
    buildMetricRow('Backlog to Burn in Future Fiscal Years ($)',               fmtDollars(data.futureFYRevenue),    'Backlog',    false, `Backlog that will burn after Dec 31, ${data.currentFY}.`),
    buildMetricRow('Total Booked Backlog Revenue ($)',                         fmtDollars(data.totalBacklogRevenue),'Calculated', true,  'Sum of current fiscal year + future fiscal year backlog.'),

    buildSectionHeader('Gross Margin on Backlog'),
    buildMetricRow(`Gross Margin on Backlog that will Burn in the Current Fiscal Year ($)`, fmtDollars(data.currentFYGM),  'Backlog',    false, `Gross margin on backlog burning in ${data.currentFY}.`),
    buildMetricRow('Gross Margin on Backlog that will Burn in Future Fiscal Years ($)',   fmtDollars(data.futureFYGM),   'Backlog',    false, 'Gross margin expected on backlog burning in future years.'),
    buildMetricRow('Total Booked Backlog Gross Margin ($)',                               fmtDollars(data.totalBacklogGM),'Calculated', true,  'Total GM across all booked backlog.'),
    buildMetricRow('Number of Months SG&A Covered by Gross Margin on Backlog',           sgaDisplay,                    'Calculated', true,
      data.monthlySgAndA
        ? `Based on monthly SG&A of ${fmtDollars(data.monthlySgAndA)}${data.totalBacklogRevenue > 0 ? ' (' + ((data.monthlySgAndA * 12) / data.totalBacklogRevenue * 100).toFixed(1) + '% of rev)' : ''}.`
        : 'Configure monthly SG&A in report settings.'),

    buildSectionHeader('Pipeline Backlog'),
    buildMetricRow('Backlog Sold (Not Yet Contracted) ($)', fmtDollars(data.backlogSoldNotContracted), 'Pipeline', false, 'Awarded opportunities not yet entered in Vista.'),
    buildMetricRow('High Potential Backlog ($)',            fmtDollars(data.highPotentialBacklog),     'Pipeline', false, 'Opportunities with High probability of award.'),
  ].join('');

  const detailSection   = buildContractDetailSection(data.contractDetails || []);
  const pipelineSection = buildPipelineSection(data.awardedNotInVistaOpps || [], data.highPotentialOpps || []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; color: #1f2937; }

    .page { width: 1060px; margin: 0 auto; padding: 1rem; }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1rem 1.25rem;
      background: linear-gradient(135deg, #1a2b4a 0%, #2d4a7a 100%);
      border-bottom: 3px solid #f97316;
      margin-bottom: 1.25rem;
      border-radius: 6px 6px 0 0;
    }
    .report-title { color: #ffffff; }
    .report-title h1 { font-size: 1.4rem; font-weight: 700; letter-spacing: 0.02em; }
    .report-title .subtitle { font-size: 0.78rem; color: #94a3b8; margin-top: 0.25rem; }
    .report-meta { text-align: right; color: #94a3b8; font-size: 0.7rem; }
    .report-meta .date { color: #ffffff; font-weight: 600; margin-bottom: 0.25rem; }

    .summary-row { display: flex; gap: 0.75rem; margin-bottom: 1.25rem; }
    .summary-card {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 0.75rem;
      background: #f9fafb;
    }
    .summary-card.highlight { background: #eff6ff; border-color: #3b82f6; }
    .summary-card.orange    { background: #fff7ed; border-color: #f97316; }
    .card-label { font-size: 0.62rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }
    .card-value { font-size: 1.1rem; font-weight: 700; color: #1a2b4a; }
    .card-sub   { font-size: 0.62rem; color: #9ca3af; margin-top: 0.15rem; }

    .metrics-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .metrics-table th {
      background: #f1f5f9;
      padding: 0.45rem 0.6rem;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #475569;
      text-align: left;
      border-bottom: 2px solid #e5e7eb;
    }
    .metrics-table th:nth-child(3) { text-align: right; }

    .footer {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 0.62rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
<div class="page">

  <div class="report-header">
    <div class="report-title">
      <h1>Backlog Analysis</h1>
      <div class="subtitle">Fiscal Year Burn, Gross Margin Coverage &amp; Pipeline Summary · ${filterLabel}</div>
    </div>
    <div class="report-meta">
      <div class="date">${dateStr}</div>
      <div>Generated by ${generatedBy || 'Titan PM'}</div>
      <div>Fiscal Year Jan 1 – Dec 31, ${data.currentFY}</div>
    </div>
  </div>

  <div class="summary-row">
    <div class="summary-card highlight">
      <div class="card-label">Total Booked Backlog</div>
      <div class="card-value">${fmtCurrency(data.totalBacklogRevenue)}</div>
      <div class="card-sub">Current Fiscal Year + Future Fiscal Years</div>
    </div>
    <div class="summary-card highlight">
      <div class="card-label">Total Backlog GM</div>
      <div class="card-value">${fmtCurrency(data.totalBacklogGM)}</div>
      <div class="card-sub">${data.totalBacklogRevenue > 0 ? ((data.totalBacklogGM / data.totalBacklogRevenue) * 100).toFixed(1) + '% blended GM' : '—'}</div>
    </div>
    <div class="summary-card">
      <div class="card-label">SG&amp;A Months Covered</div>
      <div class="card-value">${data.sgaMonthsCovered !== null ? fmtFixed(data.sgaMonthsCovered, 1) : '—'}</div>
      <div class="card-sub">${data.monthlySgAndA
        ? 'Monthly SG&A: ' + fmtCurrency(data.monthlySgAndA) +
          (data.totalBacklogRevenue > 0
            ? ' (' + ((data.monthlySgAndA * 12) / data.totalBacklogRevenue * 100).toFixed(1) + '% of rev)'
            : '')
        : 'SG&A not configured'}</div>
    </div>
    <div class="summary-card orange">
      <div class="card-label">Pipeline (Awarded + High Potential)</div>
      <div class="card-value">${fmtCurrency(data.backlogSoldNotContracted + data.highPotentialBacklog)}</div>
      <div class="card-sub">Sold: ${fmtCurrency(data.backlogSoldNotContracted)} · Hi-Prob: ${fmtCurrency(data.highPotentialBacklog)}</div>
    </div>
  </div>

  <table class="metrics-table">
    <thead>
      <tr>
        <th style="width: 90px;">Category</th>
        <th>Metric</th>
        <th style="width: 150px; text-align: right;">Value</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  ${detailSection}
  ${pipelineSection}

  <div class="footer">
    <span>Titan PM · Backlog Analysis Report · ${dateStr}</span>
    <span>Data source: Vista ERP + Titan PM pipeline · Fiscal Year ${data.currentFY} (Jan 1 – Dec 31)</span>
  </div>

</div>
</body>
</html>`;
}

module.exports = { generateBacklogAnalysisPdfHtml };
