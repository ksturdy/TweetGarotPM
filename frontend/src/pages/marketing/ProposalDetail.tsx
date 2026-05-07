import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { proposalsApi } from '../../services/proposals';
import { caseStudiesApi } from '../../services/caseStudies';
import { employeeResumesApi } from '../../services/employeeResumes';
import { sellSheetsApi } from '../../services/sellSheets';
import { orgChartsApi } from '../../services/orgCharts';
import { customersApi } from '../../services/customers';
import CompanyPicker from '../../components/CompanyPicker';
import { MARKETS } from '../../constants/markets';
import { CONSTRUCTION_TYPES } from '../../constants/constructionTypes';
import ProposalPreviewModal from '../../components/proposals/ProposalPreviewModal';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import './ProposalDetail.css';
import '../../styles/SalesPipeline.css';

const ProposalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, toast } = useTitanFeedback();
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true');
  const [showPreview, setShowPreview] = useState(false);
  const [csSearch, setCsSearch] = useState('');
  const [ssSearch, setSsSearch] = useState('');
  const [resumeSearch, setResumeSearch] = useState('');
  const [ocSearch, setOcSearch] = useState('');
  const [scopeDraft, setScopeDraft] = useState('');
  const [detailsDraft, setDetailsDraft] = useState({
    customer_id: '' as string | number,
    customer_name: '',
    project_name: '',
    project_location: '',
    market: '',
    construction_type: '',
    total_amount: '',
    valid_until: '',
    payment_terms: '',
  });

  // Customers for the picker (only when editing)
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await customersApi.getAll();
      return response;
    },
    enabled: isEditing,
  });

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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => proposalsApi.delete(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      navigate('/proposals');
    },
  });

  const handleDelete = async () => {
    if (!proposal) return;
    const ok = await confirm({
      message: `Are you sure you want to delete proposal "${proposal.proposal_number}"? This cannot be undone.`,
      danger: true,
    });
    if (ok) {
      deleteMutation.mutate();
    }
  };

  // Update proposal fields (Scope of Work, etc.)
  const updateProposalMutation = useMutation({
    mutationFn: (data: any) => proposalsApi.update(parseInt(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Saved');
    },
    onError: () => {
      toast.error('Failed to save changes');
    },
  });

  // Sync local edit drafts when proposal loads or edit mode toggles
  useEffect(() => {
    if (proposal) {
      setScopeDraft(proposal.scope_of_work || '');
      setDetailsDraft({
        customer_id: proposal.customer_id || '',
        customer_name: proposal.customer_name || '',
        project_name: proposal.project_name || '',
        project_location: proposal.project_location || '',
        market: proposal.market || '',
        construction_type: proposal.construction_type || '',
        total_amount: proposal.total_amount != null ? String(proposal.total_amount) : '',
        valid_until: proposal.valid_until ? proposal.valid_until.slice(0, 10) : '',
        payment_terms: proposal.payment_terms || '',
      });
    }
  }, [proposal?.id, isEditing]);

  const detailsDirty = !!proposal && (
    String(detailsDraft.customer_id || '') !== String(proposal.customer_id || '') ||
    detailsDraft.project_name !== (proposal.project_name || '') ||
    detailsDraft.project_location !== (proposal.project_location || '') ||
    detailsDraft.market !== (proposal.market || '') ||
    detailsDraft.construction_type !== (proposal.construction_type || '') ||
    detailsDraft.total_amount !== (proposal.total_amount != null ? String(proposal.total_amount) : '') ||
    detailsDraft.valid_until !== (proposal.valid_until ? proposal.valid_until.slice(0, 10) : '') ||
    detailsDraft.payment_terms !== (proposal.payment_terms || '')
  );

  const handleSaveDetails = () => {
    updateProposalMutation.mutate({
      customer_id: detailsDraft.customer_id ? Number(detailsDraft.customer_id) : null,
      project_name: detailsDraft.project_name || null,
      project_location: detailsDraft.project_location || null,
      market: detailsDraft.market || null,
      construction_type: detailsDraft.construction_type || null,
      total_amount: detailsDraft.total_amount ? parseFloat(detailsDraft.total_amount) : null,
      valid_until: detailsDraft.valid_until || null,
      payment_terms: detailsDraft.payment_terms || null,
    });
  };

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

  const addSellSheetMutation = useMutation({
    mutationFn: (sellSheetId: number) => proposalsApi.addSellSheet(parseInt(id!), sellSheetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposal', id] }),
  });

  const removeSellSheetMutation = useMutation({
    mutationFn: (sellSheetId: number) => proposalsApi.removeSellSheet(parseInt(id!), sellSheetId),
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

  const addOrgChartMutation = useMutation({
    mutationFn: (orgChartId: number) => proposalsApi.addOrgChart(parseInt(id!), orgChartId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposal', id] }),
  });

  const removeOrgChartMutation = useMutation({
    mutationFn: (orgChartId: number) => proposalsApi.removeOrgChart(parseInt(id!), orgChartId),
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

  const { data: availableSellSheets = [] } = useQuery({
    queryKey: ['sellSheets', { status: 'published' }],
    queryFn: async () => {
      const response = await sellSheetsApi.getAll({ status: 'published' });
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

  const { data: availableOrgCharts = [] } = useQuery({
    queryKey: ['org-charts'],
    queryFn: () => orgChartsApi.getAll(),
    enabled: isEditing,
  });

  const handleStatusChange = async (status: string) => {
    const ok = await confirm(`Change proposal status to "${status}"?`);
    if (ok) {
      updateStatusMutation.mutate({ status });
    }
  };

  const handleCreateRevision = async () => {
    const ok = await confirm('Create a new revision of this proposal?');
    if (ok) {
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
    const parsed = dateString.includes('T') ? dateString : dateString + 'T00:00:00';
    return new Date(parsed).toLocaleDateString('en-US', {
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
        label: 'Publish',
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
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/proposals" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Proposals
            </Link>
            <h1>📝 {proposal.proposal_number}</h1>
            <div className="sales-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>{proposal.title}</span>
              <span className={`status-badge status-${proposal.status}`}>
                {proposal.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
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
          {isEditing && (
            <button
              className="btn-danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Proposal'}
            </button>
          )}
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

      {/* Info Cards / Editable Project Details */}
      {!isEditing ? (
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
            <div className="info-label">Market</div>
            <div className="info-value">{proposal.market || 'Not specified'}</div>
          </div>
          <div className="card info-card">
            <div className="info-label">Construction Type</div>
            <div className="info-value">{proposal.construction_type || 'Not specified'}</div>
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
      ) : (
        <div className="card">
          <h2 className="section-title">Project Details</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Customer</label>
              <CompanyPicker
                companies={customers.map((c: any) => ({
                  id: c.id,
                  name: c.name || c.customer_facility || c.customer_owner || '',
                  customer_type: c.customer_type,
                }))}
                selectedId={detailsDraft.customer_id}
                textValue={detailsDraft.customer_name}
                onSelectCompany={(cid, name) =>
                  setDetailsDraft((prev) => ({ ...prev, customer_id: cid, customer_name: name }))
                }
                onManualEntry={(name) =>
                  setDetailsDraft((prev) => ({ ...prev, customer_id: '', customer_name: name }))
                }
                onClear={() =>
                  setDetailsDraft((prev) => ({ ...prev, customer_id: '', customer_name: '' }))
                }
                onProspectCreated={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                placeholder="Search customers..."
              />
            </div>
            <div className="form-group">
              <label>Market</label>
              <select
                className="input"
                value={detailsDraft.market}
                onChange={(e) => setDetailsDraft({ ...detailsDraft, market: e.target.value })}
              >
                <option value="">Select market…</option>
                {MARKETS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.icon} {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Construction Type</label>
              <select
                className="input"
                value={detailsDraft.construction_type}
                onChange={(e) => setDetailsDraft({ ...detailsDraft, construction_type: e.target.value })}
              >
                <option value="">Select construction type…</option>
                {CONSTRUCTION_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                className="input"
                value={detailsDraft.project_name}
                onChange={(e) => setDetailsDraft({ ...detailsDraft, project_name: e.target.value })}
                placeholder="e.g., Main Building HVAC Retrofit"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Project Location</label>
              <input
                type="text"
                className="input"
                value={detailsDraft.project_location}
                onChange={(e) => setDetailsDraft({ ...detailsDraft, project_location: e.target.value })}
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
                value={detailsDraft.total_amount}
                onChange={(e) => setDetailsDraft({ ...detailsDraft, total_amount: e.target.value })}
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
                value={detailsDraft.valid_until}
                onChange={(e) => setDetailsDraft({ ...detailsDraft, valid_until: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Payment Terms</label>
              <input
                type="text"
                className="input"
                value={detailsDraft.payment_terms}
                onChange={(e) => setDetailsDraft({ ...detailsDraft, payment_terms: e.target.value })}
                placeholder="e.g., Net 30, 50% upfront"
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              onClick={handleSaveDetails}
              disabled={updateProposalMutation.isPending || !detailsDirty}
            >
              {updateProposalMutation.isPending ? 'Saving…' : 'Save Project Details'}
            </button>
          </div>
        </div>
      )}

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
        {isEditing ? (
          <>
            <textarea
              className="input"
              rows={10}
              placeholder="Describe the scope of work for this proposal..."
              value={scopeDraft}
              onChange={(e) => setScopeDraft(e.target.value)}
              style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setScopeDraft(proposal.scope_of_work || '')}
                disabled={updateProposalMutation.isPending || scopeDraft === (proposal.scope_of_work || '')}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => updateProposalMutation.mutate({ scope_of_work: scopeDraft })}
                disabled={updateProposalMutation.isPending || scopeDraft === (proposal.scope_of_work || '')}
              >
                {updateProposalMutation.isPending ? 'Saving…' : 'Save Scope of Work'}
              </button>
            </div>
          </>
        ) : (
          <div className="content-display">
            {proposal.scope_of_work || 'No scope of work provided'}
          </div>
        )}
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

      {/* Attached Service Offerings (formerly Sell Sheets) */}
      {((proposal.sell_sheets && proposal.sell_sheets.length > 0) || isEditing) && (
        <div className="card">
          <h2 className="section-title">Service Offerings ({proposal.sell_sheets?.length || 0})</h2>
          {!isEditing ? (
            <div className="attachment-list">
              {proposal.sell_sheets?.map((ss: any) => (
                <div key={ss.id} className="attachment-display-item">
                  <div className="attachment-name">{ss.title || ss.service_name}</div>
                  <div className="attachment-meta">
                    {ss.service_name}{ss.layout_style === 'two_column' ? ' | Two Column' : ' | Full Width'}
                  </div>
                  {ss.notes && <div className="attachment-notes">{ss.notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <input
                type="text"
                className="input search-input"
                placeholder="Search service offerings..."
                value={ssSearch}
                onChange={(e) => setSsSearch(e.target.value)}
              />
              <div className="attachment-checklist">
                {availableSellSheets
                  .filter((ss: any) =>
                    !ssSearch || ss.service_name?.toLowerCase().includes(ssSearch.toLowerCase()) ||
                    ss.title?.toLowerCase().includes(ssSearch.toLowerCase())
                  )
                  .map((ss: any) => {
                  const isAttached = proposal.sell_sheets?.some((a: any) => a.id === ss.id);
                  return (
                    <label key={ss.id} className={`attachment-item ${isAttached ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isAttached}
                        onChange={() => isAttached
                          ? removeSellSheetMutation.mutate(ss.id)
                          : addSellSheetMutation.mutate(ss.id)
                        }
                      />
                      <div className="attachment-info">
                        <div className="attachment-name">{ss.title || ss.service_name}</div>
                        <div className="attachment-meta">
                          {ss.service_name}{ss.layout_style === 'two_column' ? ' | Two Column' : ''}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {availableSellSheets.length === 0 && (
                  <p className="empty-text">No published service offerings available</p>
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

      {/* Attached Org Charts */}
      {((proposal.org_charts && proposal.org_charts.length > 0) || isEditing) && (
        <div className="card">
          <h2 className="section-title">Project Org Charts ({proposal.org_charts?.length || 0})</h2>
          {!isEditing ? (
            <div className="attachment-list">
              {proposal.org_charts?.map((oc: any) => (
                <div key={oc.id} className="attachment-display-item">
                  <div className="attachment-name">{oc.name}</div>
                  <div className="attachment-meta">
                    {oc.project_name || 'No project'}
                    {' | '}{oc.member_count} {Number(oc.member_count) === 1 ? 'member' : 'members'}
                  </div>
                  {oc.description && <div className="attachment-notes">{oc.description}</div>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <input
                type="text"
                className="input search-input"
                placeholder="Search org charts..."
                value={ocSearch}
                onChange={(e) => setOcSearch(e.target.value)}
              />
              <div className="attachment-checklist">
                {availableOrgCharts
                  .filter((oc: any) =>
                    !ocSearch || oc.name?.toLowerCase().includes(ocSearch.toLowerCase()) ||
                    oc.project_name?.toLowerCase().includes(ocSearch.toLowerCase())
                  )
                  .map((oc: any) => {
                  const isAttached = proposal.org_charts?.some((a: any) => a.id === oc.id);
                  return (
                    <label key={oc.id} className={`attachment-item ${isAttached ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isAttached}
                        onChange={() => isAttached
                          ? removeOrgChartMutation.mutate(oc.id)
                          : addOrgChartMutation.mutate(oc.id)
                        }
                      />
                      <div className="attachment-info">
                        <div className="attachment-name">{oc.name}</div>
                        <div className="attachment-meta">
                          {oc.project_name || 'No project'} | {oc.member_count || 0} members
                        </div>
                      </div>
                    </label>
                  );
                })}
                {availableOrgCharts.length === 0 && (
                  <p className="empty-text">No org charts available. <a href="/org-charts" style={{ color: '#3b82f6' }}>Create one</a></p>
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
