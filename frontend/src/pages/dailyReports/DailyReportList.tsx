import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dailyReportsApi } from '../../services/dailyReports';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';

const DailyReportList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

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
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}`}>&larr; Back to {project?.name || 'Project'}</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Daily Reports</h1>
        <button className="btn btn-primary">New Report</button>
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
            </tr>
          </thead>
          <tbody>
            {reports?.map((report) => (
              <tr key={report.id}>
                <td>{format(new Date(report.report_date), 'MMM d, yyyy')}</td>
                <td>{report.weather || '-'}</td>
                <td>{report.temperature || '-'}</td>
                <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {report.work_performed}
                </td>
                <td>{report.created_by_name}</td>
              </tr>
            ))}
            {reports?.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
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
