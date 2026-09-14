const fmtHours = (v) => {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

function buildFilterLabel(filters) {
  const parts = [];
  if (filters.departments && filters.departments.length > 0) parts.push(`Dept: ${filters.departments.join(', ')}`);
  if (filters.statuses && filters.statuses.length > 0) parts.push(`Status: ${filters.statuses.join(', ')}`);
  if (filters.bill_methods && filters.bill_methods.length > 0) parts.push(`Bill Method: ${filters.bill_methods.join(', ')}`);
  if (filters.teamNames && filters.teamNames.length > 0) parts.push(`Team: ${filters.teamNames.join(', ')}`);
  if (filters.phases && filters.phases.length > 0) parts.push(`Phase: ${filters.phases.join(', ')}`);
  if (filters.phase_prefix) parts.push(`Phase Starts With: ${filters.phase_prefix}`);
  return parts.length > 0 ? parts.join('  ·  ') : 'All Jobs';
}

function generatePhaseReportPdfHtml(rows, filters = {}) {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const filterLabel = buildFilterLabel(filters);

  const totalEst = rows.reduce((s, r) => s + (Number(r.est_hours) || 0), 0);
  const totalJtd = rows.reduce((s, r) => s + (Number(r.jtd_hours) || 0), 0);

  const distinctJobs = new Set(rows.map(r => r.job_number)).size;

  const tableRows = rows.map((r, i) => {
    const est = Number(r.est_hours) || 0;
    const jtd = Number(r.jtd_hours) || 0;
    const variance = est > 0 ? ((jtd / est) * 100) : null;
    const varColor = variance === null ? '#64748b' : variance > 110 ? '#dc2626' : variance > 90 ? '#d97706' : '#16a34a';
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `
      <tr style="background:${bg};">
        <td style="padding:5px 6px; font-weight:600; color:#1e3a5f; white-space:nowrap;">${r.job_number || '-'}</td>
        <td style="padding:5px 6px; color:#334155;">${r.job_name || '-'}</td>
        <td style="padding:5px 6px; color:#475569; white-space:nowrap;">${r.manager_name || '-'}</td>
        <td style="padding:5px 6px; font-weight:500; color:#1e3a5f; white-space:nowrap;">${r.phase_code || '-'}</td>
        <td style="padding:5px 6px; color:#475569;">${r.phase_name || '-'}</td>
        <td style="padding:5px 6px; color:#475569; text-align:center;">${r.department_code || '-'}</td>
        <td style="padding:5px 6px; color:#475569; text-align:center;">${r.status || '-'}</td>
        <td style="padding:5px 6px; color:#475569; text-align:center;">${r.bill_method || '-'}</td>
        <td style="padding:5px 6px; text-align:right; font-weight:600;">${fmtHours(r.est_hours)}</td>
        <td style="padding:5px 6px; text-align:right; font-weight:600;">${fmtHours(r.jtd_hours)}</td>
        <td style="padding:5px 6px; text-align:right; font-weight:600; color:${varColor};">${variance !== null ? variance.toFixed(1) + '%' : '-'}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; }
  .header { background: linear-gradient(135deg, #1a2b4a 0%, #002356 100%); color: #fff; padding: 14px 20px 10px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-title { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
  .header-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .header-date { font-size: 9px; color: #94a3b8; text-align: right; }
  .filter-bar { background: #f1f5f9; padding: 6px 20px; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #475569; }
  .summary { display: flex; gap: 12px; padding: 10px 20px; background: #fff; border-bottom: 2px solid #e2e8f0; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; min-width: 120px; }
  .kpi-label { font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.05em; }
  .kpi-value { font-size: 16px; font-weight: 700; color: #1a2b4a; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1a2b4a; color: #fff; }
  thead th { padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  thead th.right { text-align: right; }
  thead th.center { text-align: center; }
  tfoot tr { background: #1a2b4a; color: #fff; }
  tfoot td { padding: 6px 8px; font-size: 9px; font-weight: 700; }
  tfoot td.right { text-align: right; }
  tr:hover td { background: #eff6ff !important; }
  .orange-bar { height: 3px; background: linear-gradient(90deg, #F37B03, #f97316); }
</style>
</head>
<body>
  <div class="orange-bar"></div>
  <div class="header">
    <div>
      <div class="header-title">Phase Report</div>
      <div class="header-sub">Tweet Garot Mechanical &mdash; Vista Job Hours by Phase</div>
    </div>
    <div class="header-date">Generated: ${dateLabel}<br>${distinctJobs} job${distinctJobs !== 1 ? 's' : ''} · ${rows.length} phase${rows.length !== 1 ? 's' : ''}</div>
  </div>
  <div class="filter-bar">Filters: ${filterLabel}</div>
  <div class="summary">
    <div class="kpi">
      <div class="kpi-label">Total Jobs</div>
      <div class="kpi-value">${distinctJobs.toLocaleString()}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Est Hours</div>
      <div class="kpi-value">${fmtHours(totalEst)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total JTD Hours</div>
      <div class="kpi-value">${fmtHours(totalJtd)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Burn %</div>
      <div class="kpi-value">${totalEst > 0 ? ((totalJtd / totalEst) * 100).toFixed(1) + '%' : '-'}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Job #</th>
        <th>Job Name</th>
        <th>PM</th>
        <th>Phase Code</th>
        <th>Phase Name</th>
        <th class="center">Dept</th>
        <th class="center">Status</th>
        <th class="center">Bill Method</th>
        <th class="right">Est Hours</th>
        <th class="right">JTD Hours</th>
        <th class="right">Burn %</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="8" style="font-weight:700;">TOTAL (${distinctJobs} jobs · ${rows.length} phases)</td>
        <td class="right">${fmtHours(totalEst)}</td>
        <td class="right">${fmtHours(totalJtd)}</td>
        <td class="right">${totalEst > 0 ? ((totalJtd / totalEst) * 100).toFixed(1) + '%' : '-'}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

module.exports = { generatePhaseReportPdfHtml };
