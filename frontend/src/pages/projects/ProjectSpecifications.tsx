import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { specificationsApi, Specification, CreateSpecificationData } from '../../services/specifications';

const ProjectSpecifications: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: specifications, isLoading } = useQuery({
    queryKey: ['specifications', projectId, categoryFilter, showAllVersions],
    queryFn: () => specificationsApi.getByProject(Number(projectId), {
      category: categoryFilter || undefined,
      is_latest: showAllVersions ? undefined : true
    }).then(res => res.data.data),
  });

  const [formData, setFormData] = useState<CreateSpecificationData>({
    project_id: Number(projectId),
    title: '',
    description: '',
    category: 'HVAC',
    version_number: '1.0',
    is_original_bid: false,
    notes: '',
  });

  const uploadMutation = useMutation({
    mutationFn: (formDataToSend: FormData) => specificationsApi.upload(formDataToSend),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specifications'] });
      setShowUploadForm(false);
      setSelectedFile(null);
      setFormData({
        project_id: Number(projectId),
        title: '',
        description: '',
        category: 'HVAC',
        version_number: '1.0',
        is_original_bid: false,
        notes: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => specificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specifications'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formDataToSend = new FormData();
    formDataToSend.append('project_id', formData.project_id.toString());
    formDataToSend.append('title', formData.title);
    if (formData.description) formDataToSend.append('description', formData.description);
    if (formData.category) formDataToSend.append('category', formData.category);
    formDataToSend.append('version_number', formData.version_number);
    formDataToSend.append('is_original_bid', (formData.is_original_bid || false).toString());
    if (formData.notes) formDataToSend.append('notes', formData.notes);

    if (selectedFile) {
      formDataToSend.append('file', selectedFile);
    }

    uploadMutation.mutate(formDataToSend);
  };

  const handleDelete = (spec: Specification) => {
    if (window.confirm(`Delete "${spec.title}"?`)) {
      deleteMutation.mutate(spec.id);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  if (isLoading) return <div>Loading specifications...</div>;

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">📋 Specifications</h2>
        <button onClick={() => setShowUploadForm(!showUploadForm)} className="btn btn-primary">
          {showUploadForm ? 'Cancel' : 'Upload Specification'}
        </button>
      </div>

      {showUploadForm && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Upload New Specification</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-input"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="HVAC">HVAC</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="General">General</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Version Number *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.version_number}
                  onChange={(e) => setFormData({ ...formData, version_number: e.target.value })}
                  placeholder="e.g., 1.0, Rev A"
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_original_bid}
                    onChange={(e) => setFormData({ ...formData, is_original_bid: e.target.checked })}
                  />
                  <span>Original Bid Document</span>
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">File</label>
              <input
                type="file"
                className="form-input"
                accept=".pdf,.doc,.docx,.txt,.dwg,.dxf,.rvt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              {selectedFile && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                  Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Specification'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowUploadForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <label className="form-label">Filter by Category</label>
            <select
              className="form-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="HVAC">HVAC</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="General">General</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <input
                type="checkbox"
                checked={showAllVersions}
                onChange={(e) => setShowAllVersions(e.target.checked)}
              />
              <span>Show all versions</span>
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Version</th>
              <th>Uploaded</th>
              <th>Uploaded By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {specifications?.map((spec) => (
              <tr key={spec.id}>
                <td>
                  <Link to={`/projects/${projectId}/specifications/${spec.id}`}>
                    <strong>{spec.title}</strong>
                  </Link>
                  {spec.description && (
                    <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                      {spec.description}
                    </div>
                  )}
                </td>
                <td>{spec.category || 'N/A'}</td>
                <td>
                  {spec.version_number}
                  {spec.is_latest && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Latest</span>}
                  {spec.is_original_bid && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>Original Bid</span>}
                </td>
                <td>{spec.uploaded_at ? new Date(spec.uploaded_at).toLocaleDateString() : 'N/A'}</td>
                <td>{spec.uploaded_by_name || 'N/A'}</td>
                <td>
                  <div style={{ fontSize: '0.875rem' }}>
                    {spec.file_name ? (
                      <>
                        <div>{spec.file_name}</div>
                        <div style={{ color: '#666' }}>{formatFileSize(spec.file_size)}</div>
                      </>
                    ) : (
                      <span style={{ color: '#999' }}>No file attached</span>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to={`/projects/${projectId}/specifications/${spec.id}`} className="btn btn-secondary btn-sm">
                      View
                    </Link>
                    {spec.file_name && (
                      <button
                        onClick={() => specificationsApi.download(spec.id)}
                        className="btn btn-primary btn-sm"
                      >
                        Download
                      </button>
                    )}
                    <button onClick={() => handleDelete(spec)} className="btn btn-danger btn-sm">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {specifications?.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ color: '#666' }}>
                    No specifications found. Upload your first specification to get started.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectSpecifications;
