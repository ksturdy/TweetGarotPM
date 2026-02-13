import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { proposalsApi } from '../../services/proposals';
import { proposalTemplatesApi } from '../../services/proposalTemplates';
import { customersApi } from '../../services/customers';
import { caseStudiesApi } from '../../services/caseStudies';
import { serviceOfferingsApi } from '../../services/serviceOfferings';
import { employeeResumesApi } from '../../services/employeeResumes';
import './ProposalCreate.css';
import '../../styles/SalesPipeline.css';

const ProposalCreate: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    template_id: '',
    customer_id: '',
    title: '',
    project_name: '',
    project_location: '',
    executive_summary: '',
    company_overview: '',
    scope_of_work: '',
    approach_and_methodology: '',
    total_amount: '',
    payment_terms: '',
    terms_and_conditions: '',
    valid_until: '',
  });

  const [selectedCaseStudyIds, setSelectedCaseStudyIds] = useState<number[]>([]);
  const [selectedServiceOfferingIds, setSelectedServiceOfferingIds] = useState<number[]>([]);
  const [selectedResumeIds, setSelectedResumeIds] = useState<number[]>([]);
  const [csSearch, setCsSearch] = useState('');
  const [soSearch, setSoSearch] = useState('');
  const [resumeSearch, setResumeSearch] = useState('');

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['proposalTemplates'],
    queryFn: async () => {
      const response = await proposalTemplatesApi.getAll({ is_active: true });
      return response.data;
    },
  });

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await customersApi.getAll();
      return response;
    },
  });

  // Fetch published case studies
  const { data: caseStudies = [] } = useQuery({
    queryKey: ['caseStudies', { status: 'published' }],
    queryFn: async () => {
      const response = await caseStudiesApi.getAll({ status: 'published' });
      return response.data;
    },
  });

  // Fetch active service offerings
  const { data: serviceOfferings = [] } = useQuery({
    queryKey: ['serviceOfferings', { is_active: true }],
    queryFn: async () => {
      const response = await serviceOfferingsApi.getAll({ is_active: true });
      return response.data;
    },
  });

  // Fetch active resumes
  const { data: resumes = [] } = useQuery({
    queryKey: ['employeeResumes', { is_active: true }],
    queryFn: async () => {
      const response = await employeeResumesApi.getAll({ is_active: true });
      return response.data;
    },
  });

  const toggleCaseStudy = (id: number) => {
    setSelectedCaseStudyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleServiceOffering = (id: number) => {
    setSelectedServiceOfferingIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleResume = (id: number) => {
    setSelectedResumeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.template_id) {
        return proposalsApi.createFromTemplate(parseInt(data.template_id), data);
      }
      return proposalsApi.create(data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      navigate(`/proposals/${response.data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      ...formData,
      customer_id: formData.customer_id ? parseInt(formData.customer_id) : undefined,
      template_id: formData.template_id ? parseInt(formData.template_id) : undefined,
      total_amount: formData.total_amount ? parseFloat(formData.total_amount) : undefined,
    };

    // Remove empty strings
    Object.keys(data).forEach((key) => {
      if (data[key] === '') {
        delete data[key];
      }
    });

    // Include selected attachments
    if (selectedCaseStudyIds.length > 0) data.case_study_ids = selectedCaseStudyIds;
    if (selectedServiceOfferingIds.length > 0) data.service_offering_ids = selectedServiceOfferingIds;
    if (selectedResumeIds.length > 0) data.resume_ids = selectedResumeIds;

    createMutation.mutate(data);
  };

  return (
    <div className="proposal-create">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/proposals" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Proposals
            </Link>
            <h1>📝 Create New Proposal</h1>
            <div className="sales-subtitle">Fill in the details to create a draft proposal</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        {/* Template Selection */}
        <div className="card">
          <h2 className="section-title">Start from Template (Optional)</h2>
          <div className="form-group">
            <label>Proposal Template</label>
            <select
              className="input"
              value={formData.template_id}
              onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
            >
              <option value="">Blank Proposal</option>
              {templates.map((template: any) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <p className="help-text">
              Selecting a template will pre-fill sections with default content
            </p>
          </div>
        </div>

        {/* Basic Information */}
        <div className="card">
          <h2 className="section-title">Basic Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>
                Customer <span className="required">*</span>
              </label>
              <select
                className="input"
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                required
              >
                <option value="">Select Customer</option>
                {customers.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_facility}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                Proposal Title <span className="required">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., HVAC System Upgrade Proposal"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                className="input"
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                placeholder="e.g., Main Building HVAC Retrofit"
              />
            </div>

            <div className="form-group">
              <label>Project Location</label>
              <input
                type="text"
                className="input"
                value={formData.project_location}
                onChange={(e) =>
                  setFormData({ ...formData, project_location: e.target.value })
                }
                placeholder="e.g., 123 Main St, Phoenix, AZ"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Total Amount</label>
              <input
                type="number"
                className="input"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Valid Until</label>
              <input
                type="date"
                className="input"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Content Sections */}
        {!formData.template_id && (
          <>
            <div className="card">
              <h2 className="section-title">Executive Summary</h2>
              <div className="form-group">
                <textarea
                  className="input"
                  value={formData.executive_summary}
                  onChange={(e) =>
                    setFormData({ ...formData, executive_summary: e.target.value })
                  }
                  rows={4}
                  placeholder="Brief overview of the proposal..."
                />
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Company Overview</h2>
              <div className="form-group">
                <textarea
                  className="input"
                  value={formData.company_overview}
                  onChange={(e) =>
                    setFormData({ ...formData, company_overview: e.target.value })
                  }
                  rows={4}
                  placeholder="Information about your company..."
                />
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Scope of Work</h2>
              <div className="form-group">
                <textarea
                  className="input"
                  value={formData.scope_of_work}
                  onChange={(e) => setFormData({ ...formData, scope_of_work: e.target.value })}
                  rows={6}
                  placeholder="Detailed description of work to be performed..."
                />
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Terms & Conditions</h2>
              <div className="form-group">
                <textarea
                  className="input"
                  value={formData.terms_and_conditions}
                  onChange={(e) =>
                    setFormData({ ...formData, terms_and_conditions: e.target.value })
                  }
                  rows={4}
                  placeholder="Payment terms, warranties, exclusions..."
                />
              </div>
            </div>
          </>
        )}

        {/* Attached Case Studies */}
        <div className="card">
          <h2 className="section-title">Case Studies ({selectedCaseStudyIds.length} selected)</h2>
          <p className="help-text">Select published case studies to include in this proposal</p>
          <input
            type="text"
            className="input search-input"
            placeholder="Search case studies..."
            value={csSearch}
            onChange={(e) => setCsSearch(e.target.value)}
          />
          <div className="attachment-checklist">
            {caseStudies
              .filter((cs: any) =>
                !csSearch || cs.title?.toLowerCase().includes(csSearch.toLowerCase()) ||
                cs.customer_name?.toLowerCase().includes(csSearch.toLowerCase()) ||
                cs.market?.toLowerCase().includes(csSearch.toLowerCase())
              )
              .map((cs: any) => (
              <label key={cs.id} className={`attachment-item ${selectedCaseStudyIds.includes(cs.id) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedCaseStudyIds.includes(cs.id)}
                  onChange={() => toggleCaseStudy(cs.id)}
                />
                <div className="attachment-info">
                  <div className="attachment-name">{cs.title}</div>
                  <div className="attachment-meta">
                    {cs.customer_name}{cs.market ? ` | ${cs.market}` : ''}
                  </div>
                </div>
              </label>
            ))}
            {caseStudies.length === 0 && (
              <p className="empty-text">No published case studies available</p>
            )}
          </div>
        </div>

        {/* Attached Service Offerings */}
        <div className="card">
          <h2 className="section-title">Service Offerings ({selectedServiceOfferingIds.length} selected)</h2>
          <p className="help-text">Select service offerings to include in this proposal</p>
          <input
            type="text"
            className="input search-input"
            placeholder="Search service offerings..."
            value={soSearch}
            onChange={(e) => setSoSearch(e.target.value)}
          />
          <div className="attachment-checklist">
            {serviceOfferings
              .filter((so: any) =>
                !soSearch || so.name?.toLowerCase().includes(soSearch.toLowerCase()) ||
                so.category?.toLowerCase().includes(soSearch.toLowerCase()) ||
                so.description?.toLowerCase().includes(soSearch.toLowerCase())
              )
              .map((so: any) => (
              <label key={so.id} className={`attachment-item ${selectedServiceOfferingIds.includes(so.id) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedServiceOfferingIds.includes(so.id)}
                  onChange={() => toggleServiceOffering(so.id)}
                />
                <div className="attachment-info">
                  <div className="attachment-name">{so.name}</div>
                  <div className="attachment-meta">{so.category || 'General'}</div>
                </div>
              </label>
            ))}
            {serviceOfferings.length === 0 && (
              <p className="empty-text">No active service offerings available</p>
            )}
          </div>
        </div>

        {/* Attached Team Resumes */}
        <div className="card">
          <h2 className="section-title">Team Resumes ({selectedResumeIds.length} selected)</h2>
          <p className="help-text">Select team member resumes to include in this proposal</p>
          <input
            type="text"
            className="input search-input"
            placeholder="Search by name or title..."
            value={resumeSearch}
            onChange={(e) => setResumeSearch(e.target.value)}
          />
          <div className="attachment-checklist">
            {resumes
              .filter((r: any) =>
                !resumeSearch || r.employee_name?.toLowerCase().includes(resumeSearch.toLowerCase()) ||
                r.job_title?.toLowerCase().includes(resumeSearch.toLowerCase())
              )
              .map((r: any) => (
              <label key={r.id} className={`attachment-item ${selectedResumeIds.includes(r.id) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedResumeIds.includes(r.id)}
                  onChange={() => toggleResume(r.id)}
                />
                <div className="attachment-info">
                  <div className="attachment-name">{r.employee_name}</div>
                  <div className="attachment-meta">{r.job_title}</div>
                </div>
              </label>
            ))}
            {resumes.length === 0 && (
              <p className="empty-text">No active resumes available</p>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" className="btnSecondary" onClick={() => navigate('/proposals')}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Proposal'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProposalCreate;
