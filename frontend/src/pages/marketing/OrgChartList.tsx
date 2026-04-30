import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { orgChartsApi, OrgChart } from '../../services/orgCharts';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';

const OrgChartList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChart, setNewChart] = useState({ name: '', description: '', project_id: undefined as number | undefined });

  const { data: orgCharts = [], isLoading } = useQuery<OrgChart[]>({
    queryKey: ['org-charts', search],
    queryFn: () => orgChartsApi.getAll(search ? { search } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; project_id?: number }) =>
      orgChartsApi.create(data),
    onSuccess: (chart: OrgChart) => {
      queryClient.invalidateQueries({ queryKey: ['org-charts'] });
      setShowCreateModal(false);
      setNewChart({ name: '', description: '', project_id: undefined });
      navigate(`/org-charts/${chart.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => orgChartsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-charts'] });
    },
  });

  const handleDelete = async (chart: OrgChart) => {
    const confirmed = await confirm({
      message: `Are you sure you want to delete "${chart.name}"? This will remove all members in this org chart.`,
      title: 'Delete Org Chart',
      danger: true
    });
    if (confirmed) {
      deleteMutation.mutate(chart.id);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChart.name.trim()) return;
    createMutation.mutate(newChart);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="sales-page">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>Project Org Charts</h1>
            <div className="sales-subtitle">Create and manage project team structures for proposals</div>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            + New Org Chart
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search org charts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '0.625rem 1rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading org charts...</div>
      ) : orgCharts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#127959;</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
            {search ? 'No matching org charts' : 'No org charts yet'}
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            {search ? 'Try a different search term' : 'Create your first project org chart to get started'}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Create Your First Org Chart
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem'
        }}>
          {orgCharts.map((chart: OrgChart) => (
            <div
              key={chart.id}
              style={{
                background: 'white',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
              onClick={() => navigate(`/org-charts/${chart.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#7c3aed';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#1f2937',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {chart.name}
                  </h3>
                  {chart.project_name && (
                    <div style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 500, marginTop: '0.25rem' }}>
                      {chart.project_name}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(chart); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '0.25rem',
                    borderRadius: '4px',
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                  title="Delete org chart"
                >
                  &#128465;
                </button>
              </div>

              {chart.description && (
                <p style={{
                  fontSize: '0.85rem',
                  color: '#6b7280',
                  margin: '0 0 0.75rem 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {chart.description}
                </p>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid #f3f4f6',
                fontSize: '0.8rem',
                color: '#6b7280'
              }}>
                <span style={{
                  background: '#f3f4f6',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px',
                  fontWeight: 600
                }}>
                  {chart.member_count || 0} {Number(chart.member_count) === 1 ? 'member' : 'members'}
                </span>
                <span>{formatDate(chart.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Org Chart</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="chart-name">Name *</label>
                  <input
                    type="text"
                    id="chart-name"
                    value={newChart.name}
                    onChange={(e) => setNewChart({ ...newChart, name: e.target.value })}
                    placeholder="e.g., Mercy Hospital Expansion Team"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="chart-desc">Description</label>
                  <textarea
                    id="chart-desc"
                    value={newChart.description}
                    onChange={(e) => setNewChart({ ...newChart, description: e.target.value })}
                    placeholder="Brief description of this org chart..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending || !newChart.name.trim()}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgChartList;
