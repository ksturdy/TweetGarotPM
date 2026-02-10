const express = require('express');
const router = express.Router();
const RFI = require('../models/RFI');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { generateRFIPdfHtml } = require('../utils/rfiPdfGenerator');
const { generateRFILogPdfHtml } = require('../utils/rfiLogPdfGenerator');
const { fetchLogoBase64 } = require('../utils/logoFetcher');
const {
  isEmailConfigured,
  sendEmail,
  generateRFIEmailHtml,
  generateRFIEmailText,
} = require('../utils/emailService');
const { generateRfiPdfBuffer } = require('../utils/rfiPdfBuffer');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Generate PDF for RFI
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(rfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    const logoBase64 = await fetchLogoBase64(req.tenantId);
    const html = generateRFIPdfHtml(rfi, logoBase64);

    // Return HTML that can be printed to PDF by the browser
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

// Send RFI via email
router.post('/:id/send', async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(rfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    if (!rfi.recipient_contact_email) {
      return res.status(400).json({ error: 'No recipient email address specified' });
    }

    const emailData = {
      to: rfi.recipient_contact_email,
      subject: `RFI #${rfi.number} - ${rfi.subject}`,
      recipientName: rfi.recipient_contact_name,
      recipientCompany: rfi.recipient_company_name,
      fromName: rfi.created_by_name,
      rfiNumber: rfi.number,
      projectName: rfi.project_name,
      dueDate: rfi.due_date,
      priority: rfi.priority,
      question: rfi.question,
    };

    // Check if email is configured
    if (!isEmailConfigured()) {
      return res.json({
        success: true,
        message: `RFI #${rfi.number} would be sent to ${rfi.recipient_contact_email}`,
        emailData,
        preview: true,
        note: 'Email sending not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to your .env file.',
      });
    }

    // Send the actual email
    const result = await sendEmail({
      to: rfi.recipient_contact_email,
      subject: `RFI #${rfi.number} - ${rfi.subject}`,
      html: generateRFIEmailHtml(rfi),
      text: generateRFIEmailText(rfi),
    });

    if (result.success) {
      res.json({
        success: true,
        message: `RFI #${rfi.number} sent to ${rfi.recipient_contact_email}`,
        emailData,
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        emailData,
        error: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

// Generate actual PDF file (for testing PDF generation)
router.get('/:id/pdf-download', async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(rfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    // Generate PDF buffer
    const pdfBuffer = await generateRfiPdfBuffer(rfi);

    // Return as downloadable PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RFI-${rfi.number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    next(error);
  }
});

// Generate .eml file with PDF attached for Outlook
router.get('/:id/email-draft', async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(rfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    // Generate PDF buffer
    const pdfBuffer = await generateRfiPdfBuffer(rfi);

    // Format due date
    const dueDateStr = rfi.due_date
      ? new Date(rfi.due_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

    // Build email body
    const emailBody = `Dear ${rfi.recipient_contact_name || 'Sir/Madam'},

Please find attached RFI #${rfi.number} regarding "${rfi.subject}" for project ${project.name}.

${dueDateStr ? `Response is requested by ${dueDateStr}.` : ''}

Please review and respond at your earliest convenience.

Best regards,
${rfi.created_by_name || 'Tweet Garot Mechanical'}`;

    // Create .eml content using MIME format
    const boundary = '----=_NextPart_' + Date.now().toString(16);
    const filename = `RFI-${rfi.number}.pdf`;

    // Convert PDF to base64 with proper line breaks (76 chars per line)
    const base64Pdf = pdfBuffer.toString('base64');
    const base64Lines = base64Pdf.match(/.{1,76}/g) || [];

    const emlContent = [
      'MIME-Version: 1.0',
      `To: ${rfi.recipient_contact_email || ''}`,
      `Subject: RFI #${rfi.number} - ${rfi.subject}`,
      'X-Unsent: 1',
      `Content-Type: multipart/mixed;`,
      `\tboundary="${boundary}"`,
      '',
      'This is a multi-part message in MIME format.',
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="utf-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      emailBody,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf;`,
      `\tname="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment;`,
      `\tfilename="${filename}"`,
      '',
      ...base64Lines,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    // Set headers to trigger download/open
    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="RFI-${rfi.number}.eml"`);
    res.send(emlContent);
  } catch (error) {
    console.error('Error generating email draft:', error);
    next(error);
  }
});

// Get RFI preview data
router.get('/:id/preview', async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(rfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

// Generate RFI Log PDF Report for a project
router.get('/project/:projectId/log-report', async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const status = req.query.status; // optional filter

    // Verify project belongs to tenant
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all RFIs for the project
    let rfis = await RFI.findByProject(projectId);

    // Apply status filter if provided
    if (status && status !== 'all') {
      rfis = rfis.filter(rfi => rfi.status === status);
    }

    const logoBase64 = await fetchLogoBase64(req.tenantId);
    const html = generateRFILogPdfHtml(rfis, project.name, logoBase64);

    // Return HTML that can be printed to PDF by the browser
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
