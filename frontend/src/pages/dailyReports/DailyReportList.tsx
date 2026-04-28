import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dailyReportsApi } from '../../services/dailyReports';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';
import '../../styles/SalesPipeline.css';

const DailyReportList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: reports, isLoading } = useQuery({
    queryKey: ['dailyReports', projectId],
    queryFn: () => dailyReportsApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Project
            </Link>
            <h1>📋 Daily Reports</h1>
            <div className="sales-subtitle">{project?.name || 'Project'} - Daily Reports</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn btn-primary">New Report</button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Weather</th>
              <th>Temperature</th>
              <th>Work Performed</th>
              <th>Created By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reports?.map((report) => (
              <tr
                key={report.id}
                onClick={() => navigate(`/projects/${projectId}/daily-reports/${report.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td>{format(new Date(report.report_date + 'T00:00:00'), 'MMM d, yyyy')}</td>
                <td>{report.weather || '-'}</td>
                <td>{report.temperature || '-'}</td>
                <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {report.work_performed}
                </td>
                <td>{report.created_by_name}</td>
                <td>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'white',
                    backgroundColor: report.status === 'approved' ? '#22c55e' : report.status === 'submitted' ? '#3b82f6' : report.status === 'revision' ? '#ef4444' : '#f59e0b',
                    textTransform: 'capitalize',
                  }}>
                    {report.status}
                  </span>
                </td>
              </tr>
            ))}
            {reports?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No daily reports found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DailyReportList;
