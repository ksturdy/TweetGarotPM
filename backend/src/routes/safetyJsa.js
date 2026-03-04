const express = require('express');
const { body, validationResult } = require('express-validator');
const SafetyJsa = require('../models/SafetyJsa');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { fetchLogoBase64 } = require('../utils/logoFetcher');
const { generateJsaPdfHtml } = require('../utils/jsaPdfGenerator');
const { sendEmail } = require('../utils/emailService');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  // puppeteer not installed - PDF generation will be unavailable
}

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId || req.body.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

// Get JSAs for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status };
    const jsas = await SafetyJsa.findByProject(req.params.projectId, filters);
    res.json(jsas);
  } catch (error) {
    next(error);
  }
});

// Download JSA as PDF
router.get('/:id/pdf', async (req, res, next) => {
  try {
    if (!puppeteer) {
      return res.status(501).json({ error: 'PDF generation not available (puppeteer not installed)' });
    }
    const jsa = await SafetyJsa.findById(req.params.id);
    if (!jsa) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(jsa.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const hazards = await SafetyJsa.getHazards(req.params.id);
    const jsaWithHazards = { ...jsa, hazards };

    const logoBase64 = await fetchLogoBase64(req.tenantId);
    const html = generateJsaPdfHtml(jsaWithHazards, logoBase64);

    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1056, height: 816 });
      await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        landscape: true,
        printBackground: true,
        margin: { top: '0.35in', right: '0.35in', bottom: '0.35in', left: '0.35in' },
        preferCSSPageSize: false,
      });

      const filename = `JSA-${jsa.number}-${project.number || ''}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBuffer));
    } finally {
      if (browser) await browser.close();
    }
  } catch (error) {
    next(error);
  }
});

// Email JSA PDF to jsa@tweetgarot.com
router.post('/:id/email', async (req, res, next) => {
  try {
    if (!puppeteer) {
      return res.status(501).json({ error: 'PDF generation not available (puppeteer not installed)' });
    }
    const jsa = await SafetyJsa.findById(req.params.id);
    if (!jsa) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(jsa.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }

    // Generate the PDF
    const hazards = await SafetyJsa.getHazards(req.params.id);
    const jsaWithHazards = { ...jsa, hazards };
    const logoBase64 = await fetchLogoBase64(req.tenantId);
    const html = generateJsaPdfHtml(jsaWithHazards, logoBase64);

    let pdfBuffer;
    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1056, height: 816 });
      await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
      pdfBuffer = Buffer.from(await page.pdf({
        format: 'Letter',
        landscape: true,
        printBackground: true,
        margin: { top: '0.35in', right: '0.35in', bottom: '0.35in', left: '0.35in' },
        preferCSSPageSize: false,
      }));
    } finally {
      if (browser) await browser.close();
    }

    const filename = `JSA-${jsa.number}-${project.number || ''}.pdf`;
    const subject = `JSA-${jsa.number} - ${project.name || ''} (${project.number || ''})`;
    const extraRecipients = req.body.additionalEmails || [];
    const toAddresses = ['jsa@tweetgarot.com', ...extraRecipients].join(', ');

    const formatDate = (d) => {
      if (!d) return 'N/A';
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #002356; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">JSA-${jsa.number}</h2>
          <p style="margin: 4px 0 0; opacity: 0.9;">${project.name || ''} (${project.number || ''})</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p><strong>Task:</strong> ${jsa.task_description || 'N/A'}</p>
          <p><strong>Date of Work:</strong> ${formatDate(jsa.date_of_work)}</p>
          <p><strong>Location:</strong> ${jsa.work_location || 'N/A'}</p>
          <p><strong>Filled Out By:</strong> ${jsa.filled_out_by || 'N/A'}</p>
          <p><strong>Department / Trade:</strong> ${jsa.department_trade || 'N/A'}</p>
          <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">The JSA PDF is attached to this email.</p>
        </div>
        <div style="background: #f3f4f6; padding: 12px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;">
          Sent from TITAN Field Module
        </div>
      </div>
    `;

    const emailText = `JSA-${jsa.number} - ${project.name} (${project.number})\n\nTask: ${jsa.task_description}\nDate: ${formatDate(jsa.date_of_work)}\nLocation: ${jsa.work_location || 'N/A'}\nFilled Out By: ${jsa.filled_out_by || 'N/A'}\n\nThe JSA PDF is attached to this email.`;

    const result = await sendEmail({
      to: toAddresses,
      subject,
      html: emailHtml,
      text: emailText,
      attachments: [{
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get single JSA with hazards and signatures
router.get('/:id', async (req, res, next) => {
  try {
    const jsa = await SafetyJsa.findById(req.params.id);
    if (!jsa) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(jsa.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const hazards = await SafetyJsa.getHazards(req.params.id);
    const signatures = await SafetyJsa.getSignatures(req.params.id);
    res.json({ ...jsa, hazards, signatures });
  } catch (error) {
    next(error);
  }
});

// Create JSA
router.post(
  '/',
  [
    body('project_id').isInt(),
    body('task_description').trim().notEmpty(),
    body('date_of_work').isDate(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const projectId = req.body.project_id || req.body.projectId;
      const number = await SafetyJsa.getNextNumber(projectId);
      const jsa = await SafetyJsa.create({
        projectId,
        tenantId: req.tenantId,
        number,
        taskDescription: req.body.task_description,
        workLocation: req.body.work_location,
        dateOfWork: req.body.date_of_work,
        weather: req.body.weather,
        temperature: req.body.temperature,
        ppeRequired: req.body.ppe_required,
        customerName: req.body.customer_name,
        departmentTrade: req.body.department_trade,
        filledOutBy: req.body.filled_out_by,
        permitsRequired: req.body.permits_required,
        equipmentRequired: req.body.equipment_required,
        additionalComments: req.body.additional_comments,
        workerNames: req.body.worker_names,
        notes: req.body.notes,
        createdBy: req.user.id,
      });
      res.status(201).json(jsa);
    } catch (error) {
      next(error);
    }
  }
);

// Update JSA
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const jsa = await SafetyJsa.update(req.params.id, req.body);
    res.json(jsa);
  } catch (error) {
    next(error);
  }
});

// Add hazard
router.post(
  '/:id/hazards',
  [
    body('step_description').trim().notEmpty(),
    body('hazard').trim().notEmpty(),
    body('control_measure').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existing = await SafetyJsa.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const hazard = await SafetyJsa.addHazard(req.params.id, {
        sortOrder: req.body.sort_order,
        stepDescription: req.body.step_description,
        hazard: req.body.hazard,
        controlMeasure: req.body.control_measure,
        responsiblePerson: req.body.responsible_person,
      });
      res.status(201).json(hazard);
    } catch (error) {
      next(error);
    }
  }
);

// Update hazard
router.put('/:id/hazards/:hazardId', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const hazard = await SafetyJsa.updateHazard(req.params.hazardId, req.body);
    res.json(hazard);
  } catch (error) {
    next(error);
  }
});

// Delete hazard
router.delete('/:id/hazards/:hazardId', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    await SafetyJsa.deleteHazard(req.params.hazardId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Add signature
router.post(
  '/:id/sign',
  [body('employee_name').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const existing = await SafetyJsa.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const signature = await SafetyJsa.addSignature(req.params.id, {
        employeeName: req.body.employee_name || req.body.employeeName,
        employeeId: req.body.employee_id || req.body.employeeId,
        signatureData: req.body.signature_data || req.body.signatureData,
      });
      res.status(201).json(signature);
    } catch (error) {
      next(error);
    }
  }
);

// Worker sign-in (update worker names)
router.post(
  '/:id/worker-sign-in',
  [body('names').isArray()],
  validate,
  async (req, res, next) => {
    try {
      const existing = await SafetyJsa.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'JSA not found' });
      }
      const jsa = await SafetyJsa.updateWorkerNames(req.params.id, req.body.names);
      res.json(jsa);
    } catch (error) {
      next(error);
    }
  }
);

// Activate JSA
router.post('/:id/activate', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const jsa = await SafetyJsa.activate(req.params.id);
    res.json(jsa);
  } catch (error) {
    next(error);
  }
});

// Complete JSA
router.post('/:id/complete', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const jsa = await SafetyJsa.complete(req.params.id, { reviewedBy: req.user.id });
    res.json(jsa);
  } catch (error) {
    next(error);
  }
});

// Delete (draft only)
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await SafetyJsa.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'JSA not found' });
    }
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft JSAs can be deleted' });
    }
    await SafetyJsa.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
