import { DashboardLayout } from './types';

export const defaultLayout: DashboardLayout = [
  { id: 'kpi_cards', column: 'kpi', order: 0, visible: true },
  { id: 'needs_attention', column: 'left', order: 0, visible: true },
  { id: 'recent_estimates', column: 'left', order: 1, visible: true },
  { id: 'active_projects', column: 'center', order: 0, visible: true },
  { id: 'active_opportunities', column: 'center', order: 1, visible: true },
  { id: 'cash_flow_negative', column: 'center', order: 2, visible: false },
  { id: 'cash_flow_positive', column: 'center', order: 3, visible: false },
  { id: 'largest_backlog', column: 'center', order: 4, visible: false },
  { id: 'most_gm_dollars', column: 'center', order: 5, visible: false },
  { id: 'gm_trending_down', column: 'center', order: 6, visible: false },
  { id: 'gm_trending_up', column: 'center', order: 7, visible: false },
  { id: 'recent_activity', column: 'right', order: 0, visible: true },
  { id: 'trade_shows', column: 'right', order: 1, visible: false },
];
