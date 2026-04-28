import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { caseStudiesApi, CaseStudy } from '../../services/caseStudies';
import { projectsApi, Project } from '../../services/projects';
import { customersApi, Customer, getCustomerContacts } from '../../services/customers';
import { caseStudyTemplatesApi, CaseStudyTemplate } from '../../services/caseStudyTemplates';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import SearchableSelect from '../../components/SearchableSelect';
import { MARKETS } from '../../constants/markets';
import '../../styles/SalesPipeline.css';

interface OverrideFields {
  override_contact_name: string;
  override_contact_title: string;
  override_contact_email: string;
  override_contact_phone: string;
  override_account_manager: string;
  override_start_date: string;
  override_end_date: string;
  override_contract_value: string;
  override_square_footage: string;
}

interface InheritedValues {
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  account_manager: string;
  start_date: string;
  end_date: string;
  contract_value: string;
  square_footage: string;
}

const emptyOverrides: OverrideFields = {
  override_contact_name: '',
  override_contact_title: '',
  override_contact_email: '',
  override_contact_phone: '',
  override_account_manager: '',
  override_start_date: '',
  override_end_date: '',
  override_contract_value: '',
  override_square_footage: '',
};

const emptyInherited: InheritedValues = {
  contact_name: '',
  contact_title: '',
  contact_email: '',
  contact_phone: '',
  account_manager: '',
  start_date: '',
  end_date: '',
  contract_value: '',
  square_footage: '',
};

type OverrideKey = keyof OverrideFields;
type InheritedKey = keyof InheritedValues;

const overrideFieldMap: { key: OverrideKey; inheritedKey: InheritedKey; label: string; type: string; group: 'contact' | 'project' }[] = [
  { key: 'override_account_manager', inheritedKey: 'account_manager', label: 'Account Manager', type: 'text', group: 'contact' },
  { key: 'override_contact_name', inheritedKey: 'contact_name', label: 'Primary Contact', type: 'text', group: 'contact' },
  { key: 'override_contact_title', inheritedKey: 'contact_title', label: 'Contact Title', type: 'text', group: 'contact' },
  { key: 'override_contact_email', inheritedKey: 'contact_email', label: 'Contact Email', type: 'email', group: 'contact' },
  { key: 'override_contact_phone', inheritedKey: 'contact_phone', label: 'Contact Phone', type: 'tel', group: 'contact' },
  { key: 'override_start_date', inheritedKey: 'start_date', label: 'Start Date', type: 'date', group: 'project' },
  { key: 'override_end_date', inheritedKey: 'end_date', label: 'End Date', type: 'date', group: 'project' },
  { key: 'override_contract_value', inheritedKey: 'contract_value', label: 'Contract Value ($)', type: 'number', group: 'project' },
  { key: 'override_square_footage', inheritedKey: 'square_footage', label: 'Square Footage', type: 'number', group: 'project' },
];

const formatDate = (val: string) => {
  if (!val) return '';
  const d = new Date(val.includes('T') ? val : val + 'T00:00:00');
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (val: string) => {
  if (!val) return '';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

const formatNumber = (val: string) => {
  if (!val) return '';
  const raw = val.replace(/,/g, '');
  const n = parseFloat(raw);
  if (isNaN(n)) return val;
  return n.toLocaleString();
};

const formatInherited = (key: InheritedKey, val: string) => {
  if (!val) return '—';
  if (key === 'start_date' || key === 'end_date') return formatDate(val);
  if (key === 'contract_value') return formatCurrency(val);
  if (key === 'square_footage') return formatNumber(val) + ' sq ft';
  return val;
};

const toDateInputValue = (val: string) => {
  if (!val) return '';
  const d = new Date(val.includes('T') ? val : val + 'T00:00:00');
  if (isNaN(d.getTime())) return val;
  return d.toISOString().split('T')[0];
};

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
    construction_type: [] as string[],
    project_size: '',
    services_provided: [] as string[],
    template_id: '',
  });

  const [overrides, setOverrides] = useState<OverrideFields>({ ...emptyOverrides });
  const [overrideEnabled, setOverrideEnabled] = useState<Record<OverrideKey, boolean>>({
    override_contact_name: false,
    override_contact_title: false,
    override_contact_email: false,
    override_contact_phone: false,
    override_account_manager: false,
    override_start_date: false,
    override_end_date: false,
    override_contract_value: false,
    override_square_footage: false,
  });
  const [inherited, setInherited] = useState<InheritedValues>({ ...emptyInherited });

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

  // Fetch contacts for selected customer
  const { data: customerContacts } = useQuery({
    queryKey: ['customerContacts', formData.customer_id],
    queryFn: () => getCustomerContacts(formData.customer_id),
    enabled: !!formData.customer_id,
  });

  // Update inherited contact values when customer/contacts change
  useEffect(() => {
    if (!formData.customer_id) {
      setInherited(prev => ({
        ...prev,
        contact_name: '',
        contact_title: '',
        contact_email: '',
        contact_phone: '',
        account_manager: '',
      }));
      return;
    }

    const customer = customers?.find((c: Customer) => c.id === parseInt(formData.customer_id));
    const primaryContact = customerContacts?.find((c: any) => c.is_primary) || customerContacts?.[0];

    setInherited(prev => ({
      ...prev,
      account_manager: customer?.account_manager || '',
      contact_name: primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}`.trim() : '',
      contact_title: primaryContact?.title || '',
      contact_email: primaryContact?.email || '',
      contact_phone: primaryContact?.phone || primaryContact?.mobile || '',
    }));
  }, [formData.customer_id, customers, customerContacts]);

  // Update inherited project values when project changes
  useEffect(() => {
    if (!formData.project_id) {
      setInherited(prev => ({
        ...prev,
        start_date: '',
        end_date: '',
        contract_value: '',
        square_footage: '',
      }));
      return;
    }

    const project = projects?.find((p: Project) => p.id === parseInt(formData.project_id));
    if (project) {
      setInherited(prev => ({
        ...prev,
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        contract_value: project.contract_value?.toString() || '',
        square_footage: (project as any).square_footage?.toString() || '',
      }));
    }
  }, [formData.project_id, projects]);

  // Populate form from existing case study
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
        construction_type: caseStudy.construction_type || [],
        project_size: caseStudy.project_size || '',
        services_provided: caseStudy.services_provided || [],
        template_id: caseStudy.template_id?.toString() || '',
      });

      // Set inherited values from the case study response
      setInherited({
        account_manager: caseStudy.customer_account_manager || '',
        contact_name: caseStudy.primary_contact_name || '',
        contact_title: caseStudy.primary_contact_title || '',
        contact_email: caseStudy.primary_contact_email || '',
        contact_phone: caseStudy.primary_contact_phone || '',
        start_date: caseStudy.project_start_date || '',
        end_date: caseStudy.project_end_date || '',
        contract_value: caseStudy.project_value?.toString() || '',
        square_footage: caseStudy.project_square_footage?.toString() || '',
      });

      // Set override values and enable toggles for any that are set
      const newOverrides = { ...emptyOverrides };
      const newEnabled: Record<OverrideKey, boolean> = {} as any;

      for (const field of overrideFieldMap) {
        const val = (caseStudy as any)[field.key];
        if (val != null && val !== '') {
          newOverrides[field.key] = val.toString();
          newEnabled[field.key] = true;
        } else {
          newEnabled[field.key] = false;
        }
      }

      setOverrides(newOverrides);
      setOverrideEnabled(prev => ({ ...prev, ...newEnabled }));

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

    // Add override fields - send null when override is disabled to clear any previous value
    for (const field of overrideFieldMap) {
      if (overrideEnabled[field.key] && overrides[field.key]) {
        if (field.type === 'number') {
          submitData[field.key] = parseFloat(overrides[field.key]);
        } else {
          submitData[field.key] = overrides[field.key];
        }
      } else {
        submitData[field.key] = null;
      }
    }

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

  const handleConstructionTypeToggle = (type: string) => {
    setFormData(prev => ({
      ...prev,
      construction_type: prev.construction_type.includes(type)
        ? prev.construction_type.filter(t => t !== type)
        : [...prev.construction_type, type],
    }));
  };

  const handleOverrideToggle = useCallback((key: OverrideKey, inheritedKey: InheritedKey) => {
    setOverrideEnabled(prev => {
      const enabling = !prev[key];
      if (enabling) {
        // Pre-fill override with inherited value
        setOverrides(o => ({
          ...o,
          [key]: o[key] || inherited[inheritedKey] || '',
        }));
      }
      return { ...prev, [key]: enabling };
    });
  }, [inherited]);

  const handleOverrideChange = useCallback((key: OverrideKey, value: string) => {
    setOverrides(prev => ({ ...prev, [key]: value }));
  }, []);

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

  const services = [
    'HVAC',
    'Plumbing',
    'Industrial Piping',
    'Process Piping',
    'Industrial Sheet Metal',
    'Industrial Ventilation',
    'Custom Equipment Design',
    'Engineering',
    'Building Automation Systems',
    'Air Purification',
    'BIM',
    'Medical Gas',
    'Dust Collection',
  ];

  const customerOptions = useMemo(
    () => (customers || []).map((c: Customer) => ({
      value: c.id,
      label: (c as any).name || [c.customer_owner, c.customer_facility].filter(Boolean).join(' — '),
      searchText: [(c as any).name, c.customer_owner, c.customer_facility].filter(Boolean).join(' '),
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

  const hasCustomerOrProject = !!formData.customer_id || !!formData.project_id;
  const contactFields = overrideFieldMap.filter(f => f.group === 'contact');
  const projectFields = overrideFieldMap.filter(f => f.group === 'project');

  const renderOverrideRow = (field: typeof overrideFieldMap[0]) => {
    const isEnabled = overrideEnabled[field.key];
    const inheritedVal = inherited[field.inheritedKey];
    const overrideVal = overrides[field.key];

    return (
      <div key={field.key} style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr auto',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.5rem 0',
        borderBottom: '1px solid #f3f4f6',
      }}>
        <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>
          {field.label}
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '36px' }}>
          {isEnabled ? (
            <input
              type={field.type === 'number' ? 'text' : field.type}
              className="form-input"
              value={field.type === 'date' ? toDateInputValue(overrideVal) : field.type === 'number' ? formatNumber(overrideVal) : overrideVal}
              onChange={(e) => {
                if (field.type === 'number') {
                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                  handleOverrideChange(field.key, raw);
                } else {
                  handleOverrideChange(field.key, e.target.value);
                }
              }}
              placeholder={inheritedVal ? `Inherited: ${formatInherited(field.inheritedKey, inheritedVal)}` : `Enter ${field.label.toLowerCase()}...`}
              style={{ flex: 1, fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
            />
          ) : (
            <span style={{
              fontSize: '0.85rem',
              color: inheritedVal ? '#374151' : '#9ca3af',
              fontStyle: inheritedVal ? 'normal' : 'italic',
            }}>
              {formatInherited(field.inheritedKey, inheritedVal)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleOverrideToggle(field.key, field.inheritedKey)}
          style={{
            background: isEnabled ? '#fef3c7' : 'none',
            border: isEnabled ? '1px solid #f59e0b' : '1px solid #d1d5db',
            borderRadius: '4px',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            color: isEnabled ? '#92400e' : '#6b7280',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title={isEnabled ? 'Click to use inherited value' : 'Click to override this value'}
        >
          {isEnabled ? 'Overridden' : 'Override'}
        </button>
      </div>
    );
  };

  return (
    <div className="container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/case-studies" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Case Studies
            </Link>
            <h1>{isEditMode ? 'Edit Case Study' : 'Create Case Study'}</h1>
            <div className="sales-subtitle">{isEditMode ? 'Update case study details' : 'Add a new success story'}</div>
          </div>
        </div>
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

        {/* Contact & Project Details */}
        {hasCustomerOrProject && (
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1rem', fontWeight: 600 }}>
              Contact & Project Details
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: 0, marginBottom: '1rem' }}>
              Values are inherited from the selected customer/project. Click "Override" to customize for this case study.
            </p>

            {formData.customer_id && (
              <>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem',
                  marginTop: '0.25rem',
                }}>
                  Customer Contact
                </div>
                {contactFields.map(renderOverrideRow)}
              </>
            )}

            {formData.project_id && (
              <>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem',
                  marginTop: formData.customer_id ? '1rem' : '0.25rem',
                }}>
                  Project Details
                </div>
                {projectFields.map(renderOverrideRow)}
              </>
            )}
          </div>
        )}

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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Market</label>
              <select
                name="market"
                className="form-input"
                value={formData.market}
                onChange={handleChange}
              >
                <option value="">Select Market</option>
                {MARKETS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
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
                <option value="Small">Small (&lt;$1M)</option>
                <option value="Medium">Medium ($1M-$5M)</option>
                <option value="Large">Large ($5M+)</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label className="form-label">Construction Type</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem 1.5rem',
            }}>
              {['New Construction', 'Renovation', 'Retrofit', 'Addition', 'Service'].map(type => (
                <label
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '0.35rem 0',
                    fontSize: '0.9rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.construction_type.includes(type)}
                    onChange={() => handleConstructionTypeToggle(type)}
                    style={{ marginRight: '0.5rem', width: '16px', height: '16px' }}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Services Provided */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1rem', fontWeight: 600 }}>
            Services Provided
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: 0, marginBottom: '1rem' }}>
            Select all services that were provided on this project
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem 1.5rem',
          }}>
            {services.map(service => (
              <label
                key={service}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '0.35rem 0',
                  fontSize: '0.9rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.services_provided.includes(service)}
                  onChange={() => handleServiceToggle(service)}
                  style={{ marginRight: '0.5rem', width: '16px', height: '16px' }}
                />
                {service}
              </label>
            ))}
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
