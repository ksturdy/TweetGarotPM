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
  if (!value) return '';
  return '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatNumber(value) {
  if (!value) return '';
  return Number(value).toLocaleString('en-US');
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

/**
 * Generate resume HTML
 * @param {Object} resume - Resume data
 * @param {Array} projects - Project experience array
 * @param {String} photoBase64 - Base64 encoded photo
 */
function generateResumeHtml(resume, projects = [], photoBase64 = '') {
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

  const sidebarSections = [];
  const mainSections = [];

  // Generate sidebar content
  const contactHtml = generateContactSection(phone, email, address);
  if (contactHtml) sidebarSections.push(contactHtml);

  const referencesHtml = generateReferencesSection(parsedReferences);
  if (referencesHtml) sidebarSections.push(referencesHtml);

  const hobbiesHtml = generateHobbiesSection(parsedHobbies);
  if (hobbiesHtml) sidebarSections.push(hobbiesHtml);

  // Generate main content
  if (summary) {
    mainSections.push(`
      <div class="section">
        <h2 class="section-title">About Me</h2>
        <p class="summary-text">${escapeHtml(summary)}</p>
      </div>
    `);
  }

  const projectsHtml = generateProjectsSection(projects);
  if (projectsHtml) mainSections.push(projectsHtml);

  const educationHtml = generateEducationSection(education, parsedCertifications);
  if (educationHtml) mainSections.push(educationHtml);

  const skillsHtml = generateSkillsSection(parsedSkills);
  if (skillsHtml) mainSections.push(skillsHtml);

  const languagesHtml = generateLanguagesSection(parsedLanguages);
  if (languagesHtml) mainSections.push(languagesHtml);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${getResumeStyles()}
      </style>
    </head>
    <body>
      <div class="resume-container">
        <!-- Left Sidebar -->
        <div class="sidebar">
          ${photoBase64 ? `
            <div class="photo-container">
              <img src="${photoBase64}" alt="${escapeHtml(employee_name)}" class="employee-photo" />
            </div>
          ` : ''}

          <div class="name-title">
            <h1 class="employee-name">${escapeHtml(employee_name || '')}</h1>
            <p class="job-title">${escapeHtml(job_title || '')}</p>
            ${years_experience ? `<p class="years-experience">${years_experience} Years Experience</p>` : ''}
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

function generateContactSection(phone, email, address) {
  const items = [];

  if (phone) items.push(`<div class="contact-item"><span class="contact-icon">📞</span><span>${escapeHtml(phone)}</span></div>`);
  if (email) items.push(`<div class="contact-item"><span class="contact-icon">✉️</span><span>${escapeHtml(email)}</span></div>`);
  if (address) items.push(`<div class="contact-item"><span class="contact-icon">📍</span><span>${escapeHtml(address)}</span></div>`);

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

    const details = [];
    if (proj.customer_name) details.push(`<strong>Client:</strong> ${escapeHtml(proj.customer_name)}`);
    if (proj.location) details.push(`<strong>Location:</strong> ${escapeHtml(proj.location)}`);
    if (proj.square_footage) details.push(`<strong>Size:</strong> ${formatNumber(proj.square_footage)} sq ft`);

    return `
      <div class="project-item">
        <div class="project-header">
          <h4 class="project-name">${escapeHtml(proj.project_name || '')}</h4>
          ${proj.project_value ? `<p class="project-role">Value: ${formatCurrency(proj.project_value)}</p>` : ''}
        </div>
        ${dateRange}
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

function getResumeStyles() {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1a1a1a;
    }

    .resume-container {
      display: grid;
      grid-template-columns: 30% 70%;
      width: 100%;
      min-height: 100vh;
    }

    /* ===== SIDEBAR STYLES ===== */
    .sidebar {
      background-color: #1e3a5f;
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

    .contact-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 0.75rem;
      font-size: 9pt;
      line-height: 1.4;
    }

    .contact-icon {
      margin-right: 0.5rem;
      flex-shrink: 0;
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
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 13pt;
      font-weight: bold;
      color: #1e3a5f;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 3px solid #1e3a5f;
    }

    .summary-text {
      font-size: 10pt;
      line-height: 1.6;
      text-align: justify;
    }

    .project-item {
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .project-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 0;
    }

    .project-header {
      margin-bottom: 0.5rem;
    }

    .project-name {
      font-size: 11pt;
      font-weight: bold;
      color: #1e3a5f;
      margin-bottom: 0.25rem;
    }

    .project-role {
      font-size: 10pt;
      color: #1e3a5f;
      font-weight: 600;
    }

    .project-dates {
      font-size: 9pt;
      color: #666;
      font-style: italic;
      margin-bottom: 0.5rem;
    }

    .project-details {
      font-size: 9pt;
      color: #555;
      margin-bottom: 0.5rem;
    }

    .project-description {
      font-size: 10pt;
      line-height: 1.5;
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
      color: #1e3a5f;
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
      color: #1e3a5f;
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
