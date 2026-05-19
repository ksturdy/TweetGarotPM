import React from 'react';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import GmTrendRankWidget, { GmTrendRankConfig } from './GmTrendRankWidget';
import { WidgetProps } from '../types';

const config: GmTrendRankConfig = {
  title: 'Top 10 Trending Down GM%',
  icon: <TrendingDownIcon className="card-title-icon" />,
  direction: 'down',
  backgroundColor: '#dc2626',
  borderColor: '#991b1b',
  emptyMessages: {
    my: 'No GM% declines on projects assigned to you',
    team: 'No GM% declines on your team',
    default: 'No GM% declines across projects',
  },
};

const GmTrendingDownWidget: React.FC<WidgetProps> = (props) => (
  <GmTrendRankWidget {...props} config={config} />
);

export default GmTrendingDownWidget;
