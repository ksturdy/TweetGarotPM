const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');
const { authenticate } = require('../middleware/auth');
const { tenantContext, getTenantById } = require('../middleware/tenant');
const db = require('../config/database');
const { generateProposalPdfHtml } = require('../utils/proposalPdfGenerator');
const { generateProposalPdfBuffer } = require('../utils/proposalPdfBuffer');
const { fetchLogoBase64 } = require('../utils/logoFetcher');
const { generateCaseStudyPdfHtml } = require('../utils/caseStudyPdfGenerator');
const CaseStudy = require('../models/CaseStudy');
const CaseStudyImage = require('../models/CaseStudyImage');
const CaseStudyTemplate = require('../models/CaseStudyTemplate');
const { getFileUrl } = require('../utils/fileStorage');

// Apply middleware to all routes
router.use(authenticate);
router.use(tenantContext);

// GET /api/proposals - List all proposals with filters
router.get('/', async (req, res, next) => {
  try {
    const filters = {};

    if (req.query.status) filters.status = req.query.status;
    if (req.query.customer_id) filters.customer_id = parseInt(req.query.customer_id);
    if (req.query.opportunity_id) filters.opportunity_id = parseInt(req.query.opportunity_id);
    if (req.query.created_by) filters.created_by = parseInt(req.query.created_by);
    if (req.query.is_latest !== undefined) filters.is_latest = req.query.is_latest === 'true';

    const proposals = await Proposal.findAllByTenant(req.tenantId, filters);
    res.json(proposals);
  } catch (error) {
    next(error);
  }
});

// GET /api/proposals/:id - Get single proposal with full details
router.get('/:id', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(
      parseInt(req.params.id),
      req.tenantId
    );

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(proposal);
  } catch (error) {
    next(error);
  }
});

// POST /api/proposals - Create new proposal
router.post('/', async (req, res, next) => {
  try {
    const proposal = await Proposal.create(req.body, req.user.id, req.tenantId);
    res.status(201).json(proposal);
  } catch (error) {
    next(error);
  }
});

// POST /api/proposals/from-template - Create proposal from template
router.post('/from-template', async (req, res, next) => {
  try {
    const { templateId, ...proposalData } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // Load tenant and customer data for template variable substitution
    const tenant = await getTenantById(req.tenantId);
    let customer = null;
    if (proposalData.customer_id) {
      const customerResult = await db.query(
        'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2',
        [proposalData.customer_id, req.tenantId]
      );
      customer = customerResult.rows[0] || null;
    }

    const context = {
      tenant,
      customer,
      user: { name: `${req.user.first_name} ${req.user.last_name}`, email: req.user.email, title: req.user.title || '' },
    };

    const proposal = await Proposal.createFromTemplate(
      parseInt(templateId),
      proposalData,
      req.user.id,
      req.tenantId,
      context
    );

    res.status(201).json(proposal);
  } catch (error) {
    next(error);
  }
});

// PUT /api/proposals/:id - Update proposal
router.put('/:id', async (req, res, next) => {
  try {
    const proposal = await Proposal.update(
      parseInt(req.params.id),
      req.body,
      req.tenantId
    );
    res.json(proposal);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/proposals/:id/status - Update proposal status (workflow)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const proposal = await Proposal.updateStatus(
      parseInt(req.params.id),
      status,
      req.user.id,
      req.tenantId
    );

    res.json(proposal);
  } catch (error) {
    if (error.message.includes('Invalid status transition')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// POST /api/proposals/:id/revise - Create new version/revision
router.post('/:id/revise', async (req, res, next) => {
  try {
    const revision = await Proposal.createRevision(
      parseInt(req.params.id),
      req.user.id,
      req.tenantId
    );
    res.status(201).json(revision);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/proposals/:id - Delete proposal
router.delete('/:id', async (req, res, next) => {
  try {
    await Proposal.delete(parseInt(req.params.id), req.tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/proposals/:id/sections - Get proposal sections
router.get('/:id/sections', async (req, res, next) => {
  try {
    // Verify proposal belongs to tenant
    const proposal = await Proposal.findByIdAndTenant(
      parseInt(req.params.id),
      req.tenantId
    );

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const sections = await Proposal.getSections(parseInt(req.params.id));
    res.json(sections);
  } catch (error) {
    next(error);
  }
});

// PUT /api/proposals/:id/sections/:sectionId - Update section
router.put('/:id/sections/:sectionId', async (req, res, next) => {
  try {
    // Verify proposal belongs to tenant
    const proposal = await Proposal.findByIdAndTenant(
      parseInt(req.params.id),
      req.tenantId
    );

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const section = await Proposal.updateSection(
      parseInt(req.params.sectionId),
      req.body
    );

    res.json(section);
  } catch (error) {
    next(error);
  }
});

// === CASE STUDIES ===

// GET /api/proposals/:id/case-studies
router.get('/:id/case-studies', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const caseStudies = await Proposal.getCaseStudies(parseInt(req.params.id));
    res.json(caseStudies);
  } catch (error) { next(error); }
});

// POST /api/proposals/:id/case-studies
router.post('/:id/case-studies', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (!req.body.case_study_id) return res.status(400).json({ error: 'case_study_id is required' });
    const result = await Proposal.addCaseStudy(parseInt(req.params.id), req.body.case_study_id, req.body);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// DELETE /api/proposals/:id/case-studies/:caseStudyId
router.delete('/:id/case-studies/:caseStudyId', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const removed = await Proposal.removeCaseStudy(parseInt(req.params.id), parseInt(req.params.caseStudyId));
    if (!removed) return res.status(404).json({ error: 'Case study not attached to this proposal' });
    res.json({ message: 'Case study removed', item: removed });
  } catch (error) { next(error); }
});

// === SERVICE OFFERINGS ===

// GET /api/proposals/:id/service-offerings
router.get('/:id/service-offerings', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const offerings = await Proposal.getServiceOfferings(parseInt(req.params.id));
    res.json(offerings);
  } catch (error) { next(error); }
});

// POST /api/proposals/:id/service-offerings
router.post('/:id/service-offerings', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (!req.body.service_offering_id) return res.status(400).json({ error: 'service_offering_id is required' });
    const result = await Proposal.addServiceOffering(parseInt(req.params.id), req.body.service_offering_id, req.body);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// DELETE /api/proposals/:id/service-offerings/:serviceOfferingId
router.delete('/:id/service-offerings/:serviceOfferingId', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const removed = await Proposal.removeServiceOffering(parseInt(req.params.id), parseInt(req.params.serviceOfferingId));
    if (!removed) return res.status(404).json({ error: 'Service offering not attached to this proposal' });
    res.json({ message: 'Service offering removed', item: removed });
  } catch (error) { next(error); }
});

// === RESUMES ===

// GET /api/proposals/:id/resumes
router.get('/:id/resumes', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const resumes = await Proposal.getResumes(parseInt(req.params.id));
    res.json(resumes);
  } catch (error) { next(error); }
});

// POST /api/proposals/:id/resumes
router.post('/:id/resumes', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (!req.body.resume_id) return res.status(400).json({ error: 'resume_id is required' });
    const result = await Proposal.addResume(parseInt(req.params.id), req.body.resume_id, req.body);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// DELETE /api/proposals/:id/resumes/:resumeId
router.delete('/:id/resumes/:resumeId', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const removed = await Proposal.removeResume(parseInt(req.params.id), parseInt(req.params.resumeId));
    if (!removed) return res.status(404).json({ error: 'Resume not attached to this proposal' });
    res.json({ message: 'Resume removed', item: removed });
  } catch (error) { next(error); }
});

// === PDF / PREVIEW ===

// Helper: load full case study HTML for each attached case study
async function buildCaseStudyPages(caseStudies, tenantId, logoBase64) {
  const pages = [];
  for (const cs of caseStudies) {
    const fullCs = await CaseStudy.findByIdAndTenant(cs.id, tenantId);
    if (!fullCs) continue;

    const rawImages = await CaseStudyImage.findByCaseStudy(fullCs.id);
    const images = await Promise.all(
      rawImages.map(async (img) => ({ ...img, image_url: await getFileUrl(img.file_path) }))
    );

    let template = null;
    if (fullCs.template_id) {
      template = await CaseStudyTemplate.findByIdAndTenant(fullCs.template_id, tenantId);
    }

    let customerLogoUrl = null;
    if (fullCs.customer_logo_url) {
      customerLogoUrl = await getFileUrl(fullCs.customer_logo_url);
    }

    // Generate the full case study HTML (extract just the body content)
    const csHtml = generateCaseStudyPdfHtml(fullCs, template, images, logoBase64, customerLogoUrl);
    pages.push(csHtml);
  }
  return pages;
}

// GET /api/proposals/:id/pdf - HTML preview (for browser print)
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const logoBase64 = await fetchLogoBase64(req.tenantId);
    const caseStudyPages = await buildCaseStudyPages(proposal.case_studies || [], req.tenantId, logoBase64);
    const html = generateProposalPdfHtml(proposal, logoBase64, caseStudyPages);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

// GET /api/proposals/:id/pdf-download - Binary PDF download
router.get('/:id/pdf-download', async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const logoBase64 = await fetchLogoBase64(req.tenantId);
    const caseStudyPages = await buildCaseStudyPages(proposal.case_studies || [], req.tenantId, logoBase64);
    const pdfBuffer = await generateProposalPdfBuffer(proposal, logoBase64, caseStudyPages);

    const filename = `Proposal-${(proposal.proposal_number || proposal.title).replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
