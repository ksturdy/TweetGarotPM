const AUDIT_AREAS = {
  preplanning: 'Preplanning & Safety Documentation',
  housekeeping: 'Housekeeping',
  ppe: 'Proper Use of PPE',
  heights: 'Working at Heights',
  welding: 'Welding/Hot Work',
  material_handling: 'Material Handling',
  power_tools: 'Hand and Power Tool Usage',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '';
  // pg returns DATE columns as JS Date objects; fall back to ISO string parsing
  const dt = d instanceof Date ? d : new Date(String(d).slice(0, 10) + 'T12:00:00Z');
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function answerBadge(answer) {
  if (answer === 'yes') return '<span class="badge badge-yes">YES</span>';
  if (answer === 'no')  return '<span class="badge badge-no">NO</span>';
  if (answer === 'na')  return '<span class="badge badge-na">N/A</span>';
  return '<span class="badge badge-blank">—</span>';
}

function generateObservationPdfHtml(obs, logoBase64 = '') {
  const sections = obs.sections || [];

  const totalYes = sections.reduce((a, s) => a + (s.items || []).filter(i => i.answer === 'yes').length, 0);
  const totalNo  = sections.reduce((a, s) => a + (s.items || []).filter(i => i.answer === 'no').length, 0);
  const totalNa  = sections.reduce((a, s) => a + (s.items || []).filter(i => i.answer === 'na').length, 0);
  const totalItems = sections.reduce((a, s) => a + (s.items || []).length, 0);

  const sectionHtml = sections.map(section => {
    const areaLabel = AUDIT_AREAS[section.area] || section.area;
    const noCount = (section.items || []).filter(i => i.answer === 'no').length;

    const itemRows = (section.items || []).map((item, idx) => `
      <tr class="${item.answer === 'no' ? 'row-no' : ''}">
        <td class="item-num">${idx + 1}</td>
        <td class="item-label">${escapeHtml(item.label)}</td>
        <td class="item-answer">${answerBadge(item.answer)}</td>
      </tr>`).join('');

    return `
      <div class="section">
        <div class="section-header">
          <span class="section-title">${escapeHtml(areaLabel)}</span>
          ${noCount > 0 ? `<span class="section-issues">${noCount} issue${noCount > 1 ? 's' : ''}</span>` : '<span class="section-clean">&#10003; Clean</span>'}
        </div>
        <table class="items-table">
          <thead>
            <tr>
              <th class="item-num">#</th>
              <th class="item-label">Item</th>
              <th class="item-answer">Answer</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        ${section.comments ? `<div class="section-comments"><strong>Comments:</strong> ${escapeHtml(section.comments)}</div>` : ''}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; background: white; }

  .page-header {
    position: relative;
    padding: 16px 20px 14px 20px;
    background: #002356; color: white;
    border-bottom: 4px solid #f97316;
  }
  .page-header-logo {
    position: absolute; top: 10px; right: 14px;
    max-height: 42px; max-width: 140px;
    object-fit: contain;
    background: white;
    padding: 4px 10px;
    border-radius: 6px;
  }
  .page-header-logo-text {
    position: absolute; top: 14px; right: 16px;
    font-size: 16px; font-weight: 900; color: #7eb3d5; letter-spacing: 0.2em;
  }
  .page-header h1 { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; color: white; margin-bottom: 3px; }
  .page-header-sub { font-size: 12px; opacity: 0.8; }
  .page-header-meta { margin-top: 10px; display: flex; gap: 16px; align-items: center; font-size: 11px; opacity: 0.85; }
  .page-header-status { padding: 2px 10px; border-radius: 10px; background: rgba(255,255,255,0.15); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

  .meta-bar {
    display: flex; gap: 0; border-bottom: 1px solid #e5e7eb;
  }
  .meta-cell {
    flex: 1; padding: 10px 16px; border-right: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  .meta-cell:last-child { border-right: none; }
  .meta-label { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .meta-value { font-size: 12px; font-weight: 600; color: #111827; }

  .score-bar {
    display: flex; gap: 0; border-bottom: 2px solid #e5e7eb; background: white;
  }
  .score-cell {
    flex: 1; text-align: center; padding: 10px 8px; border-right: 1px solid #e5e7eb;
  }
  .score-cell:last-child { border-right: none; }
  .score-num { font-size: 20px; font-weight: 800; }
  .score-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }
  .score-total { color: #374151; }
  .score-yes   { color: #065f46; background: #f0fdf4; }
  .score-no    { color: #991b1b; background: #fff5f5; }
  .score-na    { color: #6b7280; background: #f9fafb; }

  .content { padding: 14px 16px; }

  .section { margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .section-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; background: #002356; color: white;
  }
  .section-title { font-size: 12px; font-weight: 700; }
  .section-issues { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(239,68,68,0.3); color: white; font-weight: 700; }
  .section-clean  { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(16,185,129,0.3); color: white; font-weight: 700; }

  .items-table { width: 100%; border-collapse: collapse; }
  .items-table thead th { background: #f3f4f6; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #6b7280; padding: 5px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  .items-table tbody tr { border-bottom: 1px solid #f3f4f6; }
  .items-table tbody tr:last-child { border-bottom: none; }
  .items-table tbody tr.row-no { background: #fff5f5; }
  .items-table tbody td { padding: 7px 10px; vertical-align: middle; }

  .item-num   { width: 28px; font-size: 10px; color: #9ca3af; font-weight: 600; }
  .item-label { font-size: 11px; color: #374151; line-height: 1.3; }
  .item-answer{ width: 64px; text-align: center; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.3px; }
  .badge-yes   { background: #d1fae5; color: #065f46; }
  .badge-no    { background: #fee2e2; color: #991b1b; }
  .badge-na    { background: #f3f4f6; color: #6b7280; }
  .badge-blank { background: #fef9c3; color: #854d0e; }

  .section-comments { padding: 7px 12px; background: #f9fafb; font-size: 11px; color: #374151; border-top: 1px solid #e5e7eb; line-height: 1.4; }

  .global-section { margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .global-section-title { padding: 8px 12px; background: #374151; color: white; font-size: 11px; font-weight: 700; }
  .global-row { display: flex; padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
  .global-row:last-child { border-bottom: none; }
  .global-label { font-size: 11px; color: #6b7280; font-weight: 600; width: 200px; flex-shrink: 0; }
  .global-value { font-size: 11px; color: #111827; font-weight: 600; flex: 1; }

  .footer { margin-top: 20px; padding: 10px 16px; border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
</style>
</head>
<body>

<div class="page-header">
  ${logoBase64
    ? `<img src="${logoBase64}" alt="Logo" class="page-header-logo" />`
    : `<span class="page-header-logo-text">TITAN</span>`}
  <h1>Safety Observation Report</h1>
  <div class="page-header-sub">
    ${escapeHtml(obs.project_name || '')}${obs.project_number ? ' (' + escapeHtml(obs.project_number) + ')' : ''}
  </div>
  <div class="page-header-meta">
    <span>OBS-${obs.number}</span>
    <span>&bull;</span>
    <span>${formatDate(obs.date_of_observation)}</span>
    <span>&bull;</span>
    <span class="page-header-status">${escapeHtml(obs.status || 'submitted')}</span>
  </div>
</div>

<!-- Meta bar -->
<div class="meta-bar">
  <div class="meta-cell">
    <div class="meta-label">Observer / Foreman</div>
    <div class="meta-value">${escapeHtml(obs.observer_name || '')}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">Date of Observation</div>
    <div class="meta-value">${formatDate(obs.date_of_observation)}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">Stretch &amp; Flex</div>
    <div class="meta-value" style="color:${obs.stretch_and_flex === true ? '#065f46' : obs.stretch_and_flex === false ? '#991b1b' : '#9ca3af'}">
      ${obs.stretch_and_flex === true ? 'Yes' : obs.stretch_and_flex === false ? 'No' : '—'}
    </div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">Areas Audited</div>
    <div class="meta-value">${sections.length}</div>
  </div>
</div>

<!-- Score bar -->
<div class="score-bar">
  <div class="score-cell score-total">
    <div class="score-num">${totalItems}</div>
    <div class="score-lbl">Total Items</div>
  </div>
  <div class="score-cell score-yes">
    <div class="score-num">${totalYes}</div>
    <div class="score-lbl">Yes</div>
  </div>
  <div class="score-cell score-no">
    <div class="score-num">${totalNo}</div>
    <div class="score-lbl">No</div>
  </div>
  <div class="score-cell score-na">
    <div class="score-num">${totalNa}</div>
    <div class="score-lbl">N/A</div>
  </div>
</div>

<div class="content">
  ${sectionHtml}

  <!-- Global Questions -->
  <div class="global-section">
    <div class="global-section-title">Feedback &amp; Notes</div>
    ${obs.feedback_notes ? `<div class="global-row"><div class="global-label">Notes for Safety Dept.</div><div class="global-value">${escapeHtml(obs.feedback_notes)}</div></div>` : ''}
    ${obs.status === 'reviewed' ? `
    <div class="global-row">
      <div class="global-label">Reviewed By</div>
      <div class="global-value">${escapeHtml(obs.reviewed_by_name || '')}</div>
    </div>` : ''}
  </div>
</div>

<div class="footer">
  <span>Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
  <span>TITAN Field Module &mdash; Safety Observation OBS-${obs.number}</span>
</div>

</body>
</html>`;
}

module.exports = { generateObservationPdfHtml };
