import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CaseStudy, CaseStudyImage } from '../../services/caseStudies';
import { CaseStudyTemplate, LayoutSection } from '../../services/caseStudyTemplates';

const DEFAULT_SECTIONS: LayoutSection[] = [
  { key: 'project_info', label: 'Project Information', visible: true, order: 1 },
  { key: 'executive_summary', label: 'Executive Summary', visible: true, order: 2 },
  { key: 'challenge', label: 'Challenge', visible: true, order: 3 },
  { key: 'solution', label: 'Our Solution', visible: true, order: 4 },
  { key: 'results', label: 'Results', visible: true, order: 5 },
  { key: 'metrics', label: 'Key Metrics', visible: true, order: 6 },
  { key: 'images', label: 'Project Photos', visible: true, order: 7 },
  { key: 'services_provided', label: 'Services Provided', visible: true, order: 8 },
];

const getImageUrl = (filePath: string) => {
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

  const layoutSections = template?.layout_config?.sections || DEFAULT_SECTIONS;
  const visibleSections = [...layoutSections]
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  const showImages = template ? template.show_images : true;
  const showMetrics = template ? template.show_metrics : true;

  const formatCurrency = (value: number) => '$' + Number(value).toLocaleString();
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const images = caseStudy.images || [];
  const heroImage = images.find((img: any) => img.is_hero_image);
  const otherImages = images.filter((img: any) => !img.is_hero_image).slice(0, 6);

  const sectionRenderers: Record<string, (label: string) => React.ReactNode | null> = {
    project_info: (label) => {
      const fields: { label: string; value: string }[] = [];
      if (caseStudy.customer_name) fields.push({ label: 'Customer', value: caseStudy.customer_name });
      if (caseStudy.project_name) fields.push({ label: 'Project', value: caseStudy.project_name });
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
                src={getImageUrl((heroImage as any).file_path)}
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
                  src={getImageUrl(img.file_path)}
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

  const sectionTitleStyle: React.CSSProperties = {
    backgroundColor: '#1e3a5f',
    color: 'white',
    padding: '6px 12px',
    fontSize: '11pt',
    fontWeight: 'bold',
    marginBottom: '10px',
    borderRadius: '2px',
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

export default CaseStudyPreview;
