import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { proposalsApi } from '../../services/proposals';
import { proposalTemplatesApi } from '../../services/proposalTemplates';
import { customersApi } from '../../services/customers';
import { caseStudiesApi } from '../../services/caseStudies';
import { serviceOfferingsApi } from '../../services/serviceOfferings';
import { employeeResumesApi } from '../../services/employeeResumes';
import './ProposalWizard.css';

const STEPS = [
  { label: 'Template', key: 'template' },
  { label: 'Details', key: 'details' },
  { label: 'Content', key: 'content' },
  { label: 'Attachments', key: 'attachments' },
  { label: 'Review', key: 'review' },
];

const ProposalWizard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [validationError, setValidationError] = useState('');

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    project_name: '',
    project_location: '',
    total_amount: '',
    valid_until: '',
    payment_terms: '',
  });

  // Content state (for blank proposals)
  const [content, setContent] = useState({
    executive_summary: '',
    company_overview: '',
    scope_of_work: '',
    approach_and_methodology: '',
    terms_and_conditions: '',
  });

  // Template section overrides (for template proposals)
  const [sectionOverrides, setSectionOverrides] = useState<Record<number, string>>({});

  // Attachment state
  const [selectedCaseStudyIds, setSelectedCaseStudyIds] = useState<number[]>([]);
  const [selectedServiceOfferingIds, setSelectedServiceOfferingIds] = useState<number[]>([]);
  const [selectedResumeIds, setSelectedResumeIds] = useState<number[]>([]);
  const [csSearch, setCsSearch] = useState('');
  const [soSearch, setSoSearch] = useState('');
  const [resumeSearch, setResumeSearch] = useState('');

  // Data queries
  const { data: templates = [] } = useQuery({
    queryKey: ['proposalTemplates'],
    queryFn: async () => {
      const response = await proposalTemplatesApi.getAll({ is_active: true });
      return response.data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await customersApi.getAll();
      return response;
    },
  });

  const selectedTemplate = templates.find((t: any) => t.id === selectedTemplateId);

  // Fetch full template with sections when one is selected
  const { data: templateDetail } = useQuery({
    queryKey: ['proposalTemplate', selectedTemplateId],
    queryFn: async () => {
      const response = await proposalTemplatesApi.getById(selectedTemplateId!);
      return response.data;
    },
    enabled: !!selectedTemplateId,
  });

  const { data: caseStudies = [] } = useQuery({
    queryKey: ['caseStudies', { status: 'published' }],
    queryFn: async () => {
      const response = await caseStudiesApi.getAll({ status: 'published' });
      return response.data;
    },
  });

  const { data: serviceOfferings = [] } = useQuery({
    queryKey: ['serviceOfferings', { is_active: true }],
    queryFn: async () => {
      const response = await serviceOfferingsApi.getAll({ is_active: true });
      return response.data;
    },
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ['employeeResumes', { is_active: true }],
    queryFn: async () => {
      const response = await employeeResumesApi.getAll({ is_active: true });
      return response.data;
    },
  });

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

  // Toggle helpers
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

  // Validation
  const canAdvance = () => {
    if (currentStep === 1) {
      if (!formData.customer_id || !formData.title) {
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    setValidationError('');
    if (currentStep === 1) {
      if (!formData.customer_id) {
        setValidationError('Please select a customer.');
        return;
      }
      if (!formData.title.trim()) {
        setValidationError('Please enter a proposal title.');
        return;
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setValidationError('');
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = () => {
    const data: any = {
      ...formData,
      customer_id: formData.customer_id ? parseInt(formData.customer_id) : undefined,
      total_amount: formData.total_amount ? parseFloat(formData.total_amount) : undefined,
    };

    if (selectedTemplateId) {
      data.template_id = selectedTemplateId;
    } else {
      // Include content for blank proposals
      Object.assign(data, content);
    }

    // Remove empty strings
    Object.keys(data).forEach((key) => {
      if (data[key] === '') delete data[key];
    });

    // Include attachments
    if (selectedCaseStudyIds.length > 0) data.case_study_ids = selectedCaseStudyIds;
    if (selectedServiceOfferingIds.length > 0) data.service_offering_ids = selectedServiceOfferingIds;
    if (selectedResumeIds.length > 0) data.resume_ids = selectedResumeIds;

    createMutation.mutate(data);
  };

  // Get customer name for review
  const selectedCustomer = customers.find((c: any) => c.id === parseInt(formData.customer_id));

  // Render steps
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderTemplateStep();
      case 1:
        return renderDetailsStep();
      case 2:
        return renderContentStep();
      case 3:
        return renderAttachmentsStep();
      case 4:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const renderTemplateStep = () => (
    <div>
      <h2 className="step-title">Choose a Template</h2>
      <p className="step-description">
        Select a template to pre-fill your proposal, or start with a blank proposal.
      </p>
      <div className="template-grid">
        <div
          className={`template-card ${selectedTemplateId === null ? 'selected' : ''}`}
          onClick={() => setSelectedTemplateId(null)}
        >
          <div className="template-name">Blank Proposal</div>
          <div className="template-category">Custom</div>
          <div className="template-description">
            Start from scratch with empty content sections you fill in yourself.
          </div>
        </div>
        {templates.map((template: any) => (
          <div
            key={template.id}
            className={`template-card ${selectedTemplateId === template.id ? 'selected' : ''}`}
            onClick={() => setSelectedTemplateId(template.id)}
          >
            <div className="template-name">{template.name}</div>
            <div className="template-category">{template.category || 'General'}</div>
            <div className="template-description">
              {template.description || 'Pre-built template with standard sections.'}
            </div>
            {template.section_count > 0 && (
              <div className="template-sections">
                {template.section_count} section{template.section_count !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailsStep = () => (
    <div>
      <h2 className="step-title">Project Details</h2>
      <p className="step-description">
        Enter the customer and project information for this proposal.
      </p>

      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label>
              Customer <span className="required">*</span>
            </label>
            <select
              className="input"
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, project_location: e.target.value })}
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

        <div className="form-row">
          <div className="form-group full-width">
            <label>Payment Terms</label>
            <input
              type="text"
              className="input"
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              placeholder="e.g., Net 30, 50% upfront"
            />
          </div>
        </div>
      </div>

      {validationError && <p className="error-text">{validationError}</p>}
    </div>
  );

  const renderContentStep = () => (
    <div>
      <h2 className="step-title">Proposal Content</h2>
      {selectedTemplateId ? (
        <>
          <p className="step-description">
            These sections come from the "{selectedTemplate?.name}" template.
            Placeholders like {'{{customer_name}}'} will be auto-filled when the proposal is created.
            You can edit sections after creation.
          </p>

          {/* Template default fields preview */}
          {templateDetail?.default_executive_summary && (
            <div className="card">
              <h3 className="section-title">Executive Summary</h3>
              <div className="review-content-preview" style={{ maxHeight: 'none' }}>
                {templateDetail.default_executive_summary}
              </div>
            </div>
          )}

          {templateDetail?.default_company_overview && (
            <div className="card">
              <h3 className="section-title">Company Overview</h3>
              <div className="review-content-preview" style={{ maxHeight: 'none' }}>
                {templateDetail.default_company_overview}
              </div>
            </div>
          )}

          {/* Template sections preview */}
          {templateDetail?.sections?.map((section: any) => (
            <div key={section.id} className="card">
              <h3 className="section-title">{section.title}</h3>
              <div className="review-content-preview" style={{ maxHeight: 'none' }}>
                {sectionOverrides[section.id] !== undefined
                  ? sectionOverrides[section.id]
                  : section.content}
              </div>
            </div>
          ))}

          {templateDetail?.default_terms_and_conditions && (
            <div className="card">
              <h3 className="section-title">Terms & Conditions</h3>
              <div className="review-content-preview" style={{ maxHeight: 'none' }}>
                {templateDetail.default_terms_and_conditions}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="step-description">
            Write the content for your proposal. All fields are optional at this stage — you can edit them later.
          </p>

          <div className="card">
            <h3 className="section-title">Executive Summary</h3>
            <div className="form-group">
              <textarea
                className="input"
                value={content.executive_summary}
                onChange={(e) => setContent({ ...content, executive_summary: e.target.value })}
                rows={4}
                placeholder="Brief overview of the proposal..."
              />
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Company Overview</h3>
            <div className="form-group">
              <textarea
                className="input"
                value={content.company_overview}
                onChange={(e) => setContent({ ...content, company_overview: e.target.value })}
                rows={4}
                placeholder="Information about your company..."
              />
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Scope of Work</h3>
            <div className="form-group">
              <textarea
                className="input"
                value={content.scope_of_work}
                onChange={(e) => setContent({ ...content, scope_of_work: e.target.value })}
                rows={6}
                placeholder="Detailed description of work to be performed..."
              />
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Approach & Methodology</h3>
            <div className="form-group">
              <textarea
                className="input"
                value={content.approach_and_methodology}
                onChange={(e) => setContent({ ...content, approach_and_methodology: e.target.value })}
                rows={4}
                placeholder="How you plan to execute the work..."
              />
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Terms & Conditions</h3>
            <div className="form-group">
              <textarea
                className="input"
                value={content.terms_and_conditions}
                onChange={(e) => setContent({ ...content, terms_and_conditions: e.target.value })}
                rows={4}
                placeholder="Payment terms, warranties, exclusions..."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderAttachmentsStep = () => (
    <div>
      <h2 className="step-title">Attachments</h2>
      <p className="step-description">
        Select case studies, service offerings, and team resumes to include with this proposal.
      </p>

      {/* Case Studies */}
      <div className="card">
        <h3 className="section-title">Case Studies ({selectedCaseStudyIds.length} selected)</h3>
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

      {/* Service Offerings */}
      <div className="card">
        <h3 className="section-title">Service Offerings ({selectedServiceOfferingIds.length} selected)</h3>
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

      {/* Resumes */}
      <div className="card">
        <h3 className="section-title">Team Resumes ({selectedResumeIds.length} selected)</h3>
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
    </div>
  );

  const renderReviewStep = () => (
    <div>
      <h2 className="step-title">Review & Create</h2>
      <p className="step-description">
        Review your proposal details before creating it.
      </p>

      {/* Template info */}
      <div className="card">
        <h3 className="section-title">Template</h3>
        <div className="review-value">
          {selectedTemplate ? selectedTemplate.name : 'Blank Proposal'}
          {selectedTemplate?.category && (
            <span style={{ color: '#6b7280', marginLeft: 8 }}>({selectedTemplate.category})</span>
          )}
        </div>
      </div>

      {/* Project details */}
      <div className="card">
        <h3 className="section-title">Project Details</h3>
        <div className="review-grid">
          <div className="review-item">
            <div className="review-label">Customer</div>
            <div className="review-data">{selectedCustomer?.customer_facility || '—'}</div>
          </div>
          <div className="review-item">
            <div className="review-label">Title</div>
            <div className="review-data">{formData.title || '—'}</div>
          </div>
          {formData.project_name && (
            <div className="review-item">
              <div className="review-label">Project Name</div>
              <div className="review-data">{formData.project_name}</div>
            </div>
          )}
          {formData.project_location && (
            <div className="review-item">
              <div className="review-label">Location</div>
              <div className="review-data">{formData.project_location}</div>
            </div>
          )}
          {formData.total_amount && (
            <div className="review-item">
              <div className="review-label">Amount</div>
              <div className="review-data">${parseFloat(formData.total_amount).toLocaleString()}</div>
            </div>
          )}
          {formData.valid_until && (
            <div className="review-item">
              <div className="review-label">Valid Until</div>
              <div className="review-data">{new Date(formData.valid_until).toLocaleDateString()}</div>
            </div>
          )}
          {formData.payment_terms && (
            <div className="review-item">
              <div className="review-label">Payment Terms</div>
              <div className="review-data">{formData.payment_terms}</div>
            </div>
          )}
        </div>
      </div>

      {/* Content preview */}
      {!selectedTemplateId && (content.executive_summary || content.scope_of_work) && (
        <div className="card">
          <h3 className="section-title">Content Preview</h3>
          {content.executive_summary && (
            <div className="review-section">
              <h3>Executive Summary</h3>
              <div className="review-content-preview">{content.executive_summary}</div>
            </div>
          )}
          {content.scope_of_work && (
            <div className="review-section">
              <h3>Scope of Work</h3>
              <div className="review-content-preview">{content.scope_of_work}</div>
            </div>
          )}
        </div>
      )}

      {selectedTemplateId && templateDetail?.sections && templateDetail.sections.length > 0 && (
        <div className="card">
          <h3 className="section-title">Template Sections</h3>
          <div className="review-value" style={{ color: '#6b7280' }}>
            {templateDetail.sections.length} section{templateDetail.sections.length !== 1 ? 's' : ''} from "{selectedTemplate?.name}" — placeholders will be auto-filled
          </div>
        </div>
      )}

      {/* Attachments summary */}
      {(selectedCaseStudyIds.length > 0 || selectedServiceOfferingIds.length > 0 || selectedResumeIds.length > 0) && (
        <div className="card">
          <h3 className="section-title">Attachments</h3>

          {selectedCaseStudyIds.length > 0 && (
            <div className="review-section">
              <h3>Case Studies ({selectedCaseStudyIds.length})</h3>
              <div className="review-attachments">
                {selectedCaseStudyIds.map(id => {
                  const cs = caseStudies.find((c: any) => c.id === id);
                  return cs ? <span key={id} className="review-tag">{cs.title}</span> : null;
                })}
              </div>
            </div>
          )}

          {selectedServiceOfferingIds.length > 0 && (
            <div className="review-section">
              <h3>Service Offerings ({selectedServiceOfferingIds.length})</h3>
              <div className="review-attachments">
                {selectedServiceOfferingIds.map(id => {
                  const so = serviceOfferings.find((s: any) => s.id === id);
                  return so ? <span key={id} className="review-tag">{so.name}</span> : null;
                })}
              </div>
            </div>
          )}

          {selectedResumeIds.length > 0 && (
            <div className="review-section">
              <h3>Team Resumes ({selectedResumeIds.length})</h3>
              <div className="review-attachments">
                {selectedResumeIds.map(id => {
                  const r = resumes.find((res: any) => res.id === id);
                  return r ? <span key={id} className="review-tag">{r.employee_name}</span> : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {createMutation.isError && (
        <p className="error-text">
          Failed to create proposal. Please try again.
        </p>
      )}
    </div>
  );

  return (
    <div className="wizard-container">
      {/* Header */}
      <div className="wizard-header">
        <button className="breadcrumb-link" onClick={() => navigate('/proposals')}>
          ← Back to Proposals
        </button>
        <h1 className="page-title">Create New Proposal</h1>
        <p className="page-subtitle">Follow the steps below to build your proposal</p>
      </div>

      {/* Step Indicator */}
      <div className="step-indicator">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <div className={`step-connector ${index <= currentStep ? 'completed' : ''}`} />
            )}
            <div
              className={`step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
              onClick={() => {
                // Allow clicking back to completed steps
                if (index < currentStep) setCurrentStep(index);
              }}
            >
              <div className="step-circle">
                {index < currentStep ? '✓' : index + 1}
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="step-content">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="wizard-nav">
        <div className="wizard-nav-left">
          {currentStep > 0 && (
            <button className="btnSecondary" onClick={handleBack}>
              ← Back
            </button>
          )}
        </div>
        <div className="wizard-nav-right">
          <button className="btnSecondary" onClick={() => navigate('/proposals')}>
            Cancel
          </button>
          {currentStep < STEPS.length - 1 ? (
            <button className="btn" onClick={handleNext}>
              Next →
            </button>
          ) : (
            <button
              className="btn btn-success"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Proposal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalWizard;
