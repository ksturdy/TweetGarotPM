import { WidgetDefinition } from './types';
import KpiCardsWidget from './widgets/KpiCardsWidget';
import NeedsAttentionWidget from './widgets/NeedsAttentionWidget';
import RecentEstimatesWidget from './widgets/RecentEstimatesWidget';
import ActiveProjectsWidget from './widgets/ActiveProjectsWidget';
import ActiveOpportunitiesWidget from './widgets/ActiveOpportunitiesWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import TradeShowsWidget from './widgets/TradeShowsWidget';
import CashFlowNegativeWidget from './widgets/CashFlowNegativeWidget';
import CashFlowPositiveWidget from './widgets/CashFlowPositiveWidget';
import LargestBacklogWidget from './widgets/LargestBacklogWidget';
import MostGmDollarsWidget from './widgets/MostGmDollarsWidget';

export const widgetRegistry: Record<string, WidgetDefinition> = {
  kpi_cards: {
    id: 'kpi_cards',
    title: 'KPI Cards',
    category: 'overview',
    defaultColumn: 'kpi',
    locked: true,
    component: KpiCardsWidget,
  },
  needs_attention: {
    id: 'needs_attention',
    title: 'Needs Attention',
    category: 'overview',
    defaultColumn: 'left',
    component: NeedsAttentionWidget,
  },
  recent_estimates: {
    id: 'recent_estimates',
    title: 'Recent Estimates',
    category: 'sales',
    defaultColumn: 'left',
    component: RecentEstimatesWidget,
  },
  active_projects: {
    id: 'active_projects',
    title: 'Active Projects',
    category: 'projects',
    defaultColumn: 'center',
    component: ActiveProjectsWidget,
  },
  active_opportunities: {
    id: 'active_opportunities',
    title: 'Active Opportunities',
    category: 'sales',
    defaultColumn: 'center',
    component: ActiveOpportunitiesWidget,
  },
  recent_activity: {
    id: 'recent_activity',
    title: 'Recent Activity',
    category: 'overview',
    defaultColumn: 'right',
    component: RecentActivityWidget,
  },
  trade_shows: {
    id: 'trade_shows',
    title: 'Trade Shows',
    category: 'marketing',
    defaultColumn: 'right',
    component: TradeShowsWidget,
  },
  cash_flow_negative: {
    id: 'cash_flow_negative',
    title: 'Top Cash Flow Negative',
    category: 'projects',
    defaultColumn: 'center',
    component: CashFlowNegativeWidget,
  },
  cash_flow_positive: {
    id: 'cash_flow_positive',
    title: 'Top Cash Flow Positive',
    category: 'projects',
    defaultColumn: 'center',
    component: CashFlowPositiveWidget,
  },
  largest_backlog: {
    id: 'largest_backlog',
    title: 'Largest Backlog $',
    category: 'projects',
    defaultColumn: 'center',
    component: LargestBacklogWidget,
  },
  most_gm_dollars: {
    id: 'most_gm_dollars',
    title: 'Most GM $',
    category: 'projects',
    defaultColumn: 'center',
    component: MostGmDollarsWidget,
  },
};

export const getWidget = (id: string): WidgetDefinition | undefined => widgetRegistry[id];

export const allWidgets = (): WidgetDefinition[] => Object.values(widgetRegistry);
