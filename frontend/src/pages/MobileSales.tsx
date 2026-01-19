import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import opportunitiesService, { Opportunity as OpportunityType } from '../services/opportunities';
import OpportunityModal from '../components/opportunities/OpportunityModal';
import '../styles/MobileSales.css';

const MobileSales: React.FC = () => {
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityType | null>(null);

  // Fetch real opportunities from API
  const { data: apiOpportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => opportunitiesService.getAll()
  });

  // Fetch pipeline stages
  const { data: pipelineStages = [], isLoading: isStagesLoading } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => opportunitiesService.getStages()
  });

  // Helper to convert probability to percentage
  const getProbabilityPercent = (probability: number | string): number => {
    if (typeof probability === 'number') return probability;
    if (probability === 'Low') return 15;
    if (probability === 'Medium') return 40;
    if (probability === 'High') return 80;
    return 0;
  };

  // Calculate KPIs
  const totalPipeline = apiOpportunities.reduce((sum, opp) => sum + (Number(opp.estimated_value) || 0), 0);
  const weightedPipeline = apiOpportunities.reduce((sum, opp) => {
    const value = Number(opp.estimated_value) || 0;
    const prob = getProbabilityPercent(opp.probability || opp.stage_probability || 0);
    return sum + (value * prob / 100);
  }, 0);
  const activeOpportunities = apiOpportunities.filter(opp => opp.stage_name !== 'Awarded' && opp.stage_name !== 'Lost').length;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const getMarketIcon = (market?: string): string => {
    const marketIcons: { [key: string]: string } = {
      'Healthcare': '🏥',
      'Education': '🏫',
      'Commercial': '🏢',
      'Industrial': '🏭',
      'Retail': '🏬',
      'Government': '🏛️',
      'Hospitality': '🏨',
      'Data Center': '💾'
    };
    return marketIcons[market || ''] || '🏢';
  };

  const getStageColor = (stageName: string): string => {
    const stage = pipelineStages.find(s => s.name === stageName);
    return stage?.color || '#6b7280';
  };

  // Filter opportunities by stage
  const filteredOpportunities = selectedStage === 'all'
    ? apiOpportunities
    : apiOpportunities.filter(opp => opp.stage_name === selectedStage);

  // Group by stage for quick stats
  const activeStages = pipelineStages.filter(stage =>
    stage.name !== 'Lost' && stage.name !== 'Passed'
  ).sort((a, b) => a.display_order - b.display_order);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOpportunity(null);
  };

  const handleSaveOpportunity = () => {
    setIsModalOpen(false);
    setSelectedOpportunity(null);
  };

  if (isLoading) {
    return (
      <div className="mobile-sales-container">
        <div className="mobile-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mobile-sales-container">
      {/* Header */}
      <div className="mobile-sales-header">
        <h1>📊 Sales Pipeline</h1>
        <button
          className="mobile-add-btn"
          onClick={() => {
            setSelectedOpportunity(null);
            setIsModalOpen(true);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* KPI Cards - Swipeable on mobile */}
      <div className="mobile-kpi-scroll">
        <div className="mobile-kpi-card blue">
          <div className="mobile-kpi-label">Total Pipeline</div>
          <div className="mobile-kpi-value">{formatCurrency(totalPipeline)}</div>
          <div className="mobile-kpi-trend up">↑ +12.5%</div>
        </div>
        <div className="mobile-kpi-card green">
          <div className="mobile-kpi-label">Weighted</div>
          <div className="mobile-kpi-value">{formatCurrency(weightedPipeline)}</div>
          <div className="mobile-kpi-trend up">↑ +8.3%</div>
        </div>
        <div className="mobile-kpi-card amber">
          <div className="mobile-kpi-label">Active</div>
          <div className="mobile-kpi-value">{activeOpportunities}</div>
          <div className="mobile-kpi-trend up">↑ +5</div>
        </div>
      </div>

      {/* Stage Filter Chips */}
      <div className="mobile-stage-filter">
        <button
          className={`mobile-filter-chip ${selectedStage === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedStage('all')}
        >
          All ({apiOpportunities.length})
        </button>
        {activeStages.map(stage => {
          const count = apiOpportunities.filter(o => o.stage_name === stage.name).length;
          return (
            <button
              key={stage.id}
              className={`mobile-filter-chip ${selectedStage === stage.name ? 'active' : ''}`}
              onClick={() => setSelectedStage(stage.name)}
              style={selectedStage === stage.name ? { backgroundColor: stage.color, color: '#fff' } : {}}
            >
              {stage.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Opportunities List - Card based for mobile */}
      <div className="mobile-opportunities-list">
        {filteredOpportunities.length === 0 ? (
          <div className="mobile-empty-state">
            <div className="mobile-empty-icon">📭</div>
            <div className="mobile-empty-text">No opportunities found</div>
          </div>
        ) : (
          filteredOpportunities.map((opp) => (
            <div
              key={opp.id}
              className="mobile-opportunity-card"
              onClick={() => {
                setSelectedOpportunity(opp);
                setIsModalOpen(true);
              }}
            >
              <div className="mobile-opp-header">
                <div className="mobile-opp-icon">{getMarketIcon(opp.market)}</div>
                <div className="mobile-opp-title-section">
                  <h3 className="mobile-opp-title">{opp.title}</h3>
                  <div className="mobile-opp-subtitle">{opp.owner || 'No owner'}</div>
                </div>
              </div>

              <div className="mobile-opp-value">{formatCurrency(Number(opp.estimated_value) || 0)}</div>

              <div className="mobile-opp-meta">
                <span
                  className="mobile-stage-badge"
                  style={{ backgroundColor: `${getStageColor(opp.stage_name || '')}20`, color: getStageColor(opp.stage_name || '') }}
                >
                  {opp.stage_name || 'Lead'}
                </span>
                <span className="mobile-probability">
                  {typeof opp.probability === 'number'
                    ? `${opp.probability}%`
                    : opp.stage_probability
                    ? `${opp.stage_probability}%`
                    : 'N/A'}
                </span>
              </div>

              {opp.description && (
                <div className="mobile-opp-description">{opp.description}</div>
              )}

              <div className="mobile-opp-footer">
                <div className="mobile-opp-market">{opp.market || 'N/A'}</div>
                <div className="mobile-opp-date">
                  {new Date(opp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Opportunity Modal */}
      {isModalOpen && (
        <OpportunityModal
          opportunity={selectedOpportunity}
          onClose={handleCloseModal}
          onSave={handleSaveOpportunity}
        />
      )}

      {/* Bottom spacing for iOS home indicator */}
      <div className="mobile-bottom-spacer"></div>
    </div>
  );
};

export default MobileSales;
