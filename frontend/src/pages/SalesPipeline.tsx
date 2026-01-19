import React, { useState } from 'react';
import OpportunityKanban from '../components/opportunities/OpportunityKanban';
import OpportunityAnalytics from '../components/opportunities/OpportunityAnalytics';
import '../styles/SalesPipeline.css';

const SalesPipeline: React.FC = () => {
  const [view, setView] = useState<'kanban' | 'analytics'>('kanban');

  return (
    <div className="sales-pipeline-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>Sales Pipeline</h1>
          <p className="header-subtitle">Track and manage your project opportunities</p>
        </div>

        {/* View Toggle */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${view === 'kanban' ? 'active' : ''}`}
            onClick={() => setView('kanban')}
          >
            <span className="toggle-icon">📋</span>
            Pipeline
          </button>
          <button
            className={`toggle-btn ${view === 'analytics' ? 'active' : ''}`}
            onClick={() => setView('analytics')}
          >
            <span className="toggle-icon">📊</span>
            Analytics
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="page-content">
        {view === 'kanban' ? (
          <OpportunityKanban />
        ) : (
          <OpportunityAnalytics />
        )}
      </div>
    </div>
  );
};

export default SalesPipeline;
