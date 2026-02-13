import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { historicalProjectsService } from '../../services/historicalProjects';
import './CostDatabase.css';
import '../../styles/SalesPipeline.css';

const CostDatabase: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [filterBuildingType, setFilterBuildingType] = useState('all');
  const [filterProjectType, setFilterProjectType] = useState('all');
  const [filterBidType, setFilterBidType] = useState('all');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({
    name: 180,
    bid_date: 120,
    building_type: 150,
    project_type: 150,
    bid_type: 120,
    total_cost: 120,
    total_sqft: 100,
    cost_per_sqft: 120,
    actions: 150
  });
  const [resizing, setResizing] = useState<{column: string, startX: number, startWidth: number} | null>(null);

  // Load historical projects on component mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await historicalProjectsService.getAll();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique building types, project types, and bid types from projects
  const buildingTypes = ['all', ...new Set(projects.map(p => p.building_type).filter(Boolean))];
  const projectTypes = ['all', ...new Set(projects.map(p => p.project_type).filter(Boolean))];
  const bidTypes = ['all', ...new Set(projects.map(p => p.bid_type).filter(Boolean))];

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle column resize
  const handleResizeStart = (column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      column,
      startX: e.clientX,
      startWidth: columnWidths[column]
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const delta = e.clientX - resizing.startX;
        const newWidth = Math.max(50, resizing.startWidth + delta);
        setColumnWidths(prev => ({
          ...prev,
          [resizing.column]: newWidth
        }));
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      const matchesSearch = !searchTerm ||
        project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.building_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.project_type?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBuildingType = filterBuildingType === 'all' || project.building_type === filterBuildingType;
      const matchesProjectType = filterProjectType === 'all' || project.project_type === filterProjectType;
      const matchesBidType = filterBidType === 'all' || project.bid_type === filterBidType;

      return matchesSearch && matchesBuildingType && matchesProjectType && matchesBidType;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Convert to numbers for numeric fields
      if (['total_cost', 'total_sqft', 'total_cost_per_sqft'].includes(sortField)) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      // Convert dates
      if (sortField === 'bid_date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      // String comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadProgress('Reading file...');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setUploadProgress(`Found ${jsonData.length} rows - Ready to import`);
        setPreviewData(jsonData); // Store all data for import

        console.log('Parsed data:', jsonData);
        console.log('Column headers:', Object.keys(jsonData[0] || {}));

      } catch (error) {
        console.error('Error parsing Excel:', error);
        setUploadProgress('');
        alert('Error parsing Excel file. Please check the file format.');
      }
    };

    reader.onerror = () => {
      setUploadProgress('');
      alert('Error reading file');
    };

    reader.readAsBinaryString(file);
  };

  const handleImportSubmit = async () => {
    if (previewData.length === 0) {
      alert('Please select a file first');
      return;
    }

    try {
      setUploadProgress('Saving to database...');
      const result = await historicalProjectsService.importProjects(previewData);
      setUploadProgress('');
      setPreviewData([]);
      setShowImportModal(false);
      alert(`Successfully imported ${result.count} projects to the database!`);
      loadProjects(); // Reload the projects list
    } catch (error: any) {
      console.error('Error importing projects:', error);
      setUploadProgress('');
      alert('Error saving projects to database: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleModalClose = () => {
    setShowImportModal(false);
    setPreviewData([]);
    setUploadProgress('');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await historicalProjectsService.delete(id);
      loadProjects(); // Reload the list
      alert('Project deleted successfully');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      alert('Error deleting project: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProject) return;

    try {
      await historicalProjectsService.update(editingProject.id, {
        name: editingProject.name,
        bid_date: editingProject.bid_date,
        building_type: editingProject.building_type,
        project_type: editingProject.project_type,
        bid_type: editingProject.bid_type,
        total_cost: editingProject.total_cost,
        total_sqft: editingProject.total_sqft,
        cost_per_sqft_with_index: editingProject.cost_per_sqft_with_index,
        total_cost_per_sqft: editingProject.total_cost_per_sqft
      });

      setEditingProject(null);
      loadProjects(); // Reload the list
      alert('Project updated successfully');
    } catch (error: any) {
      console.error('Error updating project:', error);
      alert('Error updating project: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="cost-database">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/estimating" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Estimating
            </Link>
            <h1>💲 Cost Database</h1>
            <div className="sales-subtitle">Manage cost items and pricing</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            Import Excel
          </button>
          <button className="btn btn-primary">
            + Add Project
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{filteredProjects.length}</div>
            <div className="stat-label">Historical Projects</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏗️</div>
          <div className="stat-info">
            <div className="stat-value">{new Set(filteredProjects.map(p => p.building_type).filter(Boolean)).size}</div>
            <div className="stat-label">Building Types</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-info">
            <div className="stat-value">
              {filteredProjects.length > 0
                ? new Date(Math.max(...filteredProjects.map(p => new Date(p.created_at || 0).getTime()))).toLocaleDateString()
                : '-'
              }
            </div>
            <div className="stat-label">Last Import</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <div className="stat-value">
              ${filteredProjects.length > 0
                ? Math.round(filteredProjects.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0) / filteredProjects.length).toLocaleString()
                : '0'
              }
            </div>
            <div className="stat-label">Avg Project Cost</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📐</div>
          <div className="stat-info">
            <div className="stat-value">
              ${filteredProjects.length > 0
                ? (() => {
                    const validProjects = filteredProjects.filter(p => p.total_cost_per_sqft);
                    return validProjects.length > 0
                      ? (validProjects.reduce((sum, p) => sum + (parseFloat(p.total_cost_per_sqft) || 0), 0) / validProjects.length).toFixed(2)
                      : '0.00';
                  })()
                : '0.00'
              }
            </div>
            <div className="stat-label">Avg Cost/SqFt</div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="filter-section">
          <div className="filter-group">
            <label>Building Type</label>
            <select
              className="form-input"
              value={filterBuildingType}
              onChange={(e) => setFilterBuildingType(e.target.value)}
            >
              {buildingTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Building Types' : type}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Project Type</label>
            <select
              className="form-input"
              value={filterProjectType}
              onChange={(e) => setFilterProjectType(e.target.value)}
            >
              {projectTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Project Types' : type}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Bid Type</label>
            <select
              className="form-input"
              value={filterBidType}
              onChange={(e) => setFilterBidType(e.target.value)}
            >
              {bidTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Bid Types' : type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="search-section">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="form-input"
              placeholder="Search by project name, building type, or project type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="search-count">
            Showing {filteredProjects.length} of {projects.length} projects
          </div>
        </div>
      </div>

      {/* Historical Projects Table */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <p>Loading historical projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="empty-state">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                {projects.length === 0 ? 'No historical projects in database' : 'No projects match your filters'}
              </p>
              <p style={{ color: 'var(--secondary)', marginBottom: '1.5rem' }}>
                {projects.length === 0 ? 'Import your Excel file to get started' : 'Try adjusting your search or filters'}
              </p>
              {projects.length === 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowImportModal(true)}
                >
                  Import Excel File
                </button>
              )}
            </div>
          </div>
        ) : (
          <table className="data-table resizable-table">
            <thead>
              <tr>
                <th style={{ width: columnWidths.name, position: 'relative' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    Project Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart('name', e)} />
                </th>
                <th style={{ width: columnWidths.bid_date, position: 'relative' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => handleSort('bid_date')}>
                    Bid Date {sortField === 'bid_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart('bid_date', e)} />
                </th>
                <th style={{ width: columnWidths.building_type, position: 'relative' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => handleSort('building_type')}>
                    Building Type {sortField === 'building_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart('building_type', e)} />
                </th>
                <th style={{ width: columnWidths.project_type, position: 'relative' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => handleSort('project_type')}>
                    Project Type {sortField === 'project_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart('project_type', e)} />
                </th>
                <th style={{ width: columnWidths.bid_type, position: 'relative' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => handleSort('bid_type')}>
                    Bid Type {sortField === 'bid_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart('bid_type', e)} />
                </th>
                <th style={{ width: columnWidths.total_cost, position: 'relative' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => handleSort('total_cost')}>
                    Total Cost {sortField === 'total_cost' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart('total_cost', e)} />
                </th>
                <th style={{ width: columnWidths.total_sqft, position: 'relative' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => handleSort('total_sqft')}>
                    SqFt {sortField === 'total_sqft' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart('total_sqft', e)} />
                </th>
                <th style={{ width: columnWidths.cost_per_sqft, position: 'relative' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => handleSort('total_cost_per_sqft')}>
                    Cost/SqFt {sortField === 'total_cost_per_sqft' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart('cost_per_sqft', e)} />
                </th>
                <th style={{ width: columnWidths.actions }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id}>
                  <td><strong>{project.name}</strong></td>
                  <td>{project.bid_date ? new Date(project.bid_date).toLocaleDateString() : '-'}</td>
                  <td>
                    {project.building_type && (
                      <span className="badge badge-info">{project.building_type}</span>
                    )}
                  </td>
                  <td>
                    {project.project_type && (
                      <span className="badge badge-secondary">{project.project_type}</span>
                    )}
                  </td>
                  <td>{project.bid_type || '-'}</td>
                  <td>
                    {project.total_cost ? `$${Math.round(project.total_cost).toLocaleString()}` : '-'}
                  </td>
                  <td>
                    {project.total_sqft ? Math.round(project.total_sqft).toLocaleString() : '-'}
                  </td>
                  <td>
                    {project.total_cost_per_sqft ? `$${parseFloat(project.total_cost_per_sqft).toFixed(2)}` : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedProject(project)}
                        title="View Details"
                      >
                        👁️
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setEditingProject({...project})}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(project.id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Excel File</h2>
              <button
                className="modal-close"
                onClick={handleModalClose}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="import-instructions">
                <h3>📄 Excel File Format</h3>
                <p>Your Excel file should include the following columns:</p>
                <ul>
                  <li><strong>Item Code</strong> - Unique identifier</li>
                  <li><strong>Description</strong> - Item description</li>
                  <li><strong>Category</strong> - Equipment, Ductwork, Piping, etc.</li>
                  <li><strong>Unit Cost</strong> - Cost per unit</li>
                  <li><strong>Unit</strong> - Each, LF, SF, etc.</li>
                  <li><strong>Labor Hours</strong> - (Optional) Hours per unit</li>
                </ul>
              </div>

              <div className="upload-area">
                <input
                  type="file"
                  id="excel-upload"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="excel-upload" className="upload-label">
                  <div className="upload-icon">📁</div>
                  <div className="upload-text">
                    <strong>Click to upload</strong> or drag and drop
                  </div>
                  <div className="upload-hint">
                    Excel (.xlsx, .xls) or CSV files
                  </div>
                </label>
              </div>

              <div className="import-options">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  <span>Replace existing items with same code</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  <span>Skip rows with missing required fields</span>
                </label>
              </div>

              {uploadProgress && (
                <div className="upload-status" style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  color: '#1e40af',
                  fontWeight: 600
                }}>
                  {uploadProgress}
                </div>
              )}

              {previewData.length > 0 && (
                <div className="preview-section" style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.75rem' }}>Preview (First 5 rows)</h4>
                  <div style={{
                    maxHeight: '200px',
                    overflow: 'auto',
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem'
                  }}>
                    <pre>{JSON.stringify(previewData.slice(0, 5), null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleModalClose}
              >
                Cancel
              </button>
              {previewData.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleImportSubmit}
                  disabled={!!uploadProgress && uploadProgress.includes('Saving')}
                >
                  {uploadProgress && uploadProgress.includes('Saving') ? 'Importing...' : `Import ${previewData.length} Projects`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>{selectedProject.name}</h2>
              <button
                className="modal-close"
                onClick={() => setSelectedProject(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Project Overview */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Project Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Bid Date</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.bid_date ? new Date(selectedProject.bid_date).toLocaleDateString() : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Building Type</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.building_type || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Project Type</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.project_type || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Bid Type</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.bid_type || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Cost</label>
                    <div style={{ fontWeight: 600, fontSize: '1.25rem', color: '#16a34a' }}>
                      {selectedProject.total_cost ? `$${Math.round(selectedProject.total_cost).toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total SqFt</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.total_sqft ? Math.round(selectedProject.total_sqft).toLocaleString() : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Cost per SqFt</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.total_cost_per_sqft ? `$${parseFloat(selectedProject.total_cost_per_sqft).toFixed(2)}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Cost/SqFt w/ Index</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.cost_per_sqft_with_index ? `$${parseFloat(selectedProject.cost_per_sqft_with_index).toFixed(2)}` : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* PM Section */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Project Management (PM)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>PM Hours</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.pm_hours || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>PM Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.pm_cost ? `$${selectedProject.pm_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* SM Section */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Sheet Metal (SM)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Rate</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.sm_field_rate || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Rate</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.sm_shop_rate || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Misc Field</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.sm_misc_field || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Misc Field Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.sm_misc_field_cost ? `$${selectedProject.sm_misc_field_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Misc Shop</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.sm_misc_shop || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Misc Shop Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.sm_misc_shop_cost ? `$${selectedProject.sm_misc_shop_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Equip Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.sm_equip_cost ? `$${selectedProject.sm_equip_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Supply Ductwork */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Supply Ductwork (S)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.s_field || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.s_field_cost ? `$${selectedProject.s_field_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Hours</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.s_shop || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.s_shop_cost ? `$${selectedProject.s_shop_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.s_material_cost ? `$${selectedProject.s_material_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Materials w/ Escalation</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.s_materials_with_escalation ? `$${selectedProject.s_materials_with_escalation.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>LBS per Sq</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.s_lbs_per_sq || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total LBS</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.s_lbs || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Return Ductwork */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Return Ductwork (R)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.r_field || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.r_field_cost ? `$${selectedProject.r_field_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Hours</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.r_shop || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.r_shop_cost ? `$${selectedProject.r_shop_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.r_material_cost ? `$${selectedProject.r_material_cost.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Materials w/ Escalation</label>
                    <div style={{ fontWeight: 600 }}>
                      {selectedProject.r_materials_with_escalation ? `$${selectedProject.r_materials_with_escalation.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>LBS per Sq</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.r_lbs_per_sq || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total LBS</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.r_lbs || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Plenum</label>
                    <div style={{ fontWeight: 600 }}>{selectedProject.r_plenum || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Exhaust Ductwork */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Exhaust Ductwork (E)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.e_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.e_field_cost ? `$${selectedProject.e_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.e_shop || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.e_shop_cost ? `$${selectedProject.e_shop_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.e_material_cost ? `$${selectedProject.e_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Materials w/ Escalation</label><div style={{ fontWeight: 600 }}>{selectedProject.e_material_with_escalation ? `$${selectedProject.e_material_with_escalation.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>LBS per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.e_lbs_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total LBS</label><div style={{ fontWeight: 600 }}>{selectedProject.e_lbs || '-'}</div></div>
                </div>
              </div>

              {/* Outside Air Ductwork */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Outside Air Ductwork (O)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.o_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.o_field_cost ? `$${selectedProject.o_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.o_shop || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.o_shop_cost ? `$${selectedProject.o_shop_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.o_material_cost ? `$${selectedProject.o_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Materials w/ Escalation</label><div style={{ fontWeight: 600 }}>{selectedProject.o_materials_with_escalation ? `$${selectedProject.o_materials_with_escalation.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>LBS per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.o_lbs_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total LBS</label><div style={{ fontWeight: 600 }}>{selectedProject.o_lbs || '-'}</div></div>
                </div>
              </div>

              {/* Welded Ductwork */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Welded Ductwork (W)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.w_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.w_field_cost ? `$${selectedProject.w_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.w_shop || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Shop Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.w_shop_cost ? `$${selectedProject.w_shop_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.w_material_cost ? `$${selectedProject.w_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Materials w/ Escalation</label><div style={{ fontWeight: 600 }}>{selectedProject.w_materials_with_escalation ? `$${selectedProject.w_materials_with_escalation.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>LBS per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.w_lbs_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total LBS</label><div style={{ fontWeight: 600 }}>{selectedProject.w_lbs || '-'}</div></div>
                </div>
              </div>

              {/* Plumbing Field */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Plumbing Field (PF)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Rate</label><div style={{ fontWeight: 600 }}>{selectedProject.pf_field_rate || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Misc Field</label><div style={{ fontWeight: 600 }}>{selectedProject.pf_misc_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Misc Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.pf_misc_field_cost ? `$${selectedProject.pf_misc_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Equip Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.pf_equip_cost ? `$${selectedProject.pf_equip_cost.toLocaleString()}` : '-'}</div></div>
                </div>
              </div>

              {/* Piping Systems - HW */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Hot Water Piping (HW)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.hw_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.hw_field_cost ? `$${selectedProject.hw_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.hw_material_cost ? `$${selectedProject.hw_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.hw_material_with_esc ? `$${selectedProject.hw_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.hw_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.hw_footage || '-'}</div></div>
                </div>
              </div>

              {/* Piping Systems - CHW */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Chilled Water Piping (CHW)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.chw_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.chw_field_cost ? `$${selectedProject.chw_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.chw_material_cost ? `$${selectedProject.chw_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.chw_material_with_esc ? `$${selectedProject.chw_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.chw_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.chw_footage || '-'}</div></div>
                </div>
              </div>

              {/* Piping Systems - D, G, GS, CW, RAD, REF, Stm&Cond - Following same pattern */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Domestic Water Piping (D)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.d_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.d_field_cost ? `$${selectedProject.d_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.d_material_cost ? `$${selectedProject.d_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.d_material_with_esc ? `$${selectedProject.d_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.d_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.d_footage || '-'}</div></div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Gas Piping (G)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.g_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.g_field_cost ? `$${selectedProject.g_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.g_material_cost ? `$${selectedProject.g_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.g_material_with_esc ? `$${selectedProject.g_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.g_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.g_footage || '-'}</div></div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Grease Piping (GS)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.gs_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.gs_field_cost ? `$${selectedProject.gs_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.gs_material_cost ? `$${selectedProject.gs_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.gs_material_with_esc ? `$${selectedProject.gs_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.gs_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.gs_footage || '-'}</div></div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Condensate Water Piping (CW)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.cw_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.cw_field_cost ? `$${selectedProject.cw_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.cw_material_cost ? `$${selectedProject.cw_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.cw_material_with_esc ? `$${selectedProject.cw_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.cw_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.cw_footage || '-'}</div></div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Radiant Piping (RAD)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.rad_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.rad_field_cost ? `$${selectedProject.rad_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.rad_material_cost ? `$${selectedProject.rad_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.rad_material_with_esc ? `$${selectedProject.rad_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.rad_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.rad_footage || '-'}</div></div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Refrigerant Piping (REF)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.ref_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.ref_field_cost ? `$${selectedProject.ref_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.ref_material_cost ? `$${selectedProject.ref_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.ref_material_with_esc ? `$${selectedProject.ref_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.ref_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.ref_footage || '-'}</div></div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Steam & Condensate Piping (Stm&Cond)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Hours</label><div style={{ fontWeight: 600 }}>{selectedProject.stm_cond_field || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Field Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.stm_cond_field_cost ? `$${selectedProject.stm_cond_field_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material Cost</label><div style={{ fontWeight: 600 }}>{selectedProject.stm_cond_material_cost ? `$${selectedProject.stm_cond_material_cost.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Material w/ Esc</label><div style={{ fontWeight: 600 }}>{selectedProject.stm_cond_material_with_esc ? `$${selectedProject.stm_cond_material_with_esc.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Feet per Sq</label><div style={{ fontWeight: 600 }}>{selectedProject.stm_cond_feet_per_sq || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total Footage</label><div style={{ fontWeight: 600 }}>{selectedProject.stm_cond_footage || '-'}</div></div>
                </div>
              </div>

              {/* Equipment Counts - ALL equipment */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Equipment Counts</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
                  {selectedProject.ahu > 0 && <div><strong>AHU:</strong> {selectedProject.ahu}</div>}
                  {selectedProject.rtu > 0 && <div><strong>RTU:</strong> {selectedProject.rtu}</div>}
                  {selectedProject.mau > 0 && <div><strong>MAU:</strong> {selectedProject.mau}</div>}
                  {selectedProject.eru > 0 && <div><strong>ERU:</strong> {selectedProject.eru}</div>}
                  {selectedProject.chiller > 0 && <div><strong>Chiller:</strong> {selectedProject.chiller}</div>}
                  {selectedProject.drycooler > 0 && <div><strong>Drycooler:</strong> {selectedProject.drycooler}</div>}
                  {selectedProject.vfd > 0 && <div><strong>VFD:</strong> {selectedProject.vfd}</div>}
                  {selectedProject.vav > 0 && <div><strong>VAV:</strong> {selectedProject.vav}</div>}
                  {selectedProject.vav_fan_powered > 0 && <div><strong>VAV Fan Powered:</strong> {selectedProject.vav_fan_powered}</div>}
                  {selectedProject.booster_coil > 0 && <div><strong>Booster Coil:</strong> {selectedProject.booster_coil}</div>}
                  {selectedProject.cuh > 0 && <div><strong>CUH:</strong> {selectedProject.cuh}</div>}
                  {selectedProject.uh > 0 && <div><strong>UH:</strong> {selectedProject.uh}</div>}
                  {selectedProject.fcu > 0 && <div><strong>FCU:</strong> {selectedProject.fcu}</div>}
                  {selectedProject.indoor_vrf_systems > 0 && <div><strong>Indoor VRF Systems:</strong> {selectedProject.indoor_vrf_systems}</div>}
                  {selectedProject.radiant_panels > 0 && <div><strong>Radiant Panels:</strong> {selectedProject.radiant_panels}</div>}
                  {selectedProject.humidifier > 0 && <div><strong>Humidifier:</strong> {selectedProject.humidifier}</div>}
                  {selectedProject.prv > 0 && <div><strong>PRV:</strong> {selectedProject.prv}</div>}
                  {selectedProject.inline_fan > 0 && <div><strong>Inline Fan:</strong> {selectedProject.inline_fan}</div>}
                  {selectedProject.high_plume_fan > 0 && <div><strong>High Plume Fan:</strong> {selectedProject.high_plume_fan}</div>}
                  {selectedProject.rac > 0 && <div><strong>RAC:</strong> {selectedProject.rac}</div>}
                  {selectedProject.lieberts > 0 && <div><strong>Lieberts:</strong> {selectedProject.lieberts}</div>}
                  {selectedProject.grds > 0 && <div><strong>GRDs:</strong> {selectedProject.grds}</div>}
                  {selectedProject.laminar_flow > 0 && <div><strong>Laminar Flow:</strong> {selectedProject.laminar_flow}</div>}
                  {selectedProject.louvers > 0 && <div><strong>Louvers:</strong> {selectedProject.louvers}</div>}
                  {selectedProject.hoods > 0 && <div><strong>Hoods:</strong> {selectedProject.hoods}</div>}
                  {selectedProject.fire_dampers > 0 && <div><strong>Fire Dampers:</strong> {selectedProject.fire_dampers}</div>}
                  {selectedProject.silencers > 0 && <div><strong>Silencers:</strong> {selectedProject.silencers}</div>}
                  {selectedProject.boilers > 0 && <div><strong>Boilers:</strong> {selectedProject.boilers}</div>}
                  {selectedProject.htx > 0 && <div><strong>HTX:</strong> {selectedProject.htx}</div>}
                  {selectedProject.pumps > 0 && <div><strong>Pumps:</strong> {selectedProject.pumps}</div>}
                  {selectedProject.cond_pumps > 0 && <div><strong>Cond Pumps:</strong> {selectedProject.cond_pumps}</div>}
                  {selectedProject.tower > 0 && <div><strong>Tower:</strong> {selectedProject.tower}</div>}
                  {selectedProject.air_sep > 0 && <div><strong>Air Sep:</strong> {selectedProject.air_sep}</div>}
                  {selectedProject.exp_tanks > 0 && <div><strong>Exp Tanks:</strong> {selectedProject.exp_tanks}</div>}
                  {selectedProject.filters > 0 && <div><strong>Filters:</strong> {selectedProject.filters}</div>}
                  {selectedProject.pot_feeder > 0 && <div><strong>Pot Feeder:</strong> {selectedProject.pot_feeder}</div>}
                  {selectedProject.buffer_tank > 0 && <div><strong>Buffer Tank:</strong> {selectedProject.buffer_tank}</div>}
                  {selectedProject.triple_duty > 0 && <div><strong>Triple Duty:</strong> {selectedProject.triple_duty}</div>}
                </div>
              </div>

              {/* Additional Costs */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Additional Costs</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Truck Rental</label><div style={{ fontWeight: 600 }}>{selectedProject.truck_rental ? `$${selectedProject.truck_rental.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Temp Heat</label><div style={{ fontWeight: 600 }}>{selectedProject.temp_heat || '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Controls</label><div style={{ fontWeight: 600 }}>{selectedProject.controls ? `$${selectedProject.controls.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Insulation</label><div style={{ fontWeight: 600 }}>{selectedProject.insulation ? `$${selectedProject.insulation.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Balancing</label><div style={{ fontWeight: 600 }}>{selectedProject.balancing ? `$${selectedProject.balancing.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Electrical</label><div style={{ fontWeight: 600 }}>{selectedProject.electrical ? `$${selectedProject.electrical.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>General</label><div style={{ fontWeight: 600 }}>{selectedProject.general ? `$${selectedProject.general.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Allowance</label><div style={{ fontWeight: 600 }}>{selectedProject.allowance ? `$${selectedProject.allowance.toLocaleString()}` : '-'}</div></div>
                  <div><label style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Geo Thermal</label><div style={{ fontWeight: 600 }}>{selectedProject.geo_thermal ? `$${selectedProject.geo_thermal.toLocaleString()}` : '-'}</div></div>
                </div>
              </div>

              {/* Notes */}
              {selectedProject.notes && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #002356', paddingBottom: '0.5rem' }}>Notes</h3>
                  <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                    {selectedProject.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedProject(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="modal-overlay" onClick={() => setEditingProject(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Project</h2>
              <button
                className="modal-close"
                onClick={() => setEditingProject(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Project Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingProject.name || ''}
                      onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Bid Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editingProject.bid_date ? editingProject.bid_date.split('T')[0] : ''}
                      onChange={(e) => setEditingProject({...editingProject, bid_date: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Building Type</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingProject.building_type || ''}
                      onChange={(e) => setEditingProject({...editingProject, building_type: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Project Type</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingProject.project_type || ''}
                      onChange={(e) => setEditingProject({...editingProject, project_type: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Bid Type</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingProject.bid_type || ''}
                      onChange={(e) => setEditingProject({...editingProject, bid_type: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Total Cost</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editingProject.total_cost || ''}
                      onChange={(e) => setEditingProject({...editingProject, total_cost: parseFloat(e.target.value) || null})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Total SqFt</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editingProject.total_sqft || ''}
                      onChange={(e) => setEditingProject({...editingProject, total_sqft: parseFloat(e.target.value) || null})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Cost per SqFt (with Index)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={editingProject.cost_per_sqft_with_index || ''}
                      onChange={(e) => setEditingProject({...editingProject, cost_per_sqft_with_index: parseFloat(e.target.value) || null})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Total Cost per SqFt</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={editingProject.total_cost_per_sqft || ''}
                      onChange={(e) => setEditingProject({...editingProject, total_cost_per_sqft: parseFloat(e.target.value) || null})}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingProject(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostDatabase;
