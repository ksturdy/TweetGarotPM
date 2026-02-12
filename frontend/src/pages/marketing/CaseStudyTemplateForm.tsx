import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caseStudyTemplatesApi, CaseStudyTemplate, LayoutSection } from '../../services/caseStudyTemplates';

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
        setSections(existingTemplate.layout_config.sections);
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

  return (
    <div className="container">
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">
          {isEditing ? 'Edit Template' : 'Create Case Study Template'}
        </h1>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/case-study-templates')}
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Basic Information</h3>
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

        {/* Layout Sections */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Layout Sections</h3>
          <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Toggle sections on/off and reorder them to control the case study layout.
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
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', flexShrink: 0, width: '120px' }}>
                  {section.key}
                </span>

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
    </div>
  );
};

export default CaseStudyTemplateForm;
