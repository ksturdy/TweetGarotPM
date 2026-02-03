import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { rfisApi, RFI } from '../../services/rfis';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';
import RFIPreviewModal from '../../components/rfis/RFIPreviewModal';
import api from '../../services/api';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import SummarizeIcon from '@mui/icons-material/Summarize';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SendIcon from '@mui/icons-material/Send';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import '../../styles/SalesPipeline.css';

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

  const getDaysAged = (createdDate: string) => {
    const created = new Date(createdDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'closed') return null;
    const due = new Date(dueDate);
    const today = new Date();
    // Reset time components for accurate day comparison
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  };

  const handlePreview = async (rfi: RFI) => {
    setPreviewRFI(rfi);
    setIsPreviewOpen(true);
  };

  const handleSend = async (rfi: RFI) => {
    setSendingRFI(rfi.id);
    try {
      // Generate .eml file with PDF attached - open directly to trigger Outlook
      const token = localStorage.getItem('token');
      const emlUrl = `${api.defaults.baseURL}/rfi-actions/${rfi.id}/email-draft?token=${token}`;

      // Open the .eml URL directly - browser should prompt to open with Outlook
      window.open(emlUrl, '_blank');

    } catch (error) {
      alert('Failed to prepare email. Please try again.');
      console.error('Error preparing email:', error);
    } finally {
      setSendingRFI(null);
    }
  };

  const handleDownloadPDF = async (rfiId: number, rfiNumber?: number) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${api.defaults.baseURL}/rfi-actions/${rfiId}/pdf-download?token=${token}`;

      // Fetch and trigger download
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `RFI-${rfiNumber || rfiId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
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
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
          &larr; Back to {project?.name || 'Project'}
        </Link>
      </div>

      {/* Page Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <h1>RFI Log</h1>
          <span className="sales-subtitle">
            Showing {filteredRFIs?.length || 0} RFI{filteredRFIs?.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="sales-header-actions">
          <button onClick={handleGenerateReport} className="sales-btn sales-btn-secondary">
            <SummarizeIcon fontSize="small" />
            Generate Report
          </button>
          <Link to={`/projects/${projectId}/rfis/new`} className="sales-btn sales-btn-primary" style={{ textDecoration: 'none' }}>
            <AddIcon fontSize="small" />
            New RFI
          </Link>
        </div>
      </div>

      {/* Filter Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e0e2e7'
      }}>
        <label htmlFor="status-filter" style={{ fontWeight: 500, color: '#5a5a72', fontSize: '0.875rem' }}>
          Filter by Status:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sales-filter-btn"
          style={{ cursor: 'pointer' }}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="answered">Answered</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <table className="sales-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Subject</th>
              <th>Sent To</th>
              <th>Status</th>
              <th>Created</th>
              <th>Days Aged</th>
              <th>Due Date</th>
              <th>Days Overdue</th>
              <th>Assigned To</th>
              <th style={{ width: '200px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRFIs?.map((rfi) => {
              const daysAged = getDaysAged(rfi.created_at);
              const daysOverdue = getDaysOverdue(rfi.due_date, rfi.status);
              return (
              <tr key={rfi.id}>
                <td>
                  <Link to={`/projects/${projectId}/rfis/${rfi.id}`} style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
                    {rfi.number}
                  </Link>
                </td>
                <td>
                  <div className="sales-project-cell">
                    <div className="sales-project-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                      <DescriptionIcon style={{ color: 'white', fontSize: '18px' }} />
                    </div>
                    <div className="sales-project-info">
                      <h4>{rfi.subject}</h4>
                    </div>
                  </div>
                </td>
                <td>
                  {rfi.recipient_company_name ? (
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{rfi.recipient_company_name}</div>
                      {rfi.recipient_contact_name && (
                        <div style={{ color: '#8888a0', fontSize: '0.75rem' }}>{rfi.recipient_contact_name}</div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#8888a0' }}>-</span>
                  )}
                </td>
                <td>
                  <span className={`sales-stage-badge ${rfi.status}`}>
                    <span className="sales-stage-dot"></span>
                    {rfi.status.charAt(0).toUpperCase() + rfi.status.slice(1)}
                  </span>
                </td>
                <td style={{ fontSize: '0.875rem', color: '#5a5a72' }}>
                  {format(new Date(rfi.created_at), 'MMM d, yyyy')}
                </td>
                <td>
                  <span className={`sales-stage-badge ${daysAged > 14 ? 'lost' : daysAged > 7 ? 'quoted' : 'won'}`}>
                    <span className="sales-stage-dot"></span>
                    {daysAged} {daysAged === 1 ? 'day' : 'days'}
                  </span>
                </td>
                <td style={{ fontSize: '0.875rem', color: '#5a5a72' }}>
                  {rfi.due_date ? format(new Date(rfi.due_date), 'MMM d, yyyy') : '-'}
                </td>
                <td>
                  {daysOverdue !== null ? (
                    <span className={`sales-stage-badge ${daysOverdue > 7 ? 'lost' : daysOverdue > 3 ? 'quoted' : 'won'}`}>
                      <span className="sales-stage-dot"></span>
                      {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'}
                    </span>
                  ) : (
                    <span style={{ color: '#10b981' }}>-</span>
                  )}
                </td>
                <td style={{ fontSize: '0.875rem' }}>{rfi.assigned_to_name || '-'}</td>
                <td>
                  <div className="sales-actions-cell">
                    <Link
                      to={`/projects/${projectId}/rfis/${rfi.id}/edit`}
                      className="sales-action-btn"
                      title="Edit"
                      style={{ textDecoration: 'none' }}
                    >
                      <EditIcon fontSize="small" />
                    </Link>
                    <button
                      className="sales-action-btn"
                      onClick={() => handlePreview(rfi)}
                      title="Preview"
                    >
                      <VisibilityIcon fontSize="small" />
                    </button>
                    <button
                      className="sales-action-btn"
                      onClick={() => handleSend(rfi)}
                      disabled={sendingRFI === rfi.id}
                      title="Email with Outlook"
                    >
                      {sendingRFI === rfi.id ? <HourglassEmptyIcon fontSize="small" /> : <SendIcon fontSize="small" />}
                    </button>
                    <button
                      className="sales-action-btn"
                      onClick={() => handleDownloadPDF(rfi.id, rfi.number)}
                      title="Download PDF"
                    >
                      <PictureAsPdfIcon fontSize="small" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {filteredRFIs?.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: '#8888a0', padding: '3rem' }}>
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
