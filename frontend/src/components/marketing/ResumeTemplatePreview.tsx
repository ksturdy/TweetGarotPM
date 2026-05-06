import React from 'react';
import {
  ResumeTemplate,
  ResumeTemplateSectionLimits,
  ResumeTemplateLayoutConfig,
  ResumeTemplateSectionVisibility,
} from '../../services/resumeTemplates';

const DEFAULT_LIMITS: Required<ResumeTemplateSectionLimits> = {
  summary_chars: 600,
  projects: 5,
  certifications: 6,
  skills: 12,
  languages: 4,
  hobbies: 6,
  references: 3,
};

const DEFAULT_VISIBILITY: Required<ResumeTemplateSectionVisibility> = {
  contact: true,
  references: true,
  hobbies: true,
  summary: true,
  projects: true,
  education: true,
  skills: true,
  languages: true,
};

const DEFAULT_LAYOUT: Required<Omit<ResumeTemplateLayoutConfig, 'sections'>> & {
  sections: Required<ResumeTemplateSectionVisibility>;
} = {
  show_photo: true,
  show_years_experience: true,
  sidebar_color: '#1e3a5f',
  sections: { ...DEFAULT_VISIBILITY },
};

const SAMPLE = {
  employee_name: 'Jordan Mitchell',
  job_title: 'Senior Project Manager',
  years_experience: 12,
  summary:
    'Mechanical project manager with 12 years delivering complex healthcare, industrial, and educational projects. Skilled at coordinating multi-trade teams, prefab-first installation, and keeping schedules on track when scope shifts. Owner of three regional safety awards and a record of zero lost-time incidents across 1.4M field hours.',
  phone: '(920) 555-0142',
  email: 'jmitchell@tweetgarot.com',
  address: 'De Pere, WI',
  education: 'B.S. Construction Management — University of Wisconsin-Stout, 2012',
  certifications: [
    { name: 'PMP', issuer: 'PMI', year: 2018 },
    { name: 'OSHA 30', issuer: 'OSHA', year: 2020 },
    { name: 'LEED Green Associate', issuer: 'USGBC', year: 2019 },
    { name: 'Medical Gas Installer', issuer: 'ASSE 6010', year: 2021 },
    { name: 'NFPA 99 Healthcare', issuer: 'NFPA', year: 2022 },
    { name: 'First Aid / CPR', issuer: 'Red Cross', year: 2024 },
  ],
  skills: [
    'Project Planning',
    'Cost Control',
    'BIM Coordination',
    'Prefab Strategy',
    'RFI Management',
    'Submittal Review',
    'Owner Relations',
    'Scheduling (P6)',
    'Mechanical Design',
    'Code Compliance',
    'Crew Mentoring',
    'Risk Mitigation',
  ],
  languages: [
    { language: 'English', proficiency: 'Native' },
    { language: 'Spanish', proficiency: 'Conversational' },
    { language: 'German', proficiency: 'Basic' },
    { language: 'French', proficiency: 'Basic' },
  ],
  hobbies: ['Trail running', 'Woodworking', 'Fly fishing', 'Cycling', 'Cooking', 'Volunteer mentoring'],
  references: [
    { name: 'Sarah Lindgren', title: 'Director of Facilities', company: 'Riverside Health Systems', phone: '(920) 555-0188' },
    { name: 'Michael Park', title: 'VP Construction', company: 'Bellweather Industrial', phone: '(414) 555-0173' },
    { name: 'Diane Werner', title: 'Senior PM', company: 'Northwoods General Contractors', phone: '(715) 555-0119' },
  ],
};

const SAMPLE_PROJECTS = [
  {
    project_name: 'Riverview Medical Center Expansion',
    customer_name: 'Riverside Health Systems',
    location: 'Green Bay, WI',
    square_footage: 85000,
    project_value: 12500000,
    start_date: '2024-03-15',
    end_date: '2025-08-30',
    description:
      'Led mechanical scope for an 85,000 sq ft hospital expansion. Delivered 30 days ahead of schedule and $400K under budget through prefab and tight trade coordination.',
  },
  {
    project_name: 'Bellweather Industrial Process Plant',
    customer_name: 'Bellweather Industrial',
    location: 'Manitowoc, WI',
    square_footage: 140000,
    project_value: 9800000,
    start_date: '2023-01-08',
    end_date: '2024-02-22',
    description:
      'Process piping and HVAC for greenfield manufacturing plant. Coordinated with 6 contractors and met aggressive owner-required commissioning dates.',
  },
  {
    project_name: 'Northbridge K-12 Campus Mechanical Upgrade',
    customer_name: 'Northbridge School District',
    location: 'Appleton, WI',
    square_footage: 220000,
    project_value: 6400000,
    start_date: '2022-05-02',
    end_date: '2022-08-19',
    description:
      'Summer-window mechanical retrofit across four buildings. Phased crew loading kept all schools open for fall start.',
  },
  {
    project_name: 'Lakefront Office Tower Renovation',
    customer_name: 'Anchor Properties',
    location: 'Milwaukee, WI',
    square_footage: 95000,
    project_value: 4200000,
    start_date: '2021-09-15',
    end_date: '2022-04-30',
    description:
      'Tenant fit-out and mechanical modernization for a 12-story office tower. Maintained occupancy in floors below active work.',
  },
  {
    project_name: 'Cedar Crest Senior Living',
    customer_name: 'Cedar Crest Communities',
    location: 'Sheboygan, WI',
    square_footage: 60000,
    project_value: 3100000,
    start_date: '2020-11-01',
    end_date: '2021-07-12',
    description:
      'New construction mechanical scope for memory-care facility. Special focus on quiet operation and resident safety.',
  },
];

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function formatCurrency(v?: number) {
  if (v == null) return '';
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatNumber(v?: number) {
  if (v == null) return '';
  return v.toLocaleString('en-US');
}

function truncateText(text: string, maxChars: number) {
  if (!text || maxChars <= 0 || text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  const cut = lastBreak > maxChars * 0.6 ? lastBreak + 1 : slice.lastIndexOf(' ');
  return (cut > 0 ? slice.slice(0, cut) : slice).trim() + '…';
}

interface Props {
  template: ResumeTemplate;
}

const ResumeTemplatePreview: React.FC<Props> = ({ template }) => {
  const limits: Required<ResumeTemplateSectionLimits> = {
    ...DEFAULT_LIMITS,
    ...(template.section_limits || {}),
  };
  const layoutCfg = template.layout_config || {};
  const layout = {
    show_photo: layoutCfg.show_photo ?? DEFAULT_LAYOUT.show_photo,
    show_years_experience: layoutCfg.show_years_experience ?? DEFAULT_LAYOUT.show_years_experience,
    sidebar_color: layoutCfg.sidebar_color || DEFAULT_LAYOUT.sidebar_color,
    sections: { ...DEFAULT_VISIBILITY, ...(layoutCfg.sections || {}) },
  };
  const sidebarColor = layout.sidebar_color;

  const summary = truncateText(SAMPLE.summary, limits.summary_chars);
  const projects = SAMPLE_PROJECTS.slice(0, Math.max(0, limits.projects));
  const certifications = SAMPLE.certifications.slice(0, Math.max(0, limits.certifications));
  const skills = SAMPLE.skills.slice(0, Math.max(0, limits.skills));
  const languages = SAMPLE.languages.slice(0, Math.max(0, limits.languages));
  const hobbies = SAMPLE.hobbies.slice(0, Math.max(0, limits.hobbies));
  const references = SAMPLE.references.slice(0, Math.max(0, limits.references));

  return (
    <div
      style={{
        width: '7.5in',
        height: '10in',
        margin: '0.5in auto',
        display: 'grid',
        gridTemplateColumns: '30% 70%',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10pt',
        lineHeight: 1.5,
        color: '#1a1a1a',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Sidebar */}
      <div style={{ backgroundColor: sidebarColor, color: 'white', padding: '2rem 1.5rem', boxSizing: 'border-box', overflow: 'hidden' }}>
        {layout.show_photo && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: '50%',
                border: '4px solid white',
                backgroundColor: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36pt',
                fontWeight: 700,
                color: sidebarColor,
              }}
            >
              {SAMPLE.employee_name.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '2px solid rgba(255,255,255,0.3)' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: 1 }}>
            {SAMPLE.employee_name}
          </h1>
          <p style={{ fontSize: '11pt', color: '#e0e0e0', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 0.25rem' }}>
            {SAMPLE.job_title}
          </p>
          {layout.show_years_experience && (
            <p style={{ fontSize: '9pt', color: '#b0b0b0', margin: 0 }}>{SAMPLE.years_experience} Years Experience</p>
          )}
        </div>

        {layout.sections.contact && (
          <SidebarSection title="Contact">
            <ContactItem icon="📞" text={SAMPLE.phone} />
            <ContactItem icon="✉️" text={SAMPLE.email} />
            <ContactItem icon="📍" text={SAMPLE.address} />
          </SidebarSection>
        )}

        {layout.sections.references && references.length > 0 && (
          <SidebarSection title="References">
            {references.map((ref, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: idx === references.length - 1 ? 0 : '1rem',
                  paddingBottom: idx === references.length - 1 ? 0 : '1rem',
                  borderBottom: idx === references.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <p style={{ fontWeight: 'bold', fontSize: '10pt', margin: '0 0 0.25rem' }}>{ref.name}</p>
                {ref.title && <p style={{ fontSize: '9pt', color: '#e0e0e0', margin: '0 0 0.1rem' }}>{ref.title}</p>}
                {ref.company && <p style={{ fontSize: '9pt', color: '#e0e0e0', margin: '0 0 0.1rem' }}>{ref.company}</p>}
                {ref.phone && <p style={{ fontSize: '9pt', color: '#e0e0e0', margin: 0 }}>{ref.phone}</p>}
              </div>
            ))}
          </SidebarSection>
        )}

        {layout.sections.hobbies && hobbies.length > 0 && (
          <SidebarSection title="Hobbies & Interests">
            <ul style={{ listStyle: 'none', fontSize: '9pt', padding: 0, margin: 0 }}>
              {hobbies.map((h, i) => (
                <li key={i} style={{ paddingLeft: '1rem', marginBottom: '0.5rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: '#10b981' }}>•</span>
                  {h}
                </li>
              ))}
            </ul>
          </SidebarSection>
        )}
      </div>

      {/* Main content */}
      <div style={{ backgroundColor: 'white', padding: '2rem', boxSizing: 'border-box', overflow: 'hidden' }}>
        {layout.sections.summary && summary && (
          <MainSection title="About Me" accent={sidebarColor}>
            <p style={{ fontSize: '10pt', lineHeight: 1.6, textAlign: 'justify', margin: 0 }}>{summary}</p>
          </MainSection>
        )}

        {layout.sections.projects && projects.length > 0 && (
          <MainSection title="Project Experience" accent={sidebarColor}>
            {projects.map((proj, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: idx === projects.length - 1 ? 0 : '0.6rem',
                  paddingBottom: idx === projects.length - 1 ? 0 : '0.6rem',
                  borderBottom: idx === projects.length - 1 ? 'none' : '1px solid #e0e0e0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.1rem' }}>
                  <h4 style={{ fontSize: '10.5pt', fontWeight: 'bold', color: sidebarColor, margin: 0, flex: 1, minWidth: 0 }}>
                    {proj.project_name}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {proj.project_value && (
                      <p style={{ fontSize: '10pt', color: sidebarColor, fontWeight: 700, margin: 0 }}>
                        {formatCurrency(proj.project_value)}
                      </p>
                    )}
                    <p style={{ fontSize: '8.5pt', color: '#666', fontStyle: 'italic', margin: 0, textAlign: 'right' }}>
                      {formatDate(proj.start_date)} - {formatDate(proj.end_date)}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: '8.5pt', color: '#555', margin: '0 0 0.15rem' }}>
                  <strong>Client:</strong> {proj.customer_name} • {proj.location} • {formatNumber(proj.square_footage)} sq ft
                </p>
                <p style={{ fontSize: '9pt', lineHeight: 1.4, margin: 0 }}>{proj.description}</p>
              </div>
            ))}
          </MainSection>
        )}

        {layout.sections.education && (SAMPLE.education || certifications.length > 0) && (
          <MainSection title="Education & Certifications" accent={sidebarColor}>
            {SAMPLE.education && (
              <div style={{ fontSize: '10pt', lineHeight: 1.6, marginBottom: '1rem', whiteSpace: 'pre-line' }}>{SAMPLE.education}</div>
            )}
            {certifications.length > 0 && (
              <ul style={{ listStyle: 'none', fontSize: '10pt', padding: 0, margin: 0 }}>
                {certifications.map((c, i) => (
                  <li key={i} style={{ paddingLeft: '1.5rem', marginBottom: '0.5rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#10b981', fontWeight: 'bold' }}>✓</span>
                    {c.name}
                    {c.issuer ? ` - ${c.issuer}` : ''}
                    {c.year ? ` (${c.year})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </MainSection>
        )}

        {layout.sections.skills && skills.length > 0 && (
          <MainSection title="Skills & Specializations" accent={sidebarColor}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {skills.map((s, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#f0f0f0',
                    color: sidebarColor,
                    borderRadius: 20,
                    fontSize: '9pt',
                    fontWeight: 600,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </MainSection>
        )}

        {layout.sections.languages && languages.length > 0 && (
          <MainSection title="Languages" accent={sidebarColor}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {languages.map((l, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    backgroundColor: '#f8f8f8',
                    borderRadius: 4,
                  }}
                >
                  <span style={{ fontSize: '10pt', fontWeight: 'bold', color: sidebarColor }}>{l.language}</span>
                  <span style={{ fontSize: '9pt', color: '#666' }}>{l.proficiency}</span>
                </div>
              ))}
            </div>
          </MainSection>
        )}
      </div>
    </div>
  );
};

const SidebarSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <h3
      style={{
        fontSize: '11pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        margin: '0 0 0.75rem',
        paddingBottom: '0.5rem',
        borderBottom: '2px solid rgba(255,255,255,0.3)',
      }}
    >
      {title}
    </h3>
    {children}
  </div>
);

const ContactItem: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.75rem', fontSize: '9pt', lineHeight: 1.4 }}>
    <span style={{ marginRight: '0.5rem', flexShrink: 0 }}>{icon}</span>
    <span>{text}</span>
  </div>
);

const MainSection: React.FC<{ title: string; accent: string; children: React.ReactNode }> = ({ title, accent, children }) => (
  <div style={{ marginBottom: '1.1rem' }}>
    <h2
      style={{
        fontSize: '12pt',
        fontWeight: 'bold',
        color: accent,
        textTransform: 'uppercase',
        letterSpacing: 1,
        margin: '0 0 0.5rem',
        paddingBottom: '0.3rem',
        borderBottom: `3px solid ${accent}`,
      }}
    >
      {title}
    </h2>
    {children}
  </div>
);

export default ResumeTemplatePreview;
