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

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/projects" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Projects
            </Link>
            <h1>📁 {project.name}</h1>
            <div className="sales-subtitle">{project.number} &middot; {project.status} &middot; {project.client || 'No client'}</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      {/* Two-column layout: Vista (left) and Titan (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* LEFT SIDE: Vista Data (Read-only) */}
        <div className="card" style={{ position: 'relative' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '1.25rem' }}>📊</span>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Vista Project Data</h2>
            <span style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.5rem',
              background: '#f1f5f9',
              borderRadius: '4px',
              color: '#64748b',
              marginLeft: 'auto'
            }}>
              Read-only
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Project Number</div>
              <div style={{ fontWeight: 500 }}>{project.number}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: getStatusColor(project.status)
                }}></span>
                {project.status}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Project Name</div>
              <div style={{ fontWeight: 500 }}>{project.name}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Client (Vista)</div>
              <div>{project.client || '-'}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Address</div>
              <div>{project.address || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Market</div>
              <div>
                {project.market ? (
                  <>
                    {MARKET_OPTIONS.find(m => m.value === project.market)?.icon || ''} {project.market}
                  </>
                ) : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Department</div>
              <div>{project.department_number || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Project Manager</div>
              <div>{project.manager_name || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Start Date</div>
              <div>{project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : '-'}</div>
            </div>
          </div>

          {/* Financial Info within Vista card */}
          {(project.contract_value || project.gross_margin_percent !== undefined || project.backlog) && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem' }}>Financial Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Contract</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.contract_value ? `$${(Number(project.contract_value) / 1000).toFixed(0)}K` : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>GM%</div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: project.gross_margin_percent && project.gross_margin_percent > 0 ? '#10b981' : project.gross_margin_percent && project.gross_margin_percent < 0 ? '#ef4444' : '#64748b'
                  }}>
                    {project.gross_margin_percent !== undefined && project.gross_margin_percent !== null
                      ? `${(Number(project.gross_margin_percent) * 100).toFixed(1)}%`
                      : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Backlog</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#8b5cf6' }}>
                    {project.backlog ? `$${(Number(project.backlog) / 1000).toFixed(0)}K` : '-'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: Titan Data (Editable) */}
        <div className="card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '1.25rem' }}>🔧</span>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Titan Project Details</h2>
            {!isEditingTitan && (
              <button
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setIsEditingTitan(true)}
              >
                Edit
              </button>
            )}
          </div>

          {isEditingTitan ? (
            <form onSubmit={handleTitanSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Customer (GC)</label>
                <SearchableSelect
                  options={customers.map((c: Customer) => ({ value: c.id, label: c.customer_owner }))}
                  value={titanFormData.customer_id}
                  onChange={(value) => setTitanFormData(prev => ({ ...prev, customer_id: value }))}
                  placeholder="-- Select Customer --"
                />
                <small style={{ color: '#64748b', fontSize: '0.7rem' }}>The General Contractor you have the contract with</small>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Owner</label>
                <SearchableSelect
                  options={customers.map((c: Customer) => ({ value: c.id, label: c.customer_owner }))}
                  value={titanFormData.owner_customer_id}
                  onChange={(value) => setTitanFormData(prev => ({ ...prev, owner_customer_id: value }))}
                  placeholder="-- Select Owner --"
                />
                <small style={{ color: '#64748b', fontSize: '0.7rem' }}>The building owner / end customer</small>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Notes</label>
                <textarea
                  name="description"
                  className="form-input"
                  rows={4}
                  value={titanFormData.description}
                  onChange={handleTitanChange}
                  placeholder="Add project notes..."
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
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
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>

              {updateMutation.isError && (
                <div className="error-message" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                  Error updating project. Please try again.
                </div>
              )}
            </form>
          ) : (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Customer (GC)</div>
                <div style={{ fontSize: '0.95rem' }}>
                  {project.customer_name ? (
                    <Link to={`/customers/${project.customer_id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {project.customer_name}
                    </Link>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not linked</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>The General Contractor you have the contract with</div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Owner</div>
                <div style={{ fontSize: '0.95rem' }}>
                  {project.owner_name ? (
                    <Link to={`/customers/${project.owner_customer_id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {project.owner_name}
                    </Link>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not linked</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>The building owner / end customer</div>
              </div>

              {project.description && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Notes</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#475569' }}>{project.description}</div>
                </div>
              )}

              {!project.customer_name && !project.owner_name && !project.description && (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem 1rem',
                  color: '#94a3b8',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔗</div>
                  <div style={{ fontSize: '0.9rem' }}>No Titan data linked yet</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Click Edit to link Customer and Owner</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Project Modules */}
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Project Modules</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
        {modules.map((module) => (
          <Link
            key={module.path}
            to={`/projects/${id}/${module.path}`}
            className="card"
            style={{ textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}
          >
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>{module.label}</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', margin: 0 }}>{module.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ProjectDetail;
