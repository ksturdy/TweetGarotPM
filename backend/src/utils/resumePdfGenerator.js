/**
 * Resume PDF Generator
 * Generates HTML for employee resumes matching marketing template design
 * Two-column layout: dark sidebar (left) with photo and contact info, main content area (right)
 */

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short'
  });
}

function formatCurrency(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatNumber(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('en-US');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const DEFAULT_LIMITS = {
  summary_chars: 600,
  projects: 5,
  certifications: 6,
  skills: 12,
  languages: 4,
  hobbies: 6,
  references: 3,
};

const DEFAULT_LAYOUT = {
  show_photo: true,
  show_years_experience: true,
  sidebar_color: '#1e3a5f',
  sections: {
    contact: true,
    references: true,
    hobbies: true,
    summary: true,
    projects: true,
    education: true,
    skills: true,
    languages: true,
  },
};

function resolveLimits(template) {
  if (!template) return { ...DEFAULT_LIMITS };
  const raw = template.section_limits;
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  return { ...DEFAULT_LIMITS, ...parsed };
}

function resolveLayout(template) {
  if (!template) return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  const raw = template.layout_config;
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  return {
    ...DEFAULT_LAYOUT,
    ...parsed,
    sections: { ...DEFAULT_LAYOUT.sections, ...(parsed.sections || {}) },
  };
}

function takeFirst(arr, n) {
  if (!Array.isArray(arr)) return [];
  if (typeof n !== 'number' || n <= 0) return arr;
  return arr.slice(0, n);
}

function truncateText(text, maxChars) {
  if (!text) return '';
  if (typeof maxChars !== 'number' || maxChars <= 0) return text;
  if (text.length <= maxChars) return text;
  // Cut at the nearest sentence/word boundary so we don't lop a word in half.
  const slice = text.slice(0, maxChars);
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  const cut = lastBreak > maxChars * 0.6 ? lastBreak + 1 : slice.lastIndexOf(' ');
  return (cut > 0 ? slice.slice(0, cut) : slice).trim() + '…';
}

/**
 * Generate resume HTML
 * @param {Object} resume - Resume data
 * @param {Array} projects - Project experience array
 * @param {String} photoBase64 - Base64 encoded photo
 * @param {Object} template - Resume template row (provides section_limits)
 */
function generateResumeHtml(resume, projects = [], photoBase64 = '', template = null) {
  const limits = resolveLimits(template);
  const layout = resolveLayout(template);
  const sections = layout.sections;

  const {
    employee_name,
    job_title,
    years_experience,
    summary,
    phone,
    email,
    address,
    education,
    certifications = [],
    skills = [],
    languages = [],
    hobbies = [],
    references = []
  } = resume;

  // Parse JSON fields if they're strings
  const parsedCertifications = typeof certifications === 'string' ? JSON.parse(certifications) : certifications;
  const parsedSkills = Array.isArray(skills) ? skills : (typeof skills === 'string' ? JSON.parse(skills) : []);
  const parsedLanguages = typeof languages === 'string' ? JSON.parse(languages) : languages;
  const parsedHobbies = Array.isArray(hobbies) ? hobbies : (typeof hobbies === 'string' ? JSON.parse(hobbies) : []);
  const parsedReferences = typeof references === 'string' ? JSON.parse(references) : references;

  // Apply section limits so the rendered page stays inside its 8.5x11 budget.
  const cappedProjects = takeFirst(projects, limits.projects);
  const cappedCertifications = takeFirst(parsedCertifications, limits.certifications);
  const cappedSkills = takeFirst(parsedSkills, limits.skills);
  const cappedLanguages = takeFirst(parsedLanguages, limits.languages);
  const cappedHobbies = takeFirst(parsedHobbies, limits.hobbies);
  const cappedReferences = takeFirst(parsedReferences, limits.references);
  const cappedSummary = truncateText(summary, limits.summary_chars);

  const sidebarSections = [];
  const mainSections = [];

  // Generate sidebar content (respects per-section visibility)
  if (sections.contact) {
    const contactHtml = generateContactSection(phone, email, address);
    if (contactHtml) sidebarSections.push(contactHtml);
  }

  if (sections.references) {
    const referencesHtml = generateReferencesSection(cappedReferences);
    if (referencesHtml) sidebarSections.push(referencesHtml);
  }

  if (sections.hobbies) {
    const hobbiesHtml = generateHobbiesSection(cappedHobbies);
    if (hobbiesHtml) sidebarSections.push(hobbiesHtml);
  }

  // Generate main content
  if (sections.summary && cappedSummary) {
    mainSections.push(`
      <div class="section">
        <h2 class="section-title">About Me</h2>
        <p class="summary-text">${escapeHtml(cappedSummary)}</p>
      </div>
    `);
  }

  if (sections.projects) {
    const projectsHtml = generateProjectsSection(cappedProjects);
    if (projectsHtml) mainSections.push(projectsHtml);
  }

  if (sections.education) {
    const educationHtml = generateEducationSection(education, cappedCertifications);
    if (educationHtml) mainSections.push(educationHtml);
  }

  if (sections.skills) {
    const skillsHtml = generateSkillsSection(cappedSkills);
    if (skillsHtml) mainSections.push(skillsHtml);
  }

  if (sections.languages) {
    const languagesHtml = generateLanguagesSection(cappedLanguages);
    if (languagesHtml) mainSections.push(languagesHtml);
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${getResumeStyles(layout)}
      </style>
    </head>
    <body>
      <div class="resume-container">
        <!-- Left Sidebar -->
        <div class="sidebar">
          ${layout.show_photo && photoBase64 ? `
            <div class="photo-container">
              <img src="${photoBase64}" alt="${escapeHtml(employee_name)}" class="employee-photo" />
            </div>
          ` : ''}

          <div class="name-title">
            <h1 class="employee-name">${escapeHtml(employee_name || '')}</h1>
            <p class="job-title">${escapeHtml(job_title || '')}</p>
            ${layout.show_years_experience && years_experience ? `<p class="years-experience">${years_experience} Years Experience</p>` : ''}
          </div>

          ${sidebarSections.join('\n')}
        </div>

        <!-- Main Content Area -->
        <div class="main-content">
          ${mainSections.join('\n')}
        </div>
      </div>
    </body>
    </html>
  `;
}

const PHONE_SVG = `<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>`;
const MAIL_SVG = `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`;
const PIN_SVG = `<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

function generateContactSection(phone, email /* address intentionally unused — field retired */) {
  const items = [];

  if (phone) items.push(`<div class="contact-item"><span class="contact-icon">${PHONE_SVG}</span><span class="contact-text">${escapeHtml(phone)}</span></div>`);
  if (email) items.push(`<div class="contact-item"><span class="contact-icon">${MAIL_SVG}</span><span class="contact-text">${escapeHtml(email)}</span></div>`);

  if (items.length === 0) return '';

  return `
    <div class="sidebar-section">
      <h3 class="sidebar-title">Contact</h3>
      <div class="contact-list">
        ${items.join('')}
      </div>
    </div>
  `;
}

function generateReferencesSection(references) {
  if (!Array.isArray(references) || references.length === 0) return '';

  const items = references.map(ref => `
    <div class="reference-item">
      <p class="reference-name">${escapeHtml(ref.name || '')}</p>
      ${ref.title ? `<p class="reference-title">${escapeHtml(ref.title)}</p>` : ''}
      ${ref.company ? `<p class="reference-company">${escapeHtml(ref.company)}</p>` : ''}
      ${ref.phone ? `<p class="reference-phone">${escapeHtml(ref.phone)}</p>` : ''}
    </div>
  `).join('');

  return `
    <div class="sidebar-section">
      <h3 class="sidebar-title">References</h3>
      ${items}
    </div>
  `;
}

function generateHobbiesSection(hobbies) {
  if (!Array.isArray(hobbies) || hobbies.length === 0) return '';

  const items = hobbies.map(hobby => `<li>${escapeHtml(hobby)}</li>`).join('');

  return `
    <div class="sidebar-section">
      <h3 class="sidebar-title">Hobbies & Interests</h3>
      <ul class="hobbies-list">
        ${items}
      </ul>
    </div>
  `;
}

function generateProjectsSection(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return '';

  const items = projects.map(proj => {
    const dateRange = proj.start_date || proj.end_date
      ? `<p class="project-dates">${formatDate(proj.start_date)} - ${proj.end_date ? formatDate(proj.end_date) : 'Present'}</p>`
      : '';

    // Compact details: client + location + size only — value lives in the header line
    const details = [];
    if (proj.customer_name) details.push(`<strong>Client:</strong> ${escapeHtml(proj.customer_name)}`);
    if (proj.location) details.push(escapeHtml(proj.location));
    if (proj.square_footage) details.push(`${formatNumber(proj.square_footage)} sq ft`);

    const valueText = formatCurrency(proj.project_value);

    const hasMeta = !!(valueText || dateRange);
    return `
      <div class="project-item">
        <div class="project-header">
          <h4 class="project-name">${escapeHtml(proj.project_name || '')}</h4>
          ${hasMeta ? `<div class="project-meta">${valueText ? `<p class="project-role">${valueText}</p>` : ''}${dateRange}</div>` : ''}
        </div>
        ${details.length > 0 ? `<p class="project-details">${details.join(' • ')}</p>` : ''}
        ${proj.description ? `<p class="project-description">${escapeHtml(proj.description)}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <h2 class="section-title">Project Experience</h2>
      ${items}
    </div>
  `;
}

function generateEducationSection(education, certifications) {
  if (!education && (!Array.isArray(certifications) || certifications.length === 0)) return '';

  let html = '<div class="section"><h2 class="section-title">Education & Certifications</h2>';

  if (education) {
    html += `<div class="education-text">${escapeHtml(education)}</div>`;
  }

  if (Array.isArray(certifications) && certifications.length > 0) {
    const certItems = certifications.map(cert => {
      const parts = [escapeHtml(cert.name || '')];
      if (cert.issuer) parts.push(` - ${escapeHtml(cert.issuer)}`);
      if (cert.year) parts.push(` (${cert.year})`);
      return `<li>${parts.join('')}</li>`;
    }).join('');

    html += `<ul class="certifications-list">${certItems}</ul>`;
  }

  html += '</div>';
  return html;
}

function generateSkillsSection(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return '';

  const items = skills.map(skill => `<span class="skill-pill">${escapeHtml(skill)}</span>`).join('');

  return `
    <div class="section">
      <h2 class="section-title">Skills & Specializations</h2>
      <div class="skills-grid">
        ${items}
      </div>
    </div>
  `;
}

function generateLanguagesSection(languages) {
  if (!Array.isArray(languages) || languages.length === 0) return '';

  const items = languages.map(lang => `
    <div class="language-item">
      <span class="language-name">${escapeHtml(lang.language || '')}</span>
      <span class="language-proficiency">${escapeHtml(lang.proficiency || '')}</span>
    </div>
  `).join('');

  return `
    <div class="section">
      <h2 class="section-title">Languages</h2>
      <div class="languages-grid">
        ${items}
      </div>
    </div>
  `;
}

function getResumeStyles(layout = DEFAULT_LAYOUT) {
  const sidebarColor = (layout && layout.sidebar_color) || DEFAULT_LAYOUT.sidebar_color;
  return `
    @page {
      size: letter portrait;
      margin: 0.5in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 7.5in;        /* 8.5in - 2 * 0.5in margin */
      height: 10in;        /* 11in  - 2 * 0.5in margin */
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1a1a1a;
      overflow: hidden;    /* belt-and-suspenders single-page guard */
    }

    .resume-container {
      display: grid;
      grid-template-columns: 30% 70%;
      width: 100%;
      height: 10in;
      max-height: 10in;
      overflow: hidden;
    }

    /* ===== SIDEBAR STYLES ===== */
    .sidebar {
      background-color: ${sidebarColor};
      color: white;
      padding: 2rem 1.5rem;
    }

    .photo-container {
      display: flex;
      justify-content: center;
      margin-bottom: 1.5rem;
    }

    .employee-photo {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      object-fit: cover;
      border: 4px solid white;
    }

    .name-title {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 2px solid rgba(255, 255, 255, 0.3);
    }

    .employee-name {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .job-title {
      font-size: 11pt;
      color: #e0e0e0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.25rem;
    }

    .years-experience {
      font-size: 9pt;
      color: #b0b0b0;
    }

    .sidebar-section {
      margin-bottom: 1.5rem;
    }

    .sidebar-title {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid rgba(255, 255, 255, 0.3);
    }

    .contact-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .contact-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 8.5pt;
      line-height: 1.3;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .contact-icon {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    }

    .contact-icon svg {
      width: 100%;
      height: 100%;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .contact-text {
      flex: 1;
      min-width: 0;
    }

    .reference-item {
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .reference-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 0;
    }

    .reference-name {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 0.25rem;
    }

    .reference-title,
    .reference-company,
    .reference-phone {
      font-size: 9pt;
      color: #e0e0e0;
      margin-bottom: 0.1rem;
    }

    .hobbies-list {
      list-style: none;
      font-size: 9pt;
    }

    .hobbies-list li {
      padding-left: 1rem;
      margin-bottom: 0.5rem;
      position: relative;
    }

    .hobbies-list li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: #10b981;
    }

    /* ===== MAIN CONTENT STYLES ===== */
    .main-content {
      background-color: white;
      padding: 2rem;
    }

    .section {
      margin-bottom: 1.1rem;
    }

    .section-title {
      font-size: 12pt;
      font-weight: bold;
      color: ${sidebarColor};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 0.5rem;
      padding-bottom: 0.3rem;
      border-bottom: 3px solid ${sidebarColor};
    }

    .summary-text {
      font-size: 10pt;
      line-height: 1.6;
      text-align: justify;
    }

    .project-item {
      margin-bottom: 0.6rem;
      padding-bottom: 0.6rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .project-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 0;
    }

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.1rem;
    }

    .project-name {
      font-size: 10.5pt;
      font-weight: bold;
      color: ${sidebarColor};
      margin: 0;
      flex: 1;
      min-width: 0;
    }

    .project-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .project-role {
      font-size: 10pt;
      color: ${sidebarColor};
      font-weight: 700;
      margin: 0;
      white-space: nowrap;
    }

    .project-dates {
      font-size: 8.5pt;
      color: #666;
      font-style: italic;
      margin: 0;
      text-align: right;
    }

    .project-details {
      font-size: 8.5pt;
      color: #555;
      margin: 0 0 0.15rem;
    }

    .project-description {
      font-size: 9pt;
      line-height: 1.4;
      margin: 0;
    }

    .education-text {
      font-size: 10pt;
      line-height: 1.6;
      margin-bottom: 1rem;
      white-space: pre-line;
    }

    .certifications-list {
      list-style: none;
      font-size: 10pt;
    }

    .certifications-list li {
      padding-left: 1.5rem;
      margin-bottom: 0.5rem;
      position: relative;
    }

    .certifications-list li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: bold;
    }

    .skills-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .skill-pill {
      display: inline-block;
      padding: 0.4rem 0.8rem;
      background-color: #f0f0f0;
      color: ${sidebarColor};
      border-radius: 20px;
      font-size: 9pt;
      font-weight: 600;
    }

    .languages-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .language-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      background-color: #f8f8f8;
      border-radius: 4px;
    }

    .language-name {
      font-size: 10pt;
      font-weight: bold;
      color: ${sidebarColor};
    }

    .language-proficiency {
      font-size: 9pt;
      color: #666;
    }

    /* ===== PRINT STYLES ===== */
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .resume-container {
        page-break-inside: avoid;
      }

      .project-item,
      .reference-item {
        page-break-inside: avoid;
      }
    }
  `;
}

module.exports = { generateResumeHtml };
