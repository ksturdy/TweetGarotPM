import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caseStudyTemplatesApi, CaseStudyTemplate, LayoutSection } from '../../services/caseStudyTemplates';
import { CaseStudy } from '../../services/caseStudies';
import CaseStudyPreview from '../../components/caseStudies/CaseStudyPreview';
import '../../styles/SalesPipeline.css';

const SAMPLE_CASE_STUDY: CaseStudy = {
  id: 0,
  tenant_id: 0,
  title: 'Riverview Medical Center Expansion',
  subtitle: 'Delivering complex mechanical systems on an active hospital campus',
  project_name: 'Riverview Medical Center',
  customer_name: 'Riverside Health Systems',
  market: 'Healthcare',
  construction_type: ['New Construction'],
  project_size: 'Large',
  project_value: 12500000,
  project_square_footage: 85000,
  project_start_date: '2024-03-15',
  project_end_date: '2025-08-30',
  executive_summary:
    '<p>Tweet Garot delivered a complete mechanical system installation for this 85,000 sq ft medical center, finishing 30 days ahead of schedule and $400K under budget.</p>',
  challenge:
    '<p>The project required tight coordination across multiple trades on an active hospital campus. Existing infrastructure constraints and a compressed schedule demanded innovative solutions.</p>',
  solution:
    '<p>We deployed a prefabrication-first approach, fabricating 70% of piping assemblies offsite. Daily coordination meetings with the GC and electrical contractor kept all trades aligned.</p>',
  results:
    '<p>Project delivered ahead of schedule with zero rework. Owner expressed strong satisfaction and has invited Tweet Garot to bid on two additional facilities.</p>',
  cost_savings: 400000,
  timeline_improvement_days: 30,
  quality_score: 98,
  services_provided: ['Plumbing', 'HVAC', 'Piping', 'Service'],
  status: 'published',
  featured: false,
  created_by: 0,
  created_at: '',
  updated_at: '',
};

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

const CaseStudyTemplateForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    color_scheme: 'default',
    show_logo: true,
    show_images: true,
    show_metrics: true,
    is_default: false,
    is_active: true,
  });

  const [sections, setSections] = useState<LayoutSection[]>([...DEFAULT_SECTIONS]);
  const [layoutStyle, setLayoutStyle] = useState<'standard' | 'magazine'>('standard');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch existing template for edit mode
  const { data: existingTemplate } = useQuery({
    queryKey: ['caseStudyTemplate', id],
    queryFn: () => caseStudyTemplatesApi.getById(parseInt(id!)).then(res => res.data),
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
        show_images: existingTemplate.show_images ?? true,
        show_metrics: existingTemplate.show_metrics ?? true,
        is_default: existingTemplate.is_default ?? false,
        is_active: existingTemplate.is_active ?? true,
      });
      if (existingTemplate.layout_config?.sections) {
        // Ensure existing templates get company_info if they don't have it
        const loadedSections = existingTemplate.layout_config.sections;
        const hasCompanyInfo = loadedSections.some((s: LayoutSection) => s.key === 'company_info');
        if (!hasCompanyInfo) {
          // Insert company_info before project_info
          const projectInfoIdx = loadedSections.findIndex((s: LayoutSection) => s.key === 'project_info');
          const companySection: LayoutSection = {
            key: 'company_info',
            label: 'Company Information',
            visible: true,
            order: 0,
            column: 'left',
          };
          if (projectInfoIdx >= 0) {
            // Shift all orders up by 1 and insert
            const updated = loadedSections.map((s: LayoutSection) => ({ ...s, order: s.order + 1 }));
            companySection.order = 1;
            updated.splice(projectInfoIdx, 0, companySection);
            setSections(updated);
          } else {
            setSections([companySection, ...loadedSections.map((s: LayoutSection) => ({ ...s, order: s.order + 1 }))]);
          }
        } else {
          setSections(loadedSections);
        }
      }
      if (existingTemplate.layout_config?.layout_style) {
        setLayoutStyle(existingTemplate.layout_config.layout_style as 'standard' | 'magazine');
      }
    }
  }, [existingTemplate]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<CaseStudyTemplate>) => caseStudyTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseStudyTemplates'] });
      navigate('/case-study-templates');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CaseStudyTemplate>) =>
      caseStudyTemplatesApi.update(parseInt(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseStudyTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['caseStudyTemplate', id] });
      navigate('/case-study-templates');
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

    // Swap order values
    const tempOrder = newSections[index].order;
    newSections[index].order = newSections[swapIndex].order;
    newSections[swapIndex].order = tempOrder;

    // Swap positions in array
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

    const submitData: Partial<CaseStudyTemplate> = {
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

  // Sections that support column assignment in magazine layout
  const columnSectionKeys = new Set(['company_info', 'project_info', 'executive_summary', 'challenge', 'solution', 'results', 'services_provided']);

  // Letter-portrait page dimensions at 96dpi
  const PAGE_WIDTH_PX = 816;   // 8.5in
  const PAGE_HEIGHT_PX = 1056; // 11in
  const PAGE_LABEL = 'Letter (8.5" × 11") • Portrait';

  // Auto-scale the full-size letter page to fit the preview column width
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

  // Synthesize a template object from current form state for live preview
  const previewTemplate: CaseStudyTemplate = {
    id: 0,
    tenant_id: 0,
    name: formData.name,
    description: formData.description,
    category: formData.category,
    layout_config: {
      layout_style: layoutStyle,
      sections,
      page_size: 'letter',
      orientation: 'portrait',
    },
    color_scheme: formData.color_scheme,
    show_logo: formData.show_logo,
    show_images: formData.show_images,
    show_metrics: formData.show_metrics,
    is_default: formData.is_default,
    is_active: formData.is_active,
    created_at: '',
    updated_at: '',
  };

  return (
    <div style={{ maxWidth: '1700px', margin: '0 auto', padding: '0 1rem' }}>
      <style>{`
        @media (max-width: 1200px) {
          .cs-template-editor-grid { grid-template-columns: 1fr !important; }
          .cs-template-preview-pane { position: static !important; max-height: none !important; }
        }
      `}</style>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/case-study-templates" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Case Study Templates
            </Link>
            <h1>📋 {isEditing ? 'Edit Template' : 'Create Case Study Template'}</h1>
            <div className="sales-subtitle">{isEditing ? 'Update template layout and settings' : 'Design a reusable case study layout'}</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/case-study-templates')}
          >
            Cancel
          </button>
        </div>
      </div>

      <div
        className="cs-template-editor-grid"
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
                placeholder="e.g., Full Detail, Executive Summary"
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
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Color Scheme</label>
              <select
                name="color_scheme"
                className="form-input"
                value={formData.color_scheme}
                onChange={handleChange}
              >
                <option value="default">Default</option>
                <option value="branded">Branded</option>
                <option value="minimal">Minimal</option>
              </select>
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
              onClick={() => setLayoutStyle('standard')}
              style={{
                padding: '1rem',
                border: `2px solid ${layoutStyle === 'standard' ? 'var(--primary)' : '#e5e7eb'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: layoutStyle === 'standard' ? '#f0f9ff' : 'white',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Standard</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                Sequential sections with header, configurable section order. Best for detailed multi-page case studies.
              </div>
            </div>
            <div
              onClick={() => setLayoutStyle('magazine')}
              style={{
                padding: '1rem',
                border: `2px solid ${layoutStyle === 'magazine' ? 'var(--primary)' : '#e5e7eb'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: layoutStyle === 'magazine' ? '#f0f9ff' : 'white',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Magazine / One-Pager</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                Hero banner with two-column layout. Assign sections to left or right columns. Best for marketing materials.
              </div>
            </div>
          </div>
        </div>

        {/* Layout Sections */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Layout Sections</h3>
          <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Toggle sections on/off and reorder them to control the case study layout.
            {layoutStyle === 'magazine' && ' Use the L/R toggle to assign sections to the left or right column.'}
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
                {/* Order badge */}
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

                {/* Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={section.visible}
                    onChange={() => handleSectionToggle(index)}
                    style={{ marginRight: '0.5rem' }}
                  />
                </label>

                {/* Label input */}
                <input
                  type="text"
                  value={section.label}
                  onChange={(e) => handleSectionLabelChange(index, e.target.value)}
                  className="form-input"
                  style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.875rem' }}
                />

                {/* Section key */}
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', flexShrink: 0, width: '110px' }}>
                  {section.key}
                </span>

                {/* Column toggle (magazine layout only) */}
                {layoutStyle === 'magazine' && columnSectionKeys.has(section.key) && (
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

                {/* Move buttons */}
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
              <input type="checkbox" name="show_images" checked={formData.show_images} onChange={handleChange} />
              Show Images
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" name="show_metrics" checked={formData.show_metrics} onChange={handleChange} />
              Show Metrics
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
            onClick={() => navigate('/case-study-templates')}
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
        className="cs-template-preview-pane"
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
            Sample data
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
            <CaseStudyPreview caseStudy={SAMPLE_CASE_STUDY as any} template={previewTemplate} />
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
};

export default CaseStudyTemplateForm;
