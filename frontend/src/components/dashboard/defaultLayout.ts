import { DashboardLayout } from './types';

export const defaultLayout: DashboardLayout = [
  { id: 'kpi_cards', column: 'kpi', order: 0, visible: true },
  { id: 'needs_attention', column: 'left', order: 0, visible: true },
  { id: 'recent_estimates', column: 'left', order: 1, visible: true },
  { id: 'active_projects', column: 'center', order: 0, visible: true },
  { id: 'active_opportunities', column: 'center', order: 1, visible: true },
  { id: 'recent_activity', column: 'right', order: 0, visible: true },
  { id: 'trade_shows', column: 'right', order: 1, visible: true },
];
