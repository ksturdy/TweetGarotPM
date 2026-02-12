import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { caseStudiesApi, CaseStudy } from '../../services/caseStudies';
import { projectsApi, Project } from '../../services/projects';
import { customersApi, Customer } from '../../services/customers';
import { caseStudyTemplatesApi, CaseStudyTemplate } from '../../services/caseStudyTemplates';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import SearchableSelect from '../../components/SearchableSelect';

const CaseStudyForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    project_id: '',
    customer_id: '',
    challenge: '',
    solution: '',
    results: '',
    executive_summary: '',
    cost_savings: '',
    timeline_improvement_days: '',
    quality_score: '',
    market: '',
    construction_type: '',
    project_size: '',
    services_provided: [] as string[],
    template_id: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customerLogoUrl, setCustomerLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load existing case study if editing
  const { data: caseStudy } = useQuery({
    queryKey: ['caseStudy', id],
    queryFn: () => caseStudiesApi.getById(parseInt(id!)).then(res => res.data),
    enabled: isEditMode,
  });

  // Load projects and customers for dropdowns
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then(res => res.data),
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  // Load templates
  const { data: templates } = useQuery({
    queryKey: ['caseStudyTemplates'],
    queryFn: () => caseStudyTemplatesApi.getAll({ is_active: true }).then(res => res.data),
  });

  useEffect(() => {
    if (caseStudy) {
      setFormData({
        title: caseStudy.title || '',
        subtitle: caseStudy.subtitle || '',
        project_id: caseStudy.project_id?.toString() || '',
        customer_id: caseStudy.customer_id?.toString() || '',
        challenge: caseStudy.challenge || '',
        solution: caseStudy.solution || '',
        results: caseStudy.results || '',
        executive_summary: caseStudy.executive_summary || '',
        cost_savings: caseStudy.cost_savings?.toString() || '',
        timeline_improvement_days: caseStudy.timeline_improvement_days?.toString() || '',
        quality_score: caseStudy.quality_score?.toString() || '',
        market: caseStudy.market || '',
        construction_type: caseStudy.construction_type || '',
        project_size: caseStudy.project_size || '',
        services_provided: caseStudy.services_provided || [],
        template_id: caseStudy.template_id?.toString() || '',
      });
      if (caseStudy.customer_logo_resolved_url) {
        setCustomerLogoUrl(caseStudy.customer_logo_resolved_url);
      }
    }
  }, [caseStudy]);

  const createMutation = useMutation({
    mutationFn: (data: any) => caseStudiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseStudies'] });
      navigate('/case-studies');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => caseStudiesApi.update(parseInt(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseStudies'] });
      queryClient.invalidateQueries({ queryKey: ['caseStudy', id] });
      navigate('/case-studies');
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.challenge.trim()) {
      newErrors.challenge = 'Challenge is required';
    }
    if (!formData.solution.trim()) {
      newErrors.solution = 'Solution is required';
    }
    if (!formData.results.trim()) {
      newErrors.results = 'Results is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const submitData: any = {
      ...formData,
      project_id: formData.project_id ? parseInt(formData.project_id) : null,
      customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
      template_id: formData.template_id ? parseInt(formData.template_id) : null,
      cost_savings: formData.cost_savings ? parseFloat(formData.cost_savings) : null,
      timeline_improvement_days: formData.timeline_improvement_days
        ? parseInt(formData.timeline_improvement_days)
        : null,
      quality_score: formData.quality_score ? parseInt(formData.quality_score) : null,
    };

    if (isEditMode) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services_provided: prev.services_provided.includes(service)
        ? prev.services_provided.filter(s => s !== service)
        : [...prev.services_provided, service],
    }));
  };

  const handleCustomerLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setLogoUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      const res = await caseStudiesApi.uploadCustomerLogo(parseInt(id), formDataUpload);
      setCustomerLogoUrl(res.data.customer_logo_url);
      queryClient.invalidateQueries({ queryKey: ['caseStudy', id] });
    } catch (err) {
      console.error('Failed to upload customer logo:', err);
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveCustomerLogo = async () => {
    if (!id) return;
    try {
      await caseStudiesApi.deleteCustomerLogo(parseInt(id));
      setCustomerLogoUrl(null);
      queryClient.invalidateQueries({ queryKey: ['caseStudy', id] });
    } catch (err) {
      console.error('Failed to remove customer logo:', err);
    }
  };

  const services = ['HVAC', 'Plumbing', 'Sheet Metal', 'Controls', 'Service'];

  const customerOptions = useMemo(
    () => (customers || []).map((c: Customer) => ({
      value: c.id,
      label: [c.customer_owner, c.customer_facility].filter(Boolean).join(' — '),
      searchText: [c.customer_owner, c.customer_facility].filter(Boolean).join(' '),
    })),
    [customers]
  );

  const projectOptions = useMemo(
    () => (projects || []).map((p: Project) => ({
      value: p.id,
      label: p.name,
    })),
    [projects]
  );

  return (
    <div className="container">
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">
          {isEditMode ? 'Edit Case Study' : 'Create Case Study'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Basic Information
          </h3>

          <div className="form-group">
            <label className="form-label">
              Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              name="title"
              className="form-input"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Healthcare HVAC Upgrade Saves $50K Annually"
            />
            {errors.title && (
              <div className="error-message" style={{ marginTop: '0.25rem' }}>
                {errors.title}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Subtitle</label>
            <input
              type="text"
              name="subtitle"
              className="form-input"
              value={formData.subtitle}
              onChange={handleChange}
              placeholder="e.g., Major Hospital Reduces Energy Costs with Modern System"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Template (for Preview/PDF)</label>
            <select
              name="template_id"
              className="form-input"
              value={formData.template_id}
              onChange={handleChange}
            >
              <option value="">No Template - Full Detail</option>
              {templates?.map((t: CaseStudyTemplate) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_default ? ' (Default)' : ''}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: '0.25rem' }}>
              Controls which sections appear in the printed/PDF version
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Customer</label>
              <SearchableSelect
                options={customerOptions}
                value={formData.customer_id}
                onChange={(val) => {
                  setFormData(prev => ({ ...prev, customer_id: val }));
                  if (errors.customer_id) setErrors(prev => ({ ...prev, customer_id: '' }));
                }}
                placeholder="Search customers..."
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project</label>
              <SearchableSelect
                options={projectOptions}
                value={formData.project_id}
                onChange={(val) => {
                  setFormData(prev => ({ ...prev, project_id: val }));
                  if (errors.project_id) setErrors(prev => ({ ...prev, project_id: '' }));
                }}
                placeholder="Search projects..."
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Content
          </h3>

          <div className="form-group">
            <label className="form-label">
              Challenge <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <RichTextEditor
              value={formData.challenge}
              onChange={(value) =>
                setFormData(prev => ({ ...prev, challenge: value }))
              }
              placeholder="Describe the problem or challenge..."
              minHeight="150px"
            />
            {errors.challenge && (
              <div className="error-message" style={{ marginTop: '0.25rem' }}>
                {errors.challenge}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              Solution <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <RichTextEditor
              value={formData.solution}
              onChange={(value) =>
                setFormData(prev => ({ ...prev, solution: value }))
              }
              placeholder="Describe how you solved the problem..."
              minHeight="150px"
            />
            {errors.solution && (
              <div className="error-message" style={{ marginTop: '0.25rem' }}>
                {errors.solution}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              Results <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <RichTextEditor
              value={formData.results}
              onChange={(value) =>
                setFormData(prev => ({ ...prev, results: value }))
              }
              placeholder="Describe the outcomes and impact..."
              minHeight="150px"
            />
            {errors.results && (
              <div className="error-message" style={{ marginTop: '0.25rem' }}>
                {errors.results}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Executive Summary</label>
            <RichTextEditor
              value={formData.executive_summary}
              onChange={(value) =>
                setFormData(prev => ({ ...prev, executive_summary: value }))
              }
              placeholder="Brief overview for proposals and marketing materials..."
              minHeight="120px"
            />
          </div>
        </div>

        {/* Metrics */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Metrics & Outcomes
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Cost Savings ($)</label>
              <input
                type="number"
                name="cost_savings"
                className="form-input"
                value={formData.cost_savings}
                onChange={handleChange}
                placeholder="50000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Timeline Improvement (days)</label>
              <input
                type="number"
                name="timeline_improvement_days"
                className="form-input"
                value={formData.timeline_improvement_days}
                onChange={handleChange}
                placeholder="15"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Quality Score (%)</label>
              <input
                type="number"
                name="quality_score"
                className="form-input"
                value={formData.quality_score}
                onChange={handleChange}
                min="0"
                max="100"
                placeholder="95"
              />
            </div>
          </div>
        </div>

        {/* Categorization */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Categorization
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Market</label>
              <select
                name="market"
                className="form-input"
                value={formData.market}
                onChange={handleChange}
              >
                <option value="">Select Market</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Industrial">Industrial</option>
                <option value="Commercial">Commercial</option>
                <option value="Education">Education</option>
                <option value="Government">Government</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Construction Type</label>
              <select
                name="construction_type"
                className="form-input"
                value={formData.construction_type}
                onChange={handleChange}
              >
                <option value="">Select Type</option>
                <option value="New Construction">New Construction</option>
                <option value="Renovation">Renovation</option>
                <option value="Retrofit">Retrofit</option>
                <option value="Service">Service</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Project Size</label>
              <select
                name="project_size"
                className="form-input"
                value={formData.project_size}
                onChange={handleChange}
              >
                <option value="">Select Size</option>
                <option value="Small">Small (&lt;$100K)</option>
                <option value="Medium">Medium ($100K-$1M)</option>
                <option value="Large">Large (&gt;$1M)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Services Provided</label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {services.map(service => (
                <label
                  key={service}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={formData.services_provided.includes(service)}
                    onChange={() => handleServiceToggle(service)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  {service}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Customer Logo */}
        {isEditMode && (
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
              Customer Logo
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginBottom: '1rem', marginTop: 0 }}>
              Upload the customer's logo to display in the case study hero banner (magazine layout)
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {customerLogoUrl ? (
                <div style={{
                  width: '80px', height: '80px', border: '1px solid #e5e7eb', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  backgroundColor: '#f9fafb',
                }}>
                  <img src={customerLogoUrl} alt="Customer Logo"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{
                  width: '80px', height: '80px', border: '2px dashed #d1d5db', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center',
                }}>
                  No logo
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCustomerLogoUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? 'Uploading...' : customerLogoUrl ? 'Replace Logo' : 'Upload Logo'}
                </button>
                {customerLogoUrl && (
                  <button
                    type="button"
                    style={{
                      background: 'none', border: 'none', color: 'var(--danger)',
                      cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0',
                      textAlign: 'left',
                    }}
                    onClick={handleRemoveCustomerLogo}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(isEditMode ? `/case-studies/${id}` : '/case-studies')}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : isEditMode
              ? 'Update Case Study'
              : 'Create Case Study'}
          </button>
        </div>

        {(createMutation.isError || updateMutation.isError) && (
          <div className="error-message" style={{ marginTop: '1rem' }}>
            Failed to save case study. Please try again.
          </div>
        )}
      </form>
    </div>
  );
};

export default CaseStudyForm;
