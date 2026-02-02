const nodemailer = require('nodemailer');

// Check if email is configured
const isEmailConfigured = () => {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

// Create reusable transporter
let transporter = null;

const getTransporter = () => {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

// Send an email
const sendEmail = async ({ to, subject, html, text, attachments }) => {
  const transport = getTransporter();

  if (!transport) {
    return {
      success: false,
      preview: true,
      message: 'Email not configured. Add SMTP settings to .env file.',
    };
  }

  const fromName = process.env.EMAIL_FROM_NAME || 'Tweet Garot PM';
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
      attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
      message: `Email sent to ${to}`,
    };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to send email: ${error.message}`,
    };
  }
};

// Generate RFI email HTML
const generateRFIEmailHtml = (rfi) => {
  const dueDateStr = rfi.due_date
    ? new Date(rfi.due_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Not specified';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #002356, #004080);
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0 0;
      opacity: 0.9;
    }
    .content {
      background: #f9fafb;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .info-row {
      display: flex;
      margin-bottom: 12px;
    }
    .info-label {
      font-weight: 600;
      color: #6b7280;
      width: 120px;
      flex-shrink: 0;
    }
    .info-value {
      color: #1f2937;
    }
    .question-section {
      background: white;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      margin-top: 15px;
    }
    .question-section h3 {
      margin: 0 0 10px;
      color: #002356;
    }
    .priority-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .priority-normal { background: #dbeafe; color: #1e40af; }
    .priority-high { background: #fef3c7; color: #92400e; }
    .priority-urgent { background: #fee2e2; color: #991b1b; }
    .footer {
      background: #f3f4f6;
      padding: 15px 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 8px 8px;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RFI #${rfi.number}</h1>
    <p>${rfi.subject}</p>
  </div>
  <div class="content">
    <div class="info-row">
      <span class="info-label">Project:</span>
      <span class="info-value">${rfi.project_name || 'N/A'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">From:</span>
      <span class="info-value">${rfi.created_by_name || 'N/A'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Due Date:</span>
      <span class="info-value">${dueDateStr}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Priority:</span>
      <span class="info-value">
        <span class="priority-badge priority-${rfi.priority || 'normal'}">${rfi.priority || 'Normal'}</span>
      </span>
    </div>
    <div class="question-section">
      <h3>Question</h3>
      <p>${rfi.question || 'No question provided.'}</p>
    </div>
  </div>
  <div class="footer">
    <p>Please respond to this RFI at your earliest convenience. If you have any questions, please contact the sender directly.</p>
    <p>This email was sent from Tweet Garot PM.</p>
  </div>
</body>
</html>
  `;
};

// Generate plain text version
const generateRFIEmailText = (rfi) => {
  const dueDateStr = rfi.due_date
    ? new Date(rfi.due_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Not specified';

  return `
RFI #${rfi.number}: ${rfi.subject}

Project: ${rfi.project_name || 'N/A'}
From: ${rfi.created_by_name || 'N/A'}
Due Date: ${dueDateStr}
Priority: ${rfi.priority || 'Normal'}

QUESTION:
${rfi.question || 'No question provided.'}

---
Please respond to this RFI at your earliest convenience.
This email was sent from Tweet Garot PM.
  `.trim();
};

module.exports = {
  isEmailConfigured,
  sendEmail,
  generateRFIEmailHtml,
  generateRFIEmailText,
};
