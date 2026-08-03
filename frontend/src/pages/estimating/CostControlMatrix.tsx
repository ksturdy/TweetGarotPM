import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import CostControlCompare from './CostControlCompare';
import {
  CostControlMatrix as CCMatrix,
  CostControlVersion,
  CostControlVersionValue,
  CostType,
  COST_TYPE_LABELS,
  calcVersionTotals,
  addVersion,
  deleteVersion,
  updateVersion,
  saveVersionValues,
  getMatrix,
  updateMatrix,
  addArea,
  updateArea,
  deleteArea,
  addLineItem as apiAddLineItem,
  updateLineItem as apiUpdateLineItem,
  deleteLineItem as apiDeleteLineItem,
} from '../../services/costControl';
import './CostControlMatrix.css';

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.round(n).toLocaleString();

// Format a raw string value as $1,234 for display in inputs
function fmtNum(raw: string): string {
  if (!raw) return '';
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ''));
  if (isNaN(n)) return '';
  return '$' + Math.round(n).toLocaleString('en-US');
}

type PendingKey = string;
type PendingChange = {
  line_item_id: number; version_id: number;
  qty: number | null; value: number | null; notes: string | null;
  actual_cost: number | null; pct_complete: number | null;
};

function pendingKey(itemId: number, versionId: number): PendingKey {
  return `${itemId}_${versionId}`;
}

// Cost type add buttons — label + type
const ADD_TYPE_BUTTONS: { label: string; type: CostType }[] = [
  { label: 'Field Labor', type: 'labor_field' },
  { label: 'Material',    type: 'material' },
  { label: 'Equipment',   type: 'equipment' },
  { label: 'Subcontract', type: 'subcontract' },
  { label: 'Gen. Conditions', type: 'gen_conditions' },
];

// Version column color palette (up to 5 versions)
const VER_COLORS = [
  { header: '#dbeafe', cell: '#f0f7ff', border: '#bfdbfe', text: '#1e40af' }, // blue
  { header: '#ede9fe', cell: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' }, // purple
  { header: '#d1fae5', cell: '#f0fdf4', border: '#a7f3d0', text: '#065f46' }, // green
  { header: '#fef3c7', cell: '#fffbeb', border: '#fde68a', text: '#92400e' }, // amber
  { header: '#fce7f3', cell: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' }, // pink
];

export default function CostControlMatrixPage() {
  const { matrixId } = useParams<{ matrixId: string }>();
  const { toast } = useTitanFeedback();

  const [matrix, setMatrix] = useState<CCMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Record<PendingKey, PendingChange>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Version management
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDate, setNewVersionDate] = useState(new Date().toISOString().split('T')[0]);
  const [newVersionExec, setNewVersionExec] = useState(false);

  // Settings
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<{ name: string; target_cost: string; fee_pct: string; overhead_pct: string } | null>(null);

  // Section editing
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [areaNameDraft, setAreaNameDraft] = useState('');
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');

  // Item editing
  const [itemDescDrafts, setItemDescDrafts] = useState<Record<number, string>>({});
  const [itemTypeDrafts, setItemTypeDrafts] = useState<Record<number, CostType>>({});

  // Compare modal
  const [showCompare, setShowCompare] = useState(false);

  const load = useCallback(async () => {
    if (!matrixId) return;
    try {
      const data = await getMatrix(Number(matrixId));
      setMatrix(data);
      setItemDescDrafts({});
      setItemTypeDrafts({});
    } catch {
      toast.error('Failed to load Cost Control Matrix');
    } finally {
      setLoading(false);
    }
  }, [matrixId]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // --- Cell value editing ---
  const flushPending = useCallback(async (snap: Record<PendingKey, PendingChange>, mat: CCMatrix) => {
    if (!Object.keys(snap).length) return;
    setSaving(true);
    try {
      const byVersion: Record<number, PendingChange[]> = {};
      for (const c of Object.values(snap)) {
        if (!byVersion[c.version_id]) byVersion[c.version_id] = [];
        byVersion[c.version_id].push(c);
      }
      await Promise.all(Object.entries(byVersion).map(([vId, vals]) => saveVersionValues(mat.id, Number(vId), vals)));
      setPending({});
      await load();
    } catch { toast.error('Failed to save changes'); }
    finally { setSaving(false); }
  }, [load]); // eslint-disable-line

  const handleCellChange = (itemId: number, versionId: number, field: keyof PendingChange, rawValue: string) => {
    const key = pendingKey(itemId, versionId);
    setPending(prev => {
      const existing = prev[key] ?? { line_item_id: itemId, version_id: versionId, qty: null, value: null, notes: null, actual_cost: null, pct_complete: null };
      const numFields: (keyof PendingChange)[] = ['qty', 'value', 'actual_cost', 'pct_complete'];
      const parsed = numFields.includes(field)
        ? (rawValue === '' ? null : parseFloat(rawValue.replace(/[$,]/g, '')) || null)
        : rawValue || null;
      return { ...prev, [key]: { ...existing, [field]: parsed } };
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setPending(current => { if (matrix) flushPending(current, matrix); return current; });
    }, 1500);
  };

  const handleSaveNow = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (matrix) flushPending(pending, matrix);
  };

  // --- Version management ---
  const handleAddVersion = async () => {
    if (!matrix || !newVersionName.trim()) return;
    try {
      await addVersion(matrix.id, { version_name: newVersionName, version_date: newVersionDate || undefined, sort_order: matrix.versions.length, is_execution_phase: newVersionExec });
      setNewVersionName(''); setNewVersionDate(new Date().toISOString().split('T')[0]); setNewVersionExec(false); setShowAddVersion(false);
      await load();
      toast.success('Version added');
    } catch { toast.error('Failed to add version'); }
  };

  const handleDeleteVersion = async (v: CostControlVersion) => {
    if (!matrix || !window.confirm(`Delete version "${v.version_name}"? All data will be lost.`)) return;
    try { await deleteVersion(matrix.id, v.id); await load(); } catch { toast.error('Failed to delete version'); }
  };

  const handleToggleExecution = async (v: CostControlVersion) => {
    if (!matrix) return;
    try { await updateVersion(matrix.id, v.id, { is_execution_phase: !v.is_execution_phase }); await load(); }
    catch { toast.error('Failed to update version'); }
  };

  const handleSaveHeader = async () => {
    if (!matrix || !headerDraft) return;
    try {
      await updateMatrix(matrix.id, {
        name: headerDraft.name,
        target_cost: headerDraft.target_cost ? parseFloat(headerDraft.target_cost.replace(/[$,]/g, '')) : null,
        fee_pct: parseFloat(headerDraft.fee_pct) / 100,
        overhead_pct: parseFloat(headerDraft.overhead_pct) / 100,
      });
      setEditingHeader(false);
      await load();
    } catch { toast.error('Failed to save settings'); }
  };

  // --- Section management ---
  const handleRenameArea = async (areaId: number) => {
    if (!matrix || !areaNameDraft.trim()) { setEditingAreaId(null); return; }
    try {
      await updateArea(matrix.id, areaId, areaNameDraft.trim());
      setMatrix(prev => prev ? { ...prev, areas: prev.areas.map(a => a.id === areaId ? { ...a, name: areaNameDraft.trim() } : a) } : prev);
    } catch { toast.error('Failed to rename section'); }
    finally { setEditingAreaId(null); }
  };

  const handleDeleteArea = async (areaId: number, areaName: string) => {
    if (!matrix || !window.confirm(`Delete section "${areaName}"? All line items in this section will be removed.`)) return;
    try {
      await deleteArea(matrix.id, areaId);
      setMatrix(prev => prev ? { ...prev, areas: prev.areas.filter(a => a.id !== areaId) } : prev);
    } catch { toast.error('Failed to delete section'); }
  };

  const handleAddArea = async () => {
    if (!matrix || !newAreaName.trim()) return;
    try {
      const newArea = await addArea(matrix.id, newAreaName.trim());
      setMatrix(prev => prev ? { ...prev, areas: [...prev.areas, newArea] } : prev);
      setShowAddArea(false);
      setNewAreaName('');
    } catch { toast.error('Failed to add section'); }
  };

  // --- Line item management ---
  const handleQuickAddItem = async (areaId: number, costType: CostType) => {
    if (!matrix) return;
    try {
      const newItem = await apiAddLineItem(matrix.id, { area_id: areaId, cost_type: costType, description: '', sort_order: 999 });
      setMatrix(prev => !prev ? prev : { ...prev, areas: prev.areas.map(a => a.id === areaId ? { ...a, items: [...a.items, newItem] } : a) });
      // Focus the new description input
      setTimeout(() => {
        const el = document.getElementById(`item-desc-${newItem.id}`);
        if (el) (el as HTMLInputElement).focus();
      }, 50);
    } catch { toast.error('Failed to add line item'); }
  };

  const handleDeleteItem = async (areaId: number, itemId: number) => {
    if (!matrix) return;
    try {
      await apiDeleteLineItem(matrix.id, itemId);
      setMatrix(prev => !prev ? prev : { ...prev, areas: prev.areas.map(a => a.id === areaId ? { ...a, items: a.items.filter(i => i.id !== itemId) } : a) });
    } catch { toast.error('Failed to delete line item'); }
  };

  const handleUpdateItemDesc = async (itemId: number, areaId: number, desc: string) => {
    if (!matrix) return;
    const current = matrix.areas.find(a => a.id === areaId)?.items.find(i => i.id === itemId);
    if (!current || current.description === desc) {
      setItemDescDrafts(prev => { const n = { ...prev }; delete n[itemId]; return n; });
      return;
    }
    try {
      await apiUpdateLineItem(matrix.id, itemId, { description: desc });
      setMatrix(prev => !prev ? prev : { ...prev, areas: prev.areas.map(a => a.id === areaId ? { ...a, items: a.items.map(i => i.id === itemId ? { ...i, description: desc } : i) } : a) });
    } catch { toast.error('Failed to update description'); }
    finally { setItemDescDrafts(prev => { const n = { ...prev }; delete n[itemId]; return n; }); }
  };

  const handleUpdateItemType = async (itemId: number, areaId: number, costType: CostType) => {
    if (!matrix) return;
    setItemTypeDrafts(prev => ({ ...prev, [itemId]: costType }));
    try {
      await apiUpdateLineItem(matrix.id, itemId, { cost_type: costType });
      setMatrix(prev => !prev ? prev : { ...prev, areas: prev.areas.map(a => a.id === areaId ? { ...a, items: a.items.map(i => i.id === itemId ? { ...i, cost_type: costType } : i) } : a) });
    } catch {
      toast.error('Failed to update type');
      setItemTypeDrafts(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    }
  };

  // --- Render ---
  if (loading) return <div className="ccm-page"><div style={{ textAlign: 'center', padding: 60, color: '#8888a0' }}>Loading...</div></div>;
  if (!matrix) return <div className="ccm-page"><div style={{ textAlign: 'center', padding: 60, color: '#8888a0' }}>Matrix not found.</div></div>;

  const hasPending = Object.keys(pending).length > 0;
  const allItems = matrix.areas.flatMap(a => a.items);

  const SUMMARY_GROUPS: { label: string; types: CostType[] }[] = [
    { label: 'Total Labor',            types: ['labor_field', 'labor_shop'] },
    { label: 'Total Material',         types: ['material'] },
    { label: 'Total Equipment',        types: ['equipment'] },
    { label: 'Total Subcontracts',     types: ['subcontract'] },
    { label: 'Total General Conditions', types: ['gen_conditions'] },
  ];

  function groupTotal(versionId: number, types: CostType[]) {
    return allItems
      .filter(i => types.includes(i.cost_type as CostType))
      .reduce((s, i) => {
        const key = pendingKey(i.id, versionId);
        const val = pending[key]?.value ?? i.values[versionId]?.value ?? 0;
        return s + Number(val);
      }, 0);
  }

  const grandTotals = matrix.versions.map(v => calcVersionTotals(matrix, v.id).grand_total);
  const maxGrandTotal = Math.max(...grandTotals, matrix.target_cost || 0, 1);

  function renderVersionCells(item: typeof allItems[0]) {
    return matrix!.versions.map((v, vi) => {
      const col = VER_COLORS[vi % VER_COLORS.length];
      const key = pendingKey(item.id, v.id);
      const pval = pending[key];
      const stored = item.values[v.id];
      const getField = (f: keyof PendingChange) => {
        if (pval !== undefined) return pval[f] == null ? '' : String(pval[f]);
        if (!stored) return '';
        const raw = stored[f as keyof CostControlVersionValue];
        return raw == null ? '' : String(raw);
      };

      if (v.is_execution_phase) {
        const budget = Number(getField('value') || 0);
        const actual = Number(getField('actual_cost') || 0);
        const pct = Number(getField('pct_complete') || 0);
        const projected = pct > 0 ? actual / (pct / 100) : null;
        const variance = budget && projected != null ? budget - projected : null;
        return (
          <React.Fragment key={v.id}>
            <td className="cell-num" style={{ background: col.cell }}><input className="ccm-cell-input" value={fmtNum(getField('value'))} onChange={e => handleCellChange(item.id, v.id, 'value', e.target.value)} placeholder="0" /></td>
            <td className="cell-num" style={{ background: col.cell }}><input className="ccm-cell-input" value={fmtNum(getField('actual_cost'))} onChange={e => handleCellChange(item.id, v.id, 'actual_cost', e.target.value)} placeholder="0" /></td>
            <td className="cell-num" style={{ background: col.cell }}><input className="ccm-cell-input" value={getField('pct_complete')} onChange={e => handleCellChange(item.id, v.id, 'pct_complete', e.target.value)} placeholder="0" style={{ width: 50 }} /></td>
            <td className="cell-num" style={{ background: col.cell }}>{projected != null ? fmt(projected) : '—'}</td>
            <td className={`cell-num ${variance != null ? (variance >= 0 ? 'var-pos' : 'var-neg') : ''}`} style={{ background: col.cell }}>{variance != null ? fmt(variance) : '—'}</td>
          </React.Fragment>
        );
      }

      return (
        <React.Fragment key={v.id}>
          <td className="cell-num" style={{ background: col.cell }}><input className="ccm-cell-input" value={fmtNum(getField('qty'))} onChange={e => handleCellChange(item.id, v.id, 'qty', e.target.value)} placeholder="" /></td>
          <td className="cell-num" style={{ background: col.cell }}><input className="ccm-cell-input val-input" value={fmtNum(getField('value'))} onChange={e => handleCellChange(item.id, v.id, 'value', e.target.value)} placeholder="$0" /></td>
          <td style={{ background: col.cell }}><input className="ccm-cell-input notes-input" value={getField('notes')} onChange={e => handleCellChange(item.id, v.id, 'notes', e.target.value)} placeholder="notes" /></td>
        </React.Fragment>
      );
    });
  }

  return (
    <div className="ccm-page">
      {/* Top bar */}
      <div className="ccm-top-bar">
        <div>
          <Link to="/estimating/cost-control" className="ccm-back-link">← Cost Control</Link>
          <h1 className="ccm-page-title">{matrix.name}</h1>
          {matrix.target_cost && (
            <div className="ccm-target-display">Target: {fmt(Number(matrix.target_cost))}</div>
          )}
        </div>
        <div className="ccm-actions">
          {hasPending && (
            <button className="btn btn-primary" onClick={handleSaveNow} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => {
              setEditingHeader(!editingHeader);
              if (!editingHeader) setHeaderDraft({
                name: matrix.name,
                target_cost: matrix.target_cost ? String(Math.round(Number(matrix.target_cost))) : '',
                fee_pct: String(Math.round((Number(matrix.fee_pct) || 0) * 100)),
                overhead_pct: String(Math.round((Number(matrix.overhead_pct) || 0) * 100)),
              });
            }}
          >
            {editingHeader ? 'Cancel' : 'Settings'}
          </button>
          {matrix.versions.length >= 2 && (
            <button className="btn btn-secondary" onClick={() => setShowCompare(true)}>
              Compare Versions
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowAddVersion(!showAddVersion)}>
            + Add Version
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {editingHeader && headerDraft && (
        <div className="ccm-panel">
          <label>Name<input value={headerDraft.name} onChange={e => setHeaderDraft(d => d && ({ ...d, name: e.target.value }))} style={{ minWidth: 260 }} /></label>
          <label>Target Cost ($)<input value={headerDraft.target_cost} onChange={e => setHeaderDraft(d => d && ({ ...d, target_cost: e.target.value }))} /></label>
          <label>Fee %<input value={headerDraft.fee_pct} type="number" min="0" max="100" step="0.5" onChange={e => setHeaderDraft(d => d && ({ ...d, fee_pct: e.target.value }))} style={{ minWidth: 70 }} /></label>
          <label>Overhead %<input value={headerDraft.overhead_pct} type="number" min="0" max="100" step="0.5" onChange={e => setHeaderDraft(d => d && ({ ...d, overhead_pct: e.target.value }))} style={{ minWidth: 70 }} /></label>
          <button className="btn btn-primary" onClick={handleSaveHeader}>Save Settings</button>
        </div>
      )}

      {/* Add version panel */}
      {showAddVersion && (
        <div className="ccm-panel">
          <label>Version Name<input value={newVersionName} onChange={e => setNewVersionName(e.target.value)} placeholder="e.g. IFP Set" autoFocus /></label>
          <label>Date<input type="date" value={newVersionDate} onChange={e => setNewVersionDate(e.target.value)} /></label>
          <label>
            <span>Type</span>
            <select value={newVersionExec ? 'exec' : 'est'} onChange={e => setNewVersionExec(e.target.value === 'exec')}>
              <option value="est">Estimate Milestone</option>
              <option value="exec">Execution (Actuals)</option>
            </select>
          </label>
          <button className="btn btn-primary" onClick={handleAddVersion} disabled={!newVersionName.trim()}>Add Version</button>
          <button className="btn btn-secondary" onClick={() => setShowAddVersion(false)}>Cancel</button>
        </div>
      )}

      {/* Version strip */}
      {matrix.versions.length > 0 && (
        <div className="ccm-version-strip">
          <span className="strip-label">Versions:</span>
          {matrix.versions.map((v, vi) => {
            const col = VER_COLORS[vi % VER_COLORS.length];
            return (
              <div key={v.id} className="strip-badge" style={{ background: col.header, borderColor: col.border, color: col.text }}>
                <span>{v.version_name}</span>
                {v.version_date && <span className="strip-date">{new Date(v.version_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                <button className="strip-toggle" title={v.is_execution_phase ? 'Switch to Estimate' : 'Switch to Execution'} onClick={() => handleToggleExecution(v)}>
                  {v.is_execution_phase ? '📊' : '📐'}
                </button>
                <button className="strip-del" title="Delete version" onClick={() => handleDeleteVersion(v)}>✕</button>
              </div>
            );
          })}
          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => setShowAddVersion(true)}>+ Version</button>
        </div>
      )}

      {/* No-versions nudge */}
      {matrix.versions.length === 0 && !showAddVersion && (
        <div className="ccm-nudge">
          <strong>No versions yet.</strong> A version represents a design milestone (e.g. Conceptual, IFP Set, 100% CDs).
          Each version gives you a column of editable cost cells per line item.{' '}
          <button className="btn-link" onClick={() => setShowAddVersion(true)}>Add your first version →</button>
        </div>
      )}

      {/* Section cards */}
      {matrix.areas.length === 0 && (
        <div className="ccm-card ccm-empty-card">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <strong style={{ fontSize: 16, color: '#1a1a2e' }}>No sections yet</strong>
          <p style={{ maxWidth: 440, color: '#8888a0', lineHeight: 1.6, margin: '6px 0 16px' }}>
            Add a <strong>Section</strong> (e.g. "Ductwork", "Piping", "Equipment"),
            then use the <strong>+ Field Labor / + Material</strong> buttons within each section to add line items.
            Each line item gets an editable cell under every version column.
          </p>
          <button className="btn btn-primary" onClick={() => setShowAddArea(true)}>+ Add First Section</button>
        </div>
      )}

      {matrix.areas.map(area => (
        <div key={area.id} className="ccm-card">
          {/* Section header */}
          <div className="ccm-section-header">
            {editingAreaId === area.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                <input
                  className="ccm-section-name-input editing"
                  autoFocus
                  value={areaNameDraft}
                  onChange={e => setAreaNameDraft(e.target.value)}
                  onBlur={() => handleRenameArea(area.id)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameArea(area.id); if (e.key === 'Escape') setEditingAreaId(null); }}
                />
                <button className="btn btn-sm btn-primary" onClick={() => handleRenameArea(area.id)}>Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditingAreaId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 className="ccm-section-name">{area.name}</h3>
                  <button
                    className="ccm-icon-btn"
                    title="Rename section"
                    onClick={() => { setEditingAreaId(area.id); setAreaNameDraft(area.name); }}
                  >✏</button>
                </div>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteArea(area.id, area.name)}
                >
                  Delete Section
                </button>
              </>
            )}
          </div>

          {/* Line items table */}
          {(area.items.length > 0 || matrix.versions.length > 0) && (
            <div className="ccm-table-scroll">
              <table className="ccm-items-table">
                <thead>
                  <tr>
                    <th className="col-desc col-left">Description</th>
                    <th className="col-type col-left">Type</th>
                    {matrix.versions.map((v, vi) => {
                      const col = VER_COLORS[vi % VER_COLORS.length];
                      const span = v.is_execution_phase ? 5 : 3;
                      return (
                        <th key={v.id} colSpan={span} className="ver-group-header" style={{ background: col.header, color: col.text, borderBottom: `2px solid ${col.border}` }}>
                          {v.version_name}
                          {v.version_date && <span className="ver-header-date"> · {new Date(v.version_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                        </th>
                      );
                    })}
                    <th style={{ width: 32 }} />
                  </tr>
                  <tr>
                    <th className="col-desc col-left" />
                    <th className="col-type col-left" />
                    {matrix.versions.map((v, vi) => {
                      const col = VER_COLORS[vi % VER_COLORS.length];
                      return v.is_execution_phase ? (
                        <React.Fragment key={v.id}>
                          {['Budget','Actual','% Comp','Projected','Variance'].map(h => (
                            <th key={h} className="cell-num sub-header" style={{ background: col.header }}>{h}</th>
                          ))}
                        </React.Fragment>
                      ) : (
                        <React.Fragment key={v.id}>
                          {[['Qty','cell-num'],['Value','cell-num'],['Notes','']].map(([h, cls]) => (
                            <th key={h} className={`${cls} sub-header`} style={{ background: col.header }}>{h}</th>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {area.items.map(item => {
                    const itemDesc = itemDescDrafts[item.id] ?? item.description;
                    const itemType = (itemTypeDrafts[item.id] ?? item.cost_type) as CostType;
                    return (
                      <tr key={item.id} className="item-row">
                        <td className="col-desc">
                          <input
                            id={`item-desc-${item.id}`}
                            className="item-desc-input"
                            value={itemDesc}
                            onChange={e => setItemDescDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={e => handleUpdateItemDesc(item.id, area.id, e.target.value)}
                            placeholder="Description"
                          />
                        </td>
                        <td className="col-type">
                          <select
                            className={`type-badge type-${itemType}`}
                            value={itemType}
                            onChange={e => handleUpdateItemType(item.id, area.id, e.target.value as CostType)}
                          >
                            {Object.entries(COST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </td>
                        {renderVersionCells(item)}
                        <td className="col-del">
                          <button
                            className="ccm-icon-btn danger"
                            title="Delete line item"
                            onClick={() => handleDeleteItem(area.id, item.id)}
                          >✕</button>
                        </td>
                      </tr>
                    );
                  })}
                  {area.items.length === 0 && matrix.versions.length > 0 && (
                    <tr>
                      <td colSpan={2 + matrix.versions.reduce((s, v) => s + (v.is_execution_phase ? 5 : 3), 0) + 1}
                          style={{ textAlign: 'center', color: '#8888a0', padding: '16px', fontStyle: 'italic', fontSize: 13 }}>
                        No line items yet — use the buttons below to add some.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Add type buttons */}
          <div className="ccm-add-type-btns">
            {ADD_TYPE_BUTTONS.map(({ label, type }) => (
              <button
                key={type}
                className="btn btn-sm btn-secondary"
                onClick={() => handleQuickAddItem(area.id, type)}
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Add section */}
      {showAddArea ? (
        <div className="ccm-panel" style={{ marginTop: 0 }}>
          <label>
            Section Name
            <input
              autoFocus
              value={newAreaName}
              onChange={e => setNewAreaName(e.target.value)}
              placeholder="e.g. Ductwork - Supply Air"
              onKeyDown={e => { if (e.key === 'Enter') handleAddArea(); if (e.key === 'Escape') { setShowAddArea(false); setNewAreaName(''); } }}
              style={{ minWidth: 280 }}
            />
          </label>
          <button className="btn btn-primary" onClick={handleAddArea} disabled={!newAreaName.trim()}>Add Section</button>
          <button className="btn btn-secondary" onClick={() => { setShowAddArea(false); setNewAreaName(''); }}>Cancel</button>
        </div>
      ) : (
        <button className="ccm-add-section-btn" onClick={() => setShowAddArea(true)}>
          + Add Section
        </button>
      )}

      {/* Summary card */}
      {matrix.versions.length > 0 && (
        <div className="ccm-card ccm-summary-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Summary</h3>
          <div className="ccm-table-scroll">
            <table className="ccm-items-table">
              <thead>
                <tr>
                  <th className="col-left summary-label-col">Category</th>
                  {matrix.versions.map((v, vi) => {
                    const col = VER_COLORS[vi % VER_COLORS.length];
                    return (
                      <th key={v.id} className="cell-num" style={{ background: col.header, color: col.text, minWidth: 120 }}>
                        {v.version_name}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SUMMARY_GROUPS.map(group => (
                  <tr key={group.label} className="summary-sub-row">
                    <td className="col-left">{group.label}</td>
                    {matrix.versions.map((v, vi) => {
                      const col = VER_COLORS[vi % VER_COLORS.length];
                      const total = groupTotal(v.id, group.types);
                      return <td key={v.id} className="cell-num" style={{ background: col.cell }}>{total ? fmt(total) : '—'}</td>;
                    })}
                  </tr>
                ))}
                <tr className="summary-total-row">
                  <td className="col-left">Subtotal</td>
                  {matrix.versions.map((v, vi) => {
                    const col = VER_COLORS[vi % VER_COLORS.length];
                    const t = calcVersionTotals(matrix, v.id);
                    return <td key={v.id} className="cell-num" style={{ background: col.cell }}>{fmt(t.subtotal)}</td>;
                  })}
                </tr>
                <tr className="summary-sub-row">
                  <td className="col-left">Fee ({Math.round(Number(matrix.fee_pct) * 100)}%)</td>
                  {matrix.versions.map((v, vi) => {
                    const col = VER_COLORS[vi % VER_COLORS.length];
                    const t = calcVersionTotals(matrix, v.id);
                    return <td key={v.id} className="cell-num" style={{ background: col.cell }}>{fmt(t.fee)}</td>;
                  })}
                </tr>
                <tr className="summary-sub-row">
                  <td className="col-left">Overhead ({Math.round(Number(matrix.overhead_pct) * 100)}%)</td>
                  {matrix.versions.map((v, vi) => {
                    const col = VER_COLORS[vi % VER_COLORS.length];
                    const t = calcVersionTotals(matrix, v.id);
                    return <td key={v.id} className="cell-num" style={{ background: col.cell }}>{fmt(t.overhead)}</td>;
                  })}
                </tr>
                <tr className="summary-grand-row">
                  <td className="col-left">Grand Total</td>
                  {matrix.versions.map((v, vi) => {
                    const col = VER_COLORS[vi % VER_COLORS.length];
                    const t = calcVersionTotals(matrix, v.id);
                    const overTarget = matrix.target_cost && t.grand_total > Number(matrix.target_cost);
                    return (
                      <td key={v.id} className="cell-num" style={{ background: col.cell, color: overTarget ? '#ef4444' : undefined }}>
                        {fmt(t.grand_total)}
                        {matrix.target_cost && (
                          <div style={{ fontSize: 10, color: overTarget ? '#ef4444' : '#8888a0' }}>
                            {overTarget ? '+' : ''}{fmt(t.grand_total - Number(matrix.target_cost))} vs target
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compare modal */}
      {showCompare && (
        <CostControlCompare matrix={matrix} onClose={() => setShowCompare(false)} />
      )}

      {/* Trend chart */}
      {matrix.versions.length > 1 && (
        <div className="ccm-card">
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#5a5a72' }}>Estimate Progression</h3>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {matrix.versions.map((v, vi) => {
              const col = VER_COLORS[vi % VER_COLORS.length];
              const t = calcVersionTotals(matrix, v.id);
              const pct = Math.min((t.grand_total / maxGrandTotal) * 100, 100);
              const overTarget = matrix.target_cost && t.grand_total > Number(matrix.target_cost);
              return (
                <div key={v.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 70 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: overTarget ? '#ef4444' : '#1a1a2e', fontVariantNumeric: 'tabular-nums' }}>{fmt(t.grand_total)}</div>
                  <div style={{ width: 48, height: 80, background: '#f0f1f3', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${pct}%`, background: overTarget ? '#ef4444' : col.border, borderRadius: '4px 4px 0 0', minHeight: 2, transition: 'height 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#8888a0', textAlign: 'center', maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.version_name}</div>
                </div>
              );
            })}
            {matrix.target_cost && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 70 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8888a0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(matrix.target_cost))}</div>
                <div style={{ width: 48, height: 80, background: '#f0f1f3', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${Math.min((Number(matrix.target_cost) / maxGrandTotal) * 100, 100)}%`, background: '#e0e2e7', borderRadius: '4px 4px 0 0', minHeight: 2 }} />
                </div>
                <div style={{ fontSize: 10, color: '#8888a0', textAlign: 'center' }}>Target</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
