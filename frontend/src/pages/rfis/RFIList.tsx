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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [sendingRFI, setSendingRFI] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const getDaysOutstanding = (createdDate: string, status: string) => {
    if (status !== 'open') return null;
    const created = new Date(createdDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handlePreview = async (rfi: RFI) => {
    setPreviewRFI(rfi);
    setIsPreviewOpen(true);
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

  const handleGenerateReport = () => {
    if (!rfis || rfis.length === 0) {
      alert('No RFIs to include in the report.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const url = `${api.defaults.baseURL}/rfi-actions/project/${projectId}/log-report?token=${token}${statusParam}`;

      const pdfWindow = window.open(url, '_blank');
      if (pdfWindow) {
        pdfWindow.onload = () => {
          pdfWindow.print();
        };
      }
    } catch (error) {
      alert('Failed to generate report. Please try again.');
      console.error('Error generating report:', error);
    }
  };

  const filteredRFIs = statusFilter === 'all'
    ? rfis
    : rfis?.filter(rfi => rfi.status === statusFilter);

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleGenerateReport} className="btn btn-secondary">
            Generate Report
          </button>
          <Link to={`/projects/${projectId}/rfis/new`} className="btn btn-primary">New RFI</Link>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label htmlFor="status-filter" style={{ fontWeight: 500 }}>Filter by Status:</label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="answered">Answered</option>
          <option value="closed">Closed</option>
        </select>
        <span style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>
          Showing {filteredRFIs?.length || 0} RFI{filteredRFIs?.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Subject</th>
              <th>Sent To</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Days Outstanding</th>
              <th>Due Date</th>
              <th>Assigned To</th>
              <th style={{ width: '200px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRFIs?.map((rfi) => {
              const daysOutstanding = getDaysOutstanding(rfi.created_at, rfi.status);
              return (
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
                <td><span className={getStatusBadge(rfi.status)}>{rfi.status}</span></td>
                <td>{format(new Date(rfi.created_at), 'MMM d, yyyy')}</td>
                <td>
                  {daysOutstanding !== null ? (
                    <span style={{ fontWeight: 500, color: daysOutstanding > 7 ? 'var(--danger)' : 'inherit' }}>
                      {daysOutstanding} {daysOutstanding === 1 ? 'day' : 'days'}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
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
              );
            })}
            {filteredRFIs?.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
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
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewRFI(null);
          }}
        />
      )}
    </div>
  );
};

export default RFIList;
