const fs = require('fs');
const path = require('path');

let fittingTypesBase64 = '';
try {
  const imgPath = path.join(__dirname, '../assets/fitting-types-reference.png');
  const imgBuffer = fs.readFileSync(imgPath);
  fittingTypesBase64 = `data:image/png;base64,${imgBuffer.toString('base64')}`;
} catch (e) {
  // Image not available — will fall back to text legend
}

const generateFittingOrderPdfHtml = (order, logoBase64 = '') => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const FITTING_TYPES = {
    1: 'St. Joint', 2: 'Reducer', 3: 'Offset', 4: 'Elbow',
    5: 'Tee', 6: 'Wye', 7: 'Dbl Branch', 8: 'Tap',
    9: 'Transition', 10: 'End Cap',
  };

  const items = order.items || [];

  const itemRows = items.map((item, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f5f5f5'};">
      <td>${item.quantity || ''}</td>
      <td>${item.fitting_type || ''}</td>
      <td>${[item.dim_a, item.dim_b].filter(Boolean).join(' x ') || ''}</td>
      <td>${[item.dim_c, item.dim_d].filter(Boolean).join(' x ') || ''}</td>
      <td>${item.dim_e || ''}</td>
      <td>${item.dim_f || ''}</td>
      <td>${item.dim_l || ''}</td>
      <td>${item.dim_r || ''}</td>
      <td>${item.dim_x || ''}</td>
      <td>${item.gauge || ''}</td>
      <td>${item.liner || ''}</td>
      <td>${item.connection || ''}</td>
      <td class="remarks">${item.remarks || ''}</td>
    </tr>
  `).join('');

  // Add empty rows to fill out the form (minimum 15 rows like the paper form)
  const emptyRowCount = Math.max(0, 15 - items.length);
  const emptyRows = Array.from({ length: emptyRowCount }, (_, idx) => `
    <tr style="background: ${(items.length + idx) % 2 === 0 ? '#fff' : '#f5f5f5'};">
      <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>
  `).join('');

  const priorityBadge = order.priority === 'urgent'
    ? '<span class="priority-badge urgent">URGENT</span>'
    : order.priority === 'high'
    ? '<span class="priority-badge high">HIGH</span>'
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 0.4in;
      size: letter;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      line-height: 1.3;
      font-size: 9pt;
      margin: 0;
      padding: 0;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      border-bottom: 3px solid #000;
      padding-bottom: 8px;
    }
    .header-left h1 {
      font-size: 16pt;
      font-weight: bold;
      margin: 0 0 3px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .header-left .subtitle {
      font-size: 10pt;
      margin: 0;
      color: #333;
    }
    .header-right {
      text-align: right;
    }
    .logo {
      width: 120px;
      height: auto;
      max-height: 60px;
      object-fit: contain;
    }
    .order-number {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 4px;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 1px solid #000;
      margin-bottom: 10px;
    }
    .info-cell {
      padding: 4px 8px;
      border-bottom: 1px solid #ccc;
      border-right: 1px solid #ccc;
      font-size: 9pt;
    }
    .info-cell:nth-child(even) {
      border-right: none;
    }
    .info-label {
      font-weight: bold;
      font-size: 7pt;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 1px;
    }
    .info-value {
      font-size: 9pt;
      min-height: 14px;
    }

    /* Project Bar */
    .project-bar {
      background: #f0f0f0;
      border: 1px solid #000;
      padding: 6px 8px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .project-bar .project-name {
      font-weight: bold;
      font-size: 10pt;
    }
    .priority-badge {
      display: inline-block;
      padding: 2px 10px;
      font-weight: bold;
      font-size: 8pt;
      text-transform: uppercase;
    }
    .priority-badge.urgent {
      background: #ff0000;
      color: #fff;
    }
    .priority-badge.high {
      background: #ff8c00;
      color: #fff;
    }

    /* Type Legend */
    .type-legend {
      margin-bottom: 6px;
      border: 1px solid #ddd;
      background: #fafafa;
      padding: 4px;
    }
    .type-legend img {
      width: 100%;
      height: auto;
      display: block;
    }
    .type-legend-text {
      font-size: 7pt;
      color: #555;
      padding: 3px 6px;
    }

    /* Fittings Table */
    .fittings-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 8pt;
    }
    .fittings-table th {
      background: #333;
      color: #fff;
      padding: 4px 3px;
      text-align: center;
      font-size: 7pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border: 1px solid #000;
    }
    .fittings-table td {
      padding: 3px 3px;
      text-align: center;
      border: 1px solid #bbb;
      font-size: 8pt;
      vertical-align: middle;
    }
    .fittings-table td.remarks {
      text-align: left;
      font-style: italic;
      font-size: 7pt;
    }

    /* Notes */
    .notes-section {
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .notes-title {
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .notes-content {
      border: 1px solid #ccc;
      padding: 6px 8px;
      min-height: 40px;
      font-size: 9pt;
      white-space: pre-wrap;
    }

    /* Footer */
    .footer {
      margin-top: 15px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      font-size: 7pt;
      color: #888;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>Duct Work Fitting Order</h1>
      <p class="subtitle">Tweet Garot Mechanical</p>
    </div>
    <div class="header-right">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo" />` : ''}
      <div class="order-number">FO-SM-${order.number || ''}</div>
    </div>
  </div>

  <!-- Project Bar -->
  <div class="project-bar">
    <span class="project-name">${order.project_name || ''} ${order.project_number ? `(${order.project_number})` : ''}</span>
    ${priorityBadge}
  </div>

  <!-- Order Info Grid -->
  <div class="info-grid">
    <div class="info-cell">
      <div class="info-label">Requested By</div>
      <div class="info-value">${order.requested_by || ''}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Date Required</div>
      <div class="info-value">${formatDate(order.date_required)}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Material</div>
      <div class="info-value">${order.material || ''}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Static Pressure Class</div>
      <div class="info-value">${order.static_pressure_class || ''}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Longitudinal Seam</div>
      <div class="info-value">${order.longitudinal_seam || ''}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Prepared By</div>
      <div class="info-value">${order.prepared_by || ''}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Labor Phase Code</div>
      <div class="info-value">${order.labor_phase_code || ''}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Material Phase Code</div>
      <div class="info-value">${order.material_phase_code || ''}</div>
    </div>
  </div>

  <!-- Fitting Type Reference -->
  ${fittingTypesBase64
    ? `<div class="type-legend"><img src="${fittingTypesBase64}" alt="Fitting Types 1-10" /></div>`
    : `<div class="type-legend type-legend-text"><strong>FITTING TYPES:</strong> 1-St. Joint &nbsp; 2-Reducer &nbsp; 3-Offset &nbsp; 4-Elbow &nbsp; 5-Tee &nbsp; 6-Wye &nbsp; 7-Dbl Branch &nbsp; 8-Tap &nbsp; 9-Transition &nbsp; 10-End Cap</div>`
  }

  <!-- Fittings Table -->
  <table class="fittings-table">
    <thead>
      <tr>
        <th style="width: 35px;">#REQ</th>
        <th style="width: 38px;">TYPE</th>
        <th style="width: 70px;">A x B</th>
        <th style="width: 70px;">C x D</th>
        <th style="width: 35px;">E</th>
        <th style="width: 35px;">F</th>
        <th style="width: 35px;">L</th>
        <th style="width: 35px;">R</th>
        <th style="width: 35px;">X</th>
        <th style="width: 32px;">GA</th>
        <th style="width: 40px;">LINER</th>
        <th style="width: 45px;">CONN</th>
        <th>REMARKS</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${emptyRows}
    </tbody>
  </table>

  <!-- Notes -->
  ${order.notes ? `
  <div class="notes-section">
    <div class="notes-title">Notes</div>
    <div class="notes-content">${order.notes}</div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <div>Tweet Garot Mechanical | Fitting Order FO-SM-${order.number || ''}</div>
    <div style="margin-top: 3px;">Generated on ${formatDate(new Date().toISOString())} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
  </div>
</body>
</html>
  `;
};

module.exports = { generateFittingOrderPdfHtml };
