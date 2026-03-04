import html2pdf from 'html2pdf.js';

interface JsaData {
  number: number;
  project_name?: string;
  project_number?: string;
  date_of_work: string;
  customer_name?: string;
  department_trade?: string;
  filled_out_by?: string;
  task_description?: string;
  work_location?: string;
  ppe_required?: string[];
  permits_required?: string[];
  equipment_required?: string[];
  additional_comments?: string;
  notes?: string;
  worker_names?: string[];
  hazards?: {
    step_description?: string;
    hazard?: string;
    control_measure?: string;
  }[];
}

const PPE_OPTIONS = [
  'Safety Glasses', 'Gloves', 'Ear Plugs', 'Hard Hat',
  'Face Shield', 'Respirator', 'Fall Protection', 'FR Clothing',
];
const PERMIT_OPTIONS = [
  'Lockout/Tagout', 'Confined Space', 'Hot Work',
  'Critical Lift', 'Excavation', 'Customer Work Permit',
];
const EQUIPMENT_OPTIONS = [
  'Scissor/Boom Lift', 'Scaffold', 'Forklift',
  'All Terrain Forklift', 'Crane/Carry Deck', 'Excavation',
];

function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildJsaHtml(jsa: JsaData): string {
  const ppeRequired = jsa.ppe_required || [];
  const permitsRequired = jsa.permits_required || [];
  const equipmentRequired = jsa.equipment_required || [];

  const ppeOther = ppeRequired.filter(p => !PPE_OPTIONS.includes(p));
  const permitOther = permitsRequired.filter(p => !PERMIT_OPTIONS.includes(p));
  const equipOther = equipmentRequired.filter(p => !EQUIPMENT_OPTIONS.includes(p));

  const checkbox = (checked: boolean) => checked
    ? '<span class="cb checked">&#9746;</span>'
    : '<span class="cb">&#9744;</span>';

  const ppeCheckboxes = PPE_OPTIONS.map(item =>
    `${checkbox(ppeRequired.includes(item))} ${item}`
  ).join('&nbsp;&nbsp;');

  const permitCheckboxes = PERMIT_OPTIONS.map(item =>
    `${checkbox(permitsRequired.includes(item))} ${item}`
  ).join('&nbsp;&nbsp;');

  const equipCheckboxes = EQUIPMENT_OPTIONS.map(item =>
    `${checkbox(equipmentRequired.includes(item))} ${item}`
  ).join('&nbsp;&nbsp;');

  const hazards = jsa.hazards || [];
  const ROW_COUNT = Math.max(10, hazards.length);
  let hazardRows = '';
  for (let i = 0; i < ROW_COUNT; i++) {
    const h = hazards[i];
    hazardRows += `
      <tr>
        <td class="row-num">${i + 1}</td>
        <td class="task-col">${h ? escapeHtml(h.step_description) : ''}</td>
        <td class="hazard-col">${h ? escapeHtml(h.hazard) : ''}</td>
        <td class="control-col">${h ? escapeHtml(h.control_measure) : ''}</td>
      </tr>`;
  }

  const workerNames = jsa.worker_names || [];
  const workerCols = 3;
  const workerRows = Math.ceil(Math.max(workerNames.length, 6) / workerCols);
  let workerHtml = '';
  for (let r = 0; r < workerRows; r++) {
    workerHtml += '<tr>';
    for (let c = 0; c < workerCols; c++) {
      const idx = r * workerCols + c;
      const name = workerNames[idx] || '';
      workerHtml += `<td class="worker-cell">${name ? escapeHtml(name) : '&nbsp;'}</td>`;
    }
    workerHtml += '</tr>';
  }

  return `
<div class="form-wrapper">
  <div class="header-row">
    <div class="header-logo">
      <div style="font-size:14pt;font-weight:bold;color:#1a3a5c;">Tweet Garot</div>
      <div class="tagline">LIVE, WORK, PLAY - SAFE</div>
    </div>
    <div class="header-title">
      <div class="header-title-top">JSA - Jobsite Safety Analysis</div>
      <div class="header-fields">
        <div class="header-field" style="grid-column: 1;">
          <div class="label">Name of Project or Jobsite:</div>
          <div class="value">${escapeHtml(jsa.project_name)}</div>
        </div>
        <div class="header-field" style="min-width: 120px;">
          <div class="label">Project #:</div>
          <div class="value">${escapeHtml(jsa.project_number)}</div>
        </div>
        <div class="header-field" style="min-width: 100px; border-right: none;">
          <div class="label">Date:</div>
          <div class="value">${formatDate(jsa.date_of_work)}</div>
        </div>
      </div>
      <div class="header-fields">
        <div class="header-field" style="grid-column: 1;">
          <div class="label">Name of Customer and/or General Contractor:</div>
          <div class="value">${escapeHtml(jsa.customer_name)}</div>
        </div>
        <div class="header-field" style="min-width: 120px;">
          <div class="label">Department / Trade:</div>
          <div class="value">${escapeHtml(jsa.department_trade)}</div>
        </div>
        <div class="header-field" style="min-width: 100px; border-right: none;">
          <div class="label">Filled Out By:</div>
          <div class="value">${escapeHtml(jsa.filled_out_by)}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="info-row">
    <div class="cell" style="flex: 1;">
      <span class="label">PPE: </span>
      ${ppeCheckboxes}
      ${ppeOther.length ? `&nbsp;&nbsp;<span class="label">Other(s):</span> ${escapeHtml(ppeOther.join(', '))}` : `&nbsp;&nbsp;${checkbox(false)} Other(s):`}
    </div>
  </div>

  <div class="info-row">
    <div class="cell" style="flex: 1;">
      <span class="label">PERMITS: </span>
      ${permitCheckboxes}
      ${permitOther.length ? `&nbsp;&nbsp;<span class="label">Other(s):</span> ${escapeHtml(permitOther.join(', '))}` : `&nbsp;&nbsp;${checkbox(false)} Other(s):`}
    </div>
  </div>

  <div class="info-row" style="border-bottom: 2px solid #000;">
    <div class="cell" style="flex: 1;">
      <span class="label">EQUIPMENT: </span>
      ${equipCheckboxes}
      ${equipOther.length ? `&nbsp;&nbsp;<span class="label">Other(s):</span> ${escapeHtml(equipOther.join(', '))}` : `&nbsp;&nbsp;${checkbox(false)} Other(s):`}
    </div>
  </div>

  <div class="hazard-categories">
    <em>Gravity / Mechanical / Electrical / Motion / Temperature / Chemical / Sound / Pressure / Radiation / Biological</em>
  </div>

  <table class="hazard-table">
    <thead>
      <tr>
        <th style="width: 24px;"></th>
        <th>MAJOR TASKS</th>
        <th>POTENTIAL HAZARDS</th>
        <th>CONTROL ACTION</th>
      </tr>
    </thead>
    <tbody>
      ${hazardRows}
    </tbody>
  </table>

  <div class="comments-section">
    <div class="label">ADDITIONAL COMMENTS:</div>
    <div class="content">${escapeHtml(jsa.additional_comments || jsa.notes)}</div>
  </div>

  <div class="worker-section">
    <div class="label">
      WORKER SIGN-IN (entire crew): By printing my name, I acknowledge my participation in the JSA and commit to work safely
    </div>
    <table class="worker-table">
      ${workerHtml}
    </table>
  </div>

  <div class="footer">
    <span class="email">Send completed JSA to jsa@tweetgarot.com and to your Account or Project Manager</span>
    <span>Rev 10/04/23</span>
  </div>
</div>`;
}

const JSA_STYLES = `
  * { box-sizing: border-box; }
  .form-wrapper {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    line-height: 1.3;
    font-size: 8.5pt;
    border: 2px solid #000;
  }
  .header-row {
    display: flex;
    border-bottom: 2px solid #000;
  }
  .header-logo {
    width: 180px;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-right: 1px solid #000;
  }
  .header-logo .tagline {
    font-size: 7pt;
    font-weight: bold;
    font-style: italic;
    margin-top: 3px;
    color: #1a3a5c;
  }
  .header-title {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .header-title-top {
    text-align: center;
    font-size: 14pt;
    font-weight: bold;
    padding: 4px 0;
    border-bottom: 1px solid #000;
  }
  .header-fields {
    display: grid;
    grid-template-columns: 1fr auto auto;
    flex: 1;
  }
  .header-field {
    padding: 3px 6px;
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
    font-size: 8pt;
  }
  .header-field:last-child { border-right: none; }
  .header-field .label {
    font-weight: bold;
    font-size: 7pt;
    text-transform: uppercase;
  }
  .header-field .value {
    font-size: 9pt;
    min-height: 14px;
  }
  .info-row {
    display: flex;
    border-bottom: 1px solid #000;
  }
  .info-row .cell {
    padding: 2px 6px;
    border-right: 1px solid #000;
    font-size: 8pt;
  }
  .info-row .cell:last-child { border-right: none; }
  .info-row .cell .label { font-weight: bold; font-size: 7pt; }
  .cb { font-size: 11pt; vertical-align: middle; }
  .cb.checked { font-weight: bold; }
  .hazard-categories {
    text-align: center;
    font-style: italic;
    font-weight: bold;
    font-size: 8.5pt;
    padding: 3px 6px;
    border-bottom: 2px solid #000;
    background: #f5f5f5;
  }
  .hazard-table {
    width: 100%;
    border-collapse: collapse;
  }
  .hazard-table th {
    background: #e8e8e8;
    padding: 3px 6px;
    font-size: 8pt;
    font-weight: bold;
    text-transform: uppercase;
    text-align: center;
    border-bottom: 2px solid #000;
    border-right: 1px solid #000;
  }
  .hazard-table th:last-child { border-right: none; }
  .hazard-table td {
    padding: 4px 6px;
    border-bottom: 1px solid #bbb;
    border-right: 1px solid #bbb;
    font-size: 8pt;
    vertical-align: top;
    min-height: 20px;
  }
  .hazard-table td:last-child { border-right: none; }
  .hazard-table .row-num {
    width: 24px;
    text-align: center;
    font-weight: bold;
    color: #555;
  }
  .hazard-table .task-col { width: 30%; }
  .hazard-table .hazard-col { width: 35%; }
  .hazard-table .control-col { width: 35%; }
  .comments-section {
    border-top: 2px solid #000;
    padding: 3px 6px;
    min-height: 40px;
  }
  .comments-section .label {
    font-weight: bold;
    font-size: 8pt;
    text-transform: uppercase;
  }
  .comments-section .content {
    font-size: 8.5pt;
    white-space: pre-wrap;
    min-height: 20px;
  }
  .worker-section {
    border-top: 2px solid #000;
    padding: 3px 6px;
  }
  .worker-section .label {
    font-weight: bold;
    font-size: 7.5pt;
    margin-bottom: 4px;
  }
  .worker-table {
    width: 100%;
    border-collapse: collapse;
  }
  .worker-cell {
    width: 33.33%;
    padding: 3px 6px;
    border: 1px solid #ccc;
    font-size: 8.5pt;
    min-height: 18px;
  }
  .footer {
    border-top: 2px solid #000;
    padding: 4px 8px;
    display: flex;
    justify-content: space-between;
    font-size: 7pt;
    color: #555;
  }
  .footer .email {
    font-weight: bold;
    color: #1a3a5c;
  }
`;

export async function generateJsaPdf(jsa: JsaData): Promise<Blob> {
  const htmlContent = buildJsaHtml(jsa);

  // Create a temporary container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  // Landscape letter dimensions in px at 96 DPI
  container.style.width = '1056px';

  const style = document.createElement('style');
  style.textContent = JSA_STYLES;
  container.appendChild(style);

  const content = document.createElement('div');
  content.innerHTML = htmlContent;
  container.appendChild(content);

  document.body.appendChild(container);

  try {
    const blob: Blob = await html2pdf()
      .set({
        margin: [0.35, 0.35, 0.35, 0.35],
        filename: `JSA-${jsa.number}.pdf`,
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          width: 1056,
        },
        jsPDF: {
          unit: 'in',
          format: 'letter',
          orientation: 'landscape',
        },
      })
      .from(container)
      .outputPdf('blob');

    return blob;
  } finally {
    document.body.removeChild(container);
  }
}
