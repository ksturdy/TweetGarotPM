import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sellSheetTemplatesApi,
  SellSheetTemplate,
  SellSheetLayoutSection,
} from '../../services/sellSheetTemplates';
import { useAuth } from '../../context/AuthContext';
import '../../styles/SalesPipeline.css';

const SAMPLE_SELL_SHEET = {
  service_name: 'HVAC',
  title: 'HVAC Solutions',
  subtitle: 'Comprehensive heating, ventilation, and air conditioning for commercial & industrial facilities',
  overview:
    '<p>Tweet Garot delivers complete HVAC design, fabrication, and installation. From boilers and chillers to rooftop units and air-handling systems, our self-performed teams keep your project moving and your facility comfortable.</p>',
  content:
    '<h3>What We Do</h3><ul><li>HVAC system design & engineering</li><li>Custom sheet metal fabrication</li><li>Boiler and chiller installation</li><li>Building automation & controls</li><li>Commissioning & start-up</li><li>Preventive maintenance & service</li></ul>',
  sidebar_content:
    '<h3>Service Offerings</h3><ul><li>Design / Build</li><li>Design Assist</li><li>Pre-Construction</li><li>BIM & VDC</li><li>Prefabrication</li><li>24/7 Service</li></ul>',
  page2_content:
    '<h3>Why Tweet Garot</h3><p>Over 100 years of mechanical contracting experience. SMACNA & MCAA member. Self-performing teams across HVAC, plumbing, piping, and sheet metal.</p>',
  footer_content:
    '<p><strong>Green Bay · Madison · Wausau</strong> &middot; tweetgarot.com &middot; 1-800-555-0100</p>',
};

const placeholderSvg = (label: string, w = 600, h = 300, bg = '#cbd5e1') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
      <rect width="100%" height="100%" fill="${bg}"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.round(Math.min(w, h) / 10)}" fill="#475569" text-anchor="middle" dominant-baseline="middle">${label}</text>
    </svg>`
  )}`;

const SAMPLE_HERO_IMG = placeholderSvg('Hero Image', 1200, 500, '#94a3b8');
const SAMPLE_GALLERY_IMGS = [
  placeholderSvg('Image 1', 600, 400, '#cbd5e1'),
  placeholderSvg('Image 2', 600, 400, '#94a3b8'),
  placeholderSvg('Image 3', 600, 400, '#cbd5e1'),
];

const DEFAULT_SECTIONS: SellSheetLayoutSection[] = [
  { key: 'header', label: 'Header (Title & Subtitle)', visible: true, order: 1 },
  { key: 'overview', label: 'Overview', visible: true, order: 2, column: 'left' },
  { key: 'hero_image', label: 'Hero Image', visible: true, order: 3, column: 'left' },
  { key: 'content', label: 'Main Content', visible: true, order: 4, column: 'left' },
  { key: 'image_gallery', label: 'Image Gallery', visible: true, order: 5, column: 'left' },
  { key: 'sidebar', label: 'Sidebar (Service Offerings)', visible: true, order: 6, column: 'right' },
  { key: 'page2', label: 'Page 2 Content', visible: false, order: 7 },
  { key: 'footer', label: 'Footer (Locations / Contact)', visible: true, order: 8 },
];

const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;
const PAGE_LABEL = 'Letter (8.5" × 11") • Portrait';

const COLOR_SCHEMES: Record<string, { primary: string; accent: string; text: string }> = {
  default: { primary: '#1e3a5f', accent: '#1e3a5f', text: '#1a1a1a' },
  branded: { primary: '#dc2626', accent: '#f59e0b', text: '#1a1a1a' },
  minimal: { primary: '#111827', accent: '#6b7280', text: '#1f2937' },
};

const SellSheetTemplateForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    color_scheme: 'default',
    show_logo: true,
    show_hero_image: true,
    show_images: true,
    show_footer: true,
    is_default: false,
    is_active: true,
  });

  const [sections, setSections] = useState<SellSheetLayoutSection[]>([...DEFAULT_SECTIONS]);
  const [layoutStyle, setLayoutStyle] = useState<'full_width' | 'two_column'>('full_width');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existingTemplate } = useQuery({
    queryKey: ['sellSheetTemplate', id],
    queryFn: () => sellSheetTemplatesApi.getById(parseInt(id!)).then(res => res.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingTemplate) {
      setFormData({
        name: existingTemplate.name || '',
        description: existingTemplate.description || '',
        category: existingTemplate.category || '',
        color_scheme: existingTemplate.color_scheme || 'default',
        show_logo: existingTemplate.show_logo ?? true,
        show_hero_image: existingTemplate.show_hero_image ?? true,
        show_images: existingTemplate.show_images ?? true,
        show_footer: existingTemplate.show_footer ?? true,
        is_default: existingTemplate.is_default ?? false,
        is_active: existingTemplate.is_active ?? true,
      });
      if (existingTemplate.layout_config?.sections) {
        setSections(existingTemplate.layout_config.sections);
      }
      if (existingTemplate.layout_config?.layout_style) {
        setLayoutStyle(existingTemplate.layout_config.layout_style);
      }
    }
  }, [existingTemplate]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<SellSheetTemplate>) => sellSheetTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheetTemplates'] });
      navigate('/sell-sheet-templates');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SellSheetTemplate>) =>
      sellSheetTemplatesApi.update(parseInt(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheetTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['sellSheetTemplate', id] });
      navigate('/sell-sheet-templates');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSectionToggle = (index: number) => {
    setSections(prev => prev.map((s, i) =>
      i === index ? { ...s, visible: !s.visible } : s
    ));
  };

  const handleSectionLabelChange = (index: number, label: string) => {
    setSections(prev => prev.map((s, i) =>
      i === index ? { ...s, label } : s
    ));
  };

  const handleSectionColumnToggle = (index: number) => {
    setSections(prev => prev.map((s, i) =>
      i === index ? { ...s, column: s.column === 'left' ? 'right' : 'left' } : s
    ));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newSections.length) return;

    const tempOrder = newSections[index].order;
    newSections[index].order = newSections[swapIndex].order;
    newSections[swapIndex].order = tempOrder;

    [newSections[index], newSections[swapIndex]] = [newSections[swapIndex], newSections[index]];
    setSections(newSections);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const submitData: Partial<SellSheetTemplate> = {
      ...formData,
      layout_config: {
        layout_style: layoutStyle,
        sections,
        page_size: 'letter',
        orientation: 'portrait',
      },
    };

    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Sections that support column assignment in two_column layout
  const columnSectionKeys = new Set(['overview', 'hero_image', 'content', 'image_gallery', 'sidebar']);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setZoomScale(w >= PAGE_WIDTH_PX ? 1 : w / PAGE_WIDTH_PX);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const logoUrl = (tenant as any)?.settings?.branding?.logo_url || '';

  return (
    <div style={{ maxWidth: '1700px', margin: '0 auto', padding: '0 1rem' }}>
      <style>{`
        @media (max-width: 1200px) {
          .ss-template-editor-grid { grid-template-columns: 1fr !important; }
          .ss-template-preview-pane { position: static !important; max-height: none !important; }
        }
      `}</style>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/sell-sheet-templates" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Service Offering Templates
            </Link>
            <h1>📰 {isEditing ? 'Edit Template' : 'Create Service Offering Template'}</h1>
            <div className="sales-subtitle">{isEditing ? 'Update template layout and settings' : 'Design a reusable service offering layout'}</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/sell-sheet-templates')}
          >
            Cancel
          </button>
        </div>
      </div>

      <div
        className="ss-template-editor-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Basic Information</h3>
              <span style={{
                fontSize: '0.75rem',
                color: '#475569',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontWeight: 500,
              }}>
                Page Size: {PAGE_LABEL}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Template Name *</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Standard Service Offering, One-Page Overview"
                />
                {errors.name && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  name="category"
                  className="form-input"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="">Select Category</option>
                  <option value="Detailed">Detailed</option>
                  <option value="Summary">Summary</option>
                  <option value="Technical">Technical</option>
                  <option value="Service Line">Service Line</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Color Scheme</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    name="color_scheme"
                    className="form-input"
                    value={formData.color_scheme}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                  >
                    <option value="default">Default (Navy)</option>
                    <option value="branded">Branded (Red / Amber)</option>
                    <option value="minimal">Minimal (Black / Gray)</option>
                  </select>
                  <span
                    title="Primary color"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      border: '1px solid #d1d5db',
                      backgroundColor: (COLOR_SCHEMES[formData.color_scheme] || COLOR_SCHEMES.default).primary,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    title="Accent color"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      border: '1px solid #d1d5db',
                      backgroundColor: (COLOR_SCHEMES[formData.color_scheme] || COLOR_SCHEMES.default).accent,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description</label>
                <textarea
                  name="description"
                  className="form-input"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Brief description of when to use this template"
                />
              </div>
            </div>
          </div>

          {/* Layout Style */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Layout Style</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div
                onClick={() => setLayoutStyle('full_width')}
                style={{
                  padding: '1rem',
                  border: `2px solid ${layoutStyle === 'full_width' ? 'var(--primary)' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: layoutStyle === 'full_width' ? '#f0f9ff' : 'white',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Full Width</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                  Sequential sections stacked top to bottom. Best for detailed multi-page service descriptions.
                </div>
              </div>
              <div
                onClick={() => setLayoutStyle('two_column')}
                style={{
                  padding: '1rem',
                  border: `2px solid ${layoutStyle === 'two_column' ? 'var(--primary)' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: layoutStyle === 'two_column' ? '#f0f9ff' : 'white',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Two Column</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                  Hero banner with main content on the left and a service offerings sidebar on the right. Best for one-page sell sheets.
                </div>
              </div>
            </div>
          </div>

          {/* Layout Sections */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Layout Sections</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Toggle sections on/off and reorder them to control the sell sheet layout.
              {layoutStyle === 'two_column' && ' Use the L/R toggle to assign sections to the left or right column.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sections.map((section, index) => (
                <div
                  key={section.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: section.visible ? '#f0fdf4' : '#fafafa',
                    border: `1px solid ${section.visible ? '#86efac' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: section.visible ? '#22c55e' : '#d1d5db',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {index + 1}
                  </span>

                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={section.visible}
                      onChange={() => handleSectionToggle(index)}
                      style={{ marginRight: '0.5rem' }}
                    />
                  </label>

                  <input
                    type="text"
                    value={section.label}
                    onChange={(e) => handleSectionLabelChange(index, e.target.value)}
                    className="form-input"
                    style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.875rem' }}
                  />

                  <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', flexShrink: 0, width: '110px' }}>
                    {section.key}
                  </span>

                  {layoutStyle === 'two_column' && columnSectionKeys.has(section.key) && (
                    <button
                      type="button"
                      onClick={() => handleSectionColumnToggle(index)}
                      style={{
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer',
                        flexShrink: 0,
                        minWidth: '28px',
                        textAlign: 'center',
                        backgroundColor: section.column === 'left' ? '#dbeafe' : '#fef3c7',
                        color: section.column === 'left' ? '#1d4ed8' : '#92400e',
                      }}
                      title={`Column: ${section.column || 'left'}. Click to toggle.`}
                    >
                      {(section.column || 'left') === 'left' ? 'L' : 'R'}
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => moveSection(index, 'up')}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => moveSection(index, 'down')}
                      disabled={index === sections.length - 1}
                    >
                      Down
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Display Options</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" name="show_logo" checked={formData.show_logo} onChange={handleChange} />
                Show Company Logo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" name="show_hero_image" checked={formData.show_hero_image} onChange={handleChange} />
                Show Hero Image
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" name="show_images" checked={formData.show_images} onChange={handleChange} />
                Show Image Gallery
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" name="show_footer" checked={formData.show_footer} onChange={handleChange} />
                Show Footer
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" name="is_default" checked={formData.is_default} onChange={handleChange} />
                Set as Default Template
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
                Active
              </label>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/sell-sheet-templates')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>

        <aside
          className="ss-template-preview-pane"
          style={{
            position: 'sticky',
            top: '1rem',
            maxHeight: 'calc(100vh - 2rem)',
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6',
            padding: '0.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
              padding: '0 0.25rem',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Live Preview
            </span>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>
              {PAGE_LABEL}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
              {layoutStyle === 'two_column' ? 'Two Column' : 'Full Width'} · {sections.filter(s => s.visible).length}/{sections.length} sections
            </span>
          </div>
          <div ref={previewContainerRef} style={{ width: '100%' }}>
            <div
              style={{
                width: `${PAGE_WIDTH_PX}px`,
                minHeight: `${PAGE_HEIGHT_PX}px`,
                zoom: zoomScale,
                backgroundColor: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid #d1d5db',
              } as React.CSSProperties}
            >
              <TemplatePreview
                layoutStyle={layoutStyle}
                sections={sections}
                colorScheme={formData.color_scheme}
                showLogo={formData.show_logo}
                showHeroImage={formData.show_hero_image}
                showImages={formData.show_images}
                showFooter={formData.show_footer}
                logoUrl={logoUrl}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

interface TemplatePreviewProps {
  layoutStyle: 'full_width' | 'two_column';
  sections: SellSheetLayoutSection[];
  colorScheme: string;
  showLogo: boolean;
  showHeroImage: boolean;
  showImages: boolean;
  showFooter: boolean;
  logoUrl: string;
}

const sectionLabelBadge = (label: string): React.CSSProperties => ({
  display: 'inline-block',
  fontSize: '7pt',
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: '#6366f1',
  backgroundColor: '#eef2ff',
  border: '1px dashed #c7d2fe',
  borderRadius: 4,
  padding: '1px 6px',
  marginBottom: 6,
});

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  layoutStyle,
  sections,
  colorScheme,
  showLogo,
  showHeroImage,
  showImages,
  showFooter,
  logoUrl,
}) => {
  const scheme = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.default;
  const PRIMARY = scheme.primary;
  const TEXT = scheme.text;

  const visibleSections = sections
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  const findSection = (key: string) => visibleSections.find(s => s.key === key);

  const headerSection = findSection('header');
  const footerSection = findSection('footer');

  const sampleHeader = headerSection ? (
    <div style={{ marginBottom: 20, borderBottom: `3px solid ${PRIMARY}`, paddingBottom: 15 }}>
      <div style={sectionLabelBadge(headerSection.label)}>{headerSection.label}</div>
      <h1 style={{ fontSize: '22pt', fontWeight: 'bold', margin: '0 0 4px 0', color: PRIMARY }}>
        {SAMPLE_SELL_SHEET.title}
      </h1>
      <div style={{ fontSize: '11pt', color: '#666' }}>{SAMPLE_SELL_SHEET.subtitle}</div>
    </div>
  ) : null;

  const renderSection = (section: SellSheetLayoutSection) => {
    const labelEl = <div style={sectionLabelBadge(section.label)}>{section.label}</div>;
    switch (section.key) {
      case 'overview':
        return (
          <div style={{ marginBottom: 16 }}>
            {labelEl}
            <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: SAMPLE_SELL_SHEET.overview }} />
          </div>
        );
      case 'hero_image':
        if (!showHeroImage) return null;
        return (
          <div style={{ marginBottom: 16 }}>
            {labelEl}
            <img
              src={SAMPLE_HERO_IMG}
              alt=""
              style={{ width: '100%', maxHeight: 250, objectFit: 'cover', borderRadius: 4, display: 'block' }}
            />
          </div>
        );
      case 'content':
        return (
          <div style={{ marginBottom: 16 }}>
            {labelEl}
            <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: SAMPLE_SELL_SHEET.content }} />
          </div>
        );
      case 'image_gallery':
        if (!showImages) return null;
        return (
          <div style={{ marginBottom: 16 }}>
            {labelEl}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(SAMPLE_GALLERY_IMGS.length, 3)}, 1fr)`, gap: 8 }}>
              {SAMPLE_GALLERY_IMGS.slice(0, 3).map((src, i) => (
                <img key={i} src={src} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
              ))}
            </div>
          </div>
        );
      case 'sidebar':
        return (
          <div style={{ marginBottom: 16 }}>
            {labelEl}
            <h2 style={{ fontSize: '14pt', fontWeight: 700, color: PRIMARY, borderBottom: '2px solid #e5e7eb', paddingBottom: 6, margin: '0 0 10px 0' }}>
              Service Offerings
            </h2>
            <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: SAMPLE_SELL_SHEET.sidebar_content }} />
          </div>
        );
      case 'page2':
        return (
          <div style={{ marginBottom: 16, borderTop: '2px solid #e5e7eb', paddingTop: 16 }}>
            {labelEl}
            <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: SAMPLE_SELL_SHEET.page2_content }} />
          </div>
        );
      default:
        return null;
    }
  };

  const footer = (showFooter && footerSection) ? (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb', fontSize: '9pt', color: '#666' }}>
      <div style={sectionLabelBadge(footerSection.label)}>{footerSection.label}</div>
      <div dangerouslySetInnerHTML={{ __html: SAMPLE_SELL_SHEET.footer_content }} />
    </div>
  ) : null;

  const logoBlock = (showLogo && logoUrl) ? (
    <div style={{ position: 'absolute', bottom: 16, right: 40 }}>
      <img src={logoUrl} alt="Company Logo" style={{ width: 140, height: 'auto', maxHeight: 60, objectFit: 'contain' }} />
    </div>
  ) : null;

  if (layoutStyle === 'two_column') {
    const leftSections = visibleSections.filter(s =>
      s.key !== 'header' && s.key !== 'footer' && s.key !== 'page2' && (s.column || 'left') === 'left'
    );
    const rightSections = visibleSections.filter(s =>
      s.key !== 'header' && s.key !== 'footer' && s.key !== 'page2' && (s.column || 'left') === 'right'
    );
    const page2Section = visibleSections.find(s => s.key === 'page2');

    return (
      <div style={{
        padding: '0.5in',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10pt',
        lineHeight: 1.6,
        color: TEXT,
        position: 'relative',
        minHeight: '11in',
        backgroundColor: 'white',
      }}>
        {sampleHeader}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>{leftSections.map(s => <React.Fragment key={s.key}>{renderSection(s)}</React.Fragment>)}</div>
          <div>{rightSections.map(s => <React.Fragment key={s.key}>{renderSection(s)}</React.Fragment>)}</div>
        </div>
        {page2Section && renderSection(page2Section)}
        {footer}
        {logoBlock}
      </div>
    );
  }

  // Full width
  const bodySections = visibleSections.filter(s => s.key !== 'header' && s.key !== 'footer');
  return (
    <div style={{
      padding: '0.5in',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '10pt',
      lineHeight: 1.6,
      color: '#1a1a1a',
      position: 'relative',
      minHeight: '11in',
      backgroundColor: 'white',
    }}>
      {sampleHeader}
      {bodySections.map(s => <React.Fragment key={s.key}>{renderSection(s)}</React.Fragment>)}
      {footer}
      {logoBlock}
    </div>
  );
};

export default SellSheetTemplateForm;
