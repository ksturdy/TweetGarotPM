/**
 * Generate HTML for the Monthly Projections Report PDF (server-side, Puppeteer).
 */

const fmt$ = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmt$Signed = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '-';
  const f = `$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
  return n > 0 ? `+${f}` : `(${f})`;
};

const fmtPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${(n * 100).toFixed(1)}%`;
};

const fmtPctSigned = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '-';
  const sign = n > 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(2)}pp`;
};

const fmtNum = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('en-US');
};

const fmtNumSigned = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '-';
  const f = Math.abs(Math.round(n)).toLocaleString('en-US');
  return n > 0 ? `+${f}` : `-${f}`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const goodColor = (v) => (!v ? '#475569' : v > 0 ? '#15803d' : '#b91c1c');
const costColor = (v) => (!v ? '#475569' : v > 0 ? '#b91c1c' : '#15803d');

const METRICS = [
  { label: 'Contract Amount', key: 'contract_amount', kind: 'money' },
  { label: 'Approved Changes', key: 'approved_changes', kind: 'money' },
  { label: 'Pending Change Orders', key: 'pending_change_orders', kind: 'money' },
  { label: 'Projected Revenue', key: 'projected_revenue', kind: 'money' },
  { label: 'Earned Revenue', key: 'earned_revenue', kind: 'money' },
  { label: 'Backlog', key: 'backlog', kind: 'money' },
  { label: '% Complete', key: 'percent_complete', kind: 'pct' },
  { label: 'Projected Cost @ Completion', key: 'projected_cost', kind: 'money', costSign: true },
  { label: 'Current Est Cost', key: 'current_est_cost', kind: 'money', costSign: true },
  { label: 'Gross Profit $', key: 'gross_profit_dollars', kind: 'money' },
  { label: 'Gross Profit %', key: 'gross_profit_percent', kind: 'pct' },
  { label: 'Billed', key: 'billed_amount', kind: 'money' },
  { label: 'Open Receivables', key: 'open_receivables', kind: 'money' },
  { label: 'Cash Flow', key: 'cash_flow', kind: 'money' },
  { label: 'Total Hours JTD', key: 'total_hours_jtd', kind: 'num' },
  { label: 'Total Hours Projected', key: 'total_hours_projected', kind: 'num', costSign: true },
  { label: 'Actual Labor Rate', key: 'actual_labor_rate', kind: 'money', costSign: true },
];

function fmtCell(value, kind) {
  if (kind === 'money') return fmt$(value);
  if (kind === 'pct') return fmtPct(value);
  return fmtNum(value);
}

function fmtDelta(value, kind) {
  if (kind === 'money') return fmt$Signed(value);
  if (kind === 'pct') return fmtPctSigned(value);
  return fmtNumSigned(value);
}

function metricRow(m, cur, prior, d) {
  const curV = cur[m.key];
  const priorV = prior ? prior[m.key] : null;
  const dV = d ? d[m.key] : 0;
  // Hide rows where delta is 0 AND both prior and current are zero/null
  if (dV === 0 && num(curV) === 0 && num(priorV) === 0 && prior) return '';
  const color = m.costSign ? costColor(dV) : goodColor(dV);
  return `
    <tr>
      <td style="padding:3px 6px; border-bottom:1px solid #f1f5f9; color:#475569;">${esc(m.label)}</td>
      <td style="padding:3px 6px; border-bottom:1px solid #f1f5f9; text-align:right; font-variant-numeric:tabular-nums;">${fmtCell(priorV, m.kind)}</td>
      <td style="padding:3px 6px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:600; font-variant-numeric:tabular-nums;">${fmtCell(curV, m.kind)}</td>
      <td style="padding:3px 6px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:600; color:${color}; font-variant-numeric:tabular-nums;">${dV != null ? fmtDelta(dV, m.kind) : '—'}</td>
    </tr>
  `;
}

function notesSection(notes) {
  if (!notes.length) return '<div style="color:#cbd5e1; font-style:italic; font-size:9pt;">None</div>';
  return notes.map(n => `
    <div style="padding:4px 0; border-bottom:1px solid #f1f5f9;">
      ${n.category ? `<span style="display:inline-block; font-size:7pt; color:#0369a1; background:#e0f2fe; border:1px solid #bae6fd; border-radius:9999px; padding:1px 6px; margin-bottom:2px;">${esc(n.category)}</span>` : ''}
      <div style="font-size:9pt; color:#1e293b; white-space:pre-wrap;">${esc(n.body)}</div>
      <div style="font-size:7.5pt; color:#94a3b8; margin-top:2px;">${esc(n.created_by_name)} · ${fmtDate(n.created_at)}</div>
    </div>
  `).join('');
}

function tasksSection(tasks) {
  if (!tasks.length) return '<div style="color:#cbd5e1; font-style:italic; font-size:9pt;">None</div>';
  return tasks.map(t => {
    const done = t.status === 'done';
    const pill = done
      ? '<span style="display:inline-block; font-size:7pt; color:#15803d; background:#dcfce7; border:1px solid #86efac; border-radius:9999px; padding:1px 6px;">Done</span>'
      : '<span style="display:inline-block; font-size:7pt; color:#b45309; background:#fef3c7; border:1px solid #fde68a; border-radius:9999px; padding:1px 6px;">Open</span>';
    return `
      <div style="padding:4px 0; border-bottom:1px solid #f1f5f9;">
        <div style="font-size:9pt; color:#1e293b; ${done ? 'text-decoration:line-through; opacity:0.55;' : ''}">
          ${pill} ${esc(t.body)}
        </div>
        <div style="font-size:7.5pt; color:#94a3b8; margin-top:2px;">
          ${t.assigned_to_name ? `👤 ${esc(t.assigned_to_name)} · ` : ''}
          ${t.due_date ? `📅 ${fmtDate(t.due_date)} · ` : ''}
          ${esc(t.created_by_name)}
        </div>
      </div>
    `;
  }).join('');
}

function gainFadeSection(gf) {
  if (!gf.items.length) return '<div style="color:#cbd5e1; font-style:italic; font-size:9pt;">None</div>';
  const rows = gf.items.map(g => {
    const v = num(g.amount);
    const color = v >= 0 ? '#15803d' : '#b91c1c';
    return `
      <div style="padding:4px 0; border-bottom:1px solid #f1f5f9;">
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <div style="flex:1; font-size:9pt; color:#1e293b;">${esc(g.body)}</div>
          <div style="font-weight:600; color:${color}; font-variant-numeric:tabular-nums;">${fmt$Signed(v)}</div>
        </div>
        <div style="font-size:7.5pt; color:#94a3b8; margin-top:2px;">
          ${g.groups_affected && g.groups_affected.length ? `${esc(g.groups_affected.join(', '))} · ` : ''}
          <span style="color:${g.recognized_in_financials ? '#15803d' : '#b45309'};">${g.recognized_in_financials ? 'Recognized' : 'Unrecognized'}</span>
        </div>
      </div>
    `;
  }).join('');

  const t = gf.totals;
  const totals = `
    <div style="border-top:1px solid #cbd5e1; margin-top:6px; padding-top:6px; font-size:8.5pt;">
      <div style="display:flex; justify-content:space-between; padding:1px 0;">
        <span style="color:#64748b;">Gain</span>
        <span style="color:#15803d; font-variant-numeric:tabular-nums;">${fmt$Signed(t.gain)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:1px 0;">
        <span style="color:#64748b;">Fade</span>
        <span style="color:#b91c1c; font-variant-numeric:tabular-nums;">${fmt$Signed(t.fade)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:1px 0; font-weight:700;">
        <span>Net</span>
        <span style="color:${t.net >= 0 ? '#15803d' : '#b91c1c'}; font-variant-numeric:tabular-nums;">${fmt$Signed(t.net)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:1px 0;">
        <span style="font-style:italic; color:#b45309;">Unrecognized</span>
        <span style="color:#b45309; font-variant-numeric:tabular-nums;">${fmt$Signed(t.unrecognized)}</span>
      </div>
    </div>
  `;
  return rows + totals;
}

function projectSection(p, index) {
  const cur = p.current_snapshot;
  const prior = p.prior_snapshot;
  const d = p.deltas;

  const rows = METRICS.map(m => metricRow(m, cur, prior, d)).filter(Boolean).join('');
  const hasAnyContent = rows.length > 0 || p.notes.length > 0 || p.tasks.length > 0 || p.gain_fade.items.length > 0;

  const pageBreak = index > 0 ? 'page-break-before:always;' : '';

  return `
    <div style="${pageBreak} padding-top:8px;">
      <div style="border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:8px;">
        <div style="font-size:13pt; font-weight:700; color:#1e293b;">
          ${esc(p.project_number)} — ${esc(p.project_name)}
        </div>
        <div style="font-size:9pt; color:#64748b; margin-top:2px;">
          <strong>PM:</strong> ${esc(p.pm_name || '—')}
          ${p.department_name ? ` · <strong>Dept:</strong> ${esc(p.department_name)}` : ''}
        </div>
        ${!prior ? '<div style="font-size:8.5pt; color:#b45309; margin-top:3px;">No prior snapshot — first projection for this project.</div>' : ''}
      </div>

      ${rows ? `
        <table style="width:100%; border-collapse:collapse; font-size:9pt; margin-bottom:10px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:5px 6px; text-align:left; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Metric</th>
              <th style="padding:5px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">
                Prior<br/>
                <span style="display:block; font-size:8pt; font-weight:500; color:#475569; text-transform:none; letter-spacing:normal; margin-top:2px;">${fmtDate(prior?.snapshot_date)}</span>
              </th>
              <th style="padding:5px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">
                Current<br/>
                <span style="display:block; font-size:8pt; font-weight:500; color:#475569; text-transform:none; letter-spacing:normal; margin-top:2px;">${fmtDate(cur.snapshot_date)}</span>
              </th>
              <th style="padding:5px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Change</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      ` : !hasAnyContent ? `
        <div style="padding:6px 0; color:#94a3b8; font-size:9pt; font-style:italic;">No financial changes in this projection cycle.</div>
      ` : ''}

      <div style="display:flex; gap:10px;">
        <div style="flex:1; background:#fafbfc; border:1px solid #e2e8f0; border-radius:5px; padding:6px 8px;">
          <div style="font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; margin-bottom:4px;">
            Notes (${p.notes.length})
          </div>
          ${notesSection(p.notes)}
        </div>
        <div style="flex:1; background:#fafbfc; border:1px solid #e2e8f0; border-radius:5px; padding:6px 8px;">
          <div style="font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; margin-bottom:4px;">
            Tasks (${p.tasks.filter(t => t.status === 'open').length} open / ${p.tasks.length})
          </div>
          ${tasksSection(p.tasks)}
        </div>
        <div style="flex:1; background:#fafbfc; border:1px solid #e2e8f0; border-radius:5px; padding:6px 8px;">
          <div style="font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; margin-bottom:4px;">
            Gain / Fade (${p.gain_fade.items.length})
          </div>
          ${gainFadeSection(p.gain_fade)}
        </div>
      </div>
    </div>
  `;
}

function rollupTable(rows, label) {
  if (!rows.length) return '';
  const trs = rows.map(r => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:4px 6px; font-weight:600; font-size:8.5pt;">${esc(r.name)}</td>
      <td style="padding:4px 6px; text-align:right; font-size:8.5pt;">${r.project_count}</td>
      <td style="padding:4px 6px; text-align:right; font-size:8.5pt; color:${goodColor(r.revenue_delta)}; font-variant-numeric:tabular-nums;">${fmt$Signed(r.revenue_delta)}</td>
      <td style="padding:4px 6px; text-align:right; font-size:8.5pt; color:${costColor(r.projected_cost_delta)}; font-variant-numeric:tabular-nums;">${fmt$Signed(r.projected_cost_delta)}</td>
      <td style="padding:4px 6px; text-align:right; font-size:8.5pt; color:${goodColor(r.gross_profit_delta)}; font-variant-numeric:tabular-nums;">${fmt$Signed(r.gross_profit_delta)}</td>
      <td style="padding:4px 6px; text-align:right; font-size:8.5pt; color:${r.open_tasks > 0 ? '#b45309' : '#475569'};">${r.open_tasks}</td>
      <td style="padding:4px 6px; text-align:right; font-size:8.5pt; color:${goodColor(r.net_gain_fade)}; font-variant-numeric:tabular-nums;">${fmt$Signed(r.net_gain_fade)}</td>
      <td style="padding:4px 6px; text-align:right; font-size:8.5pt; color:${r.unrecognized_gain_fade !== 0 ? '#b45309' : '#475569'}; font-variant-numeric:tabular-nums;">${fmt$Signed(r.unrecognized_gain_fade)}</td>
    </tr>
  `).join('');
  return `
    <div style="margin-top:14px;">
      <div style="font-size:10pt; font-weight:700; color:#1e293b; margin-bottom:6px;">Roll-up by ${esc(label)}</div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:4px 6px; text-align:left; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">${esc(label)}</th>
            <th style="padding:4px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Projects</th>
            <th style="padding:4px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Revenue Δ</th>
            <th style="padding:4px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Proj Cost Δ</th>
            <th style="padding:4px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Gross Profit Δ</th>
            <th style="padding:4px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Open Tasks</th>
            <th style="padding:4px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Net G/F</th>
            <th style="padding:4px 6px; text-align:right; font-size:7.5pt; font-weight:700; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0;">Unrecognized G/F</th>
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  `;
}

function buildCoverPage(data, filterContext) {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  let revDelta = 0, costDelta = 0, gpDelta = 0, openTasks = 0, netGF = 0, unrecGF = 0;
  for (const p of data.projects) {
    if (p.deltas) {
      revDelta += num(p.deltas.projected_revenue);
      costDelta += num(p.deltas.projected_cost);
      gpDelta += num(p.deltas.gross_profit_dollars);
    }
    openTasks += p.open_tasks || 0;
    netGF += num(p.gain_fade.totals.net);
    unrecGF += num(p.gain_fade.totals.unrecognized);
  }

  const kpi = (label, value, color) => `
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; min-width:130px;">
      <div style="font-size:7.5pt; font-weight:700; color:#64748b; text-transform:uppercase;">${esc(label)}</div>
      <div style="font-size:13pt; font-weight:700; color:${color || '#1e293b'}; font-variant-numeric:tabular-nums; margin-top:2px;">${esc(value)}</div>
    </div>
  `;

  return `
    <div style="padding:8px 0;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1e293b; padding-bottom:10px; margin-bottom:14px;">
        <div>
          <div style="font-size:20pt; font-weight:700; color:#1e293b;">Monthly Projections Report</div>
          <div style="font-size:10pt; color:#64748b; margin-top:3px;">
            ${esc(filterContext)}
          </div>
        </div>
        <div style="text-align:right; font-size:9pt; color:#64748b;">
          <div>Generated</div>
          <div style="font-weight:600; color:#1e293b;">${esc(dateLabel)}</div>
        </div>
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
        ${kpi('Projects', String(data.projects.length))}
        ${kpi('Revenue Δ', fmt$Signed(revDelta), goodColor(revDelta))}
        ${kpi('Proj Cost Δ', fmt$Signed(costDelta), costColor(costDelta))}
        ${kpi('Gross Profit Δ', fmt$Signed(gpDelta), goodColor(gpDelta))}
        ${kpi('Open Tasks', String(openTasks), openTasks > 0 ? '#b45309' : null)}
        ${kpi('Net Gain / Fade', fmt$Signed(netGF), goodColor(netGF))}
        ${kpi('Unrecognized G/F', fmt$Signed(unrecGF), unrecGF !== 0 ? '#b45309' : null)}
      </div>

      ${rollupTable(data.rollup_by_pm, 'PM')}
      ${rollupTable(data.rollup_by_department, 'Department')}
    </div>
  `;
}

/**
 * Build a human-readable description of the active filters for the cover page.
 */
function describeFilters({ teamNames, pmNames, departmentNames, startDate, endDate }) {
  const parts = [];
  if (teamNames && teamNames.length) {
    parts.push(teamNames.length === 1 ? `${teamNames[0]} Team` : `Teams: ${teamNames.join(', ')}`);
  }
  if (pmNames && pmNames.length) {
    parts.push(pmNames.length === 1 ? `PM: ${pmNames[0]}` : `${pmNames.length} PMs selected`);
  }
  if (departmentNames && departmentNames.length) {
    parts.push(departmentNames.length === 1 ? `Dept: ${departmentNames[0]}` : `Departments: ${departmentNames.join(', ')}`);
  }
  if (startDate || endDate) {
    parts.push(`${startDate || ''} — ${endDate || 'today'}`.trim());
  }
  return parts.length ? parts.join(' · ') : 'All Projects';
}

function generateProjectionsReportPdfHtml(report, filterContext) {
  const contextLine = describeFilters(filterContext);
  const cover = buildCoverPage(report, contextLine);
  const projects = report.projects.map((p, i) => projectSection(p, i)).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
    }
    table { border-collapse: collapse; }
    @page { size: Letter landscape; margin: 0.4in; }
  </style>
</head>
<body>
  ${cover}
  ${projects ? `<div style="page-break-before:always;"></div>${projects}` : ''}
</body>
</html>`;
}

module.exports = { generateProjectionsReportPdfHtml };
