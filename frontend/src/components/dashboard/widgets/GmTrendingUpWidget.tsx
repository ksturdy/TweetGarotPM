import React from 'react';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GmTrendRankWidget, { GmTrendRankConfig } from './GmTrendRankWidget';
import { WidgetProps } from '../types';

const config: GmTrendRankConfig = {
  title: 'Top 10 Trending Up GM%',
  icon: <TrendingUpIcon className="card-title-icon" />,
  direction: 'up',
  backgroundColor: '#16a34a',
  borderColor: '#166534',
  emptyMessages: {
    my: 'No GM% gains on projects assigned to you',
    team: 'No GM% gains on your team',
    default: 'No GM% gains across projects',
  },
};

const GmTrendingUpWidget: React.FC<WidgetProps> = (props) => (
  <GmTrendRankWidget {...props} config={config} />
);

export default GmTrendingUpWidget;
