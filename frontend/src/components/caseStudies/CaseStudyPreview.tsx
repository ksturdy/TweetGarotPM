import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CaseStudy, CaseStudyImage } from '../../services/caseStudies';
import { CaseStudyTemplate, LayoutSection } from '../../services/caseStudyTemplates';

const DEFAULT_SECTIONS: LayoutSection[] = [
  { key: 'company_info', label: 'Company Information', visible: true, order: 1, column: 'left' },
  { key: 'project_info', label: 'Project Information', visible: true, order: 2, column: 'left' },
  { key: 'executive_summary', label: 'Executive Summary', visible: true, order: 3, column: 'right' },
  { key: 'challenge', label: 'Challenge', visible: true, order: 4, column: 'right' },
  { key: 'solution', label: 'Our Solution', visible: true, order: 5, column: 'right' },
  { key: 'results', label: 'Results', visible: true, order: 6, column: 'right' },
  { key: 'metrics', label: 'Key Metrics', visible: true, order: 7 },
  { key: 'images', label: 'Project Photos', visible: true, order: 8 },
  { key: 'services_provided', label: 'Services Provided', visible: true, order: 9, column: 'right' },
];

// Fallback column for old templates that don't have column property
const DEFAULT_COLUMN: Record<string, string> = {
  company_info: 'left',
  project_info: 'left',
  executive_summary: 'left',
  services_provided: 'left',
  challenge: 'right',
  solution: 'right',
  results: 'right',
};

const getImageUrl = (filePath: string) => {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  const idx = filePath.replace(/\\/g, '/').indexOf('uploads/');
  if (idx !== -1) {
    return '/' + filePath.replace(/\\/g, '/').substring(idx);
  }
  return `/uploads/${filePath}`;
};

interface CaseStudyPreviewProps {
  caseStudy: CaseStudy & { images?: CaseStudyImage[] };
  template?: CaseStudyTemplate | null;
}

const CaseStudyPreview: React.FC<CaseStudyPreviewProps> = ({ caseStudy, template }) => {
  const { tenant } = useAuth();
  const logoUrl = tenant?.settings?.branding?.logo_url || null;
  const showLogo = template ? template.show_logo : true;
  const showImages = template ? template.show_images : true;
  const showMetrics = template ? template.show_metrics : true;

  const layoutStyle = template?.layout_config?.layout_style || 'standard';

  if (layoutStyle === 'magazine') {
    return <MagazineLayout caseStudy={caseStudy} template={template} logoUrl={logoUrl} showLogo={showLogo} showImages={showImages} showMetrics={showMetrics} />;
  }

  return <StandardLayout caseStudy={caseStudy} template={template} logoUrl={logoUrl} showLogo={showLogo} showImages={showImages} showMetrics={showMetrics} />;
};

/* ============================================================
   STANDARD LAYOUT (original sequential sections)
   ============================================================ */

interface LayoutProps {
  caseStudy: CaseStudy & { images?: CaseStudyImage[] };
  template?: CaseStudyTemplate | null;
  logoUrl: string | null;
  showLogo: boolean;
  showImages: boolean;
  showMetrics: boolean;
}

const StandardLayout: React.FC<LayoutProps> = ({ caseStudy, template, logoUrl, showLogo, showImages, showMetrics }) => {
  const layoutSections = template?.layout_config?.sections || DEFAULT_SECTIONS;
  const visibleSections = [...layoutSections]
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  // Check if this template has a separate company_info section
  const hasCompanySection = layoutSections.some(s => s.key === 'company_info');

  const formatCurrency = (value: number) => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const images = caseStudy.images || [];
  const heroImage = images.find((img: any) => img.is_hero_image);
  const otherImages = images.filter((img: any) => !img.is_hero_image).slice(0, 6);

  const sectionTitleStyle: React.CSSProperties = {
    backgroundColor: '#1e3a5f',
    color: 'white',
    padding: '6px 12px',
    fontSize: '11pt',
    fontWeight: 'bold',
    marginBottom: '10px',
    borderRadius: '2px',
  };

  const sectionRenderers: Record<string, (label: string) => React.ReactNode | null> = {
    company_info: (label) => {
      if (!caseStudy.customer_name && !caseStudy.project_name) return null;
      const fields: { label: string; value: string }[] = [];
      if (caseStudy.customer_name) fields.push({ label: 'Customer', value: caseStudy.customer_name });
      if (caseStudy.project_name) fields.push({ label: 'Project', value: caseStudy.project_name });
      if (fields.length === 0) return null;
      return (
        <div key="company_info" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
            {fields.map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{f.label}</div>
                <div style={{ fontWeight: 600, fontSize: '10pt' }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      );
    },

    project_info: (label) => {
      const fields: { label: string; value: string }[] = [];
      // Only include company/project name if there's no separate company_info section
      if (!hasCompanySection) {
        if (caseStudy.customer_name) fields.push({ label: 'Customer', value: caseStudy.customer_name });
        if (caseStudy.project_name) fields.push({ label: 'Project', value: caseStudy.project_name });
      }
      if (caseStudy.market) fields.push({ label: 'Market', value: caseStudy.market });
      if (caseStudy.project_value) fields.push({ label: 'Project Value', value: formatCurrency(caseStudy.project_value) });
      if (caseStudy.project_square_footage) fields.push({ label: 'Square Footage', value: Number(caseStudy.project_square_footage).toLocaleString() + ' SF' });
      if (caseStudy.project_start_date || caseStudy.project_end_date) {
        let dateStr = '';
        if (caseStudy.project_start_date) dateStr += formatDate(caseStudy.project_start_date);
        if (caseStudy.project_start_date && caseStudy.project_end_date) dateStr += ' – ';
        if (caseStudy.project_end_date) dateStr += formatDate(caseStudy.project_end_date);
        fields.push({ label: 'Project Dates', value: dateStr });
      }
      if (caseStudy.construction_type) fields.push({ label: 'Construction Type', value: caseStudy.construction_type });
      if (caseStudy.project_size) fields.push({ label: 'Project Size', value: caseStudy.project_size });
      if (fields.length === 0) return null;
      return (
        <div key="project_info" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
            {fields.map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{f.label}</div>
                <div style={{ fontWeight: 600, fontSize: '10pt' }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      );
    },

    executive_summary: (label) => {
      if (!caseStudy.executive_summary) return null;
      return (
        <div key="executive_summary" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          <div style={{ padding: '0 4px' }} dangerouslySetInnerHTML={{ __html: caseStudy.executive_summary }} />
        </div>
      );
    },

    challenge: (label) => {
      if (!caseStudy.challenge) return null;
      return (
        <div key="challenge" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          <div style={{ padding: '0 4px' }} dangerouslySetInnerHTML={{ __html: caseStudy.challenge }} />
        </div>
      );
    },

    solution: (label) => {
      if (!caseStudy.solution) return null;
      return (
        <div key="solution" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          <div style={{ padding: '0 4px' }} dangerouslySetInnerHTML={{ __html: caseStudy.solution }} />
        </div>
      );
    },

    results: (label) => {
      if (!caseStudy.results) return null;
      return (
        <div key="results" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          <div style={{ padding: '0 4px' }} dangerouslySetInnerHTML={{ __html: caseStudy.results }} />
        </div>
      );
    },

    metrics: (label) => {
      if (!showMetrics) return null;
      const metrics: { value: string; label: string; color: string }[] = [];
      if (caseStudy.cost_savings) metrics.push({ value: formatCurrency(caseStudy.cost_savings), label: 'Cost Savings', color: '#10b981' });
      if (caseStudy.timeline_improvement_days) metrics.push({ value: `${caseStudy.timeline_improvement_days} days`, label: 'Timeline Improvement', color: '#3b82f6' });
      if (caseStudy.quality_score) metrics.push({ value: `${caseStudy.quality_score}%`, label: 'Quality Score', color: '#f59e0b' });
      if (metrics.length === 0) return null;
      return (
        <div key="metrics" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: '12px' }}>
            {metrics.map((m, i) => (
              <div key={i} style={{ textAlign: 'center' as const, padding: '16px 8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ fontSize: '20pt', fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: '9pt', color: '#666', marginTop: '4px' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      );
    },

    images: (label) => {
      if (!showImages || images.length === 0) return null;
      return (
        <div key="images" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          {heroImage && (
            <div style={{ marginBottom: '10px' }}>
              <img
                src={(heroImage as any).image_url || getImageUrl((heroImage as any).file_path)}
                alt="Hero"
                style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' as const, borderRadius: '4px' }}
              />
            </div>
          )}
          {otherImages.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {otherImages.map((img: any) => (
                <img
                  key={img.id}
                  src={img.image_url || getImageUrl(img.file_path)}
                  alt={img.caption || ''}
                  style={{ width: '100%', height: '150px', objectFit: 'cover' as const, borderRadius: '4px' }}
                />
              ))}
            </div>
          )}
        </div>
      );
    },

    services_provided: (label) => {
      const services = caseStudy.services_provided;
      if (!services || services.length === 0) return null;
      return (
        <div key="services_provided" style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
          <div style={sectionTitleStyle}>{label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
            {services.map((s, i) => (
              <span key={i} style={{ display: 'inline-block', padding: '4px 12px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '20px', fontSize: '9pt', fontWeight: 500 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      );
    },
  };

  return (
    <div style={{
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#1a1a1a',
      lineHeight: 1.5,
      fontSize: '10pt',
      maxWidth: '8.5in',
      margin: '0 auto',
      padding: '0.5in',
      backgroundColor: 'white',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px',
        borderBottom: '3px solid #1e3a5f',
        paddingBottom: '15px',
      }}>
        <div>
          <div style={{ fontSize: '8pt', textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#999', marginBottom: '6px' }}>
            Case Study
          </div>
          <h1 style={{ fontSize: '20pt', fontWeight: 'bold', margin: '0 0 4px 0', color: '#1e3a5f' }}>
            {caseStudy.title}
          </h1>
          {caseStudy.subtitle && (
            <div style={{ fontSize: '11pt', color: '#666' }}>
              {caseStudy.subtitle}
            </div>
          )}
        </div>
        {showLogo && logoUrl && (
          <div style={{ textAlign: 'right', maxWidth: '160px', flexShrink: 0 }}>
            <img
              src={logoUrl}
              alt="Company Logo"
              style={{ width: '140px', height: 'auto', maxHeight: '70px', objectFit: 'contain' as const }}
            />
          </div>
        )}
      </div>

      {/* Sections */}
      {visibleSections.map(section => {
        const renderer = sectionRenderers[section.key];
        if (!renderer) return null;
        return renderer(section.label);
      })}

      {/* Footer */}
      <div style={{
        marginTop: '30px',
        paddingTop: '10px',
        borderTop: '1px solid #ddd',
        fontSize: '8pt',
        color: '#999',
        textAlign: 'center' as const,
      }}>
        Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
};

/* ============================================================
   MAGAZINE LAYOUT (hero banner + two-column one-pager)
   ============================================================ */

const MagazineLayout: React.FC<LayoutProps> = ({ caseStudy, template, logoUrl, showLogo, showImages, showMetrics }) => {
  const accentColor = (template?.color_scheme && typeof template.color_scheme === 'object'
    ? (template.color_scheme as any).primary
    : template?.color_scheme) || '#c0392b';
  const darkColor = '#1a1a2e';

  // Build ordered visible sections from template config
  const layoutSections = template?.layout_config?.sections || DEFAULT_SECTIONS;
  const visibleSections = [...layoutSections]
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  // Check if this template has a separate company_info section
  const hasCompanySection = layoutSections.some(s => s.key === 'company_info');

  // Use section.column with fallback to defaults for old templates
  const getColumn = (s: LayoutSection) => s.column || DEFAULT_COLUMN[s.key] || 'left';
  const leftSections = visibleSections.filter(s => getColumn(s) === 'left');
  const rightSections = visibleSections.filter(s => getColumn(s) === 'right');
  const showPhotos = visibleSections.some(s => s.key === 'images');

  const formatCurrency = (value: number) => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const images = caseStudy.images || [];
  const heroImage = images.find((img: any) => img.is_hero_image);
  const otherImages = images.filter((img: any) => !img.is_hero_image).slice(0, 6);
  const heroSrc = heroImage
    ? ((heroImage as any).image_url || getImageUrl((heroImage as any).file_path))
    : null;

  // Build project info items (no company/project name - those go in company_info)
  const infoItems: { label: string; value: string }[] = [];
  if (caseStudy.market) infoItems.push({ label: 'Market', value: caseStudy.market });
  if (caseStudy.construction_type) infoItems.push({ label: 'Construction Type', value: caseStudy.construction_type });
  if (caseStudy.project_size) infoItems.push({ label: 'Project Size', value: caseStudy.project_size });
  if (caseStudy.project_value) infoItems.push({ label: 'Project Value', value: formatCurrency(caseStudy.project_value) });
  if (caseStudy.project_square_footage) infoItems.push({ label: 'Square Footage', value: Number(caseStudy.project_square_footage).toLocaleString() + ' SF' });
  let dateStr = '';
  if (caseStudy.project_start_date) dateStr += formatDate(caseStudy.project_start_date);
  if (caseStudy.project_start_date && caseStudy.project_end_date) dateStr += ' – ';
  if (caseStudy.project_end_date) dateStr += formatDate(caseStudy.project_end_date);
  if (dateStr) infoItems.push({ label: 'Project Dates', value: dateStr });

  // Build metrics
  const metrics: { value: string; label: string; color: string }[] = [];
  if (showMetrics) {
    if (caseStudy.cost_savings) metrics.push({ value: formatCurrency(caseStudy.cost_savings), label: 'Cost Savings', color: '#10b981' });
    if (caseStudy.timeline_improvement_days) metrics.push({ value: `${caseStudy.timeline_improvement_days} days`, label: 'Timeline Improvement', color: '#3b82f6' });
    if (caseStudy.quality_score) metrics.push({ value: `${caseStudy.quality_score}%`, label: 'Quality Score', color: '#f59e0b' });
  }

  const services = caseStudy.services_provided || [];

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '10pt',
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    color: darkColor,
    marginBottom: '8px',
    borderBottom: `2px solid ${accentColor}`,
    paddingBottom: '4px',
    display: 'inline-block',
  };

  const rightTitleStyle: React.CSSProperties = {
    fontSize: '14pt',
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    color: darkColor,
    marginBottom: '10px',
  };

  // Unified renderers for all sections (column assignment comes from section.column)
  const allRenderers: Record<string, (label: string) => React.ReactNode | null> = {
    company_info: (label) => {
      if (!caseStudy.project_name && !caseStudy.customer_name) return null;
      return (
        <div key="company_info" style={{ marginBottom: '14px' }}>
          {caseStudy.project_name && (
            <div style={{ fontSize: '16pt', fontWeight: 800, color: darkColor, lineHeight: 1.2, marginBottom: '4px' }}>
              {caseStudy.project_name}
            </div>
          )}
          {caseStudy.customer_name && (
            <div style={{ fontSize: '10pt', color: '#666', marginBottom: '4px' }}>{caseStudy.customer_name}</div>
          )}
        </div>
      );
    },
    project_info: (label) => {
      // If no separate company_info, include project/company name here (backward compat)
      const showCompanyInProject = !hasCompanySection;
      if (infoItems.length === 0 && !showCompanyInProject) return null;
      if (infoItems.length === 0 && showCompanyInProject && !caseStudy.project_name) return null;
      return (
        <div key="project_info" style={{ marginBottom: '14px' }}>
          {showCompanyInProject && caseStudy.project_name && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '16pt', fontWeight: 800, color: darkColor, lineHeight: 1.2, marginBottom: '4px' }}>
                {caseStudy.project_name}
              </div>
              {caseStudy.customer_name && (
                <div style={{ fontSize: '10pt', color: '#666' }}>{caseStudy.customer_name}</div>
              )}
            </div>
          )}
          {infoItems.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start',
              marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee',
            }}>
              <div style={{
                width: '22px', height: '22px', backgroundColor: accentColor,
                borderRadius: '50%', flexShrink: 0, marginRight: '10px', marginTop: '2px',
              }} />
              <div>
                <div style={{ fontSize: '7pt', textTransform: 'uppercase' as const, letterSpacing: '0.8px', color: '#999', fontWeight: 600 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '10pt', fontWeight: 600, color: '#333' }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      );
    },
    services_provided: (label) => {
      if (services.length === 0) return null;
      return (
        <div key="services_provided" style={{ marginTop: '14px' }}>
          <div style={sectionHeaderStyle}>{label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
            {services.map((s, i) => (
              <span key={i} style={{
                display: 'inline-block', padding: '3px 12px',
                backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '3px',
                fontSize: '8pt', fontWeight: 600, border: '1px solid #e2e8f0',
              }}>{s}</span>
            ))}
          </div>
        </div>
      );
    },
    executive_summary: (label) => {
      if (!caseStudy.executive_summary) return null;
      return (
        <div key="executive_summary" style={{ marginBottom: '18px' }}>
          <div style={rightTitleStyle}>{label}</div>
          <div style={{ fontSize: '9pt', color: '#444', lineHeight: 1.6 }}
               dangerouslySetInnerHTML={{ __html: caseStudy.executive_summary }} />
        </div>
      );
    },
    challenge: (label) => {
      if (!caseStudy.challenge) return null;
      return (
        <div key="challenge" style={{ marginBottom: '18px' }}>
          <div style={rightTitleStyle}>{label}</div>
          <div style={{ fontSize: '9pt', color: '#444', lineHeight: 1.7 }}
               dangerouslySetInnerHTML={{ __html: caseStudy.challenge }} />
        </div>
      );
    },
    solution: (label) => {
      if (!caseStudy.solution) return null;
      return (
        <div key="solution" style={{ marginBottom: '18px' }}>
          <div style={rightTitleStyle}>{label}</div>
          <div style={{ fontSize: '9pt', color: '#444', lineHeight: 1.7 }}
               dangerouslySetInnerHTML={{ __html: caseStudy.solution }} />
        </div>
      );
    },
    results: (label) => {
      if (!caseStudy.results) return null;
      return (
        <div key="results" style={{ marginBottom: '18px' }}>
          <div style={rightTitleStyle}>{label}</div>
          <div style={{ fontSize: '9pt', color: '#444', lineHeight: 1.7 }}
               dangerouslySetInnerHTML={{ __html: caseStudy.results }} />
        </div>
      );
    },
  };

  return (
    <div style={{
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#1a1a1a',
      lineHeight: 1.5,
      fontSize: '10pt',
      maxWidth: '8.5in',
      margin: '0 auto',
      backgroundColor: 'white',
    }}>

      {/* ===== HERO BANNER ===== */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: heroSrc ? '160px' : '110px',
        backgroundColor: darkColor,
        overflow: 'hidden',
      }}>
        {heroSrc && (
          <img src={heroSrc} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover' as const,
            opacity: 0.35, position: 'absolute', top: 0, left: 0,
          }} />
        )}
        {/* Customer logo - top right */}
        {(caseStudy as any).customer_logo_resolved_url ? (
          <div style={{
            position: 'absolute', top: '14px', right: '24px', zIndex: 2,
            width: '70px', height: '70px', borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.95)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <img src={(caseStudy as any).customer_logo_resolved_url} alt="Customer Logo"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const }} />
          </div>
        ) : (
          <div style={{
            position: 'absolute', top: '14px', right: '24px', zIndex: 2,
            width: '70px', height: '70px', borderRadius: '8px',
            border: '2px dashed rgba(255,255,255,0.3)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)', fontSize: '7pt', textAlign: 'center',
          }}>
            Client<br/>Logo
          </div>
        )}
        <div style={{
          position: 'relative', zIndex: 1, padding: '20px 40px', height: '100%',
          display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end',
        }}>
          <div style={{ fontSize: '8pt', textTransform: 'uppercase' as const, letterSpacing: '3px', color: accentColor, marginBottom: '6px', fontWeight: 700 }}>
            Case Study
          </div>
          <h1 style={{ fontSize: '22pt', fontWeight: 900, margin: '0 0 4px 0', color: 'white', textTransform: 'uppercase' as const, letterSpacing: '1px', paddingRight: '100px' }}>
            {caseStudy.title}
          </h1>
          {caseStudy.subtitle && (
            <div style={{ fontSize: '10pt', color: '#ccc', fontStyle: 'italic' }}>{caseStudy.subtitle}</div>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', backgroundColor: accentColor }} />
      </div>

      {/* ===== PHOTO STRIP ===== */}
      {showImages && showPhotos && otherImages.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(otherImages.length, 3)}, 1fr)`, gap: '0px' }}>
          {otherImages.slice(0, 3).map((img: any) => (
            <img key={img.id} src={img.image_url || getImageUrl(img.file_path)} alt={img.caption || ''}
              style={{ width: '100%', height: '100px', objectFit: 'cover' as const }} />
          ))}
        </div>
      )}

      {/* ===== TWO-COLUMN BODY ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', padding: '24px 40px 20px 40px' }}>
        {/* Left column - rendered in template order */}
        <div>
          {leftSections.map(s => {
            const renderer = allRenderers[s.key];
            return renderer ? renderer(s.label) : null;
          })}
        </div>
        {/* Right column - rendered in template order */}
        <div>
          {rightSections.map(s => {
            const renderer = allRenderers[s.key];
            return renderer ? renderer(s.label) : null;
          })}
        </div>
      </div>

      {/* ===== METRICS BAR ===== */}
      {metrics.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: '0',
          backgroundColor: darkColor, margin: '0 40px 20px 40px', borderRadius: '4px', overflow: 'hidden',
        }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ textAlign: 'center' as const, padding: '14px 8px', borderRight: i < metrics.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: '18pt', fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: '8pt', color: '#aaa', marginTop: '2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ===== LOGO (always bottom-right) ===== */}
      {showLogo && logoUrl && (
        <div style={{ padding: '0 40px 12px 40px', textAlign: 'right' as const }}>
          <img src={logoUrl} alt="Company Logo"
            style={{ width: '140px', height: 'auto', maxHeight: '60px', objectFit: 'contain' as const }} />
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div style={{ padding: '8px 40px', fontSize: '7pt', color: '#bbb', textAlign: 'center' as const, borderTop: '1px solid #eee' }}>
        Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
};

export default CaseStudyPreview;
