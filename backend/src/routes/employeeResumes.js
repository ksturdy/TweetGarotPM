const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const EmployeeResume = require('../models/EmployeeResume');
const ResumeProject = require('../models/ResumeProject');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createUploadMiddleware } = require('../middleware/uploadHandler');
const { deleteFile } = require('../utils/fileStorage');
const { generateResumeHtml } = require('../utils/resumePdfGenerator');
const { generateResumePdfBuffer } = require('../utils/resumePdfBuffer');

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

    console.log('=== UPDATE RESUME REQUEST ===');
    console.log('Resume ID:', id);
    console.log('Tenant ID:', req.tenantId);
    console.log('User ID:', req.user.id);

    // Verify resume exists and belongs to tenant
    const existing = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      console.log('Resume not found');
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    console.log('Parsing request body...');
    const data = {
      employee_id: req.body.employee_id ? parseInt(req.body.employee_id) : undefined,
      employee_name: req.body.employee_name,
      job_title: req.body.job_title,
      years_experience: req.body.years_experience ? parseInt(req.body.years_experience) : undefined,
      summary: req.body.summary,
      certifications: req.body.certifications ? JSON.parse(req.body.certifications) : undefined,
      skills: req.body.skills ? JSON.parse(req.body.skills) : undefined,
      education: req.body.education,
      phone: req.body.phone,
      email: req.body.email,
      address: req.body.address,
      languages: req.body.languages ? JSON.parse(req.body.languages) : undefined,
      hobbies: req.body.hobbies ? JSON.parse(req.body.hobbies) : undefined,
      references: req.body.references ? JSON.parse(req.body.references) : undefined,
      is_active: req.body.is_active !== undefined ? req.body.is_active === 'true' : undefined
    };

    console.log('Parsed data:', {
      employee_name: data.employee_name,
      skills_length: Array.isArray(data.skills) ? data.skills.length : 'not array',
      hobbies_length: Array.isArray(data.hobbies) ? data.hobbies.length : 'not array',
      has_file: !!req.file
    });

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

    console.log('Calling EmployeeResume.update...');
    const updated = await EmployeeResume.update(id, data, req.tenantId, req.user.id);
    console.log('Update successful');
    res.json(updated);
  } catch (error) {
    console.error('ERROR in PUT /api/employee-resumes/:id:', error);
    console.error('Error stack:', error.stack);
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

// Configure photo upload middleware
const photoUpload = createUploadMiddleware({
  destination: 'uploads/resume-photos',
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  maxSize: 5 * 1024 * 1024 // 5MB
});

/**
 * POST /api/employee-resumes/:id/photo
 * Upload employee photo
 */
router.post('/:id/photo', photoUpload.single('photo'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify resume exists and belongs to tenant
    const existing = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Delete old photo if exists
    if (existing.employee_photo_path) {
      await deleteFile(existing.employee_photo_path);
    }

    // Update resume with new photo path
    // For local storage, convert absolute path to relative path
    // For R2, req.file.key is already relative
    let photoPath = req.file.key || req.file.path;
    if (photoPath && !req.file.key) {
      // Local storage - extract relative path from absolute path
      const uploadIndex = photoPath.indexOf('uploads');
      if (uploadIndex !== -1) {
        photoPath = photoPath.substring(uploadIndex);
        // Normalize path separators to forward slashes for URLs
        photoPath = photoPath.replace(/\\/g, '/');
      }
    }

    const updated = await EmployeeResume.update(
      id,
      { employee_photo_path: photoPath },
      req.tenantId,
      req.user.id
    );

    res.json({
      message: 'Photo uploaded successfully',
      photo_path: photoPath,
      resume: updated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/employee-resumes/:id/photo
 * Delete employee photo
 */
router.delete('/:id/photo', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify resume exists and belongs to tenant
    const existing = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    if (!existing.employee_photo_path) {
      return res.status(404).json({ error: 'No photo to delete' });
    }

    // Delete photo file
    await deleteFile(existing.employee_photo_path);

    // Update resume to remove photo path
    const updated = await EmployeeResume.update(
      id,
      { employee_photo_path: null },
      req.tenantId,
      req.user.id
    );

    res.json({
      message: 'Photo deleted successfully',
      resume: updated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employee-resumes/:id/projects
 * Get all projects for a resume
 */
router.get('/:id/projects', async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`=== GET PROJECTS for resume ${id}, tenant ${req.tenantId} ===`);

    // Verify resume exists and belongs to tenant
    const resume = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!resume) {
      console.log('Resume not found');
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    console.log('Fetching projects from database...');
    const projects = await ResumeProject.findByResumeId(id, req.tenantId);
    console.log(`Found ${projects.length} projects`);
    res.json(projects);
  } catch (error) {
    console.error('ERROR in GET /:id/projects:', error);
    console.error('Error stack:', error.stack);
    next(error);
  }
});

/**
 * POST /api/employee-resumes/:id/projects
 * Add a project to a resume
 */
router.post('/:id/projects', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify resume exists and belongs to tenant
    const resume = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!resume) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    const data = {
      resume_id: parseInt(id),
      project_id: req.body.project_id ? parseInt(req.body.project_id) : null,
      project_name: req.body.project_name,
      project_role: req.body.project_role,
      customer_name: req.body.customer_name,
      project_value: req.body.project_value ? parseFloat(req.body.project_value) : null,
      start_date: req.body.start_date || null,
      end_date: req.body.end_date || null,
      description: req.body.description,
      square_footage: req.body.square_footage ? parseInt(req.body.square_footage) : null,
      location: req.body.location,
      display_order: req.body.display_order !== undefined ? parseInt(req.body.display_order) : 0
    };

    const project = await ResumeProject.create(data, req.tenantId);
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/employee-resumes/:resumeId/projects/:projectId
 * Update a project on a resume
 */
router.put('/:resumeId/projects/:projectId', async (req, res, next) => {
  try {
    const { resumeId, projectId } = req.params;

    // Verify resume exists and belongs to tenant
    const resume = await EmployeeResume.findByIdAndTenant(resumeId, req.tenantId);
    if (!resume) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    const data = {
      project_id: req.body.project_id !== undefined ? (req.body.project_id ? parseInt(req.body.project_id) : null) : undefined,
      project_name: req.body.project_name,
      project_role: req.body.project_role,
      customer_name: req.body.customer_name,
      project_value: req.body.project_value !== undefined ? (req.body.project_value ? parseFloat(req.body.project_value) : null) : undefined,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      description: req.body.description,
      square_footage: req.body.square_footage !== undefined ? (req.body.square_footage ? parseInt(req.body.square_footage) : null) : undefined,
      location: req.body.location,
      display_order: req.body.display_order !== undefined ? parseInt(req.body.display_order) : undefined
    };

    const updated = await ResumeProject.update(projectId, data, req.tenantId);
    if (!updated) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/employee-resumes/:resumeId/projects/:projectId
 * Delete a project from a resume
 */
router.delete('/:resumeId/projects/:projectId', async (req, res, next) => {
  try {
    const { resumeId, projectId } = req.params;

    // Verify resume exists and belongs to tenant
    const resume = await EmployeeResume.findByIdAndTenant(resumeId, req.tenantId);
    if (!resume) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    const deleted = await ResumeProject.delete(projectId, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employee-resumes/:id/projects/reorder
 * Reorder projects for a resume
 */
router.post('/:id/projects/reorder', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { project_ids } = req.body;

    // Verify resume exists and belongs to tenant
    const resume = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!resume) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    if (!Array.isArray(project_ids)) {
      return res.status(400).json({ error: 'project_ids must be an array' });
    }

    await ResumeProject.reorder(parseInt(id), project_ids, req.tenantId);
    res.json({ message: 'Projects reordered successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employee-resumes/:id/preview-html
 * Get resume HTML for browser preview/print
 */
router.get('/:id/preview-html', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch resume
    const resume = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!resume) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    // Fetch projects
    const projects = await ResumeProject.findByResumeId(id, req.tenantId);

    // Convert photo to base64 if exists
    let photoBase64 = '';
    if (resume.employee_photo_path) {
      try {
        // Construct full file path from relative path
        const fullPhotoPath = path.join(__dirname, '../../', resume.employee_photo_path);
        const photoBuffer = await fs.readFile(fullPhotoPath);
        const base64 = photoBuffer.toString('base64');
        const mimeType = resume.employee_photo_path.endsWith('.png') ? 'image/png' :
                        resume.employee_photo_path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        photoBase64 = `data:${mimeType};base64,${base64}`;
      } catch (err) {
        console.error('Error reading photo file:', err);
        // Continue without photo
      }
    }

    const html = generateResumeHtml(resume, projects, photoBase64);
    res.send(html);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employee-resumes/:id/pdf
 * Generate and download resume as PDF
 */
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch resume
    const resume = await EmployeeResume.findByIdAndTenant(id, req.tenantId);
    if (!resume) {
      return res.status(404).json({ error: 'Employee resume not found' });
    }

    // Fetch projects
    const projects = await ResumeProject.findByResumeId(id, req.tenantId);

    // Convert photo to base64 if exists
    let photoBase64 = '';
    if (resume.employee_photo_path) {
      try {
        // Construct full file path from relative path
        const fullPhotoPath = path.join(__dirname, '../../', resume.employee_photo_path);
        const photoBuffer = await fs.readFile(fullPhotoPath);
        const base64 = photoBuffer.toString('base64');
        const mimeType = resume.employee_photo_path.endsWith('.png') ? 'image/png' :
                        resume.employee_photo_path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        photoBase64 = `data:${mimeType};base64,${base64}`;
      } catch (err) {
        console.error('Error reading photo file:', err);
        // Continue without photo
      }
    }

    // Generate PDF
    const pdfBuffer = await generateResumePdfBuffer(resume, projects, photoBase64);

    // Set response headers
    const filename = `${resume.employee_name.replace(/[^a-z0-9]/gi, '_')}_Resume.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
