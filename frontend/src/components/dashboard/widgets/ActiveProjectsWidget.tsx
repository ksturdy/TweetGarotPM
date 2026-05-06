import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../../services/projects';
import FolderIcon from '@mui/icons-material/Folder';
import { WidgetProps } from '../types';
import {
  getMarketGradient,
  getMarketIcon,
  getProjectGradient,
  getProjectIcon,
  getStatusColor,
  getManagerInitials,
  getManagerColor,
} from '../utils';

const ActiveProjectsWidget: React.FC<WidgetProps> = ({
  viewScope,
  currentEmployeeId,
  teamMemberEmployeeIds,
}) => {
  const navigate = useNavigate();

  const { data: allProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

  const projects = React.useMemo(() => {
    if (!allProjects) return [];
    switch (viewScope) {
      case 'my':
        return allProjects.filter((p: any) => Number(p.manager_id) === Number(currentEmployeeId));
      case 'team':
        return allProjects.filter((p: any) => teamMemberEmployeeIds.map(Number).includes(Number(p.manager_id)));
      case 'company':
      default:
        return allProjects;
    }
  }, [allProjects, viewScope, currentEmployeeId, teamMemberEmployeeIds]);

  const activeProjects = projects?.filter((p: any) =>
    p.status === 'active' || p.status === 'Open'
  ) || [];

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <FolderIcon className="card-title-icon" />
          Active Projects
        </h2>
        <Link to="/projects" state={{ myItemsOnly: viewScope === 'my' }} className="card-link">View all</Link>
      </div>
      <div className="dashboard-table-container dashboard-scrollable">
        <table className="sales-table dashboard-compact-table">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Project</th>
              <th style={{ width: '22%' }}>PM</th>
              <th style={{ width: '14%' }}>Status</th>
              <th style={{ width: '14%', textAlign: 'right' }}>% Complete</th>
            </tr>
          </thead>
          <tbody>
            {activeProjects.map((project: any) => {
              const pct = project.percent_complete != null ? Math.round(Number(project.percent_complete) * 100) : null;
              return (
                <tr
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: project.market ? getMarketGradient(project.market) : getProjectGradient(project.status), width: '32px', height: '32px', fontSize: '0.75rem' }}>
                        {project.market ? getMarketIcon(project.market) : getProjectIcon(project.status)}
                      </div>
                      <div className="sales-project-info">
                        <h4>{project.name}</h4>
                        <span>{project.owner_name || project.customer_name || project.client || ''}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {project.manager_name ? (
                      <div className="sales-salesperson-cell">
                        <div
                          className="sales-salesperson-avatar"
                          style={{ background: getManagerColor(project.manager_name) }}
                        >
                          {getManagerInitials(project.manager_name)}
                        </div>
                        {project.manager_name}
                      </div>
                    ) : (
                      <span style={{ color: '#8888a0', fontSize: '0.8125rem' }}>-</span>
                    )}
                  </td>
                  <td>
                    <span className={`sales-stage-badge ${project.status.toLowerCase().replace('-', '_')}`}>
                      <span className="sales-stage-dot" style={{ background: getStatusColor(project.status) }}></span>
                      {project.status.includes('-') ? project.status : project.status.replace('_', ' ').charAt(0).toUpperCase() + project.status.replace('_', ' ').slice(1)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: '#1a1a2e' }}>
                    {pct != null ? `${pct}%` : '-'}
                  </td>
                </tr>
              );
            })}
            {activeProjects.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-table">
                  {viewScope === 'my' ? 'No projects assigned to you' : 'No active projects'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActiveProjectsWidget;
