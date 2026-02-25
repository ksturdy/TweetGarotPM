import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { customersApi, Customer } from '../../services/customers';
import SearchableSelect from '../../components/SearchableSelect';
import { format } from 'date-fns';
import '../../styles/SalesPipeline.css';

// Market icons - matching opportunities
const MARKET_OPTIONS = [
  { value: 'Healthcare', icon: '🏥', label: 'Healthcare' },
  { value: 'Education', icon: '🏫', label: 'Education' },
  { value: 'Commercial', icon: '🏢', label: 'Commercial' },
  { value: 'Industrial', icon: '🏭', label: 'Industrial' },
  { value: 'Retail', icon: '🏬', label: 'Retail' },
  { value: 'Government', icon: '🏛️', label: 'Government' },
  { value: 'Hospitality', icon: '🏨', label: 'Hospitality' },
  { value: 'Data Center', icon: '💾', label: 'Data Center' },
  // VP Markets
  { value: 'MFG-Food', icon: '🍔', label: 'MFG-Food' },
  { value: 'Health Care', icon: '🏥', label: 'Health Care' },
  { value: 'MFG-Other', icon: '🏭', label: 'MFG-Other' },
  { value: 'MFG-Paper', icon: '📄', label: 'MFG-Paper' },
  { value: 'Amusement/Recreation', icon: '🎢', label: 'Amusement/Recreation' },
  { value: 'Educational', icon: '🏫', label: 'Educational' },
  { value: 'Manufacturing', icon: '🏭', label: 'Manufacturing' },
  { value: 'Office', icon: '🏢', label: 'Office' },
  { value: 'Power', icon: '⚡', label: 'Power' },
  { value: 'Lodging', icon: '🏨', label: 'Lodging' },
  { value: 'Religious', icon: '⛪', label: 'Religious' },
  { value: 'Public Safety', icon: '🚔', label: 'Public Safety' },
  { value: 'Transportation', icon: '🚚', label: 'Transportation' },
  { value: 'Communication', icon: '📡', label: 'Communication' },
  { value: 'Conservation/Development', icon: '🌲', label: 'Conservation/Development' },
  { value: 'Sewage/Waste Disposal', icon: '♻️', label: 'Sewage/Waste Disposal' },
  { value: 'Highway/Street', icon: '🛣️', label: 'Highway/Street' },
  { value: 'Water Supply', icon: '💧', label: 'Water Supply' },
  { value: 'Residential', icon: '🏠', label: 'Residential' },
];

const MODULE_ICONS: { [key: string]: string } = {
  financials: '💰',
  companies: '🏗️',
  specifications: '📋',
  drawings: '📐',
  rfis: '❓',
  submittals: '📦',
  'change-orders': '📝',
  'daily-reports': '📅',
  schedule: '📆',
  'weekly-goals': '🎯',
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEditingTitan, setIsEditingTitan] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(Number(id)).then((res) => res.data),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  // Titan-editable fields only
  const [titanFormData, setTitanFormData] = useState({
    customer_id: '',
    owner_customer_id: '',
    description: '',
  });

  React.useEffect(() => {
    if (project) {
      setTitanFormData({
        customer_id: project.customer_id?.toString() || '',
        owner_customer_id: project.owner_customer_id?.toString() || '',
        description: project.description || '',
      });
    }
  }, [project]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => projectsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsEditingTitan(false);
    },
  });

  const handleTitanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      customerId: titanFormData.customer_id ? Number(titanFormData.customer_id) : undefined,
      ownerCustomerId: titanFormData.owner_customer_id ? Number(titanFormData.owner_customer_id) : undefined,
      description: titanFormData.description || undefined,
    };
    updateMutation.mutate(submitData);
  };

  const handleTitanChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTitanFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!project) {
    return <div className="card">Project not found</div>;
  }

  const modules = [
    { path: 'financials', label: 'Financials', description: 'Contract financials and billing' },
    { path: 'companies', label: 'Companies', description: 'Stakeholders and contacts' },
    { path: 'specifications', label: 'Specifications', description: 'Project specifications with Q&A' },
    { path: 'drawings', label: 'Drawings', description: 'Construction drawings and plans' },
    { path: 'rfis', label: 'RFIs', description: 'Requests for Information' },
    { path: 'submittals', label: 'Submittals', description: 'Shop drawings and product data' },
    { path: 'change-orders', label: 'Change Orders', description: 'Contract modifications' },
    { path: 'daily-reports', label: 'Daily Reports', description: 'Field activity logs' },
    { path: 'schedule', label: 'Schedule', description: 'Project timeline and milestones' },
    { path: 'weekly-goals', label: 'Weekly Goal Plans', description: 'Track weekly goals and daily tasks by trade' },
  ];

  const getStatusColor = (status: string): string => {
    const colors: { [key: string]: string } = {
      'Open': '#10b981',
      'Soft-Closed': '#f59e0b',
      'Hard-Closed': '#6b7280',
      'active': '#10b981',
      'on_hold': '#f59e0b',
      'completed': '#3b82f6',
      'cancelled': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const marketIcon = MARKET_OPTIONS.find(m => m.value === project.market)?.icon || '';

  // Inline styles
  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: '1px',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    fontWeight: 500,
    lineHeight: 1.3,
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '0.4rem',
  };

  return (
    <div>
      {/* Compact Header Banner */}
      <div style={{ marginBottom: '0.75rem' }}>
        <Link to="/projects" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.8rem' }}>
          &larr; Back to Projects
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
          <h1 style={{
            margin: 0,
            fontSize: '1.35rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1a56db, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {project.name}
          </h1>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '9999px',
            background: `${getStatusColor(project.status)}18`,
            color: getStatusColor(project.status),
            fontWeight: 600,
            border: `1px solid ${getStatusColor(project.status)}40`,
          }}>
            {project.status}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
          {project.number} &middot; {project.client || 'No client'} &middot; {project.manager_name || 'No PM'}
          {project.market ? ` &middot; ${marketIcon} ${project.market}` : ''}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: '0.75rem' }}>

        {/* COLUMN 1: Vista Project Data */}
        <div className="card" style={{ padding: '0.85rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.6rem',
            paddingBottom: '0.5rem',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '1rem' }}>📊</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Vista Project Data</span>
            <span style={{
              fontSize: '0.6rem',
              padding: '0.1rem 0.4rem',
              background: '#f1f5f9',
              borderRadius: '3px',
              color: '#64748b',
              marginLeft: 'auto'
            }}>
              Read-only
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.1rem 0.75rem' }}>
            <div style={fieldStyle}>
              <div style={labelStyle}>Project Number</div>
              <div style={valueStyle}>{project.number}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Status</div>
              <div style={{ ...valueStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: getStatusColor(project.status), display: 'inline-block'
                }} />
                {project.status}
              </div>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Project Name</div>
              <div style={valueStyle}>{project.name}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Client (Vista)</div>
              <div style={valueStyle}>{project.client || '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Project Manager</div>
              <div style={valueStyle}>{project.manager_name || '-'}</div>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Address</div>
              <div style={{ fontSize: '0.8rem' }}>{project.address || '-'}</div>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Ship Address</div>
              <div style={{ fontSize: '0.8rem' }}>{project.ship_address || '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Ship City</div>
              <div style={{ fontSize: '0.8rem' }}>{project.ship_city || '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Ship State / Zip</div>
              <div style={{ fontSize: '0.8rem' }}>
                {project.ship_state || '-'} {project.ship_zip || ''}
              </div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Market</div>
              <div style={{ fontSize: '0.8rem' }}>
                {project.market ? <>{marketIcon} {project.market}</> : '-'}
              </div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Department</div>
              <div style={{ fontSize: '0.8rem' }}>{project.department_number || '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Start Date</div>
              <div style={{ fontSize: '0.8rem' }}>
                {project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : '-'}
              </div>
            </div>
          </div>

          {/* Financial Metrics - inline row */}
          {(project.contract_value || project.gross_margin_percent !== undefined || project.backlog ||
            project.projected_revenue || project.projected_cost || project.actual_cost) && (
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <div style={{
                  textAlign: 'center', padding: '0.4rem',
                  background: '#f8fafc', borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Contract</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.contract_value ? `$${Number(project.contract_value).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center', padding: '0.4rem',
                  background: '#f8fafc', borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>GM%</div>
                  <div style={{
                    fontSize: '0.95rem', fontWeight: 600,
                    color: project.gross_margin_percent && project.gross_margin_percent !== 0 ? '#ffffff' : '#3b82f6',
                    backgroundColor: project.gross_margin_percent && project.gross_margin_percent > 0 ? '#10b981'
                      : project.gross_margin_percent && project.gross_margin_percent < 0 ? '#ef4444' : 'transparent',
                    padding: project.gross_margin_percent && project.gross_margin_percent !== 0 ? '0.15rem 0.5rem' : '0',
                    borderRadius: project.gross_margin_percent && project.gross_margin_percent !== 0 ? '4px' : '0',
                    display: 'inline-block'
                  }}>
                    {project.gross_margin_percent !== undefined && project.gross_margin_percent !== null
                      ? `${(Number(project.gross_margin_percent) * 100).toFixed(1)}%` : '-'}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center', padding: '0.4rem',
                  background: '#f8fafc', borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Backlog</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.backlog ? `$${Number(project.backlog).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                <div style={{
                  textAlign: 'center', padding: '0.4rem',
                  background: '#f8fafc', borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Projected Revenue</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.projected_revenue ? `$${Number(project.projected_revenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center', padding: '0.4rem',
                  background: '#f8fafc', borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Projected Cost</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.projected_cost ? `$${Number(project.projected_cost).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center', padding: '0.4rem',
                  background: '#f8fafc', borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>JTD Cost</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.actual_cost ? `$${Number(project.actual_cost).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 2: Titan Project Details */}
        <div className="card" style={{ padding: '0.85rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.6rem',
            paddingBottom: '0.5rem',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '1rem' }}>🔧</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Titan Project Details</span>
            {!isEditingTitan && (
              <button
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', padding: '0.15rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setIsEditingTitan(true)}
              >
                Edit
              </button>
            )}
          </div>

          {isEditingTitan ? (
            <form onSubmit={handleTitanSubmit}>
              <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Customer (GC)</label>
                <SearchableSelect
                  options={customers.map((c: Customer) => ({ value: c.id, label: c.customer_owner }))}
                  value={titanFormData.customer_id}
                  onChange={(value) => setTitanFormData(prev => ({ ...prev, customer_id: value }))}
                  placeholder="-- Select Customer --"
                />
                <small style={{ color: '#64748b', fontSize: '0.65rem' }}>The General Contractor you have the contract with</small>
              </div>

              <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Owner</label>
                <SearchableSelect
                  options={customers.map((c: Customer) => ({ value: c.id, label: c.customer_owner }))}
                  value={titanFormData.owner_customer_id}
                  onChange={(value) => setTitanFormData(prev => ({ ...prev, owner_customer_id: value }))}
                  placeholder="-- Select Owner --"
                />
                <small style={{ color: '#64748b', fontSize: '0.65rem' }}>The building owner / end customer</small>
              </div>

              <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Notes</label>
                <textarea
                  name="description"
                  className="form-input"
                  rows={3}
                  value={titanFormData.description}
                  onChange={handleTitanChange}
                  placeholder="Add project notes..."
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => {
                    setIsEditingTitan(false);
                    if (project) {
                      setTitanFormData({
                        customer_id: project.customer_id?.toString() || '',
                        owner_customer_id: project.owner_customer_id?.toString() || '',
                        description: project.description || '',
                      });
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>

              {updateMutation.isError && (
                <div className="error-message" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  Error updating project. Please try again.
                </div>
              )}
            </form>
          ) : (
            <div>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={labelStyle}>Customer (GC)</div>
                <div style={{ fontSize: '0.85rem' }}>
                  {project.customer_name ? (
                    <Link to={`/customers/${project.customer_id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {project.customer_name}
                    </Link>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Not linked</span>
                  )}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>The General Contractor you have the contract with</div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={labelStyle}>Owner</div>
                <div style={{ fontSize: '0.85rem' }}>
                  {project.owner_name ? (
                    <Link to={`/customers/${project.owner_customer_id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {project.owner_name}
                    </Link>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Not linked</span>
                  )}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>The building owner / end customer</div>
              </div>

              {project.description && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={labelStyle}>Notes</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#475569' }}>{project.description}</div>
                </div>
              )}

              {!project.customer_name && !project.owner_name && !project.description && (
                <div style={{
                  textAlign: 'center',
                  padding: '1.25rem 0.75rem',
                  color: '#94a3b8',
                  background: '#f8fafc',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔗</div>
                  <div style={{ fontSize: '0.8rem' }}>No Titan data linked yet</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>Click Edit to link Customer and Owner</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUMN 3: Project Modules - compact nav */}
        <div className="card" style={{ padding: '0.85rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.6rem',
            paddingBottom: '0.5rem',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '1rem' }}>📂</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Modules</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {modules.map((module) => (
              <Link
                key={module.path}
                to={`/projects/${id}/${module.path}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s',
                  fontSize: '0.85rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: '1rem', width: '1.25rem', textAlign: 'center' }}>
                  {MODULE_ICONS[module.path] || '📄'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--primary)', lineHeight: 1.2 }}>{module.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.2 }}>{module.description}</div>
                </div>
                <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
