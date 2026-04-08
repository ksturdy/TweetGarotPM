import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellSheetsApi } from '../../services/sellSheets';
import SellSheetPreviewModal from '../../components/sellSheets/SellSheetPreviewModal';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';

const getImageUrl = (filePath: string) => {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  const idx = filePath.replace(/\\/g, '/').indexOf('uploads/');
  if (idx !== -1) {
    return '/' + filePath.replace(/\\/g, '/').substring(idx);
  }
  return `/uploads/${filePath}`;
};

const SellSheetDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: sellSheet, isLoading, error } = useQuery({
    queryKey: ['sellSheet', id],
    queryFn: () => sellSheetsApi.getById(parseInt(id!)).then(res => res.data),
    enabled: !!id,
  });

  // Workflow mutations
  const publishMutation = useMutation({
    mutationFn: () => sellSheetsApi.publish(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
      queryClient.invalidateQueries({ queryKey: ['sellSheets'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => sellSheetsApi.archive(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
      queryClient.invalidateQueries({ queryKey: ['sellSheets'] });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => sellSheetsApi.unarchive(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
      queryClient.invalidateQueries({ queryKey: ['sellSheets'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => sellSheetsApi.delete(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheets'] });
      navigate('/sell-sheets');
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: number) => sellSheetsApi.deleteImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
    },
  });

  const handleWorkflowAction = async (action: string) => {
    const labels: Record<string, string> = {
      publish: 'publish this sell sheet',
      archive: 'archive this sell sheet',
      unarchive: 'un-archive this sell sheet (moves back to draft)',
    };
    const ok = await confirm(`Are you sure you want to ${labels[action]}?`);
    if (ok) {
      if (action === 'publish') publishMutation.mutate();
      if (action === 'archive') archiveMutation.mutate();
      if (action === 'unarchive') unarchiveMutation.mutate();
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({ message: 'Are you sure you want to delete this sell sheet? This action cannot be undone.', danger: true });
    if (ok) {
      deleteMutation.mutate();
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await sellSheetsApi.downloadPdf(parseInt(id!));
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sellSheet?.service_name || 'sell-sheet'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Failed to download PDF');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploadingImage(true);
    try {
      await sellSheetsApi.uploadImage(parseInt(id!), formData);
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
    } catch (err) {
      console.error('Error uploading image:', err);
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

  const formatLayoutStyle = (style: string) => {
    const labels: Record<string, string> = {
      full_width: 'Full Width',
      two_column: 'Two Column',
    };
    return labels[style] || style;
  };

  if (isLoading) {
    return <div className="loading">Loading sell sheet...</div>;
  }

  if (error || !sellSheet) {
    return (
      <div className="container">
        <div className="error-message">Sell sheet not found</div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              <Link to="/sell-sheets" style={{ color: '#6b7280', textDecoration: 'none' }}>
                &larr; Back to Sell Sheets
              </Link>
            </div>
            <h1>{sellSheet.service_name}</h1>
            <div className="sales-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {sellSheet.title && <span>{sellSheet.title}</span>}
              {sellSheet.featured && (
                <span className="badge" style={{ backgroundColor: '#fbbf24', color: '#78350f' }}>Featured</span>
              )}
              <span className={getStatusBadge(sellSheet.status)}>{formatStatus(sellSheet.status)}</span>
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {sellSheet.status === 'draft' && (
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
            {sellSheet.status === 'published' && (
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}
                onClick={() => handleWorkflowAction('archive')}
                disabled={archiveMutation.isPending}
              >
                Archive
              </button>
            )}
            {sellSheet.status === 'archived' && (
              <button
                className="btn btn-primary"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}
                onClick={() => handleWorkflowAction('unarchive')}
                disabled={unarchiveMutation.isPending}
              >
                {unarchiveMutation.isPending ? 'Un-archiving...' : 'Un-archive'}
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/sell-sheets/${id}/edit`)}
            >
              Edit
            </button>
            <button className="btn btn-primary" onClick={() => setShowPreview(true)}>
              Preview / PDF
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDownloadPdf}
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}
            >
              Download PDF
            </button>
            <button
              className="btn"
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
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
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Service Name</div>
          <div style={{ fontWeight: 600 }}>{sellSheet.service_name}</div>
        </div>
        {sellSheet.title && (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Title</div>
            <div style={{ fontWeight: 600 }}>{sellSheet.title}</div>
          </div>
        )}
        {sellSheet.subtitle && (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Subtitle</div>
            <div style={{ fontWeight: 600 }}>{sellSheet.subtitle}</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Layout Style</div>
          <div style={{ fontWeight: 600 }}>{formatLayoutStyle(sellSheet.layout_style)}</div>
        </div>
        {sellSheet.display_order != null && (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Display Order</div>
            <div style={{ fontWeight: 600 }}>{sellSheet.display_order}</div>
          </div>
        )}
      </div>

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
              Upload images for the sell sheet layout (1 hero + supporting photos)
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

        {sellSheet.images && sellSheet.images.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {sellSheet.images.map((image: any) => (
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
                  alt={image.caption || 'Sell sheet image'}
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
                  x
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

      {/* Content Sections */}
      {sellSheet.overview && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Overview</h3>
          <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.overview }} />
        </div>
      )}

      {sellSheet.content && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Content</h3>
          <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.content }} />
        </div>
      )}

      {sellSheet.sidebar_content && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Sidebar Content</h3>
          <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.sidebar_content }} />
        </div>
      )}

      {sellSheet.page2_content && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Page 2 Content</h3>
          <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.page2_content }} />
        </div>
      )}

      {sellSheet.footer_content && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Footer Content</h3>
          <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.footer_content }} />
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
          {sellSheet.created_by_name && (
            <div>
              <strong>Created by:</strong> {sellSheet.created_by_name}
            </div>
          )}
          {sellSheet.created_at && (
            <div>
              <strong>Created:</strong>{' '}
              {new Date(sellSheet.created_at).toLocaleDateString()}
            </div>
          )}
          {sellSheet.updated_at && (
            <div>
              <strong>Last Updated:</strong>{' '}
              {new Date(sellSheet.updated_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <SellSheetPreviewModal
          sellSheet={sellSheet}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default SellSheetDetail;
