import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { proposalTemplatesApi, ProposalTemplateSection, TemplateVariable } from '../../services/proposalTemplates';
import './ProposalTemplateForm.css';
import '../../styles/SalesPipeline.css';

const ProposalTemplateForm: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    default_executive_summary: '',
    default_company_overview: '',
    default_terms_and_conditions: '',
    is_default: false,
    is_active: true,
  });

  const [sections, setSections] = useState<ProposalTemplateSection[]>([]);
  const [showVariables, setShowVariables] = useState(false);

  // Fetch available variables
  const { data: variables = [] } = useQuery({
    queryKey: ['templateVariables'],
    queryFn: async () => {
      const response = await proposalTemplatesApi.getVariables();
      return response.data;
    },
  });

  // Fetch existing template if editing
  const { data: existingTemplate, isLoading } = useQuery({
    queryKey: ['proposalTemplate', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await proposalTemplatesApi.getById(parseInt(id));
      return response.data;
    },
    enabled: isEditing,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingTemplate) {
      setFormData({
        name: existingTemplate.name || '',
        description: existingTemplate.description || '',
        category: existingTemplate.category || '',
        default_executive_summary: existingTemplate.default_executive_summary || '',
        default_company_overview: existingTemplate.default_company_overview || '',
        default_terms_and_conditions: existingTemplate.default_terms_and_conditions || '',
        is_default: existingTemplate.is_default || false,
        is_active: existingTemplate.is_active,
      });
      setSections(existingTemplate.sections || []);
    }
  }, [existingTemplate]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => proposalTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalTemplates'] });
      navigate('/proposal-templates');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      proposalTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['proposalTemplate', id] });
      navigate('/proposal-templates');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      sections: sections.map((section, index) => ({
        ...section,
        display_order: index + 1,
      })),
    };

    if (isEditing && id) {
      updateMutation.mutate({ id: parseInt(id), data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addSection = () => {
    setSections([
      ...sections,
      {
        section_type: 'custom',
        title: '',
        content: '',
        display_order: sections.length + 1,
        is_required: false,
      },
    ]);
  };

  const updateSection = (index: number, field: keyof ProposalTemplateSection, value: any) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === sections.length - 1)
    ) {
      return;
    }

    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setSections(newSections);
  };

  const insertVariable = (field: string, variable: string) => {
    const placeholder = `{{${variable}}}`;

    if (field.startsWith('section-')) {
      const index = parseInt(field.split('-')[1]);
      updateSection(index, 'content', sections[index].content + placeholder);
    } else {
      setFormData({ ...formData, [field]: (formData as any)[field] + placeholder });
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="proposal-template-form">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/proposal-templates" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Proposal Templates
            </Link>
            <h1>📄 {isEditing ? 'Edit' : 'Create'} Proposal Template</h1>
            <div className="sales-subtitle">
              {isEditing ? 'Update template information' : 'Create a reusable proposal template'}
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btnSecondary" onClick={() => navigate('/proposal-templates')}>
            Cancel
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        {/* Basic Information */}
        <div className="card">
          <h2 className="section-title">Basic Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>
                Template Name <span className="required">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                className="input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Commercial, Healthcare, Industrial"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Brief description of this template..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
                <span>Set as default template</span>
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* Default Content */}
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Default Content</h2>
            <button
              type="button"
              className="btnSecondary"
              onClick={() => setShowVariables(!showVariables)}
            >
              {showVariables ? 'Hide' : 'Show'} Variables
            </button>
          </div>

          {showVariables && (
            <div className="variables-panel">
              <h3>Available Variables</h3>
              <div className="variables-grid">
                {variables.map((variable: TemplateVariable) => (
                  <div key={variable.name} className="variable-item">
                    <code>{`{{${variable.name}}}`}</code>
                    <span>{variable.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Default Executive Summary</label>
            <textarea
              className="input"
              value={formData.default_executive_summary}
              onChange={(e) =>
                setFormData({ ...formData, default_executive_summary: e.target.value })
              }
              rows={4}
              placeholder="Use {{variables}} for dynamic content..."
            />
          </div>

          <div className="form-group">
            <label>Default Company Overview</label>
            <textarea
              className="input"
              value={formData.default_company_overview}
              onChange={(e) =>
                setFormData({ ...formData, default_company_overview: e.target.value })
              }
              rows={4}
              placeholder="Use {{variables}} for dynamic content..."
            />
          </div>

          <div className="form-group">
            <label>Default Terms and Conditions</label>
            <textarea
              className="input"
              value={formData.default_terms_and_conditions}
              onChange={(e) =>
                setFormData({ ...formData, default_terms_and_conditions: e.target.value })
              }
              rows={4}
              placeholder="Use {{variables}} for dynamic content..."
            />
          </div>
        </div>

        {/* Template Sections */}
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Template Sections</h2>
            <button type="button" className="btnSecondary" onClick={addSection}>
              + Add Section
            </button>
          </div>

          {sections.length === 0 ? (
            <p className="help-text">No sections added yet. Click "Add Section" to create one.</p>
          ) : (
            <div className="sections-list">
              {sections.map((section, index) => (
                <div key={index} className="section-item">
                  <div className="section-controls">
                    <div className="section-number">Section {index + 1}</div>
                    <div className="section-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => moveSection(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ⬆️
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => moveSection(index, 'down')}
                        disabled={index === sections.length - 1}
                        title="Move down"
                      >
                        ⬇️
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => removeSection(index)}
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Section Type</label>
                      <select
                        className="input"
                        value={section.section_type}
                        onChange={(e) => updateSection(index, 'section_type', e.target.value)}
                      >
                        <option value="custom">Custom</option>
                        <option value="scope">Scope of Work</option>
                        <option value="approach">Approach & Methodology</option>
                        <option value="timeline">Timeline</option>
                        <option value="team">Project Team</option>
                        <option value="experience">Experience & Qualifications</option>
                        <option value="pricing">Pricing</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Section Title</label>
                      <input
                        type="text"
                        className="input"
                        value={section.title}
                        onChange={(e) => updateSection(index, 'title', e.target.value)}
                        placeholder="e.g., Project Scope"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Content</label>
                    <textarea
                      className="input"
                      value={section.content}
                      onChange={(e) => updateSection(index, 'content', e.target.value)}
                      rows={4}
                      placeholder="Use {{variables}} for dynamic content..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={section.is_required}
                        onChange={(e) => updateSection(index, 'is_required', e.target.checked)}
                      />
                      <span>Required section (cannot be removed from proposals)</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" className="btnSecondary" onClick={() => navigate('/proposal-templates')}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {isEditing ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProposalTemplateForm;
