import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caseStudiesApi } from '../../services/caseStudies';
import { caseStudyTemplatesApi } from '../../services/caseStudyTemplates';
import CaseStudyForm from './CaseStudyForm';
import CaseStudyPreviewModal from '../../components/caseStudies/CaseStudyPreviewModal';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';

const getImageUrl = (filePath: string) => {
  if (!filePath) return '';
  // If already a full URL (R2 or presigned), use as-is
  if (filePath.startsWith('http')) return filePath;
  const idx = filePath.replace(/\\/g, '/').indexOf('uploads/');
  if (idx !== -1) {
    return '/' + filePath.replace(/\\/g, '/').substring(idx);
  }
  return `/uploads/${filePath}`;
};

const CaseStudyDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: caseStudy, isLoading, error } = useQuery({
    queryKey: ['caseStudy', id],
    queryFn: () => caseStudiesApi.getById(parseInt(id!)).then(res => res.data),
    enabled: !!id,
  });

  // Fetch template if case study has one
  const { data: template } = useQuery({
    queryKey: ['caseStudyTemplate', caseStudy?.template_id],
    queryFn: () => caseStudyTemplatesApi.getById(caseStudy!.template_id!).then(res => res.data),
    enabled: !!caseStudy?.template_id,
  });

  // Workflow mutations
  const publishMutation = useMutation({
    mutationFn: () => caseStudiesApi.publish(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseStudy', id] });
      queryClient.invalidateQueries({ queryKey: ['caseStudies'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => caseStudiesApi.archive(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseStudy', id] });
      queryClient.invalidateQueries({ queryKey: ['caseStudies'] });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => caseStudiesApi.unarchive(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseStudy', id] });
      queryClient.invalidateQueries({ queryKey: ['caseStudies'] });
    },
  });

  const handleWorkflowAction = async (action: string) => {
    const labels: Record<string, string> = {
      publish: 'publish this case study',
      archive: 'archive this case study',
      unarchive: 'un-archive this case study (moves back to draft)',
    };
    const ok = await confirm(`Are you sure you want to ${labels[action]}?`);
    if (ok) {
      if (action === 'publish') publishMutation.mutate();
      if (action === 'archive') archiveMutation.mutate();
      if (action === 'unarchive') unarchiveMutation.mutate();
    }
  };

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: number) => caseStudiesApi.deleteImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseStudy', id] });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploadingImage(true);
    try {
      await caseStudiesApi.uploadImage(parseInt(id!), formData);
      queryClient.invalidateQueries({ queryKey: ['caseStudy', id] });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'badge badge-info',
      published: 'badge badge-success',
      archived: 'badge',
    };
    return classes[status] || 'badge';
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  if (isLoading) {
    return <div className="loading">Loading case study...</div>;
  }

  if (error || !caseStudy) {
    return (
      <div className="container">
        <div className="error-message">Case study not found</div>
      </div>
    );
  }

  if (isEditing) {
    return <CaseStudyForm />;
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/case-studies" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Case Studies
            </Link>
            <h1>📊 {caseStudy.title}</h1>
            <div className="sales-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {caseStudy.subtitle && <span>{caseStudy.subtitle}</span>}
              {caseStudy.featured && (
                <span className="badge" style={{ backgroundColor: '#fbbf24', color: '#78350f' }}>Featured</span>
              )}
              <span className={getStatusBadge(caseStudy.status)}>{formatStatus(caseStudy.status)}</span>
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {caseStudy.status === 'draft' && (
              <>
                <button
                  className="btn"
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  onClick={() => handleWorkflowAction('publish')}
                  disabled={publishMutation.isPending}
                >
                  {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}
                  onClick={() => handleWorkflowAction('archive')}
                  disabled={archiveMutation.isPending}
                >
                  Archive
                </button>
              </>
            )}
            {caseStudy.status === 'published' && (
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}
                onClick={() => handleWorkflowAction('archive')}
                disabled={archiveMutation.isPending}
              >
                Archive
              </button>
            )}
            {caseStudy.status === 'archived' && (
              <button
                className="btn btn-primary"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}
                onClick={() => handleWorkflowAction('unarchive')}
                disabled={unarchiveMutation.isPending}
              >
                {unarchiveMutation.isPending ? 'Un-archiving...' : 'Un-archive'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>Edit</button>
            <button className="btn btn-primary" onClick={() => setShowPreview(true)}>Preview / PDF</button>
          </div>
        </div>
      </div>

      {/* Customer & Project Info */}
      {(caseStudy.customer_name || caseStudy.project_name) && (() => {
        const effectiveValue = caseStudy.override_contract_value ?? caseStudy.project_value;
        const effectiveSqft = caseStudy.override_square_footage ?? caseStudy.project_square_footage;
        const effectiveStart = caseStudy.override_start_date || caseStudy.project_start_date;
        const effectiveEnd = caseStudy.override_end_date || caseStudy.project_end_date;
        const effectiveAccountMgr = caseStudy.override_account_manager || caseStudy.customer_account_manager;
        const effectiveContact = caseStudy.override_contact_name || caseStudy.primary_contact_name;
        const effectiveContactEmail = caseStudy.override_contact_email || caseStudy.primary_contact_email;
        const effectiveContactPhone = caseStudy.override_contact_phone || caseStudy.primary_contact_phone;
        return (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          {caseStudy.customer_name && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Customer
              </div>
              <div style={{ fontWeight: 600 }}>{caseStudy.customer_name}</div>
            </div>
          )}
          {caseStudy.project_name && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Project
              </div>
              <div style={{ fontWeight: 600 }}>{caseStudy.project_name}</div>
            </div>
          )}
          {caseStudy.market && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Market
              </div>
              <div style={{ fontWeight: 600 }}>{caseStudy.market}</div>
            </div>
          )}
          {effectiveValue != null && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Project Value
              </div>
              <div style={{ fontWeight: 600 }}>
                ${Math.round(Number(effectiveValue)).toLocaleString()}
              </div>
            </div>
          )}
          {effectiveSqft != null && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Square Footage
              </div>
              <div style={{ fontWeight: 600 }}>
                {Number(effectiveSqft).toLocaleString()} SF
              </div>
            </div>
          )}
          {(effectiveStart || effectiveEnd) && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Project Dates
              </div>
              <div style={{ fontWeight: 600 }}>
                {effectiveStart && new Date(effectiveStart).toLocaleDateString()}
                {effectiveStart && effectiveEnd && ' – '}
                {effectiveEnd && new Date(effectiveEnd).toLocaleDateString()}
              </div>
            </div>
          )}
          {effectiveAccountMgr && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Account Manager
              </div>
              <div style={{ fontWeight: 600 }}>{effectiveAccountMgr}</div>
            </div>
          )}
          {effectiveContact && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Primary Contact
              </div>
              <div style={{ fontWeight: 600 }}>
                {effectiveContact}
                {effectiveContactEmail && <span style={{ fontWeight: 400, color: 'var(--secondary)', marginLeft: '0.5rem' }}>{effectiveContactEmail}</span>}
                {effectiveContactPhone && <span style={{ fontWeight: 400, color: 'var(--secondary)', marginLeft: '0.5rem' }}>{effectiveContactPhone}</span>}
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Metrics */}
      {(caseStudy.cost_savings ||
        caseStudy.timeline_improvement_days ||
        caseStudy.quality_score) && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Key Metrics</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {caseStudy.cost_savings && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 600,
                    color: 'var(--success)',
                  }}
                >
                  ${(caseStudy.cost_savings / 1000).toFixed(0)}K
                </div>
                <div style={{ color: 'var(--secondary)' }}>Cost Savings</div>
              </div>
            )}
            {caseStudy.timeline_improvement_days && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 600,
                    color: 'var(--primary)',
                  }}
                >
                  {caseStudy.timeline_improvement_days} days
                </div>
                <div style={{ color: 'var(--secondary)' }}>
                  Timeline Improvement
                </div>
              </div>
            )}
            {caseStudy.quality_score && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 600,
                    color: 'var(--warning)',
                  }}
                >
                  {caseStudy.quality_score}%
                </div>
                <div style={{ color: 'var(--secondary)' }}>Quality Score</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Images */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Images</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: '0.25rem' }}>
              Upload 3–4 images for best results (1 hero + 2–3 supporting photos)
            </div>
          </div>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            {uploadingImage ? 'Uploading...' : '+ Upload Image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              disabled={uploadingImage}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {caseStudy.images && caseStudy.images.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {caseStudy.images.map(image => (
              <div
                key={image.id}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#f3f4f6',
                }}
              >
                <img
                  src={image.image_url || getImageUrl(image.file_path)}
                  alt={image.caption || 'Case study image'}
                  style={{
                    width: '100%',
                    height: '200px',
                    objectFit: 'cover',
                  }}
                />
                {image.is_hero_image && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      left: '0.5rem',
                      backgroundColor: '#fbbf24',
                      color: '#78350f',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    Hero
                  </div>
                )}
                <button
                  onClick={async () => {
                    const ok = await confirm({ message: 'Delete this image?', danger: true });
                    if (ok) {
                      deleteImageMutation.mutate(image.id);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.25rem 0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  ×
                </button>
                {image.caption && (
                  <div
                    style={{
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      color: 'var(--secondary)',
                    }}
                  >
                    {image.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--secondary)',
            }}
          >
            No images uploaded yet
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1.5rem',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Challenge</h3>
        <div dangerouslySetInnerHTML={{ __html: caseStudy.challenge }} />
      </div>

      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1.5rem',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Solution</h3>
        <div dangerouslySetInnerHTML={{ __html: caseStudy.solution }} />
      </div>

      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1.5rem',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Results</h3>
        <div dangerouslySetInnerHTML={{ __html: caseStudy.results }} />
      </div>

      {caseStudy.executive_summary && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Executive Summary</h3>
          <div dangerouslySetInnerHTML={{ __html: caseStudy.executive_summary }} />
        </div>
      )}

      {/* Metadata */}
      <div
        className="card"
        style={{
          padding: '1rem',
          fontSize: '0.875rem',
          color: 'var(--secondary)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          {caseStudy.created_by_name && (
            <div>
              <strong>Created by:</strong> {caseStudy.created_by_name}
            </div>
          )}
          {caseStudy.created_at && (
            <div>
              <strong>Created:</strong>{' '}
              {new Date(caseStudy.created_at).toLocaleDateString()}
            </div>
          )}
          {caseStudy.published_at && (
            <div>
              <strong>Published:</strong>{' '}
              {new Date(caseStudy.published_at).toLocaleDateString()}
            </div>
          )}
          {caseStudy.reviewed_by_name && (
            <div>
              <strong>Reviewed by:</strong> {caseStudy.reviewed_by_name}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <CaseStudyPreviewModal
        caseStudy={caseStudy}
        template={template}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
};

export default CaseStudyDetail;
