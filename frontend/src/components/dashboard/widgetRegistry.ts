import { WidgetDefinition } from './types';
import KpiCardsWidget from './widgets/KpiCardsWidget';
import NeedsAttentionWidget from './widgets/NeedsAttentionWidget';
import RecentEstimatesWidget from './widgets/RecentEstimatesWidget';
import ActiveProjectsWidget from './widgets/ActiveProjectsWidget';
import ActiveOpportunitiesWidget from './widgets/ActiveOpportunitiesWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import TradeShowsWidget from './widgets/TradeShowsWidget';

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
    locked: true,
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
};

export const getWidget = (id: string): WidgetDefinition | undefined => widgetRegistry[id];

export const allWidgets = (): WidgetDefinition[] => Object.values(widgetRegistry);
