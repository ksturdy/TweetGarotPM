import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { takeoffsApi, Takeoff, TakeoffItem } from '../../services/takeoffs';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

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
  const { toast, confirm } = useTitanFeedback();

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

  type SortCol = 'quantity' | 'size' | 'fitting_type' | 'join_type' | 'base_hours_per_unit' | 'base_hours_total' | 'adjusted_hours' | 'material_unit_cost' | 'material_cost';
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const items: TakeoffItem[] = takeoff?.items || [];

  const getSortValue = (item: TakeoffItem, col: SortCol): number | string => {
    switch (col) {
      case 'quantity': return Number(item.quantity || 0);
      case 'base_hours_per_unit': return Number(item.base_hours_per_unit || 0);
      case 'base_hours_total': return Number(item.base_hours_total || 0);
      case 'adjusted_hours': return Number(item.adjusted_hours || 0);
      case 'material_unit_cost': return Number(item.material_unit_cost || 0);
      case 'material_cost': return Number(item.material_cost || 0);
      case 'size': return item.size || '';
      case 'fitting_type': return item.fitting_type || '';
      case 'join_type': return item.join_type || '';
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortCol) return items;
    return [...items].sort((a, b) => {
      const aVal = getSortValue(a, sortCol);
      const bVal = getSortValue(b, sortCol);
      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({ message: 'Are you sure you want to delete this takeoff?', danger: true });
    if (ok) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>;
  }

  if (!takeoff) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Takeoff not found.</div>;
  }

  const isTraceover = takeoff.takeoff_type === 'traceover';
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

  const thStyle = (col: SortCol, align: 'left' | 'center' | 'right' = 'left', width?: number): React.CSSProperties => ({
    padding: '10px 12px', textAlign: align, fontSize: 11, fontWeight: 600,
    color: sortCol === col ? '#1e40af' : '#6b7280', cursor: 'pointer', userSelect: 'none' as const,
    ...(width ? { width } : {}),
  });

  const sortIcon = (col: SortCol) => (
    <span style={{ marginLeft: 6, opacity: 0.5 }}>{sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

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
              {isTraceover && (
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f5f3ff', color: '#7c3aed' }}>
                  Traceover
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>{takeoff.name}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isTraceover && (
            <button onClick={() => navigate(`/estimating/takeoffs/${id}/workspace`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                border: '1px solid #93c5fd', borderRadius: 8, background: '#eff6ff',
                color: '#1e40af', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              <OpenInNewIcon style={{ fontSize: 16 }} /> Open Workspace
            </button>
          )}
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
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Estimator</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{takeoff.estimator_name || <span style={{ color: '#9ca3af' }}>Unassigned</span>}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Created By</div>
            <div style={{ fontSize: 14, color: '#374151' }}>{takeoff.created_by_name || '-'}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 20px', marginTop: 12 }}>
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
          { label: 'Base Hours', value: Math.round(totalBaseHours).toLocaleString(), color: '#8b5cf6' },
          { label: 'Adjusted Hours', value: Math.round(totalAdjustedHours).toLocaleString(), color: '#10b981' },
          { label: 'Material Cost', value: totalMaterialCost > 0 ? `$${Math.round(totalMaterialCost).toLocaleString()}` : '-', color: '#f59e0b' },
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
                <th style={thStyle('quantity', 'center', 50)} onClick={() => handleSort('quantity')}>Qty{sortIcon('quantity')}</th>
                <th style={thStyle('size')} onClick={() => handleSort('size')}>Size{sortIcon('size')}</th>
                <th style={thStyle('fitting_type')} onClick={() => handleSort('fitting_type')}>Fitting{sortIcon('fitting_type')}</th>
                <th style={thStyle('join_type')} onClick={() => handleSort('join_type')}>Joint{sortIcon('join_type')}</th>
                <th style={thStyle('base_hours_per_unit', 'right')} onClick={() => handleSort('base_hours_per_unit')}>Hrs/Unit{sortIcon('base_hours_per_unit')}</th>
                <th style={thStyle('base_hours_total', 'right')} onClick={() => handleSort('base_hours_total')}>Base Hrs{sortIcon('base_hours_total')}</th>
                <th style={thStyle('adjusted_hours', 'right')} onClick={() => handleSort('adjusted_hours')}>Adj Hrs{sortIcon('adjusted_hours')}</th>
                <th style={thStyle('material_unit_cost', 'right')} onClick={() => handleSort('material_unit_cost')}>Mat $/Unit{sortIcon('material_unit_cost')}</th>
                <th style={thStyle('material_cost', 'right')} onClick={() => handleSort('material_cost')}>Mat Cost{sortIcon('material_cost')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, index) => (
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
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#374151' }}>{Number(item.base_hours_total).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#10b981' }}>{Number(item.adjusted_hours).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: Number(item.material_unit_cost) > 0 ? '#374151' : '#d1d5db' }}>
                    {Number(item.material_unit_cost) > 0 ? `$${Number(item.material_unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: Number(item.material_cost) > 0 ? '#374151' : '#d1d5db' }}>
                    {Number(item.material_cost) > 0 ? `$${Number(item.material_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
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
          {isTraceover
            ? 'No items generated yet. Open the workspace to trace pipe runs.'
            : 'No items in this takeoff.'}
        </div>
      )}
    </div>
  );
};

export default TakeoffDetail;
