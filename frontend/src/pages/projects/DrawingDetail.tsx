import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { drawingsApi } from '../../services/drawings';

const DrawingDetail: React.FC = () => {
  const { id: projectId, drawingId } = useParams<{ id: string; drawingId: string }>();
  const navigate = useNavigate();

  const { data: drawing } = useQuery({
    queryKey: ['drawing', drawingId],
    queryFn: () => drawingsApi.getById(Number(drawingId)).then(res => res.data.data),
  });

  const { data: versions } = useQuery({
    queryKey: ['drawing-versions', drawingId],
    queryFn: () => drawingsApi.getVersionHistory(Number(drawingId)).then(res => res.data.data),
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (!drawing) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}/drawings`}>&larr; Back to Drawings</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {drawing.drawing_number} - {drawing.title}
          </h1>
          <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
            Version {drawing.version_number}
            {drawing.is_latest && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Latest</span>}
            {drawing.is_original_bid && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>Original Bid</span>}
          </div>
        </div>
        <button onClick={() => navigate(`/projects/${projectId}/drawings`)} className="btn btn-secondary">
          Close
        </button>
      </div>

      {/* Drawing Details */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Drawing Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div>
            <strong>Drawing Number:</strong> {drawing.drawing_number}
          </div>
          <div>
            <strong>Sheet Number:</strong> {drawing.sheet_number || 'N/A'}
          </div>
          <div>
            <strong>Discipline:</strong> {drawing.discipline || 'N/A'}
          </div>
          <div>
            <strong>Version:</strong> {drawing.version_number}
          </div>
          <div>
            <strong>Uploaded By:</strong> {drawing.uploaded_by_name || 'N/A'}
          </div>
          <div>
            <strong>Uploaded:</strong> {formatDate(drawing.uploaded_at)}
          </div>
          {drawing.file_name && (
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>File:</strong> {drawing.file_name}
              {drawing.file_size && <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                ({(drawing.file_size / (1024 * 1024)).toFixed(2)} MB)
              </span>}
            </div>
          )}
        </div>
        {drawing.description && (
          <div style={{ marginTop: '1rem' }}>
            <strong>Description:</strong>
            <p style={{ marginTop: '0.5rem' }}>{drawing.description}</p>
          </div>
        )}
        {drawing.notes && (
          <div style={{ marginTop: '1rem' }}>
            <strong>Notes:</strong>
            <p style={{ marginTop: '0.5rem' }}>{drawing.notes}</p>
          </div>
        )}
      </div>

      {/* Version History */}
      {versions && versions.length > 1 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Version History</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Drawing Number</th>
                <th>Uploaded</th>
                <th>Uploaded By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} style={{ background: v.id === drawing.id ? '#f0f9ff' : undefined }}>
                  <td>{v.version_number}</td>
                  <td>{v.drawing_number}</td>
                  <td>{formatDate(v.uploaded_at)}</td>
                  <td>{v.uploaded_by_name}</td>
                  <td>
                    {v.is_latest && <span className="badge badge-success">Latest</span>}
                    {v.is_original_bid && <span className="badge badge-info">Original Bid</span>}
                    {v.id === drawing.id && <span className="badge badge-primary">Current</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DrawingDetail;
