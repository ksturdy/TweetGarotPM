import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { employeesApi } from '../services/employees';
import { teamsApi } from '../services/teams';
import { projectsApi } from '../services/projects';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import TuneIcon from '@mui/icons-material/Tune';
import { ViewScope, DashboardColumn, WidgetLayoutItem } from '../components/dashboard/types';
import { getWidget } from '../components/dashboard/widgetRegistry';
import { getGreeting } from '../components/dashboard/utils';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import CustomizeDashboardDrawer from '../components/dashboard/CustomizeDashboardDrawer';
import './Dashboard.css';
import '../styles/SalesPipeline.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [viewScope, setViewScope] = useState<ViewScope>('my');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { layout, save, reset, isSaving } = useDashboardLayout();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  const { data: currentEmployeeResponse } = useQuery({
    queryKey: ['current-employee', user?.id],
    queryFn: () => user?.id ? employeesApi.getByUserId(user.id).then(res => res.data) : Promise.resolve(null),
    enabled: !!user?.id,
  });
  const currentEmployeeId = currentEmployeeResponse?.data?.id;

  const { data: teamMemberIdsResponse } = useQuery({
    queryKey: ['my-team-member-ids'],
    queryFn: () => teamsApi.getMyTeamMemberIds(),
    enabled: !!user?.id,
  });
  const teamMemberEmployeeIds = teamMemberIdsResponse?.data?.data?.employeeIds || [];
  const teamMemberUserIds = teamMemberIdsResponse?.data?.data?.userIds || [];
  const teamMemberNames = teamMemberIdsResponse?.data?.data?.names || [];

  // Loading gate: keep parity with previous behavior of waiting for projects
  const { isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

  const widgetProps = {
    viewScope,
    currentEmployeeId,
    currentUserId: user?.id,
    currentUserName: user ? `${user.firstName} ${user.lastName}` : '',
    teamMemberEmployeeIds,
    teamMemberUserIds,
    teamMemberNames,
  };

  const widgetsByColumn = useMemo(() => {
    const grouped: Record<DashboardColumn, WidgetLayoutItem[]> = {
      kpi: [], left: [], center: [], right: [],
    };
    layout
      .filter(item => item.visible)
      .forEach(item => {
        grouped[item.column].push(item);
      });
    (Object.keys(grouped) as DashboardColumn[]).forEach(col => {
      grouped[col].sort((a, b) => a.order - b.order);
    });
    return grouped;
  }, [layout]);

  const renderWidgets = (column: DashboardColumn) =>
    widgetsByColumn[column].map(item => {
      const def = getWidget(item.id);
      if (!def) return null;
      const Component = def.component;
      return <Component key={item.id} {...widgetProps} />;
    });

  const getViewLabel = () => {
    switch (viewScope) {
      case 'my': return 'your';
      case 'team': return "your team's";
      case 'company': return 'company-wide';
    }
  };

  if (projectsLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header-row">
        <div className="dashboard-welcome">
          <div className="welcome-text">
            <h1>{getGreeting()}, {user?.firstName || 'User'}</h1>
            <p>Here's what's happening with {getViewLabel()} projects today.</p>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewScope === 'my' ? 'active' : ''}`}
              onClick={() => setViewScope('my')}
            >
              <PersonIcon fontSize="small" />
              <span>My Work</span>
            </button>
            <button
              className={`view-toggle-btn ${viewScope === 'team' ? 'active' : ''}`}
              onClick={() => setViewScope('team')}
            >
              <GroupsIcon fontSize="small" />
              <span>My Team</span>
            </button>
            <button
              className={`view-toggle-btn ${viewScope === 'company' ? 'active' : ''}`}
              onClick={() => setViewScope('company')}
            >
              <BusinessIcon fontSize="small" />
              <span>Company</span>
            </button>
          </div>
          <button
            className="customize-button"
            onClick={() => setCustomizeOpen(true)}
            title="Customize dashboard"
          >
            <TuneIcon fontSize="small" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {renderWidgets('kpi')}

      <div className="dashboard-grid">
        <div className="dashboard-left">
          {renderWidgets('left')}
        </div>
        <div className="dashboard-right">
          {renderWidgets('center')}
        </div>
        <div className="dashboard-activity">
          {renderWidgets('right')}
        </div>
      </div>

      <CustomizeDashboardDrawer
        open={customizeOpen}
        layout={layout}
        onClose={() => setCustomizeOpen(false)}
        onSave={(next) => {
          save(next);
          setCustomizeOpen(false);
        }}
        onReset={() => reset()}
        isSaving={isSaving}
      />
    </div>
  );
};

export default Dashboard;
