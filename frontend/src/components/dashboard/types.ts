import { ComponentType } from 'react';

export type ViewScope = 'my' | 'team' | 'company';

export type DashboardColumn = 'kpi' | 'left' | 'center' | 'right';

export type WidgetId = string;

export interface WidgetProps {
  viewScope: ViewScope;
  currentEmployeeId?: number;
  currentUserId?: number;
  currentUserName?: string;
  teamMemberEmployeeIds: number[];
  teamMemberUserIds: number[];
  teamMemberNames: string[];
}

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  category: 'overview' | 'sales' | 'projects' | 'marketing' | 'field';
  defaultColumn: DashboardColumn;
  locked?: boolean;
  component: ComponentType<WidgetProps>;
}

export interface WidgetLayoutItem {
  id: WidgetId;
  column: DashboardColumn;
  order: number;
  visible: boolean;
}

export type DashboardLayout = WidgetLayoutItem[];
