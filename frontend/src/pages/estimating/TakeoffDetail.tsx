import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { takeoffsApi, Takeoff, TakeoffItem } from '../../services/takeoffs';

const FITTING_LABELS: Record<string, string> = {
  '90': '90\u00B0 Elbow', '45': '45\u00B0 Elbow', tee: 'Tee', wye: 'Wye',
  reducer: 'Reducer', coupling: 'Coupling', union: 'Union', cap: 'Cap',
  valve: 'Valve', flange: 'Flange', nipple: 'Nipple', bushing: 'Bushing', pipe: 'Pipe',
};

const JOIN_LABELS: Record<string, string> = {
  threaded: 'Threaded', welded: 'Welded', flanged: 'Flanged',
  grooved: 'Grooved', press: 'Press', soldered: 'Soldered', glued: 'Glued',
};

const TakeoffDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: takeoff, isLoading } = useQuery({
    queryKey: ['takeoff', id],
    queryFn: () => takeoffsApi.getById(Number(id)).then(res => res.data),
    enabled: Boolean(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => takeoffsApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoffs'] });
      navigate('/estimating/takeoffs');
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this takeoff?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>;
  }

  if (!takeoff) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Takeoff not found.</div>;
  }

  const items: TakeoffItem[] = takeoff.items || [];
  const totalBaseHours = items.reduce((sum, i) => sum + Number(i.base_hours_total || 0), 0);
  const totalAdjustedHours = items.reduce((sum, i) => sum + Number(i.adjusted_hours || 0), 0);
  const totalMaterialCost = items.reduce((sum, i) => sum + Number(i.material_cost || 0), 0);
  const perfFactor = Number(takeoff.performance_factor || 0);

  const getStatusBadgeStyle = (status: string): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      draft: { background: '#f3f4f6', color: '#6b7280' },
      in_progress: { background: '#eff6ff', color: '#1e40af' },
      complete: { background: '#f0fdf4', color: '#166534' },
    };
    return { padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, ...(styles[status] || styles.draft) };
  };

  const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/estimating/takeoffs')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
            <ArrowBackIcon />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1e40af' }}>{takeoff.takeoff_number}</span>
              <span style={getStatusBadgeStyle(takeoff.status)}>{formatStatus(takeoff.status)}</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>{takeoff.name}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate(`/estimating/takeoffs/${id}/edit`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              border: '1px solid #d1d5db', borderRadius: 8, background: '#fff',
              color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
            <EditIcon style={{ fontSize: 16 }} /> Edit
          </button>
          <button onClick={handleDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              border: '1px solid #fecaca', borderRadius: 8, background: '#fff',
              color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
            <DeleteIcon style={{ fontSize: 16 }} /> Delete
          </button>
        </div>
      </div>

      {/* Info Grid */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 20px' }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Performance Factor</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: perfFactor < 0 ? '#10b981' : perfFactor > 0 ? '#ef4444' : '#374151' }}>
              {perfFactor > 0 ? '+' : ''}{perfFactor}%
              <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>
                {perfFactor < 0 ? `${Math.abs(perfFactor)}% faster` : perfFactor > 0 ? `${perfFactor}% slower` : 'Baseline'}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Linked Estimate</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              {takeoff.estimate_number ? (
                <Link to={`/estimating/estimates/${takeoff.estimate_id}`} style={{ color: '#1e40af', textDecoration: 'none' }}>
                  {takeoff.estimate_number} - {takeoff.estimate_project_name}
                </Link>
              ) : (
                <span style={{ color: '#9ca3af' }}>None</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Created By</div>
            <div style={{ fontSize: 14, color: '#374151' }}>{takeoff.created_by_name || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Last Updated</div>
            <div style={{ fontSize: 14, color: '#374151' }}>{new Date(takeoff.updated_at).toLocaleDateString()}</div>
          </div>
          {takeoff.description && (
            <div style={{ gridColumn: 'span 4' }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Description</div>
              <div style={{ fontSize: 14, color: '#374151' }}>{takeoff.description}</div>
            </div>
          )}
          {takeoff.notes && (
            <div style={{ gridColumn: 'span 4' }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Notes</div>
              <div style={{ fontSize: 14, color: '#374151' }}>{takeoff.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Total Items', value: items.length.toString(), color: '#3b82f6' },
          { label: 'Base Hours', value: totalBaseHours.toFixed(1), color: '#8b5cf6' },
          { label: 'Adjusted Hours', value: totalAdjustedHours.toFixed(1), color: '#10b981' },
          { label: 'Material Cost', value: totalMaterialCost > 0 ? `$${totalMaterialCost.toFixed(2)}` : '-', color: '#f59e0b' },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff', borderRadius: 12, padding: '14px 18px',
            border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Items Table */}
      {items.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6b7280', width: 50 }}>Qty</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Size</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Fitting</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Joint</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Hrs/Unit</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Base Hrs</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Adj Hrs</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Mat $/Unit</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Mat Cost</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id || index} style={{ borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#111827' }}>{Number(item.quantity)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 14, fontWeight: 600, color: '#1e40af' }}>{item.size}</td>
                  <td style={{ padding: '8px 12px', fontSize: 13, color: '#374151' }}>{FITTING_LABELS[item.fitting_type] || item.fitting_type}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {item.join_type && (
                      <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                        {JOIN_LABELS[item.join_type] || item.join_type}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>{Number(item.base_hours_per_unit).toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#374151' }}>{Number(item.base_hours_total).toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#10b981' }}>{Number(item.adjusted_hours).toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: Number(item.material_unit_cost) > 0 ? '#374151' : '#d1d5db' }}>
                    {Number(item.material_unit_cost) > 0 ? `$${Number(item.material_unit_cost).toFixed(2)}` : '-'}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: Number(item.material_cost) > 0 ? '#374151' : '#d1d5db' }}>
                    {Number(item.material_cost) > 0 ? `$${Number(item.material_cost).toFixed(2)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '40px 20px', background: '#fff',
          borderRadius: 12, border: '1px solid #e5e7eb', color: '#9ca3af', fontSize: 14,
        }}>
          No items in this takeoff.
        </div>
      )}
    </div>
  );
};

export default TakeoffDetail;
