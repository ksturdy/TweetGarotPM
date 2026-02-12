import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { proposalsApi } from '../../services/proposals';
import { caseStudiesApi } from '../../services/caseStudies';
import { serviceOfferingsApi } from '../../services/serviceOfferings';
import { employeeResumesApi } from '../../services/employeeResumes';
import ProposalPreviewModal from '../../components/proposals/ProposalPreviewModal';
import './ProposalDetail.css';

const ProposalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true');
  const [showPreview, setShowPreview] = useState(false);
  const [csSearch, setCsSearch] = useState('');
  const [soSearch, setSoSearch] = useState('');
  const [resumeSearch, setResumeSearch] = useState('');

  // Fetch proposal
  const { data: proposal, isLoading } = useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      const response = await proposalsApi.getById(parseInt(id!));
      return response.data;
    },
    enabled: !!id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) =>
      proposalsApi.updateStatus(parseInt(id!), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  // Create revision mutation
  const createRevisionMutation = useMutation({
    mutationFn: () => proposalsApi.createRevision(parseInt(id!)),
    onSuccess: (data: any) => {
      navigate(`/proposals/${data.data.id}?edit=true`);
    },
  });

  // Attachment mutations
  const addCaseStudyMutation = useMutation({
    mutationFn: (caseStudyId: number) => proposalsApi.addCaseStudy(parseInt(id!), caseStudyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposal', id] }),
  });

  const removeCaseStudyMutation = useMutation({
    mutationFn: (caseStudyId: number) => proposalsApi.removeCaseStudy(parseInt(id!), caseStudyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposal', id] }),
  });

  const addServiceOfferingMutation = useMutation({
    mutationFn: (serviceOfferingId: number) => proposalsApi.addServiceOffering(parseInt(id!), serviceOfferingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposal', id] }),
  });

  const removeServiceOfferingMutation = useMutation({
    mutationFn: (serviceOfferingId: number) => proposalsApi.removeServiceOffering(parseInt(id!), serviceOfferingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposal', id] }),
  });

  const addResumeMutation = useMutation({
    mutationFn: (resumeId: number) => proposalsApi.addResume(parseInt(id!), resumeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposal', id] }),
  });

  const removeResumeMutation = useMutation({
    mutationFn: (resumeId: number) => proposalsApi.removeResume(parseInt(id!), resumeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposal', id] }),
  });

  // Fetch available items for editing
  const { data: availableCaseStudies = [] } = useQuery({
    queryKey: ['caseStudies', { status: 'published' }],
    queryFn: async () => {
      const response = await caseStudiesApi.getAll({ status: 'published' });
      return response.data;
    },
    enabled: isEditing,
  });

  const { data: availableServiceOfferings = [] } = useQuery({
    queryKey: ['serviceOfferings', { is_active: true }],
    queryFn: async () => {
      const response = await serviceOfferingsApi.getAll({ is_active: true });
      return response.data;
    },
    enabled: isEditing,
  });

  const { data: availableResumes = [] } = useQuery({
    queryKey: ['employeeResumes', { is_active: true }],
    queryFn: async () => {
      const response = await employeeResumesApi.getAll({ is_active: true });
      return response.data;
    },
    enabled: isEditing,
  });

  const handleStatusChange = (status: string) => {
    if (window.confirm(`Change proposal status to "${status}"?`)) {
      updateStatusMutation.mutate({ status });
    }
  };

  const handleCreateRevision = () => {
    if (window.confirm('Create a new revision of this proposal?')) {
      createRevisionMutation.mutate();
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getWorkflowActions = () => {
    if (!proposal) return [];

    const actions = [];

    if (proposal.status === 'draft') {
      actions.push({
        label: 'Submit for Review',
        status: 'pending_review',
        className: 'btn',
      });
    }

    if (proposal.status === 'pending_review') {
      actions.push({ label: 'Approve', status: 'approved', className: 'btn' });
      actions.push({ label: 'Back to Draft', status: 'draft', className: 'btnSecondary' });
    }

    if (proposal.status === 'approved') {
      actions.push({ label: 'Send to Customer', status: 'sent', className: 'btn' });
    }

    if (proposal.status === 'sent') {
      actions.push({ label: 'Mark Accepted', status: 'accepted', className: 'btn-success' });
      actions.push({ label: 'Mark Rejected', status: 'rejected', className: 'btn-danger' });
    }

    return actions;
  };

  if (isLoading) {
    return <div className="loading">Loading proposal...</div>;
  }

  if (!proposal) {
    return <div className="error">Proposal not found</div>;
  }

  return (
    <div className="proposal-detail">
      <div className="page-header">
        <div>
          <button className="breadcrumb-link" onClick={() => navigate('/proposals')}>
            ← Back to Proposals
          </button>
          <div className="title-row">
            <h1 className="page-title">{proposal.proposal_number}</h1>
            <span className={`status-badge status-${proposal.status}`}>
              {proposal.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <p className="page-subtitle">{proposal.title}</p>
        </div>
        <div className="header-actions">
          <button
            className="btn"
            onClick={() => setShowPreview(true)}
          >
            Preview / PDF
          </button>
          {proposal.status === 'draft' && (
            <button
              className="btnSecondary"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel Edit' : 'Edit'}
            </button>
          )}
          {!proposal.is_latest && (
            <span className="old-version-badge">Old Version</span>
          )}
          <button className="btnSecondary" onClick={handleCreateRevision}>
            Create Revision
          </button>
        </div>
      </div>

      {/* Workflow Actions */}
      {getWorkflowActions().length > 0 && (
        <div className="workflow-actions">
          {getWorkflowActions().map((action) => (
            <button
              key={action.status}
              className={action.className}
              onClick={() => handleStatusChange(action.status)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Info Cards */}
      <div className="info-grid">
        <div className="card info-card">
          <div className="info-label">Customer</div>
          <div className="info-value">{proposal.customer_name || 'Not specified'}</div>
        </div>
        <div className="card info-card">
          <div className="info-label">Project Name</div>
          <div className="info-value">{proposal.project_name || 'Not specified'}</div>
        </div>
        <div className="card info-card">
          <div className="info-label">Total Amount</div>
          <div className="info-value">{formatCurrency(proposal.total_amount)}</div>
        </div>
        <div className="card info-card">
          <div className="info-label">Valid Until</div>
          <div className="info-value">{formatDate(proposal.valid_until)}</div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="card">
        <h2 className="section-title">Executive Summary</h2>
        <div className="content-display">
          {proposal.executive_summary || 'No executive summary provided'}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Company Overview</h2>
        <div className="content-display">
          {proposal.company_overview || 'No company overview provided'}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Scope of Work</h2>
        <div className="content-display">
          {proposal.scope_of_work || 'No scope of work provided'}
        </div>
      </div>

      {proposal.approach_and_methodology && (
        <div className="card">
          <h2 className="section-title">Approach & Methodology</h2>
          <div className="content-display">{proposal.approach_and_methodology}</div>
        </div>
      )}

      {/* Additional Sections */}
      {proposal.sections && proposal.sections.length > 0 && (
        <div className="card">
          <h2 className="section-title">Additional Sections</h2>
          {proposal.sections.map((section: any, index: number) => (
            <div key={index} className="section-block">
              <h3 className="section-subtitle">{section.title}</h3>
              <div className="content-display">{section.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* Attached Case Studies */}
      {((proposal.case_studies && proposal.case_studies.length > 0) || isEditing) && (
        <div className="card">
          <h2 className="section-title">Case Studies ({proposal.case_studies?.length || 0})</h2>
          {!isEditing ? (
            <div className="attachment-list">
              {proposal.case_studies?.map((cs: any) => (
                <div key={cs.id} className="attachment-display-item">
                  <div className="attachment-name">{cs.title}</div>
                  <div className="attachment-meta">
                    {cs.customer_name}{cs.market ? ` | ${cs.market}` : ''}
                    {cs.project_value ? ` | $${Number(cs.project_value).toLocaleString()}` : ''}
                  </div>
                  {cs.notes && <div className="attachment-notes">{cs.notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <input
                type="text"
                className="input search-input"
                placeholder="Search case studies..."
                value={csSearch}
                onChange={(e) => setCsSearch(e.target.value)}
              />
              <div className="attachment-checklist">
                {availableCaseStudies
                  .filter((cs: any) =>
                    !csSearch || cs.title?.toLowerCase().includes(csSearch.toLowerCase()) ||
                    cs.customer_name?.toLowerCase().includes(csSearch.toLowerCase()) ||
                    cs.market?.toLowerCase().includes(csSearch.toLowerCase())
                  )
                  .map((cs: any) => {
                  const isAttached = proposal.case_studies?.some((a: any) => a.id === cs.id);
                  return (
                    <label key={cs.id} className={`attachment-item ${isAttached ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isAttached}
                        onChange={() => isAttached
                          ? removeCaseStudyMutation.mutate(cs.id)
                          : addCaseStudyMutation.mutate(cs.id)
                        }
                      />
                      <div className="attachment-info">
                        <div className="attachment-name">{cs.title}</div>
                        <div className="attachment-meta">
                          {cs.customer_name}{cs.market ? ` | ${cs.market}` : ''}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {availableCaseStudies.length === 0 && (
                  <p className="empty-text">No published case studies available</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Attached Service Offerings */}
      {((proposal.service_offerings && proposal.service_offerings.length > 0) || isEditing) && (
        <div className="card">
          <h2 className="section-title">Service Offerings ({proposal.service_offerings?.length || 0})</h2>
          {!isEditing ? (
            <div className="attachment-list">
              {proposal.service_offerings?.map((so: any) => (
                <div key={so.id} className="attachment-display-item">
                  <div className="attachment-name">{so.name}</div>
                  <div className="attachment-meta">{so.category || 'General'}</div>
                  {so.custom_description && <div className="attachment-notes">{so.custom_description}</div>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <input
                type="text"
                className="input search-input"
                placeholder="Search service offerings..."
                value={soSearch}
                onChange={(e) => setSoSearch(e.target.value)}
              />
              <div className="attachment-checklist">
                {availableServiceOfferings
                  .filter((so: any) =>
                    !soSearch || so.name?.toLowerCase().includes(soSearch.toLowerCase()) ||
                    so.category?.toLowerCase().includes(soSearch.toLowerCase()) ||
                    so.description?.toLowerCase().includes(soSearch.toLowerCase())
                  )
                  .map((so: any) => {
                  const isAttached = proposal.service_offerings?.some((a: any) => a.id === so.id);
                  return (
                    <label key={so.id} className={`attachment-item ${isAttached ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isAttached}
                        onChange={() => isAttached
                          ? removeServiceOfferingMutation.mutate(so.id)
                          : addServiceOfferingMutation.mutate(so.id)
                        }
                    />
                    <div className="attachment-info">
                      <div className="attachment-name">{so.name}</div>
                      <div className="attachment-meta">{so.category || 'General'}</div>
                    </div>
                  </label>
                );
              })}
              {availableServiceOfferings.length === 0 && (
                <p className="empty-text">No active service offerings available</p>
              )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Attached Resumes */}
      {((proposal.resumes && proposal.resumes.length > 0) || isEditing) && (
        <div className="card">
          <h2 className="section-title">Team Resumes ({proposal.resumes?.length || 0})</h2>
          {!isEditing ? (
            <div className="attachment-list">
              {proposal.resumes?.map((r: any) => (
                <div key={r.id} className="attachment-display-item">
                  <div className="attachment-name">{r.employee_name}</div>
                  <div className="attachment-meta">
                    {r.job_title}
                    {r.role_on_project ? ` | Role: ${r.role_on_project}` : ''}
                  </div>
                  {r.summary && <div className="attachment-notes">{r.summary}</div>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <input
                type="text"
                className="input search-input"
                placeholder="Search by name or title..."
                value={resumeSearch}
                onChange={(e) => setResumeSearch(e.target.value)}
              />
              <div className="attachment-checklist">
                {availableResumes
                  .filter((r: any) =>
                    !resumeSearch || r.employee_name?.toLowerCase().includes(resumeSearch.toLowerCase()) ||
                    r.job_title?.toLowerCase().includes(resumeSearch.toLowerCase())
                  )
                  .map((r: any) => {
                  const isAttached = proposal.resumes?.some((a: any) => a.id === r.id);
                return (
                  <label key={r.id} className={`attachment-item ${isAttached ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isAttached}
                      onChange={() => isAttached
                        ? removeResumeMutation.mutate(r.id)
                        : addResumeMutation.mutate(r.id)
                      }
                    />
                    <div className="attachment-info">
                      <div className="attachment-name">{r.employee_name}</div>
                      <div className="attachment-meta">{r.job_title}</div>
                    </div>
                  </label>
                );
              })}
              {availableResumes.length === 0 && (
                <p className="empty-text">No active resumes available</p>
              )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Terms & Conditions */}
      {proposal.terms_and_conditions && (
        <div className="card">
          <h2 className="section-title">Terms & Conditions</h2>
          <div className="content-display">{proposal.terms_and_conditions}</div>
        </div>
      )}

      {/* Metadata */}
      <div className="card">
        <h2 className="section-title">Proposal Information</h2>
        <div className="metadata-grid">
          <div>
            <strong>Created By:</strong> {proposal.created_by_name}
          </div>
          <div>
            <strong>Created:</strong> {formatDate(proposal.created_at)}
          </div>
          {proposal.approved_by_name && (
            <>
              <div>
                <strong>Approved By:</strong> {proposal.approved_by_name}
              </div>
              <div>
                <strong>Approved:</strong> {formatDate(proposal.approved_at)}
              </div>
            </>
          )}
          {proposal.sent_date && (
            <>
              <div>
                <strong>Sent By:</strong> {proposal.sent_by_name}
              </div>
              <div>
                <strong>Sent:</strong> {formatDate(proposal.sent_date)}
              </div>
            </>
          )}
          {proposal.accepted_date && (
            <div>
              <strong>Accepted:</strong> {formatDate(proposal.accepted_date)}
            </div>
          )}
          <div>
            <strong>Version:</strong> {proposal.version_number}
          </div>
          {proposal.template_name && (
            <div>
              <strong>Template:</strong> {proposal.template_name}
            </div>
          )}
        </div>
      </div>
      {/* Preview Modal */}
      <ProposalPreviewModal
        proposal={proposal}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
};

export default ProposalDetail;
