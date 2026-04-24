const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const LeadInbox = require('../models/LeadInbox');
const opportunities = require('../models/opportunities');
const { extractLeadData } = require('../services/leadExtractionService');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const notificationService = require('../utils/notificationService');
const { saveFile } = require('../utils/fileStorage');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Verify Mailgun webhook signature
 */
function verifyMailgunSignature(timestamp, token, signature) {
  if (!process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.warn('[Lead Inbox] MAILGUN_WEBHOOK_SIGNING_KEY not configured, skipping verification');
    return true; // Allow in development
  }

  const encodedToken = crypto
    .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');

  return encodedToken === signature;
}

/**
 * Extract tenant ID from recipient email
 * For now, use tenant_id=1 (default), can be enhanced for multi-tenant routing
 */
function extractTenantFromRecipient(recipient) {
  // TODO: Implement tenant routing logic based on recipient address
  // e.g., leads+tenant1@titanpm3.com → tenant_id=1
  // For now, default to tenant_id=1
  return 1;
}

/**
 * Extract name from "Name <email@example.com>" format
 */
function extractNameFromSender(fromField) {
  if (!fromField) return null;

  const match = fromField.match(/^([^<]+)</);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Process lead with AI extraction (async)
 */
async function processLeadWithAI(leadId, emailData, tenantId) {
  try {
    console.log(`[Lead Inbox] Starting AI extraction for lead ${leadId}`);

    // Log activity
    await LeadInbox.logActivity(leadId, {
      activityType: 'received',
      description: `Email received from ${emailData.fromEmail}`,
    });

    // Extract data with AI
    const extraction = await extractLeadData(emailData);

    if (extraction.success) {
      await LeadInbox.updateExtractedData(leadId, {
        extractedData: extraction.data,
        aiConfidence: extraction.confidence,
        status: 'ai_processed',
      }, tenantId);

      await LeadInbox.logActivity(leadId, {
        activityType: 'ai_extracted',
        description: `AI extraction completed with ${extraction.confidence} confidence`,
        metadata: { confidence: extraction.confidence },
      });

      console.log(`[Lead Inbox] AI extraction successful for lead ${leadId}, confidence: ${extraction.confidence}`);

      // Notify admins about new lead (only for high/medium confidence)
      if (extraction.confidence === 'high' || extraction.confidence === 'medium') {
        try {
          await notifyAdminsAboutNewLead(leadId, tenantId, emailData, extraction);
        } catch (notifyError) {
          console.error('[Lead Inbox] Failed to send notifications:', notifyError);
        }
      }
    } else {
      await LeadInbox.updateExtractedData(leadId, {
        status: 'error',
        error: extraction.error,
      }, tenantId);

      await LeadInbox.logActivity(leadId, {
        activityType: 'error',
        description: `AI extraction failed: ${extraction.error}`,
        metadata: { error: extraction.error },
      });

      console.error(`[Lead Inbox] AI extraction failed for lead ${leadId}:`, extraction.error);
    }
  } catch (error) {
    console.error('[Lead Inbox] Error in processLeadWithAI:', error);

    try {
      await LeadInbox.updateExtractedData(leadId, {
        status: 'error',
        error: error.message,
      }, tenantId);

      await LeadInbox.logActivity(leadId, {
        activityType: 'error',
        description: `Processing error: ${error.message}`,
        metadata: { error: error.message },
      });
    } catch (updateError) {
      console.error('[Lead Inbox] Failed to update error status:', updateError);
    }
  }
}

/**
 * Notify admins about new lead
 */
async function notifyAdminsAboutNewLead(leadId, tenantId, emailData, extraction) {
  const { fromEmail, subject } = emailData;
  const { data, confidence } = extraction;

  const title = data?.title || subject || 'New Lead Email';
  const message = `From: ${fromEmail}\nConfidence: ${confidence}\n${data?.description?.substring(0, 100) || ''}`;

  await notificationService.notify({
    tenantId,
    role: 'admin', // Notify all admins
    entityType: 'lead_inbox',
    entityId: leadId,
    eventType: 'new_lead',
    title: `New Lead: ${title}`,
    message,
    link: `/lead-inbox/${leadId}`,
  });
}

/**
 * PUBLIC WEBHOOK - Mailgun posts emails here
 * No authentication required (verified via signature)
 */
router.post('/inbound', upload.any(), async (req, res) => {
  try {
    console.log('[Lead Inbox] Received webhook from Mailgun');

    // Verify Mailgun signature
    const { timestamp, token, signature } = req.body;
    if (!verifyMailgunSignature(timestamp, token, signature)) {
      console.error('[Lead Inbox] Invalid Mailgun signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // Extract email data from Mailgun payload
    const fromEmail = req.body.sender || req.body.from;
    const fromName = extractNameFromSender(req.body.from);
    const subject = req.body.subject || '(No Subject)';
    const receivedTimestamp = parseInt(req.body.timestamp) * 1000;
    const receivedAt = new Date(receivedTimestamp);
    const bodyText = req.body['body-plain'];
    const bodyHtml = req.body['body-html'];
    const strippedText = req.body['stripped-text'] || bodyText;

    // Determine tenant from recipient
    const recipient = req.body.recipient;
    const tenantId = extractTenantFromRecipient(recipient);

    const emailData = {
      fromEmail,
      fromName,
      subject,
      receivedAt,
      bodyText,
      bodyHtml,
      strippedText,
    };

    // Create lead record
    const lead = await LeadInbox.create(emailData, tenantId);
    console.log(`[Lead Inbox] Created lead ${lead.id} for tenant ${tenantId}`);

    // Save attachments if any
    const attachmentCount = parseInt(req.body['attachment-count'] || '0');
    if (attachmentCount > 0 && req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const savedFile = await saveFile({
            buffer: file.buffer,
            originalName: file.originalname,
            mimeType: file.mimetype,
          }, `uploads/lead-attachments/${lead.id}`);

          await LeadInbox.addAttachment(lead.id, {
            filename: savedFile.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            filePath: savedFile.path,
          });

          console.log(`[Lead Inbox] Saved attachment: ${file.originalname}`);
        } catch (attachError) {
          console.error('[Lead Inbox] Failed to save attachment:', attachError);
        }
      }
    }

    // Trigger AI extraction asynchronously (don't block response to Mailgun)
    processLeadWithAI(lead.id, emailData, tenantId).catch(err => {
      console.error('[Lead Inbox] Background AI processing failed:', err);
    });

    // Respond 200 OK immediately (Mailgun expects fast response)
    res.status(200).json({ success: true, leadId: lead.id });

  } catch (error) {
    console.error('[Lead Inbox] Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all leads for tenant (with optional status filter)
 */
router.get('/', authenticate, tenantContext, async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;

    const leads = await LeadInbox.findAllByTenant(req.tenantId, {
      status,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });

    res.json(leads);
  } catch (error) {
    console.error('[Lead Inbox] Error fetching leads:', error);
    next(error);
  }
});

/**
 * Get stats (count by status)
 */
router.get('/stats', authenticate, tenantContext, async (req, res, next) => {
  try {
    const stats = await LeadInbox.countByStatus(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('[Lead Inbox] Error fetching stats:', error);
    next(error);
  }
});

/**
 * Get single lead by ID
 */
router.get('/:id', authenticate, tenantContext, async (req, res, next) => {
  try {
    const lead = await LeadInbox.findById(parseInt(req.params.id), req.tenantId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get attachments and activities
    const attachments = await LeadInbox.getAttachments(lead.id);
    const activities = await LeadInbox.getActivities(lead.id);

    res.json({
      ...lead,
      attachments,
      activities,
    });
  } catch (error) {
    console.error('[Lead Inbox] Error fetching lead:', error);
    next(error);
  }
});

/**
 * Approve lead and create opportunity
 */
router.post('/:id/approve', authenticate, tenantContext, async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);
    const lead = await LeadInbox.findById(leadId, req.tenantId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.status === 'approved') {
      return res.status(400).json({ error: 'Lead already approved' });
    }

    // Merge extracted data with user overrides from request body
    const opportunityData = {
      ...lead.extracted_data,
      ...req.body,
      source: 'Email Lead',
      lead_inbox_id: leadId,
    };

    // Create opportunity
    const opportunity = await opportunities.create(
      opportunityData,
      req.user.id,
      req.tenantId
    );

    // Update lead status
    const updatedLead = await LeadInbox.approve(
      leadId,
      req.user.id,
      opportunity.id,
      req.tenantId
    );

    // Log activity
    await LeadInbox.logActivity(leadId, {
      activityType: 'approved',
      description: `Converted to opportunity #${opportunity.id}`,
      userId: req.user.id,
      metadata: { opportunity_id: opportunity.id },
    });

    res.json({
      lead: updatedLead,
      opportunity,
    });
  } catch (error) {
    console.error('[Lead Inbox] Error approving lead:', error);
    next(error);
  }
});

/**
 * Reject lead
 */
router.post('/:id/reject', authenticate, tenantContext, async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);
    const { reason } = req.body;

    const lead = await LeadInbox.findById(leadId, req.tenantId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updatedLead = await LeadInbox.reject(
      leadId,
      req.user.id,
      reason,
      req.tenantId
    );

    // Log activity
    await LeadInbox.logActivity(leadId, {
      activityType: 'rejected',
      description: `Rejected: ${reason || 'No reason provided'}`,
      userId: req.user.id,
      metadata: { reason },
    });

    res.json(updatedLead);
  } catch (error) {
    console.error('[Lead Inbox] Error rejecting lead:', error);
    next(error);
  }
});

/**
 * Re-process lead with AI
 */
router.post('/:id/reprocess', authenticate, tenantContext, async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);
    const lead = await LeadInbox.findById(leadId, req.tenantId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Reset to pending status
    await LeadInbox.updateExtractedData(leadId, {
      status: 'pending',
      extractedData: null,
      aiConfidence: null,
      error: null,
    }, req.tenantId);

    // Log activity
    await LeadInbox.logActivity(leadId, {
      activityType: 'manual_edit',
      description: 'Re-processing requested',
      userId: req.user.id,
    });

    // Trigger AI extraction
    const emailData = {
      fromEmail: lead.from_email,
      fromName: lead.from_name,
      subject: lead.subject,
      bodyText: lead.body_text,
      strippedText: lead.stripped_text,
    };

    processLeadWithAI(leadId, emailData, req.tenantId).catch(err => {
      console.error('[Lead Inbox] Background AI processing failed:', err);
    });

    res.json({ message: 'Re-processing started' });
  } catch (error) {
    console.error('[Lead Inbox] Error reprocessing lead:', error);
    next(error);
  }
});

/**
 * Update extracted data manually
 */
router.patch('/:id/extracted-data', authenticate, tenantContext, async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);
    const { extractedData } = req.body;

    const lead = await LeadInbox.findById(leadId, req.tenantId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updatedLead = await LeadInbox.updateExtractedDataManual(
      leadId,
      extractedData,
      req.tenantId
    );

    // Log activity
    await LeadInbox.logActivity(leadId, {
      activityType: 'manual_edit',
      description: 'Extracted data manually edited',
      userId: req.user.id,
    });

    res.json(updatedLead);
  } catch (error) {
    console.error('[Lead Inbox] Error updating extracted data:', error);
    next(error);
  }
});

module.exports = router;
