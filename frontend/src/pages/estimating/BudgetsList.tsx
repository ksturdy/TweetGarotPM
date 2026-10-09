import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { budgetsApi, Budget, BudgetStats } from '../../services/budgets';
import { getMatrixForBudget, createMatrixFromBudget } from '../../services/costControl';
import { renderMarketIcon, getMarketGradient, resolveMarketKey } from '../../utils/marketIcons';
import '../../styles/SalesPipeline.css';
import './BudgetsList.css';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

const BudgetsList: React.FC = () => {
  const navigate = useNavigate();
  const { toast, confirm } = useTitanFeedback();
  const [statusFilter, setStatusFilter] = useState('');
  const [buildingTypeFilter, setBuildingTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [stats, setStats] = useState<BudgetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [matrixMap, setMatrixMap] = useState<Record<number, number | null>>({});
  const [startingMatrix, setStartingMatrix] = useState<number | null>(null);

  // Resizable columns
  const STORAGE_KEY = 'budgetsList_columnWidths';
  const DEFAULT_WIDTHS: Record<string, number> = {
    project: 0,
    type: 150,
    sqft: 110,
    grandTotal: 130,
    costSf: 90,
    confidence: 110,
    status: 100,
    created: 110,
    costControl: 130,
  };
  const COLUMN_KEYS = Object.keys(DEFAULT_WIDTHS);
  const MIN_COL_WIDTH = 60;

  const loadSavedWidths = (): Record<string, number> => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_WIDTHS };
  };

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(loadSavedWidths);
  const resizingCol = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleResizeStart = useCallback((colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colKey;
    resizeStartX.current = e.clientX;
    if (columnWidths[colKey] === 0 && tableRef.current) {
      const colIndex = COLUMN_KEYS.indexOf(colKey);
      const th = tableRef.current.querySelector(`thead th:nth-child(${colIndex + 1})`) as HTMLElement;
      resizeStartWidth.current = th ? th.offsetWidth : 200;
    } else {
      resizeStartWidth.current = columnWidths[colKey];
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCol.current) return;
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth.current + diff);
      setColumnWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
    };
    const handleMouseUp = () => {
      if (!resizingCol.current) return;
      setColumnWidths(prev => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
      resizingCol.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const getColStyle = (key: string): React.CSSProperties => {
    const w = columnWidths[key];
    if (w === 0) return {};
    return { width: `${w}px` };
  };

  useEffect(() => {
    loadBudgets();
    loadStats();
  }, []);

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const response = await budgetsApi.getAll();
      setBudgets(response.data);
      const checks = response.data.map(async (b: Budget) => {
        const existing = await getMatrixForBudget(b.id).catch(() => null);
        setMatrixMap(prev => ({ ...prev, [b.id]: existing ? existing.id : null }));
      });
      await Promise.allSettled(checks);
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
    const ok = await confirm({ message: 'Are you sure you want to delete this budget?', danger: true });
    if (!ok) return;
    try {
      await budgetsApi.delete(id);
      setBudgets(budgets.filter(b => b.id !== id));
      if (selectedBudget?.id === id) {
        setSelectedBudget(null);
        setShowPreview(false);
      }
    } catch (err) {
      console.error('Error deleting budget:', err);
      toast.error('Failed to delete budget');
    }
  };

  const handleViewBudget = async (budget: Budget) => {
    try {
      const response = await budgetsApi.getById(budget.id);
      setSelectedBudget(response.data);
      setShowPreview(true);
    } catch (err) {
      console.error('Error loading budget details:', err);
      toast.error('Failed to load budget details');
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setSelectedBudget(null);
  };

  const getBuildingTypeIcon = (buildingType: string) => {
    const resolved = resolveMarketKey(buildingType);
    return { icon: renderMarketIcon(resolved), gradient: getMarketGradient(resolved) };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'final': return '#10b981';
      case 'draft': return '#6b7280';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const buildingTypes = useMemo(() => {
    const types = new Set(budgets.map(b => b.project_type).filter(Boolean));
    return Array.from(types).sort();
  }, [budgets]);

  const filteredBudgets = useMemo(() => {
    return budgets.filter(budget => {
      const matchesStatus = !statusFilter || budget.status === statusFilter;
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

  if (loading) return (
    <div className="sales-container">
      <div style={{ textAlign: 'center', padding: '40px' }}>Loading budgets...</div>
    </div>
  );

  return (
    <div className="sales-container">
      {/* Page Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/estimating" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Estimating
            </Link>
            <h1>🗂️ Budgets</h1>
            <div className="sales-subtitle">Generate and manage project budget estimates</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <Link to="/estimating/cost-database?budgetMode=true" className="sales-btn sales-btn-primary">
            + New Budget
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="sales-kpi-card amber">
          <div className="sales-kpi-label">Drafts</div>
          <div className="sales-kpi-value">{stats?.draft_count || 0}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Finalized</div>
          <div className="sales-kpi-value">{stats?.final_count || 0}</div>
        </div>
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Budgets</div>
          <div className="sales-kpi-value">{stats?.total_budgets || budgets.length}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Total Value</div>
          <div className="sales-kpi-value">{formatCurrency(stats?.total_value)}</div>
        </div>
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Avg Value</div>
          <div className="sales-kpi-value">{formatCurrency(stats?.avg_value)}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Avg $/SF</div>
          <div className="sales-kpi-value">${Number(stats?.avg_cost_per_sqft || 0).toFixed(2)}</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">Budget List</div>
          <div className="sales-table-controls">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
              style={{ fontSize: '12px', padding: '4px 6px', width: 'auto' }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={buildingTypeFilter}
              onChange={(e) => setBuildingTypeFilter(e.target.value)}
              className="filter-select"
              style={{ fontSize: '12px', padding: '4px 6px', width: 'auto' }}
            >
              <option value="">All Building Types</option>
              {buildingTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="sales-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search budgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', margin: '0 0 12px' }}>
            {error}
            <button onClick={loadBudgets} style={{ marginLeft: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
          </div>
        )}

        <table className="sales-table" ref={tableRef}>
          <colgroup>
            {COLUMN_KEYS.map(key => <col key={key} style={getColStyle(key)} />)}
          </colgroup>
          <thead>
            <tr>
              <th>Project<div className="col-resize-handle" onMouseDown={e => handleResizeStart('project', e)} /></th>
              <th>Type<div className="col-resize-handle" onMouseDown={e => handleResizeStart('type', e)} /></th>
              <th>Square Ft<div className="col-resize-handle" onMouseDown={e => handleResizeStart('sqft', e)} /></th>
              <th>Grand Total<div className="col-resize-handle" onMouseDown={e => handleResizeStart('grandTotal', e)} /></th>
              <th>$/SF<div className="col-resize-handle" onMouseDown={e => handleResizeStart('costSf', e)} /></th>
              <th>Confidence<div className="col-resize-handle" onMouseDown={e => handleResizeStart('confidence', e)} /></th>
              <th>Status<div className="col-resize-handle" onMouseDown={e => handleResizeStart('status', e)} /></th>
              <th>Created<div className="col-resize-handle" onMouseDown={e => handleResizeStart('created', e)} /></th>
              <th>Cost Control<div className="col-resize-handle" onMouseDown={e => handleResizeStart('costControl', e)} /></th>
            </tr>
          </thead>
          <tbody>
            {filteredBudgets.map((budget) => {
              const actualBuildingType = budget.project_type || budget.building_type;
              const actualProjectType = budget.building_type || budget.project_type;
              const buildingIcon = getBuildingTypeIcon(actualBuildingType);

              return (
                <tr key={budget.id} onClick={() => navigate(`/estimating/budgets/${budget.id}/edit`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="project-icon" style={{ background: buildingIcon.gradient, flexShrink: 0 }}>
                        {buildingIcon.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{budget.project_name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{actualBuildingType}</div>
                      </div>
                    </div>
                  </td>
                  <td>{actualProjectType}</td>
                  <td>{formatNumber(budget.square_footage)}</td>
                  <td>{formatCurrency(budget.grand_total)}</td>
                  <td>${Number(budget.cost_per_sqft || 0).toFixed(2)}</td>
                  <td>
                    <span className="sales-stage-badge">
                      <span className="sales-stage-dot" style={{ background: getConfidenceColor(budget.confidence_level) }} />
                      {budget.confidence_level ? budget.confidence_level.charAt(0).toUpperCase() + budget.confidence_level.slice(1) : '—'}
                    </span>
                  </td>
                  <td>
                    <span className="sales-stage-badge">
                      <span className="sales-stage-dot" style={{ background: getStatusColor(budget.status) }} />
                      {budget.status ? budget.status.charAt(0).toUpperCase() + budget.status.slice(1) : '—'}
                    </span>
                  </td>
                  <td>{new Date(budget.created_at).toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {matrixMap[budget.id] != null ? (
                      <button
                        className="sales-btn sales-btn-secondary"
                        style={{ fontSize: '11px', padding: '3px 10px' }}
                        onClick={() => navigate(`/estimating/cost-control/${matrixMap[budget.id]}`)}
                      >
                        Open Matrix →
                      </button>
                    ) : (
                      <button
                        className="sales-btn sales-btn-primary"
                        style={{ fontSize: '11px', padding: '3px 10px' }}
                        disabled={startingMatrix === budget.id}
                        onClick={async () => {
                          setStartingMatrix(budget.id);
                          try {
                            const { matrixId } = await createMatrixFromBudget(budget.id);
                            setMatrixMap(prev => ({ ...prev, [budget.id]: matrixId }));
                            navigate(`/estimating/cost-control/${matrixId}`);
                          } catch (err: any) {
                            const existingId = err?.response?.data?.matrixId;
                            if (existingId) {
                              setMatrixMap(prev => ({ ...prev, [budget.id]: existingId }));
                              navigate(`/estimating/cost-control/${existingId}`);
                            } else {
                              toast.error(err?.response?.data?.error || 'Failed to create matrix');
                            }
                          } finally {
                            setStartingMatrix(null);
                          }
                        }}
                      >
                        {startingMatrix === budget.id ? 'Starting…' : '+ Matrix'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredBudgets.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                  <svg style={{ margin: '0 auto 12px', display: 'block', color: '#9ca3af' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    <path d="M12 12v4M12 16h.01" />
                  </svg>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No budgets found</h3>
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    {searchQuery || statusFilter || buildingTypeFilter
                      ? 'Try adjusting your filters'
                      : 'Create your first budget using the Budget Generator'}
                  </p>
                  {!searchQuery && !statusFilter && !buildingTypeFilter && (
                    <Link to="/estimating/cost-database?budgetMode=true" className="sales-btn sales-btn-primary" style={{ marginTop: '12px', display: 'inline-block' }}>
                      Create Budget
                    </Link>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Budget Preview Modal */}
      {showPreview && selectedBudget && (
        <div className="modal-overlay" onClick={handleClosePreview}>
          <div className="modal-container" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedBudget.project_name}</h2>
              <button className="modal-close" onClick={handleClosePreview}>×</button>
            </div>
            <div className="modal-body">
              {/* Summary Stats */}
              <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
                <div className="sales-kpi-card blue">
                  <div className="sales-kpi-label">Grand Total</div>
                  <div className="sales-kpi-value" style={{ fontSize: '18px' }}>{formatCurrency(selectedBudget.grand_total)}</div>
                </div>
                <div className="sales-kpi-card purple">
                  <div className="sales-kpi-label">Cost/SF</div>
                  <div className="sales-kpi-value" style={{ fontSize: '18px' }}>${Number(selectedBudget.cost_per_sqft || 0).toFixed(2)}</div>
                </div>
                <div className="sales-kpi-card green">
                  <div className="sales-kpi-label">Square Footage</div>
                  <div className="sales-kpi-value" style={{ fontSize: '18px' }}>{formatNumber(selectedBudget.square_footage)} SF</div>
                </div>
                <div className="sales-kpi-card amber">
                  <div className="sales-kpi-label">Confidence</div>
                  <div className="sales-kpi-value" style={{ fontSize: '18px', color: getConfidenceColor(selectedBudget.confidence_level) }}>
                    {selectedBudget.confidence_level?.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Cost Breakdown</h3>
                <div className="cost-breakdown-grid">
                  {[
                    ['Labor Subtotal', selectedBudget.labor_subtotal],
                    ['Material Subtotal', selectedBudget.material_subtotal],
                    ['Equipment Subtotal', selectedBudget.equipment_subtotal],
                    ['Subcontract Subtotal', selectedBudget.subcontract_subtotal],
                    [`Overhead (${selectedBudget.overhead_percent || 10}%)`, selectedBudget.overhead],
                    [`Profit (${selectedBudget.profit_percent || 10}%)`, selectedBudget.profit],
                    [`Contingency (${selectedBudget.contingency_percent || 5}%)`, selectedBudget.contingency],
                  ].map(([label, value]) => (
                    <div key={label as string} className="cost-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <span style={{ color: '#374151' }}>{label}</span>
                      <span>{formatCurrency(value as number)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700, fontSize: '14px', borderTop: '2px solid #cbd5e1', marginTop: '4px' }}>
                    <span>GRAND TOTAL</span>
                    <span>{formatCurrency(selectedBudget.grand_total)}</span>
                  </div>
                </div>
              </div>

              {/* Methodology */}
              {selectedBudget.methodology && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Methodology</h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>{selectedBudget.methodology}</p>
                </div>
              )}

              {/* Sections */}
              {selectedBudget.sections && selectedBudget.sections.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Budget Sections</h3>
                  {selectedBudget.sections.map((section: any, index: number) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <span style={{ color: '#374151' }}>{section.name}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(section.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="sales-btn sales-btn-secondary" onClick={handleClosePreview}>Close</button>
              {matrixMap[selectedBudget.id] != null ? (
                <button
                  className="sales-btn sales-btn-secondary"
                  onClick={() => { handleClosePreview(); navigate(`/estimating/cost-control/${matrixMap[selectedBudget.id]}`); }}
                >
                  Open Cost Control Matrix →
                </button>
              ) : (
                <button
                  className="sales-btn sales-btn-secondary"
                  disabled={startingMatrix === selectedBudget.id}
                  onClick={async () => {
                    setStartingMatrix(selectedBudget.id);
                    try {
                      const { matrixId } = await createMatrixFromBudget(selectedBudget.id);
                      setMatrixMap(prev => ({ ...prev, [selectedBudget.id]: matrixId }));
                      handleClosePreview();
                      navigate(`/estimating/cost-control/${matrixId}`);
                    } catch (err: any) {
                      const existingId = err?.response?.data?.matrixId;
                      if (existingId) {
                        setMatrixMap(prev => ({ ...prev, [selectedBudget.id]: existingId }));
                        handleClosePreview();
                        navigate(`/estimating/cost-control/${existingId}`);
                      } else {
                        toast.error(err?.response?.data?.error || 'Failed to create matrix');
                      }
                    } finally {
                      setStartingMatrix(null);
                    }
                  }}
                >
                  {startingMatrix === selectedBudget.id ? 'Starting…' : 'Start Cost Control Matrix'}
                </button>
              )}
              <button
                className="sales-btn sales-btn-primary"
                onClick={() => { handleClosePreview(); navigate(`/estimating/budgets/${selectedBudget.id}/edit`); }}
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
