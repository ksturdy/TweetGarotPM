import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import { takeoffsApi, Takeoff } from '../../services/takeoffs';
import NewTakeoffDialog from '../../components/estimates/NewTakeoffDialog';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

const TakeoffsList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const { data: takeoffs = [], isLoading } = useQuery({
    queryKey: ['takeoffs', statusFilter, searchQuery],
    queryFn: () => takeoffsApi.getAll({ status: statusFilter, search: searchQuery }).then(res => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => takeoffsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['takeoffs'] }),
  });

  const getStatusBadgeStyle = (status: string): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      draft: { background: '#f3f4f6', color: '#6b7280' },
      in_progress: { background: '#eff6ff', color: '#1e40af' },
      complete: { background: '#f0fdf4', color: '#166534' },
      archived: { background: '#fef2f2', color: '#991b1b' },
    };
    return { padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, ...(styles[status] || styles.draft) };
  };

  const getTypeBadgeStyle = (type: string): React.CSSProperties => {
    if (type === 'traceover') {
      return { padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f5f3ff', color: '#7c3aed' };
    }
    return { padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1e40af' };
  };

  const formatStatus = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const formatType = (type: string) => type === 'traceover' ? 'Traceover' : 'Manual';

  const formatHours = (val: number) => {
    const n = Number(val || 0);
    return n.toFixed(1);
  };

  const totalBaseHours = takeoffs.reduce((sum: number, t: Takeoff) => sum + Number(t.total_base_hours || 0), 0);
  const totalAdjustedHours = takeoffs.reduce((sum: number, t: Takeoff) => sum + Number(t.total_adjusted_hours || 0), 0);
  const completeCount = takeoffs.filter((t: Takeoff) => t.status === 'complete').length;

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const ok = await confirm({ message: 'Delete this takeoff?', danger: true });
    if (ok) {
      deleteMutation.mutate(id);
    }
  };

  const handleNewTakeoff = (type: 'manual' | 'traceover') => {
    setShowNewDialog(false);
    if (type === 'manual') {
      navigate('/estimating/takeoffs/new');
    } else {
      // Traceover workspace — will navigate to workspace in Phase 4
      navigate('/estimating/takeoffs/new?type=traceover');
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0 }}>Takeoffs</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Piping labor hour takeoffs with productivity rates</p>
        </div>
        <button
          onClick={() => setShowNewDialog(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <AddIcon style={{ fontSize: 18 }} /> New Takeoff
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Takeoffs', value: takeoffs.length, color: '#3b82f6' },
          { label: 'Total Base Hours', value: formatHours(totalBaseHours), color: '#8b5cf6' },
          { label: 'Total Adjusted Hours', value: formatHours(totalAdjustedHours), color: '#10b981' },
          { label: 'Complete', value: `${completeCount} / ${takeoffs.length}`, color: '#f59e0b' },
        ].map((card) => (
          <div key={card.label} style={{
            background: '#fff', borderRadius: 12, padding: '16px 20px',
            border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <SearchIcon style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search takeoffs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff' }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="complete">Complete</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div>
      ) : takeoffs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px', background: '#fff',
          borderRadius: 12, border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No takeoffs yet</div>
          <div style={{ color: '#6b7280', marginBottom: 16 }}>Create your first piping takeoff to start estimating labor hours.</div>
          <button
            onClick={() => setShowNewDialog(true)}
            style={{
              padding: '10px 24px', background: '#1a56db', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Create Takeoff
          </button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>TO #</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Items</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Base Hrs</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Adj Hrs</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Perf Factor</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Estimator</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Estimate</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Updated</th>
                <th style={{ padding: '12px 8px', width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {takeoffs.map((t: Takeoff) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/estimating/takeoffs/${t.id}`)}
                  style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e40af' }}>{t.takeoff_number}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: '#111827' }}>{t.name}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={getTypeBadgeStyle(t.takeoff_type || 'manual')}>{formatType(t.takeoff_type || 'manual')}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: '#6b7280' }}>{t.total_items}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#374151' }}>{formatHours(t.total_base_hours)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#10b981' }}>{formatHours(t.total_adjusted_hours)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: Number(t.performance_factor) < 0 ? '#10b981' : Number(t.performance_factor) > 0 ? '#ef4444' : '#6b7280' }}>
                    {Number(t.performance_factor) > 0 ? '+' : ''}{t.performance_factor}%
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={getStatusBadgeStyle(t.status)}>{formatStatus(t.status)}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#374151' }}>
                    {t.estimator_name || <span style={{ color: '#9ca3af' }}>-</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                    {t.estimate_number || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
                    {new Date(t.updated_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <button
                      onClick={(e) => handleDelete(e, t.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, opacity: 0.6 }}
                    >
                      <DeleteIcon style={{ fontSize: 16 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewTakeoffDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSelect={handleNewTakeoff}
      />
    </div>
  );
};

export default TakeoffsList;
