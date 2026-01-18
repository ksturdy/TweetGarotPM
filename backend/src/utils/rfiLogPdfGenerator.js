const fs = require('fs');
const path = require('path');

const generateRFILogPdfHtml = (rfis, projectName) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDaysOutstanding = (createdDate, status) => {
    if (status !== 'open') return null;
    const created = new Date(createdDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Load and convert logo to base64
  let logoBase64 = '';
  try {
    const logoPath = path.join(__dirname, '../../uploads/TweetGarotLogo.png');
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error loading logo:', error);
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 0.5in;
      size: letter landscape;
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

    /* Project Info */
    .project-info {
      margin-bottom: 15px;
      font-size: 10pt;
    }
    .project-info strong {
      font-weight: bold;
    }

    /* Table Styles */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 8pt;
    }
    thead {
      background-color: #000;
      color: #fff;
    }
    th {
      padding: 6px 4px;
      text-align: left;
      font-weight: bold;
      text-transform: uppercase;
      border: 1px solid #000;
      font-size: 7pt;
    }
    td {
      padding: 4px;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    tbody tr:nth-child(even) {
      background-color: #f8f8f8;
    }
    tbody tr:hover {
      background-color: #f0f0f0;
    }

    /* Status Badge */
    .status-open {
      display: inline-block;
      padding: 2px 6px;
      background-color: #fbbf24;
      color: #000;
      font-weight: bold;
      font-size: 7pt;
      border-radius: 2px;
    }
    .status-answered {
      display: inline-block;
      padding: 2px 6px;
      background-color: #10b981;
      color: #fff;
      font-weight: bold;
      font-size: 7pt;
      border-radius: 2px;
    }
    .status-closed {
      display: inline-block;
      padding: 2px 6px;
      background-color: #6b7280;
      color: #fff;
      font-weight: bold;
      font-size: 7pt;
      border-radius: 2px;
    }

    /* Days outstanding */
    .days-warning {
      color: #dc2626;
      font-weight: bold;
    }

    /* Footer */
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 7pt;
      color: #666;
      text-align: center;
    }

    /* Summary Box */
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f8f8f8;
      border: 1px solid #ddd;
    }
    .summary-item {
      text-align: center;
    }
    .summary-label {
      font-size: 7pt;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
    }
    .summary-value {
      font-size: 16pt;
      font-weight: bold;
      color: #000;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>RFI Log Report</h1>
        <p class="subtitle">Tweet Garot Mechanical</p>
      </div>
      <div class="header-right">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Tweet Garot Mechanical" class="logo" />` : '<div style="width: 120px; height: 60px;"></div>'}
      </div>
    </div>

    <!-- Project Info -->
    <div class="project-info">
      <strong>Project:</strong> ${projectName || 'All Projects'} |
      <strong>Report Date:</strong> ${formatDate(new Date().toISOString())} |
      <strong>Total RFIs:</strong> ${rfis.length}
    </div>

    <!-- Summary -->
    <div class="summary">
      <div class="summary-item">
        <div class="summary-label">Open</div>
        <div class="summary-value">${rfis.filter(r => r.status === 'open').length}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Answered</div>
        <div class="summary-value">${rfis.filter(r => r.status === 'answered').length}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Closed</div>
        <div class="summary-value">${rfis.filter(r => r.status === 'closed').length}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Overdue (>7 days)</div>
        <div class="summary-value" style="color: #dc2626;">
          ${rfis.filter(r => {
            const days = getDaysOutstanding(r.created_at, r.status);
            return days !== null && days > 7;
          }).length}
        </div>
      </div>
    </div>

    <!-- RFI Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 6%;">RFI #</th>
          <th style="width: 18%;">Subject</th>
          <th style="width: 15%;">Sent To</th>
          <th style="width: 8%;">Status</th>
          <th style="width: 10%;">Created</th>
          <th style="width: 8%;">Days Out</th>
          <th style="width: 10%;">Due Date</th>
          <th style="width: 12%;">Assigned To</th>
          <th style="width: 13%;">Contact</th>
        </tr>
      </thead>
      <tbody>
        ${rfis.map(rfi => {
          const daysOutstanding = getDaysOutstanding(rfi.created_at, rfi.status);
          const statusClass = `status-${rfi.status}`;

          return `
            <tr>
              <td style="font-weight: bold;">${rfi.number || ''}</td>
              <td>${rfi.subject || ''}</td>
              <td>${rfi.recipient_company_name || '-'}</td>
              <td><span class="${statusClass}">${rfi.status}</span></td>
              <td>${formatDate(rfi.created_at)}</td>
              <td${daysOutstanding && daysOutstanding > 7 ? ' class="days-warning"' : ''}>
                ${daysOutstanding !== null ? `${daysOutstanding} ${daysOutstanding === 1 ? 'day' : 'days'}` : '-'}
              </td>
              <td>${rfi.due_date ? formatDate(rfi.due_date) : '-'}</td>
              <td>${rfi.assigned_to_name || '-'}</td>
              <td style="font-size: 7pt;">${rfi.recipient_contact_name || '-'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Footer -->
    <div class="footer">
      <div>Tweet Garot Mechanical | RFI Log Report</div>
      <div style="margin-top: 4px;">Generated on ${formatDate(new Date().toISOString())} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = { generateRFILogPdfHtml };
