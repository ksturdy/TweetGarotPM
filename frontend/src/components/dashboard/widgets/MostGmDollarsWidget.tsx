import React from 'react';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CashFlowRankWidget, { CashFlowRankConfig } from './CashFlowRankWidget';
import { WidgetProps } from '../types';

const config: CashFlowRankConfig = {
  title: 'Most GM $',
  icon: <AttachMoneyIcon className="card-title-icon" />,
  metric: 'gross_profit_dollars',
  direction: 'desc',
  predicate: (v) => v > 0,
  datasetLabel: 'Gross Profit',
  backgroundColor: '#7c3aed',
  borderColor: '#5b21b6',
  emptyMessages: {
    my: 'No GM data on projects assigned to you',
    team: 'No GM data on your team',
    default: 'No GM data available',
  },
};

const MostGmDollarsWidget: React.FC<WidgetProps> = (props) => (
  <CashFlowRankWidget {...props} config={config} />
);

export default MostGmDollarsWidget;
