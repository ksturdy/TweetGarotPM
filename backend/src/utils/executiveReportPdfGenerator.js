/**
 * Generate HTML for Executive Report PDF
 * Layout: 4 category cards per page in a 2x2 grid
 */

const fmtCurrency = (value) => {
  const abs = Math.abs(value || 0);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtPercent = (value) => `${((value || 0) * 100).toFixed(1)}%`;

const fmtNumber = (value) => Math.round(value || 0).toLocaleString('en-US');

const formatValue = (value, formatType) => {
  switch (formatType) {
    case 'currency': return fmtCurrency(value);
    case 'percent': return fmtPercent(value);
    case 'number': return fmtNumber(value);
    default: return String(value);
  }
};

const formatChange = (change, formatType) => {
  const sign = change > 0 ? '+' : '';
  switch (formatType) {
    case 'currency': return `${sign}${fmtCurrency(change)}`;
    case 'percent': return `${sign}${(change * 100).toFixed(1)}pp`;
    case 'number': return `${sign}${fmtNumber(change)}`;
    default: return `${sign}${change}`;
  }
};

const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getRankStyle = (rank) => {
  if (rank === 1) return 'background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #78350f;';
  if (rank === 2) return 'background: linear-gradient(135deg, #d1d5db, #9ca3af); color: #374151;';
  if (rank === 3) return 'background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff;';
  return 'background: #f3f4f6; color: #6b7280;';
};

function generateCategoryCardHtml(category, hasPrevious) {
  if (!category.items || category.items.length === 0) return '';

  const rows = category.items.map(item => {
    const changeHtml = hasPrevious && item.previousValue !== null && item.change !== 0
      ? `<span style="font-size: 6.5pt; font-weight: 600; color: ${item.change > 0 ? '#059669' : '#dc2626'};">
           ${item.change > 0 ? '▲' : '▼'} ${formatChange(item.change, category.formatType)}
         </span>`
      : '';

    return `
      <tr>
        <td style="width: 24px; padding: 3px 0 3px 12px;">
          <div style="width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 7pt; font-weight: 700; ${getRankStyle(item.rank)}">
            ${item.rank}
          </div>
        </td>
        <td style="padding: 3px 6px; max-width: 200px;">
          <div style="font-size: 7.5pt; font-weight: 600; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.projectName || ''}</div>
          <div style="font-size: 6.5pt; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.projectNumber || ''}${item.managerName ? ' · ' + item.managerName : ''}</div>
        </td>
        <td style="text-align: right; padding: 3px 12px 3px 0; white-space: nowrap;">
          <div style="font-size: 7.5pt; font-weight: 700; color: #002356;">${formatValue(item.value, category.formatType)}</div>
          ${changeHtml}
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-header" style="border-left: 4px solid ${category.color};">
        <div style="font-size: 10pt; font-weight: 700; color: #002356;">${category.title}</div>
        <div style="font-size: 7pt; color: #9ca3af; font-weight: 500;">${category.subtitle}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${rows}
      </table>
    </div>`;
}

function generateExecutiveReportPdfHtml(reportData) {
  const { reportDate, previousDate, summary, categories } = reportData;
  const hasPrevious = !!previousDate;

  // Filter out empty categories
  const activeCategories = (categories || []).filter(c => c.items && c.items.length > 0);

  // Build KPI row
  const kpiItems = summary ? [
    { label: 'Total Projects', value: (summary.totalProjects || 0).toLocaleString(), color: '#002356' },
    { label: 'Contract Value', value: fmtCurrency(summary.totalContractValue), color: '#F37B03' },
    { label: 'Gross Profit', value: fmtCurrency(summary.totalGrossProfit), color: '#059669' },
    { label: 'Avg GP%', value: fmtPercent(summary.avgGrossMarginPct), color: '#7c3aed' },
    { label: 'Backlog', value: fmtCurrency(summary.totalBacklog), color: '#0891b2' },
    { label: 'Earned Revenue', value: fmtCurrency(summary.totalEarnedRevenue), color: '#4f46e5' },
  ] : [];

  const kpiHtml = kpiItems.length > 0 ? `
    <div class="kpi-row">
      ${kpiItems.map(kpi => `
        <div class="kpi-card">
          <div style="width: 6px; height: 100%; background: ${kpi.color}; border-radius: 3px; flex-shrink: 0;"></div>
          <div>
            <div style="font-size: 11pt; font-weight: 700; color: #002356;">${kpi.value}</div>
            <div style="font-size: 6.5pt; color: #6b7280;">${kpi.label}</div>
          </div>
        </div>
      `).join('')}
    </div>` : '';

  // Build card pages: 4 cards per page including page 1
  const pages = [];

  // Page 1: compact header + KPIs + first 4 cards
  const page1Cards = activeCategories.slice(0, 4);
  const page1CardsHtml = page1Cards.map(c => generateCategoryCardHtml(c, hasPrevious)).join('');

  pages.push(`
    <div class="page">
      <div class="report-header">
        <div>
          <h1 style="font-size: 18pt; font-weight: 700; color: #002356; margin: 0;">Executive Report</h1>
          <p style="font-size: 9pt; color: #6b7280; margin: 2px 0 0 0;">Weekly Top 10 Performance Snapshot</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 9pt; font-weight: 600; color: #002356;">Week of ${formatDateLabel(reportDate)}</div>
          ${hasPrevious ? `<div style="font-size: 7pt; color: #9ca3af;">vs. ${formatDateLabel(previousDate)}</div>` : ''}
        </div>
      </div>
      ${kpiHtml}
      <div class="card-grid">
        ${page1CardsHtml}
      </div>
    </div>`);

  // Remaining cards: 4 per page
  const remaining = activeCategories.slice(4);
  for (let i = 0; i < remaining.length; i += 4) {
    const chunk = remaining.slice(i, i + 4);
    const cardsHtml = chunk.map(c => generateCategoryCardHtml(c, hasPrevious)).join('');
    pages.push(`
      <div class="page">
        <div class="card-grid">
          ${cardsHtml}
        </div>
      </div>`);
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: letter;
      margin: 0.4in;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      line-height: 1.3;
      font-size: 8pt;
      margin: 0;
      padding: 0;
    }

    .page {
      page-break-after: always;
      position: relative;
    }
    .page:last-child {
      page-break-after: auto;
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 8px;
      border-bottom: 2px solid #002356;
      margin-bottom: 10px;
    }

    .kpi-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 6px 8px;
    }

    .card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 8px;
      flex: 1;
    }

    .card {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .card-header {
      padding: 4px 8px;
      background: #f9fafb;
      border-bottom: 1px solid #f3f4f6;
    }
    .card table {
      width: 100%;
    }
    .card td {
      padding: 1.5px 4px;
      border-bottom: 1px solid #f9fafb;
      vertical-align: middle;
    }
    .card tr:last-child td {
      border-bottom: none;
    }
  </style>
</head>
<body>
  ${pages.join('')}
</body>
</html>`;
}

module.exports = { generateExecutiveReportPdfHtml };
