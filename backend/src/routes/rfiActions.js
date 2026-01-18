const express = require('express');
const router = express.Router();
const RFI = require('../models/RFI');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { generateRFIPdfHtml } = require('../utils/rfiPdfGenerator');
const { generateRFILogPdfHtml } = require('../utils/rfiLogPdfGenerator');

// Generate PDF for RFI
router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    const html = generateRFIPdfHtml(rfi);

    // Return HTML that can be printed to PDF by the browser
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

// Send RFI via email
router.post('/:id/send', authenticate, async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    if (!rfi.recipient_contact_email) {
      return res.status(400).json({ error: 'No recipient email address specified' });
    }

    // For now, return the email data that would be sent
    // In production, integrate with nodemailer or an email service
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

    // In a real implementation, you would send the email here
    // For now, we'll just return success with the email data
    res.json({
      success: true,
      message: `RFI #${rfi.number} would be sent to ${rfi.recipient_contact_email}`,
      emailData,
      // Add a note that this is a preview mode
      preview: true,
      note: 'Email sending not yet configured. Please configure email service to send actual emails.',
    });
  } catch (error) {
    next(error);
  }
});

// Get RFI preview data
router.get('/:id/preview', authenticate, async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

// Generate RFI Log PDF Report for a project
router.get('/project/:projectId/log-report', authenticate, async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const status = req.query.status; // optional filter

    // Get project info
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all RFIs for the project
    let rfis = await RFI.findByProject(projectId);

    // Apply status filter if provided
    if (status && status !== 'all') {
      rfis = rfis.filter(rfi => rfi.status === status);
    }

    const html = generateRFILogPdfHtml(rfis, project.name);

    // Return HTML that can be printed to PDF by the browser
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
