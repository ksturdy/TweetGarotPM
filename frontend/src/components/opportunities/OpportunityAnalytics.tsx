import React from 'react';
import { useQuery } from '@tanstack/react-query';
import opportunitiesService from '../../services/opportunities';
import '../../styles/OpportunityAnalytics.css';

const OpportunityAnalytics: React.FC = () => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['opportunities', 'analytics'],
    queryFn: () => opportunitiesService.getAnalytics()
  });

  const formatCurrency = (value?: number) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value?: number) => {
    if (!value) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  };

  const calculateWinRate = () => {
    if (!analytics) return 0;
    const total = analytics.won_count + analytics.lost_count;
    if (total === 0) return 0;
    return Math.round((analytics.won_count / total) * 100);
  };

  const calculateAvgDealSize = () => {
    if (!analytics || analytics.total_opportunities === 0) return 0;
    return analytics.total_pipeline_value / analytics.total_opportunities;
  };

  if (isLoading) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  if (!analytics) {
    return null;
  }

  const winRate = calculateWinRate();
  const avgDealSize = calculateAvgDealSize();

  return (
    <div className="opportunity-analytics">
      <h2 className="analytics-title">Pipeline Analytics</h2>

      {/* Key Metrics Grid */}
      <div className="analytics-grid">
        {/* Total Pipeline Value */}
        <div className="analytics-card primary">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <span className="card-label">Total Pipeline</span>
            <span className="card-value">{formatCurrency(analytics.total_pipeline_value)}</span>
            <span className="card-subtitle">
              {formatNumber(analytics.total_opportunities)} opportunities
            </span>
          </div>
        </div>

        {/* Won Value */}
        <div className="analytics-card success">
          <div className="card-icon">🎯</div>
          <div className="card-content">
            <span className="card-label">Won</span>
            <span className="card-value">{formatCurrency(analytics.won_value)}</span>
            <span className="card-subtitle">
              {formatNumber(analytics.won_count)} deals
            </span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="analytics-card info">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <span className="card-label">Win Rate</span>
            <span className="card-value">{winRate}%</span>
            <span className="card-subtitle">
              {formatNumber(analytics.won_count)} of {formatNumber(analytics.won_count + analytics.lost_count)} closed
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill success"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>

        {/* Average Deal Size */}
        <div className="analytics-card">
          <div className="card-icon">💵</div>
          <div className="card-content">
            <span className="card-label">Avg Deal Size</span>
            <span className="card-value">{formatCurrency(avgDealSize)}</span>
            <span className="card-subtitle">per opportunity</span>
          </div>
        </div>

        {/* Average Days to Close */}
        <div className="analytics-card">
          <div className="card-icon">⏱️</div>
          <div className="card-content">
            <span className="card-label">Avg Days to Close</span>
            <span className="card-value">
              {Math.round(analytics.avg_days_to_close || 0)}
            </span>
            <span className="card-subtitle">days</span>
          </div>
        </div>

        {/* Lost Value */}
        <div className="analytics-card warning">
          <div className="card-icon">❌</div>
          <div className="card-content">
            <span className="card-label">Lost</span>
            <span className="card-value">{formatCurrency(analytics.lost_value)}</span>
            <span className="card-subtitle">
              {formatNumber(analytics.lost_count)} deals
            </span>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="conversion-funnel">
        <h3>Conversion Funnel</h3>
        <div className="funnel-stages">
          <div className="funnel-stage">
            <div className="stage-bar" style={{ width: '100%' }}>
              <span className="stage-label">Total Leads</span>
              <span className="stage-value">{formatNumber(analytics.total_opportunities)}</span>
            </div>
          </div>

          <div className="funnel-stage">
            <div
              className="stage-bar success"
              style={{
                width: `${analytics.total_opportunities > 0
                  ? (analytics.won_count / analytics.total_opportunities) * 100
                  : 0}%`
              }}
            >
              <span className="stage-label">Won</span>
              <span className="stage-value">{formatNumber(analytics.won_count)}</span>
            </div>
          </div>

          <div className="funnel-stage">
            <div
              className="stage-bar danger"
              style={{
                width: `${analytics.total_opportunities > 0
                  ? (analytics.lost_count / analytics.total_opportunities) * 100
                  : 0}%`
              }}
            >
              <span className="stage-label">Lost</span>
              <span className="stage-value">{formatNumber(analytics.lost_count)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpportunityAnalytics;
