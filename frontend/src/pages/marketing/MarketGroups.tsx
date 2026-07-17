import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as mapMarketGroupService from '../../services/mapMarketGroups';
import { MapMarketGroup } from '../../services/mapMarketGroups';
import { MARKETS } from '../../constants/markets';
import '../../components/modals/Modal.css';
import '../../styles/SalesPipeline.css';

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
];

const emptyForm = { name: '', pin_color: '#3b82f6', markets: [] as string[], sort_order: 0 };

const MarketGroups: React.FC = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MapMarketGroup | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<MapMarketGroup | null>(null);
  const [customColor, setCustomColor] = useState('');

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['map-market-groups'],
    queryFn: mapMarketGroupService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => mapMarketGroupService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-market-groups'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      mapMarketGroupService.update(editing!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-market-groups'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => mapMarketGroupService.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-market-groups'] });
      setDeleteConfirm(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setCustomColor('');
    setShowModal(true);
  }

  function openEdit(group: MapMarketGroup) {
    setEditing(group);
    setForm({
      name: group.name,
      pin_color: group.pin_color,
      markets: group.markets,
      sort_order: group.sort_order,
    });
    setCustomColor(PRESET_COLORS.includes(group.pin_color) ? '' : group.pin_color);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    setCustomColor('');
  }

  function toggleMarket(market: string) {
    setForm(f => ({
      ...f,
      markets: f.markets.includes(market)
        ? f.markets.filter(m => m !== market)
        : [...f.markets, market],
    }));
  }

  function handleSave() {
    const payload = { ...form };
    if (editing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing/project-locations" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Project Locations
            </Link>
            <h1>Market Groups</h1>
            <div className="sales-subtitle">
              Group market categories into named sets with custom colors for map visualization
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            + New Group
          </button>
        </div>
      </div>

      {isLoading && <div className="loading">Loading groups...</div>}

      {!isLoading && groups.length === 0 && (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗂️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>No Market Groups Yet</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Create groups to color-code project pins by market sector on the map.
            For example: Manufacturing, Commercial/Healthcare, Mission Critical.
          </p>
          <button className="btn btn-primary" onClick={openCreate}>Create Your First Group</button>
        </div>
      )}

      {groups.length > 0 && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {groups.map(group => (
            <div key={group.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Color swatch */}
              <div style={{
                width: '36px', height: '36px', flexShrink: 0,
                background: group.pin_color,
                borderRadius: '50%',
                border: '3px solid white',
                boxShadow: '0 0 0 2px ' + group.pin_color + '40',
              }} />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1e293b' }}>{group.name}</div>
                <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {group.markets.length === 0 && (
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No markets assigned</span>
                  )}
                  {group.markets.map(m => (
                    <span key={m} style={{
                      display: 'inline-block', padding: '2px 8px',
                      background: group.pin_color + '18',
                      color: group.pin_color,
                      border: '1px solid ' + group.pin_color + '40',
                      borderRadius: '9999px',
                      fontSize: '11px', fontWeight: 500,
                    }}>{m}</span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => openEdit(group)}>
                  Edit
                </button>
                <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => setDeleteConfirm(group)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" style={{ maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>{editing ? 'Edit Group' : 'New Market Group'}</h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Name */}
              <div className="form-group">
                <label className="form-label">Group Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Manufacturing, Mission Critical..."
                  autoFocus
                />
              </div>

              {/* Color */}
              <div className="form-group">
                <label className="form-label">Pin Color</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, pin_color: c })); setCustomColor(''); }}
                      style={{
                        width: '28px', height: '28px',
                        borderRadius: '50%',
                        background: c,
                        border: form.pin_color === c ? '3px solid #1e293b' : '2px solid white',
                        boxShadow: form.pin_color === c ? '0 0 0 2px ' + c : '0 1px 3px rgba(0,0,0,0.2)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  ))}
                  {/* Custom color */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                    <input
                      type="color"
                      value={customColor || form.pin_color}
                      onChange={e => {
                        setCustomColor(e.target.value);
                        setForm(f => ({ ...f, pin_color: e.target.value }));
                      }}
                      style={{ width: '28px', height: '28px', padding: '2px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}
                      title="Custom color"
                    />
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Custom</span>
                  </div>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: form.pin_color, border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{form.pin_color}</span>
                </div>
              </div>

              {/* Market selection */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Markets in this Group
                  <span style={{ fontSize: '12px', fontWeight: 400, color: '#6b7280' }}>
                    {form.markets.length} selected
                  </span>
                </label>
                <div style={{
                  border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px',
                  maxHeight: '280px', overflowY: 'auto',
                }}>
                  {MARKETS.map(m => {
                    const checked = form.markets.includes(m.value);
                    return (
                      <label
                        key={m.value}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
                          background: checked ? form.pin_color + '15' : 'transparent',
                          border: checked ? '1px solid ' + form.pin_color + '40' : '1px solid transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMarket(m.value)}
                          style={{ accentColor: form.pin_color }}
                        />
                        <span style={{ fontSize: '12px' }}>{m.icon}</span>
                        <span style={{ fontSize: '13px', color: '#374151' }}>{m.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => setForm(f => ({ ...f, markets: MARKETS.map(m => m.value) }))}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => setForm(f => ({ ...f, markets: [] }))}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Sort order */}
              <div className="form-group">
                <label className="form-label">Display Order</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  min={0}
                  style={{ width: '100px' }}
                />
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Lower numbers appear first</div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px' }}>
              <button className="btn btn-secondary" onClick={closeModal} disabled={isSaving}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isSaving || !form.name.trim()}
              >
                {isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-container" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Delete Group</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketGroups;
