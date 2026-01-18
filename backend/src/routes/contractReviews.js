const express = require('express');
const { authenticate } = require('../middleware/auth');
const ContractReview = require('../models/ContractReview');
const ContractRiskFinding = require('../models/ContractRiskFinding');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Get all contract reviews
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      overall_risk: req.query.overall_risk,
      needs_legal_review: req.query.needs_legal_review === 'true' ? true : undefined,
      uploaded_by: req.query.uploaded_by,
      search: req.query.search,
    };
    const reviews = await ContractReview.findAll(filters);
    res.json(reviews);
  } catch (error) {
    next(error);
  }
});

// Get contract review statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await ContractReview.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get single contract review with risk findings
router.get('/:id', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    const findings = await ContractRiskFinding.findByContractReview(req.params.id);

    res.json({
      ...review,
      findings,
    });
  } catch (error) {
    next(error);
  }
});

// Create new contract review
router.post('/', async (req, res, next) => {
  try {
    console.log('POST /contract-reviews - Request body:', JSON.stringify(req.body, null, 2));
    console.log('POST /contract-reviews - User:', req.user);

    const reviewData = {
      ...req.body,
      uploaded_by: req.user.id,
    };

    console.log('Creating contract review with data:', JSON.stringify(reviewData, null, 2));

    const review = await ContractReview.create(reviewData);
    console.log('Contract review created:', review);

    // Create risk findings if provided
    if (req.body.findings && req.body.findings.length > 0) {
      console.log(`Creating ${req.body.findings.length} risk findings...`);
      for (const finding of req.body.findings) {
        const findingData = {
          contract_review_id: review.id,
          ...finding,
        };
        console.log('Creating finding:', findingData);
        await ContractRiskFinding.create(findingData);
      }
    }

    // Fetch the complete review with findings
    const findings = await ContractRiskFinding.findByContractReview(review.id);
    console.log(`Fetched ${findings.length} findings for review ${review.id}`);

    res.status(201).json({
      ...review,
      findings,
    });
  } catch (error) {
    console.error('Error in POST /contract-reviews:', error);
    next(error);
  }
});

// Update contract review
router.put('/:id', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    // Automatically set reviewed_at when status changes to under_review
    if (req.body.status === 'under_review' && !review.reviewed_at) {
      req.body.reviewed_at = new Date();
      req.body.reviewed_by = req.user.id;
    }

    // Automatically set approved_at when status changes to approved or rejected
    if ((req.body.status === 'approved' || req.body.status === 'rejected') && !review.approved_at) {
      req.body.approved_at = new Date();
      req.body.approved_by = req.user.id;
    }

    const updated = await ContractReview.update(req.params.id, req.body);
    const findings = await ContractRiskFinding.findByContractReview(req.params.id);

    res.json({
      ...updated,
      findings,
    });
  } catch (error) {
    next(error);
  }
});

// Delete contract review
router.delete('/:id', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    // Only allow deletion by uploader or admin
    if (review.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }

    await ContractReview.delete(req.params.id);
    res.json({ message: 'Contract review deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Risk Findings Routes

// Add new risk finding to existing contract review
router.post('/:id/findings', async (req, res, next) => {
  try {
    const review = await ContractReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Contract review not found' });
    }

    const finding = await ContractRiskFinding.create({
      contract_review_id: req.params.id,
      ...req.body,
    });

    res.status(201).json(finding);
  } catch (error) {
    next(error);
  }
});

// Update risk finding
router.put('/:id/findings/:findingId', async (req, res, next) => {
  try {
    const finding = await ContractRiskFinding.findById(req.params.findingId);
    if (!finding) {
      return res.status(404).json({ error: 'Risk finding not found' });
    }

    // Automatically set resolved_at when status changes to resolved
    if (req.body.status === 'resolved' && !finding.resolved_at) {
      req.body.resolved_at = new Date();
      req.body.resolved_by = req.user.id;
    }

    const updated = await ContractRiskFinding.update(req.params.findingId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete risk finding
router.delete('/:id/findings/:findingId', async (req, res, next) => {
  try {
    const finding = await ContractRiskFinding.findById(req.params.findingId);
    if (!finding) {
      return res.status(404).json({ error: 'Risk finding not found' });
    }

    await ContractRiskFinding.delete(req.params.findingId);
    res.json({ message: 'Risk finding deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
