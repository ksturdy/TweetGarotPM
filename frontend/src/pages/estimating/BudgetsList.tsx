import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { budgetsApi, Budget, BudgetStats } from '../../services/budgets';
import './BudgetsList.css';

const BudgetsList: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [buildingTypeFilter, setBuildingTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [stats, setStats] = useState<BudgetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch budgets on mount
  useEffect(() => {
    loadBudgets();
    loadStats();
  }, []);

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const response = await budgetsApi.getAll();
      setBudgets(response.data);
    } catch (err) {
      console.error('Error loading budgets:', err);
      setError('Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await budgetsApi.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) return;

    try {
      await budgetsApi.delete(id);
      setBudgets(budgets.filter(b => b.id !== id));
      if (selectedBudget?.id === id) {
        setSelectedBudget(null);
        setShowPreview(false);
      }
    } catch (err) {
      console.error('Error deleting budget:', err);
      alert('Failed to delete budget');
    }
  };

  const handleViewBudget = async (budget: Budget) => {
    try {
      const response = await budgetsApi.getById(budget.id);
      setSelectedBudget(response.data);
      setShowPreview(true);
    } catch (err) {
      console.error('Error loading budget details:', err);
      alert('Failed to load budget details');
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setSelectedBudget(null);
  };

  // Get building type icon and gradient
  const getBuildingTypeIcon = (buildingType: string) => {
    const icons: { [key: string]: { icon: string; gradient: string } } = {
      'Healthcare': { icon: '🏥', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
      'Education': { icon: '🏫', gradient: 'linear-gradient(135deg, #f59e0b, #f43f5e)' },
      'Commercial': { icon: '🏢', gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
      'Industrial': { icon: '🏭', gradient: 'linear-gradient(135deg, #06b6d4, #10b981)' },
      'Retail': { icon: '🏬', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
      'Government': { icon: '🏛️', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
      'Hospitality': { icon: '🏨', gradient: 'linear-gradient(135deg, #f43f5e, #f59e0b)' },
      'Hotel': { icon: '🏨', gradient: 'linear-gradient(135deg, #f43f5e, #f59e0b)' },
      'Data Center': { icon: '💾', gradient: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' },
      'Multi-Family': { icon: '🏘️', gradient: 'linear-gradient(135deg, #10b981, #3b82f6)' },
      'Office': { icon: '🏢', gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
    };
    // Try exact match first
    if (icons[buildingType]) return icons[buildingType];
    // Try partial match (e.g., "Healthcare - Clinic" should match "Healthcare")
    const lowerType = (buildingType || '').toLowerCase();
    for (const [key, value] of Object.entries(icons)) {
      if (lowerType.includes(key.toLowerCase())) return value;
    }
    return { icon: '📋', gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' };
  };

  // Get confidence color for preview modal
  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'low': return '#6B7280';
      default: return '#6B7280';
    }
  };

  // Get unique building types for filter (using project_type since data is swapped)
  const buildingTypes = useMemo(() => {
    const types = new Set(budgets.map(b => b.project_type).filter(Boolean));
    return Array.from(types).sort();
  }, [budgets]);

  // Filter budgets
  const filteredBudgets = useMemo(() => {
    return budgets.filter(budget => {
      const matchesStatus = !statusFilter || budget.status === statusFilter;
      // Using project_type for building type filter since data is swapped
      const matchesBuildingType = !buildingTypeFilter || budget.project_type === buildingTypeFilter;
      const matchesSearch = !searchQuery ||
        budget.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        budget.building_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        budget.project_type?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesBuildingType && matchesSearch;
    });
  }, [budgets, statusFilter, buildingTypeFilter, searchQuery]);

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0';
    return '$' + Math.round(value).toLocaleString();
  };

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0';
    return Math.round(value).toLocaleString();
  };

  return (
    <div className="budgets-page">
      {/* Top Bar */}
      <div className="budgets-top-bar">
        <div className="budgets-breadcrumb">
          <Link to="/estimating" className="breadcrumb-link">Estimating</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Budgets</span>
        </div>
        <Link to="/estimating/budget-generator" className="btn btn-primary">
          + New Budget
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="budgets-summary-grid">
        <div className="summary-card">
          <div className="summary-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-label">Total Budgets</span>
            <span className="summary-value">{stats?.total_budgets || budgets.length}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">{formatCurrency(stats?.total_value)}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-label">Finalized</span>
            <span className="summary-value">{stats?.final_count || 0}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-label">Drafts</span>
            <span className="summary-value">{stats?.draft_count || 0}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon cyan">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-label">Avg Value</span>
            <span className="summary-value">{formatCurrency(stats?.avg_value)}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon red">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-label">Avg $/SF</span>
            <span className="summary-value">${Number(stats?.avg_cost_per_sqft || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="budgets-table-section">
      {/* Filters Row */}
      <div className="budgets-toolbar">
        <h3 className="budgets-table-title">Budget List</h3>
        <div className="toolbar-filters">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
            <option value="archived">Archived</option>
          </select>
          <select
            className="filter-select"
            value={buildingTypeFilter}
            onChange={(e) => setBuildingTypeFilter(e.target.value)}
          >
            <option value="">All Building Types</option>
            {buildingTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="search-box">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search budgets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="toolbar-info">
          Showing {filteredBudgets.length} of {budgets.length} budgets
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={loadBudgets} className="retry-btn">Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading budgets...</p>
        </div>
      ) : (
        /* Table */
        <div className="budgets-table-container">
          <table className="budgets-table">
            <thead>
              <tr>
                <th className="col-project">Project</th>
                <th className="col-type">Type</th>
                <th className="col-sqft">Square Ft</th>
                <th className="col-total">Grand Total</th>
                <th className="col-cost-sf">$/SF</th>
                <th className="col-confidence">Confidence</th>
                <th className="col-status">Status</th>
                <th className="col-date">Created</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBudgets.map((budget) => {
                // Note: Data has building_type and project_type swapped, so we display them swapped
                const actualBuildingType = budget.project_type || budget.building_type;
                const actualProjectType = budget.building_type || budget.project_type;
                const buildingIcon = getBuildingTypeIcon(actualBuildingType);

                return (
                  <tr key={budget.id}>
                    <td className="col-project">
                      <div className="project-cell">
                        <div className="project-icon" style={{ background: buildingIcon.gradient }}>
                          {buildingIcon.icon}
                        </div>
                        <div className="project-info">
                          <span className="project-name">{budget.project_name}</span>
                          <span className="project-sub">{actualBuildingType}</span>
                        </div>
                      </div>
                    </td>
                    <td className="col-type">{actualProjectType}</td>
                    <td className="col-sqft">{formatNumber(budget.square_footage)}</td>
                    <td className="col-total">{formatCurrency(budget.grand_total)}</td>
                    <td className="col-cost-sf">${Number(budget.cost_per_sqft || 0).toFixed(2)}</td>
                    <td className="col-confidence">
                      <span className={`confidence-badge ${budget.confidence_level}`}>
                        <span className="confidence-dot"></span>
                        {budget.confidence_level}
                      </span>
                    </td>
                    <td className="col-status">
                      <span className={`status-badge ${budget.status}`}>
                        <span className="status-dot"></span>
                        {budget.status}
                      </span>
                    </td>
                    <td className="col-date">
                      {new Date(budget.created_at).toLocaleDateString()}
                    </td>
                    <td className="col-actions">
                      <div className="budget-actions">
                        <button
                          className="action-btn view"
                          onClick={(e) => { e.stopPropagation(); handleViewBudget(budget); }}
                          title="View budget"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          className="action-btn edit"
                          onClick={(e) => { e.stopPropagation(); navigate(`/estimating/budgets/${budget.id}/edit`); }}
                          title="Edit budget"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={(e) => { e.stopPropagation(); handleDelete(budget.id); }}
                          title="Delete budget"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredBudgets.length === 0 && !loading && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-icon-wrapper">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          <path d="M12 12v4M12 16h.01" />
                        </svg>
                      </div>
                      <h3>No budgets found</h3>
                      <p>
                        {searchQuery || statusFilter || buildingTypeFilter
                          ? 'Try adjusting your filters'
                          : 'Create your first budget using the Budget Generator'}
                      </p>
                      {!searchQuery && !statusFilter && !buildingTypeFilter && (
                        <Link to="/estimating/budget-generator" className="btn btn-primary">
                          Create Budget
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div> {/* End budgets-table-section */}

      {/* Budget Preview Modal */}
      {showPreview && selectedBudget && (
        <div className="budget-preview-overlay" onClick={handleClosePreview}>
          <div className="budget-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <div>
                <h2>{selectedBudget.project_name}</h2>
                <p>{selectedBudget.building_type} - {selectedBudget.project_type}</p>
              </div>
              <button className="close-btn" onClick={handleClosePreview}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="preview-modal-body">
              {/* Summary Stats */}
              <div className="preview-summary-grid">
                <div className="preview-stat main">
                  <span className="stat-label">Grand Total</span>
                  <span className="stat-value">{formatCurrency(selectedBudget.grand_total)}</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">Cost/SF</span>
                  <span className="stat-value">${Number(selectedBudget.cost_per_sqft || 0).toFixed(2)}</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">Square Footage</span>
                  <span className="stat-value">{formatNumber(selectedBudget.square_footage)} SF</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">Confidence</span>
                  <span className="stat-value" style={{ color: getConfidenceColor(selectedBudget.confidence_level) }}>
                    {selectedBudget.confidence_level?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="preview-section">
                <h3>Cost Breakdown</h3>
                <div className="cost-breakdown-grid">
                  <div className="cost-row">
                    <span>Labor Subtotal</span>
                    <span>{formatCurrency(selectedBudget.labor_subtotal)}</span>
                  </div>
                  <div className="cost-row">
                    <span>Material Subtotal</span>
                    <span>{formatCurrency(selectedBudget.material_subtotal)}</span>
                  </div>
                  <div className="cost-row">
                    <span>Equipment Subtotal</span>
                    <span>{formatCurrency(selectedBudget.equipment_subtotal)}</span>
                  </div>
                  <div className="cost-row">
                    <span>Subcontract Subtotal</span>
                    <span>{formatCurrency(selectedBudget.subcontract_subtotal)}</span>
                  </div>
                  <div className="cost-row subtotal">
                    <span>Direct Cost Subtotal</span>
                    <span>{formatCurrency(selectedBudget.direct_cost_subtotal)}</span>
                  </div>
                  <div className="cost-row">
                    <span>Overhead ({selectedBudget.overhead_percent || 10}%)</span>
                    <span>{formatCurrency(selectedBudget.overhead)}</span>
                  </div>
                  <div className="cost-row">
                    <span>Profit ({selectedBudget.profit_percent || 10}%)</span>
                    <span>{formatCurrency(selectedBudget.profit)}</span>
                  </div>
                  <div className="cost-row">
                    <span>Contingency ({selectedBudget.contingency_percent || 5}%)</span>
                    <span>{formatCurrency(selectedBudget.contingency)}</span>
                  </div>
                  <div className="cost-row grand-total">
                    <span>GRAND TOTAL</span>
                    <span>{formatCurrency(selectedBudget.grand_total)}</span>
                  </div>
                </div>
              </div>

              {/* Methodology */}
              {selectedBudget.methodology && (
                <div className="preview-section">
                  <h3>Methodology</h3>
                  <p className="methodology-text">{selectedBudget.methodology}</p>
                </div>
              )}

              {/* Sections */}
              {selectedBudget.sections && selectedBudget.sections.length > 0 && (
                <div className="preview-section">
                  <h3>Budget Sections</h3>
                  <div className="sections-list">
                    {selectedBudget.sections.map((section: any, index: number) => (
                      <div key={index} className="section-row">
                        <span className="section-name">{section.name}</span>
                        <span className="section-total">{formatCurrency(section.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="preview-modal-footer">
              <button className="btn btn-secondary" onClick={handleClosePreview}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleClosePreview();
                  navigate(`/estimating/budgets/${selectedBudget.id}/edit`);
                }}
              >
                Edit Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetsList;
