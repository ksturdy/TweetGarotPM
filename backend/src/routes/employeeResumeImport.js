const express = require('express');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { createMemoryUploadMiddleware } = require('../middleware/uploadHandler');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const config = require('../config');
const EmployeeResume = require('../models/EmployeeResume');
const ResumeProject = require('../models/ResumeProject');
const Project = require('../models/Project');
const Employee = require('../models/Employee');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const docxUpload = createMemoryUploadMiddleware({
  allowedTypes: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  maxSize: 25 * 1024 * 1024,
});

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (str) => {
    const bigrams = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const aBigrams = getBigrams(a);
  const bBigrams = getBigrams(b);
  let intersection = 0;
  for (const [bigram, count] of aBigrams) {
    if (bBigrams.has(bigram)) {
      intersection += Math.min(count, bBigrams.get(bigram));
    }
  }

  const totalBigrams = a.length - 1 + b.length - 1;
  return (2 * intersection) / totalBigrams;
}

/**
 * Pull text via mammoth (body only is fine for parsing) and ALL embedded
 * raster images from the .docx zip - this catches photos placed in the
 * document header/footer, which mammoth's body-only image extraction misses.
 */
async function extractDocxContent(buffer) {
  const textResult = await mammoth.extractRawText({ buffer });

  const rasterExt = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
  const extToContentType = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };

  const images = [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    const mediaFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('word/media/') && rasterExt.test(name)
    );

    for (const name of mediaFiles) {
      const ext = path.extname(name).toLowerCase();
      const fileBuffer = await zip.files[name].async('nodebuffer');
      images.push({
        buffer: fileBuffer,
        contentType: extToContentType[ext] || 'image/jpeg',
        sourceName: name,
      });
    }
  } catch (err) {
    console.error('[Resume Import] Could not unzip docx for image extraction:', err.message);
  }

  // Sort largest-first so the headshot (typically the biggest raster) wins
  images.sort((a, b) => b.buffer.length - a.buffer.length);

  return { text: textResult.value, images };
}

function getExtensionFromContentType(contentType) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
  };
  return map[contentType] || '.png';
}

/**
 * Save the first extracted image (resume headshot) to storage and
 * return a relative path suitable for employee_photo_path.
 */
async function savePhotoImage(image, sourceFilename) {
  if (!image) return null;
  const ext = getExtensionFromContentType(image.contentType);
  const baseName = sourceFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
  const fileName = `${uniqueSuffix}-imported-${baseName}${ext}`;
  const destination = 'uploads/resume-photos';
  const key = `${destination}/${fileName}`;

  try {
    if (isR2Enabled()) {
      const r2Client = getR2Client();
      const command = new PutObjectCommand({
        Bucket: config.r2.bucketName,
        Key: key,
        Body: image.buffer,
        ContentType: image.contentType,
      });
      await r2Client.send(command);
      return {
        photo_path: key,
        file_size: image.buffer.length,
        file_type: image.contentType,
      };
    }

    const uploadDir = path.join(__dirname, '../../', destination);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, fileName), image.buffer);
    return {
      photo_path: key,
      file_size: image.buffer.length,
      file_type: image.contentType,
    };
  } catch (err) {
    console.error(`[Resume Import] Error saving headshot from ${sourceFilename}:`, err.message);
    return null;
  }
}

/**
 * Save the original .docx file so it can be downloaded from the resume detail page.
 */
async function saveSourceDocx(file) {
  const destination = 'uploads/resumes';
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
  const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${uniqueSuffix}-${sanitized}`;
  const key = `${destination}/${fileName}`;

  try {
    if (isR2Enabled()) {
      const r2Client = getR2Client();
      const command = new PutObjectCommand({
        Bucket: config.r2.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });
      await r2Client.send(command);
      return key;
    }

    const uploadDir = path.join(__dirname, '../../', destination);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fullPath = path.join(uploadDir, fileName);
    fs.writeFileSync(fullPath, file.buffer);
    return fullPath;
  } catch (err) {
    console.error(`[Resume Import] Error saving source docx ${file.originalname}:`, err.message);
    return null;
  }
}

async function parseResumeWithClaude(documentText, apiKey) {
  const anthropic = new Anthropic({
    apiKey,
    timeout: 120000,
    maxRetries: 2,
  });

  const systemPrompt = `You are a resume parser for Tweet Garot Mechanical, a mechanical contracting company.
You will be given the raw text of an employee resume document. Extract all structured information into JSON.

## Output Schema
{
  "employee_name": "string - employee full name",
  "job_title": "string - current job title (e.g. 'Director of Project Development', 'Senior Project Manager')",
  "years_experience": "number or null - years of experience as an integer (e.g. text 'over 20 years' becomes 20)",
  "summary": "string - the professional summary / bio paragraphs. If multiple paragraphs, join with double newlines.",
  "education": "string or null - education info (degrees, schools, years)",
  "phone": "string or null",
  "email": "string or null",
  "address": "string or null - mailing address if present",
  "certifications": [
    { "name": "string - certification or accreditation name", "issuer": "string or null - issuing organization", "year": "number or null" }
  ],
  "skills": ["array of strings - skills, specializations, software, tools"],
  "languages": [
    { "language": "string", "proficiency": "string - one of: Native, Fluent, Conversational, Basic" }
  ],
  "hobbies": ["array of strings"],
  "references": [
    { "name": "string", "title": "string or null", "company": "string or null", "phone": "string or null" }
  ],
  "projects": [
    {
      "project_name": "string - project / facility name",
      "location": "string or null - city, state if mentioned",
      "customer_name": "string or null - the owner / client",
      "project_role": "string or null - role on the project (Project Manager, Estimator, etc.) - leave null if not stated",
      "description": "string or null - any short description if present",
      "category": "string or null - section heading from the resume (e.g. 'Healthcare', 'Commercial', 'Industrial', 'Education')"
    }
  ]
}

PARSING RULES:
- Resumes from this company typically have these sections: Professional Affiliations / Memberships / Accreditations (= certifications), Partial Work Experience (= projects, often grouped by market like Healthcare / Commercial / Industrial), then a name + title + bio summary at the end.
- Treat each project bullet under "Work Experience" as a separate project entry. A typical line looks like "Aurora Bay Area Medical Center - Marinette, WI" - split on the dash to populate project_name and location. Customer_name should be inferred from the project_name when it is clearly an owner (e.g. hospital systems).
- Capture the section heading (Healthcare, Commercial, etc.) into the project's "category" field so a human reviewer can scan grouping.
- For certifications: lines like "LEED Green Associate - Green Building Certification Institute" -> name = "LEED Green Associate", issuer = "Green Building Certification Institute". Lines like "OSHA 30 Hour" -> name = "OSHA 30 Hour", issuer = null.
- For years_experience: parse phrases like "over 20 years of experience" -> 20, "15+ years" -> 15.
- For summary: include the full bio paragraphs about the person. Do not include section headings or bullet lists.
- If a field is not present, use null for scalars or [] for arrays.
- Respond with ONLY valid JSON. No markdown code fences. No commentary.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Parse this resume document and respond with JSON only:\n\n${documentText}`,
      },
    ],
  });

  const responseText = message.content[0].text;
  let jsonText = responseText.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  return JSON.parse(jsonText);
}

/**
 * Fuzzy-match parsed resume data against tenant employees.
 * Compares against full name (with first/last permutations) and job title.
 * Returns top 5 candidates above a minimum threshold.
 */
async function findEmployeeMatches(parsedData, tenantId) {
  if (!parsedData.employee_name) return [];

  const employees = await Employee.getAll({ employment_status: 'active' }, tenantId);
  const candidates = [];

  for (const emp of employees) {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
    const reverseName = `${emp.last_name || ''} ${emp.first_name || ''}`.trim();

    // Best of forward / reverse name similarity (handles "Alan Van Mun" vs "Van Mun, Alan")
    const nameSim = Math.max(
      stringSimilarity(parsedData.employee_name, fullName),
      stringSimilarity(parsedData.employee_name, reverseName)
    );

    let score = Math.round(nameSim * 75);
    const reasons = [];
    if (nameSim > 0.4) reasons.push(`Name ${Math.round(nameSim * 100)}%`);

    // Job title bonus (up to 25 pts)
    if (parsedData.job_title && emp.job_title) {
      const titleSim = stringSimilarity(parsedData.job_title, emp.job_title);
      score += Math.round(titleSim * 25);
      if (titleSim > 0.4) reasons.push(`Title ${Math.round(titleSim * 100)}%`);
    }

    if (score >= 30) {
      candidates.push({
        employee_id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        full_name: fullName,
        email: emp.email,
        job_title: emp.job_title,
        department_name: emp.department_name,
        confidence: Math.min(score, 100),
        match_reasons: reasons,
      });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 5);
}

/**
 * For each parsed project, fuzzy-match against tenant projects in the DB.
 * Returns top match (if any) attached to each project entry.
 */
async function attachProjectMatches(parsedProjects, tenantId) {
  if (!Array.isArray(parsedProjects) || parsedProjects.length === 0) return [];

  const dbProjects = await Project.findAllByTenant(tenantId);

  return parsedProjects.map((p) => {
    const candidates = [];
    for (const dbp of dbProjects) {
      const nameSim = stringSimilarity(p.project_name, dbp.name);
      let score = Math.round(nameSim * 70);
      const reasons = [];
      if (nameSim > 0.3) reasons.push(`Name ${Math.round(nameSim * 100)}%`);

      if (p.location && dbp.address) {
        const locSim = stringSimilarity(p.location, dbp.address);
        score += Math.round(locSim * 20);
        if (locSim > 0.2) reasons.push(`Location ${Math.round(locSim * 100)}%`);
      }

      const customerName = dbp.customer_name || dbp.client || '';
      if (p.customer_name && customerName) {
        const custSim = stringSimilarity(p.customer_name, customerName);
        score += Math.round(custSim * 10);
        if (custSim > 0.3) reasons.push(`Customer ${Math.round(custSim * 100)}%`);
      }

      if (score >= 25) {
        candidates.push({
          project_id: dbp.id,
          project_name: dbp.name,
          project_number: dbp.number,
          customer_name: dbp.customer_name || dbp.client || null,
          confidence: Math.min(score, 100),
          match_reasons: reasons,
        });
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    return {
      ...p,
      matches: candidates.slice(0, 3),
    };
  });
}

/**
 * POST /api/employee-resumes/import
 * Upload and parse one or more .docx resume files.
 */
router.post('/import', docxUpload.array('files', 20), async (req, res, next) => {
  req.setTimeout(600000);
  res.setTimeout(600000);

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Claude API key not configured. Please contact your administrator.',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`[Resume Import] Processing ${req.files.length} file(s) for tenant ${req.tenantId}`);

    const results = [];

    for (const file of req.files) {
      try {
        console.log(`[Resume Import] Extracting content from: ${file.originalname}`);
        const { text, images } = await extractDocxContent(file.buffer);

        if (!text || text.trim().length < 50) {
          results.push({
            filename: file.originalname,
            status: 'error',
            error: 'Document appears empty or contains no extractable text',
          });
          continue;
        }

        console.log(`[Resume Import] Text extracted (${text.length} chars), ${images.length} image(s) found, sending to Claude...`);
        const parsed = await parseResumeWithClaude(text, apiKey);

        let photoInfo = null;
        if (images.length > 0) {
          photoInfo = await savePhotoImage(images[0], file.originalname);
          if (photoInfo) {
            console.log(`[Resume Import] Saved headshot from ${file.originalname}: ${photoInfo.photo_path}`);
          }
        }
        parsed.extracted_photo = photoInfo;

        const sourceFilePath = await saveSourceDocx(file);
        parsed.source_file = sourceFilePath
          ? {
              file_name: file.originalname,
              file_path: sourceFilePath,
              file_size: file.size,
              file_type: file.mimetype,
            }
          : null;

        if (Array.isArray(parsed.projects)) {
          parsed.projects = await attachProjectMatches(parsed.projects, req.tenantId);
        } else {
          parsed.projects = [];
        }

        const employeeMatches = await findEmployeeMatches(parsed, req.tenantId);
        parsed.employee_matches = employeeMatches;

        console.log(`[Resume Import] Parsed: "${parsed.employee_name}" (${parsed.projects.length} projects, ${(parsed.certifications || []).length} certs, ${employeeMatches.length} employee match${employeeMatches.length === 1 ? '' : 'es'})`);

        results.push({
          filename: file.originalname,
          status: 'success',
          parsed,
        });
      } catch (err) {
        console.error(`[Resume Import] Error processing ${file.originalname}:`, err.message);
        results.push({
          filename: file.originalname,
          status: 'error',
          error: err.message,
        });
      }
    }

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employee-resumes/import/confirm
 * Create resumes from user-reviewed parsed data.
 */
router.post('/import/confirm', async (req, res, next) => {
  try {
    const { resumes } = req.body;

    if (!Array.isArray(resumes) || resumes.length === 0) {
      return res.status(400).json({ error: 'No resumes provided' });
    }

    console.log(`[Resume Import] Confirming ${resumes.length} resume import(s) for tenant ${req.tenantId}`);

    const created = [];
    const errors = [];

    for (const r of resumes) {
      try {
        const resumeData = {
          employee_id: r.selected_employee_id || null,
          employee_name: r.employee_name,
          job_title: r.job_title || '',
          years_experience: r.years_experience != null ? r.years_experience : null,
          summary: r.summary || '',
          education: r.education || null,
          phone: r.phone || null,
          email: r.email || null,
          address: r.address || null,
          certifications: r.certifications || [],
          skills: r.skills || [],
          languages: r.languages || [],
          hobbies: r.hobbies || [],
          references: r.references || [],
          is_active: true,
          employee_photo_path: r.extracted_photo?.photo_path || null,
        };

        if (r.source_file) {
          resumeData.resume_file_name = r.source_file.file_name;
          resumeData.resume_file_path = r.source_file.file_path;
          resumeData.resume_file_size = r.source_file.file_size;
          resumeData.resume_file_type = r.source_file.file_type;
        }

        const record = await EmployeeResume.create(resumeData, req.tenantId, req.user.id);

        const projects = Array.isArray(r.projects) ? r.projects : [];
        let createdProjectCount = 0;
        for (let i = 0; i < projects.length; i++) {
          const p = projects[i];
          if (!p.included) continue;
          try {
            await ResumeProject.create(
              {
                resume_id: record.id,
                project_id: p.selected_project_id || null,
                project_name: p.project_name || 'Untitled Project',
                project_role: p.project_role || '',
                customer_name: p.customer_name || null,
                project_value: null,
                start_date: null,
                end_date: null,
                description: p.description || null,
                square_footage: null,
                location: p.location || null,
                display_order: createdProjectCount,
              },
              req.tenantId
            );
            createdProjectCount += 1;
          } catch (projErr) {
            console.error(`[Resume Import] Error adding project "${p.project_name}" for ${r.employee_name}:`, projErr.message);
          }
        }

        created.push({
          filename: r._source_filename,
          resume: record,
          project_count: createdProjectCount,
        });
      } catch (err) {
        console.error(`[Resume Import] Error creating resume "${r.employee_name}":`, err.message);
        errors.push({
          filename: r._source_filename,
          employee_name: r.employee_name,
          error: err.message,
        });
      }
    }

    console.log(`[Resume Import] Created ${created.length}, errors: ${errors.length}`);
    res.status(201).json({ created, errors });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
