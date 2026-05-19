import React from 'react';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CashFlowRankWidget, { CashFlowRankConfig } from './CashFlowRankWidget';
import { WidgetProps } from '../types';

const config: CashFlowRankConfig = {
  title: 'Top Cash Flow Positive',
  icon: <TrendingUpIcon className="card-title-icon" />,
  metric: 'cash_flow',
  direction: 'desc',
  predicate: (v) => v > 0,
  datasetLabel: 'Cash Flow',
  backgroundColor: '#16a34a',
  borderColor: '#166534',
  emptyMessages: {
    my: 'No cash-flow-positive projects assigned to you',
    team: 'No cash-flow-positive projects on your team',
    default: 'No cash-flow-positive projects',
  },
  viewReportLink: '/reports/cash-flow',
};

const CashFlowPositiveWidget: React.FC<WidgetProps> = (props) => (
  <CashFlowRankWidget {...props} config={config} />
);

export default CashFlowPositiveWidget;
