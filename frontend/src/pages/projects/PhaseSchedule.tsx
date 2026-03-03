import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { phaseScheduleApi, PhaseCode, PhaseScheduleItem } from '../../services/phaseSchedule';
import { ContourType, contourOptions, getContourMultipliers, ContourVisual } from '../../utils/contours';
import { format, addMonths, addDays, startOfMonth, differenceInMonths, differenceInCalendarDays, startOfDay } from 'date-fns';
import '../../styles/SalesPipeline.css';

// Cost type constants
const COST_TYPE_NAMES: Record<number, string> = {
  1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions'
};
const COST_TYPE_COLORS: Record<number, string> = {
  1: '#3b82f6', 2: '#10b981', 3: '#f59e0b', 4: '#8b5cf6', 5: '#ef4444', 6: '#6b7280'
};
const UOM_OPTIONS = ['EA', 'LF', 'LS'];

// Cost type group for summary rows
interface CostTypeGroup {
  costType: number;
  name: string;
  color: string;
  items: PhaseScheduleItem[];
  estQty: number;
  estHrs: number;
  estCost: number;
  jtdQty: number;
  jtdHrs: number;
  jtdCost: number;
  pctComp: number;
  projQty: number;
  projHrs: number;
  projCost: number;
  earliestStart: string | null;
  latestEnd: string | null;
  duration: number;
}

// Formatting
const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
};
const fmtCompact = (v: number | null | undefined): string => {
  if (!v || isNaN(v)) return '-';
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const parseNum = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

// Format date for HTML date input (requires YYYY-MM-DD, but API may return ISO timestamps)
const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '';
  return d.substring(0, 10);
};

// Compute duration in calendar days between two dates (inclusive)
const getDuration = (start: string | null, end: string | null): number => {
  if (!start || !end) return 0;
  return differenceInCalendarDays(new Date(end), new Date(start)) + 1;
};

// Generate months between two dates
const generateMonths = (start: Date, end: Date): Date[] => {
  const months: Date[] = [];
  let current = startOfMonth(start);
  const last = startOfMonth(end);
  while (current <= last) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
};

// Compute monthly distribution for an item
const computeMonthlyValues = (
  item: PhaseScheduleItem,
  months: Date[],
  mode: 'cost' | 'qty'
): Record<string, number> => {
  const values: Record<string, number> = {};
  if (!item.start_date || !item.end_date) return values;

  const useManual = mode === 'cost' ? item.use_manual_values : item.use_manual_qty_values;
  const manualValues = mode === 'cost' ? item.manual_monthly_values : item.manual_monthly_qty;

  if (useManual && manualValues) {
    return manualValues;
  }

  const total = mode === 'cost'
    ? parseNum(item.total_est_cost) - parseNum(item.total_jtd_cost)
    : (parseNum(item.quantity) - parseNum(item.quantity_installed));

  if (total <= 0) return values;

  const startDate = startOfMonth(new Date(item.start_date));
  const endDate = startOfMonth(new Date(item.end_date));

  const itemMonths = months.filter(m => m >= startDate && m <= endDate);
  if (itemMonths.length === 0) return values;

  const multipliers = getContourMultipliers(itemMonths.length, (item.contour_type || 'flat') as ContourType);
  const perMonth = total / itemMonths.length;

  itemMonths.forEach((m, i) => {
    const key = format(m, 'yyyy-MM');
    values[key] = perMonth * multipliers[i];
  });

  return values;
};

// ===== ADD PHASE CODES MODAL =====
const AddPhaseCodesModal: React.FC<{
  phaseCodes: PhaseCode[];
  scheduledIds: Set<number>;
  onAdd: (ids: number[], groupBy: string) => void;
  onClose: () => void;
}> = ({ phaseCodes, scheduledIds, onAdd, onClose }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<string>('individual');
  const [filter, setFilter] = useState('');
  const [costTypeFilter, setCostTypeFilter] = useState<number | null>(null);

  const available = phaseCodes.filter(pc => !scheduledIds.has(pc.id));
  const filtered = available.filter(pc => {
    const matchesText = !filter || pc.phase_description.toLowerCase().includes(filter.toLowerCase()) || pc.phase.includes(filter);
    const matchesCT = costTypeFilter === null || pc.cost_type === costTypeFilter;
    return matchesText && matchesCT;
  });

  const groupedByJob = useMemo(() => {
    const groups: Record<string, PhaseCode[]> = {};
    filtered.forEach(pc => {
      if (!groups[pc.job]) groups[pc.job] = [];
      groups[pc.job].push(pc);
    });
    return groups;
  }, [filtered]);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(pc => pc.id)));
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Add Phase Codes to Schedule</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Search phases..." value={filter} onChange={e => setFilter(e.target.value)}
              style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' }} />
            <select value={costTypeFilter ?? ''} onChange={e => setCostTypeFilter(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' }}>
              <option value="">All Cost Types</option>
              {[1,2,3,4,5,6].map(ct => <option key={ct} value={ct}>{COST_TYPE_NAMES[ct]}</option>)}
            </select>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' }}>
              <option value="individual">Individual Lines</option>
              <option value="phase">Group by Phase</option>
              <option value="cost_type">Group by Cost Type</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
          <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ marginRight: '0.5rem' }} />
              Select All ({filtered.length} available)
            </label>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{selected.size} selected</span>
          </div>

          {Object.entries(groupedByJob).map(([job, codes]) => (
            <div key={job} style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', padding: '0.25rem 0', borderBottom: '1px solid #f1f5f9', marginBottom: '0.5rem' }}>
                Job: {job}
              </div>
              {codes.map(pc => (
                <label key={pc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <input type="checkbox" checked={selected.has(pc.id)} onChange={() => {
                    const next = new Set(selected);
                    next.has(pc.id) ? next.delete(pc.id) : next.add(pc.id);
                    setSelected(next);
                  }} />
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COST_TYPE_COLORS[pc.cost_type], flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{pc.phase.trim()} - {pc.phase_description}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>{COST_TYPE_NAMES[pc.cost_type]}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmt(parseNum(pc.est_cost))}</span>
                </label>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
              {available.length === 0 ? 'All phase codes are already scheduled' : 'No matching phase codes'}
            </div>
          )}
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onAdd([...selected], groupBy)} disabled={selected.size === 0}
            style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: selected.size > 0 ? '#3b82f6' : '#d1d5db', color: 'white', cursor: selected.size > 0 ? 'pointer' : 'default', fontWeight: 500 }}>
            Add {selected.size} Phase Code{selected.size !== 1 ? 's' : ''} to Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== EDIT ITEM PANEL (for advanced: manual values, delete) =====
const EditItemPanel: React.FC<{
  item: PhaseScheduleItem;
  months: Date[];
  onSave: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}> = ({ item, months, onSave, onDelete, onClose }) => {
  const [name, setName] = useState(item.name);
  const [startDate, setStartDate] = useState(item.start_date || '');
  const [endDate, setEndDate] = useState(item.end_date || '');
  const [contour, setContour] = useState<ContourType>((item.contour_type || 'flat') as ContourType);
  const [useManual, setUseManual] = useState(item.use_manual_values || false);
  const [manualValues, setManualValues] = useState<Record<string, number>>(item.manual_monthly_values || {});
  const [quantity, setQuantity] = useState<string>(item.quantity?.toString() || '');
  const [uom, setUom] = useState(item.quantity_uom || '');
  const [qtyInstalled, setQtyInstalled] = useState<string>(item.quantity_installed?.toString() || '0');
  const [useManualQty, setUseManualQty] = useState(item.use_manual_qty_values || false);
  const [manualQty, setManualQty] = useState<Record<string, number>>(item.manual_monthly_qty || {});

  const handleSave = () => {
    onSave(item.id, {
      name,
      start_date: startDate || null,
      end_date: endDate || null,
      contour_type: contour,
      use_manual_values: useManual,
      manual_monthly_values: useManual ? manualValues : null,
      quantity: quantity ? parseFloat(quantity) : null,
      quantity_uom: uom || null,
      quantity_installed: parseFloat(qtyInstalled) || 0,
      use_manual_qty_values: useManualQty,
      manual_monthly_qty: useManualQty ? manualQty : null,
    } as any);
  };

  const itemMonths = useMemo(() => {
    if (!startDate || !endDate) return [];
    return generateMonths(startOfMonth(new Date(startDate)), startOfMonth(new Date(endDate)));
  }, [startDate, endDate]);

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '420px', backgroundColor: 'white', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)', zIndex: 999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>Edit Schedule Item</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>Work Contour</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {contourOptions.map(opt => (
              <button key={opt.value} onClick={() => setContour(opt.value)}
                style={{
                  padding: '0.3rem 0.5rem', border: contour === opt.value ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '6px', backgroundColor: contour === opt.value ? '#eff6ff' : 'white',
                  cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem'
                }}>
                <ContourVisual contour={opt.value} /> {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>Cost Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div>Est Cost: <strong>{fmt(parseNum(item.total_est_cost))}</strong></div>
            <div>JTD Cost: <strong>{fmt(parseNum(item.total_jtd_cost))}</strong></div>
            <div>Remaining: <strong>{fmt(parseNum(item.total_est_cost) - parseNum(item.total_jtd_cost))}</strong></div>
            <div>Est Hours: <strong>{parseNum(item.total_est_hours).toLocaleString()}</strong></div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
            {item.cost_types?.map(ct => (
              <span key={ct} style={{ padding: '0.15rem 0.5rem', borderRadius: '10px', backgroundColor: COST_TYPE_COLORS[ct] + '20', color: COST_TYPE_COLORS[ct], fontWeight: 500 }}>
                {COST_TYPE_NAMES[ct]}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>Quantity Tracking</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Quantity</label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" style={{ width: '100%', padding: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#64748b' }}>UOM</label>
              <select value={uom} onChange={e => setUom(e.target.value)} style={{ width: '100%', padding: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }}>
                <option value="">-</option>
                {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Installed</label>
              <input type="number" value={qtyInstalled} onChange={e => setQtyInstalled(e.target.value)} placeholder="0" style={{ width: '100%', padding: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        {/* Manual monthly cost values */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
            <input type="checkbox" checked={useManual} onChange={e => setUseManual(e.target.checked)} />
            Manual Monthly Cost Values
          </label>
          {useManual && itemMonths.length > 0 && (
            <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              {itemMonths.map(m => {
                const key = format(m, 'yyyy-MM');
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.8rem', width: '70px' }}>{format(m, 'MMM yyyy')}</span>
                    <input type="number" value={manualValues[key] || ''} onChange={e => setManualValues({ ...manualValues, [key]: parseFloat(e.target.value) || 0 })}
                      placeholder="0" style={{ flex: 1, padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.8rem' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Manual monthly quantity values */}
        {quantity && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input type="checkbox" checked={useManualQty} onChange={e => setUseManualQty(e.target.checked)} />
              Manual Monthly Quantity Values
            </label>
            {useManualQty && itemMonths.length > 0 && (
              <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                {itemMonths.map(m => {
                  const key = format(m, 'yyyy-MM');
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '0.8rem', width: '70px' }}>{format(m, 'MMM yyyy')}</span>
                      <input type="number" value={manualQty[key] || ''} onChange={e => setManualQty({ ...manualQty, [key]: parseFloat(e.target.value) || 0 })}
                        placeholder="0" style={{ flex: 1, padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.8rem' }} />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{uom}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => { if (window.confirm('Delete this schedule item?')) onDelete(item.id); }}
          style={{ padding: '0.5rem 1rem', border: '1px solid #fca5a5', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}>
          Delete
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 500 }}>Save</button>
        </div>
      </div>
    </div>
  );
};

// ===== GANTT VIEW =====
const GanttView: React.FC<{
  items: PhaseScheduleItem[];
  months: Date[];
  onUpdate: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onEdit: (item: PhaseScheduleItem) => void;
  costTypeGroups: CostTypeGroup[];
  collapsedGroups: Set<number>;
  onToggleGroup: (costType: number) => void;
}> = ({ items, months, onUpdate, onEdit, costTypeGroups, collapsedGroups, onToggleGroup }) => {
  const ganttRef = useRef<HTMLDivElement>(null);
  const colWidth = 80;
  const rowHeight = 36;
  const [leftPanelWidth, setLeftPanelWidth] = useState(520);
  const draggingRef = useRef<{ startX: number; startW: number } | null>(null);
  const today = startOfDay(new Date());

  // Resizable left panel
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const diff = e.clientX - draggingRef.current.startX;
      setLeftPanelWidth(Math.max(200, Math.min(800, draggingRef.current.startW + diff)));
    };
    const onUp = () => {
      draggingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const firstMonth = months.length > 0 ? months[0] : null;
  const totalWidth = months.length * colWidth;
  const todayOffset = firstMonth ? differenceInCalendarDays(today, firstMonth) / 30.44 * colWidth : 0;

  return (
    <div className="card" style={{ padding: 0, display: 'flex', overflow: 'hidden' }}>
      {/* Left panel - task list with inline fields */}
      <div style={{ width: leftPanelWidth, flexShrink: 0, overflow: 'auto' }}>
        <div style={{ height: '36px', borderBottom: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#1e293b', background: '#f8fafc' }}>
          <div style={{ flex: 1, minWidth: 0, padding: '0 0.5rem' }}>Phase Code</div>
          <div style={{ width: '65px', textAlign: 'right', padding: '0 0.25rem', flexShrink: 0 }}>Est $</div>
          <div style={{ width: '85px', textAlign: 'center', padding: '0 0.25rem', flexShrink: 0 }}>Start</div>
          <div style={{ width: '85px', textAlign: 'center', padding: '0 0.25rem', flexShrink: 0 }}>End</div>
          <div style={{ width: '42px', textAlign: 'center', padding: '0 0.25rem', flexShrink: 0 }}>Dur</div>
          <div style={{ width: '55px', textAlign: 'center', padding: '0 0.25rem', flexShrink: 0 }}>Contour</div>
        </div>
        {costTypeGroups.map(group => {
          const isCollapsed = collapsedGroups.has(group.costType);
          return (
            <React.Fragment key={`ct-${group.costType}`}>
              <div
                style={{
                  height: rowHeight, borderBottom: `2px solid ${group.color}40`,
                  display: 'flex', alignItems: 'center', fontSize: '0.72rem',
                  backgroundColor: `${group.color}08`, cursor: 'pointer', padding: '0 0.5rem'
                }}
                onClick={() => onToggleGroup(group.costType)}
              >
                <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: '0.6rem', marginRight: '4px', color: '#64748b' }}>&#9660;</span>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: group.color, marginRight: '6px', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: group.color }}>{group.name}</span>
                <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '4px' }}>({group.items.length})</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#64748b' }}>{fmtCompact(group.estCost)}</span>
              </div>
              {!isCollapsed && group.items.map(item => (
                <GanttRow key={item.id} item={item} rowHeight={rowHeight} onUpdate={onUpdate} onEdit={onEdit} />
              ))}
            </React.Fragment>
          );
        })}
      </div>

      {/* Resize handle for left panel */}
      <div
        onMouseDown={e => {
          e.preventDefault();
          draggingRef.current = { startX: e.clientX, startW: leftPanelWidth };
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        style={{ width: '4px', flexShrink: 0, cursor: 'col-resize', background: '#e2e8f0', transition: 'background 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3b82f6'; }}
        onMouseLeave={e => { if (!draggingRef.current) (e.currentTarget as HTMLElement).style.background = '#e2e8f0'; }}
      />

      {/* Right panel - timeline */}
      <div style={{ flex: 1, overflow: 'auto' }} ref={ganttRef}>
        {months.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', color: '#64748b', fontSize: '0.85rem' }}>
            Set start/end dates to see the timeline
          </div>
        ) : (
        <div style={{ minWidth: totalWidth, position: 'relative' }}>
          <div style={{ display: 'flex', height: '36px', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
            {months.map(m => (
              <div key={m.toISOString()} style={{ width: colWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 500, color: '#1e293b', borderRight: '1px solid #f1f5f9' }}>
                {format(m, 'MMM yy')}
              </div>
            ))}
          </div>

          {costTypeGroups.map(group => {
            const isCollapsed = collapsedGroups.has(group.costType);
            // Group summary bar span
            const gStart = group.earliestStart ? startOfMonth(new Date(group.earliestStart)) : null;
            const gEnd = group.latestEnd ? startOfMonth(new Date(group.latestEnd)) : null;
            let gBarLeft = 0, gBarWidth = 0;
            if (gStart && gEnd && firstMonth && gStart >= firstMonth) {
              gBarLeft = differenceInMonths(gStart, firstMonth) * colWidth + 2;
              gBarWidth = (differenceInMonths(gEnd, gStart) + 1) * colWidth - 4;
            }
            return (
              <React.Fragment key={`ct-${group.costType}`}>
                {/* Group summary row in timeline */}
                <div style={{ height: rowHeight, position: 'relative', borderBottom: `2px solid ${group.color}40`, backgroundColor: `${group.color}08` }}>
                  {months.map((m, i) => (
                    <div key={i} style={{ position: 'absolute', left: i * colWidth, top: 0, bottom: 0, width: colWidth, borderRight: '1px solid #f1f5f9' }} />
                  ))}
                  {gBarWidth > 0 && (
                    <div style={{
                      position: 'absolute', left: gBarLeft, top: 8, height: rowHeight - 16, width: gBarWidth,
                      backgroundColor: `${group.color}20`, border: `1px dashed ${group.color}`, borderRadius: '3px'
                    }} />
                  )}
                </div>
                {/* Child item bars */}
                {!isCollapsed && group.items.map(item => {
                  const start = item.start_date ? startOfMonth(new Date(item.start_date)) : null;
                  const end = item.end_date ? startOfMonth(new Date(item.end_date)) : null;
                  let barLeft = 0, barWidth = 0;
                  if (start && end && firstMonth && start >= firstMonth) {
                    barLeft = differenceInMonths(start, firstMonth) * colWidth + 4;
                    barWidth = (differenceInMonths(end, start) + 1) * colWidth - 8;
                  }
                  const barColor = COST_TYPE_COLORS[item.cost_types?.[0] || 1];
                  return (
                    <div key={item.id} style={{ height: rowHeight, position: 'relative', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => onEdit(item)}>
                      {months.map((m, i) => (
                        <div key={i} style={{ position: 'absolute', left: i * colWidth, top: 0, bottom: 0, width: colWidth, borderRight: '1px solid #f1f5f9' }} />
                      ))}
                      {barWidth > 0 && (
                        <div style={{
                          position: 'absolute', left: barLeft, top: 6, height: rowHeight - 12, width: barWidth,
                          backgroundColor: barColor + '30', border: `2px solid ${barColor}`, borderRadius: '4px',
                          display: 'flex', alignItems: 'center', paddingLeft: '6px', overflow: 'hidden'
                        }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = barColor + '50'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = barColor + '30'; }}>
                          <span style={{ fontSize: '0.65rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {todayOffset > 0 && todayOffset < totalWidth && (
            <div style={{ position: 'absolute', left: todayOffset, top: 0, bottom: 0, width: '2px', backgroundColor: '#ef4444', zIndex: 1, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: '2px', left: '-10px', fontSize: '0.6rem', color: '#ef4444', fontWeight: 600 }}>Today</div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

// Gantt row with inline editing
const GanttRow: React.FC<{
  item: PhaseScheduleItem;
  rowHeight: number;
  onUpdate: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onEdit: (item: PhaseScheduleItem) => void;
}> = ({ item, rowHeight, onUpdate, onEdit }) => {
  const dur = getDuration(item.start_date, item.end_date);

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    if (value) onUpdate(item.id, { [field]: value } as any);
  };

  const handleDurationChange = (newDur: number) => {
    if (newDur > 0 && item.start_date) {
      const newEnd = format(addMonths(new Date(item.start_date), newDur - 1), 'yyyy-MM-dd');
      onUpdate(item.id, { end_date: newEnd } as any);
    }
  };

  const handleContourChange = (value: string) => {
    onUpdate(item.id, { contour_type: value } as any);
  };

  return (
    <div style={{ height: rowHeight, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', fontSize: '0.75rem' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '0 0.5rem', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', cursor: 'pointer' }}
        onClick={() => onEdit(item)} title={item.name}>
        {item.cost_types?.map(ct => (
          <span key={ct} style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COST_TYPE_COLORS[ct], flexShrink: 0 }} />
        ))}
        {item.phase_code_display && (
          <span style={{ fontSize: '0.6rem', color: '#64748b', flexShrink: 0, fontFamily: 'monospace' }}>{item.phase_code_display}</span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b' }}>{item.name}</span>
      </div>
      <div style={{ width: '65px', textAlign: 'right', padding: '0 0.25rem', flexShrink: 0, fontSize: '0.7rem', color: '#64748b' }}>
        {fmtCompact(parseNum(item.total_est_cost))}
      </div>
      <div style={{ width: '85px', padding: '0 2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <input type="date" value={fmtDate(item.start_date)} onChange={e => handleDateChange('start_date', e.target.value)}
          style={{ width: '100%', padding: '0.15rem 0.25rem', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '0.65rem', color: '#64748b', background: 'transparent', cursor: 'pointer', boxSizing: 'border-box' as const }} />
      </div>
      <div style={{ width: '85px', padding: '0 2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <input type="date" value={fmtDate(item.end_date)} onChange={e => handleDateChange('end_date', e.target.value)}
          style={{ width: '100%', padding: '0.15rem 0.25rem', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '0.65rem', color: '#64748b', background: 'transparent', cursor: 'pointer', boxSizing: 'border-box' as const }} />
      </div>
      <div style={{ width: '42px', padding: '0 2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <input type="number" value={dur || ''} min={1}
          onChange={e => handleDurationChange(parseInt(e.target.value) || 0)}
          style={{ width: '100%', padding: '0.15rem 0.25rem', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '0.65rem', color: '#64748b', textAlign: 'center', background: 'transparent', boxSizing: 'border-box' as const }} />
      </div>
      <div style={{ width: '55px', padding: '0 2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <select value={item.contour_type || 'flat'} onChange={e => handleContourChange(e.target.value)}
          style={{ width: '100%', padding: '0.15rem 0.25rem', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '0.65rem', color: '#64748b', background: 'transparent', cursor: 'pointer', boxSizing: 'border-box' as const }}>
          {contourOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    </div>
  );
};

// ===== GRID VIEW =====
// Format hours compactly
const fmtHrs = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v) || v === 0) return '-';
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(0);
};
// Format PI (productivity index)
const fmtPi = (qty: number, hrs: number): string => {
  if (!qty || !hrs || hrs === 0) return '-';
  return (qty / hrs).toFixed(2);
};

const GRID_COL_DEFAULTS = {
  phase: 200, ct: 30,
  // Estimated group
  estQty: 50, uom: 36, estHrs: 52, estCost: 65, estPi: 40,
  // JTD group
  pctComp: 46, jtdQty: 50, jtdHrs: 52, jtdCost: 65, jtdPi: 40,
  // Projected group
  projQty: 50, projHrs: 52, projCost: 65, projPi: 40,
  // Schedule
  start: 88, end: 88, dur: 38, contour: 62
};

const GridView: React.FC<{
  items: PhaseScheduleItem[];
  months: Date[];
  mode: 'cost' | 'qty';
  onUpdate: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onEdit: (item: PhaseScheduleItem) => void;
  costTypeGroups: CostTypeGroup[];
  collapsedGroups: Set<number>;
  onToggleGroup: (costType: number) => void;
}> = ({ items, months, mode, onUpdate, onEdit, costTypeGroups, collapsedGroups, onToggleGroup }) => {
  const [colWidths, setColWidths] = useState(GRID_COL_DEFAULTS);
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  // Column resize handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const diff = e.clientX - r.startX;
      const newW = Math.max(28, r.startW + diff);
      setColWidths(prev => ({ ...prev, [r.col]: newW }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { col, startX: e.clientX, startW: (colWidths as any)[col] || 60 };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const allMonthlyValues = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    items.forEach(item => {
      map.set(item.id, computeMonthlyValues(item, months, mode));
    });
    return map;
  }, [items, months, mode]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach(m => {
      const key = format(m, 'yyyy-MM');
      totals[key] = 0;
      items.forEach(item => {
        totals[key] += allMonthlyValues.get(item.id)?.[key] || 0;
      });
    });
    return totals;
  }, [items, months, allMonthlyValues]);

  const maxVal = useMemo(() => {
    let max = 0;
    allMonthlyValues.forEach(vals => {
      Object.values(vals).forEach(v => { if (v > max) max = v; });
    });
    return max;
  }, [allMonthlyValues]);

  // Per-group monthly subtotals for summary rows
  const groupMonthlyTotals = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    costTypeGroups.forEach(group => {
      const totals: Record<string, number> = {};
      months.forEach(m => {
        const key = format(m, 'yyyy-MM');
        totals[key] = group.items.reduce((s, item) => s + (allMonthlyValues.get(item.id)?.[key] || 0), 0);
      });
      map.set(group.costType, totals);
    });
    return map;
  }, [costTypeGroups, months, allMonthlyValues]);

  const monthColWidth = 62;
  // Compute group widths for spanning headers
  const estGroupW = colWidths.estQty + colWidths.uom + colWidths.estHrs + colWidths.estCost + colWidths.estPi;
  const jtdGroupW = colWidths.pctComp + colWidths.jtdQty + colWidths.jtdHrs + colWidths.jtdCost + colWidths.jtdPi;
  const projGroupW = colWidths.projQty + colWidths.projHrs + colWidths.projCost + colWidths.projPi;
  const schedGroupW = colWidths.start + colWidths.end + colWidths.dur + colWidths.contour;
  const fixedWidth = colWidths.phase + colWidths.ct + estGroupW + jtdGroupW + projGroupW + schedGroupW;

  const thStyle = (width: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
    width, minWidth: width, maxWidth: width, padding: '0.3rem 0.2rem', textAlign: 'center' as const,
    borderBottom: '2px solid #e2e8f0', fontSize: '0.65rem', fontWeight: 600,
    whiteSpace: 'nowrap' as const, position: 'relative' as const, color: '#1e293b', overflow: 'hidden' as const,
    ...extra
  });

  const groupHeaderStyle = (width: number, color: string): React.CSSProperties => ({
    width, minWidth: width, textAlign: 'center' as const, padding: '0.25rem 0',
    fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px',
    borderBottom: `2px solid ${color}`, color, background: '#f8fafc'
  });

  const resizeHandle = (col: string) => (
    <div onMouseDown={e => startResize(col, e)}
      style={{ position: 'absolute', right: -1, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', zIndex: 1 }}
      onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = 'rgba(59,130,246,0.25)'; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    />
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed', width: fixedWidth + months.length * monthColWidth }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
          {/* Group header row */}
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ ...groupHeaderStyle(colWidths.phase, '#1e293b'), textAlign: 'left', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 5, borderRight: '2px solid #e2e8f0', padding: '0.25rem 0.5rem' }}></th>
            <th style={groupHeaderStyle(colWidths.ct, '#1e293b')}></th>
            <th colSpan={5} style={{ ...groupHeaderStyle(estGroupW, '#3b82f6'), borderRight: '2px solid #e2e8f0' }}>Estimated</th>
            <th colSpan={5} style={{ ...groupHeaderStyle(jtdGroupW, '#f59e0b'), borderRight: '2px solid #e2e8f0' }}>JTD</th>
            <th colSpan={4} style={{ ...groupHeaderStyle(projGroupW, '#10b981'), borderRight: '2px solid #e2e8f0' }}>Projected</th>
            <th colSpan={4} style={{ ...groupHeaderStyle(schedGroupW, '#64748b'), borderRight: '2px solid #e2e8f0' }}>Schedule</th>
            {months.length > 0 && (
              <th colSpan={months.length} style={groupHeaderStyle(months.length * monthColWidth, '#8b5cf6')}>Monthly Distribution</th>
            )}
          </tr>
          {/* Column header row */}
          <tr style={{ background: '#f8fafc' }}>
            {/* Fixed columns */}
            <th style={thStyle(colWidths.phase, { textAlign: 'left', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 5, borderRight: '2px solid #e2e8f0', padding: '0.3rem 0.5rem' })}>
              Phase{resizeHandle('phase')}
            </th>
            <th style={thStyle(colWidths.ct)}>CT{resizeHandle('ct')}</th>
            {/* Estimated group */}
            <th style={thStyle(colWidths.estQty, { borderLeft: '1px solid #dbeafe' })}>Qty{resizeHandle('estQty')}</th>
            <th style={thStyle(colWidths.uom)}>UOM{resizeHandle('uom')}</th>
            <th style={thStyle(colWidths.estHrs)}>Hrs{resizeHandle('estHrs')}</th>
            <th style={thStyle(colWidths.estCost)}>Cost{resizeHandle('estCost')}</th>
            <th style={thStyle(colWidths.estPi, { borderRight: '2px solid #e2e8f0' })}>PI{resizeHandle('estPi')}</th>
            {/* JTD group */}
            <th style={thStyle(colWidths.pctComp)}>%Comp{resizeHandle('pctComp')}</th>
            <th style={thStyle(colWidths.jtdQty)}>Qty{resizeHandle('jtdQty')}</th>
            <th style={thStyle(colWidths.jtdHrs)}>Hrs{resizeHandle('jtdHrs')}</th>
            <th style={thStyle(colWidths.jtdCost)}>Cost{resizeHandle('jtdCost')}</th>
            <th style={thStyle(colWidths.jtdPi, { borderRight: '2px solid #e2e8f0' })}>PI{resizeHandle('jtdPi')}</th>
            {/* Projected group */}
            <th style={thStyle(colWidths.projQty)}>Qty{resizeHandle('projQty')}</th>
            <th style={thStyle(colWidths.projHrs)}>Hrs{resizeHandle('projHrs')}</th>
            <th style={thStyle(colWidths.projCost)}>Cost{resizeHandle('projCost')}</th>
            <th style={thStyle(colWidths.projPi, { borderRight: '2px solid #e2e8f0' })}>PI{resizeHandle('projPi')}</th>
            {/* Schedule group */}
            <th style={thStyle(colWidths.start)}>Start{resizeHandle('start')}</th>
            <th style={thStyle(colWidths.end)}>End{resizeHandle('end')}</th>
            <th style={thStyle(colWidths.dur)}>Days{resizeHandle('dur')}</th>
            <th style={thStyle(colWidths.contour, { borderRight: '2px solid #e2e8f0' })}>Contour{resizeHandle('contour')}</th>
            {/* Monthly columns */}
            {months.map(m => (
              <th key={m.toISOString()} style={thStyle(monthColWidth, { borderRight: '1px solid #f1f5f9' })}>
                {format(m, 'MMM yy')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {costTypeGroups.map(group => {
            const isCollapsed = collapsedGroups.has(group.costType);
            return (
              <React.Fragment key={`ct-${group.costType}`}>
                <CostTypeSummaryRow
                  group={group} isCollapsed={isCollapsed}
                  onToggle={() => onToggleGroup(group.costType)}
                  months={months} mode={mode}
                  monthlyTotals={groupMonthlyTotals.get(group.costType) || {}}
                  colWidths={colWidths} monthColWidth={monthColWidth}
                />
                {!isCollapsed && group.items.map(item => (
                  <GridRow key={item.id} item={item} months={months} mode={mode}
                    monthlyVals={allMonthlyValues.get(item.id) || {}} maxVal={maxVal}
                    colWidths={colWidths} monthColWidth={monthColWidth}
                    onUpdate={onUpdate} onEdit={onEdit} />
                ))}
              </React.Fragment>
            );
          })}
          {/* Totals row */}
          {(() => {
            const totEstQty = items.reduce((s, i) => s + parseNum(i.quantity), 0);
            const totEstHrs = items.reduce((s, i) => s + parseNum(i.total_est_hours), 0);
            const totEstCost = items.reduce((s, i) => s + parseNum(i.total_est_cost), 0);
            const totJtdQty = items.reduce((s, i) => s + parseNum(i.quantity_installed), 0);
            const totJtdHrs = items.reduce((s, i) => s + parseNum(i.total_jtd_hours), 0);
            const totJtdCost = items.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0);
            const totPctComp = totEstCost > 0 ? (totJtdCost / totEstCost * 100) : 0;
            // Projected totals: sum each item's projected values (same logic as GridRow)
            const totProjQty = totEstQty; // scope doesn't change
            const totProjHrs = items.reduce((s, i) => {
              const eQ = parseNum(i.quantity);
              const jQ = parseNum(i.quantity_installed);
              const jH = parseNum(i.total_jtd_hours);
              const pi = jQ > 0 && jH > 0 ? jQ / jH : 0;
              return s + (pi > 0 ? eQ / pi : parseNum(i.total_est_hours));
            }, 0);
            const totProjCost = items.reduce((s, i) => {
              const pct = parseNum(i.percent_complete);
              const jC = parseNum(i.total_jtd_cost);
              return s + (pct > 0 ? jC / (pct / 100) : parseNum(i.total_est_cost));
            }, 0);
            const tdTot: React.CSSProperties = { padding: '0.3rem 0.2rem', textAlign: 'right', borderTop: '2px solid #e2e8f0', fontSize: '0.65rem', whiteSpace: 'nowrap' };
            return (
              <tr style={{ fontWeight: 600, background: '#f1f5f9' }}>
                <td style={{ position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1, padding: '0.4rem 0.5rem', borderTop: '2px solid #e2e8f0', borderRight: '2px solid #e2e8f0', fontSize: '0.72rem', width: colWidths.phase }}>
                  Totals
                </td>
                <td style={{ ...tdTot, width: colWidths.ct }}></td>
                {/* Estimated totals */}
                <td style={{ ...tdTot, width: colWidths.estQty }}>{totEstQty > 0 ? totEstQty.toFixed(0) : ''}</td>
                <td style={{ ...tdTot, width: colWidths.uom }}></td>
                <td style={{ ...tdTot, width: colWidths.estHrs }}>{fmtHrs(totEstHrs)}</td>
                <td style={{ ...tdTot, width: colWidths.estCost }}>{fmtCompact(totEstCost)}</td>
                <td style={{ ...tdTot, width: colWidths.estPi, borderRight: '2px solid #e2e8f0' }}>{fmtPi(totEstQty, totEstHrs)}</td>
                {/* JTD totals */}
                <td style={{ ...tdTot, width: colWidths.pctComp }}>{totPctComp > 0 ? `${totPctComp.toFixed(1)}%` : ''}</td>
                <td style={{ ...tdTot, width: colWidths.jtdQty }}>{totJtdQty > 0 ? totJtdQty.toFixed(0) : ''}</td>
                <td style={{ ...tdTot, width: colWidths.jtdHrs }}>{fmtHrs(totJtdHrs)}</td>
                <td style={{ ...tdTot, width: colWidths.jtdCost }}>{fmtCompact(totJtdCost)}</td>
                <td style={{ ...tdTot, width: colWidths.jtdPi, borderRight: '2px solid #e2e8f0' }}>{fmtPi(totJtdQty, totJtdHrs)}</td>
                {/* Projected totals */}
                <td style={{ ...tdTot, width: colWidths.projQty }}>{totProjQty > 0 ? totProjQty.toFixed(0) : ''}</td>
                <td style={{ ...tdTot, width: colWidths.projHrs }}>{fmtHrs(totProjHrs)}</td>
                <td style={{ ...tdTot, width: colWidths.projCost }}>{fmtCompact(totProjCost)}</td>
                <td style={{ ...tdTot, width: colWidths.projPi, borderRight: '2px solid #e2e8f0' }}>{fmtPi(totProjQty, totProjHrs)}</td>
                {/* Schedule totals (empty) */}
                <td style={{ ...tdTot, width: colWidths.start }}></td>
                <td style={{ ...tdTot, width: colWidths.end }}></td>
                <td style={{ ...tdTot, width: colWidths.dur }}></td>
                <td style={{ ...tdTot, width: colWidths.contour, borderRight: '2px solid #e2e8f0' }}></td>
                {/* Monthly totals */}
                {months.map(m => {
                  const key = format(m, 'yyyy-MM');
                  const total = columnTotals[key] || 0;
                  return (
                    <td key={key} style={{ ...tdTot, borderRight: '1px solid #f1f5f9', width: monthColWidth }}>
                      {total > 0 ? (mode === 'cost' ? fmtCompact(total) : total.toFixed(0)) : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
};

// Cost type summary row (collapsible group header)
const CostTypeSummaryRow: React.FC<{
  group: CostTypeGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  months: Date[];
  mode: 'cost' | 'qty';
  monthlyTotals: Record<string, number>;
  colWidths: typeof GRID_COL_DEFAULTS;
  monthColWidth: number;
}> = ({ group, isCollapsed, onToggle, months, mode, monthlyTotals, colWidths, monthColWidth }) => {
  const tdS: React.CSSProperties = {
    padding: '0.3rem 0.2rem', fontSize: '0.68rem', whiteSpace: 'nowrap',
    textAlign: 'right', fontWeight: 600, color: '#1e293b',
    borderBottom: `2px solid ${group.color}40`, backgroundColor: `${group.color}08`,
  };
  return (
    <tr style={{ cursor: 'pointer', backgroundColor: `${group.color}08` }} onClick={onToggle}>
      {/* Phase name - cost type name with chevron */}
      <td style={{
        ...tdS, textAlign: 'left', position: 'sticky', left: 0,
        backgroundColor: `${group.color}08`, zIndex: 1,
        borderRight: '2px solid #e2e8f0', padding: '0.4rem 0.5rem', width: colWidths.phase
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-block', transition: 'transform 0.15s',
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            fontSize: '0.6rem', color: '#64748b'
          }}>&#9660;</span>
          <span style={{
            display: 'inline-block', width: '10px', height: '10px',
            borderRadius: '2px', backgroundColor: group.color, flexShrink: 0
          }} />
          <span style={{ fontWeight: 700, fontSize: '0.72rem', color: group.color }}>{group.name}</span>
          <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 400 }}>({group.items.length})</span>
        </div>
      </td>
      <td style={{ ...tdS, width: colWidths.ct }}></td>
      {/* Estimated */}
      <td style={{ ...tdS, width: colWidths.estQty }}>{group.estQty > 0 ? group.estQty.toFixed(0) : ''}</td>
      <td style={{ ...tdS, width: colWidths.uom }}></td>
      <td style={{ ...tdS, width: colWidths.estHrs }}>{fmtHrs(group.estHrs)}</td>
      <td style={{ ...tdS, width: colWidths.estCost }}>{fmtCompact(group.estCost)}</td>
      <td style={{ ...tdS, width: colWidths.estPi, borderRight: '2px solid #e2e8f0' }}>{fmtPi(group.estQty, group.estHrs)}</td>
      {/* JTD */}
      <td style={{ ...tdS, width: colWidths.pctComp }}>{group.pctComp > 0 ? `${group.pctComp.toFixed(1)}%` : ''}</td>
      <td style={{ ...tdS, width: colWidths.jtdQty }}>{group.jtdQty > 0 ? group.jtdQty.toFixed(0) : ''}</td>
      <td style={{ ...tdS, width: colWidths.jtdHrs }}>{fmtHrs(group.jtdHrs)}</td>
      <td style={{ ...tdS, width: colWidths.jtdCost }}>{fmtCompact(group.jtdCost)}</td>
      <td style={{ ...tdS, width: colWidths.jtdPi, borderRight: '2px solid #e2e8f0' }}>{fmtPi(group.jtdQty, group.jtdHrs)}</td>
      {/* Projected (color coded vs estimate) */}
      <td style={{ ...tdS, width: colWidths.projQty }}>{group.projQty > 0 ? group.projQty.toFixed(0) : ''}</td>
      <td style={{ ...tdS, width: colWidths.projHrs, color: group.projHrs > group.estHrs ? '#ef4444' : group.projHrs < group.estHrs ? '#10b981' : '#1e293b' }}>{fmtHrs(group.projHrs)}</td>
      <td style={{ ...tdS, width: colWidths.projCost, color: group.projCost > group.estCost ? '#ef4444' : group.projCost < group.estCost ? '#10b981' : '#1e293b' }}>{fmtCompact(group.projCost)}</td>
      <td style={{ ...tdS, width: colWidths.projPi, borderRight: '2px solid #e2e8f0', color: (() => { const ePi = group.estHrs > 0 ? group.estQty / group.estHrs : 0; const pPi = group.projHrs > 0 ? group.projQty / group.projHrs : 0; return pPi < ePi ? '#ef4444' : pPi > ePi ? '#10b981' : '#1e293b'; })() }}>{fmtPi(group.projQty, group.projHrs)}</td>
      {/* Schedule */}
      <td style={{ ...tdS, width: colWidths.start, textAlign: 'center', fontSize: '0.63rem' }}>{group.earliestStart ? fmtDate(group.earliestStart).substring(5) : ''}</td>
      <td style={{ ...tdS, width: colWidths.end, textAlign: 'center', fontSize: '0.63rem' }}>{group.latestEnd ? fmtDate(group.latestEnd).substring(5) : ''}</td>
      <td style={{ ...tdS, width: colWidths.dur, textAlign: 'center' }}>{group.duration || ''}</td>
      <td style={{ ...tdS, width: colWidths.contour, borderRight: '2px solid #e2e8f0' }}></td>
      {/* Monthly subtotals */}
      {months.map(m => {
        const key = format(m, 'yyyy-MM');
        const val = monthlyTotals[key] || 0;
        return (
          <td key={key} style={{
            ...tdS, borderRight: '1px solid #f1f5f9', width: monthColWidth,
            backgroundColor: val > 0 ? `${group.color}15` : `${group.color}08`,
            fontSize: '0.63rem'
          }}>
            {val > 0 ? (mode === 'cost' ? fmtCompact(val) : val.toFixed(0)) : ''}
          </td>
        );
      })}
    </tr>
  );
};

// Grid row with inline editing
const GridRow: React.FC<{
  item: PhaseScheduleItem;
  months: Date[];
  mode: 'cost' | 'qty';
  monthlyVals: Record<string, number>;
  maxVal: number;
  colWidths: typeof GRID_COL_DEFAULTS;
  monthColWidth: number;
  onUpdate: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onEdit: (item: PhaseScheduleItem) => void;
}> = React.memo(({ item, months, mode, monthlyVals, maxVal, colWidths, monthColWidth, onUpdate, onEdit }) => {
  const dur = getDuration(item.start_date, item.end_date);

  // Computed values
  const estQty = parseNum(item.quantity);
  const estHrs = parseNum(item.total_est_hours);
  const estCost = parseNum(item.total_est_cost);
  const jtdQty = parseNum(item.quantity_installed);
  const jtdHrs = parseNum(item.total_jtd_hours);
  const jtdCost = parseNum(item.total_jtd_cost);
  const pctComp = parseNum(item.percent_complete);
  const jtdPi = jtdQty > 0 && jtdHrs > 0 ? jtdQty / jtdHrs : 0;
  // Projected = extrapolated totals based on % complete and PI
  const projQty = estQty; // scope doesn't change
  const projHrs = jtdPi > 0 ? estQty / jtdPi : estHrs; // Est Qty / actual PI, fallback to Est Hrs
  const projCost = pctComp > 0 ? jtdCost / (pctComp / 100) : estCost; // JTD$ / %Comp, fallback to Est$

  const handleFieldChange = useCallback((field: string, value: any) => {
    if (field === 'duration') {
      if (value > 0 && item.start_date) {
        const newEnd = format(addDays(new Date(item.start_date), value - 1), 'yyyy-MM-dd');
        onUpdate(item.id, { end_date: newEnd } as any);
      }
    } else if (field === 'percent_complete') {
      // Bidirectional: %Comp → calculate JTD Qty from Est Qty
      const pct = parseFloat(value) || 0;
      const updates: any = { percent_complete: pct };
      if (estQty > 0) {
        updates.quantity_installed = Math.round(estQty * pct / 100 * 100) / 100;
      }
      onUpdate(item.id, updates);
    } else if (field === 'quantity_installed') {
      // Bidirectional: JTD Qty → calculate %Comp from Est Qty
      const updates: any = { quantity_installed: value ?? 0 };
      if (estQty > 0) {
        updates.percent_complete = Math.round((value ?? 0) / estQty * 10000) / 100;
      }
      onUpdate(item.id, updates);
    } else {
      onUpdate(item.id, { [field]: value } as any);
    }
  }, [item.id, item.start_date, estQty, onUpdate]);

  // Match ProjectedRevenue table styling
  const tdBase: React.CSSProperties = {
    padding: '0.3rem 0.2rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.68rem', overflow: 'hidden'
  };
  // Read-only data cell
  const tdData: React.CSSProperties = {
    ...tdBase, textAlign: 'right', color: '#1e293b', whiteSpace: 'nowrap'
  };
  // Muted read-only cell
  const tdMuted: React.CSSProperties = {
    ...tdBase, textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap'
  };
  // Shared inline control style matching ProjectedRevenue selects
  const inlineCtrl: React.CSSProperties = {
    padding: '0.15rem 0.2rem', fontSize: '0.63rem', border: '1px solid #e2e8f0',
    borderRadius: '3px', background: 'transparent', color: '#64748b',
    cursor: 'pointer', boxSizing: 'border-box' as const, width: '100%'
  };

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fafbfc')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
      {/* Phase name - click to open edit panel */}
      <td style={{ ...tdBase, position: 'sticky', left: 0, backgroundColor: 'inherit', zIndex: 1, borderRight: '2px solid #e2e8f0', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: colWidths.phase, maxWidth: colWidths.phase, cursor: 'pointer' }}
        onClick={() => onEdit(item)} title={item.name}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {item.cost_types?.map(ct => (
            <span key={ct} style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COST_TYPE_COLORS[ct], flexShrink: 0 }} title={COST_TYPE_NAMES[ct]} />
          ))}
          {item.phase_code_display && (
            <span style={{ fontSize: '0.6rem', color: '#64748b', flexShrink: 0, fontFamily: 'monospace' }}>{item.phase_code_display}</span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, color: '#1e293b', fontSize: '0.7rem' }}>{item.name}</span>
        </div>
      </td>
      {/* Cost Types (read-only) */}
      <td style={{ ...tdBase, textAlign: 'center', fontSize: '0.6rem', color: '#64748b', width: colWidths.ct }}>
        {item.cost_types?.map(ct => COST_TYPE_NAMES[ct]?.charAt(0)).join('')}
      </td>

      {/* === ESTIMATED GROUP === */}
      {/* Est Qty - inline editable (user-entered) */}
      <td style={{ ...tdBase, width: colWidths.estQty }}>
        <input type="number" defaultValue={item.quantity || ''} placeholder="-"
          onBlur={e => {
            const v = e.target.value ? parseFloat(e.target.value) : null;
            if (v !== parseNum(item.quantity)) handleFieldChange('quantity', v);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'right', border: '1px solid transparent' }}
          onFocus={e => { e.target.style.border = '1px solid #3b82f6'; e.target.style.background = '#eff6ff'; }}
          onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
        />
      </td>
      {/* UOM - inline select (user-entered) */}
      <td style={{ ...tdBase, width: colWidths.uom }}>
        <select value={item.quantity_uom || ''} onChange={e => handleFieldChange('quantity_uom', e.target.value || null)}
          style={{ ...inlineCtrl, border: '1px solid transparent' }}>
          <option value="">-</option>
          {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      {/* Est Hrs (read-only from Vista) */}
      <td style={{ ...tdData, width: colWidths.estHrs }}>{fmtHrs(estHrs)}</td>
      {/* Est $ (read-only from Vista) */}
      <td style={{ ...tdData, fontWeight: 500, width: colWidths.estCost }}>{fmtCompact(estCost)}</td>
      {/* Est PI (calculated: qty / est_hours) */}
      <td style={{ ...tdMuted, width: colWidths.estPi, borderRight: '2px solid #e2e8f0' }}>{fmtPi(estQty, estHrs)}</td>

      {/* === JTD GROUP === */}
      {/* %Complete - inline editable (bidirectional with JTD Qty) */}
      <td style={{ ...tdBase, width: colWidths.pctComp }}>
        <input key={`pct-${item.id}-${item.percent_complete}`}
          type="number" defaultValue={parseNum(item.percent_complete) || ''} placeholder="-"
          step="1" min="0" max="100"
          onBlur={e => {
            const v = e.target.value ? parseFloat(e.target.value) : 0;
            if (v !== parseNum(item.percent_complete)) handleFieldChange('percent_complete', v);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'right', border: '1px solid transparent' }}
          onFocus={e => { e.target.style.border = '1px solid #f59e0b'; e.target.style.background = '#fffbeb'; }}
          onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
        />
      </td>
      {/* JTD Qty (quantity_installed - user-entered) */}
      <td style={{ ...tdBase, width: colWidths.jtdQty }}>
        <input key={`qi-${item.id}-${item.quantity_installed}`}
          type="number" defaultValue={item.quantity_installed || ''} placeholder="-"
          onBlur={e => {
            const v = e.target.value ? parseFloat(e.target.value) : null;
            if (v !== parseNum(item.quantity_installed)) handleFieldChange('quantity_installed', v ?? 0);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'right', border: '1px solid transparent' }}
          onFocus={e => { e.target.style.border = '1px solid #f59e0b'; e.target.style.background = '#fffbeb'; }}
          onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
        />
      </td>
      {/* JTD Hrs (read-only from Vista) */}
      <td style={{ ...tdData, width: colWidths.jtdHrs }}>{fmtHrs(jtdHrs)}</td>
      {/* JTD $ (read-only from Vista) */}
      <td style={{ ...tdData, width: colWidths.jtdCost }}>{fmtCompact(jtdCost)}</td>
      {/* JTD PI (calculated: jtd_qty / jtd_hours) */}
      <td style={{ ...tdMuted, width: colWidths.jtdPi, borderRight: '2px solid #e2e8f0' }}>{fmtPi(jtdQty, jtdHrs)}</td>

      {/* === PROJECTED GROUP (all calculated, color-coded vs estimate) === */}
      {/* Proj Qty */}
      <td style={{ ...tdMuted, width: colWidths.projQty }}>
        {projQty > 0 ? projQty.toFixed(0) : '-'}
      </td>
      {/* Proj Hrs - red if over est, green if under */}
      <td style={{ ...tdMuted, width: colWidths.projHrs, color: projHrs > estHrs ? '#ef4444' : projHrs < estHrs ? '#10b981' : '#64748b' }}>
        {fmtHrs(projHrs)}
      </td>
      {/* Proj $ - red if over est, green if under */}
      <td style={{ ...tdData, width: colWidths.projCost, fontWeight: 500, color: projCost > estCost ? '#ef4444' : projCost < estCost ? '#10b981' : '#1e293b' }}>
        {fmtCompact(projCost)}
      </td>
      {/* Proj PI - green if higher than est PI (better), red if lower */}
      <td style={{ ...tdMuted, width: colWidths.projPi, borderRight: '2px solid #e2e8f0', color: (() => { const ePi = estHrs > 0 ? estQty / estHrs : 0; const pPi = projHrs > 0 ? projQty / projHrs : 0; return pPi < ePi ? '#ef4444' : pPi > ePi ? '#10b981' : '#64748b'; })() }}>
        {fmtPi(projQty, projHrs)}
      </td>

      {/* === SCHEDULE GROUP === */}
      {/* Start Date - inline */}
      <td style={{ ...tdBase, textAlign: 'center', width: colWidths.start }}>
        <input type="date" value={fmtDate(item.start_date)}
          onChange={e => handleFieldChange('start_date', e.target.value || null)}
          style={inlineCtrl} />
      </td>
      {/* End Date - inline */}
      <td style={{ ...tdBase, textAlign: 'center', width: colWidths.end }}>
        <input type="date" value={fmtDate(item.end_date)}
          onChange={e => handleFieldChange('end_date', e.target.value || null)}
          style={inlineCtrl} />
      </td>
      {/* Duration - inline editable */}
      <td style={{ ...tdBase, width: colWidths.dur }}>
        <input type="number" defaultValue={dur || ''} min={1} placeholder="-"
          onBlur={e => {
            const v = parseInt(e.target.value) || 0;
            if (v > 0 && v !== dur) handleFieldChange('duration', v);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'center', border: '1px solid transparent' }}
          onFocus={e => { e.target.style.border = '1px solid #3b82f6'; e.target.style.background = '#eff6ff'; }}
          onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
        />
      </td>
      {/* Contour - inline select */}
      <td style={{ ...tdBase, borderRight: '2px solid #e2e8f0', width: colWidths.contour }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <ContourVisual contour={(item.contour_type || 'flat') as ContourType} />
          <select value={item.contour_type || 'flat'} onChange={e => handleFieldChange('contour_type', e.target.value)}
            style={{ ...inlineCtrl, border: '1px solid transparent' }}>
            {contourOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </td>

      {/* Monthly value columns */}
      {months.map(m => {
        const key = format(m, 'yyyy-MM');
        const val = monthlyVals[key] || 0;
        const intensity = maxVal > 0 ? val / maxVal : 0;
        const bgColor = val > 0 ? `rgba(59, 130, 246, ${0.05 + intensity * 0.25})` : 'transparent';
        return (
          <td key={key} style={{ padding: '0.2rem', textAlign: 'right', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', fontSize: '0.63rem', backgroundColor: bgColor, whiteSpace: 'nowrap', width: monthColWidth, color: val > 0 ? '#1e293b' : '#cbd5e1' }}>
            {val > 0 ? (mode === 'cost' ? fmtCompact(val) : val.toFixed(0)) : ''}
          </td>
        );
      })}
    </tr>
  );
});

// ===== BULK DATE ASSIGNMENT =====
const BulkDateBar: React.FC<{
  items: PhaseScheduleItem[];
  onApply: (startDate: string, endDate: string, contour: ContourType, applyTo: 'all' | 'undated') => void;
}> = ({ items, onApply }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contour, setContour] = useState<ContourType>('flat');
  const [applyTo, setApplyTo] = useState<'all' | 'undated'>('undated');
  const [expanded, setExpanded] = useState(false);

  const undatedCount = items.filter(i => !i.start_date || !i.end_date).length;

  return (
    <div className="card" style={{ marginBottom: '1rem', padding: expanded ? '1rem 1.5rem' : '0.6rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {undatedCount > 0 ? (
            <span style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 500 }}>
              {undatedCount} item{undatedCount !== 1 ? 's' : ''} without dates
            </span>
          ) : (
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              Bulk Date Assignment
            </span>
          )}
          {!expanded && (
            <button onClick={() => setExpanded(true)} style={{ padding: '0.3rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.8rem', color: '#1e293b' }}>
              {undatedCount > 0 ? 'Set Bulk Dates' : 'Change Dates'}
            </button>
          )}
        </div>
        {expanded && (
          <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.2rem' }}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.2rem' }}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.2rem' }}>Contour</label>
              <select value={contour} onChange={e => setContour(e.target.value as ContourType)}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }}>
                {contourOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.2rem' }}>Apply To</label>
              <select value={applyTo} onChange={e => setApplyTo(e.target.value as 'all' | 'undated')}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }}>
                <option value="undated">Items without dates ({undatedCount})</option>
                <option value="all">All items ({items.length})</option>
              </select>
            </div>
            <button onClick={() => { if (startDate && endDate) onApply(startDate, endDate, contour, applyTo); }}
              disabled={!startDate || !endDate}
              style={{
                padding: '0.4rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, cursor: startDate && endDate ? 'pointer' : 'default',
                backgroundColor: startDate && endDate ? '#3b82f6' : '#d1d5db', color: 'white'
              }}>
              Apply Dates
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== MAIN PAGE =====
const PhaseSchedule: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'gantt' | 'grid'>('grid');
  const [gridMode, setGridMode] = useState<'cost' | 'qty'>('cost');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PhaseScheduleItem | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = useCallback((costType: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(costType)) next.delete(costType);
      else next.add(costType);
      return next;
    });
  }, []);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
  });

  const { data: phaseCodes = [], isLoading: loadingPhaseCodes } = useQuery({
    queryKey: ['phaseCodes', projectId],
    queryFn: () => phaseScheduleApi.getPhaseCodesByProject(Number(projectId)).then(r => r.data),
  });

  const { data: scheduleItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['phaseScheduleItems', projectId],
    queryFn: () => phaseScheduleApi.getScheduleItems(Number(projectId)).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { projectId: number; phaseCodeIds: number[]; groupBy: string }) => phaseScheduleApi.createItems(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phaseScheduleItems', projectId] });
      setShowAddModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PhaseScheduleItem> }) => phaseScheduleApi.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phaseScheduleItems', projectId] });
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => phaseScheduleApi.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phaseScheduleItems', projectId] });
      setEditingItem(null);
    },
  });

  // Inline update (fire-and-forget, no panel close)
  const handleInlineUpdate = useCallback((id: number, data: Partial<PhaseScheduleItem>) => {
    phaseScheduleApi.updateItem(id, data).then(() => {
      queryClient.invalidateQueries({ queryKey: ['phaseScheduleItems', projectId] });
    });
  }, [projectId, queryClient]);

  const scheduledIds = useMemo(() => {
    const ids = new Set<number>();
    scheduleItems.forEach(item => item.phase_code_ids?.forEach(id => ids.add(id)));
    return ids;
  }, [scheduleItems]);

  const months = useMemo(() => {
    let earliest: Date | null = null;
    let latest: Date | null = null;
    scheduleItems.forEach(item => {
      if (item.start_date) {
        const s = new Date(item.start_date);
        if (!earliest || s < earliest) earliest = s;
      }
      if (item.end_date) {
        const e = new Date(item.end_date);
        if (!latest || e > latest) latest = e;
      }
    });
    if (!earliest || !latest) return [];
    return generateMonths(addMonths(earliest, -1), addMonths(latest, 1));
  }, [scheduleItems]);

  const totalEstCost = useMemo(() => scheduleItems.reduce((s, i) => s + parseNum(i.total_est_cost), 0), [scheduleItems]);
  const totalJtdCost = useMemo(() => scheduleItems.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0), [scheduleItems]);

  const costTypeGroups = useMemo((): CostTypeGroup[] => {
    const groupMap = new Map<number, PhaseScheduleItem[]>();
    scheduleItems.forEach(item => {
      const ct = item.cost_types?.[0] || 1;
      if (!groupMap.has(ct)) groupMap.set(ct, []);
      groupMap.get(ct)!.push(item);
    });
    const groups: CostTypeGroup[] = [];
    for (let ct = 1; ct <= 6; ct++) {
      const items = groupMap.get(ct);
      if (!items || items.length === 0) continue;
      const estQty = items.reduce((s, i) => s + parseNum(i.quantity), 0);
      const estHrs = items.reduce((s, i) => s + parseNum(i.total_est_hours), 0);
      const estCost = items.reduce((s, i) => s + parseNum(i.total_est_cost), 0);
      const jtdQty = items.reduce((s, i) => s + parseNum(i.quantity_installed), 0);
      const jtdHrs = items.reduce((s, i) => s + parseNum(i.total_jtd_hours), 0);
      const jtdCost = items.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0);
      const pctComp = estCost > 0 ? (jtdCost / estCost * 100) : 0;
      const projQty = estQty;
      const projHrs = items.reduce((s, i) => {
        const eQ = parseNum(i.quantity); const jQ = parseNum(i.quantity_installed); const jH = parseNum(i.total_jtd_hours);
        const pi = jQ > 0 && jH > 0 ? jQ / jH : 0;
        return s + (pi > 0 ? eQ / pi : parseNum(i.total_est_hours));
      }, 0);
      const projCost = items.reduce((s, i) => {
        const pct = parseNum(i.percent_complete); const jC = parseNum(i.total_jtd_cost);
        return s + (pct > 0 ? jC / (pct / 100) : parseNum(i.total_est_cost));
      }, 0);
      let earliestStart: string | null = null;
      let latestEnd: string | null = null;
      items.forEach(item => {
        if (item.start_date && (!earliestStart || item.start_date < earliestStart)) earliestStart = item.start_date;
        if (item.end_date && (!latestEnd || item.end_date > latestEnd)) latestEnd = item.end_date;
      });
      groups.push({
        costType: ct, name: COST_TYPE_NAMES[ct], color: COST_TYPE_COLORS[ct],
        items, estQty, estHrs, estCost, jtdQty, jtdHrs, jtdCost, pctComp,
        projQty, projHrs, projCost, earliestStart, latestEnd,
        duration: getDuration(earliestStart, latestEnd)
      });
    }
    return groups;
  }, [scheduleItems]);

  const handleAdd = (ids: number[], groupBy: string) => {
    createMutation.mutate({ projectId: Number(projectId), phaseCodeIds: ids, groupBy });
  };

  const handleSave = (id: number, data: Partial<PhaseScheduleItem>) => {
    updateMutation.mutate({ id, data });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleBulkDates = async (startDate: string, endDate: string, contour: ContourType, applyTo: 'all' | 'undated') => {
    setBulkUpdating(true);
    const targets = applyTo === 'all' ? scheduleItems : scheduleItems.filter(i => !i.start_date || !i.end_date);
    try {
      await Promise.all(targets.map(item =>
        phaseScheduleApi.updateItem(item.id, { start_date: startDate, end_date: endDate, contour_type: contour } as any)
      ));
      queryClient.invalidateQueries({ queryKey: ['phaseScheduleItems', projectId] });
    } catch (err) {
      console.error('Bulk update error:', err);
    } finally {
      setBulkUpdating(false);
    }
  };

  if (loadingPhaseCodes || loadingItems) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Project
            </Link>
            <h1>Phase Schedule</h1>
            <div className="sales-subtitle">{project?.name || 'Project'} - Phase Code Scheduling</div>
          </div>
        </div>
      </div>

      {/* View toggles */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
          <button onClick={() => setViewMode('gantt')} style={{ padding: '0.4rem 0.75rem', border: 'none', backgroundColor: viewMode === 'gantt' ? '#3b82f6' : 'white', color: viewMode === 'gantt' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.8rem' }}>
            Gantt
          </button>
          <button onClick={() => setViewMode('grid')} style={{ padding: '0.4rem 0.75rem', border: 'none', borderLeft: '1px solid #e2e8f0', backgroundColor: viewMode === 'grid' ? '#3b82f6' : 'white', color: viewMode === 'grid' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.8rem' }}>
            Grid
          </button>
        </div>
        {viewMode === 'grid' && (
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <button onClick={() => setGridMode('cost')} style={{ padding: '0.4rem 0.75rem', border: 'none', backgroundColor: gridMode === 'cost' ? '#10b981' : 'white', color: gridMode === 'cost' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.8rem' }}>
              $ Cost
            </button>
            <button onClick={() => setGridMode('qty')} style={{ padding: '0.4rem 0.75rem', border: 'none', borderLeft: '1px solid #e2e8f0', backgroundColor: gridMode === 'qty' ? '#10b981' : 'white', color: gridMode === 'qty' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.8rem' }}>
              Qty
            </button>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          Add Phase Codes
        </button>
      </div>

      {/* Summary bar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Total Est Cost</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{fmt(totalEstCost)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Total JTD Cost</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{fmt(totalJtdCost)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Remaining</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{fmt(totalEstCost - totalJtdCost)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Items Scheduled</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{scheduleItems.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Phase Codes Available</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{phaseCodes.length}</div>
          </div>
        </div>
      </div>

      {/* Bulk date assignment bar */}
      {scheduleItems.length > 0 && (
        <BulkDateBar items={scheduleItems} onApply={handleBulkDates} />
      )}
      {bulkUpdating && (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#3b82f6', fontSize: '0.9rem' }}>
          Updating dates... Please wait.
        </div>
      )}

      {/* Main view */}
      {scheduleItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '1rem' }}>
            No phase codes scheduled yet
          </div>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
            {phaseCodes.length > 0
              ? `${phaseCodes.length} phase codes available from Vista. Click "Add Phase Codes" to start scheduling.`
              : 'Import phase codes via Vista Data Settings to get started.'}
          </div>
          {phaseCodes.length > 0 && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>Add Phase Codes</button>
          )}
        </div>
      ) : (
        viewMode === 'gantt'
          ? <GanttView items={scheduleItems} months={months} onUpdate={handleInlineUpdate} onEdit={setEditingItem} costTypeGroups={costTypeGroups} collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup} />
          : <GridView items={scheduleItems} months={months} mode={gridMode} onUpdate={handleInlineUpdate} onEdit={setEditingItem} costTypeGroups={costTypeGroups} collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup} />
      )}

      {/* Add Phase Codes Modal */}
      {showAddModal && (
        <AddPhaseCodesModal
          phaseCodes={phaseCodes}
          scheduledIds={scheduledIds}
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Panel */}
      {editingItem && (
        <EditItemPanel
          item={editingItem}
          months={months}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};

export default PhaseSchedule;
