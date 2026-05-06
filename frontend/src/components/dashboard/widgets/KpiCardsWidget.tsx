import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../../services/projects';
import opportunitiesService from '../../../services/opportunities';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InventoryIcon from '@mui/icons-material/Inventory';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { WidgetProps } from '../types';
import { formatCurrency } from '../utils';

const KpiCardsWidget: React.FC<WidgetProps> = ({
  viewScope,
  currentEmployeeId,
  teamMemberEmployeeIds,
}) => {
  const { data: allProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

  const { data: allOpportunities } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => opportunitiesService.getAll(),
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

  const opportunities = React.useMemo(() => {
    if (!allOpportunities) return [];
    switch (viewScope) {
      case 'my':
        return allOpportunities.filter((o: any) => Number(o.assigned_to) === Number(currentEmployeeId));
      case 'team':
        return allOpportunities.filter((o: any) => teamMemberEmployeeIds.map(Number).includes(Number(o.assigned_to)));
      case 'company':
      default:
        return allOpportunities;
    }
  }, [allOpportunities, viewScope, currentEmployeeId, teamMemberEmployeeIds]);

  const activeProjects = projects?.filter((p: any) =>
    p.status === 'active' || p.status === 'Open'
  ) || [];
  const totalProjects = projects?.length || 0;

  const pipelineValue = opportunities?.reduce((sum: number, opp: any) => {
    const stageName = opp.stage_name?.toLowerCase() || '';
    if (stageName !== 'won' && stageName !== 'lost') {
      return sum + (parseFloat(opp.estimated_value) || 0);
    }
    return sum;
  }, 0) || 0;

  const openOpportunities = opportunities?.filter((o: any) => {
    const stageName = o.stage_name?.toLowerCase() || '';
    return stageName !== 'won' && stageName !== 'lost';
  }).length || 0;

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-icon kpi-icon-blue">
          <FolderIcon />
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{activeProjects.length}</div>
          <div className="kpi-label">Active Projects</div>
        </div>
        <Link to="/projects" className="kpi-link">
          <ArrowForwardIcon fontSize="small" />
        </Link>
      </div>

      <div className="kpi-card">
        <div className="kpi-icon kpi-icon-orange">
          <TrendingUpIcon />
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{formatCurrency(pipelineValue)}</div>
          <div className="kpi-label">Pipeline Value</div>
        </div>
        <Link to="/sales" className="kpi-link">
          <ArrowForwardIcon fontSize="small" />
        </Link>
      </div>

      <div className="kpi-card">
        <div className="kpi-icon kpi-icon-green">
          <AssignmentIcon />
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{openOpportunities}</div>
          <div className="kpi-label">Active Opportunities</div>
        </div>
        <Link to="/sales" className="kpi-link">
          <ArrowForwardIcon fontSize="small" />
        </Link>
      </div>

      <div className="kpi-card">
        <div className="kpi-icon kpi-icon-purple">
          <InventoryIcon />
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{totalProjects}</div>
          <div className="kpi-label">Total Projects</div>
        </div>
        <Link to="/projects" className="kpi-link">
          <ArrowForwardIcon fontSize="small" />
        </Link>
      </div>
    </div>
  );
};

export default KpiCardsWidget;
