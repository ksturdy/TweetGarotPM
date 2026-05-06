import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  resumeTemplatesApi,
  ResumeTemplate,
  ResumeTemplateSectionLimits,
  ResumeTemplateSectionVisibility,
} from '../../services/resumeTemplates';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import ResumeTemplatePreview from '../../components/marketing/ResumeTemplatePreview';
import '../../styles/SalesPipeline.css';

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

const SECTION_OPTIONS: { key: keyof ResumeTemplateSectionVisibility; label: string; column: 'sidebar' | 'main' }[] = [
  { key: 'contact', label: 'Contact Info', column: 'sidebar' },
  { key: 'references', label: 'References', column: 'sidebar' },
  { key: 'hobbies', label: 'Hobbies & Interests', column: 'sidebar' },
  { key: 'summary', label: 'About Me / Summary', column: 'main' },
  { key: 'projects', label: 'Project Experience', column: 'main' },
  { key: 'education', label: 'Education & Certifications', column: 'main' },
  { key: 'skills', label: 'Skills & Specializations', column: 'main' },
  { key: 'languages', label: 'Languages', column: 'main' },
];

const COLOR_PRESETS = [
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Slate', value: '#334155' },
  { name: 'Forest', value: '#14532d' },
  { name: 'Burgundy', value: '#7f1d1d' },
  { name: 'Indigo', value: '#312e81' },
  { name: 'Charcoal', value: '#1f2937' },
];

const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;

const zoomBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  backgroundColor: 'white',
  color: '#374151',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: 0,
  lineHeight: 1,
};

const ResumeTemplateForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();
  const isEditing = !!id;
  const numericId = id ? parseInt(id, 10) : null;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_default: false,
    is_active: true,
  });
  const [limits, setLimits] = useState<Required<ResumeTemplateSectionLimits>>({ ...DEFAULT_LIMITS });
  const [visibility, setVisibility] = useState<Required<ResumeTemplateSectionVisibility>>({ ...DEFAULT_VISIBILITY });
  const [showPhoto, setShowPhoto] = useState(true);
  const [showYearsExperience, setShowYearsExperience] = useState(true);
  const [sidebarColor, setSidebarColor] = useState('#1e3a5f');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existingTemplate, isLoading: loadingTemplate } = useQuery({
    queryKey: ['resumeTemplate', numericId],
    queryFn: () => resumeTemplatesApi.getById(numericId!).then(res => res.data),
    enabled: isEditing && numericId != null,
  });

  useEffect(() => {
    if (!existingTemplate) return;
    setFormData({
      name: existingTemplate.name || '',
      description: existingTemplate.description || '',
      is_default: !!existingTemplate.is_default,
      is_active: existingTemplate.is_active !== false,
    });
    setLimits({ ...DEFAULT_LIMITS, ...(existingTemplate.section_limits || {}) });
    const cfg = existingTemplate.layout_config || {};
    setVisibility({ ...DEFAULT_VISIBILITY, ...(cfg.sections || {}) });
    setShowPhoto(cfg.show_photo ?? true);
    setShowYearsExperience(cfg.show_years_experience ?? true);
    setSidebarColor(cfg.sidebar_color || '#1e3a5f');
  }, [existingTemplate]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<ResumeTemplate>) => resumeTemplatesApi.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumeTemplates'] });
      toast.success('Template created');
      navigate('/resume-templates');
    },
    onError: (err: any) => {
      toast.error(`Create failed: ${err?.response?.data?.error || err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ResumeTemplate>) =>
      resumeTemplatesApi.update(numericId!, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumeTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['resumeTemplate', numericId] });
      toast.success('Template saved');
      navigate('/resume-templates');
    },
    onError: (err: any) => {
      toast.error(`Save failed: ${err?.response?.data?.error || err.message}`);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (templateId: number) => resumeTemplatesApi.setDefault(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumeTemplates'] });
    },
  });

  const previewTemplate: ResumeTemplate = {
    id: existingTemplate?.id ?? 0,
    tenant_id: existingTemplate?.tenant_id ?? 0,
    name: formData.name,
    description: formData.description,
    template_key: existingTemplate?.template_key ?? 'classic_two_column',
    page_size: existingTemplate?.page_size ?? 'letter',
    orientation: existingTemplate?.orientation ?? 'portrait',
    max_pages: existingTemplate?.max_pages ?? 1,
    section_limits: limits,
    layout_config: {
      show_photo: showPhoto,
      show_years_experience: showYearsExperience,
      sidebar_color: sidebarColor,
      sections: visibility,
    },
    is_default: formData.is_default,
    is_active: formData.is_active,
    preview_image_path: existingTemplate?.preview_image_path ?? null,
    created_at: existingTemplate?.created_at ?? '',
    updated_at: existingTemplate?.updated_at ?? '',
  };

  const handleLimitChange = (key: keyof ResumeTemplateSectionLimits, raw: string) => {
    const n = parseInt(raw, 10);
    setLimits(prev => ({ ...prev, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  };

  const toggleSection = (key: keyof ResumeTemplateSectionVisibility) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const payload: Partial<ResumeTemplate> = {
      name: formData.name,
      description: formData.description,
      is_active: formData.is_active,
      section_limits: limits,
      layout_config: {
        show_photo: showPhoto,
        show_years_experience: showYearsExperience,
        sidebar_color: sidebarColor,
        sections: visibility,
      },
    };

    if (isEditing && numericId != null) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          if (formData.is_default && !existingTemplate?.is_default) {
            setDefaultMutation.mutate(numericId);
          }
        },
      });
    } else {
      createMutation.mutate(
        {
          ...payload,
          template_key: 'classic_two_column',
          page_size: 'letter',
          orientation: 'portrait',
          max_pages: 1,
        },
        {
          onSuccess: created => {
            if (formData.is_default && created?.id) {
              setDefaultMutation.mutate(created.id);
            }
          },
        }
      );
    }
  };

  // Auto-scale the full-size letter page to fit the preview pane's width AND height
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [autoZoom, setAutoZoom] = useState(0.6);
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const zoomScale = manualZoom != null ? manualZoom : autoZoom;

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        const widthScale = Math.min(1, w / PAGE_WIDTH_PX);
        const heightScale = Math.min(1, h / PAGE_HEIGHT_PX);
        setAutoZoom(Math.min(widthScale, heightScale));
      }
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const adjustZoom = (delta: number) => {
    const next = Math.max(0.25, Math.min(2, zoomScale + delta));
    setManualZoom(Number(next.toFixed(2)));
  };
  const resetZoomToFit = () => setManualZoom(null);

  if (isEditing && loadingTemplate) {
    return <div className="loading">Loading template...</div>;
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 'none', margin: 0, padding: 0 }}>
      <style>{`
        @media (max-width: 1200px) {
          .resume-template-editor-grid { grid-template-columns: 1fr !important; }
          .resume-template-preview-pane { position: static !important; max-height: none !important; }
        }
      `}</style>

      <div className="sales-page-header" style={{ flexShrink: 0, padding: '1rem 1.5rem 0', margin: 0 }}>
        <div className="sales-page-title">
          <div>
            <Link
              to="/resume-templates"
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}
            >
              &larr; Back to Resume Templates
            </Link>
            <h1>📑 {isEditing ? 'Edit Template' : 'Create Resume Template'}</h1>
            <div className="sales-subtitle">
              {isEditing ? 'Update template layout and settings' : 'Design a reusable resume layout'}
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/resume-templates')}>
            Cancel
          </button>
        </div>
      </div>

      <div
        className="resume-template-editor-grid"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '1.5rem',
          padding: '1rem 1.5rem',
        }}
      >
        <form
          onSubmit={handleSave}
          style={{ overflowY: 'auto', overflowX: 'hidden', paddingRight: '0.5rem', minHeight: 0 }}
        >
          {/* Basic Info */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Basic Information</h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 4,
                  fontWeight: 500,
                }}
              >
                Page Size: Letter (8.5" × 11") • Portrait • 1 page
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Template Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Classic Two-Column"
              />
              {errors.name && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.name}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Brief description of when to use this template"
              />
            </div>
          </div>

          {/* Sections (visibility) */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Sections</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
              Toggle which sections appear on the rendered resume. Hidden sections are skipped entirely (no header, no whitespace).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                  Sidebar
                </div>
                {SECTION_OPTIONS.filter(s => s.column === 'sidebar').map(s => (
                  <SectionToggle
                    key={s.key}
                    label={s.label}
                    checked={visibility[s.key] !== false}
                    onChange={() => toggleSection(s.key)}
                  />
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                  Main Content
                </div>
                {SECTION_OPTIONS.filter(s => s.column === 'main').map(s => (
                  <SectionToggle
                    key={s.key}
                    label={s.label}
                    checked={visibility[s.key] !== false}
                    onChange={() => toggleSection(s.key)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Appearance</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
              Control the sidebar accent color and header elements.
            </p>

            <div className="form-group">
              <label className="form-label">Sidebar / Accent Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="color"
                  value={sidebarColor}
                  onChange={e => setSidebarColor(e.target.value)}
                  style={{ width: 48, height: 36, padding: 0, border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={sidebarColor}
                  onChange={e => setSidebarColor(e.target.value)}
                  style={{ width: 120, fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {COLOR_PRESETS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setSidebarColor(p.value)}
                      title={p.name}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: sidebarColor.toLowerCase() === p.value.toLowerCase() ? '2px solid #2563eb' : '2px solid #e5e7eb',
                        backgroundColor: p.value,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showPhoto}
                  onChange={e => setShowPhoto(e.target.checked)}
                />
                Show Employee Photo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showYearsExperience}
                  onChange={e => setShowYearsExperience(e.target.checked)}
                />
                Show Years of Experience
              </label>
            </div>
          </div>

          {/* Section Limits */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Section Limits</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
              Caps the number of items rendered per section so the resume stays inside its single 8.5×11 page. Lower limits = more whitespace, higher limits = denser content.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
              <LimitField label="Summary chars" value={limits.summary_chars} onChange={v => handleLimitChange('summary_chars', v)} hint="Truncates About Me text" />
              <LimitField label="Projects" value={limits.projects} onChange={v => handleLimitChange('projects', v)} />
              <LimitField label="Certifications" value={limits.certifications} onChange={v => handleLimitChange('certifications', v)} />
              <LimitField label="Skills" value={limits.skills} onChange={v => handleLimitChange('skills', v)} />
              <LimitField label="Languages" value={limits.languages} onChange={v => handleLimitChange('languages', v)} />
              <LimitField label="Hobbies" value={limits.hobbies} onChange={v => handleLimitChange('hobbies', v)} />
              <LimitField label="References" value={limits.references} onChange={v => handleLimitChange('references', v)} />
            </div>
          </div>

          {/* Display Options */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Display Options</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={e => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                />
                Set as Default Template
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/resume-templates')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>

        <aside
          className="resume-template-preview-pane"
          style={{
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
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
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Live Preview
            </span>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500, flex: 1, textAlign: 'center' }}>
              Letter (8.5" × 11") • Portrait • Sample data
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button type="button" onClick={() => adjustZoom(-0.1)} style={zoomBtnStyle} title="Zoom out">−</button>
              <button
                type="button"
                onClick={resetZoomToFit}
                style={{ ...zoomBtnStyle, width: 'auto', padding: '0 0.45rem', fontWeight: manualZoom == null ? 700 : 400, color: manualZoom == null ? '#2563eb' : '#374151' }}
                title="Fit to pane"
              >
                Fit
              </button>
              <button type="button" onClick={() => adjustZoom(0.1)} style={zoomBtnStyle} title="Zoom in">+</button>
              <span style={{ fontSize: '0.7rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
                {Math.round(zoomScale * 100)}%
              </span>
            </div>
          </div>
          <div
            ref={previewContainerRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflow: manualZoom != null ? 'auto' : 'hidden',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: `${PAGE_WIDTH_PX}px`,
                height: `${PAGE_HEIGHT_PX}px`,
                zoom: zoomScale,
                backgroundColor: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid #d1d5db',
                overflow: 'hidden',
                flexShrink: 0,
              } as React.CSSProperties}
            >
              <ResumeTemplatePreview template={previewTemplate} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const SectionToggle: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      cursor: 'pointer',
      padding: '0.4rem 0.6rem',
      borderRadius: 6,
      backgroundColor: checked ? '#f0fdf4' : '#fafafa',
      border: `1px solid ${checked ? '#86efac' : '#e5e7eb'}`,
      marginBottom: '0.4rem',
      fontSize: '0.85rem',
      transition: 'background-color 0.15s, border-color 0.15s',
    }}
  >
    <input type="checkbox" checked={checked} onChange={onChange} />
    {label}
  </label>
);

const LimitField: React.FC<{ label: string; value: number; onChange: (v: string) => void; hint?: string }> = ({ label, value, onChange, hint }) => (
  <div className="form-group" style={{ marginBottom: 0 }}>
    <label className="form-label" style={{ fontSize: '0.8rem' }}>
      {label}
    </label>
    <input
      type="number"
      min={0}
      className="form-input"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
    {hint && <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>{hint}</div>}
  </div>
);

export default ResumeTemplateForm;
