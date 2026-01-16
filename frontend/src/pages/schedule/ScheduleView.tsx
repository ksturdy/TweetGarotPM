import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { scheduleApi } from '../../services/schedule';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';

const ScheduleView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ['schedule', projectId],
    queryFn: () => scheduleApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  const { data: progress } = useQuery({
    queryKey: ['scheduleProgress', projectId],
    queryFn: () => scheduleApi.getProgress(Number(projectId)).then((res) => res.data),
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
        <h1 className="page-title" style={{ margin: 0 }}>Schedule</h1>
        <button className="btn btn-primary">Add Task</button>
      </div>

      {progress && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Project Progress</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Overall Progress</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                {Math.round(Number(progress.average_progress) || 0)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Tasks Completed</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {progress.completed_items} / {progress.total_items}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Start Date</div>
              <div>{progress.project_start ? format(new Date(progress.project_start), 'MMM d, yyyy') : '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>End Date</div>
              <div>{progress.project_end ? format(new Date(progress.project_end), 'MMM d, yyyy') : '-'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Assigned To</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{format(new Date(item.start_date), 'MMM d, yyyy')}</td>
                <td>{format(new Date(item.end_date), 'MMM d, yyyy')}</td>
                <td>{item.assigned_to_name || '-'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${item.percent_complete}%`,
                          height: '100%',
                          backgroundColor: item.percent_complete === 100 ? 'var(--success)' : 'var(--primary)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.875rem', minWidth: '40px' }}>{item.percent_complete}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {items?.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No schedule items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleView;
