import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractReviewsApi, ContractRiskFinding, ContractAnnotation } from '../../services/contractReviews';
import ContractViewerNew from '../../components/contractReview/ContractViewerNew';
import api from '../../services/api';
import '../../styles/SalesPipeline.css';
import './ContractReviewDetail.css';

const ContractReviewDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [reviewNotes, setReviewNotes] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [selectedFinding, setSelectedFinding] = useState<ContractRiskFinding | null>(null);
  const [showViewer, setShowViewer] = useState(true);

  const { data: review, isLoading } = useQuery({
    queryKey: ['contractReview', id],
    queryFn: () => contractReviewsApi.getById(Number(id)).then((res) => {
      console.log('Contract Review API Response:', res.data);
      console.log('Findings array:', res.data.findings);
      console.log('Findings length:', res.data.findings?.length);
      return res.data;
    }),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => contractReviewsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractReview', id] });
      queryClient.invalidateQueries({ queryKey: ['contractReviews'] });
      queryClient.invalidateQueries({ queryKey: ['contractReviewStats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => contractReviewsApi.delete(Number(id)),
    onSuccess: () => {
      navigate('/risk-management/contract-reviews');
    },
  });

  const addAnnotationMutation = useMutation({
    mutationFn: (annotation: Partial<ContractAnnotation>) =>
      contractReviewsApi.addAnnotation(Number(id), annotation as ContractAnnotation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractReview', id] });
    },
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: (annotationId: number) =>
      contractReviewsApi.deleteAnnotation(Number(id), annotationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractReview', id] });
    },
  });

  const handleStatusChange = async (newStatus: string) => {
    const notes = newStatus === 'approved' || newStatus === 'rejected' ? approvalNotes : reviewNotes;
    await updateMutation.mutateAsync({
      status: newStatus,
      ...(newStatus === 'under_review' && { review_notes: reviewNotes }),
      ...((newStatus === 'approved' || newStatus === 'rejected') && {
        approval_notes: approvalNotes,
      }),
    });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this contract review?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!review) {
    return (
      <div className="not-found">
        <h2>Contract Review Not Found</h2>
        <Link to="/risk-management/contract-reviews">Back to List</Link>
      </div>
    );
  }

  console.log('Review object in render:', review);
  console.log('Review.findings in render:', review.findings);

  const highRisks = review.findings?.filter((f: ContractRiskFinding) => f.risk_level === 'HIGH') || [];
  const moderateRisks = review.findings?.filter((f: ContractRiskFinding) => f.risk_level === 'MODERATE') || [];
  const lowRisks = review.findings?.filter((f: ContractRiskFinding) => f.risk_level === 'LOW') || [];

  console.log('High risks count:', highRisks.length);
  console.log('Moderate risks count:', moderateRisks.length);
  console.log('Low risks count:', lowRisks.length);

  const handleFindingClick = (finding: ContractRiskFinding) => {
    setSelectedFinding(finding);
    if (!showViewer) {
      setShowViewer(true);
    }
  };

  const handleAddAnnotation = (annotation: Partial<ContractAnnotation>) => {
    addAnnotationMutation.mutate(annotation);
  };

  const handleDeleteAnnotation = (annotationId: number) => {
    deleteAnnotationMutation.mutate(annotationId);
  };

  // Pass the full API URL to ContractViewerNew (it will use the api instance with auth)
  const fileUrl = `${api.defaults.baseURL}${contractReviewsApi.getFileUrl(Number(id))}`;

  return (
    <div className={`contract-detail ${showViewer ? 'split-view' : ''}`}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/risk-management/contract-reviews" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Contract Reviews
            </Link>
            <h1>&#128209; {review.file_name}</h1>
            <div className="sales-subtitle">
              {review.project_name || 'Contract Review'} {review.general_contractor ? `- ${review.general_contractor}` : ''}
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            onClick={() => setShowViewer(!showViewer)}
            className="btn btn-secondary"
          >
            {showViewer ? 'Hide Viewer' : 'Show Viewer'}
          </button>
          <button onClick={handleDelete} className="btn btn-danger">
            Delete
          </button>
        </div>
      </div>

      <div className="detail-content">
        {/* Summary Card */}
        <div className="summary-card card">
          <div className="card-header">
            <h2>Summary</h2>
            <div className="summary-badges">
              {review.overall_risk && (
                <span className={`badge risk-${review.overall_risk.toLowerCase()}`}>
                  {review.overall_risk} RISK
                </span>
              )}
              <span className={`badge status-${review.status}`}>
                {review.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="card-body">
            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">Project Name</span>
                <span className="value">{review.project_name || '—'}</span>
              </div>
              <div className="summary-item">
                <span className="label">General Contractor</span>
                <span className="value">{review.general_contractor || '—'}</span>
              </div>
              <div className="summary-item">
                <span className="label">Contract Value</span>
                <span className="value">
                  {review.contract_value
                    ? `$${review.contract_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                    : '—'}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">File Size</span>
                <span className="value">
                  {review.file_size ? `${(review.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">Uploaded By</span>
                <span className="value">{review.uploaded_by_name || '—'}</span>
              </div>
              <div className="summary-item">
                <span className="label">Upload Date</span>
                <span className="value">
                  {new Date(review.created_at!).toLocaleDateString()}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">Reviewed By</span>
                <span className="value">{review.reviewed_by_name || '—'}</span>
              </div>
              <div className="summary-item">
                <span className="label">Approved By</span>
                <span className="value">{review.approved_by_name || '—'}</span>
              </div>
            </div>

            {review.needs_legal_review && (
              <div className="legal-notice">
                <span className="legal-icon">⚠️</span>
                <div>
                  <strong>Legal Review Required</strong>
                  <p>
                    This contract has been flagged for legal review due to high-risk findings or
                    contract value threshold.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Risk Findings */}
        <div className="findings-card card">
          <div className="card-header">
            <h2>Risk Findings</h2>
            <div className="risk-summary">
              <span className="risk-count high">{highRisks.length} High</span>
              <span className="risk-count moderate">{moderateRisks.length} Moderate</span>
              <span className="risk-count low">{lowRisks.length} Low</span>
            </div>
          </div>
          <div className="card-body">
            {review.findings && review.findings.length > 0 ? (
              <div className="findings-list">
                {review.findings.map((finding: ContractRiskFinding) => (
                  <div
                    key={finding.id}
                    className={`finding-card ${selectedFinding?.id === finding.id ? 'selected' : ''}`}
                    onClick={() => handleFindingClick(finding)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="finding-header">
                      <div>
                        <span className={`finding-badge risk-${finding.risk_level.toLowerCase()}`}>
                          {finding.risk_level}
                        </span>
                        <span className="finding-title">{finding.title}</span>
                        {(finding.page_number || finding.location_start) && (
                          <span className="finding-location">
                            {finding.page_number && `Page ${finding.page_number}`}
                            {finding.page_number && finding.location_start && ', '}
                            {finding.location_start && `Para ${finding.location_start}`}
                          </span>
                        )}
                      </div>
                      <span className="finding-category">{finding.category}</span>
                    </div>
                    <div className="finding-body">
                      <div className="finding-section">
                        <strong>Finding:</strong>
                        <p>{finding.finding}</p>
                      </div>
                      {finding.recommendation && (
                        <div className="finding-section">
                          <strong>Recommendation:</strong>
                          <p>{finding.recommendation}</p>
                        </div>
                      )}
                      {finding.quoted_text && (
                        <div className="finding-section">
                          <strong>Quoted Text:</strong>
                          <p style={{ fontStyle: 'italic', color: '#666', background: '#f9fafb', padding: '0.5rem', borderRadius: '4px' }}>
                            "{finding.quoted_text}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-findings">No risk findings identified</p>
            )}
          </div>
        </div>

        {/* Review Actions */}
        {review.status === 'pending' && (
          <div className="actions-card card">
            <div className="card-header">
              <h2>Review Actions</h2>
            </div>
            <div className="card-body">
              <div className="action-section">
                <label htmlFor="review-notes">Review Notes</label>
                <textarea
                  id="review-notes"
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter notes about your review..."
                  className="notes-textarea"
                />
              </div>
              <div className="action-buttons">
                <button
                  onClick={() => handleStatusChange('under_review')}
                  className="btn btn-secondary"
                  disabled={updateMutation.isPending}
                >
                  Start Review
                </button>
              </div>
            </div>
          </div>
        )}

        {review.status === 'under_review' && (
          <div className="actions-card card">
            <div className="card-header">
              <h2>Approval Decision</h2>
            </div>
            <div className="card-body">
              <div className="action-section">
                <label htmlFor="approval-notes">Approval Notes</label>
                <textarea
                  id="approval-notes"
                  rows={4}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Enter notes about your decision..."
                  className="notes-textarea"
                />
              </div>
              <div className="action-buttons">
                <button
                  onClick={() => handleStatusChange('approved')}
                  className="btn btn-success"
                  disabled={updateMutation.isPending}
                >
                  Approve Contract
                </button>
                <button
                  onClick={() => handleStatusChange('needs_revision')}
                  className="btn btn-warning"
                  disabled={updateMutation.isPending}
                >
                  Request Revision
                </button>
                <button
                  onClick={() => handleStatusChange('rejected')}
                  className="btn btn-danger"
                  disabled={updateMutation.isPending}
                >
                  Reject Contract
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes History */}
        {(review.review_notes || review.approval_notes) && (
          <div className="notes-card card">
            <div className="card-header">
              <h2>Notes History</h2>
            </div>
            <div className="card-body">
              {review.review_notes && (
                <div className="note-item">
                  <div className="note-header">
                    <strong>Review Notes</strong>
                    <span className="note-date">
                      {review.reviewed_at && new Date(review.reviewed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p>{review.review_notes}</p>
                </div>
              )}
              {review.approval_notes && (
                <div className="note-item">
                  <div className="note-header">
                    <strong>Approval Notes</strong>
                    <span className="note-date">
                      {review.approved_at && new Date(review.approved_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p>{review.approval_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contract Viewer Panel */}
      {showViewer && (
        <div className="viewer-panel">
          {review.file_path ? (
            <ContractViewerNew
              fileUrl={fileUrl}
              selectedFinding={selectedFinding}
            />
          ) : (
            <div className="no-file-message">
              <div className="no-file-icon">📄</div>
              <h3>No Contract File Available</h3>
              <p>This contract review does not have an associated PDF file.</p>
              <p className="hint">Upload a contract file to view and annotate it here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractReviewDetail;
