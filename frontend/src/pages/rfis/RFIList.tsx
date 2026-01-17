import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { rfisApi, RFI } from '../../services/rfis';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';
import RFIPreviewModal from '../../components/rfis/RFIPreviewModal';
import api from '../../services/api';

const RFIList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [previewRFI, setPreviewRFI] = useState<RFI | null>(null);
  const [sendingRFI, setSendingRFI] = useState<number | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: rfis, isLoading } = useQuery({
    queryKey: ['rfis', projectId],
    queryFn: () => rfisApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      open: 'badge-warning',
      answered: 'badge-success',
      closed: 'badge-info',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  const getPriorityBadge = (priority: string) => {
    const classes: Record<string, string> = {
      low: 'badge-info',
      normal: 'badge-info',
      high: 'badge-warning',
      urgent: 'badge-danger',
    };
    return `badge ${classes[priority] || 'badge-info'}`;
  };

  const handlePreview = async (rfi: RFI) => {
    setPreviewRFI(rfi);
  };

  const handleSend = async (rfiId: number) => {
    if (!window.confirm('Send this RFI to the recipient?')) {
      return;
    }

    setSendingRFI(rfiId);
    try {
      const response = await api.post(`/rfi-actions/${rfiId}/send`);
      if (response.data.preview) {
        alert(`Email Preview:\n\nTo: ${response.data.emailData.to}\nSubject: ${response.data.emailData.subject}\n\n${response.data.note}`);
      } else {
        alert(`RFI sent successfully to ${response.data.emailData.to}`);
      }
    } catch (error) {
      alert('Failed to send RFI. Please try again.');
      console.error('Error sending RFI:', error);
    } finally {
      setSendingRFI(null);
    }
  };

  const handleDownloadPDF = async (rfiId: number) => {
    try {
      const pdfWindow = window.open(`${api.defaults.baseURL}/rfi-actions/${rfiId}/pdf`, '_blank');
      if (pdfWindow) {
        pdfWindow.onload = () => {
          pdfWindow.print();
        };
      }
    } catch (error) {
      alert('Failed to generate PDF. Please try again.');
      console.error('Error generating PDF:', error);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}`}>&larr; Back to {project?.name || 'Project'}</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>RFIs</h1>
        <Link to={`/projects/${projectId}/rfis/new`} className="btn btn-primary">New RFI</Link>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Subject</th>
              <th>Sent To</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Assigned To</th>
              <th style={{ width: '200px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rfis?.map((rfi) => (
              <tr key={rfi.id}>
                <td><Link to={`/projects/${projectId}/rfis/${rfi.id}`}>{rfi.number}</Link></td>
                <td>{rfi.subject}</td>
                <td>
                  {rfi.recipient_company_name ? (
                    <div style={{ fontSize: '0.875rem' }}>
                      <div style={{ fontWeight: 500 }}>{rfi.recipient_company_name}</div>
                      {rfi.recipient_contact_name && (
                        <div style={{ color: 'var(--secondary)' }}>{rfi.recipient_contact_name}</div>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td><span className={getPriorityBadge(rfi.priority)}>{rfi.priority}</span></td>
                <td><span className={getStatusBadge(rfi.status)}>{rfi.status}</span></td>
                <td>{rfi.due_date ? format(new Date(rfi.due_date), 'MMM d, yyyy') : '-'}</td>
                <td>{rfi.assigned_to_name || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link
                      to={`/projects/${projectId}/rfis/${rfi.id}/edit`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      Edit
                    </Link>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handlePreview(rfi)}
                    >
                      Preview
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleSend(rfi.id)}
                      disabled={sendingRFI === rfi.id}
                    >
                      {sendingRFI === rfi.id ? 'Sending...' : 'Send'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleDownloadPDF(rfi.id)}
                    >
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rfis?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No RFIs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {previewRFI && (
        <RFIPreviewModal
          rfi={previewRFI}
          onClose={() => setPreviewRFI(null)}
        />
      )}
    </div>
  );
};

export default RFIList;
