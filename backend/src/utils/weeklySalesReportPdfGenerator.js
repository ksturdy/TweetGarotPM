/**
 * Generate HTML for Weekly Sales Report PDF (server-side, Puppeteer)
 * Styled to match the Cash Flow Report PDF.
 */

const fmtCurrency = (v) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '$0';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3).toLocaleString('en-US')}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmtDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const LOC_META = {
  NEW:  { label: 'De Pere, WI', color: '#3b82f6' },
  CW:   { label: 'Wisconsin Rapids, WI',  color: '#8b5cf6' },
  WW:   { label: 'Altoona, WI',  color: '#f59e0b' },
  AZ:   { label: 'Tempe, AZ',   color: '#ef4444' },
  NONE: { label: 'Unassigned',  color: '#64748b' },
};

/**
 * Generate complete HTML for the Weekly Sales Report PDF.
 * @param {Object} data - Report data from buildWeeklySalesData()
 * @param {string} [logoBase64] - Base64 data URL for tenant logo
 * @returns {string} Full HTML document
 */
const fmtPct = (v) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '-';
  return `${Number(v).toFixed(1)}%`;
};

function generateWeeklySalesReportPdfHtml(data, logoBase64 = '') {
  const { week_start, week_end, totals: t, by_location, company_snapshot, new_jobs } = data;

  const startDisplay = new Date(week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDisplay = new Date(week_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // KPI card helper (matches cash flow report style)
  const kpiCard = (label, value, bgColor, borderColor, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 6px 10px; min-width: 0;">
      <div style="font-size: 6.5pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.04em;">${label}</div>
      <div style="font-size: 12pt; font-weight: 700; color: ${valueColor}; white-space: nowrap; margin-top: 1px;">${value}</div>
    </div>`;

  // Build location sections
  let locSectionsHtml = '';
  for (const [code, locData] of Object.entries(by_location)) {
    const meta = LOC_META[code] || { label: code, color: '#64748b' };
    const s = locData.summary;

    // Location header with summary line
    const summaryParts = [];
    summaryParts.push(`${s.new_opp_count} new opps`);
    summaryParts.push(`${fmtCurrency(s.new_opp_value)} value`);
    summaryParts.push(`${s.activity_count} activities`);
    if (s.won_count > 0) summaryParts.push(`<span style="color:#059669;font-weight:600">${s.won_count} won (${fmtCurrency(s.won_value)})</span>`);
    if (s.lost_count > 0) summaryParts.push(`<span style="color:#dc2626;font-weight:600">${s.lost_count} lost</span>`);

    // New Opportunities table
    let oppsTableHtml = '';
    if (locData.new_opportunities.length > 0) {
      const rows = locData.new_opportunities.map((o, i) => {
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
          <tr style="background: ${bgColor};">
            <td style="padding: 4px 8px; font-size: 8pt; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${o.title || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #475569;">${o.customer_name || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; text-align: right; font-weight: 600; color: #1e293b;">${fmtCurrency(o.estimated_value)}</td>
            <td style="padding: 4px 8px; font-size: 8pt;">
              <span style="padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 7pt;
                background: ${(o.stage_color || '#64748b')}18; color: ${o.stage_color || '#64748b'};">
                ${o.stage_name || '-'}
              </span>
            </td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #475569;">${o.assigned_to_name || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #64748b;">${fmtDate(o.created_at)}</td>
          </tr>`;
      }).join('');
      oppsTableHtml = `
        <div style="margin: 8px 14px 6px;">
          <div style="font-size: 8pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">New Opportunities</div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 28%;">Title</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 22%;">Customer</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; width: 12%;">Value</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 12%;">Stage</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 15%;">Owner</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 11%;">Created</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    // Activities table
    let activitiesTableHtml = '';
    if (locData.activities.length > 0) {
      const actColors = { call: '#3b82f6', meeting: '#8b5cf6', email: '#f59e0b', note: '#64748b', task: '#10b981', voice_note: '#06b6d4' };
      const rows = locData.activities.map((a, i) => {
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        const c = actColors[a.activity_type] || '#64748b';
        return `
          <tr style="background: ${bgColor};">
            <td style="padding: 4px 8px; font-size: 8pt;">
              <span style="padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 7pt; background: ${c}18; color: ${c}; text-transform: capitalize;">${(a.activity_type || '').replace('_', ' ')}</span>
            </td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #1e293b;">${a.subject || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #475569;">${a.opportunity_title || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #475569;">${a.created_by_name || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #64748b;">${fmtDate(a.created_at)}</td>
          </tr>`;
      }).join('');
      activitiesTableHtml = `
        <div style="margin: 8px 14px 6px;">
          <div style="font-size: 8pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Activities</div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 12%;">Type</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 30%;">Subject</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 28%;">Opportunity</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 18%;">By</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 12%;">Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    // Won / Lost table
    let wonLostHtml = '';
    if (locData.won_lost.length > 0) {
      const rows = locData.won_lost.map((r, i) => {
        const isWon = /won|awarded/i.test(r.stage_name);
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
          <tr style="background: ${bgColor};">
            <td style="padding: 4px 8px; font-size: 8pt; font-weight: 500; color: #1e293b;">${r.title || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #475569;">${r.customer_name || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; text-align: right; font-weight: 600; color: #1e293b;">${fmtCurrency(r.estimated_value)}</td>
            <td style="padding: 4px 8px; font-size: 8pt;">
              <span style="padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 7pt;
                background: ${isWon ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)'};
                color: ${isWon ? '#059669' : '#dc2626'};">
                ${r.stage_name}
              </span>
            </td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #475569;">${r.assigned_to_name || '-'}</td>
            <td style="padding: 4px 8px; font-size: 8pt; color: #64748b;">${fmtDate(r.updated_at)}</td>
          </tr>`;
      }).join('');
      wonLostHtml = `
        <div style="margin: 8px 14px 6px;">
          <div style="font-size: 8pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Won / Lost</div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 28%;">Title</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 22%;">Customer</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; width: 12%;">Value</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 12%;">Result</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 15%;">Owner</th>
                <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 11%;">Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    locSectionsHtml += `
      <div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
        <!-- Location Header -->
        <div style="padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${meta.color}; background: ${meta.color}08;">
          <span style="font-weight: 700; font-size: 11pt; color: #002356;">${meta.label}</span>
          <span style="font-size: 8pt; color: #64748b;">${summaryParts.join(' &middot; ')}</span>
        </div>
        ${oppsTableHtml}${activitiesTableHtml}${wonLostHtml}
        <div style="height: 6px;"></div>
      </div>`;
  }

  // Logo HTML
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="height: 36px; width: auto; max-width: 160px; object-fit: contain;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: portrait Letter; margin: 0.4in; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; border-bottom: 3px solid #002356; padding-bottom: 10px;">
    <div>
      <div style="font-size: 20pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">WEEKLY SALES REPORT</div>
      <div style="font-size: 11pt; font-weight: 600; color: #475569; margin-top: 2px;">${startDisplay} &ndash; ${endDisplay}</div>
      <div style="font-size: 9pt; color: #6b7280; margin-top: 2px;">Generated ${dateLabel}</div>
    </div>
    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
      ${logoHtml}
      <div style="font-size: 8pt; color: #94a3b8;">${Object.keys(by_location).length} location${Object.keys(by_location).length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  <!-- KPI Summary Cards -->
  <div style="display: flex; gap: 8px; margin-bottom: 14px;">
    ${kpiCard('New Opps', String(t.new_opp_count), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
    ${kpiCard('Pipeline Added', fmtCurrency(t.new_opp_value), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
    ${kpiCard('Activities', String(t.activity_count), '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
    ${kpiCard('Won', `${t.won_count} (${fmtCurrency(t.won_value)})`,
      t.won_count > 0 ? '#f0fdf4' : '#f8fafc',
      t.won_count > 0 ? '#bbf7d0' : '#e2e8f0',
      t.won_count > 0 ? '#166534' : '#64748b',
      t.won_count > 0 ? '#059669' : '#64748b')}
    ${kpiCard('Lost', String(t.lost_count),
      t.lost_count > 0 ? '#fef2f2' : '#f8fafc',
      t.lost_count > 0 ? '#fecaca' : '#e2e8f0',
      t.lost_count > 0 ? '#991b1b' : '#64748b',
      t.lost_count > 0 ? '#dc2626' : '#64748b')}
  </div>

  <!-- Company Snapshot -->
  ${company_snapshot ? (() => {
    return `
  <div style="margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; border-top: 3px solid #002356;">
    <div style="padding: 8px 14px;">
      <div style="font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Company Snapshot</div>
      <div style="display: flex; gap: 28px;">
        <div>
          <div style="font-size: 6.5pt; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Backlog</div>
          <div style="font-size: 14pt; font-weight: 700; color: #002356;">${fmtCurrency(company_snapshot.total_backlog)}</div>
          <div style="font-size: 6pt; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 4px;">GM% in Backlog</div>
          <div style="font-size: 10pt; font-weight: 700; color: ${company_snapshot.weighted_gm_pct != null && company_snapshot.weighted_gm_pct >= 15 ? '#059669' : '#dc2626'};">${fmtPct(company_snapshot.weighted_gm_pct)}</div>
        </div>
        <div>
          <div style="font-size: 6.5pt; color: #64748b; font-weight: 600; text-transform: uppercase;">Backlog (6 Mo Out)</div>
          <div style="font-size: 14pt; font-weight: 700; color: #0369a1;">${fmtCurrency(company_snapshot.backlog_6mo)}</div>
          <div style="font-size: 6pt; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 4px;">GM% in Backlog</div>
          <div style="font-size: 10pt; font-weight: 700; color: ${company_snapshot.backlog_6mo_gm_pct != null && company_snapshot.backlog_6mo_gm_pct >= 15 ? '#059669' : '#dc2626'};">${fmtPct(company_snapshot.backlog_6mo_gm_pct)}</div>
        </div>
        <div>
          <div style="font-size: 6.5pt; color: #64748b; font-weight: 600; text-transform: uppercase;">Backlog (12 Mo Out)</div>
          <div style="font-size: 14pt; font-weight: 700; color: #6366f1;">${fmtCurrency(company_snapshot.backlog_12mo)}</div>
          <div style="font-size: 6pt; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 4px;">GM% in Backlog</div>
          <div style="font-size: 10pt; font-weight: 700; color: ${company_snapshot.backlog_12mo_gm_pct != null && company_snapshot.backlog_12mo_gm_pct >= 15 ? '#059669' : '#dc2626'};">${fmtPct(company_snapshot.backlog_12mo_gm_pct)}</div>
        </div>
        <div>
          <div style="font-size: 6.5pt; color: #64748b; font-weight: 600; text-transform: uppercase;">Average Project GM%</div>
          <div style="font-size: 14pt; font-weight: 700; color: ${company_snapshot.avg_project_gm_pct != null && company_snapshot.avg_project_gm_pct >= 15 ? '#059669' : '#dc2626'};">${fmtPct(company_snapshot.avg_project_gm_pct)}</div>
        </div>
      </div>
    </div>
  </div>`;
  })() : ''}

  <!-- Newly Created Contracts -->
  ${new_jobs && new_jobs.length > 0 ? (() => {
    const oc = (company_snapshot && company_snapshot.gm_override_count) || 0;
    const overrideBadge = oc > 0
      ? `<span style="font-size: 6.5pt; font-weight: 600; color: #d97706; background: rgba(217,119,6,0.1); padding: 1px 6px; border-radius: 3px; margin-left: 8px;">${oc} GM override${oc > 1 ? 's' : ''} applied</span>`
      : '';
    const hasOverrides = new_jobs.some(j => j.gm_overridden);
    const overrideFootnote = hasOverrides
      ? `<div style="padding: 4px 8px 6px; font-size: 7pt; color: #d97706; font-style: italic;">* GM% shown in orange italics has been overridden from the default 100% GM applied on import.</div>`
      : '';
    return `
  <div style="margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; page-break-inside: avoid; border-top: 3px solid #059669;">
    <div style="padding: 8px 14px 6px;">
      <div style="font-size: 8pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Newly Created Contracts (${new_jobs.length})${overrideBadge}</div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 10%;">Contract #</th>
            <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 25%;">Name</th>
            <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 20%;">Customer</th>
            <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; width: 14%;">Contract Value</th>
            <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; width: 8%;">GM%</th>
            <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 14%;">Manager</th>
            <th style="background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; width: 9%;">Created</th>
          </tr>
        </thead>
        <tbody>
          ${new_jobs.map((j, i) => {
            const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
            const isOverridden = j.gm_overridden;
            const gmColor = isOverridden ? '#d97706' : j.gross_margin_percent != null && j.gross_margin_percent >= 15 ? '#059669' : j.gross_margin_percent != null ? '#dc2626' : '#64748b';
            const gmText = j.gross_margin_percent != null ? `${Number(j.gross_margin_percent).toFixed(1)}%${isOverridden ? '*' : ''}` : '-';
            return `
              <tr style="background: ${bgColor};">
                <td style="padding: 4px 8px; font-size: 8pt; font-weight: 600; color: #002356;">${j.number || '-'}</td>
                <td style="padding: 4px 8px; font-size: 8pt; font-weight: 500; color: #1e293b;">${j.name || '-'}</td>
                <td style="padding: 4px 8px; font-size: 8pt; color: #475569;">${j.customer_name || '-'}</td>
                <td style="padding: 4px 8px; font-size: 8pt; text-align: right; font-weight: 600; color: #1e293b;">${fmtCurrency(j.contract_value)}</td>
                <td style="padding: 4px 8px; font-size: 8pt; text-align: right; font-weight: 600; color: ${gmColor};${isOverridden ? ' font-style: italic;' : ''}">${gmText}</td>
                <td style="padding: 4px 8px; font-size: 8pt; color: #475569;">${j.manager_name || '-'}</td>
                <td style="padding: 4px 8px; font-size: 8pt; color: #64748b;">${fmtDate(j.created_at)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${overrideFootnote}
    </div>
  </div>`;
  })() : ''}

  <!-- Location Sections -->
  ${locSectionsHtml}
</body>
</html>`;
}

module.exports = { generateWeeklySalesReportPdfHtml };
