import React from 'react';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CashFlowRankWidget, { CashFlowRankConfig } from './CashFlowRankWidget';
import { WidgetProps } from '../types';

const config: CashFlowRankConfig = {
  title: 'Largest Backlog $',
  icon: <Inventory2Icon className="card-title-icon" />,
  metric: 'backlog',
  direction: 'desc',
  predicate: (v) => v > 0,
  datasetLabel: 'Backlog',
  backgroundColor: '#2563eb',
  borderColor: '#1e40af',
  emptyMessages: {
    my: 'No backlog on projects assigned to you',
    team: 'No backlog on your team',
    default: 'No backlog data available',
  },
};

const LargestBacklogWidget: React.FC<WidgetProps> = (props) => (
  <CashFlowRankWidget {...props} config={config} />
);

export default LargestBacklogWidget;
