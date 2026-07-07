import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResumeProject } from '../../services/employeeResumes';
import { laborApi, EmployeeHistoryRecord } from '../../services/labor';
import api from '../../services/api';
import RankableSectionList from './RankableSectionList';
import './ResumeProjectManager.css';

interface Props {
  resumeId?: number;
  employeeId?: number;
  value: ResumeProject[];
  onChange: (projects: ResumeProject[]) => void;
  limit?: number;
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

const ResumeProjectManager: React.FC<Props> = ({ employeeId, value, onChange, limit }) => {
  const [activeTab, setActiveTab] = useState<'database' | 'labor'>(employeeId ? 'labor' : 'database');
  const [searchTerm, setSearchTerm] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [pmFilter, setPmFilter] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ResumeProject>>({});

  // Fetch all projects from database
  const { data: dbProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects', 'all'],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data;
    },
  });

  // Fetch labor assignment history when employee is linked
  const { data: laborHistory = [], isLoading: laborLoading } = useQuery<EmployeeHistoryRecord[]>({
    queryKey: ['laborHistory', employeeId],
    queryFn: () => laborApi.getEmployeeHistory(employeeId!),
    enabled: !!employeeId,
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

  const buildRoleLabel = (rec: EmployeeHistoryRecord): string => {
    const trade = rec.trade || rec.employee_trade || '';
    const role = rec.role || rec.employee_title || '';
    if (trade && role) return `${trade} ${role}`;
    return role || trade || '';
  };

  const handleAddFromLabor = (rec: EmployeeHistoryRecord) => {
    const effectiveStart = rec.start_date || rec.project_start_date || '';
    const effectiveEnd = rec.end_date || rec.project_end_date || '';
    const contractAmt = rec.contract_amount ? parseFloat(rec.contract_amount) : 0;

    const newProject: Partial<ResumeProject> = {
      project_id: rec.project_id,
      project_name: rec.project_name,
      project_role: buildRoleLabel(rec),
      customer_name: rec.customer_name || '',
      project_value: contractAmt,
      start_date: effectiveStart,
      end_date: effectiveEnd,
      description: '',
      square_footage: rec.square_footage || 0,
      location: rec.project_address || '',
      display_order: value.length,
    };

    onChange([...value, newProject as ResumeProject]);
  };

  const formatCurrency = (val: unknown) => {
    if (val == null || val === '') return '';
    const numVal = typeof val === 'number' ? val : parseFloat(String(val));
    if (!Number.isFinite(numVal) || numVal <= 0) return '';
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
    return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const getYear = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00').getFullYear().toString();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setMarketFilter('');
    setCustomerFilter('');
    setPmFilter('');
    setMinValue('');
    setMaxValue('');
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1.25rem',
    border: 'none',
    borderBottom: active ? '2px solid #1e3a5f' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    color: active ? '#1e3a5f' : '#6b7280',
    fontSize: '0.95rem',
  });

  return (
    <div className="resume-project-manager">
      {/* Current Projects on Resume — shown above the picker */}
      {value.length > 0 && (
        <div className="current-projects" style={{ marginBottom: '2rem' }}>
          <h4 style={{ margin: '0 0 0.75rem' }}>Projects on Resume ({value.length})</h4>
          <RankableSectionList
            items={value}
            limit={limit}
            onMove={(from, to) => {
              if (to < 0 || to >= value.length) return;
              const next = [...value];
              const [item] = next.splice(from, 1);
              next.splice(to, 0, item);
              next.forEach((p, i) => (p.display_order = i));
              onChange(next);
            }}
            onRemove={(index) => {
              const next = value.filter((_, i) => i !== index);
              next.forEach((p, i) => (p.display_order = i));
              onChange(next);
              if (editingIndex === index) setEditingIndex(null);
            }}
            onEdit={(index) => {
              if (editingIndex === index) {
                setEditingIndex(null);
              } else {
                setEditingIndex(index);
                setEditDraft({ ...value[index] });
              }
            }}
            renderContent={(project) => {
              const valueText = formatCurrency(project.project_value);
              return (
                <div>
                  <div style={{ fontWeight: 600 }}>{project.project_name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>
                    {project.project_role && <span>{project.project_role}</span>}
                    {project.customer_name && <span>• {project.customer_name}</span>}
                    {project.location && <span>• {project.location}</span>}
                    {valueText && (
                      <span style={{ fontWeight: 600, color: '#1e3a5f' }}>• {valueText}</span>
                    )}
                    {(project.start_date || project.end_date) && (
                      <span>
                        • {formatDate(project.start_date)} - {project.end_date ? formatDate(project.end_date) : 'Present'}
                      </span>
                    )}
                  </div>
                </div>
              );
            }}
            emptyMessage="No projects added yet."
          />

          {/* Inline edit panel */}
          {editingIndex !== null && value[editingIndex] && (
            <div style={{
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '1rem 1.25rem',
              backgroundColor: '#f0f7ff',
              marginTop: '0.5rem',
            }}>
              <h5 style={{ margin: '0 0 0.85rem', color: '#1e40af', fontSize: '0.9rem' }}>
                Edit: {value[editingIndex].project_name}
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Project Name</label>
                  <input className="input" style={{ width: '100%' }} value={editDraft.project_name ?? ''} onChange={e => setEditDraft(d => ({ ...d, project_name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Role</label>
                  <input className="input" style={{ width: '100%' }} value={editDraft.project_role ?? ''} onChange={e => setEditDraft(d => ({ ...d, project_role: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Client</label>
                  <input className="input" style={{ width: '100%' }} value={editDraft.customer_name ?? ''} onChange={e => setEditDraft(d => ({ ...d, customer_name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Value ($)</label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="text"
                    value={editDraft.project_value != null ? editDraft.project_value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setEditDraft(d => ({ ...d, project_value: raw === '' ? undefined : parseInt(raw, 10) }));
                    }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Start Date</label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="date"
                    value={editDraft.start_date ? editDraft.start_date.slice(0, 10) : ''}
                    onChange={e => setEditDraft(d => ({ ...d, start_date: e.target.value || undefined }))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>End Date</label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="date"
                    value={editDraft.end_date ? editDraft.end_date.slice(0, 10) : ''}
                    onChange={e => setEditDraft(d => ({ ...d, end_date: e.target.value || undefined }))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Location</label>
                  <input className="input" style={{ width: '100%' }} value={editDraft.location ?? ''} onChange={e => setEditDraft(d => ({ ...d, location: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Sq Footage</label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="text"
                    value={editDraft.square_footage != null ? String(editDraft.square_footage) : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setEditDraft(d => ({ ...d, square_footage: raw === '' ? undefined : parseInt(raw) }));
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Description</label>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                  value={editDraft.description ?? ''}
                  onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="Optional project description..."
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
                  onClick={() => {
                    const next = value.map((p, i) => i === editingIndex ? { ...p, ...editDraft } as ResumeProject : p);
                    onChange(next);
                    setEditingIndex(null);
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btnSecondary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
                  onClick={() => setEditingIndex(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab switcher — only show Labor History tab when employee is linked */}
      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '1rem', display: 'flex', gap: 0 }}>
        {employeeId && (
          <button type="button" style={tabBtnStyle(activeTab === 'labor')} onClick={() => setActiveTab('labor')}>
            Labor History
          </button>
        )}
        <button type="button" style={tabBtnStyle(activeTab === 'database')} onClick={() => setActiveTab('database')}>
          All Projects
        </button>
      </div>

      {/* ── Labor History Tab ── */}
      {activeTab === 'labor' && employeeId && (
        <div>
          {laborLoading ? (
            <p>Loading labor history...</p>
          ) : laborHistory.length === 0 ? (
            <p className="no-projects">No labor assignments found for this employee.</p>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
              <table className="projects-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f5f5f5', zIndex: 1 }}>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Project</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Client</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Role</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Dates</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Value</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {laborHistory.map((rec) => {
                    const isAdded = value.some(p => p.project_id === rec.project_id);
                    const roleLabel = buildRoleLabel(rec);
                    const startStr = rec.start_date || rec.project_start_date;
                    const endStr = rec.end_date || rec.project_end_date;
                    const contractAmt = rec.contract_amount ? parseFloat(rec.contract_amount) : null;
                    return (
                      <tr key={rec.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 500 }}>{rec.project_name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>#{rec.project_number}</div>
                          {rec.market && <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{rec.market}</div>}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{rec.customer_name || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                          }}>
                            {roleLabel || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                          {startStr ? formatDate(startStr) : '—'}
                          {' – '}
                          {endStr ? formatDate(endStr) : 'Present'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {contractAmt && contractAmt > 0 ? formatCurrency(contractAmt) : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btnSecondary"
                            onClick={() => handleAddFromLabor(rec)}
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

      {/* ── All Projects (Database) Tab ── */}
      {activeTab === 'database' && (
        isLoading ? (
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
        )
      )}

    </div>
  );
};

export default ResumeProjectManager;
