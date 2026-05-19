import React from 'react';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CashFlowRankWidget, { CashFlowRankConfig } from './CashFlowRankWidget';
import { WidgetProps } from '../types';

const config: CashFlowRankConfig = {
  title: 'Top Cash Flow Negative',
  icon: <TrendingDownIcon className="card-title-icon" />,
  metric: 'cash_flow',
  direction: 'asc',
  predicate: (v) => v < 0,
  datasetLabel: 'Cash Flow',
  backgroundColor: '#dc2626',
  borderColor: '#991b1b',
  emptyMessages: {
    my: 'No cash-flow-negative projects assigned to you',
    team: 'No cash-flow-negative projects on your team',
    default: 'No cash-flow-negative projects',
  },
  viewReportLink: '/reports/cash-flow',
};

const CashFlowNegativeWidget: React.FC<WidgetProps> = (props) => (
  <CashFlowRankWidget {...props} config={config} />
);

export default CashFlowNegativeWidget;
