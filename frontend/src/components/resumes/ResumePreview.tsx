import React from 'react';
import { EmployeeResume, ResumeProject } from '../../services/employeeResumes';
import '../../styles/Resume.css';

interface ResumePreviewProps {
  resume: EmployeeResume;
  projects: ResumeProject[];
  photoPreviewUrl?: string; // Optional data URL for newly uploaded photos
}

const ResumePreview: React.FC<ResumePreviewProps> = ({ resume, projects, photoPreviewUrl }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '';
    return '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const formatNumber = (value?: number) => {
    if (!value) return '';
    return Number(value).toLocaleString('en-US');
  };

  // Determine photo source: use photoPreviewUrl if available, otherwise use server path
  const photoSrc = photoPreviewUrl || (resume.employee_photo_path ? `/${resume.employee_photo_path}` : null);

  return (
    <div className="resume-container">
      {/* Left Sidebar */}
      <div className="resume-sidebar">
        {photoSrc && (
          <div className="photo-container">
            <img
              src={photoSrc}
              alt={resume.employee_name}
              className="employee-photo"
            />
          </div>
        )}

        <div className="name-title">
          <h1 className="employee-name">{resume.employee_name}</h1>
          <p className="job-title">{resume.job_title}</p>
          {resume.years_experience && (
            <p className="years-experience">{resume.years_experience} Years Experience</p>
          )}
        </div>

        {/* Contact Section */}
        {(resume.phone || resume.email || resume.address) && (
          <div className="resume-sidebar-section">
            <h3 className="resume-sidebar-title">Contact</h3>
            <div className="contact-list">
              {resume.phone && (
                <div className="contact-item">
                  <span className="contact-icon">📞</span>
                  <span>{resume.phone}</span>
                </div>
              )}
              {resume.email && (
                <div className="contact-item">
                  <span className="contact-icon">✉️</span>
                  <span>{resume.email}</span>
                </div>
              )}
              {resume.address && (
                <div className="contact-item">
                  <span className="contact-icon">📍</span>
                  <span>{resume.address}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* References Section */}
        {resume.references && resume.references.length > 0 && (
          <div className="resume-sidebar-section">
            <h3 className="resume-sidebar-title">References</h3>
            {resume.references.map((ref, index) => (
              <div key={index} className="reference-item">
                <p className="reference-name">{ref.name}</p>
                {ref.title && <p className="reference-title">{ref.title}</p>}
                {ref.company && <p className="reference-company">{ref.company}</p>}
                {ref.phone && <p className="reference-phone">{ref.phone}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Hobbies Section */}
        {resume.hobbies && resume.hobbies.length > 0 && (
          <div className="resume-sidebar-section">
            <h3 className="resume-sidebar-title">Hobbies & Interests</h3>
            <ul className="hobbies-list">
              {resume.hobbies.map((hobby, index) => (
                <li key={index}>{hobby}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="resume-main-content">
        {/* About Me Section */}
        {resume.summary && (
          <div className="resume-section">
            <h2 className="resume-section-title">About Me</h2>
            <p className="summary-text">{resume.summary}</p>
          </div>
        )}

        {/* Project Experience Section */}
        {projects && projects.length > 0 && (
          <div className="resume-section">
            <h2 className="resume-section-title">Project Experience</h2>
            {projects.map((proj, index) => {
              const details = [];
              if (proj.customer_name) details.push(`Client: ${proj.customer_name}`);
              if (proj.location) details.push(`Location: ${proj.location}`);
              if (proj.square_footage) details.push(`Size: ${formatNumber(proj.square_footage)} sq ft`);

              return (
                <div key={index} className="project-item">
                  <div className="project-header">
                    <h4 className="project-name">{proj.project_name}</h4>
                    {proj.project_value && (
                      <p className="project-role">Value: {formatCurrency(proj.project_value)}</p>
                    )}
                  </div>
                  {(proj.start_date || proj.end_date) && (
                    <p className="project-dates">
                      {formatDate(proj.start_date)} - {proj.end_date ? formatDate(proj.end_date) : 'Present'}
                    </p>
                  )}
                  {details.length > 0 && (
                    <p className="project-details">{details.join(' • ')}</p>
                  )}
                  {proj.description && (
                    <p className="project-description">{proj.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Education & Certifications Section */}
        {(resume.education || (resume.certifications && resume.certifications.length > 0)) && (
          <div className="resume-section">
            <h2 className="resume-section-title">Education & Certifications</h2>
            {resume.education && (
              <div className="education-text">{resume.education}</div>
            )}
            {resume.certifications && resume.certifications.length > 0 && (
              <ul className="certifications-list">
                {resume.certifications.map((cert, index) => (
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

        {/* Skills Section */}
        {resume.skills && resume.skills.length > 0 && (
          <div className="resume-section">
            <h2 className="resume-section-title">Skills & Specializations</h2>
            <div className="skills-grid">
              {resume.skills.map((skill, index) => (
                <span key={index} className="skill-pill">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Languages Section */}
        {resume.languages && resume.languages.length > 0 && (
          <div className="resume-section">
            <h2 className="resume-section-title">Languages</h2>
            <div className="languages-grid">
              {resume.languages.map((lang, index) => (
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

export default ResumePreview;
