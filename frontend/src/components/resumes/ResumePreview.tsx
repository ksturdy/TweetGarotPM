import React from 'react';
import { EmployeeResume, ResumeProject } from '../../services/employeeResumes';
import { ResumeTemplate } from '../../services/resumeTemplates';
import '../../styles/Resume.css';

interface ResumePreviewProps {
  resume: EmployeeResume;
  projects: ResumeProject[];
  photoPreviewUrl?: string;
  template?: ResumeTemplate | null;
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

const DEFAULT_VISIBILITY = {
  contact: true,
  references: true,
  hobbies: true,
  summary: true,
  projects: true,
  education: true,
  skills: true,
  languages: true,
};

function takeFirst<T>(arr: T[] | undefined | null, n: number): T[] {
  if (!Array.isArray(arr)) return [];
  if (typeof n !== 'number' || n < 0) return arr;
  return arr.slice(0, n);
}

function truncateText(text: string, maxChars: number) {
  if (!text || maxChars <= 0 || text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  const cut = lastBreak > maxChars * 0.6 ? lastBreak + 1 : slice.lastIndexOf(' ');
  return (cut > 0 ? slice.slice(0, cut) : slice).trim() + '…';
}

const ResumePreview: React.FC<ResumePreviewProps> = ({ resume, projects, photoPreviewUrl, template }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  // Postgres NUMERIC columns can come back as strings; coerce so checks/format work.
  const toNum = (value: unknown): number => {
    if (value == null || value === '') return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
  };

  const formatCurrency = (value: unknown) => {
    const n = toNum(value);
    if (n <= 0) return '';
    return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const formatNumber = (value: unknown) => {
    const n = toNum(value);
    if (n <= 0) return '';
    return n.toLocaleString('en-US');
  };

  // Resolve template config (limits, visibility, accent color)
  const limits = { ...DEFAULT_LIMITS, ...(template?.section_limits || {}) };
  const layout = template?.layout_config || {};
  const visibility = { ...DEFAULT_VISIBILITY, ...(layout.sections || {}) };
  const showPhoto = layout.show_photo ?? true;
  const showYearsExperience = layout.show_years_experience ?? true;
  const sidebarColor = layout.sidebar_color || '#1e3a5f';

  // Apply limits (matches backend resumePdfGenerator behavior)
  const cappedSummary = truncateText(resume.summary || '', limits.summary_chars);
  const cappedProjects = takeFirst(projects, limits.projects);
  const cappedCertifications = takeFirst(resume.certifications, limits.certifications);
  const cappedSkills = takeFirst(resume.skills, limits.skills);
  const cappedLanguages = takeFirst(resume.languages, limits.languages);
  const cappedHobbies = takeFirst(resume.hobbies, limits.hobbies);
  const cappedReferences = takeFirst(resume.references, limits.references);

  const photoSrc = photoPreviewUrl || (resume.employee_photo_path ? `/${resume.employee_photo_path}` : null);

  const containerStyle = { '--resume-accent': sidebarColor } as React.CSSProperties;

  return (
    <div className="resume-container" style={containerStyle}>
      {/* Left Sidebar */}
      <div className="resume-sidebar">
        {showPhoto && photoSrc && (
          <div className="photo-container">
            <img src={photoSrc} alt={resume.employee_name} className="employee-photo" />
          </div>
        )}

        <div className="name-title">
          <h1 className="employee-name">{resume.employee_name}</h1>
          <p className="job-title">{resume.job_title}</p>
          {showYearsExperience && resume.years_experience && (
            <p className="years-experience">{resume.years_experience} Years Experience</p>
          )}
        </div>

        {visibility.contact && (resume.phone || resume.email) && (
          <div className="resume-sidebar-section">
            <h3 className="resume-sidebar-title">Contact</h3>
            <div className="contact-list">
              {resume.phone && (
                <div className="contact-item">
                  <span className="contact-icon" aria-hidden="true">
                    <PhoneIcon />
                  </span>
                  <span className="contact-text">{resume.phone}</span>
                </div>
              )}
              {resume.email && (
                <div className="contact-item">
                  <span className="contact-icon" aria-hidden="true">
                    <MailIcon />
                  </span>
                  <span className="contact-text">{resume.email}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {visibility.references && cappedReferences.length > 0 && (
          <div className="resume-sidebar-section">
            <h3 className="resume-sidebar-title">References</h3>
            {cappedReferences.map((ref, index) => (
              <div key={index} className="reference-item">
                <p className="reference-name">{ref.name}</p>
                {ref.title && <p className="reference-title">{ref.title}</p>}
                {ref.company && <p className="reference-company">{ref.company}</p>}
                {ref.phone && <p className="reference-phone">{ref.phone}</p>}
              </div>
            ))}
          </div>
        )}

        {visibility.hobbies && cappedHobbies.length > 0 && (
          <div className="resume-sidebar-section">
            <h3 className="resume-sidebar-title">Hobbies & Interests</h3>
            <ul className="hobbies-list">
              {cappedHobbies.map((hobby, index) => (
                <li key={index}>{hobby}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="resume-main-content">
        {visibility.summary && cappedSummary && (
          <div className="resume-section">
            <h2 className="resume-section-title">About Me</h2>
            <p className="summary-text">{cappedSummary}</p>
          </div>
        )}

        {visibility.projects && cappedProjects.length > 0 && (
          <div className="resume-section">
            <h2 className="resume-section-title">Project Experience</h2>
            {cappedProjects.map((proj, index) => {
              const valueText = formatCurrency(proj.project_value);
              const hasDates = proj.start_date || proj.end_date;
              const clientLine = [proj.customer_name, proj.location].filter(Boolean).join(' • ');
              return (
                <div key={index} className="project-item">
                  {/* Row 1: title left, value right */}
                  <div className="project-header">
                    <h4 className="project-name">{proj.project_name}</h4>
                    {valueText && <p className="project-role">{valueText}</p>}
                  </div>
                  {/* Row 2: client left, dates right */}
                  {(clientLine || hasDates) && (
                    <div className="project-subheader">
                      <p className="project-client">{clientLine ? `Client: ${clientLine}` : ''}</p>
                      {hasDates && (
                        <p className="project-dates">
                          {formatDate(proj.start_date)} - {proj.end_date ? formatDate(proj.end_date) : 'Present'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {visibility.education && (resume.education || cappedCertifications.length > 0) && (
          <div className="resume-section">
            <h2 className="resume-section-title">Education & Certifications</h2>
            {resume.education && (
              <div className="education-text">{resume.education}</div>
            )}
            {cappedCertifications.length > 0 && (
              <ul className="certifications-list">
                {cappedCertifications.map((cert, index) => (
                  <li key={index}>
                    {cert.name}
                    {cert.issuer && ` - ${cert.issuer}`}
                    {cert.year && ` (${cert.year})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {visibility.skills && cappedSkills.length > 0 && (
          <div className="resume-section">
            <h2 className="resume-section-title">Skills & Specializations</h2>
            <div className="skills-grid">
              {cappedSkills.map((skill, index) => (
                <span key={index} className="skill-pill">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {visibility.languages && cappedLanguages.length > 0 && (
          <div className="resume-section">
            <h2 className="resume-section-title">Languages</h2>
            <div className="languages-grid">
              {cappedLanguages.map((lang, index) => (
                <div key={index} className="language-item">
                  <span className="language-name">{lang.language}</span>
                  <span className="language-proficiency">{lang.proficiency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PhoneIcon: React.FC = () => (
  <svg viewBox="0 0 24 24">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
  </svg>
);

const MailIcon: React.FC = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

const PinIcon: React.FC = () => (
  <svg viewBox="0 0 24 24">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default ResumePreview;
