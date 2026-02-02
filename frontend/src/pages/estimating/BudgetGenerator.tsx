import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { budgetGeneratorService, BudgetOptions, GeneratedBudget, SimilarProject } from '../../services/budgetGenerator';
import './BudgetGenerator.css';

const BudgetGenerator: React.FC = () => {
  // Form state
  const [projectName, setProjectName] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [projectType, setProjectType] = useState('');
  const [bidType, setBidType] = useState('');
  const [sqft, setSqft] = useState('');
  const [scope, setScope] = useState('');

  // Options for dropdowns
  const [options, setOptions] = useState<BudgetOptions>({
    buildingTypes: [],
    projectTypes: [],
    bidTypes: []
  });

  // Preview state
  const [previewProjects, setPreviewProjects] = useState<any[]>([]);
  const [previewAverages, setPreviewAverages] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Results state
  const [budget, setBudget] = useState<GeneratedBudget | null>(null);
  const [comparableProjects, setComparableProjects] = useState<SimilarProject[]>([]);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');

  // Load dropdown options on mount
  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const opts = await budgetGeneratorService.getOptions();
      setOptions(opts);
    } catch (err) {
      console.error('Error loading options:', err);
      setError('Failed to load options. Please try again.');
    }
  };

  // Load preview when form changes
  useEffect(() => {
    if (buildingType && projectType) {
      loadPreview();
    } else {
      setShowPreview(false);
      setPreviewProjects([]);
      setPreviewAverages(null);
    }
  }, [buildingType, projectType, bidType, sqft]);

  const loadPreview = async () => {
    try {
      setPreviewLoading(true);
      const result = await budgetGeneratorService.findSimilar({
        buildingType,
        projectType,
        bidType: bidType || undefined,
        sqft: sqft ? parseFloat(sqft) : undefined
      });
      setPreviewProjects(result.similarProjects);
      setPreviewAverages(result.averages);
      setShowPreview(true);
    } catch (err) {
      console.error('Error loading preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!projectName || !buildingType || !projectType || !sqft) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setLoading(true);
      setBudget(null);

      const result = await budgetGeneratorService.generate({
        projectName,
        buildingType,
        projectType,
        bidType: bidType || undefined,
        sqft: parseFloat(sqft),
        scope: scope || undefined
      });

      setBudget(result.budget);
      setComparableProjects(result.similarProjects);

      // Auto-expand summary section
      setExpandedSections({ 'summary': true });

    } catch (err: any) {
      console.error('Error generating budget:', err);
      setError(err.response?.data?.error || 'Failed to generate budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0';
    return '$' + Math.round(value).toLocaleString();
  };

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0';
    return Math.round(value).toLocaleString();
  };

  const getConfidenceBadge = (level: string) => {
    const colors: { [key: string]: string } = {
      high: '#16a34a',
      medium: '#ca8a04',
      low: '#dc2626'
    };
    return (
      <span
        className="confidence-badge"
        style={{ backgroundColor: colors[level] || colors.medium }}
      >
        {level.toUpperCase()} CONFIDENCE
      </span>
    );
  };

  const handleReset = () => {
    setProjectName('');
    setBuildingType('');
    setProjectType('');
    setBidType('');
    setSqft('');
    setScope('');
    setBudget(null);
    setComparableProjects([]);
    setShowPreview(false);
    setPreviewProjects([]);
    setPreviewAverages(null);
    setError('');
  };

  return (
    <div className="budget-generator">
      <Link to="/estimating" className="back-link">&larr; Back to Estimating</Link>

      <div className="page-header">
        <div className="page-header-content">
          <h1>Budget Generator</h1>
          <p>Generate AI-powered HVAC budget estimates from historical project data</p>
        </div>
      </div>

      <div className="budget-generator-layout">
        {/* Left Column - Input Form */}
        <div className="budget-form-column">
          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Project Details</h2>

            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Building Type *</label>
                <select
                  className="form-input"
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                  required
                >
                  <option value="">Select building type</option>
                  {options.buildingTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Project Type *</label>
                <select
                  className="form-input"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  required
                >
                  <option value="">Select project type</option>
                  {options.projectTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Bid Type</label>
                <select
                  className="form-input"
                  value={bidType}
                  onChange={(e) => setBidType(e.target.value)}
                >
                  <option value="">Any bid type</option>
                  {options.bidTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Square Footage *</label>
                <input
                  type="number"
                  className="form-input"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  placeholder="Enter square footage"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Additional Scope Notes</label>
                <textarea
                  className="form-input"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="Optional: Describe any special requirements or scope details..."
                  rows={3}
                />
              </div>

              {error && (
                <div className="error-message" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !projectName || !buildingType || !projectType || !sqft}
                >
                  {loading ? 'Generating...' : 'Generate Budget'}
                </button>
                {budget && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleReset}
                  >
                    Start Over
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Preview Panel */}
          {showPreview && !budget && (
            <div className="card preview-panel">
              <h3 style={{ marginTop: 0 }}>
                Similar Projects Preview
                {previewLoading && <span className="loading-indicator"> Loading...</span>}
              </h3>

              {previewAverages && (
                <div className="preview-stats">
                  <div className="stat-item">
                    <span className="stat-label">Projects Found</span>
                    <span className="stat-value">{previewAverages.project_count || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Cost</span>
                    <span className="stat-value">{formatCurrency(previewAverages.avg_total_cost)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Cost/SF</span>
                    <span className="stat-value">${(parseFloat(previewAverages.avg_cost_per_sqft) || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {previewProjects.length > 0 ? (
                <div className="preview-projects">
                  <h4>Top Matches</h4>
                  {previewProjects.slice(0, 3).map((project, index) => (
                    <div key={project.id || index} className="preview-project-item">
                      <div className="project-name">{project.name}</div>
                      <div className="project-details">
                        <span>{formatNumber(project.total_sqft)} SF</span>
                        <span>{formatCurrency(project.total_cost)}</span>
                        <span className="similarity-score">{project.similarity_score}% match</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !previewLoading && (
                <p style={{ color: 'var(--secondary)' }}>
                  No similar projects found. The estimate will be based on general averages.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="budget-results-column">
          {loading && (
            <div className="card loading-card">
              <div className="loading-spinner"></div>
              <h3>Generating Budget...</h3>
              <p>Titan is analyzing historical data and creating your estimate.</p>
            </div>
          )}

          {budget && (
            <>
              {/* Summary Card */}
              <div className="card summary-card">
                <div className="summary-header">
                  <div>
                    <h2 style={{ margin: 0 }}>{budget.summary.projectName}</h2>
                    <p style={{ color: 'var(--secondary)', margin: '0.5rem 0 0 0' }}>
                      {budget.summary.buildingType} - {budget.summary.projectType}
                    </p>
                  </div>
                  {getConfidenceBadge(budget.summary.confidenceLevel)}
                </div>

                <div className="summary-totals">
                  <div className="total-item main-total">
                    <span className="total-label">Estimated Total</span>
                    <span className="total-value">{formatCurrency(budget.summary.estimatedTotalCost)}</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">Cost per SF</span>
                    <span className="total-value">${(budget.summary.costPerSquareFoot || 0).toFixed(2)}</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">Square Footage</span>
                    <span className="total-value">{formatNumber(budget.summary.squareFootage)} SF</span>
                  </div>
                </div>

                <div className="methodology">
                  <strong>Methodology:</strong> {budget.summary.methodology}
                </div>
              </div>

              {/* Comparable Projects */}
              {comparableProjects.length > 0 && (
                <div className="card comparable-projects-card">
                  <h3 style={{ marginTop: 0 }}>Top 3 Comparable Projects</h3>
                  <div className="comparable-projects-grid">
                    {comparableProjects.map((project, index) => (
                      <div key={project.id || index} className="comparable-project">
                        <div className="comparable-header">
                          <span className="comparable-rank">#{index + 1}</span>
                          <span className="comparable-name">{project.name}</span>
                        </div>
                        <div className="comparable-details">
                          <div className="detail-row">
                            <span>Size:</span>
                            <span>{formatNumber(project.sqft)} SF</span>
                          </div>
                          <div className="detail-row">
                            <span>Total Cost:</span>
                            <span>{formatCurrency(project.totalCost)}</span>
                          </div>
                          <div className="detail-row">
                            <span>Cost/SF:</span>
                            <span>${(project.costPerSqft || 0).toFixed(2)}</span>
                          </div>
                          <div className="detail-row">
                            <span>Match Score:</span>
                            <span className="match-score">{project.similarityScore}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost Breakdown Sections */}
              <div className="card sections-card">
                <h3 style={{ marginTop: 0 }}>Cost Breakdown</h3>

                {budget.sections.map((section, index) => (
                  <div key={index} className="budget-section">
                    <div
                      className="section-header-row"
                      onClick={() => toggleSection(section.name)}
                    >
                      <span className="section-expand-icon">
                        {expandedSections[section.name] ? '▼' : '▶'}
                      </span>
                      <span className="section-name">{section.name}</span>
                      <span className="section-subtotal">{formatCurrency(section.subtotal)}</span>
                    </div>

                    {expandedSections[section.name] && section.items.length > 0 && (
                      <div className="section-items">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Qty</th>
                              <th>Labor</th>
                              <th>Material</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.items.map((item, itemIndex) => (
                              <tr key={itemIndex}>
                                <td>{item.description}</td>
                                <td>{item.quantity ? `${formatNumber(item.quantity)} ${item.unit || ''}` : '-'}</td>
                                <td>{formatCurrency(item.laborCost)}</td>
                                <td>{formatCurrency(item.materialCost)}</td>
                                <td><strong>{formatCurrency(item.totalCost)}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}

                {/* Totals Summary */}
                <div className="totals-summary">
                  <div className="totals-row">
                    <span>Labor Subtotal</span>
                    <span>{formatCurrency(budget.totals.laborSubtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Material Subtotal</span>
                    <span>{formatCurrency(budget.totals.materialSubtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Equipment Subtotal</span>
                    <span>{formatCurrency(budget.totals.equipmentSubtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Subcontract Subtotal</span>
                    <span>{formatCurrency(budget.totals.subcontractSubtotal)}</span>
                  </div>
                  <div className="totals-row subtotal">
                    <span>Direct Cost Subtotal</span>
                    <span>{formatCurrency(budget.totals.directCostSubtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Overhead</span>
                    <span>{formatCurrency(budget.totals.overhead)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Profit</span>
                    <span>{formatCurrency(budget.totals.profit)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Contingency</span>
                    <span>{formatCurrency(budget.totals.contingency)}</span>
                  </div>
                  <div className="totals-row grand-total">
                    <span>GRAND TOTAL</span>
                    <span>{formatCurrency(budget.totals.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Assumptions & Risks */}
              <div className="card assumptions-risks-card">
                <div className="assumptions-risks-grid">
                  <div className="assumptions-section">
                    <h4>Key Assumptions</h4>
                    <ul>
                      {budget.assumptions.map((assumption, index) => (
                        <li key={index}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="risks-section">
                    <h4>Potential Risks</h4>
                    <ul>
                      {budget.risks.map((risk, index) => (
                        <li key={index}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && !budget && (
            <div className="card empty-state-card">
              <div className="empty-state-icon">🔧</div>
              <h3>Ready to Generate</h3>
              <p>Fill in the project details and click "Generate Budget" to create an AI-powered estimate based on historical project data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetGenerator;
