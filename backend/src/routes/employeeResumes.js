const express = require('express');
const EmployeeResume = require('../models/EmployeeResume');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile } = require('../utils/fileStorage');

const router = express.Router();

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Configure resume file upload middleware
const resumeUpload = createUploadMiddleware({
  destination: 'uploads/resumes',
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  allowedExtensions: ['.pdf', '.doc', '.docx'],
  maxSize: 20 * 1024 * 1024 // 20MB
});

console.log('Upload middleware using local storage for uploads/resumes');

/**
 * GET /api/employee-resumes
 * List all employee resumes for the tenant
 */
router.get('/', async (req, res, next) => {
  try {
    const { employee_id, is_active, search } = req.query;
    const filters = {};

    if (employee_id) filters.employee_id = parseInt(employee_id);
    if (is_active !== undefined) filters.is_active = is_active === 'true';
    if (search) filters.search = search;

    const resumes = await EmployeeResume.findAllByTenant(req.tenantId, filters);
    res.json(resumes);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employee-resumes/:id
 * Get a single employee resume
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const resume = await EmployeeResume.findByIdAndTenant(id, req.tenantId);

    if (!resume) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    res.json(resume);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employee-resumes
 * Create a new employee resume
 */
router.post('/', resumeUpload.single('resume'), async (req, res, next) => {
  try {
    const data = {
      employee_id: req.body.employee_id ? parseInt(req.body.employee_id) : null,
      employee_name: req.body.employee_name,
      job_title: req.body.job_title,
      years_experience: req.body.years_experience ? parseInt(req.body.years_experience) : null,
      summary: req.body.summary,
      certifications: req.body.certifications ? JSON.parse(req.body.certifications) : [],
      skills: req.body.skills ? JSON.parse(req.body.skills) : [],
      education: req.body.education,
      is_active: req.body.is_active !== undefined ? req.body.is_active === 'true' : true
    };

    // Add file metadata if uploaded
    if (req.file) {
      data.resume_file_name = req.file.originalname;
      data.resume_file_path = req.file.path || req.file.key;
      data.resume_file_size = req.file.size;
      data.resume_file_type = req.file.mimetype;
    }

    const resume = await EmployeeResume.create(data, req.tenantId, req.user.id);
    res.status(201).json(resume);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/employee-resumes/:id
 * Update an employee resume
 */
router.put('/:id', resumeUpload.single('resume'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify resume exists and belongs to tenant
    const existing = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    const data = {
      employee_id: req.body.employee_id ? parseInt(req.body.employee_id) : undefined,
      employee_name: req.body.employee_name,
      job_title: req.body.job_title,
      years_experience: req.body.years_experience ? parseInt(req.body.years_experience) : undefined,
      summary: req.body.summary,
      certifications: req.body.certifications ? JSON.parse(req.body.certifications) : undefined,
      skills: req.body.skills ? JSON.parse(req.body.skills) : undefined,
      education: req.body.education,
      is_active: req.body.is_active !== undefined ? req.body.is_active === 'true' : undefined
    };

    // Add file metadata if new file uploaded
    if (req.file) {
      // Delete old file if exists
      if (existing.resume_file_path) {
        await deleteFile(existing.resume_file_path);
      }

      data.resume_file_name = req.file.originalname;
      data.resume_file_path = req.file.path || req.file.key;
      data.resume_file_size = req.file.size;
      data.resume_file_type = req.file.mimetype;
    }

    const updated = await EmployeeResume.update(id, data, req.tenantId, req.user.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/employee-resumes/:id
 * Delete an employee resume
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify resume exists and belongs to tenant
    const existing = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    // Check if used in proposals
    const isUsed = await EmployeeResume.isUsedInProposals(id);
    if (isUsed) {
      return res.status(400).json({
        error: 'Cannot delete employee resume that is used in proposals'
      });
    }

    // Delete file if exists
    if (existing.resume_file_path) {
      await deleteFile(existing.resume_file_path);
    }

    await EmployeeResume.delete(id, req.tenantId);
    res.json({ message: 'Employee resume deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employee-resumes/:id/download
 * Download resume file
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;
    const resume = await EmployeeResume.findByIdAndTenant(id, req.tenantId);

    if (!resume) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    if (!resume.resume_file_path) {
      return res.status(404).json({ error: 'No resume file attached' });
    }

    // For local storage, serve the file directly
    // For R2, this would return a presigned URL
    const filePath = resume.resume_file_path;
    res.download(filePath, resume.resume_file_name);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
