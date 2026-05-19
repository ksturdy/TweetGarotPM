import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../../services/projects';
import opportunitiesService from '../../../services/opportunities';
import { cashFlowReportApi } from '../../../services/cashFlowReport';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InventoryIcon from '@mui/icons-material/Inventory';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { WidgetProps } from '../types';
import { formatCurrency } from '../utils';

const fmtSignedCurrency = (n: number) => {
  const abs = Math.abs(n);
  let body: string;
  if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) body = `$${(abs / 1_000).toFixed(0)}K`;
  else body = `$${Math.round(abs)}`;
  return n < 0 ? `-${body}` : body;
};

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

  const { data: cashFlowData } = useQuery({
    queryKey: ['cash-flow-report'],
    queryFn: () => cashFlowReportApi.getData(),
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

  const cashFlowMetrics = React.useMemo(() => {
    if (!cashFlowData) return { backlog: 0, gmPercent: null as number | null, totalCashFlow: 0 };

    const teamIds = teamMemberEmployeeIds.map(Number);
    const scoped = cashFlowData.filter((p) => {
      switch (viewScope) {
        case 'my':
          return Number(p.manager_id) === Number(currentEmployeeId);
        case 'team':
          return teamIds.includes(Number(p.manager_id));
        case 'company':
        default:
          return true;
      }
    }).filter((p) => p.status === 'Open' || p.status === 'Soft-Closed');

    let totalBacklog = 0;
    let weightedGm = 0;
    let totalCashFlow = 0;
    for (const p of scoped) {
      const backlog = Number(p.backlog ?? 0);
      if (!Number.isNaN(backlog)) {
        totalBacklog += backlog;
        const gm = Number(p.gross_profit_percent);
        if (!Number.isNaN(gm) && backlog > 0) {
          weightedGm += gm * backlog;
        }
      }
      const cf = Number(p.cash_flow ?? 0);
      if (!Number.isNaN(cf)) totalCashFlow += cf;
    }

    const gmPercent = totalBacklog > 0 ? weightedGm / totalBacklog : null;
    return { backlog: totalBacklog, gmPercent, totalCashFlow };
  }, [cashFlowData, viewScope, currentEmployeeId, teamMemberEmployeeIds]);

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

  const gmPct = cashFlowMetrics.gmPercent;
  const gmDisplay = gmPct == null ? '—' : `${(gmPct * 100).toFixed(1)}%`;
  const cashFlowClass =
    cashFlowMetrics.totalCashFlow > 0 ? 'kpi-icon-green' :
    cashFlowMetrics.totalCashFlow < 0 ? 'kpi-icon-red' :
    'kpi-icon-blue';

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

      <div className="kpi-card" title="Open + Soft-Closed projects. Weighted average GM% by backlog.">
        <div className="kpi-icon kpi-icon-teal">
          <Inventory2Icon />
        </div>
        <div className="kpi-content">
          <div className="kpi-value">
            {formatCurrency(cashFlowMetrics.backlog)}
            <span className="kpi-subvalue"> / {gmDisplay}</span>
          </div>
          <div className="kpi-label">Backlog $ / GM%</div>
        </div>
        <Link to="/reports/cash-flow" className="kpi-link">
          <ArrowForwardIcon fontSize="small" />
        </Link>
      </div>

      <div className="kpi-card" title="Sum of cash flow on Open + Soft-Closed projects.">
        <div className={`kpi-icon ${cashFlowClass}`}>
          <AccountBalanceWalletIcon />
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{fmtSignedCurrency(cashFlowMetrics.totalCashFlow)}</div>
          <div className="kpi-label">Total Cash Flow</div>
        </div>
        <Link to="/reports/cash-flow" className="kpi-link">
          <ArrowForwardIcon fontSize="small" />
        </Link>
      </div>
    </div>
  );
};

export default KpiCardsWidget;
