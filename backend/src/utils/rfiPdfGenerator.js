const generateRFIPdfHtml = (rfi, logoBase64 = '') => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const checkbox = (checked) => checked ? '☑' : '☐';

  const disciplineLabel = (discipline, disciplineOther) => {
    if (!discipline) return '';
    if (discipline === 'other') return disciplineOther || 'Other';
    return discipline.charAt(0).toUpperCase() + discipline.slice(1);
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 0.5in;
      size: letter;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      line-height: 1.3;
      font-size: 9pt;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 100%;
    }

    /* Header with Logo */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
    }
    .header-left h1 {
      font-size: 18pt;
      font-weight: bold;
      margin: 0 0 5px 0;
      text-transform: uppercase;
    }
    .header-left .subtitle {
      font-size: 10pt;
      margin: 0;
    }
    .header-right {
      text-align: right;
      max-width: 150px;
    }
    .logo {
      width: 120px;
      height: auto;
      max-height: 60px;
      object-fit: contain;
    }

    /* RFI Info Bar */
    .rfi-info-bar {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
      padding: 8px;
      background-color: #f8f8f8;
      border: 1px solid #ddd;
    }
    .rfi-info-item {
      font-size: 9pt;
    }
    .rfi-info-label {
      font-weight: bold;
      margin-bottom: 2px;
    }
    .rfi-info-value {
      color: #333;
    }

    /* Section Styles */
    .section {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 10pt;
      font-weight: bold;
      background-color: #000;
      color: #fff;
      padding: 4px 8px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .section-content {
      border: 1px solid #000;
      padding: 10px;
    }

    /* Grid Layouts */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 10px;
    }

    /* Field Styles */
    .field {
      margin-bottom: 8px;
    }
    .field-label {
      font-weight: bold;
      font-size: 8pt;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .field-value {
      font-size: 9pt;
      min-height: 18px;
      border-bottom: 1px solid #ddd;
      padding: 2px 0;
    }
    .field-value-multiline {
      font-size: 9pt;
      min-height: 60px;
      border: 1px solid #ddd;
      padding: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* Checkbox Styles */
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .checkbox-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9pt;
    }
    .checkbox {
      font-size: 12pt;
      line-height: 1;
    }

    /* Table Styles */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    td {
      padding: 4px;
      font-size: 9pt;
      vertical-align: top;
    }
    .label-cell {
      font-weight: bold;
      width: 25%;
      font-size: 8pt;
      text-transform: uppercase;
    }

    /* Priority Badge */
    .priority-urgent {
      display: inline-block;
      padding: 2px 8px;
      background-color: #ff0000;
      color: white;
      font-weight: bold;
      font-size: 8pt;
    }
    .priority-standard {
      display: inline-block;
      padding: 2px 8px;
      background-color: #fff;
      border: 1px solid #000;
      font-weight: bold;
      font-size: 8pt;
    }

    /* Footer */
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>Request for Information</h1>
        <p class="subtitle">Tweet Garot Mechanical</p>
      </div>
      <div class="header-right">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Tweet Garot Mechanical" class="logo" />` : '<div style="width: 120px; height: 60px;"></div>'}
      </div>
    </div>

    <!-- RFI Info Bar -->
    <div class="rfi-info-bar">
      <div class="rfi-info-item">
        <div class="rfi-info-label">RFI No.</div>
        <div class="rfi-info-value">#${rfi.number || ''}</div>
      </div>
      <div class="rfi-info-item">
        <div class="rfi-info-label">Date Submitted</div>
        <div class="rfi-info-value">${formatDate(rfi.created_at)}</div>
      </div>
      <div class="rfi-info-item">
        <div class="rfi-info-label">Response Due</div>
        <div class="rfi-info-value">${formatDate(rfi.due_date)}</div>
      </div>
      <div class="rfi-info-item">
        <div class="rfi-info-label">Priority</div>
        <div class="rfi-info-value">
          <span class="checkbox">${checkbox(rfi.priority === 'urgent')}</span> Urgent
          <span class="checkbox" style="margin-left: 8px;">${checkbox(rfi.priority !== 'urgent')}</span> Standard
        </div>
      </div>
    </div>

    <!-- Project Information -->
    <div class="section">
      <div class="section-title">Project Information</div>
      <div class="section-content">
        <div class="grid-2">
          <div class="field">
            <div class="field-label">Project Name</div>
            <div class="field-value">${rfi.project_name || ''}</div>
          </div>
          <div class="field">
            <div class="field-label">Project No.</div>
            <div class="field-value">${rfi.project_number || ''}</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <div class="field-label">General Contractor</div>
            <div class="field-value">${rfi.recipient_company_name || ''}</div>
          </div>
          <div class="field">
            <div class="field-label">GC Project Manager</div>
            <div class="field-value">${rfi.recipient_contact_name || ''}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mechanical Contractor -->
    <div class="section">
      <div class="section-title">Mechanical Contractor</div>
      <div class="section-content">
        <div class="grid-2">
          <div class="field">
            <div class="field-label">Company</div>
            <div class="field-value">Tweet Garot Mechanical</div>
          </div>
          <div class="field">
            <div class="field-label">Submitted By</div>
            <div class="field-value">${rfi.created_by_name || ''}</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <div class="field-label">Phone</div>
            <div class="field-value">${rfi.recipient_contact_phone || ''}</div>
          </div>
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value">${rfi.recipient_contact_email || ''}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reference Information -->
    <div class="section">
      <div class="section-title">Reference Information</div>
      <div class="section-content">
        <div class="grid-3">
          <div class="field">
            <div class="field-label">Spec Section(s)</div>
            <div class="field-value">${rfi.spec_section || ''}</div>
          </div>
          <div class="field">
            <div class="field-label">Drawing Sheet(s)</div>
            <div class="field-value">${rfi.drawing_sheet || ''}</div>
          </div>
          <div class="field">
            <div class="field-label">Detail/Grid Ref</div>
            <div class="field-value">${rfi.detail_grid_ref || ''}</div>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Discipline</div>
          <div class="checkbox-group">
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.discipline === 'plumbing')}</span> Plumbing</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.discipline === 'hvac')}</span> HVAC</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.discipline === 'piping')}</span> Piping</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.discipline === 'equipment')}</span> Equipment</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.discipline === 'controls')}</span> Controls</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.discipline === 'other')}</span> Other: ${rfi.discipline_other || ''}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Question / Request for Clarification -->
    <div class="section">
      <div class="section-title">Question / Request for Clarification</div>
      <div class="section-content">
        <div class="field">
          <div class="field-label">Subject</div>
          <div class="field-value" style="font-weight: 600;">${rfi.subject || ''}</div>
        </div>
        <div class="field">
          <div class="field-label">Question</div>
          <div class="field-value-multiline">${rfi.question || ''}</div>
        </div>
      </div>
    </div>

    <!-- Suggested Solution -->
    ${rfi.suggested_solution ? `
    <div class="section">
      <div class="section-title">Suggested Solution (If Applicable)</div>
      <div class="section-content">
        <div class="field-value-multiline">${rfi.suggested_solution}</div>
      </div>
    </div>
    ` : ''}

    <!-- Impact If Not Resolved -->
    ${(rfi.schedule_impact || rfi.cost_impact || rfi.affects_other_trades) ? `
    <div class="section">
      <div class="section-title">Impact If Not Resolved</div>
      <div class="section-content">
        <div class="grid-3">
          <div class="field">
            <div class="field-label">Schedule Impact</div>
            <div class="checkbox-group">
              <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.schedule_impact === true)}</span> Yes</div>
              <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.schedule_impact === false)}</span> No</div>
            </div>
            ${rfi.schedule_impact_days ? `<div style="margin-top: 4px; font-size: 9pt;">Days: ${rfi.schedule_impact_days}</div>` : ''}
          </div>
          <div class="field">
            <div class="field-label">Cost Impact</div>
            <div class="checkbox-group">
              <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.cost_impact === true)}</span> Yes</div>
              <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.cost_impact === false)}</span> No</div>
            </div>
            ${rfi.cost_impact_amount ? `<div style="margin-top: 4px; font-size: 9pt;">Amount: $${Number(rfi.cost_impact_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}
          </div>
          <div class="field">
            <div class="field-label">Affects Other Trades</div>
            <div class="checkbox-group">
              <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.affects_other_trades === true)}</span> Yes</div>
              <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.affects_other_trades === false)}</span> No</div>
            </div>
            ${rfi.affected_trades ? `<div style="margin-top: 4px; font-size: 9pt;">${rfi.affected_trades}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Attachments -->
    ${(rfi.has_sketches || rfi.has_photos || rfi.has_spec_pages || rfi.has_shop_drawings || rfi.attachment_notes) ? `
    <div class="section">
      <div class="section-title">Attachments</div>
      <div class="section-content">
        <div class="checkbox-group">
          <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.has_sketches)}</span> Sketches/Markups</div>
          <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.has_photos)}</span> Photos</div>
          <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.has_spec_pages)}</span> Spec Pages</div>
          <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.has_shop_drawings)}</span> Shop Drawings</div>
          <div class="checkbox-item"><span class="checkbox">${checkbox(!!rfi.attachment_notes)}</span> Other</div>
        </div>
        ${rfi.attachment_notes ? `<div style="margin-top: 6px; font-size: 9pt; font-style: italic;">${rfi.attachment_notes}</div>` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Response Section (To be completed by Architect/Engineer/GC) -->
    ${rfi.response ? `
    <div class="section">
      <div class="section-title">Response (To be completed by Architect/Engineer/GC)</div>
      <div class="section-content" style="background-color: #f9f9f9;">
        <div class="grid-2" style="margin-bottom: 8px;">
          <div class="field">
            <div class="field-label">Response Date</div>
            <div class="field-value">${formatDate(rfi.responded_at)}</div>
          </div>
          <div class="field">
            <div class="field-label">Responded By</div>
            <div class="field-value">${rfi.responded_by_name || ''}</div>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Response / Direction</div>
          <div class="field-value-multiline">${rfi.response}</div>
        </div>
        ${rfi.response_classification ? `
        <div class="field" style="margin-top: 8px;">
          <div class="field-label">Response Classification</div>
          <div class="checkbox-group">
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.response_classification === 'clarification_only')}</span> Clarification Only - No Action Required</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.response_classification === 'submit_cor')}</span> Submit COR</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.response_classification === 'proceed_suggested')}</span> Proceed as Suggested</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.response_classification === 'see_attached')}</span> See Attached</div>
            <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.response_classification === 'refer_to')}</span> Refer to: ${rfi.response_reference || ''}</div>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
    ` : `
    <div class="section">
      <div class="section-title">Response (To be completed by Architect/Engineer/GC)</div>
      <div class="section-content" style="background-color: #f9f9f9;">
        <div class="grid-2" style="margin-bottom: 8px;">
          <div class="field">
            <div class="field-label">Response Date</div>
            <div class="field-value"></div>
          </div>
          <div class="field">
            <div class="field-label">Responded By</div>
            <div class="field-value"></div>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Response / Direction</div>
          <div class="field-value-multiline" style="min-height: 80px;"></div>
        </div>
        <div class="field" style="margin-top: 8px;">
          <div class="field-label">Response Classification</div>
          <div class="checkbox-group">
            <div class="checkbox-item"><span class="checkbox">☐</span> Clarification Only - No Action Required</div>
            <div class="checkbox-item"><span class="checkbox">☐</span> Submit COR</div>
            <div class="checkbox-item"><span class="checkbox">☐</span> Proceed as Suggested</div>
            <div class="checkbox-item"><span class="checkbox">☐</span> See Attached</div>
            <div class="checkbox-item"><span class="checkbox">☐</span> Refer to: __________</div>
          </div>
        </div>
      </div>
    </div>
    `}

    <!-- Distribution -->
    <div class="section">
      <div class="section-title">Distribution</div>
      <div class="section-content">
        <div class="checkbox-group">
          <div class="checkbox-item"><span class="checkbox">${checkbox(rfi.recipient_company_name)}</span> ${rfi.recipient_company_name || 'Architect'}</div>
          <div class="checkbox-item"><span class="checkbox">☐</span> Owner</div>
          <div class="checkbox-item"><span class="checkbox">☐</span> Consultant</div>
          <div class="checkbox-item"><span class="checkbox">☐</span> File</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>Tweet Garot Mechanical | Request for Information #${rfi.number}</div>
      <div style="margin-top: 4px;">Generated on ${formatDate(new Date().toISOString())} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = { generateRFIPdfHtml };
