import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { drawingsApi, Drawing, CreateDrawingData } from '../../services/drawings';

const ProjectDrawings: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: drawings, isLoading } = useQuery({
    queryKey: ['drawings', projectId, disciplineFilter, showAllVersions],
    queryFn: () => drawingsApi.getByProject(Number(projectId), {
      discipline: disciplineFilter || undefined,
      is_latest: showAllVersions ? undefined : true
    }).then(res => res.data.data),
  });

  const [formData, setFormData] = useState<CreateDrawingData>({
    project_id: Number(projectId),
    drawing_number: '',
    title: '',
    description: '',
    discipline: 'Mechanical',
    sheet_number: '',
    version_number: '1.0',
    is_original_bid: false,
    notes: '',
  });

  const uploadMutation = useMutation({
    mutationFn: (formDataToSend: FormData) => drawingsApi.upload(formDataToSend),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
      setShowUploadForm(false);
      setSelectedFile(null);
      setFormData({
        project_id: Number(projectId),
        drawing_number: '',
        title: '',
        description: '',
        discipline: 'Mechanical',
        sheet_number: '',
        version_number: '1.0',
        is_original_bid: false,
        notes: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => drawingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formDataToSend = new FormData();
    formDataToSend.append('project_id', formData.project_id.toString());
    formDataToSend.append('drawing_number', formData.drawing_number);
    formDataToSend.append('title', formData.title);
    if (formData.description) formDataToSend.append('description', formData.description);
    if (formData.discipline) formDataToSend.append('discipline', formData.discipline);
    if (formData.sheet_number) formDataToSend.append('sheet_number', formData.sheet_number);
    formDataToSend.append('version_number', formData.version_number);
    formDataToSend.append('is_original_bid', (formData.is_original_bid || false).toString());
    if (formData.notes) formDataToSend.append('notes', formData.notes);

    if (selectedFile) {
      formDataToSend.append('file', selectedFile);
    }

    uploadMutation.mutate(formDataToSend);
  };

  const handleDelete = (drawing: Drawing) => {
    if (window.confirm(`Delete drawing "${drawing.drawing_number}"?`)) {
      deleteMutation.mutate(drawing.id);
    }
  };

  if (isLoading) return <div>Loading drawings...</div>;

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">📐 Drawings</h2>
        <button onClick={() => setShowUploadForm(!showUploadForm)} className="btn btn-primary">
          {showUploadForm ? 'Cancel' : 'Upload Drawing'}
        </button>
      </div>

      {showUploadForm && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Upload New Drawing</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Drawing Number *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.drawing_number}
                  onChange={(e) => setFormData({ ...formData, drawing_number: e.target.value })}
                  placeholder="e.g., M-101"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sheet Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.sheet_number}
                  onChange={(e) => setFormData({ ...formData, sheet_number: e.target.value })}
                  placeholder="e.g., 1 of 5"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Version *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.version_number}
                  onChange={(e) => setFormData({ ...formData, version_number: e.target.value })}
                  placeholder="e.g., 1.0, Rev A"
                  required
                />
              </div>
            </div>
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
                <label className="form-label">Discipline</label>
                <select
                  className="form-input"
                  value={formData.discipline}
                  onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                >
                  <option value="Mechanical">Mechanical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Sheet Metal">Sheet Metal</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Architectural">Architectural</option>
                  <option value="Structural">Structural</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={formData.is_original_bid}
                  onChange={(e) => setFormData({ ...formData, is_original_bid: e.target.checked })}
                />
                <span>Original Bid Drawing</span>
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">File</label>
              <input
                type="file"
                className="form-input"
                accept=".pdf,.dwg,.dxf,.rvt,.png,.jpg,.jpeg,.tiff,.tif"
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
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Drawing'}
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
            <label className="form-label">Filter by Discipline</label>
            <select
              className="form-input"
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
            >
              <option value="">All Disciplines</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Sheet Metal">Sheet Metal</option>
              <option value="Electrical">Electrical</option>
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
              <th>Drawing #</th>
              <th>Title</th>
              <th>Discipline</th>
              <th>Sheet</th>
              <th>Version</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drawings?.map((drawing) => (
              <tr key={drawing.id}>
                <td><strong>{drawing.drawing_number}</strong></td>
                <td>
                  <Link to={`/projects/${projectId}/drawings/${drawing.id}`}>
                    {drawing.title}
                  </Link>
                  {drawing.description && (
                    <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                      {drawing.description}
                    </div>
                  )}
                </td>
                <td>{drawing.discipline}</td>
                <td>{drawing.sheet_number || 'N/A'}</td>
                <td>
                  {drawing.version_number}
                  {drawing.is_latest && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Latest</span>}
                  {drawing.is_original_bid && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>Original</span>}
                </td>
                <td>
                  <div style={{ fontSize: '0.875rem' }}>
                    {drawing.uploaded_at ? new Date(drawing.uploaded_at).toLocaleDateString() : 'N/A'}
                    {drawing.uploaded_by_name && (
                      <div style={{ color: '#666' }}>{drawing.uploaded_by_name}</div>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to={`/projects/${projectId}/drawings/${drawing.id}`} className="btn btn-secondary btn-sm">
                      View
                    </Link>
                    {drawing.file_name && (
                      <button
                        onClick={() => drawingsApi.download(drawing.id)}
                        className="btn btn-primary btn-sm"
                      >
                        Download
                      </button>
                    )}
                    <button onClick={() => handleDelete(drawing)} className="btn btn-danger btn-sm">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {drawings?.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ color: '#666' }}>
                    No drawings found. Upload your first drawing to get started.
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

export default ProjectDrawings;
