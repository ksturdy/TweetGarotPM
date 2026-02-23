import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResumeProject } from '../../services/employeeResumes';
import api from '../../services/api';
import './ResumeProjectManager.css';

interface Props {
  resumeId?: number;
  employeeId?: number;
  value: ResumeProject[];
  onChange: (projects: ResumeProject[]) => void;
}

interface Project {
  id: number;
  name: string;
  number: string;
  customer_id?: number;
  customer_name?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  contract_value?: number;
  square_footage?: number;
  address?: string;
  market?: string;
  manager_id?: number;
  manager_name?: string; // Backend returns manager_name, not manager_name
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, value, onChange, options, placeholder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const search = searchTerm.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(search));
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  const displayValue = value || placeholder;

  return (
    <div style={{ flex: '1 1 200px', position: 'relative' }} ref={wrapperRef}>
      <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="input"
          placeholder={displayValue}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          style={{ width: '100%', paddingRight: value ? '30px' : '8px' }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: '#666',
              padding: '0 4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            marginTop: '2px',
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '0.5rem', color: '#999', fontSize: '0.9rem' }}>No matches</div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option}
                onClick={() => handleSelect(option)}
                style={{
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  backgroundColor: value === option ? '#f0f0f0' : 'transparent',
                  fontSize: '0.9rem',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = value === option ? '#f0f0f0' : 'transparent')}
              >
                {option}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ResumeProjectManager: React.FC<Props> = ({ employeeId, value, onChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [pmFilter, setPmFilter] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  // Fetch all projects from database
  const { data: dbProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects', 'all'],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data;
    },
  });

  // Get unique values for filters
  const markets = useMemo(() => {
    const unique = [...new Set(dbProjects.map(p => p.market).filter((m): m is string => Boolean(m)))];
    return unique.sort();
  }, [dbProjects]);

  const customers = useMemo(() => {
    const unique = [...new Set(dbProjects.map(p => p.customer_name).filter((c): c is string => Boolean(c)))];
    return unique.sort();
  }, [dbProjects]);

  const projectManagers = useMemo(() => {
    const unique = [...new Set(dbProjects.map(p => p.manager_name).filter((pm): pm is string => Boolean(pm)))];
    return unique.sort();
  }, [dbProjects]);

  // Filter and search projects
  const filteredProjects = useMemo(() => {
    let filtered = dbProjects;

    // Apply search
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(search) ||
        project.number.toLowerCase().includes(search) ||
        (project.customer_name && project.customer_name.toLowerCase().includes(search))
      );
    }

    // Apply market filter
    if (marketFilter) {
      filtered = filtered.filter(p => p.market === marketFilter);
    }

    // Apply customer filter
    if (customerFilter) {
      filtered = filtered.filter(p => p.customer_name === customerFilter);
    }

    // Apply PM filter
    if (pmFilter) {
      filtered = filtered.filter(p => p.manager_name === pmFilter);
    }

    // Apply value range filter
    if (minValue || maxValue) {
      filtered = filtered.filter(p => {
        const value = p.contract_value || 0;
        const min = minValue ? parseFloat(minValue) : 0;
        const max = maxValue ? parseFloat(maxValue) : Infinity;
        return value >= min && value <= max;
      });
    }

    return filtered;
  }, [dbProjects, searchTerm, marketFilter, customerFilter, pmFilter, minValue, maxValue]);

  const handleAddFromDatabase = (project: Project) => {
    const newProject: Partial<ResumeProject> = {
      project_id: project.id,
      project_name: project.name,
      project_role: 'Project Manager',
      customer_name: project.customer_name || '',
      project_value: project.contract_value || 0,
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      description: '',
      square_footage: project.square_footage || 0,
      location: project.address || '',
      display_order: value.length,
    };

    onChange([...value, newProject as ResumeProject]);
  };

  const handleRemove = (projectId: number) => {
    if (window.confirm('Remove this project from resume?')) {
      onChange(value.filter(p => p.project_id !== projectId));
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newProjects = [...value];
    [newProjects[index - 1], newProjects[index]] = [newProjects[index], newProjects[index - 1]];
    newProjects.forEach((p, i) => p.display_order = i);
    onChange(newProjects);
  };

  const handleMoveDown = (index: number) => {
    if (index === value.length - 1) return;
    const newProjects = [...value];
    [newProjects[index], newProjects[index + 1]] = [newProjects[index + 1], newProjects[index]];
    newProjects.forEach((p, i) => p.display_order = i);
    onChange(newProjects);
  };

  const formatCurrency = (val?: number) => {
    if (!val) return '';
    const numVal = Number(val);
    return `$${numVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatNumberInput = (val: string) => {
    if (!val) return '';
    const num = parseFloat(val.replace(/,/g, ''));
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const handleMinValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, '');
    if (value === '' || /^\d+$/.test(value)) {
      setMinValue(value);
    }
  };

  const handleMaxValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, '');
    if (value === '' || /^\d+$/.test(value)) {
      setMaxValue(value);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const getYear = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).getFullYear().toString();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setMarketFilter('');
    setCustomerFilter('');
    setPmFilter('');
    setMinValue('');
    setMaxValue('');
  };

  return (
    <div className="resume-project-manager">
      <h4>Add Projects from Database</h4>

      {isLoading ? (
        <p>Loading projects...</p>
      ) : dbProjects.length === 0 ? (
        <p className="no-projects">No projects found in database.</p>
      ) : (
        <div className="database-projects">
          {/* Search and Filters */}
          <div className="filters-container" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
              <div style={{ flex: '1 1 300px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Search</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Search by project name, number, or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ flex: '0 0 150px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Min Value ($)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="0"
                  value={formatNumberInput(minValue)}
                  onChange={handleMinValueChange}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ flex: '0 0 150px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Max Value ($)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="No limit"
                  value={formatNumberInput(maxValue)}
                  onChange={handleMaxValueChange}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <SearchableSelect
                label="Market"
                value={marketFilter}
                onChange={setMarketFilter}
                options={markets}
                placeholder="All Markets"
              />

              <SearchableSelect
                label="Client"
                value={customerFilter}
                onChange={setCustomerFilter}
                options={customers}
                placeholder="All Clients"
              />

              <SearchableSelect
                label="Project Manager"
                value={pmFilter}
                onChange={setPmFilter}
                options={projectManagers}
                placeholder="All PMs"
              />

              {(searchTerm || marketFilter || customerFilter || pmFilter || minValue || maxValue) && (
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={clearFilters}
                  style={{ marginBottom: '0' }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              Showing {Math.min(filteredProjects.length, 30)} of {filteredProjects.length} filtered projects
              {filteredProjects.length > 30 && ' (limited to first 30)'}
            </p>
          </div>

          {/* Projects Table */}
          {filteredProjects.length === 0 ? (
            <p className="no-projects">No projects match your filters.</p>
          ) : (
            <div style={{
              maxHeight: '600px',
              overflowY: 'auto',
              overflowX: 'auto',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
              <table className="projects-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f5f5f5', zIndex: 1 }}>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Project Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Client</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Year</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Value</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Market</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Project Manager</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.slice(0, 30).map((project) => {
                    const isAdded = value.some(p => p.project_id === project.id);
                    return (
                      <tr key={project.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: '500' }}>{project.name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>#{project.number}</div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{project.customer_name || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{getYear(project.start_date)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(project.contract_value)}</td>
                        <td style={{ padding: '0.75rem' }}>{project.market || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{project.manager_name || '-'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btnSecondary"
                            onClick={() => handleAddFromDatabase(project)}
                            disabled={isAdded}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                          >
                            {isAdded ? 'Added ✓' : '+ Add'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Current Projects on Resume */}
      {value.length > 0 && (
        <div className="current-projects" style={{ marginTop: '2rem' }}>
          <h4>Projects on Resume ({value.length})</h4>
          <div className="projects-list">
            {value.map((project, index) => (
              <div key={project.project_id || index} className="project-card">
                <div className="project-header">
                  <div>
                    <h5>{project.project_name}</h5>
                    <p className="project-role">{project.project_role}</p>
                  </div>
                  <div className="project-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === value.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-btn delete"
                      onClick={() => handleRemove(project.project_id!)}
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="project-details">
                  {project.customer_name && <span>• {project.customer_name}</span>}
                  {project.location && <span>• {project.location}</span>}
                  {project.project_value && <span>• {formatCurrency(project.project_value)}</span>}
                  {(project.start_date || project.end_date) && (
                    <span>• {formatDate(project.start_date)} - {project.end_date ? formatDate(project.end_date) : 'Present'}</span>
                  )}
                </div>
                {project.description && (
                  <p className="project-description">{project.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeProjectManager;
