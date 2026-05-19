import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, Project } from '../../services/projects';
import { phaseScheduleApi, PhaseCode, PhaseScheduleItem } from '../../services/phaseSchedule';
import { projectLaborRatesApi, ProjectLaborRate } from '../../services/projectLaborRates';
import PhaseGCLinkChips, { UnlinkAllButton } from '../../components/phaseSchedule/PhaseGCLinkChips';
import { ContourType, contourOptions, getContourMultipliers, ContourVisual } from '../../utils/contours';
import { format, addMonths, addDays, addWeeks, addQuarters, startOfMonth, startOfWeek, startOfQuarter, getQuarter, differenceInMonths, differenceInCalendarDays, startOfDay, eachDayOfInterval, isWeekend } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Cost type constants
const COST_TYPE_NAMES: Record<number, string> = {
  1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions'
};
const COST_TYPE_COLORS: Record<number, string> = {
  1: '#3b82f6', 2: '#10b981', 3: '#f59e0b', 4: '#8b5cf6', 5: '#ef4444', 6: '#6b7280'
};
const UOM_OPTIONS = ['EA', 'LF', 'LS'];

// Column definitions for hide/unhide feature
interface ColumnDef { key: string; label: string; group?: string; hideable: boolean; }

const GANTT_COLUMN_DEFS: ColumnDef[] = [
  { key: 'rowNum', label: 'ID', hideable: false },
  { key: 'phase', label: 'Phase Code', hideable: false },
  { key: 'ct', label: 'CT', hideable: true },
  { key: 'estHrs', label: 'Est Hrs', hideable: true },
  { key: 'estCost', label: 'Est $', hideable: true },
  { key: 'start', label: 'Start', hideable: true },
  { key: 'end', label: 'End', hideable: true },
  { key: 'dur', label: 'Duration', hideable: true },
  { key: 'pred', label: 'Predecessor', hideable: true },
  { key: 'contour', label: 'Contour', hideable: true },
];

const GRID_COLUMN_DEFS: ColumnDef[] = [
  { key: 'sel', label: '', group: '', hideable: false },
  { key: 'rowNum', label: 'ID', group: '', hideable: false },
  { key: 'phase', label: 'Phase', group: '', hideable: false },
  { key: 'ct', label: 'CT', group: '', hideable: true },
  { key: 'estQty', label: 'Qty', group: 'Estimated', hideable: true },
  { key: 'uom', label: 'UOM', group: 'Estimated', hideable: true },
  { key: 'estHrs', label: 'Hrs', group: 'Estimated', hideable: true },
  { key: 'estCost', label: 'Cost', group: 'Estimated', hideable: true },
  { key: 'estPi', label: 'PI', group: 'Estimated', hideable: true },
  { key: 'pctComp', label: '%Comp', group: 'JTD', hideable: true },
  { key: 'jtdQty', label: 'Qty', group: 'JTD', hideable: true },
  { key: 'jtdHrs', label: 'Hrs', group: 'JTD', hideable: true },
  { key: 'jtdCost', label: 'Cost', group: 'JTD', hideable: true },
  { key: 'jtdPi', label: 'PI', group: 'JTD', hideable: true },
  { key: 'projQty', label: 'Qty', group: 'Projected', hideable: true },
  { key: 'projHrs', label: 'Hrs', group: 'Projected', hideable: true },
  { key: 'projCostField', label: 'Cost (Field)', group: 'Projected', hideable: true },
  { key: 'projCostVista', label: 'Cost (Vista)', group: 'Projected', hideable: true },
  { key: 'projPi', label: 'PI', group: 'Projected', hideable: true },
  { key: 'remQty', label: 'Qty', group: 'Remaining', hideable: true },
  { key: 'remHrs', label: 'Hrs', group: 'Remaining', hideable: true },
  { key: 'remCost', label: 'Cost', group: 'Remaining', hideable: true },
  { key: 'rate', label: 'Rate', group: 'Billing', hideable: true },
  { key: 'start', label: 'Start', group: 'Schedule', hideable: true },
  { key: 'end', label: 'End', group: 'Schedule', hideable: true },
  { key: 'dur', label: 'Days', group: 'Schedule', hideable: true },
  { key: 'pred', label: 'Pred', group: 'Schedule', hideable: true },
  { key: 'contour', label: 'Contour', group: 'Schedule', hideable: true },
];

// Column context menu (right-click on header)
const ColumnContextMenu: React.FC<{
  x: number; y: number; colKey: string; colLabel: string;
  onHide: () => void; onChooser: () => void; onClose: () => void;
}> = ({ x, y, colLabel, onHide, onChooser, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'fixed', left: x, top: y, zIndex: 9999, background: 'white',
      border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: '160px', padding: '4px 0', fontSize: '0.8rem'
    }}>
      <div onClick={() => { onHide(); onClose(); }}
        style={{ padding: '6px 14px', cursor: 'pointer', color: '#1e293b' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
        Hide "{colLabel}"
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} />
      <div onClick={() => { onChooser(); onClose(); }}
        style={{ padding: '6px 14px', cursor: 'pointer', color: '#1e293b' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
        Column Chooser...
      </div>
    </div>
  );
};

// Column chooser dialog (shows hidden columns with checkboxes)
const ColumnChooserDialog: React.FC<{
  columnDefs: ColumnDef[];
  hiddenCols: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onClose: () => void;
}> = ({ columnDefs, hiddenCols, onToggle, onShowAll, onClose }) => {
  const hideableCols = columnDefs.filter(c => c.hideable);
  const groups = [...new Set(hideableCols.map(c => c.group).filter(Boolean))];
  const ungrouped = hideableCols.filter(c => !c.group);

  const renderCol = (col: ColumnDef) => (
    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '0.82rem' }}>
      <input type="checkbox" checked={!hiddenCols.has(col.key)} onChange={() => onToggle(col.key)} style={{ cursor: 'pointer' }} />
      <span style={{ color: hiddenCols.has(col.key) ? '#94a3b8' : '#1e293b' }}>{col.group ? `${col.label} (${col.group})` : col.label}</span>
    </label>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: 'white', borderRadius: '10px', width: '340px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>Column Chooser</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem 1.25rem' }}>
          {hiddenCols.size > 0 && (
            <button onClick={onShowAll} style={{
              marginBottom: '0.75rem', padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0',
              borderRadius: '5px', backgroundColor: '#f8fafc', cursor: 'pointer', fontSize: '0.78rem', color: '#3b82f6', fontWeight: 500
            }}>
              Show All Columns
            </button>
          )}
          {ungrouped.map(renderCol)}
          {groups.map(group => (
            <div key={group} style={{ marginTop: ungrouped.length > 0 || groups.indexOf(group!) > 0 ? '0.5rem' : 0 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{group}</div>
              {hideableCols.filter(c => c.group === group).map(renderCol)}
            </div>
          ))}
        </div>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '0.4rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>Close</button>
        </div>
      </div>
    </div>
  );
};

// CT multi-select filter dropdown
const CTFilterDropdown: React.FC<{
  selected: Set<number>;
  onToggle: (ct: number) => void;
  onClear: () => void;
  style?: React.CSSProperties;
}> = ({ selected, onToggle, onClear, style }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 2, left: r.left + r.width / 2 });
    };
    updatePos();
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  const active = selected.size > 0;
  const label = active
    ? [...selected].sort().map(ct => COST_TYPE_NAMES[ct]?.charAt(0)).join('')
    : 'CT ▾';

  return (
    <div ref={triggerRef} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <div onClick={() => setOpen(prev => !prev)}
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
          color: active ? '#3b82f6' : 'inherit', userSelect: 'none'
        }}>
        {label}
      </div>
      {open && menuPos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-50%)',
          zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '160px', padding: '4px 0', fontSize: '0.75rem', whiteSpace: 'nowrap'
        }}>
          {active && (
            <>
              <div onClick={() => { onClear(); setOpen(false); }}
                style={{ padding: '4px 10px', cursor: 'pointer', color: '#ef4444', fontSize: '0.7rem' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
                Clear filter
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} />
            </>
          )}
          {[1, 2, 3, 4, 5, 6].map(ct => (
            <label key={ct}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
              <input type="checkbox" checked={selected.has(ct)} onChange={() => onToggle(ct)} style={{ cursor: 'pointer' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COST_TYPE_COLORS[ct], flexShrink: 0 }} />
              <span style={{ color: '#1e293b' }}>{COST_TYPE_NAMES[ct]}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

// Phase prefix multi-select filter dropdown (first chunk before "-", e.g. "30")
const PrefixFilterDropdown: React.FC<{
  available: string[];
  selected: Set<string>;
  onToggle: (prefix: string) => void;
  onClear: () => void;
}> = ({ available, selected, onToggle, onClear }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 2, left: r.left });
    };
    updatePos();
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  const active = selected.size > 0;
  const allSelected = available.length > 0 && available.every(p => selected.has(p));
  const handleSelectAll = () => {
    if (allSelected) {
      onClear();
    } else {
      // Toggle on any prefix not already in the set
      available.forEach(p => { if (!selected.has(p)) onToggle(p); });
    }
  };
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(prev => !prev)}
        title="Filter by phase prefix"
        style={{
          background: active ? '#dbeafe' : 'none', border: active ? '1px solid #3b82f6' : 'none',
          cursor: 'pointer', padding: '0 3px', fontSize: '0.65rem',
          color: active ? '#3b82f6' : '#94a3b8', lineHeight: 1, flexShrink: 0,
          fontWeight: active ? 700 : 400, borderRadius: '3px'
        }}>
        {active ? `${selected.size}▾` : '⌕▾'}
      </button>
      {open && menuPos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: menuPos.top, left: menuPos.left,
          zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '140px', maxHeight: '320px', overflow: 'auto',
          padding: '4px 0', fontSize: '0.75rem'
        }}>
          {available.length > 0 && (
            <>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
                <input type="checkbox" checked={allSelected} onChange={handleSelectAll} style={{ cursor: 'pointer' }} />
                <span style={{ color: '#1e293b' }}>Select all</span>
              </label>
              <div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} />
            </>
          )}
          {active && (
            <>
              <div onClick={() => { onClear(); setOpen(false); }}
                style={{ padding: '4px 10px', cursor: 'pointer', color: '#ef4444', fontSize: '0.7rem' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
                Clear filter
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} />
            </>
          )}
          {available.length === 0 && (
            <div style={{ padding: '6px 10px', color: '#94a3b8', fontStyle: 'italic' }}>No phases</div>
          )}
          {available.map(prefix => (
            <label key={prefix}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
              <input type="checkbox" checked={selected.has(prefix)} onChange={() => onToggle(prefix)} style={{ cursor: 'pointer' }} />
              <span style={{ color: '#1e293b', fontFamily: 'monospace' }}>{prefix}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

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
  projCostField: number;
  projCostVista: number;
  remQty: number;
  remHrs: number;
  remCost: number;
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
// Parse a YYYY-MM-DD or full-ISO string as local-midnight Date (avoids UTC shift)
const ymdToDate = (d: string | null | undefined): Date | null => {
  if (!d) return null;
  return new Date(d.substring(0, 10) + 'T00:00:00');
};
// Short date display: MM/dd/yy
const fmtDateShort = (d: string | null | undefined): string => {
  const dt = ymdToDate(d);
  if (!dt) return '';
  try { return format(dt, 'MM/dd/yy'); } catch { return ''; }
};

// Compute duration in calendar days between two dates (inclusive)
const getDuration = (start: string | null, end: string | null): number => {
  const s = ymdToDate(start), e = ymdToDate(end);
  if (!s || !e) return 0;
  return differenceInCalendarDays(e, s) + 1;
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

// Period zoom for the monthly-distribution columns. Week starts Monday.
const PERIOD_OPTIONS = ['week', 'month', 'quarter'] as const;
type Period = typeof PERIOD_OPTIONS[number];

const startOfPeriod = (d: Date, period: Period): Date => {
  if (period === 'week') return startOfWeek(d, { weekStartsOn: 1 });
  if (period === 'quarter') return startOfQuarter(d);
  return startOfMonth(d);
};
const addPeriod = (d: Date, n: number, period: Period): Date => {
  if (period === 'week') return addWeeks(d, n);
  if (period === 'quarter') return addQuarters(d, n);
  return addMonths(d, n);
};
const periodKey = (d: Date, period: Period): string => {
  if (period === 'week') return format(d, "yyyy-'W'") + format(d, 'MM-dd');
  if (period === 'quarter') return `${format(d, 'yyyy')}-Q${getQuarter(d)}`;
  return format(d, 'yyyy-MM');
};
const periodLabel = (d: Date, period: Period): string => {
  if (period === 'week') return format(d, 'MMM d');
  if (period === 'quarter') return `Q${getQuarter(d)} ${format(d, 'yy')}`;
  return format(d, 'MMM yy');
};
const generatePeriods = (start: Date, end: Date, period: Period): Date[] => {
  const out: Date[] = [];
  let current = startOfPeriod(start, period);
  const last = startOfPeriod(end, period);
  while (current <= last) {
    out.push(current);
    current = addPeriod(current, 1, period);
  }
  return out;
};

// Shift definitions for manpower mode. Hours/month uses 52/12 weeks per month;
// weeks and quarters derive from the same days/week × hours/day base.
const SHIFT_OPTIONS = ['5/8', '5/10', '6/8', '6/10'] as const;
type ShiftKey = typeof SHIFT_OPTIONS[number];
const SHIFT_BASE: Record<ShiftKey, { days: number; hours: number }> = {
  '5/8':  { days: 5, hours: 8 },
  '5/10': { days: 5, hours: 10 },
  '6/8':  { days: 6, hours: 8 },
  '6/10': { days: 6, hours: 10 },
};
const hoursPerWorkerPerPeriod = (shift: ShiftKey, period: Period): number => {
  const { days, hours } = SHIFT_BASE[shift];
  const perWeek = days * hours;
  if (period === 'week') return perWeek;
  if (period === 'quarter') return perWeek * 13;     // 52 weeks / 4 quarters
  return perWeek * 52 / 12;                          // monthly average
};
const SHIFT_HRS_PER_MONTH: Record<string, number> = {
  '5/8':  hoursPerWorkerPerPeriod('5/8',  'month'),  // 173.33
  '5/10': hoursPerWorkerPerPeriod('5/10', 'month'),  // 216.67
  '6/8':  hoursPerWorkerPerPeriod('6/8',  'month'),  // 208
  '6/10': hoursPerWorkerPerPeriod('6/10', 'month'),  // 260
};
type GridMode = 'cost' | 'qty' | 'manpower' | 'billable';

// Maps a project's per-cost-type markup % onto a lookup keyed by cost type number.
// CT 1 (Labor) is the cost-plus fallback for labor lines with no rate assigned.
const buildMarkupByCt = (project: Project | undefined): Record<number, number> => ({
  1: project?.billing_markup_labor     ? Number(project.billing_markup_labor)     : 0,
  2: project?.billing_markup_material  ? Number(project.billing_markup_material)  : 0,
  3: project?.billing_markup_subs      ? Number(project.billing_markup_subs)      : 0,
  4: project?.billing_markup_rentals   ? Number(project.billing_markup_rentals)   : 0,
  5: project?.billing_markup_equipment ? Number(project.billing_markup_equipment) : 0,
  6: project?.billing_markup_genconds  ? Number(project.billing_markup_genconds)  : 0,
});

// Helper: projected hours for a line, mirroring the GridRow formula.
const computeProjHrs = (item: PhaseScheduleItem): number => {
  const estQty = parseNum(item.quantity);
  const jtdQty = parseNum(item.quantity_installed);
  const jtdHrs = parseNum(item.total_jtd_hours);
  const estHrs = parseNum(item.total_est_hours);
  const jtdPi = jtdQty > 0 && jtdHrs > 0 ? jtdQty / jtdHrs : 0;
  return jtdPi > 0 ? Math.max(estQty / jtdPi, jtdHrs) : jtdHrs > estHrs ? jtdHrs : estHrs;
};

// Compute distribution for an item across the chosen period buckets (week/month/quarter).
const computeMonthlyValues = (
  item: PhaseScheduleItem,
  periods: Date[],
  mode: GridMode,
  hoursPerWorker: number = SHIFT_HRS_PER_MONTH['5/8'],
  laborRateById?: Map<number, number>,
  markupByCt?: Record<number, number>,
  period: Period = 'month'
): Record<string, number> => {
  const values: Record<string, number> = {};
  if (!item.start_date || !item.end_date) return values;

  if ((mode === 'cost' || mode === 'qty') && period === 'month') {
    // Manual overrides are stored at month granularity; only honor them in monthly view.
    const useManual = mode === 'cost' ? item.use_manual_values : item.use_manual_qty_values;
    const manualValues = mode === 'cost' ? item.manual_monthly_values : item.manual_monthly_qty;
    if (useManual && manualValues) return manualValues;
  }

  let total: number;
  if (mode === 'cost') {
    total = parseNum(item.total_projected_cost) - parseNum(item.total_jtd_cost);
  } else if (mode === 'qty') {
    total = parseNum(item.quantity) - parseNum(item.quantity_installed);
  } else if (mode === 'manpower') {
    // Distribute Remaining Hours (projHrs − jtdHrs); converted to workers below.
    const jtdHrs = parseNum(item.total_jtd_hours);
    total = Math.max(0, computeProjHrs(item) - jtdHrs);
  } else {
    // Billable:
    //   Labor (CT 1): if a rate is assigned, Remaining Hours × rate.
    //                 Otherwise fall back to Remaining Cost × (1 + labor markup%)
    //                 — supports cost-plus contracts where labor is billed at
    //                 cost + markup instead of a separate billable rate.
    //   Non-labor (CT 2-6): Remaining Cost × (1 + markup%).
    const ct = item.cost_types?.[0] || 0;
    if (ct === 1 && item.billable_rate_id && laborRateById) {
      const rate = laborRateById.get(item.billable_rate_id) || 0;
      if (rate <= 0) return values;
      const jtdHrs = parseNum(item.total_jtd_hours);
      const remHrs = Math.max(0, computeProjHrs(item) - jtdHrs);
      total = remHrs * rate;
    } else {
      const markupPct = markupByCt ? markupByCt[ct] || 0 : 0;
      const vPC = parseNum(item.total_projected_cost);
      if (vPC <= 0) return values;
      const remCost = Math.max(0, vPC - parseNum(item.total_jtd_cost));
      total = remCost * (1 + markupPct / 100);
    }
  }

  if (total <= 0) return values;

  const startDate = startOfPeriod(ymdToDate(item.start_date)!, period);
  const endDate = startOfPeriod(ymdToDate(item.end_date)!, period);

  const itemPeriods = periods.filter(p => p >= startDate && p <= endDate);
  if (itemPeriods.length === 0) return values;

  const multipliers = getContourMultipliers(itemPeriods.length, (item.contour_type || 'flat') as ContourType);
  const perPeriod = total / itemPeriods.length;

  itemPeriods.forEach((p, i) => {
    const key = periodKey(p, period);
    const v = perPeriod * multipliers[i];
    values[key] = mode === 'manpower' ? v / hoursPerWorker : v;
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

  const available = phaseCodes.filter(pc => {
    const ids = pc.all_ids || [pc.id];
    return !ids.some(id => scheduledIds.has(id));
  });
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
          <button onClick={() => {
              // Expand selected IDs to include all underlying vp_phase_codes IDs (for multi-job dedup)
              const expandedIds: number[] = [];
              selected.forEach(selId => {
                const pc = phaseCodes.find(p => p.id === selId);
                if (pc?.all_ids && pc.all_ids.length > 0) {
                  pc.all_ids.forEach(aid => { if (!expandedIds.includes(aid)) expandedIds.push(aid); });
                } else {
                  if (!expandedIds.includes(selId)) expandedIds.push(selId);
                }
              });
              onAdd(expandedIds, groupBy);
            }} disabled={selected.size === 0}
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
  projectId: number;
  onSave: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}> = ({ item, months, projectId, onSave, onDelete, onClose }) => {
  const { confirm } = useTitanFeedback();
  const [name, setName] = useState(item.name);
  const [startDate, setStartDate] = useState(fmtDate(item.start_date));
  const [endDate, setEndDate] = useState(fmtDate(item.end_date));
  const dateLocked = (item.linked_resolved_count || 0) > 0;
  const [contour, setContour] = useState<ContourType>((item.contour_type || 'flat') as ContourType);
  const [useManual, setUseManual] = useState(item.use_manual_values || false);
  const [manualValues, setManualValues] = useState<Record<string, number>>(item.manual_monthly_values || {});
  const [quantity, setQuantity] = useState<string>(item.quantity?.toString() || '');
  const [uom, setUom] = useState(item.quantity_uom || '');
  const [qtyInstalled, setQtyInstalled] = useState<string>(item.quantity_installed?.toString() || '0');
  const [useManualQty, setUseManualQty] = useState(item.use_manual_qty_values || false);
  const [manualQty, setManualQty] = useState<Record<string, number>>(item.manual_monthly_qty || {});

  const handleSave = () => {
    const payload: any = {
      name,
      contour_type: contour,
      use_manual_values: useManual,
      manual_monthly_values: useManual ? manualValues : null,
      quantity: quantity ? parseFloat(quantity) : null,
      quantity_uom: uom || null,
      quantity_installed: parseFloat(qtyInstalled) || 0,
      use_manual_qty_values: useManualQty,
      manual_monthly_qty: useManualQty ? manualQty : null,
    };
    if (!dateLocked) {
      payload.start_date = startDate || null;
      payload.end_date = endDate || null;
    }
    onSave(item.id, payload);
  };

  const itemMonths = useMemo(() => {
    if (!startDate || !endDate) return [];
    return generateMonths(startOfMonth(ymdToDate(startDate)!), startOfMonth(ymdToDate(endDate)!));
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

        <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', backgroundColor: dateLocked ? '#ecfeff' : '#f8fafc', borderRadius: 6, border: `1px solid ${dateLocked ? '#a5f3fc' : '#e2e8f0'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b' }}>
              {dateLocked ? '🔗 GC-Linked Activities' : 'GC Schedule Link'}
            </label>
          </div>
          <PhaseGCLinkChips item={item} projectId={projectId} />
          {dateLocked && (
            <div style={{ fontSize: '0.65rem', color: '#0e7490', marginTop: 4 }}>
              Dates below are driven by the linked GC activities — unlink to edit manually.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>Start Date</label>
            <input type="date" value={dateLocked ? fmtDate(item.start_date) : startDate} onChange={e => setStartDate(e.target.value)} disabled={dateLocked}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box', background: dateLocked ? '#f1f5f9' : undefined, color: dateLocked ? '#475569' : undefined }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>End Date</label>
            <input type="date" value={dateLocked ? fmtDate(item.end_date) : endDate} onChange={e => setEndDate(e.target.value)} disabled={dateLocked}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box', background: dateLocked ? '#f1f5f9' : undefined, color: dateLocked ? '#475569' : undefined }} />
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
        <button onClick={async () => { const ok = await confirm({ message: 'Delete this schedule item?', danger: true }); if (ok) onDelete(item.id); }}
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
  allItems: PhaseScheduleItem[];
  months: Date[];
  projectId: number;
  onUpdate: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onEdit: (item: PhaseScheduleItem) => void;
  costTypeGroups: CostTypeGroup[];
  collapsedGroups: Set<number>;
  onToggleGroup: (costType: number) => void;
  selectedItems: Set<number>;
  onToggleItem: (itemId: number) => void;
  onToggleGroupSelection: (costType: number) => void;
  onToggleAll: () => void;
  filterText: string;
  onFilterChange: (text: string) => void;
  sortDir: 'none' | 'asc' | 'desc';
  onSortChange: () => void;
  ctFilter: Set<number>;
  onCtFilterToggle: (ct: number) => void;
  onCtFilterClear: () => void;
  availablePrefixes: string[];
  prefixFilter: Set<string>;
  onPrefixFilterToggle: (prefix: string) => void;
  onPrefixFilterClear: () => void;
}> = ({ items, allItems, months, projectId, onUpdate, onEdit, costTypeGroups, collapsedGroups, onToggleGroup, selectedItems, onToggleItem, onToggleGroupSelection, onToggleAll, filterText, onFilterChange, sortDir, onSortChange, ctFilter, onCtFilterToggle, onCtFilterClear, availablePrefixes, prefixFilter, onPrefixFilterToggle, onPrefixFilterClear }) => {
  const ganttRef = useRef<HTMLDivElement>(null);
  const colWidth = 80;
  const rowHeight = 28;
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    try { const saved = localStorage.getItem('phaseSchedule_ganttPanelW'); return saved ? parseInt(saved) : 670; }
    catch { return 670; }
  });
  useEffect(() => { localStorage.setItem('phaseSchedule_ganttPanelW', String(leftPanelWidth)); }, [leftPanelWidth]);
  const draggingRef = useRef<{ startX: number; startW: number } | null>(null);
  const today = startOfDay(new Date());

  // Gantt column widths (persisted to localStorage)
  const ganttColDefaults = { sel: 28, rowNum: 32, gcLink: 120, phase: 220, ct: 32, estHrs: 56, estCost: 78, start: 90, end: 90, dur: 44, pred: 44, contour: 62 };
  const [ganttCols, setGanttCols] = useState<typeof ganttColDefaults>(() => {
    try {
      const saved = localStorage.getItem('phaseSchedule_ganttCols');
      if (!saved) return ganttColDefaults;
      const parsed = JSON.parse(saved);
      if (!localStorage.getItem('phaseSchedule_gantt_gcLink_reset')) {
        delete parsed.gcLink;
        localStorage.setItem('phaseSchedule_gantt_gcLink_reset', '1');
      }
      return { ...ganttColDefaults, ...parsed };
    }
    catch { return ganttColDefaults; }
  });
  const ganttColsRef = useRef(ganttCols);
  useEffect(() => { localStorage.setItem('phaseSchedule_ganttCols', JSON.stringify(ganttCols)); }, [ganttCols]);
  const colResizeRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  // Bar drag-to-move state
  const barDragRef = useRef<{
    itemId: number;
    startMouseX: number;
    originalBarLeft: number;
    originalStartDate: Date;
    originalEndDate: Date;
    durationDays: number;
    dragStarted: boolean;
  } | null>(null);
  const dragOccurredRef = useRef(false);
  const [barDragOffset, setBarDragOffset] = useState<{ itemId: number; deltaX: number } | null>(null);

  // Bar resize state (drag left/right edge to change start/end date)
  const barResizeRef = useRef<{
    itemId: number;
    edge: 'left' | 'right';
    startMouseX: number;
    originalBarLeft: number;
    originalBarWidth: number;
    originalStartDate: Date;
    originalEndDate: Date;
    dragStarted: boolean;
  } | null>(null);
  const [barResizeOffset, setBarResizeOffset] = useState<{ itemId: number; edge: 'left' | 'right'; deltaX: number } | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Hidden columns state
  const [ganttHiddenCols, setGanttHiddenCols] = useState<Set<string>>(new Set());
  const [ganttContextMenu, setGanttContextMenu] = useState<{ x: number; y: number; key: string; label: string } | null>(null);
  const [showGanttChooser, setShowGanttChooser] = useState(false);
  const gh = (col: string) => ganttHiddenCols.has(col); // shorthand for hidden check

  const toggleGanttCol = (key: string) => {
    setGanttHiddenCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const ganttHeaderContextMenu = (e: React.MouseEvent, key: string, label: string) => {
    const def = GANTT_COLUMN_DEFS.find(c => c.key === key);
    if (!def?.hideable) return;
    e.preventDefault();
    setGanttContextMenu({ x: e.clientX, y: e.clientY, key, label });
  };

  // Column resize + panel resize + bar drag in one handler
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const diff = e.clientX - draggingRef.current.startX;
        setLeftPanelWidth(Math.max(200, Math.min(1600, draggingRef.current.startW + diff)));
      }
      if (colResizeRef.current) {
        const r = colResizeRef.current;
        const diff = e.clientX - r.startX;
        const newW = Math.max(28, r.startW + diff);
        const actualDiff = newW - ((ganttColsRef.current as any)[r.col] || r.startW);
        setGanttCols(prev => {
          ganttColsRef.current = { ...prev, [r.col]: newW };
          return ganttColsRef.current;
        });
        if (actualDiff !== 0) setLeftPanelWidth(prev => Math.max(200, prev + actualDiff));
      }
      if (barDragRef.current) {
        const drag = barDragRef.current;
        const deltaX = e.clientX - drag.startMouseX;
        if (!drag.dragStarted) {
          if (Math.abs(deltaX) < 4) return;
          drag.dragStarted = true;
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }
        setBarDragOffset({ itemId: drag.itemId, deltaX });
      }
      if (barResizeRef.current) {
        const r = barResizeRef.current;
        const deltaX = e.clientX - r.startMouseX;
        if (!r.dragStarted) {
          if (Math.abs(deltaX) < 4) return;
          r.dragStarted = true;
          document.body.style.cursor = r.edge === 'right' ? 'e-resize' : 'w-resize';
          document.body.style.userSelect = 'none';
        }
        setBarResizeOffset({ itemId: r.itemId, edge: r.edge, deltaX });
      }
    };
    const onUp = (e: MouseEvent) => {
      if (barDragRef.current && barDragRef.current.dragStarted) {
        const drag = barDragRef.current;
        const deltaX = e.clientX - drag.startMouseX;
        const newBarLeft = drag.originalBarLeft + deltaX;
        const newStartDate = xToDateRef.current(newBarLeft);
        const newEndDate = addDays(newStartDate, drag.durationDays);
        onUpdateRef.current(drag.itemId, {
          start_date: format(newStartDate, 'yyyy-MM-dd'),
          end_date: format(newEndDate, 'yyyy-MM-dd'),
        } as any);
        dragOccurredRef.current = true;
      }
      if (barResizeRef.current && barResizeRef.current.dragStarted) {
        const r = barResizeRef.current;
        const deltaX = e.clientX - r.startMouseX;
        if (r.edge === 'left') {
          const newBarLeft = r.originalBarLeft + deltaX;
          const newStartDate = xToDateRef.current(newBarLeft);
          if (newStartDate < r.originalEndDate) {
            onUpdateRef.current(r.itemId, { start_date: format(newStartDate, 'yyyy-MM-dd') } as any);
          }
        } else {
          const newBarRight = r.originalBarLeft + r.originalBarWidth + deltaX;
          const newEndDate = xToDateRef.current(newBarRight);
          if (newEndDate > r.originalStartDate) {
            onUpdateRef.current(r.itemId, { end_date: format(newEndDate, 'yyyy-MM-dd') } as any);
          }
        }
        dragOccurredRef.current = true;
      }
      barDragRef.current = null;
      setBarDragOffset(null);
      barResizeRef.current = null;
      setBarResizeOffset(null);
      draggingRef.current = null;
      colResizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startColResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    colResizeRef.current = { col, startX: e.clientX, startW: (ganttCols as any)[col] || 60 };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const autofitGanttCol = (col: string) => {
    // Note: canvas doesn't support rem units, so convert to px (0.68rem ≈ 11px at 16px base)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let maxW = 36;
    // Header text widths
    const headers: Record<string, string> = { rowNum: 'ID', phase: 'Phase Code', ct: 'CT', estHrs: 'Est Hrs', estCost: 'Est $', start: 'Start', end: 'End', dur: 'Dur', pred: 'Pred', contour: 'Contour' };
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    maxW = Math.max(maxW, ctx.measureText(headers[col] || '').width + 24);
    // Measure cell content from items
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    items.forEach(item => {
      let text = '';
      switch (col) {
        case 'rowNum': text = String(item.row_number || ''); break;
        case 'phase': text = `${item.phase_code_display || ''} - ${item.name || ''}`; break;
        case 'ct': text = item.cost_types?.map(ct => COST_TYPE_NAMES[ct]?.charAt(0)).join('') || ''; break;
        case 'estHrs': text = fmtHrs(parseNum(item.total_est_hours)); break;
        case 'estCost': text = fmtCompact(parseNum(item.total_est_cost)); break;
        case 'start': text = fmtDateShort(item.start_date); break;
        case 'end': text = fmtDateShort(item.end_date); break;
        case 'dur': { const d = getDuration(item.start_date, item.end_date); text = d > 0 ? String(d) : ''; break; }
        case 'pred': text = item.predecessor_id ? String(item.predecessor_id) : ''; break;
        case 'contour': text = item.contour_type || 'flat'; break;
      }
      if (text && text !== '-') {
        const padding = col === 'phase' ? 40 : 20; // phase has color dots + gap
        maxW = Math.max(maxW, ctx.measureText(text).width + padding);
      }
    });
    maxW = Math.min(Math.ceil(maxW), 500);
    setGanttCols(prev => {
      const next = { ...prev, [col]: maxW };
      ganttColsRef.current = next;
      return next;
    });
  };

  const ganttDblClickRef = useRef<{ col: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const handleGanttResizeMouseDown = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (ganttDblClickRef.current && ganttDblClickRef.current.col === col) {
      clearTimeout(ganttDblClickRef.current.timer);
      ganttDblClickRef.current = null;
      colResizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      autofitGanttCol(col);
      return;
    }
    startColResize(col, e);
    ganttDblClickRef.current = {
      col,
      timer: setTimeout(() => { ganttDblClickRef.current = null; }, 300)
    };
  };

  const ganttResizeHandle = (col: string) => (
    <div onMouseDown={e => handleGanttResizeMouseDown(col, e)}
      style={{ position: 'absolute', right: -1, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', zIndex: 1 }}
      onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = 'rgba(59,130,246,0.25)'; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    />
  );

  const firstMonth = months.length > 0 ? months[0] : null;
  const totalWidth = months.length * colWidth;
  const todayOffset = firstMonth ? differenceInCalendarDays(today, firstMonth) / 30.44 * colWidth : 0;

  // Day-level pixel position for a date within the monthly column grid
  const dateToX = (date: Date): number => {
    if (!firstMonth) return 0;
    const monthStart = startOfMonth(date);
    const monthIndex = differenceInMonths(monthStart, firstMonth);
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const dayFraction = (date.getDate() - 1) / daysInMonth;
    return monthIndex * colWidth + dayFraction * colWidth;
  };

  // Inverse of dateToX — convert pixel X offset back to a calendar date
  const xToDate = (x: number): Date => {
    if (!firstMonth) return new Date();
    const monthIndex = Math.floor(x / colWidth);
    const remainder = x - monthIndex * colWidth;
    const targetMonth = addMonths(firstMonth, monthIndex);
    const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    const day = Math.round((remainder / colWidth) * daysInMonth) + 1;
    const clampedDay = Math.max(1, Math.min(day, daysInMonth));
    return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), clampedDay);
  };
  const xToDateRef = useRef(xToDate);
  xToDateRef.current = xToDate;

  return (
    <div style={{ display: 'flex', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
      {/* Left panel - task list grid */}
      <div style={{ width: leftPanelWidth, flexShrink: 0, overflow: 'auto' }}>
        <div style={{ height: '28px', borderBottom: '1px solid #94a3b8', display: 'flex', alignItems: 'center', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b', background: '#eef2f7' }}>
          <div style={{ width: ganttCols.sel, textAlign: 'center', flexShrink: 0, borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input type="checkbox" checked={selectedItems.size === items.length && items.length > 0}
              onChange={onToggleAll} style={{ cursor: 'pointer' }} title="Select all" />
          </div>
          <div style={{ width: ganttCols.rowNum, textAlign: 'center', padding: '0 0.15rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>ID{ganttResizeHandle('rowNum')}</div>
          <div style={{ width: ganttCols.gcLink, textAlign: 'center', padding: '0 0.15rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1', fontSize: '0.62rem' }}>Link{ganttResizeHandle('gcLink')}</div>
          <div style={{ width: ganttCols.phase, minWidth: 0, padding: '0 0.4rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
              <input type="text" value={filterText} onChange={e => onFilterChange(e.target.value)}
                placeholder="Filter prefix (* = wildcard)" title="Type a phase prefix (e.g. 30) or use * as wildcard (e.g. *labor*, 30*010)" style={{
                  flex: 1, padding: '0.15rem 0.3rem', fontSize: '0.65rem', border: '1px solid #e2e8f0',
                  borderRadius: '3px', background: filterText ? '#fffbeb' : '#fff', color: '#1e293b',
                  outline: 'none', minWidth: 0, fontWeight: 400
                }} />
              {filterText && (
                <button onClick={() => onFilterChange('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1
                }}>&times;</button>
              )}
              <PrefixFilterDropdown available={availablePrefixes} selected={prefixFilter}
                onToggle={onPrefixFilterToggle} onClear={onPrefixFilterClear} />
              <button onClick={onSortChange} title={sortDir === 'none' ? 'Sort A-Z' : sortDir === 'asc' ? 'Sort Z-A' : 'Clear sort'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
                  fontSize: '0.65rem', color: sortDir !== 'none' ? '#3b82f6' : '#94a3b8', lineHeight: 1, flexShrink: 0
                }}>
                {sortDir === 'asc' ? '▲' : sortDir === 'desc' ? '▼' : '⇅'}
              </button>
            </div>
            {ganttResizeHandle('phase')}
          </div>
          {!gh('ct') && <div onContextMenu={e => ganttHeaderContextMenu(e, 'ct', 'CT')} style={{ width: ganttCols.ct, textAlign: 'center', padding: 0, flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>
            <CTFilterDropdown selected={ctFilter} onToggle={onCtFilterToggle} onClear={onCtFilterClear} />
            {ganttResizeHandle('ct')}
          </div>}
          {!gh('estHrs') && <div onContextMenu={e => ganttHeaderContextMenu(e, 'estHrs', 'Est Hrs')} style={{ width: ganttCols.estHrs, textAlign: 'center', padding: '0 0.25rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>Est Hrs{ganttResizeHandle('estHrs')}</div>}
          {!gh('estCost') && <div onContextMenu={e => ganttHeaderContextMenu(e, 'estCost', 'Est $')} style={{ width: ganttCols.estCost, textAlign: 'center', padding: '0 0.25rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>Est ${ganttResizeHandle('estCost')}</div>}
          {!gh('start') && <div onContextMenu={e => ganttHeaderContextMenu(e, 'start', 'Start')} style={{ width: ganttCols.start, textAlign: 'center', padding: '0 0.25rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>Start{ganttResizeHandle('start')}</div>}
          {!gh('end') && <div onContextMenu={e => ganttHeaderContextMenu(e, 'end', 'End')} style={{ width: ganttCols.end, textAlign: 'center', padding: '0 0.25rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>End{ganttResizeHandle('end')}</div>}
          {!gh('dur') && <div onContextMenu={e => ganttHeaderContextMenu(e, 'dur', 'Duration')} style={{ width: ganttCols.dur, textAlign: 'center', padding: '0 0.25rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>Dur{ganttResizeHandle('dur')}</div>}
          {!gh('pred') && <div onContextMenu={e => ganttHeaderContextMenu(e, 'pred', 'Predecessor')} style={{ width: ganttCols.pred, textAlign: 'center', padding: '0 0.15rem', flexShrink: 0, position: 'relative', borderRight: '1px solid #cbd5e1' }}>Pred{ganttResizeHandle('pred')}</div>}
          {!gh('contour') && <div onContextMenu={e => ganttHeaderContextMenu(e, 'contour', 'Contour')} style={{ width: ganttCols.contour, textAlign: 'center', padding: '0 0.25rem', flexShrink: 0, position: 'relative' }}>Contour{ganttResizeHandle('contour')}</div>}
        </div>
        {costTypeGroups.map(group => {
          const isCollapsed = collapsedGroups.has(group.costType);
          return (
            <React.Fragment key={`ct-${group.costType}`}>
              <div
                style={{
                  height: rowHeight, borderBottom: '1px solid #94a3b8',
                  display: 'flex', alignItems: 'stretch', fontSize: '0.7rem',
                  backgroundColor: `${group.color}10`, cursor: 'pointer'
                }}
                onClick={() => onToggleGroup(group.costType)}
              >
                <div style={{ width: ganttCols.sel, flexShrink: 0, borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={e => e.stopPropagation()}>
                  <input type="checkbox"
                    checked={group.items.length > 0 && group.items.every(i => selectedItems.has(i.id))}
                    ref={(el) => { if (el) el.indeterminate = group.items.some(i => selectedItems.has(i.id)) && !group.items.every(i => selectedItems.has(i.id)); }}
                    onChange={() => onToggleGroupSelection(group.costType)}
                    style={{ cursor: 'pointer' }} title={`Select all ${group.name} items`} />
                </div>
                <div style={{ width: ganttCols.rowNum, flexShrink: 0, borderRight: '1px solid #cbd5e1' }} />
                <div style={{ width: ganttCols.gcLink, flexShrink: 0, borderRight: '1px solid #cbd5e1' }} />
                <div style={{ width: ganttCols.phase, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 0.4rem', gap: '4px', borderRight: '1px solid #cbd5e1', overflow: 'hidden' }}>
                  <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: '0.6rem', color: '#64748b' }}>&#9660;</span>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: group.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: group.color }}>{group.name}</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b' }}>({group.items.length})</span>
                </div>
                {!gh('ct') && <div style={{ width: ganttCols.ct, flexShrink: 0, borderRight: '1px solid #cbd5e1' }} />}
                {!gh('estHrs') && <div style={{ width: ganttCols.estHrs, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.25rem', borderRight: '1px solid #cbd5e1', fontSize: '0.65rem', color: '#64748b' }}>
                  {fmtHrs(group.estHrs)}
                </div>}
                {!gh('estCost') && <div style={{ width: ganttCols.estCost, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.25rem', borderRight: '1px solid #cbd5e1', fontSize: '0.65rem', color: '#64748b' }}>
                  {fmtCompact(group.estCost)}
                </div>}
                {!gh('start') && <div style={{ width: ganttCols.start, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #cbd5e1', fontSize: '0.6rem', color: '#64748b' }}>
                  {fmtDateShort(group.earliestStart)}
                </div>}
                {!gh('end') && <div style={{ width: ganttCols.end, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #cbd5e1', fontSize: '0.6rem', color: '#64748b' }}>
                  {fmtDateShort(group.latestEnd)}
                </div>}
                {!gh('dur') && <div style={{ width: ganttCols.dur, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #cbd5e1', fontSize: '0.6rem', color: '#64748b' }}>
                  {group.duration || ''}
                </div>}
                {!gh('pred') && <div style={{ width: ganttCols.pred, flexShrink: 0, borderRight: '1px solid #cbd5e1' }} />}
                {!gh('contour') && <div style={{ width: ganttCols.contour, flexShrink: 0 }} />}
              </div>
              {!isCollapsed && group.items.map(item => (
                <GanttRow key={item.id} item={item} allItems={allItems} rowHeight={rowHeight} projectId={projectId} onUpdate={onUpdate} onEdit={onEdit} ganttCols={ganttCols} hiddenCols={ganttHiddenCols}
                  isSelected={selectedItems.has(item.id)} onToggleSelection={onToggleItem} />
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
        style={{ width: '3px', flexShrink: 0, cursor: 'col-resize', background: '#94a3b8', transition: 'background 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3b82f6'; }}
        onMouseLeave={e => { if (!draggingRef.current) (e.currentTarget as HTMLElement).style.background = '#94a3b8'; }}
      />

      {/* Right panel - timeline */}
      <div style={{ flex: 1, overflow: 'auto' }} ref={ganttRef}>
        {months.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', color: '#64748b', fontSize: '0.85rem' }}>
            Set start/end dates to see the timeline
          </div>
        ) : (
        <div style={{ minWidth: totalWidth, position: 'relative' }}>
          <div style={{ display: 'flex', height: '28px', borderBottom: '1px solid #94a3b8', background: '#eef2f7', position: 'sticky', top: 0, zIndex: 2 }}>
            {months.map(m => (
              <div key={m.toISOString()} style={{ width: colWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                {format(m, 'MMM yy')}
              </div>
            ))}
          </div>

          {costTypeGroups.map(group => {
            const isCollapsed = collapsedGroups.has(group.costType);
            // Group summary bar span (day-level precision)
            const gStartDate = group.earliestStart ? new Date(group.earliestStart) : null;
            const gEndDate = group.latestEnd ? new Date(group.latestEnd) : null;
            let gBarLeft = 0, gBarWidth = 0;
            if (gStartDate && gEndDate && firstMonth && gStartDate >= firstMonth) {
              gBarLeft = dateToX(gStartDate) + 2;
              const gEndDaysInMonth = new Date(gEndDate.getFullYear(), gEndDate.getMonth() + 1, 0).getDate();
              const gBarRight = dateToX(gEndDate) + colWidth / gEndDaysInMonth;
              gBarWidth = gBarRight - gBarLeft;
            }
            return (
              <React.Fragment key={`ct-${group.costType}`}>
                {/* Group summary row in timeline */}
                <div style={{ height: rowHeight, position: 'relative', borderBottom: '1px solid #94a3b8', backgroundColor: `${group.color}10` }}>
                  {months.map((m, i) => (
                    <div key={i} style={{ position: 'absolute', left: i * colWidth, top: 0, bottom: 0, width: colWidth, borderRight: '1px solid #e2e8f0' }} />
                  ))}
                  {gBarWidth > 0 && (
                    <div style={{
                      position: 'absolute', left: gBarLeft, top: 5, height: rowHeight - 10, width: gBarWidth,
                      backgroundColor: `${group.color}20`, border: `1px dashed ${group.color}`, borderRadius: '3px'
                    }} />
                  )}
                </div>
                {/* Child item bars */}
                {!isCollapsed && group.items.map(item => {
                  const startDate = ymdToDate(item.start_date);
                  const endDate = ymdToDate(item.end_date);
                  let barLeft = 0, barWidth = 0;
                  if (startDate && endDate && firstMonth && startDate >= firstMonth) {
                    barLeft = dateToX(startDate) + 2;
                    const endDaysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
                    const barRight = dateToX(endDate) + colWidth / endDaysInMonth;
                    barWidth = barRight - barLeft;
                  }
                  const barColor = COST_TYPE_COLORS[item.cost_types?.[0] || 1];
                  const isDraggingThis = barDragOffset?.itemId === item.id;
                  const dragDelta = isDraggingThis ? barDragOffset.deltaX : 0;
                  const isResizingThis = barResizeOffset?.itemId === item.id;
                  const resizeDelta = isResizingThis ? barResizeOffset.deltaX : 0;
                  const resizeEdge = isResizingThis ? barResizeOffset.edge : null;
                  // Compute adjusted bar position/width during resize
                  let adjBarLeft = barLeft + dragDelta;
                  let adjBarWidth = barWidth;
                  if (isResizingThis) {
                    if (resizeEdge === 'left') {
                      adjBarLeft = barLeft + resizeDelta;
                      adjBarWidth = Math.max(8, barWidth - resizeDelta);
                    } else {
                      adjBarWidth = Math.max(8, barWidth + resizeDelta);
                    }
                  }
                  const isActive = isDraggingThis || isResizingThis;
                  return (
                    <div key={item.id} style={{ height: rowHeight, position: 'relative', borderBottom: '1px solid #cbd5e1', cursor: 'pointer' }}
                      onClick={() => { if (dragOccurredRef.current) { dragOccurredRef.current = false; return; } onEdit(item); }}>
                      {months.map((m, i) => (
                        <div key={i} style={{ position: 'absolute', left: i * colWidth, top: 0, bottom: 0, width: colWidth, borderRight: '1px solid #e2e8f0' }} />
                      ))}
                      {barWidth > 0 && (
                        <div style={{
                          position: 'absolute', left: adjBarLeft, top: 4, height: rowHeight - 8, width: adjBarWidth,
                          backgroundColor: isActive ? barColor + '50' : barColor + '30',
                          border: `2px solid ${barColor}`, borderRadius: '4px',
                          display: 'flex', alignItems: 'center', paddingLeft: '6px', paddingRight: '6px', overflow: 'hidden',
                          cursor: isDraggingThis ? 'grabbing' : 'grab',
                          zIndex: isActive ? 10 : undefined,
                        }}
                          onMouseDown={e => {
                            if (e.button !== 0 || !startDate || !endDate) return;
                            e.stopPropagation();
                            barDragRef.current = {
                              itemId: item.id,
                              startMouseX: e.clientX,
                              originalBarLeft: barLeft,
                              originalStartDate: startDate,
                              originalEndDate: endDate,
                              durationDays: differenceInCalendarDays(endDate, startDate),
                              dragStarted: false,
                            };
                          }}
                          onMouseEnter={e => { if (!barDragRef.current && !barResizeRef.current) e.currentTarget.style.backgroundColor = barColor + '50'; }}
                          onMouseLeave={e => { if (!barDragRef.current && !barResizeRef.current) e.currentTarget.style.backgroundColor = barColor + '30'; }}>
                          {/* Left resize handle */}
                          <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px',
                            cursor: 'w-resize', zIndex: 2,
                          }}
                            onMouseDown={e => {
                              if (e.button !== 0 || !startDate || !endDate) return;
                              e.stopPropagation(); e.preventDefault();
                              barResizeRef.current = {
                                itemId: item.id, edge: 'left', startMouseX: e.clientX,
                                originalBarLeft: barLeft, originalBarWidth: barWidth,
                                originalStartDate: startDate, originalEndDate: endDate, dragStarted: false,
                              };
                            }} />
                          <span style={{ fontSize: '0.65rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            {item.name}
                          </span>
                          {/* Right resize handle */}
                          <div style={{
                            position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px',
                            cursor: 'e-resize', zIndex: 2,
                          }}
                            onMouseDown={e => {
                              if (e.button !== 0 || !startDate || !endDate) return;
                              e.stopPropagation(); e.preventDefault();
                              barResizeRef.current = {
                                itemId: item.id, edge: 'right', startMouseX: e.clientX,
                                originalBarLeft: barLeft, originalBarWidth: barWidth,
                                originalStartDate: startDate, originalEndDate: endDate, dragStarted: false,
                              };
                            }} />
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

      {/* Context menu + Column chooser for Gantt */}
      {ganttContextMenu && (
        <ColumnContextMenu
          x={ganttContextMenu.x} y={ganttContextMenu.y}
          colKey={ganttContextMenu.key} colLabel={ganttContextMenu.label}
          onHide={() => toggleGanttCol(ganttContextMenu.key)}
          onChooser={() => setShowGanttChooser(true)}
          onClose={() => setGanttContextMenu(null)}
        />
      )}
      {showGanttChooser && (
        <ColumnChooserDialog
          columnDefs={GANTT_COLUMN_DEFS}
          hiddenCols={ganttHiddenCols}
          onToggle={toggleGanttCol}
          onShowAll={() => setGanttHiddenCols(new Set())}
          onClose={() => setShowGanttChooser(false)}
        />
      )}
    </div>
  );
};

// Gantt row with inline editing
const GanttRow: React.FC<{
  item: PhaseScheduleItem;
  allItems: PhaseScheduleItem[];
  rowHeight: number;
  projectId: number;
  onUpdate: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onEdit: (item: PhaseScheduleItem) => void;
  ganttCols: { sel: number; rowNum: number; gcLink: number; phase: number; ct: number; estHrs: number; estCost: number; start: number; end: number; dur: number; pred: number; contour: number };
  hiddenCols: Set<string>;
  isSelected: boolean;
  onToggleSelection: (id: number) => void;
}> = ({ item, allItems, rowHeight, projectId, onUpdate, onEdit, ganttCols, hiddenCols, isSelected, onToggleSelection }) => {
  const dur = getDuration(item.start_date, item.end_date);
  const dateLocked = (item.linked_resolved_count || 0) > 0;

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    onUpdate(item.id, { [field]: value || null } as any);
  };

  const handleDurationChange = (newDur: number) => {
    if (newDur > 0 && item.start_date) {
      const newEnd = format(addMonths(ymdToDate(item.start_date)!, newDur - 1), 'yyyy-MM-dd');
      onUpdate(item.id, { end_date: newEnd } as any);
    }
  };

  const handleContourChange = (value: string) => {
    onUpdate(item.id, { contour_type: value } as any);
  };

  const handlePredecessorChange = (value: string) => {
    const predRowNum = value ? parseInt(value) : null;
    if (predRowNum === null) {
      onUpdate(item.id, { predecessor_id: null } as any);
      return;
    }
    const predItem = allItems.find(i => i.row_number === predRowNum);
    if (!predItem) return;
    const updates: Partial<PhaseScheduleItem> = { predecessor_id: predRowNum } as any;
    if (predItem.end_date) {
      updates.start_date = format(addDays(ymdToDate(predItem.end_date)!, 1), 'yyyy-MM-dd');
      if (dur > 0 && updates.start_date) {
        updates.end_date = format(addDays(ymdToDate(updates.start_date)!, dur - 1), 'yyyy-MM-dd');
      }
    }
    onUpdate(item.id, updates);
  };

  const cellStyle: React.CSSProperties = { borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', height: '100%', fontSize: '0.7rem', color: '#1e293b' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '0 0.25rem', border: 'none', borderRadius: 0, fontSize: '0.7rem', fontFamily: 'inherit', color: '#1e293b', background: 'transparent', outline: 'none', boxSizing: 'border-box' as const, height: '100%' };

  return (
    <div style={{ height: rowHeight, borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'stretch', fontSize: '0.7rem', backgroundColor: isSelected ? '#eff6ff' : undefined }}>
      <div style={{ width: ganttCols.sel, flexShrink: 0, borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelection(item.id)} style={{ cursor: 'pointer' }} />
      </div>
      <div style={{ ...cellStyle, width: ganttCols.rowNum, justifyContent: 'center', flexShrink: 0, fontSize: '0.65rem', color: '#64748b' }}>
        {item.row_number}
      </div>
      <div style={{ ...cellStyle, width: ganttCols.gcLink, justifyContent: 'center', flexShrink: 0 }}>
        <PhaseGCLinkChips item={item} projectId={projectId} variant="badge" compact />
      </div>
      <div style={{ ...cellStyle, width: ganttCols.phase, minWidth: 0, padding: '0 0.4rem', gap: '4px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}
        onClick={() => onEdit(item)} title={item.name}>
        {item.cost_types?.map(ct => (
          <span key={ct} style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COST_TYPE_COLORS[ct], flexShrink: 0 }} />
        ))}
        {item.phase_code_display && (
          <span style={{ color: '#64748b', flexShrink: 0 }}>{item.phase_code_display} -</span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
      </div>
      {!hiddenCols.has('ct') && <div style={{ ...cellStyle, width: ganttCols.ct, justifyContent: 'center', flexShrink: 0, fontSize: '0.6rem', color: '#64748b' }}>
        {item.cost_types?.map(ct => COST_TYPE_NAMES[ct]?.charAt(0)).join('')}
      </div>}
      {!hiddenCols.has('estHrs') && <div style={{ ...cellStyle, width: ganttCols.estHrs, justifyContent: 'center', padding: '0 0.25rem', flexShrink: 0, fontSize: '0.65rem' }}>
        {fmtHrs(parseNum(item.total_est_hours))}
      </div>}
      {!hiddenCols.has('estCost') && <div style={{ ...cellStyle, width: ganttCols.estCost, justifyContent: 'center', padding: '0 0.25rem', flexShrink: 0 }}>
        {fmtCompact(parseNum(item.total_est_cost))}
      </div>}
      {!hiddenCols.has('start') && <div style={{ ...cellStyle, width: ganttCols.start, flexShrink: 0, position: 'relative', justifyContent: 'center', cursor: dateLocked ? 'default' : 'pointer' }} onClick={e => e.stopPropagation()}
        title={dateLocked ? 'Date is driven by linked GC schedule activities — unlink from the Link column to edit manually.' : undefined}>
        <span style={{ fontSize: '0.7rem', color: item.start_date ? '#1e293b' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {dateLocked && <span style={{ color: '#0891b2' }}>🔗</span>}
          {fmtDateShort(item.start_date) || '-'}
        </span>
        {!dateLocked && (
          <input type="date" className="date-no-icon" value={fmtDate(item.start_date)} onChange={e => handleDateChange('start_date', e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
        )}
      </div>}
      {!hiddenCols.has('end') && <div style={{ ...cellStyle, width: ganttCols.end, flexShrink: 0, position: 'relative', justifyContent: 'center', cursor: dateLocked ? 'default' : 'pointer' }} onClick={e => e.stopPropagation()}
        title={dateLocked ? 'Date is driven by linked GC schedule activities — unlink from the Link column to edit manually.' : undefined}>
        <span style={{ fontSize: '0.7rem', color: item.end_date ? '#1e293b' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {dateLocked && <span style={{ color: '#0891b2' }}>🔗</span>}
          {fmtDateShort(item.end_date) || '-'}
        </span>
        {!dateLocked && (
          <input type="date" className="date-no-icon" value={fmtDate(item.end_date)} onChange={e => handleDateChange('end_date', e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
        )}
      </div>}
      {!hiddenCols.has('dur') && <div style={{ ...cellStyle, width: ganttCols.dur, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <input type="number" value={dur || ''} min={1}
          onFocus={e => e.target.select()}
          onChange={e => handleDurationChange(parseInt(e.target.value) || 0)}
          style={{ ...inputStyle, textAlign: 'center' }} />
      </div>}
      {!hiddenCols.has('pred') && <div style={{ ...cellStyle, width: ganttCols.pred, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <input type="text" inputMode="numeric" pattern="[0-9]*"
          defaultValue={item.predecessor_id || ''}
          onFocus={e => e.target.select()}
          onBlur={e => handlePredecessorChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inputStyle, textAlign: 'center' }}
          placeholder="-" />
      </div>}
      {!hiddenCols.has('contour') && <div style={{ width: ganttCols.contour, flexShrink: 0, display: 'flex', alignItems: 'center', height: '100%' }} onClick={e => e.stopPropagation()}>
        <select value={item.contour_type || 'flat'} onChange={e => handleContourChange(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}>
          {contourOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>}
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

// Column group shading for visual distinction
const COL_GROUP = {
  est:   { hdr: '#dbeafe', cell: '#eff6ff' },   // blue-100 / blue-50  — Estimated
  jtd:   { hdr: '#fef3c7', cell: '#fffbeb' },   // amber-100 / amber-50 — JTD
  proj:  { hdr: '#dcfce7', cell: '#f0fdf4' },   // green-100 / green-50 — Projected
  rem:   { hdr: '#ede9fe', cell: '#f5f3ff' },   // violet-100 / violet-50 — Remaining
  bill:  { hdr: '#fce7f3', cell: '#fdf2f8' },   // pink-100 / pink-50 — Billing (Rate)
  sched: { hdr: '#e2e8f0', cell: '#f8fafc' },   // slate-200 / slate-50 — Schedule
};

const GRID_COL_DEFAULTS = {
  sel: 28, rowNum: 32, gcLink: 120, phase: 286, ct: 36,
  // Estimated group
  estQty: 62, uom: 44, estHrs: 62, estCost: 78, estPi: 50,
  // JTD group
  pctComp: 54, jtdQty: 62, jtdHrs: 62, jtdCost: 78, jtdPi: 50,
  // Projected group
  projQty: 62, projHrs: 62, projCostField: 78, projCostVista: 78, projPi: 50,
  // Remaining group
  remQty: 62, remHrs: 62, remCost: 78,
  // Billing
  rate: 130,
  // Schedule
  start: 100, end: 100, dur: 44, pred: 44, contour: 74
};

const GridView: React.FC<{
  items: PhaseScheduleItem[];
  allItems: PhaseScheduleItem[];
  months: Date[];
  mode: GridMode;
  shift: ShiftKey;
  period: Period;
  laborRates: ProjectLaborRate[];
  markupByCt: Record<number, number>;
  projectId: number;
  onUpdate: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onEdit: (item: PhaseScheduleItem) => void;
  costTypeGroups: CostTypeGroup[];
  collapsedGroups: Set<number>;
  onToggleGroup: (costType: number) => void;
  selectedItems: Set<number>;
  onToggleItem: (itemId: number) => void;
  onToggleGroupSelection: (costType: number) => void;
  onToggleAll: () => void;
  filterText: string;
  onFilterChange: (text: string) => void;
  sortDir: 'none' | 'asc' | 'desc';
  onSortChange: () => void;
  ctFilter: Set<number>;
  onCtFilterToggle: (ct: number) => void;
  onCtFilterClear: () => void;
  availablePrefixes: string[];
  prefixFilter: Set<string>;
  onPrefixFilterToggle: (prefix: string) => void;
  onPrefixFilterClear: () => void;
}> = ({ items, allItems, months, mode, shift, period, laborRates, markupByCt, projectId, onUpdate, onEdit, costTypeGroups, collapsedGroups, onToggleGroup, selectedItems, onToggleItem, onToggleGroupSelection, onToggleAll, filterText, onFilterChange, sortDir, onSortChange, ctFilter, onCtFilterToggle, onCtFilterClear, availablePrefixes, prefixFilter, onPrefixFilterToggle, onPrefixFilterClear }) => {
  // Grid column widths (persisted to localStorage)
  const [colWidths, setColWidths] = useState<typeof GRID_COL_DEFAULTS>(() => {
    try {
      const saved = localStorage.getItem('phaseSchedule_gridCols');
      if (!saved) return GRID_COL_DEFAULTS;
      const parsed = JSON.parse(saved);
      // One-time reset of the new gcLink column width. Any stale saved value
      // gets discarded so the current default applies. After the user resizes
      // it manually we flip a flag and stop overriding.
      if (!localStorage.getItem('phaseSchedule_gcLink_migrated')) {
        delete parsed.gcLink;
        localStorage.setItem('phaseSchedule_gcLink_migrated', '1');
      }
      return { ...GRID_COL_DEFAULTS, ...parsed };
    } catch { return GRID_COL_DEFAULTS; }
  });
  useEffect(() => { localStorage.setItem('phaseSchedule_gridCols', JSON.stringify(colWidths)); }, [colWidths]);
  // Force-reset gcLink width once. Webpack HMR preserves React state, so changes
  // to the default in GRID_COL_DEFAULTS won't propagate without this nudge.
  useEffect(() => {
    if (!localStorage.getItem('phaseSchedule_gcLink_reset_v5')) {
      setColWidths((prev) => ({ ...prev, gcLink: GRID_COL_DEFAULTS.gcLink }));
      localStorage.setItem('phaseSchedule_gcLink_reset_v5', '1');
    }
  }, []);
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Hidden columns state
  const [gridHiddenCols, setGridHiddenCols] = useState<Set<string>>(new Set());
  const [gridContextMenu, setGridContextMenu] = useState<{ x: number; y: number; key: string; label: string } | null>(null);
  const [showGridChooser, setShowGridChooser] = useState(false);
  const gv = (col: string) => !gridHiddenCols.has(col); // shorthand: visible?

  const toggleGridCol = (key: string) => {
    setGridHiddenCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const gridHeaderContextMenu = (e: React.MouseEvent, key: string, label: string) => {
    const def = GRID_COLUMN_DEFS.find(c => c.key === key);
    if (!def?.hideable) return;
    e.preventDefault();
    setGridContextMenu({ x: e.clientX, y: e.clientY, key, label });
  };

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

  const autofitColumn = (col: string) => {
    const table = tableRef.current;
    if (!table) return;
    // Find the column index by looking for the header with data-col attribute
    const headers = table.querySelectorAll('thead tr:last-child th');
    let colIndex = -1;
    headers.forEach((th, i) => {
      if ((th as HTMLElement).dataset.col === col) colIndex = i;
    });
    if (colIndex < 0) return;

    // Use an offscreen canvas to measure text width (tableLayout:fixed prevents scrollWidth from working)
    // Note: canvas doesn't support rem units, so convert to px (0.68rem ≈ 11px at 16px base)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let maxW = 36; // minimum

    // Measure header text
    const headerTh = headers[colIndex] as HTMLElement;
    if (headerTh) {
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      const headerText = headerTh.textContent || '';
      maxW = Math.max(maxW, ctx.measureText(headerText).width + 24);
    }

    // Measure body cell text content
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cell = row.children[colIndex] as HTMLElement | undefined;
      if (!cell) return;
      // Prefer visible span text (e.g. date overlays) over hidden input values
      const span = cell.querySelector('span');
      const input = cell.querySelector('input:not([style*="opacity"]), select') as HTMLInputElement | null;
      const text = span ? (span.textContent || '') : input ? (input.value || input.placeholder || '') : (cell.textContent || '');
      if (text && text !== '-') {
        const w = ctx.measureText(text).width + 20; // padding + borders
        maxW = Math.max(maxW, w);
      }
    });

    maxW = Math.min(Math.ceil(maxW), 400);
    setColWidths(prev => ({ ...prev, [col]: maxW }));
  };

  const hpwm = hoursPerWorkerPerPeriod(shift, period);
  const laborRateById = useMemo(() => {
    const m = new Map<number, number>();
    laborRates.forEach(r => m.set(r.id, Number(r.billable_rate) || 0));
    return m;
  }, [laborRates]);
  const allMonthlyValues = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    items.forEach(item => {
      map.set(item.id, computeMonthlyValues(item, months, mode, hpwm, laborRateById, markupByCt, period));
    });
    return map;
  }, [items, months, mode, hpwm, laborRateById, markupByCt, period]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach(m => {
      const key = periodKey(m, period);
      totals[key] = 0;
      items.forEach(item => {
        totals[key] += allMonthlyValues.get(item.id)?.[key] || 0;
      });
    });
    return totals;
  }, [items, months, period, allMonthlyValues]);

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
        const key = periodKey(m, period);
        totals[key] = group.items.reduce((s, item) => s + (allMonthlyValues.get(item.id)?.[key] || 0), 0);
      });
      map.set(group.costType, totals);
    });
    return map;
  }, [costTypeGroups, months, period, allMonthlyValues]);

  const monthColWidth = period === 'week' ? 48 : period === 'quarter' ? 78 : 62;
  const distributionLabel = period === 'week' ? 'Weekly Distribution' : period === 'quarter' ? 'Quarterly Distribution' : 'Monthly Distribution';
  // Compute group widths for spanning headers (skip hidden columns)
  const vw = (col: string) => gv(col) ? (colWidths as any)[col] : 0;
  const estCols = ['estQty', 'uom', 'estHrs', 'estCost', 'estPi'];
  const jtdCols = ['pctComp', 'jtdQty', 'jtdHrs', 'jtdCost', 'jtdPi'];
  const projCols = ['projQty', 'projHrs', 'projCostField', 'projCostVista', 'projPi'];
  const remCols = ['remQty', 'remHrs', 'remCost'];
  const billCols = ['rate'];
  const schedCols = ['start', 'end', 'dur', 'pred', 'contour'];
  const estGroupW = estCols.reduce((s, c) => s + vw(c), 0);
  const jtdGroupW = jtdCols.reduce((s, c) => s + vw(c), 0);
  const projGroupW = projCols.reduce((s, c) => s + vw(c), 0);
  const remGroupW = remCols.reduce((s, c) => s + vw(c), 0);
  const billGroupW = billCols.reduce((s, c) => s + vw(c), 0);
  const schedGroupW = schedCols.reduce((s, c) => s + vw(c), 0);
  const estColSpan = estCols.filter(c => gv(c)).length;
  const jtdColSpan = jtdCols.filter(c => gv(c)).length;
  const projColSpan = projCols.filter(c => gv(c)).length;
  const remColSpan = remCols.filter(c => gv(c)).length;
  const billColSpan = billCols.filter(c => gv(c)).length;
  const schedColSpan = schedCols.filter(c => gv(c)).length;
  const fixedWidth = colWidths.sel + colWidths.rowNum + colWidths.gcLink + colWidths.phase + vw('ct') + estGroupW + jtdGroupW + projGroupW + remGroupW + billGroupW + schedGroupW;

  const thStyle = (width: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
    width, minWidth: width, maxWidth: width, padding: '0.15rem 0.2rem', textAlign: 'center' as const,
    borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1',
    fontSize: '0.68rem', fontWeight: 600,
    whiteSpace: 'nowrap' as const, position: 'relative' as const, color: '#1e293b', overflow: 'hidden' as const,
    background: '#eef2f7',
    ...extra
  });

  const groupHeaderStyle = (_width: number, color: string): React.CSSProperties => ({
    textAlign: 'center' as const, padding: '0.15rem 0',
    fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px',
    borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1',
    color, background: '#eef2f7'
  });

  const dblClickRef = useRef<{ col: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const handleResizeMouseDown = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (dblClickRef.current && dblClickRef.current.col === col) {
      // Second click within timeout — it's a double-click
      clearTimeout(dblClickRef.current.timer);
      dblClickRef.current = null;
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      autofitColumn(col);
      return;
    }
    // First click — start resize but also set a timer for double-click detection
    startResize(col, e);
    dblClickRef.current = {
      col,
      timer: setTimeout(() => { dblClickRef.current = null; }, 300)
    };
  };

  const resizeHandle = (col: string) => (
    <div onMouseDown={e => handleResizeMouseDown(col, e)}
      style={{ position: 'absolute', right: -1, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', zIndex: 1 }}
      onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = 'rgba(59,130,246,0.25)'; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    />
  );

  return (
    <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)', border: '1px solid #cbd5e1' }}>
      <table ref={tableRef} style={{ borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed', width: fixedWidth + months.length * monthColWidth }}>
        <colgroup>
          <col style={{ width: colWidths.sel }} />
          <col style={{ width: colWidths.rowNum }} />
          <col style={{ width: colWidths.gcLink }} />
          <col style={{ width: colWidths.phase }} />
          {gv('ct') && <col style={{ width: colWidths.ct }} />}
          {gv('estQty') && <col style={{ width: colWidths.estQty }} />}
          {gv('uom') && <col style={{ width: colWidths.uom }} />}
          {gv('estHrs') && <col style={{ width: colWidths.estHrs }} />}
          {gv('estCost') && <col style={{ width: colWidths.estCost }} />}
          {gv('estPi') && <col style={{ width: colWidths.estPi }} />}
          {gv('pctComp') && <col style={{ width: colWidths.pctComp }} />}
          {gv('jtdQty') && <col style={{ width: colWidths.jtdQty }} />}
          {gv('jtdHrs') && <col style={{ width: colWidths.jtdHrs }} />}
          {gv('jtdCost') && <col style={{ width: colWidths.jtdCost }} />}
          {gv('jtdPi') && <col style={{ width: colWidths.jtdPi }} />}
          {gv('projQty') && <col style={{ width: colWidths.projQty }} />}
          {gv('projHrs') && <col style={{ width: colWidths.projHrs }} />}
          {gv('projCostField') && <col style={{ width: colWidths.projCostField }} />}
          {gv('projCostVista') && <col style={{ width: colWidths.projCostVista }} />}
          {gv('projPi') && <col style={{ width: colWidths.projPi }} />}
          {gv('remQty') && <col style={{ width: colWidths.remQty }} />}
          {gv('remHrs') && <col style={{ width: colWidths.remHrs }} />}
          {gv('remCost') && <col style={{ width: colWidths.remCost }} />}
          {gv('rate') && <col style={{ width: colWidths.rate }} />}
          {gv('start') && <col style={{ width: colWidths.start }} />}
          {gv('end') && <col style={{ width: colWidths.end }} />}
          {gv('dur') && <col style={{ width: colWidths.dur }} />}
          {gv('pred') && <col style={{ width: colWidths.pred }} />}
          {gv('contour') && <col style={{ width: colWidths.contour }} />}
          {months.map(m => <col key={m.toISOString()} style={{ width: monthColWidth }} />)}
        </colgroup>
        <thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
          {/* Group header row */}
          <tr style={{ background: '#eef2f7' }}>
            <th style={{ ...groupHeaderStyle(colWidths.sel, '#1e293b'), position: 'sticky', left: 0, background: '#eef2f7', zIndex: 6, textAlign: 'center', borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}>
              <input type="checkbox" checked={selectedItems.size === items.length && items.length > 0}
                onChange={onToggleAll} style={{ cursor: 'pointer' }} title="Select all" />
            </th>
            <th style={{ ...groupHeaderStyle(colWidths.rowNum, '#1e293b'), position: 'sticky', left: colWidths.sel, background: '#eef2f7', zIndex: 6, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}></th>
            <th style={{ ...groupHeaderStyle(colWidths.gcLink, '#1e293b'), position: 'sticky', left: colWidths.sel + colWidths.rowNum, background: '#eef2f7', zIndex: 6, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}></th>
            <th style={{ ...groupHeaderStyle(colWidths.phase, '#1e293b'), textAlign: 'left', position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink, background: '#eef2f7', zIndex: 6, padding: '0.15rem 0.5rem', borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}></th>
            {gv('ct') && <th style={{ ...groupHeaderStyle(colWidths.ct, ctFilter.size > 0 ? '#3b82f6' : '#1e293b'), position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink + colWidths.phase, background: '#eef2f7', zIndex: 6, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #94a3b8' }}>{ctFilter.size > 0 ? [...ctFilter].sort().map(ct => COST_TYPE_NAMES[ct]?.charAt(0)).join('') : ''}</th>}
            {estColSpan > 0 && <th colSpan={estColSpan} style={{ ...groupHeaderStyle(estGroupW, '#3b82f6'), background: COL_GROUP.est.hdr, borderLeft: '2px solid #94a3b8', borderRight: '2px solid #94a3b8' }}>Estimated</th>}
            {jtdColSpan > 0 && <th colSpan={jtdColSpan} style={{ ...groupHeaderStyle(jtdGroupW, '#f59e0b'), background: COL_GROUP.jtd.hdr, borderRight: '2px solid #94a3b8' }}>JTD</th>}
            {projColSpan > 0 && <th colSpan={projColSpan} style={{ ...groupHeaderStyle(projGroupW, '#10b981'), background: COL_GROUP.proj.hdr, borderRight: '2px solid #94a3b8' }}>Projected</th>}
            {remColSpan > 0 && <th colSpan={remColSpan} style={{ ...groupHeaderStyle(remGroupW, '#7c3aed'), background: COL_GROUP.rem.hdr, borderRight: '2px solid #94a3b8' }}>Remaining</th>}
            {billColSpan > 0 && <th colSpan={billColSpan} style={{ ...groupHeaderStyle(billGroupW, '#db2777'), background: COL_GROUP.bill.hdr, borderRight: '2px solid #94a3b8' }}>Billing</th>}
            {schedColSpan > 0 && <th colSpan={schedColSpan} style={{ ...groupHeaderStyle(schedGroupW, '#64748b'), background: COL_GROUP.sched.hdr, borderRight: '2px solid #94a3b8' }}>Schedule</th>}
            {months.length > 0 && (
              <th colSpan={months.length} style={groupHeaderStyle(months.length * monthColWidth, '#8b5cf6')}>{distributionLabel}</th>
            )}
          </tr>
          {/* Column header row */}
          <tr style={{ background: '#eef2f7' }}>
            {/* Checkbox column spacer */}
            <th data-col="sel" style={thStyle(colWidths.sel, { position: 'sticky', left: 0, background: '#eef2f7', zIndex: 6, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' })}></th>
            {/* ID column */}
            <th data-col="rowNum" style={thStyle(colWidths.rowNum, { position: 'sticky', left: colWidths.sel, background: '#eef2f7', zIndex: 6, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' })}>ID{resizeHandle('rowNum')}</th>
            <th data-col="gcLink" style={thStyle(colWidths.gcLink, { position: 'sticky', left: colWidths.sel + colWidths.rowNum, background: '#eef2f7', zIndex: 6, fontSize: '0.6rem', borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' })}>Link{resizeHandle('gcLink')}</th>
            {/* Fixed columns */}
            <th data-col="phase" style={thStyle(colWidths.phase, { textAlign: 'left', position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink, background: '#eef2f7', zIndex: 6, padding: '0.15rem 0.4rem', borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <input type="text" value={filterText} onChange={e => onFilterChange(e.target.value)}
                  placeholder="Filter prefix (* = wildcard)" title="Type a phase prefix (e.g. 30) or use * as wildcard (e.g. *labor*, 30*010)" style={{
                    flex: 1, padding: '0.15rem 0.3rem', fontSize: '0.65rem', border: '1px solid #e2e8f0',
                    borderRadius: '3px', background: filterText ? '#fffbeb' : '#fff', color: '#1e293b',
                    outline: 'none', minWidth: 0
                  }} />
                {filterText && (
                  <button onClick={() => onFilterChange('')} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1
                  }}>&times;</button>
                )}
                <PrefixFilterDropdown available={availablePrefixes} selected={prefixFilter}
                  onToggle={onPrefixFilterToggle} onClear={onPrefixFilterClear} />
                <button onClick={onSortChange} title={sortDir === 'none' ? 'Sort A-Z' : sortDir === 'asc' ? 'Sort Z-A' : 'Clear sort'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
                    fontSize: '0.65rem', color: sortDir !== 'none' ? '#3b82f6' : '#94a3b8', lineHeight: 1, flexShrink: 0
                  }}>
                  {sortDir === 'asc' ? '▲' : sortDir === 'desc' ? '▼' : '⇅'}
                </button>
              </div>
              {resizeHandle('phase')}
            </th>
            {gv('ct') && <th data-col="ct" onContextMenu={e => gridHeaderContextMenu(e, 'ct', 'CT')} style={thStyle(colWidths.ct, { position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink + colWidths.phase, background: '#eef2f7', zIndex: 6, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #94a3b8' })}>
              <CTFilterDropdown selected={ctFilter} onToggle={onCtFilterToggle} onClear={onCtFilterClear} />
              {resizeHandle('ct')}
            </th>}
            {/* Estimated group */}
            {gv('estQty') && <th data-col="estQty" onContextMenu={e => gridHeaderContextMenu(e, 'estQty', 'Est Qty')} style={thStyle(colWidths.estQty, { background: COL_GROUP.est.hdr, borderLeft: '2px solid #94a3b8' })}>Qty{resizeHandle('estQty')}</th>}
            {gv('uom') && <th data-col="uom" onContextMenu={e => gridHeaderContextMenu(e, 'uom', 'UOM')} style={thStyle(colWidths.uom, { background: COL_GROUP.est.hdr })}>UOM{resizeHandle('uom')}</th>}
            {gv('estHrs') && <th data-col="estHrs" onContextMenu={e => gridHeaderContextMenu(e, 'estHrs', 'Est Hrs')} style={thStyle(colWidths.estHrs, { background: COL_GROUP.est.hdr })}>Hrs{resizeHandle('estHrs')}</th>}
            {gv('estCost') && <th data-col="estCost" onContextMenu={e => gridHeaderContextMenu(e, 'estCost', 'Est Cost')} style={thStyle(colWidths.estCost, { background: COL_GROUP.est.hdr })}>Cost{resizeHandle('estCost')}</th>}
            {gv('estPi') && <th data-col="estPi" onContextMenu={e => gridHeaderContextMenu(e, 'estPi', 'Est PI')} style={thStyle(colWidths.estPi, { background: COL_GROUP.est.hdr, borderRight: '2px solid #94a3b8' })}>PI{resizeHandle('estPi')}</th>}
            {/* JTD group */}
            {gv('pctComp') && <th data-col="pctComp" onContextMenu={e => gridHeaderContextMenu(e, 'pctComp', '%Comp')} style={thStyle(colWidths.pctComp, { background: COL_GROUP.jtd.hdr })}>%Comp{resizeHandle('pctComp')}</th>}
            {gv('jtdQty') && <th data-col="jtdQty" onContextMenu={e => gridHeaderContextMenu(e, 'jtdQty', 'JTD Qty')} style={thStyle(colWidths.jtdQty, { background: COL_GROUP.jtd.hdr })}>Qty{resizeHandle('jtdQty')}</th>}
            {gv('jtdHrs') && <th data-col="jtdHrs" onContextMenu={e => gridHeaderContextMenu(e, 'jtdHrs', 'JTD Hrs')} style={thStyle(colWidths.jtdHrs, { background: COL_GROUP.jtd.hdr })}>Hrs{resizeHandle('jtdHrs')}</th>}
            {gv('jtdCost') && <th data-col="jtdCost" onContextMenu={e => gridHeaderContextMenu(e, 'jtdCost', 'JTD Cost')} style={thStyle(colWidths.jtdCost, { background: COL_GROUP.jtd.hdr })}>Cost{resizeHandle('jtdCost')}</th>}
            {gv('jtdPi') && <th data-col="jtdPi" onContextMenu={e => gridHeaderContextMenu(e, 'jtdPi', 'JTD PI')} style={thStyle(colWidths.jtdPi, { background: COL_GROUP.jtd.hdr, borderRight: '2px solid #94a3b8' })}>PI{resizeHandle('jtdPi')}</th>}
            {/* Projected group */}
            {gv('projQty') && <th data-col="projQty" onContextMenu={e => gridHeaderContextMenu(e, 'projQty', 'Proj Qty')} style={thStyle(colWidths.projQty, { background: COL_GROUP.proj.hdr })}>Qty{resizeHandle('projQty')}</th>}
            {gv('projHrs') && <th data-col="projHrs" onContextMenu={e => gridHeaderContextMenu(e, 'projHrs', 'Proj Hrs')} style={thStyle(colWidths.projHrs, { background: COL_GROUP.proj.hdr })}>Hrs{resizeHandle('projHrs')}</th>}
            {gv('projCostField') && <th data-col="projCostField" onContextMenu={e => gridHeaderContextMenu(e, 'projCostField', 'Cost (Field)')} style={thStyle(colWidths.projCostField, { background: COL_GROUP.proj.hdr, fontSize: '0.6rem' })}>Cost (Field){resizeHandle('projCostField')}</th>}
            {gv('projCostVista') && <th data-col="projCostVista" onContextMenu={e => gridHeaderContextMenu(e, 'projCostVista', 'Cost (Vista)')} style={thStyle(colWidths.projCostVista, { background: COL_GROUP.proj.hdr, fontSize: '0.6rem' })}>Cost (Vista){resizeHandle('projCostVista')}</th>}
            {gv('projPi') && <th data-col="projPi" onContextMenu={e => gridHeaderContextMenu(e, 'projPi', 'Proj PI')} style={thStyle(colWidths.projPi, { background: COL_GROUP.proj.hdr, borderRight: '2px solid #94a3b8' })}>PI{resizeHandle('projPi')}</th>}
            {/* Remaining group */}
            {gv('remQty') && <th data-col="remQty" onContextMenu={e => gridHeaderContextMenu(e, 'remQty', 'Rem Qty')} style={thStyle(colWidths.remQty, { background: COL_GROUP.rem.hdr })}>Qty{resizeHandle('remQty')}</th>}
            {gv('remHrs') && <th data-col="remHrs" onContextMenu={e => gridHeaderContextMenu(e, 'remHrs', 'Rem Hrs')} style={thStyle(colWidths.remHrs, { background: COL_GROUP.rem.hdr })}>Hrs{resizeHandle('remHrs')}</th>}
            {gv('remCost') && <th data-col="remCost" onContextMenu={e => gridHeaderContextMenu(e, 'remCost', 'Rem Cost')} style={thStyle(colWidths.remCost, { background: COL_GROUP.rem.hdr, borderRight: '2px solid #94a3b8' })}>Cost{resizeHandle('remCost')}</th>}
            {/* Billing group */}
            {gv('rate') && <th data-col="rate" onContextMenu={e => gridHeaderContextMenu(e, 'rate', 'Rate')} style={thStyle(colWidths.rate, { background: COL_GROUP.bill.hdr, borderRight: '2px solid #94a3b8' })}>Rate{resizeHandle('rate')}</th>}
            {/* Schedule group */}
            {gv('start') && <th data-col="start" onContextMenu={e => gridHeaderContextMenu(e, 'start', 'Start')} style={thStyle(colWidths.start, { background: COL_GROUP.sched.hdr })}>Start{resizeHandle('start')}</th>}
            {gv('end') && <th data-col="end" onContextMenu={e => gridHeaderContextMenu(e, 'end', 'End')} style={thStyle(colWidths.end, { background: COL_GROUP.sched.hdr })}>End{resizeHandle('end')}</th>}
            {gv('dur') && <th data-col="dur" onContextMenu={e => gridHeaderContextMenu(e, 'dur', 'Days')} style={thStyle(colWidths.dur, { background: COL_GROUP.sched.hdr })}>Days{resizeHandle('dur')}</th>}
            {gv('pred') && <th data-col="pred" onContextMenu={e => gridHeaderContextMenu(e, 'pred', 'Predecessor')} style={thStyle(colWidths.pred, { background: COL_GROUP.sched.hdr })}>Pred{resizeHandle('pred')}</th>}
            {gv('contour') && <th data-col="contour" onContextMenu={e => gridHeaderContextMenu(e, 'contour', 'Contour')} style={thStyle(colWidths.contour, { background: COL_GROUP.sched.hdr, borderRight: '2px solid #94a3b8' })}>Contour{resizeHandle('contour')}</th>}
            {/* Period columns (week / month / quarter) */}
            {months.map(m => (
              <th key={m.toISOString()} style={thStyle(monthColWidth, { borderRight: '1px solid #cbd5e1' })}>
                {periodLabel(m, period)}
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
                  months={months} period={period} mode={mode}
                  monthlyTotals={groupMonthlyTotals.get(group.costType) || {}}
                  colWidths={colWidths} monthColWidth={monthColWidth}
                  selectedItems={selectedItems}
                  onToggleGroupSelection={() => onToggleGroupSelection(group.costType)}
                  hiddenCols={gridHiddenCols}
                />
                {!isCollapsed && group.items.map(item => (
                  <GridRow key={item.id} item={item} allItems={allItems} months={months} period={period} mode={mode}
                    monthlyVals={allMonthlyValues.get(item.id) || {}} maxVal={maxVal}
                    colWidths={colWidths} monthColWidth={monthColWidth}
                    projectId={projectId}
                    laborRates={laborRates}
                    onUpdate={onUpdate} onEdit={onEdit}
                    isSelected={selectedItems.has(item.id)}
                    onToggleSelection={onToggleItem}
                    hiddenCols={gridHiddenCols} />
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
              const eH = parseNum(i.total_est_hours);
              const pi = jQ > 0 && jH > 0 ? jQ / jH : 0;
              return s + (pi > 0 ? Math.max(eQ / pi, jH) : jH > eH ? jH : eH);
            }, 0);
            const totProjCostField = items.reduce((s, i) => {
              const pct = parseNum(i.percent_complete);
              const jC = parseNum(i.total_jtd_cost);
              const eC = parseNum(i.total_est_cost);
              const p = pct > 0 ? Math.max(jC / (pct / 100), jC) : jC > eC ? jC : eC;
              return s + p;
            }, 0);
            const totProjCostVista = items.reduce((s, i) => {
              const vPC = parseNum(i.total_projected_cost);
              const jC = parseNum(i.total_jtd_cost);
              return s + (vPC > 0 ? Math.max(vPC, jC) : 0);
            }, 0);
            // Remaining totals: per-line so labor-rate edge cases stay local.
            const totRemCost = items.reduce((s, i) => {
              const vPC = parseNum(i.total_projected_cost);
              if (vPC <= 0) return s;
              return s + Math.max(0, vPC - parseNum(i.total_jtd_cost));
            }, 0);
            const totRemHrs = items.reduce((s, i) => {
              const vPC = parseNum(i.total_projected_cost);
              if (vPC <= 0) return s;
              const jC = parseNum(i.total_jtd_cost);
              const jH = parseNum(i.total_jtd_hours);
              const eC = parseNum(i.total_est_cost);
              const eH = parseNum(i.total_est_hours);
              const jtdRate = jH > 0 ? jC / jH : 0;
              const estRate = eH > 0 ? eC / eH : 0;
              const rate = jtdRate > 0 ? jtdRate : estRate;
              if (rate <= 0) return s;
              const remC = Math.max(0, vPC - jC);
              return s + remC / rate;
            }, 0);
            const totRemQty = items.reduce((s, i) => {
              const eQ = parseNum(i.quantity);
              const jQ = parseNum(i.quantity_installed);
              return s + Math.max(0, eQ - jQ);
            }, 0);
            // Overall schedule rollup
            let totEarliestStart: string | null = null;
            let totLatestEnd: string | null = null;
            items.forEach(i => {
              if (i.start_date && (!totEarliestStart || i.start_date < totEarliestStart)) totEarliestStart = i.start_date;
              if (i.end_date && (!totLatestEnd || i.end_date > totLatestEnd)) totLatestEnd = i.end_date;
            });
            const totDuration = getDuration(totEarliestStart, totLatestEnd);
            const tdTot: React.CSSProperties = { padding: '0.15rem 0.2rem', textAlign: 'center', borderTop: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', fontSize: '0.65rem', whiteSpace: 'nowrap' };
            return (
              <tr style={{ fontWeight: 600, background: '#f1f5f9' }}>
                <td style={{ position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 2, borderTop: '1px solid #94a3b8', borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1', width: colWidths.sel }}></td>
                <td style={{ ...tdTot, width: colWidths.rowNum, position: 'sticky', left: colWidths.sel, background: '#f1f5f9', zIndex: 2, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}></td>
                <td style={{ ...tdTot, width: colWidths.gcLink, position: 'sticky', left: colWidths.sel + colWidths.rowNum, background: '#f1f5f9', zIndex: 2, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}></td>
                <td style={{ position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink, background: '#f1f5f9', zIndex: 2, padding: '0.15rem 0.5rem', borderTop: '1px solid #94a3b8', borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1', fontSize: '0.72rem', width: colWidths.phase }}>
                  Totals
                </td>
                {gv('ct') && <td style={{ ...tdTot, width: colWidths.ct, position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink + colWidths.phase, background: '#f1f5f9', zIndex: 2, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #94a3b8' }}></td>}
                {/* Estimated totals */}
                {gv('estQty') && <td style={{ ...tdTot, width: colWidths.estQty, background: COL_GROUP.est.cell, borderLeft: '2px solid #94a3b8' }}>{totEstQty > 0 ? Math.round(totEstQty).toLocaleString() : ''}</td>}
                {gv('uom') && <td style={{ ...tdTot, width: colWidths.uom, background: COL_GROUP.est.cell }}></td>}
                {gv('estHrs') && <td style={{ ...tdTot, width: colWidths.estHrs, background: COL_GROUP.est.cell }}>{fmtHrs(totEstHrs)}</td>}
                {gv('estCost') && <td style={{ ...tdTot, width: colWidths.estCost, background: COL_GROUP.est.cell }}>{fmtCompact(totEstCost)}</td>}
                {gv('estPi') && <td style={{ ...tdTot, width: colWidths.estPi, borderRight: '2px solid #94a3b8', background: COL_GROUP.est.cell }}>{fmtPi(totEstQty, totEstHrs)}</td>}
                {/* JTD totals */}
                {gv('pctComp') && <td style={{ ...tdTot, width: colWidths.pctComp, background: COL_GROUP.jtd.cell }}>{totPctComp > 0 ? `${Math.round(totPctComp)}%` : ''}</td>}
                {gv('jtdQty') && <td style={{ ...tdTot, width: colWidths.jtdQty, background: COL_GROUP.jtd.cell }}>{totJtdQty > 0 ? Math.round(totJtdQty).toLocaleString() : ''}</td>}
                {gv('jtdHrs') && <td style={{ ...tdTot, width: colWidths.jtdHrs, background: COL_GROUP.jtd.cell }}>{fmtHrs(totJtdHrs)}</td>}
                {gv('jtdCost') && <td style={{ ...tdTot, width: colWidths.jtdCost, background: COL_GROUP.jtd.cell }}>{fmtCompact(totJtdCost)}</td>}
                {gv('jtdPi') && <td style={{ ...tdTot, width: colWidths.jtdPi, borderRight: '2px solid #94a3b8', background: COL_GROUP.jtd.cell }}>{fmtPi(totJtdQty, totJtdHrs)}</td>}
                {/* Projected totals */}
                {gv('projQty') && <td style={{ ...tdTot, width: colWidths.projQty, background: COL_GROUP.proj.cell }}>{totProjQty > 0 ? Math.round(totProjQty).toLocaleString() : ''}</td>}
                {gv('projHrs') && <td style={{ ...tdTot, width: colWidths.projHrs, background: COL_GROUP.proj.cell }}>{fmtHrs(totProjHrs)}</td>}
                {gv('projCostField') && (() => { const bl = totProjCostVista > 0 ? totProjCostVista : totEstCost; const pct = bl > 0 ? (totProjCostField - bl) / bl : 0; const bg = pct > 0.01 ? '#FFC7CE' : pct < -0.01 ? '#C6EFCE' : COL_GROUP.proj.cell; const fg = pct > 0.01 ? '#9C0006' : pct < -0.01 ? '#006100' : '#1e293b'; return <td style={{ ...tdTot, width: colWidths.projCostField, background: bg, color: fg }}>{fmtCompact(totProjCostField)}</td>; })()}
                {gv('projCostVista') && (() => { const pct = totEstCost > 0 ? (totProjCostVista - totEstCost) / totEstCost : 0; const bg = pct < -0.01 ? '#C6EFCE' : pct > 0.01 ? '#FFC7CE' : COL_GROUP.proj.cell; const fg = pct < -0.01 ? '#006100' : pct > 0.01 ? '#9C0006' : '#1e293b'; return <td style={{ ...tdTot, width: colWidths.projCostVista, background: bg, color: fg }}>{totProjCostVista > 0 ? fmtCompact(totProjCostVista) : '$0'}</td>; })()}
                {gv('projPi') && <td style={{ ...tdTot, width: colWidths.projPi, borderRight: '2px solid #94a3b8', background: COL_GROUP.proj.cell }}>{fmtPi(totProjQty, totProjHrs)}</td>}
                {/* Remaining totals */}
                {gv('remQty') && <td style={{ ...tdTot, width: colWidths.remQty, background: COL_GROUP.rem.cell }}>{totRemQty > 0 ? Math.round(totRemQty).toLocaleString() : ''}</td>}
                {gv('remHrs') && <td style={{ ...tdTot, width: colWidths.remHrs, background: COL_GROUP.rem.cell }}>{fmtHrs(totRemHrs)}</td>}
                {gv('remCost') && <td style={{ ...tdTot, width: colWidths.remCost, borderRight: '2px solid #94a3b8', background: COL_GROUP.rem.cell }}>{fmtCompact(totRemCost)}</td>}
                {/* Billing totals (Rate column is config-only — no rollup) */}
                {gv('rate') && <td style={{ ...tdTot, width: colWidths.rate, borderRight: '2px solid #94a3b8', background: COL_GROUP.bill.cell }}></td>}
                {/* Schedule totals */}
                {gv('start') && <td style={{ ...tdTot, width: colWidths.start, background: COL_GROUP.sched.cell, fontSize: '0.63rem' }}>{fmtDateShort(totEarliestStart)}</td>}
                {gv('end') && <td style={{ ...tdTot, width: colWidths.end, background: COL_GROUP.sched.cell, fontSize: '0.63rem' }}>{fmtDateShort(totLatestEnd)}</td>}
                {gv('dur') && <td style={{ ...tdTot, width: colWidths.dur, background: COL_GROUP.sched.cell }}>{totDuration || ''}</td>}
                {gv('pred') && <td style={{ ...tdTot, width: colWidths.pred, background: COL_GROUP.sched.cell }}></td>}
                {gv('contour') && <td style={{ ...tdTot, width: colWidths.contour, borderRight: '2px solid #94a3b8', background: COL_GROUP.sched.cell }}></td>}
                {/* Period totals */}
                {months.map(m => {
                  const key = periodKey(m, period);
                  const total = columnTotals[key] || 0;
                  return (
                    <td key={key} style={{ ...tdTot, width: monthColWidth }}>
                      {total > 0 ? ((mode === 'cost' || mode === 'billable') ? fmtCompact(total) : mode === 'manpower' ? total.toFixed(1) : total.toFixed(0)) : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })()}
        </tbody>
      </table>

      {/* Context menu + Column chooser for Grid */}
      {gridContextMenu && (
        <ColumnContextMenu
          x={gridContextMenu.x} y={gridContextMenu.y}
          colKey={gridContextMenu.key} colLabel={gridContextMenu.label}
          onHide={() => toggleGridCol(gridContextMenu.key)}
          onChooser={() => setShowGridChooser(true)}
          onClose={() => setGridContextMenu(null)}
        />
      )}
      {showGridChooser && (
        <ColumnChooserDialog
          columnDefs={GRID_COLUMN_DEFS}
          hiddenCols={gridHiddenCols}
          onToggle={toggleGridCol}
          onShowAll={() => setGridHiddenCols(new Set())}
          onClose={() => setShowGridChooser(false)}
        />
      )}
    </div>
  );
};

// Cost type summary row (collapsible group header)
const CostTypeSummaryRow: React.FC<{
  group: CostTypeGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  months: Date[];
  period: Period;
  mode: GridMode;
  monthlyTotals: Record<string, number>;
  colWidths: typeof GRID_COL_DEFAULTS;
  monthColWidth: number;
  selectedItems: Set<number>;
  onToggleGroupSelection: () => void;
  hiddenCols: Set<string>;
}> = ({ group, isCollapsed, onToggle, months, period, mode, monthlyTotals, colWidths, monthColWidth, selectedItems, onToggleGroupSelection, hiddenCols }) => {
  const sv = (col: string) => !hiddenCols.has(col);
  const checkRef = useRef<HTMLInputElement>(null);
  const allSelected = group.items.length > 0 && group.items.every(i => selectedItems.has(i.id));
  const someSelected = group.items.some(i => selectedItems.has(i.id));
  useEffect(() => {
    if (checkRef.current) checkRef.current.indeterminate = someSelected && !allSelected;
  }, [allSelected, someSelected]);

  const tdS: React.CSSProperties = {
    padding: '0.15rem 0.2rem', fontSize: '0.68rem', whiteSpace: 'nowrap',
    textAlign: 'center', fontWeight: 600, color: '#1e293b',
    borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1',
    backgroundColor: `${group.color}08`,
  };
  // Opaque equivalent of `${group.color}08` for sticky cells — same visual
  // tint when blended over white, but no transparency so non-sticky cells
  // can't bleed through during horizontal scroll.
  const opaqueTint = (() => {
    const c = group.color || '#cbd5e1';
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const a = 0.031; // matches the `08` alpha
    const blend = (ch: number) => Math.round((1 - a) * 255 + a * ch);
    return `rgb(${blend(r)},${blend(g)},${blend(b)})`;
  })();
  return (
    <tr style={{ cursor: 'pointer', backgroundColor: `${group.color}08` }} onClick={onToggle}>
      {/* Group selection checkbox */}
      <td style={{ ...tdS, textAlign: 'center', width: colWidths.sel, position: 'sticky', left: 0, backgroundColor: opaqueTint, zIndex: 2, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}
        onClick={e => e.stopPropagation()}>
        <input ref={checkRef} type="checkbox" checked={allSelected} onChange={onToggleGroupSelection}
          style={{ cursor: 'pointer' }} title={`Select all ${group.name} items`} />
      </td>
      {/* ID (empty for group) */}
      <td style={{ ...tdS, width: colWidths.rowNum, position: 'sticky', left: colWidths.sel, backgroundColor: opaqueTint, zIndex: 2, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}></td>
      {/* GC Link (empty for group) */}
      <td style={{ ...tdS, width: colWidths.gcLink, position: 'sticky', left: colWidths.sel + colWidths.rowNum, backgroundColor: opaqueTint, zIndex: 2, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}></td>
      {/* Phase name - cost type name with chevron */}
      <td style={{
        ...tdS, textAlign: 'left', position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink,
        backgroundColor: opaqueTint, zIndex: 2,
        borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1', padding: '0.4rem 0.5rem', width: colWidths.phase
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
      {sv('ct') && <td style={{ ...tdS, width: colWidths.ct, position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink + colWidths.phase, backgroundColor: opaqueTint, zIndex: 2, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #94a3b8' }}></td>}
      {/* Estimated */}
      {sv('estQty') && <td style={{ ...tdS, width: colWidths.estQty, backgroundColor: COL_GROUP.est.cell, borderLeft: '2px solid #94a3b8' }}>{group.estQty > 0 ? Math.round(group.estQty).toLocaleString() : ''}</td>}
      {sv('uom') && <td style={{ ...tdS, width: colWidths.uom, backgroundColor: COL_GROUP.est.cell }}></td>}
      {sv('estHrs') && <td style={{ ...tdS, width: colWidths.estHrs, backgroundColor: COL_GROUP.est.cell }}>{fmtHrs(group.estHrs)}</td>}
      {sv('estCost') && <td style={{ ...tdS, width: colWidths.estCost, backgroundColor: COL_GROUP.est.cell }}>{fmtCompact(group.estCost)}</td>}
      {sv('estPi') && <td style={{ ...tdS, width: colWidths.estPi, borderRight: '2px solid #94a3b8', backgroundColor: COL_GROUP.est.cell }}>{fmtPi(group.estQty, group.estHrs)}</td>}
      {/* JTD */}
      {sv('pctComp') && <td style={{ ...tdS, width: colWidths.pctComp, backgroundColor: COL_GROUP.jtd.cell }}>{group.pctComp > 0 ? `${Math.round(group.pctComp)}%` : ''}</td>}
      {sv('jtdQty') && <td style={{ ...tdS, width: colWidths.jtdQty, backgroundColor: COL_GROUP.jtd.cell }}>{group.jtdQty > 0 ? Math.round(group.jtdQty).toLocaleString() : ''}</td>}
      {sv('jtdHrs') && <td style={{ ...tdS, width: colWidths.jtdHrs, backgroundColor: COL_GROUP.jtd.cell }}>{fmtHrs(group.jtdHrs)}</td>}
      {sv('jtdCost') && <td style={{ ...tdS, width: colWidths.jtdCost, backgroundColor: COL_GROUP.jtd.cell }}>{fmtCompact(group.jtdCost)}</td>}
      {sv('jtdPi') && <td style={{ ...tdS, width: colWidths.jtdPi, borderRight: '2px solid #94a3b8', backgroundColor: COL_GROUP.jtd.cell }}>{fmtPi(group.jtdQty, group.jtdHrs)}</td>}
      {/* Projected (color coded vs estimate) */}
      {sv('projQty') && <td style={{ ...tdS, width: colWidths.projQty, backgroundColor: COL_GROUP.proj.cell }}>{group.projQty > 0 ? Math.round(group.projQty).toLocaleString() : ''}</td>}
      {sv('projHrs') && <td style={{ ...tdS, width: colWidths.projHrs, backgroundColor: COL_GROUP.proj.cell, color: group.projHrs > group.estHrs ? '#ef4444' : group.projHrs < group.estHrs ? '#10b981' : '#1e293b' }}>{fmtHrs(group.projHrs)}</td>}
      {sv('projCostField') && (() => { const bl = group.projCostVista > 0 ? group.projCostVista : group.estCost; const pct = bl > 0 ? (group.projCostField - bl) / bl : 0; const bg = pct > 0.01 ? '#FFC7CE' : pct < -0.01 ? '#C6EFCE' : COL_GROUP.proj.cell; const fg = pct > 0.01 ? '#9C0006' : pct < -0.01 ? '#006100' : '#1e293b'; return <td style={{ ...tdS, width: colWidths.projCostField, backgroundColor: bg, color: fg }}>{fmtCompact(group.projCostField)}</td>; })()}
      {sv('projCostVista') && (() => { const pct = group.estCost > 0 ? (group.projCostVista - group.estCost) / group.estCost : 0; const bg = pct < -0.01 ? '#C6EFCE' : pct > 0.01 ? '#FFC7CE' : COL_GROUP.proj.cell; const fg = pct < -0.01 ? '#006100' : pct > 0.01 ? '#9C0006' : '#1e293b'; return <td style={{ ...tdS, width: colWidths.projCostVista, backgroundColor: bg, color: fg }}>{group.projCostVista > 0 ? fmtCompact(group.projCostVista) : '$0'}</td>; })()}
      {sv('projPi') && <td style={{ ...tdS, width: colWidths.projPi, borderRight: '2px solid #94a3b8', backgroundColor: COL_GROUP.proj.cell, color: (() => { const ePi = group.estHrs > 0 ? group.estQty / group.estHrs : 0; const pPi = group.projHrs > 0 ? group.projQty / group.projHrs : 0; return pPi < ePi ? '#ef4444' : pPi > ePi ? '#10b981' : '#1e293b'; })() }}>{fmtPi(group.projQty, group.projHrs)}</td>}
      {/* Remaining */}
      {sv('remQty') && <td style={{ ...tdS, width: colWidths.remQty, backgroundColor: COL_GROUP.rem.cell }}>{group.remQty > 0 ? Math.round(group.remQty).toLocaleString() : ''}</td>}
      {sv('remHrs') && <td style={{ ...tdS, width: colWidths.remHrs, backgroundColor: COL_GROUP.rem.cell }}>{fmtHrs(group.remHrs)}</td>}
      {sv('remCost') && <td style={{ ...tdS, width: colWidths.remCost, borderRight: '2px solid #94a3b8', backgroundColor: COL_GROUP.rem.cell }}>{fmtCompact(group.remCost)}</td>}
      {/* Billing (Rate column is config-only — blank at group level) */}
      {sv('rate') && <td style={{ ...tdS, width: colWidths.rate, borderRight: '2px solid #94a3b8', backgroundColor: COL_GROUP.bill.cell }}></td>}
      {/* Schedule */}
      {sv('start') && <td style={{ ...tdS, width: colWidths.start, textAlign: 'center', fontSize: '0.63rem', backgroundColor: COL_GROUP.sched.cell }}>{fmtDateShort(group.earliestStart)}</td>}
      {sv('end') && <td style={{ ...tdS, width: colWidths.end, textAlign: 'center', fontSize: '0.63rem', backgroundColor: COL_GROUP.sched.cell }}>{fmtDateShort(group.latestEnd)}</td>}
      {sv('dur') && <td style={{ ...tdS, width: colWidths.dur, textAlign: 'center', backgroundColor: COL_GROUP.sched.cell }}>{group.duration || ''}</td>}
      {sv('pred') && <td style={{ ...tdS, width: colWidths.pred, backgroundColor: COL_GROUP.sched.cell }}></td>}
      {sv('contour') && <td style={{ ...tdS, width: colWidths.contour, borderRight: '2px solid #94a3b8', backgroundColor: COL_GROUP.sched.cell }}></td>}
      {/* Period subtotals */}
      {months.map(m => {
        const key = periodKey(m, period);
        const val = monthlyTotals[key] || 0;
        return (
          <td key={key} style={{
            ...tdS, borderRight: '1px solid #cbd5e1', width: monthColWidth,
            backgroundColor: val > 0 ? `${group.color}15` : `${group.color}08`,
            fontSize: '0.63rem'
          }}>
            {val > 0 ? ((mode === 'cost' || mode === 'billable') ? fmtCompact(val) : mode === 'manpower' ? val.toFixed(1) : val.toFixed(0)) : ''}
          </td>
        );
      })}
    </tr>
  );
};

// Grid row with inline editing
const GridRow: React.FC<{
  item: PhaseScheduleItem;
  allItems: PhaseScheduleItem[];
  months: Date[];
  period: Period;
  mode: GridMode;
  monthlyVals: Record<string, number>;
  maxVal: number;
  colWidths: typeof GRID_COL_DEFAULTS;
  monthColWidth: number;
  projectId: number;
  laborRates: ProjectLaborRate[];
  onUpdate: (id: number, data: Partial<PhaseScheduleItem>) => void;
  onEdit: (item: PhaseScheduleItem) => void;
  isSelected: boolean;
  onToggleSelection: (id: number) => void;
  hiddenCols: Set<string>;
}> = React.memo(({ item, allItems, months, period, mode, monthlyVals, maxVal, colWidths, monthColWidth, projectId, laborRates, onUpdate, onEdit, isSelected, onToggleSelection, hiddenCols }) => {
  const rv = (col: string) => !hiddenCols.has(col);
  const dur = getDuration(item.start_date, item.end_date);
  const dateLocked = (item.linked_resolved_count || 0) > 0;

  // Computed values
  const estQty = parseNum(item.quantity);
  const estHrs = parseNum(item.total_est_hours);
  const estCost = parseNum(item.total_est_cost);
  const jtdQty = parseNum(item.quantity_installed);
  const jtdHrs = parseNum(item.total_jtd_hours);
  const jtdCost = parseNum(item.total_jtd_cost);
  const pctComp = parseNum(item.percent_complete);
  const jtdPi = jtdQty > 0 && jtdHrs > 0 ? jtdQty / jtdHrs : 0;
  // Projected costs: Field = extrapolated from % complete; Vista = from ERP
  const vistaProjCost = parseNum(item.total_projected_cost);
  const projQty = estQty; // scope doesn't change
  const projHrs = jtdPi > 0 ? Math.max(estQty / jtdPi, jtdHrs) : jtdHrs > estHrs ? jtdHrs : estHrs;
  // Field projection: always calculated from progress
  const projCostField = pctComp > 0 ? Math.max(jtdCost / (pctComp / 100), jtdCost)
    : jtdCost > estCost ? jtdCost
    : estCost;
  // Vista projection: ERP value (0 if not available)
  const projCostVista = vistaProjCost > 0 ? Math.max(vistaProjCost, jtdCost) : 0;
  // Remaining (only meaningful when Vista projection exists): cost = ProjVista − JTD;
  // hours = Remaining cost ÷ labor rate (JTD $ / JTD hrs, falling back to Est $ / Est hrs
  // when no JTD hours have posted yet); qty = ProjQty − JTD qty.
  const remCost = projCostVista > 0 ? Math.max(0, projCostVista - jtdCost) : 0;
  const jtdLaborRate = jtdHrs > 0 ? jtdCost / jtdHrs : 0;
  const estLaborRate = estHrs > 0 ? estCost / estHrs : 0;
  const effLaborRate = jtdLaborRate > 0 ? jtdLaborRate : estLaborRate;
  const remHrs = effLaborRate > 0 ? remCost / effLaborRate : 0;
  const remQty = Math.max(0, projQty - jtdQty);
  // Excel-style conditional shading: 1% tolerance to avoid false positives from rounding
  const costStyle = (proj: number, baseline: number): { background: string; color: string } => {
    if (baseline === 0 || proj === 0) return { background: '', color: '#1e293b' };
    const pct = (proj - baseline) / baseline;
    if (pct > 0.01) return { background: '#FFC7CE', color: '#9C0006' }; // over → pink
    if (pct < -0.01) return { background: '#C6EFCE', color: '#006100' }; // under → green
    return { background: '', color: '#1e293b' }; // neutral
  };

  const handleFieldChange = useCallback((field: string, value: any) => {
    if (field === 'duration') {
      if (value > 0 && item.start_date) {
        const newEnd = format(addDays(ymdToDate(item.start_date)!, value - 1), 'yyyy-MM-dd');
        onUpdate(item.id, { end_date: newEnd } as any);
      }
    } else if (field === 'predecessor') {
      const predRowNum = value ? parseInt(value) : null;
      if (predRowNum === null) {
        onUpdate(item.id, { predecessor_id: null } as any);
        return;
      }
      const predItem = allItems.find(i => i.row_number === predRowNum);
      if (!predItem) return;
      const updates: any = { predecessor_id: predRowNum };
      if (predItem.end_date) {
        updates.start_date = format(addDays(ymdToDate(predItem.end_date)!, 1), 'yyyy-MM-dd');
        if (dur > 0 && updates.start_date) {
          updates.end_date = format(addDays(ymdToDate(updates.start_date)!, dur - 1), 'yyyy-MM-dd');
        }
      }
      onUpdate(item.id, updates);
    } else if (field === 'percent_complete') {
      // Bidirectional: %Comp → calculate JTD Qty from Est Qty
      const pct = Math.round(parseFloat(value) || 0);
      const updates: any = { percent_complete: pct };
      if (estQty > 0) {
        updates.quantity_installed = Math.round(estQty * pct / 100 * 100) / 100;
      }
      onUpdate(item.id, updates);
    } else if (field === 'quantity_installed') {
      // Bidirectional: JTD Qty → calculate %Comp from Est Qty
      const updates: any = { quantity_installed: value ?? 0 };
      if (estQty > 0) {
        updates.percent_complete = Math.round((value ?? 0) / estQty * 100);
      }
      onUpdate(item.id, updates);
    } else {
      onUpdate(item.id, { [field]: value } as any);
    }
  }, [item.id, item.start_date, dur, estQty, allItems, onUpdate]);

  const tdBase: React.CSSProperties = {
    padding: '0.15rem 0.2rem', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1',
    fontSize: '0.68rem', overflow: 'hidden'
  };
  const tdData: React.CSSProperties = {
    ...tdBase, textAlign: 'center', color: '#1e293b', whiteSpace: 'nowrap'
  };
  const tdMuted: React.CSSProperties = {
    ...tdBase, textAlign: 'center', color: '#64748b', whiteSpace: 'nowrap'
  };
  const inlineCtrl: React.CSSProperties = {
    padding: '0 0.25rem', fontSize: '0.68rem', border: 'none', borderRadius: 0,
    background: 'transparent', color: '#1e293b', fontFamily: 'inherit',
    cursor: 'pointer', boxSizing: 'border-box' as const, width: '100%', outline: 'none',
    textAlign: 'center' as const
  };

  // Selection-aware background: selected row overrides group tints
  const bg = (tint: string) => isSelected ? '#eff6ff' : tint;
  // Editable cell = white, Read-only cell = group tint
  const editBg = bg('#fff');

  return (
    <tr style={{ backgroundColor: isSelected ? '#eff6ff' : undefined }}>
      {/* Selection checkbox */}
      <td style={{ ...tdBase, textAlign: 'center', width: colWidths.sel, position: 'sticky', left: 0, backgroundColor: isSelected ? '#eff6ff' : '#fff', zIndex: 1, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelection(item.id)} style={{ cursor: 'pointer' }} />
      </td>
      {/* Row number (ID) */}
      <td style={{ ...tdBase, textAlign: 'center', width: colWidths.rowNum, fontSize: '0.63rem', color: '#64748b', position: 'sticky', left: colWidths.sel, backgroundColor: isSelected ? '#eff6ff' : '#fff', zIndex: 1, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}>
        {item.row_number}
      </td>
      {/* GC schedule link */}
      <td style={{ ...tdBase, textAlign: 'center', width: colWidths.gcLink, position: 'sticky', left: colWidths.sel + colWidths.rowNum, backgroundColor: isSelected ? '#eff6ff' : '#fff', zIndex: 1, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1' }}>
        <PhaseGCLinkChips item={item} projectId={projectId} variant="badge" compact />
      </td>
      {/* Phase name - click to open edit panel */}
      <td style={{ ...tdBase, position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink, backgroundColor: isSelected ? '#eff6ff' : '#fff', zIndex: 1, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #cbd5e1', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: colWidths.phase, maxWidth: colWidths.phase, cursor: 'pointer', fontSize: '0.7rem', color: '#1e293b' }}
        onClick={() => onEdit(item)} title={item.name}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {item.cost_types?.map(ct => (
            <span key={ct} style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COST_TYPE_COLORS[ct], flexShrink: 0 }} title={COST_TYPE_NAMES[ct]} />
          ))}
          {item.phase_code_display && (
            <span style={{ color: '#64748b', flexShrink: 0 }}>{item.phase_code_display} -</span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        </div>
      </td>
      {/* Cost Types (read-only) */}
      {rv('ct') && <td style={{ ...tdBase, textAlign: 'center', fontSize: '0.6rem', color: '#64748b', width: colWidths.ct, position: 'sticky', left: colWidths.sel + colWidths.rowNum + colWidths.gcLink + colWidths.phase, backgroundColor: isSelected ? '#eff6ff' : '#fff', zIndex: 1, borderRight: 'none', boxShadow: 'inset -1px 0 0 0 #94a3b8' }}>
        {item.cost_types?.map(ct => COST_TYPE_NAMES[ct]?.charAt(0)).join('')}
      </td>}

      {/* === ESTIMATED GROUP === */}
      {rv('estQty') && <td style={{ ...tdBase, width: colWidths.estQty, background: editBg, borderLeft: '2px solid #94a3b8' }}>
        <input type="text" defaultValue={parseNum(item.quantity) ? Math.round(parseNum(item.quantity)).toLocaleString() : ''} placeholder="-"
          onFocus={e => {
            e.target.value = e.target.value.replace(/,/g, '');
            e.target.type = 'number';
            e.target.select();
          }}
          onBlur={e => {
            const v = e.target.value ? parseFloat(e.target.value) : null;
            const rounded = v !== null ? Math.round(v) : null;
            e.target.type = 'text';
            e.target.value = rounded ? rounded.toLocaleString() : '';
            if (v !== parseNum(item.quantity)) handleFieldChange('quantity', v);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'center' }}
        />
      </td>}
      {rv('uom') && <td style={{ ...tdBase, width: colWidths.uom, background: editBg }}>
        <select value={item.quantity_uom || ''} onChange={e => handleFieldChange('quantity_uom', e.target.value || null)}
          style={{ ...inlineCtrl }}>
          <option value="">-</option>
          {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>}
      {rv('estHrs') && <td style={{ ...tdData, width: colWidths.estHrs, background: bg(COL_GROUP.est.cell) }}>{fmtHrs(estHrs)}</td>}
      {rv('estCost') && <td style={{ ...tdData, fontWeight: 500, width: colWidths.estCost, background: bg(COL_GROUP.est.cell) }}>{fmtCompact(estCost)}</td>}
      {rv('estPi') && <td style={{ ...tdMuted, width: colWidths.estPi, borderRight: '2px solid #94a3b8', background: bg(COL_GROUP.est.cell) }}>{fmtPi(estQty, estHrs)}</td>}

      {/* === JTD GROUP === */}
      {rv('pctComp') && <td style={{ ...tdBase, width: colWidths.pctComp, background: editBg }}>
        <input key={`pct-${item.id}-${item.percent_complete}`}
          type="text" defaultValue={parseNum(item.percent_complete) ? `${Math.round(parseNum(item.percent_complete))}%` : ''} placeholder="-"
          onFocus={e => {
            const raw = e.target.value.replace('%', '');
            e.target.value = raw;
            e.target.type = 'number';
            e.target.select();
          }}
          onBlur={e => {
            const v = e.target.value ? parseFloat(e.target.value) : 0;
            const rounded = Math.round(v);
            e.target.type = 'text';
            e.target.value = rounded > 0 ? `${rounded}%` : '';
            if (rounded !== Math.round(parseNum(item.percent_complete))) handleFieldChange('percent_complete', rounded);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'center' }}
        />
      </td>}
      {rv('jtdQty') && <td style={{ ...tdBase, width: colWidths.jtdQty, background: editBg }}>
        <input key={`qi-${item.id}-${item.quantity_installed}`}
          type="text" defaultValue={parseNum(item.quantity_installed) ? Math.round(parseNum(item.quantity_installed)).toLocaleString() : ''} placeholder="-"
          onFocus={e => {
            e.target.value = e.target.value.replace(/,/g, '');
            e.target.type = 'number';
            e.target.select();
          }}
          onBlur={e => {
            const v = e.target.value ? parseFloat(e.target.value) : null;
            const rounded = v !== null ? Math.round(v) : null;
            e.target.type = 'text';
            e.target.value = rounded ? rounded.toLocaleString() : '';
            if (v !== parseNum(item.quantity_installed)) handleFieldChange('quantity_installed', v ?? 0);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'center' }}
        />
      </td>}
      {rv('jtdHrs') && <td style={{ ...tdData, width: colWidths.jtdHrs, background: bg(COL_GROUP.jtd.cell) }}>{fmtHrs(jtdHrs)}</td>}
      {rv('jtdCost') && <td style={{ ...tdData, width: colWidths.jtdCost, background: bg(COL_GROUP.jtd.cell) }}>{fmtCompact(jtdCost)}</td>}
      {rv('jtdPi') && <td style={{ ...tdMuted, width: colWidths.jtdPi, borderRight: '2px solid #94a3b8', background: bg(COL_GROUP.jtd.cell) }}>{fmtPi(jtdQty, jtdHrs)}</td>}

      {/* === PROJECTED GROUP === */}
      {rv('projQty') && <td style={{ ...tdMuted, width: colWidths.projQty, background: bg(COL_GROUP.proj.cell) }}>
        {projQty > 0 ? Math.round(projQty).toLocaleString() : '-'}
      </td>}
      {rv('projHrs') && <td style={{ ...tdMuted, width: colWidths.projHrs, background: bg(COL_GROUP.proj.cell), color: projHrs > estHrs ? '#ef4444' : projHrs < estHrs ? '#10b981' : '#64748b' }}>
        {fmtHrs(projHrs)}
      </td>}
      {rv('projCostField') && (() => { const cs = costStyle(projCostField, projCostVista > 0 ? projCostVista : estCost); return <td style={{ ...tdData, width: colWidths.projCostField, fontWeight: 500, background: cs.background || bg(COL_GROUP.proj.cell), color: cs.color }}>{fmtCompact(projCostField)}</td>; })()}
      {rv('projCostVista') && (() => { const cs = projCostVista > 0 ? costStyle(projCostVista, estCost) : estCost > 0 ? { background: '#C6EFCE', color: '#006100' } : { background: '', color: '#cbd5e1' }; return <td style={{ ...tdData, width: colWidths.projCostVista, background: cs.background || bg(COL_GROUP.proj.cell), color: cs.color }}>{projCostVista > 0 ? fmtCompact(projCostVista) : '$0'}</td>; })()}
      {rv('projPi') && <td style={{ ...tdMuted, width: colWidths.projPi, borderRight: '2px solid #94a3b8', background: bg(COL_GROUP.proj.cell), color: (() => { const ePi = estHrs > 0 ? estQty / estHrs : 0; const pPi = projHrs > 0 ? projQty / projHrs : 0; return pPi < ePi ? '#ef4444' : pPi > ePi ? '#10b981' : '#64748b'; })() }}>
        {fmtPi(projQty, projHrs)}
      </td>}

      {/* === REMAINING GROUP === */}
      {rv('remQty') && <td style={{ ...tdMuted, width: colWidths.remQty, background: bg(COL_GROUP.rem.cell) }}>
        {remQty > 0 ? Math.round(remQty).toLocaleString() : '-'}
      </td>}
      {rv('remHrs') && <td style={{ ...tdMuted, width: colWidths.remHrs, background: bg(COL_GROUP.rem.cell) }}>
        {fmtHrs(remHrs)}
      </td>}
      {rv('remCost') && <td style={{ ...tdData, width: colWidths.remCost, borderRight: '2px solid #94a3b8', fontWeight: 500, background: bg(COL_GROUP.rem.cell) }}>
        {fmtCompact(remCost)}
      </td>}

      {/* === BILLING GROUP (Rate dropdown — labor lines only) === */}
      {rv('rate') && (() => {
        const isLabor = (item.cost_types?.[0] || 0) === 1;
        if (!isLabor) {
          return (
            <td style={{ ...tdMuted, width: colWidths.rate, borderRight: '2px solid #94a3b8', background: bg(COL_GROUP.bill.cell), color: '#cbd5e1' }}>—</td>
          );
        }
        return (
          <td style={{ ...tdBase, width: colWidths.rate, borderRight: '2px solid #94a3b8', background: bg(COL_GROUP.bill.cell) }}>
            <select
              value={item.billable_rate_id ?? ''}
              onChange={e => {
                const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                if (v !== (item.billable_rate_id ?? null)) onUpdate(item.id, { billable_rate_id: v });
              }}
              style={{ ...inlineCtrl }}
              title={item.billable_rate_id ? undefined : 'No rate assigned — line is unrated in $ Billable mode'}
            >
              <option value="">— unrated —</option>
              {laborRates.map(r => (
                <option key={r.id} value={r.id}>{r.label} (${Number(r.billable_rate).toFixed(0)}/hr)</option>
              ))}
            </select>
          </td>
        );
      })()}

      {/* === SCHEDULE GROUP === */}
      {rv('start') && <td style={{ ...tdBase, textAlign: 'center', width: colWidths.start, background: dateLocked ? '#f1f5f9' : editBg, position: 'relative' as const }}
        title={dateLocked ? 'Date is driven by linked GC schedule activities — unlink from the Link column to edit manually.' : undefined}>
        <span style={{ fontSize: '0.68rem', color: item.start_date ? '#1e293b' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {dateLocked && <span style={{ color: '#0891b2' }}>🔗</span>}
          {fmtDateShort(item.start_date) || '-'}
        </span>
        {!dateLocked && (
          <input type="date" className="date-no-icon" value={fmtDate(item.start_date)}
            onChange={e => handleFieldChange('start_date', e.target.value || null)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
        )}
      </td>}
      {rv('end') && <td style={{ ...tdBase, textAlign: 'center', width: colWidths.end, background: dateLocked ? '#f1f5f9' : editBg, position: 'relative' as const }}
        title={dateLocked ? 'Date is driven by linked GC schedule activities — unlink from the Link column to edit manually.' : undefined}>
        <span style={{ fontSize: '0.68rem', color: item.end_date ? '#1e293b' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {dateLocked && <span style={{ color: '#0891b2' }}>🔗</span>}
          {fmtDateShort(item.end_date) || '-'}
        </span>
        {!dateLocked && (
          <input type="date" className="date-no-icon" value={fmtDate(item.end_date)}
            onChange={e => handleFieldChange('end_date', e.target.value || null)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
        )}
      </td>}
      {rv('dur') && <td style={{ ...tdBase, width: colWidths.dur, background: editBg }}>
        <input type="number" defaultValue={dur || ''} min={1} placeholder="-"
          onFocus={e => e.target.select()}
          onBlur={e => {
            const v = parseInt(e.target.value) || 0;
            if (v > 0 && v !== dur) handleFieldChange('duration', v);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'center' }}
        />
      </td>}
      {rv('pred') && <td style={{ ...tdBase, width: colWidths.pred, background: editBg }}>
        <input key={`pred-${item.id}-${item.predecessor_id}`}
          type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={item.predecessor_id || ''} placeholder="-"
          onFocus={e => e.target.select()}
          onBlur={e => {
            const v = e.target.value ? parseInt(e.target.value) : null;
            if (v !== (item.predecessor_id || null)) handleFieldChange('predecessor', v);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineCtrl, textAlign: 'center' }}
        />
      </td>}
      {rv('contour') && <td style={{ ...tdBase, borderRight: '2px solid #94a3b8', width: colWidths.contour, background: editBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <ContourVisual contour={(item.contour_type || 'flat') as ContourType} />
          <select value={item.contour_type || 'flat'} onChange={e => handleFieldChange('contour_type', e.target.value)}
            style={{ ...inlineCtrl }}>
            {contourOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </td>}

      {/* Monthly value columns */}
      {months.map(m => {
        const key = periodKey(m, period);
        const val = monthlyVals[key] || 0;
        const intensity = maxVal > 0 ? val / maxVal : 0;
        const bgColor = val > 0 ? `rgba(59, 130, 246, ${0.05 + intensity * 0.25})` : 'transparent';
        return (
          <td key={key} style={{ padding: '0.15rem 0.2rem', textAlign: 'center', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontSize: '0.63rem', backgroundColor: bgColor, whiteSpace: 'nowrap', width: monthColWidth, color: val > 0 ? '#1e293b' : '#cbd5e1' }}>
            {val > 0 ? ((mode === 'cost' || mode === 'billable') ? fmtCompact(val) : mode === 'manpower' ? val.toFixed(1) : val.toFixed(0)) : ''}
          </td>
        );
      })}
    </tr>
  );
});

// ===== BULK EDIT BAR (for multi-select) =====
const BulkEditBar: React.FC<{
  items: PhaseScheduleItem[];
  selectedItems: Set<number>;
  bulkEditValues: { start_date: string; end_date: string; duration: string; contour_type: string };
  onBulkEditChange: (v: { start_date: string; end_date: string; duration: string; contour_type: string }) => void;
  onApply: () => void;
  onClear: () => void;
  bulkUpdating: boolean;
}> = ({ items, selectedItems, bulkEditValues, onBulkEditChange, onApply, onClear, bulkUpdating }) => {
  const selectedCount = selectedItems.size;
  const undatedCount = items.filter(i => !i.start_date || !i.end_date).length;

  const handleDurationChange = (val: string) => {
    const dur = parseInt(val);
    if (dur > 0 && bulkEditValues.start_date) {
      const parts = bulkEditValues.start_date.split('-');
      const sd = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const newEnd = format(addDays(sd, dur - 1), 'yyyy-MM-dd');
      onBulkEditChange({ ...bulkEditValues, duration: val, end_date: newEnd });
    } else {
      onBulkEditChange({ ...bulkEditValues, duration: val });
    }
  };

  const inputStyle: React.CSSProperties = { padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.2rem' };

  if (selectedCount === 0) {
    return (
      <div className="card" style={{ marginBottom: '0.75rem', padding: '0.5rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {undatedCount > 0 ? (
            <span style={{ fontSize: '0.82rem', color: '#f59e0b', fontWeight: 500 }}>{undatedCount} item{undatedCount !== 1 ? 's' : ''} without dates</span>
          ) : (
            <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 500 }}>All items have dates assigned</span>
          )}
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>— Select items using checkboxes to bulk edit</span>
        </div>
      </div>
    );
  }

  const hasValues = bulkEditValues.start_date || bulkEditValues.end_date || bulkEditValues.duration || bulkEditValues.contour_type;
  return (
    <div className="card" style={{ marginBottom: '0.75rem', padding: '0.6rem 1.5rem', border: '2px solid #3b82f6', backgroundColor: '#eff6ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button onClick={onClear} style={{ background: 'none', border: 'none', fontSize: '0.8rem', cursor: 'pointer', color: '#64748b', textDecoration: 'underline' }}>
          Clear Selection
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Start Date</label>
          <input type="date" value={bulkEditValues.start_date}
            onChange={e => onBulkEditChange({ ...bulkEditValues, start_date: e.target.value })}
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>End Date</label>
          <input type="date" value={bulkEditValues.end_date}
            onChange={e => onBulkEditChange({ ...bulkEditValues, end_date: e.target.value, duration: '' })}
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Duration (days)</label>
          <input type="number" value={bulkEditValues.duration} min={1}
            onChange={e => handleDurationChange(e.target.value)}
            placeholder="-" style={{ ...inputStyle, width: '80px' }} />
        </div>
        <div>
          <label style={labelStyle}>Contour</label>
          <select value={bulkEditValues.contour_type}
            onChange={e => onBulkEditChange({ ...bulkEditValues, contour_type: e.target.value })}
            style={inputStyle}>
            <option value="">— No Change —</option>
            {contourOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <button onClick={onApply} disabled={!hasValues || bulkUpdating}
          style={{
            padding: '0.4rem 1.25rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500,
            cursor: hasValues && !bulkUpdating ? 'pointer' : 'default',
            backgroundColor: hasValues && !bulkUpdating ? '#3b82f6' : '#d1d5db', color: 'white'
          }}>
          {bulkUpdating ? 'Applying...' : `Apply to ${selectedCount} Item${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
};

// ===== BILLING RATES MODAL =====
// Edits the project's per-cost-type markup % (Material/Subs/Rentals/Equipment/Gen Conds)
// and the labor rate pool. The pool feeds the per-line Rate dropdown in the grid.
const BILLABLE_MARKUP_FIELDS: { key: keyof Project; label: string; ct: number; hint?: string }[] = [
  { key: 'billing_markup_labor',     label: 'Labor',              ct: 1, hint: 'Used for labor lines that have no rate assigned (cost-plus billing).' },
  { key: 'billing_markup_material',  label: 'Material',           ct: 2 },
  { key: 'billing_markup_subs',      label: 'Subcontracts',       ct: 3 },
  { key: 'billing_markup_rentals',   label: 'Rentals',            ct: 4 },
  { key: 'billing_markup_equipment', label: 'MEP Equipment',      ct: 5 },
  { key: 'billing_markup_genconds',  label: 'General Conditions', ct: 6 },
];

// ── Export Options Modal ──────────────────────────────────────────────────
const EXPORT_GROUPS = [
  { key: 'est',     label: 'Estimated' },
  { key: 'jtd',     label: 'JTD' },
  { key: 'proj',    label: 'Projected' },
  { key: 'rem',     label: 'Remaining' },
  { key: 'sched',   label: 'Schedule' },
  { key: 'bill',    label: 'Billing' },
  { key: 'monthly', label: 'Monthly Distribution' },
] as const;

const ExportOptionsModal: React.FC<{
  initialMode: GridMode;
  initialShift: string;
  onExport: (format: 'pdf' | 'excel', mode: GridMode, shift: string, groups: string[]) => void;
  onClose: () => void;
  loading: boolean;
}> = ({ initialMode, initialShift, onExport, onClose, loading }) => {
  const [format, setFormat]   = useState<'pdf' | 'excel'>('pdf');
  const [mode, setMode]       = useState<GridMode>(initialMode === 'manpower' || initialMode === 'billable' ? initialMode : initialMode);
  const [shift, setShift]     = useState(initialShift);
  const [groups, setGroups]   = useState<Set<string>>(new Set(EXPORT_GROUPS.map(g => g.key)));

  const toggleGroup = (key: string) =>
    setGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'white', borderRadius: '10px', padding: '1.5rem', width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Export Phase Schedule</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
        </div>

        {/* Format */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Format</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['pdf', 'excel'] as const).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                style={{ flex: 1, padding: '0.5rem', border: `2px solid ${format === f ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '6px',
                  background: format === f ? '#eff6ff' : 'white', color: format === f ? '#2563eb' : '#1e293b',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: format === f ? 600 : 400 }}>
                {f === 'pdf' ? '📄 PDF' : '📊 Excel'}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Distribution Mode</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {([['cost','$ Cost'],['qty','Qty'],['manpower','Manpower'],['billable','$ Billable']] as [GridMode,string][]).map(([m, lbl]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: '0.35rem 0.7rem', border: `2px solid ${mode === m ? '#10b981' : '#e2e8f0'}`, borderRadius: '6px',
                  background: mode === m ? '#f0fdf4' : 'white', color: mode === m ? '#059669' : '#1e293b',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: mode === m ? 600 : 400 }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Shift (manpower only) */}
        {mode === 'manpower' && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Work Shift</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {SHIFT_OPTIONS.map(s => (
                <button key={s} onClick={() => setShift(s)}
                  style={{ flex: 1, padding: '0.35rem', border: `2px solid ${shift === s ? '#7c3aed' : '#e2e8f0'}`, borderRadius: '6px',
                    background: shift === s ? '#f5f3ff' : 'white', color: shift === s ? '#7c3aed' : '#1e293b',
                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: shift === s ? 600 : 400 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Column groups */}
        <div style={{ marginBottom: '1.4rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Column Groups</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem' }}>
            {EXPORT_GROUPS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                <input type="checkbox" checked={groups.has(key)} onChange={() => toggleGroup(key)}
                  style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>
            Cancel
          </button>
          <button onClick={() => onExport(format, mode, shift, [...groups])} disabled={loading || groups.size === 0}
            style={{ padding: '0.5rem 1.2rem', border: 'none', borderRadius: '6px',
              background: loading || groups.size === 0 ? '#94a3b8' : '#3b82f6', color: 'white',
              cursor: loading || groups.size === 0 ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            {loading ? 'Exporting…' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const BillingRatesModal: React.FC<{
  projectId: number;
  project: Project;
  rates: ProjectLaborRate[];
  onClose: () => void;
}> = ({ projectId, project, rates, onClose }) => {
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();

  const saveProject = useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.update(projectId, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['project'] }); },
    onError: () => { toast.error('Failed to save markup'); },
  });

  const createRate = useMutation({
    mutationFn: () => projectLaborRatesApi.create(projectId, { label: 'New Rate', billable_rate: 0 }).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projectLaborRates'] }); },
  });
  const updateRate = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { label?: string; billable_rate?: number } }) =>
      projectLaborRatesApi.update(id, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projectLaborRates'] }); },
  });
  const deleteRate = useMutation({
    mutationFn: (id: number) => projectLaborRatesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projectLaborRates'] }); },
  });

  const onMarkupBlur = (key: keyof Project, raw: string) => {
    const v = raw === '' ? 0 : parseFloat(raw);
    if (isNaN(v) || v < 0) return;
    if (v === (project[key] ?? 0)) return;
    saveProject.mutate({ [key]: v } as Partial<Project>);
  };

  const fmtPct = (v: number | null | undefined) =>
    v === null || v === undefined ? '0' : String(v);

  const inputStyle: React.CSSProperties = {
    padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.85rem', width: '100%', boxSizing: 'border-box'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>Billing Rates &amp; Markups</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.5rem' }}>
          {/* Markups */}
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#1e293b' }}>Markup % by Cost Type</h3>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.72rem', color: '#64748b' }}>
            Applied to remaining cost on non-labor lines (e.g. 15.5 means +15.5%).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.4rem 0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            {BILLABLE_MARKUP_FIELDS.map(f => (
              <React.Fragment key={f.key as string}>
                <label style={{ fontSize: '0.82rem', color: '#1e293b' }} title={f.hint}>
                  {f.label}
                  {f.hint && <span style={{ marginLeft: 6, color: '#94a3b8', fontSize: '0.7rem' }}>(cost-plus fallback)</span>}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="number" step="0.1" min="0"
                    defaultValue={fmtPct(project[f.key] as number | null | undefined)}
                    onBlur={e => onMarkupBlur(f.key, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    style={{ ...inputStyle, textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>%</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Labor rate pool */}
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#1e293b' }}>Labor Rate Pool</h3>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.72rem', color: '#64748b' }}>
            Define each billable labor rate once. Assign rates to individual labor phase lines in the schedule grid.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ textAlign: 'left',  padding: '0.4rem 0.5rem', borderBottom: '1px solid #cbd5e1', fontSize: '0.75rem', color: '#64748b' }}>Label</th>
                <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', borderBottom: '1px solid #cbd5e1', fontSize: '0.75rem', color: '#64748b', width: 140 }}>Billable $/hr</th>
                <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #cbd5e1', width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '0.75rem 0.5rem', color: '#94a3b8', textAlign: 'center', fontSize: '0.8rem' }}>No rates yet. Click "Add Rate" below.</td></tr>
              )}
              {rates.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                    <input defaultValue={r.label}
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (v && v !== r.label) updateRate.mutate({ id: r.id, data: { label: v } });
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={inputStyle} />
                  </td>
                  <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                    <input type="number" step="0.01" min="0"
                      defaultValue={r.billable_rate ?? 0}
                      onBlur={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0 && v !== Number(r.billable_rate)) updateRate.mutate({ id: r.id, data: { billable_rate: v } });
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={{ ...inputStyle, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                    <button onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete rate?',
                          message: `Delete rate "${r.label}"? Any lines assigned to it will become unrated.`,
                          danger: true,
                        });
                        if (ok) deleteRate.mutate(r.id);
                      }}
                      title="Delete rate"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>&times;</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '0.6rem' }}>
            <button onClick={() => createRate.mutate()} disabled={createRate.isPending}
              style={{ padding: '0.35rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '0.78rem', color: '#1e293b' }}>
              + Add Rate
            </button>
          </div>
        </div>

        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Done</button>
        </div>
      </div>
    </div>
  );
};

// ===== MAIN PAGE =====
const PhaseSchedule: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { confirm, toast } = useTitanFeedback();
  const [viewMode, setViewMode] = useState<'gantt' | 'grid'>('grid');
  const [gridMode, setGridMode] = useState<GridMode>('cost');
  const [shift, setShift] = useState<ShiftKey>(() => {
    const saved = localStorage.getItem('phaseSchedule_shift');
    return (saved && SHIFT_OPTIONS.includes(saved as ShiftKey) ? saved : '5/8') as ShiftKey;
  });
  useEffect(() => { localStorage.setItem('phaseSchedule_shift', shift); }, [shift]);
  const [period, setPeriod] = useState<Period>(() => {
    const saved = localStorage.getItem('phaseSchedule_period');
    return (saved && (PERIOD_OPTIONS as readonly string[]).includes(saved) ? saved : 'month') as Period;
  });
  useEffect(() => { localStorage.setItem('phaseSchedule_period', period); }, [period]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [stratusSyncing, setStratusSyncing] = useState(false);
  const [editingItem, setEditingItem] = useState<PhaseScheduleItem | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [bulkEditValues, setBulkEditValues] = useState<{ start_date: string; end_date: string; duration: string; contour_type: string }>({ start_date: '', end_date: '', duration: '', contour_type: '' });
  const [filterText, setFilterText] = useState('');
  const [sortDir, setSortDir] = useState<'none' | 'asc' | 'desc'>('none');
  const [costTypeFilter, setCostTypeFilter] = useState<Set<number>>(new Set());
  const [prefixFilter, setPrefixFilter] = useState<Set<string>>(new Set());

  const toggleCostTypeFilter = useCallback((ct: number) => {
    setCostTypeFilter(prev => {
      const next = new Set(prev);
      next.has(ct) ? next.delete(ct) : next.add(ct);
      return next;
    });
  }, []);

  const clearCostTypeFilter = useCallback(() => {
    setCostTypeFilter(new Set());
  }, []);

  const togglePrefixFilter = useCallback((prefix: string) => {
    setPrefixFilter(prev => {
      const next = new Set(prev);
      next.has(prefix) ? next.delete(prefix) : next.add(prefix);
      return next;
    });
  }, []);

  const clearPrefixFilter = useCallback(() => {
    setPrefixFilter(new Set());
  }, []);

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

  const { data: laborRates = [] } = useQuery({
    queryKey: ['projectLaborRates', projectId],
    queryFn: () => projectLaborRatesApi.list(Number(projectId)).then(r => r.data),
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

  // Inline update (fire-and-forget, no panel close) with predecessor cascading
  const handleInlineUpdate = useCallback((id: number, data: Partial<PhaseScheduleItem>) => {
    phaseScheduleApi.updateItem(id, data).then(() => {
      // If end_date changed, cascade to successors (items whose predecessor_id = this item's row_number)
      const updatedItem = scheduleItems.find(i => i.id === id);
      const newEndDate = (data as any).end_date;
      if (newEndDate && updatedItem) {
        const successors = scheduleItems.filter(i => i.predecessor_id === updatedItem.row_number);
        successors.forEach(s => {
          const newStart = format(addDays(new Date(newEndDate + 'T00:00:00'), 1), 'yyyy-MM-dd');
          const sDur = getDuration(s.start_date, s.end_date);
          const cascadeData: any = { start_date: newStart };
          if (sDur > 0) {
            cascadeData.end_date = format(addDays(new Date(newStart + 'T00:00:00'), sDur - 1), 'yyyy-MM-dd');
          }
          phaseScheduleApi.updateItem(s.id, cascadeData);
        });
      }
      queryClient.invalidateQueries({ queryKey: ['phaseScheduleItems', projectId] });
    });
  }, [projectId, queryClient, scheduleItems]);

  const scheduledIds = useMemo(() => {
    const ids = new Set<number>();
    scheduleItems.forEach(item => item.phase_code_ids?.forEach(id => ids.add(id)));
    return ids;
  }, [scheduleItems]);

  const dateBounds = useMemo(() => {
    let earliest: Date | null = null;
    let latest: Date | null = null;
    scheduleItems.forEach(item => {
      const s = ymdToDate(item.start_date);
      if (s && (!earliest || s < earliest)) earliest = s;
      const e = ymdToDate(item.end_date);
      if (e && (!latest || e > latest)) latest = e;
    });
    return { earliest, latest };
  }, [scheduleItems]);

  // Monthly buckets — used by the Gantt view and the dashboard chart, which
  // are not zoom-aware. Always monthly with a 1-month pad on each end.
  const months = useMemo(() => {
    if (!dateBounds.earliest || !dateBounds.latest) return [];
    return generateMonths(addMonths(dateBounds.earliest, -1), addMonths(dateBounds.latest, 1));
  }, [dateBounds]);

  // Period buckets — used by the Grid distribution columns. Pads by one
  // period on each end so cells near the boundary aren't visually clipped.
  const periods = useMemo(() => {
    if (!dateBounds.earliest || !dateBounds.latest) return [];
    return generatePeriods(
      addPeriod(dateBounds.earliest, -1, period),
      addPeriod(dateBounds.latest, 1, period),
      period
    );
  }, [dateBounds, period]);

  const totalEstCost = useMemo(() => scheduleItems.reduce((s, i) => s + parseNum(i.total_est_cost), 0), [scheduleItems]);
  const totalJtdCost = useMemo(() => scheduleItems.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0), [scheduleItems]);

  const availablePrefixes = useMemo(() => {
    const set = new Set<string>();
    scheduleItems.forEach(i => {
      const display = i.phase_code_display || '';
      const prefix = display.split('-')[0]?.trim();
      if (prefix) set.add(prefix);
    });
    return Array.from(set).sort();
  }, [scheduleItems]);

  const filteredItems = useMemo(() => {
    let result = scheduleItems;
    if (costTypeFilter.size > 0) {
      result = result.filter(i => i.cost_types?.some(ct => costTypeFilter.has(ct)));
    }
    if (prefixFilter.size > 0) {
      result = result.filter(i => {
        const prefix = (i.phase_code_display || '').split('-')[0]?.trim();
        return prefix ? prefixFilter.has(prefix) : false;
      });
    }
    if (filterText.trim()) {
      const raw = filterText.trim().toLowerCase();
      if (raw.includes('*')) {
        // Wildcard mode: * matches any characters (e.g. *30* = contains, 30* = starts with)
        const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        const regex = new RegExp('^' + escaped + '$', 'i');
        result = result.filter(i =>
          regex.test(i.name) ||
          (i.phase_code_display && regex.test(i.phase_code_display))
        );
      } else {
        // Default: prefix match on phase code / name
        result = result.filter(i =>
          i.name.toLowerCase().startsWith(raw) ||
          (i.phase_code_display && i.phase_code_display.toLowerCase().startsWith(raw))
        );
      }
    }
    if (sortDir !== 'none') {
      result = [...result].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [scheduleItems, filterText, sortDir, costTypeFilter, prefixFilter]);

  const costTypeGroups = useMemo((): CostTypeGroup[] => {
    const groupMap = new Map<number, PhaseScheduleItem[]>();
    filteredItems.forEach(item => {
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
        const eQ = parseNum(i.quantity); const jQ = parseNum(i.quantity_installed); const jH = parseNum(i.total_jtd_hours); const eH = parseNum(i.total_est_hours);
        const pi = jQ > 0 && jH > 0 ? jQ / jH : 0;
        return s + (pi > 0 ? Math.max(eQ / pi, jH) : jH > eH ? jH : eH);
      }, 0);
      const projCostField = items.reduce((s, i) => {
        const pct = parseNum(i.percent_complete); const jC = parseNum(i.total_jtd_cost); const eC = parseNum(i.total_est_cost);
        const p = pct > 0 ? Math.max(jC / (pct / 100), jC) : jC > eC ? jC : eC;
        return s + p;
      }, 0);
      const projCostVista = items.reduce((s, i) => {
        const vPC = parseNum(i.total_projected_cost); const jC = parseNum(i.total_jtd_cost);
        return s + (vPC > 0 ? Math.max(vPC, jC) : 0);
      }, 0);
      const remCost = items.reduce((s, i) => {
        const vPC = parseNum(i.total_projected_cost);
        if (vPC <= 0) return s;
        return s + Math.max(0, vPC - parseNum(i.total_jtd_cost));
      }, 0);
      const remHrs = items.reduce((s, i) => {
        const vPC = parseNum(i.total_projected_cost);
        if (vPC <= 0) return s;
        const jC = parseNum(i.total_jtd_cost);
        const jH = parseNum(i.total_jtd_hours);
        const eC = parseNum(i.total_est_cost);
        const eH = parseNum(i.total_est_hours);
        const jtdRate = jH > 0 ? jC / jH : 0;
        const estRate = eH > 0 ? eC / eH : 0;
        const rate = jtdRate > 0 ? jtdRate : estRate;
        if (rate <= 0) return s;
        return s + Math.max(0, vPC - jC) / rate;
      }, 0);
      const remQty = items.reduce((s, i) => {
        return s + Math.max(0, parseNum(i.quantity) - parseNum(i.quantity_installed));
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
        projQty, projHrs, projCostField, projCostVista,
        remQty, remHrs, remCost,
        earliestStart, latestEnd,
        duration: getDuration(earliestStart, latestEnd)
      });
    }
    return groups;
  }, [filteredItems]);

  // Selection callbacks
  const toggleItemSelection = useCallback((itemId: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

  const toggleGroupSelection = useCallback((costType: number) => {
    const group = costTypeGroups.find(g => g.costType === costType);
    if (!group) return;
    setSelectedItems(prev => {
      const next = new Set(prev);
      const groupIds = group.items.map(i => i.id);
      const allSelected = groupIds.every(id => next.has(id));
      if (allSelected) groupIds.forEach(id => next.delete(id));
      else groupIds.forEach(id => next.add(id));
      return next;
    });
  }, [costTypeGroups]);

  const toggleAllSelection = useCallback(() => {
    setSelectedItems(prev => prev.size === filteredItems.length ? new Set() : new Set(filteredItems.map(i => i.id)));
  }, [filteredItems]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setBulkEditValues({ start_date: '', end_date: '', duration: '', contour_type: '' });
  }, []);

  // Chart data — buckets follow the grid's period zoom, headcount uses the
  // selected shift's hrs-per-worker-per-period. Same math as the grid so the
  // chart and the on-screen Manpower column agree at every zoom level.
  const chartData = useMemo(() => {
    if (periods.length === 0) return null;

    const headcount: number[] = new Array(periods.length).fill(0);
    const periodCost: number[] = new Array(periods.length).fill(0);
    const periodEstQty: number[] = new Array(periods.length).fill(0);
    const periodEstHrs: number[] = new Array(periods.length).fill(0);

    const parseLocalDate = (d: string): Date => {
      const parts = d.substring(0, 10).split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    };

    const hpwp = hoursPerWorkerPerPeriod(shift, period);

    scheduleItems.forEach(item => {
      if (!item.start_date || !item.end_date) return;
      const itemStart = parseLocalDate(item.start_date);
      const itemEnd = parseLocalDate(item.end_date);
      const startBucket = startOfPeriod(itemStart, period);
      const endBucket = startOfPeriod(itemEnd, period);
      const itemPeriods = periods.filter(p => p >= startBucket && p <= endBucket);
      if (itemPeriods.length === 0) return;

      const multipliers = getContourMultipliers(itemPeriods.length, (item.contour_type || 'flat') as ContourType);
      const isLabor = item.cost_types?.[0] === 1;

      const estCost = parseNum(item.total_est_cost);
      if (estCost > 0) {
        const perPeriodCost = estCost / itemPeriods.length;
        itemPeriods.forEach((p, i) => {
          const idx = periods.findIndex(pp => pp.getTime() === p.getTime());
          if (idx >= 0) periodCost[idx] += perPeriodCost * multipliers[i];
        });
      }

      if (isLabor) {
        const estHrs = parseNum(item.total_est_hours);
        const estQty = parseNum(item.quantity);
        // Headcount uses REMAINING hours (projected − JTD) to mirror the grid's
        // Manpower column — work already done shouldn't add to future crew.
        const jtdHrsItem = parseNum(item.total_jtd_hours);
        const remHrsItem = Math.max(0, computeProjHrs(item) - jtdHrsItem);
        if (remHrsItem > 0) {
          const perPeriodRemHrs = remHrsItem / itemPeriods.length;
          itemPeriods.forEach((p, i) => {
            const idx = periods.findIndex(pp => pp.getTime() === p.getTime());
            if (idx >= 0) {
              headcount[idx] += (perPeriodRemHrs * multipliers[i]) / hpwp;
            }
          });
        }
        // PI baseline still uses the FULL estimate (estPi is a planning baseline,
        // not a forward-looking remaining-work figure).
        if (estHrs > 0) {
          const perPeriodHrs = estHrs / itemPeriods.length;
          const perPeriodQty = estQty / itemPeriods.length;
          itemPeriods.forEach((p, i) => {
            const idx = periods.findIndex(pp => pp.getTime() === p.getTime());
            if (idx >= 0) {
              periodEstHrs[idx] += perPeriodHrs * multipliers[i];
              if (estQty > 0) periodEstQty[idx] += perPeriodQty * multipliers[i];
            }
          });
        }
      }
    });

    const cumulativeCost: number[] = [];
    let running = 0;
    periodCost.forEach(v => { running += v; cumulativeCost.push(running); });

    const estPiLine: (number | null)[] = [];
    let cumQty = 0, cumHrs = 0;
    periods.forEach((_p, i) => {
      cumQty += periodEstQty[i];
      cumHrs += periodEstHrs[i];
      estPiLine.push(cumHrs > 0 ? cumQty / cumHrs : null);
    });

    const today = startOfPeriod(new Date(), period);
    const todayIdx = periods.findIndex(p => p >= today);
    const laborItems = scheduleItems.filter(i => i.cost_types?.[0] === 1);
    const totalJtdQtyVal = laborItems.reduce((s, i) => s + parseNum(i.quantity_installed), 0);
    const totalJtdHrsVal = laborItems.reduce((s, i) => s + parseNum(i.total_jtd_hours), 0);
    const actualPi = totalJtdHrsVal > 0 ? totalJtdQtyVal / totalJtdHrsVal : null;
    const actualPiLine: (number | null)[] = periods.map((_p, i) => {
      if (todayIdx >= 0 && i <= todayIdx && actualPi !== null) return actualPi;
      return null;
    });

    const jtdLine: (number | null)[] = periods.map((_p, i) => {
      if (todayIdx >= 0 && i <= todayIdx) return totalJtdCost;
      return null;
    });

    const labels = periods.map(p => periodLabel(p, period));
    return { labels, headcount, cumulativeCost, jtdLine, estPiLine, actualPiLine };
  }, [scheduleItems, periods, period, shift, totalJtdCost]);

  const handleAdd = (ids: number[], groupBy: string) => {
    createMutation.mutate({ projectId: Number(projectId), phaseCodeIds: ids, groupBy });
  };

  const handleSave = (id: number, data: Partial<PhaseScheduleItem>) => {
    updateMutation.mutate({ id, data });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleBulkEditApply = async () => {
    if (selectedItems.size === 0) return;
    setBulkUpdating(true);
    const targets = scheduleItems.filter(i => selectedItems.has(i.id));
    let skippedLinked = 0;
    try {
      await Promise.all(targets.map(item => {
        const updates: any = {};
        const linked = (item.linked_resolved_count || 0) > 0;
        if (bulkEditValues.start_date && !linked) updates.start_date = bulkEditValues.start_date;
        if (bulkEditValues.end_date && !linked) updates.end_date = bulkEditValues.end_date;
        if (bulkEditValues.duration && !linked) {
          const startStr = bulkEditValues.start_date || item.start_date;
          if (startStr) {
            const dur = parseInt(bulkEditValues.duration);
            if (dur > 0) {
              const parts = startStr.substring(0, 10).split('-');
              const sd = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              updates.end_date = format(addDays(sd, dur - 1), 'yyyy-MM-dd');
            }
          }
        }
        if (bulkEditValues.contour_type) updates.contour_type = bulkEditValues.contour_type;
        if (linked && (bulkEditValues.start_date || bulkEditValues.end_date || bulkEditValues.duration)) {
          skippedLinked += 1;
        }
        if (Object.keys(updates).length === 0) return Promise.resolve();
        return phaseScheduleApi.updateItem(item.id, updates);
      }));
      queryClient.invalidateQueries({ queryKey: ['phaseScheduleItems', projectId] });
      clearSelection();
      if (skippedLinked > 0) {
        toast.info(`Skipped date updates on ${skippedLinked} GC-linked phase${skippedLinked === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      console.error('Bulk edit error:', err);
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleStratusSync = async () => {
    const ok = await confirm({
      title: 'Sync quantities from Stratus?',
      message:
        'For each schedule item whose phase code matches Stratus parts, this overwrites the LF / EA quantity and installed-quantity from the latest Stratus import:\n\n' +
        '• LF rows → SUM(length) of pipe-classified parts\n' +
        '• EA rows → COUNT of parts\n' +
        '• Items with no UOM yet are auto-tagged: LF if pipe parts exist for the phase, otherwise EA\n' +
        '• Items tagged LS (or anything other than LF/EA) are skipped\n' +
        '• Items with no matching Stratus parts are left alone\n\n' +
        'Hours and costs are not touched. Manually entered LF/EA values for matched rows will be replaced.',
      confirmText: 'Sync',
    });
    if (!ok) return;
    setStratusSyncing(true);
    try {
      const res = await phaseScheduleApi.syncStratusQuantities(Number(projectId));
      const { updated, skipped, import_id, message } = res.data;
      if (!import_id) {
        toast.warning(message || 'No Stratus import found for this project. Upload one on the Stratus module first.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['phaseScheduleItems', projectId] });
      if (updated.length === 0) {
        toast.warning(`No quantities updated. ${skipped.length} item(s) skipped (no linked phase codes match Stratus, or item is tagged LS).`);
      } else {
        const inferred = updated.filter((u) => u.uom_inferred).length;
        const inferredNote = inferred > 0 ? ` (UOM auto-set on ${inferred})` : '';
        toast.success(`Synced ${updated.length} item${updated.length === 1 ? '' : 's'} from Stratus${inferredNote}.${skipped.length ? ` ${skipped.length} skipped.` : ''}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Stratus sync failed.');
    } finally {
      setStratusSyncing(false);
    }
  };

  const handleExport = async (
    format: 'pdf' | 'excel',
    exportMode: GridMode,
    exportShift: string,
    exportGroups: string[],
  ) => {
    setExportLoading(true);
    try {
      const filtersActive = filteredItems.length < scheduleItems.length;
      const itemIds = filtersActive ? filteredItems.map(i => i.id) : undefined;
      const dateStr = new Date().toISOString().split('T')[0];
      const safeName = project?.number || String(projectId);

      if (format === 'excel') {
        const response = await phaseScheduleApi.downloadExcel(
          Number(projectId), exportMode, itemIds, exportGroups, exportShift,
        );
        const url = window.URL.createObjectURL(new Blob([response.data],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `Phase-Schedule-${safeName}-${dateStr}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const view = viewMode;
        const response = await phaseScheduleApi.downloadPdf(
          Number(projectId), view, exportMode, itemIds, exportGroups, exportShift,
        );
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        const viewLabel = view === 'gantt' ? 'Gantt' : 'Grid';
        a.download = `Phase-Schedule-${viewLabel}-${safeName}-${dateStr}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
      setShowExportModal(false);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  if (loadingPhaseCodes || loadingItems) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      {/* Header: charts on top, then title+stats+buttons below */}
      {chartData && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.6rem', alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 0.5rem 0.2rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Manpower (Workers)</div>
            <div style={{ height: '110px' }}>
              <Line
                data={{ labels: chartData.labels, datasets: [{ label: 'Workers', data: chartData.headcount, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)', fill: true, tension: 0.4, pointRadius: 0, pointHitRadius: 8, borderWidth: 1.5 }] }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${(ctx.parsed.y ?? 0).toFixed(1)} workers` } } },
                  scales: {
                    x: { ticks: { font: { size: 7 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 5 }, grid: { display: false } },
                    y: { ticks: { font: { size: 7 }, stepSize: undefined }, grid: { color: '#f1f5f9' }, beginAtZero: true }
                  }
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 0.5rem 0.2rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Cashflow (Cumulative)</div>
            <div style={{ height: '110px' }}>
              <Line
                data={{ labels: chartData.labels, datasets: [
                  { label: 'Planned', data: chartData.cumulativeCost, borderColor: '#3b82f6', borderDash: [6, 3], backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.4, pointRadius: 0, pointHitRadius: 8, borderWidth: 1.5 },
                  { label: 'Actual (JTD)', data: chartData.jtdLine, borderColor: '#10b981', backgroundColor: 'transparent', fill: false, tension: 0, pointRadius: 0, borderWidth: 1.5, spanGaps: false }
                ] }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: true, position: 'top', labels: { font: { size: 7 }, boxWidth: 8, padding: 4 } },
                    tooltip: { callbacks: { label: (ctx) => { const v = ctx.parsed.y ?? 0; const lbl = ctx.dataset.label || ''; if (v >= 1000000) return `${lbl}: $${(v / 1000000).toFixed(2)}M`; if (v >= 1000) return `${lbl}: $${(v / 1000).toFixed(0)}K`; return `${lbl}: $${v.toFixed(0)}`; } } }
                  },
                  scales: {
                    x: { ticks: { font: { size: 7 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 5 }, grid: { display: false } },
                    y: { ticks: { font: { size: 7 }, callback: (v) => typeof v === 'number' ? (v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`) : v }, grid: { color: '#f1f5f9' } }
                  }
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 0.5rem 0.2rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Productivity Index (Labor)</div>
            <div style={{ height: '110px' }}>
              <Line
                data={{ labels: chartData.labels, datasets: [
                  { label: 'Estimated PI', data: chartData.estPiLine, borderColor: '#3b82f6', borderDash: [6, 3], backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.4, pointRadius: 0, pointHitRadius: 8, borderWidth: 1.5 },
                  { label: 'Actual PI', data: chartData.actualPiLine, borderColor: '#10b981', backgroundColor: 'transparent', fill: false, tension: 0, pointRadius: 0, borderWidth: 2, spanGaps: false }
                ] }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: true, position: 'top', labels: { font: { size: 7 }, boxWidth: 8, padding: 4 } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label || ''}: ${(ctx.parsed.y ?? 0).toFixed(2)} qty/hr` } }
                  },
                  scales: {
                    x: { ticks: { font: { size: 7 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 5 }, grid: { display: false } },
                    y: { ticks: { font: { size: 7 }, callback: (v) => typeof v === 'number' ? v.toFixed(1) : v }, grid: { color: '#f1f5f9' }, beginAtZero: true }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Single horizontal toolbar: title · stats · view/mode/shift/zoom · spacer · actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <Link to={`/projects/${projectId}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.72rem' }}>&larr; Back to Project</Link>
          <h1 style={{ margin: '0.1rem 0 0', fontSize: '1.15rem', lineHeight: 1.1 }}>Phase Schedule</h1>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{project?.name || 'Project'}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.9rem', flexShrink: 0 }}>
          {[
            { label: 'Est', value: fmtCompact(totalEstCost), color: '#1e293b' },
            { label: 'JTD', value: fmtCompact(totalJtdCost), color: '#3b82f6' },
            { label: 'Rem', value: fmtCompact(totalEstCost - totalJtdCost), color: '#10b981' },
            { label: 'Items', value: String(scheduleItems.length), color: '#64748b' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>{s.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
          <button onClick={() => setViewMode('gantt')} style={{ padding: '0.3rem 0.6rem', border: 'none', backgroundColor: viewMode === 'gantt' ? '#3b82f6' : 'white', color: viewMode === 'gantt' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.75rem' }}>Gantt</button>
          <button onClick={() => setViewMode('grid')} style={{ padding: '0.3rem 0.6rem', border: 'none', borderLeft: '1px solid #e2e8f0', backgroundColor: viewMode === 'grid' ? '#3b82f6' : 'white', color: viewMode === 'grid' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.75rem' }}>Grid</button>
        </div>
        {viewMode === 'grid' && (
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <button onClick={() => setGridMode('cost')} style={{ padding: '0.3rem 0.6rem', border: 'none', backgroundColor: gridMode === 'cost' ? '#10b981' : 'white', color: gridMode === 'cost' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.75rem' }}>$ Cost</button>
            <button onClick={() => setGridMode('qty')} style={{ padding: '0.3rem 0.6rem', border: 'none', borderLeft: '1px solid #e2e8f0', backgroundColor: gridMode === 'qty' ? '#10b981' : 'white', color: gridMode === 'qty' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.75rem' }}>Qty</button>
            <button onClick={() => setGridMode('manpower')} style={{ padding: '0.3rem 0.6rem', border: 'none', borderLeft: '1px solid #e2e8f0', backgroundColor: gridMode === 'manpower' ? '#10b981' : 'white', color: gridMode === 'manpower' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.75rem' }}>Manpower</button>
            <button onClick={() => setGridMode('billable')} title="Customer billing forecast using labor rates + cost-type markup %" style={{ padding: '0.3rem 0.6rem', border: 'none', borderLeft: '1px solid #e2e8f0', backgroundColor: gridMode === 'billable' ? '#db2777' : 'white', color: gridMode === 'billable' ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.75rem' }}>$ Billable</button>
          </div>
        )}
        {viewMode === 'grid' && gridMode === 'manpower' && (
          <div title="Work shift — days per week / hours per day" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Shift</span>
            <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              {SHIFT_OPTIONS.map((s, i) => (
                <button key={s} onClick={() => setShift(s)} title={`${s} — ${SHIFT_HRS_PER_MONTH[s].toFixed(0)} hr/worker/mo`}
                  style={{ padding: '0.3rem 0.5rem', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: shift === s ? '#7c3aed' : 'white',
                    color: shift === s ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.72rem' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {viewMode === 'grid' && (
          <div title="Distribution zoom — bucket size for the distribution columns" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Zoom</span>
            <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              {(['week', 'month', 'quarter'] as Period[]).map((p, i) => (
                <button key={p} onClick={() => setPeriod(p)}
                  title={p === 'week' ? 'Weekly buckets' : p === 'quarter' ? 'Quarterly buckets' : 'Monthly buckets'}
                  style={{ padding: '0.3rem 0.55rem', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: period === p ? '#8b5cf6' : 'white',
                    color: period === p ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.72rem', textTransform: 'capitalize' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }} />
        <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setShowAddModal(true)}>Add Phase Codes</button>
        <button
          onClick={() => setShowBillingModal(true)}
          title="Configure billable labor rates and markup % by cost type"
          style={{
            padding: '0.3rem 0.75rem', fontSize: '0.75rem',
            border: '1px solid #e2e8f0', borderRadius: '6px',
            backgroundColor: 'white', color: '#1e293b', cursor: 'pointer',
          }}
        >
          💲 Billing Rates
        </button>
        <button
          onClick={handleStratusSync}
          disabled={stratusSyncing || scheduleItems.length === 0}
          title="Sync LF / EA quantities from the latest Stratus import"
          style={{
            padding: '0.3rem 0.75rem', fontSize: '0.75rem',
            border: '1px solid #e2e8f0', borderRadius: '6px',
            backgroundColor: stratusSyncing ? '#f1f5f9' : 'white',
            color: stratusSyncing ? '#94a3b8' : '#1e293b',
            cursor: stratusSyncing || scheduleItems.length === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.3rem'
          }}
        >
          {stratusSyncing ? 'Syncing...' : '☁ Sync Qty from Stratus'}
        </button>
        <button
          onClick={() => setShowExportModal(true)}
          disabled={scheduleItems.length === 0}
          style={{
            padding: '0.3rem 0.75rem', fontSize: '0.75rem',
            border: '1px solid #e2e8f0', borderRadius: '6px',
            backgroundColor: 'white', color: '#1e293b',
            cursor: scheduleItems.length === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.3rem'
          }}
        >
          ↓ Export
        </button>
      </div>

      {/* Bulk edit bar (shared across Gantt and Grid views) */}
      {scheduleItems.length > 0 && (
        <BulkEditBar items={scheduleItems} selectedItems={selectedItems}
          bulkEditValues={bulkEditValues} onBulkEditChange={setBulkEditValues}
          onApply={handleBulkEditApply} onClear={clearSelection} bulkUpdating={bulkUpdating} />
      )}
      {bulkUpdating && (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#3b82f6', fontSize: '0.9rem' }}>
          Updating... Please wait.
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
          ? <GanttView items={filteredItems} allItems={scheduleItems} months={months} projectId={Number(projectId)} onUpdate={handleInlineUpdate} onEdit={setEditingItem} costTypeGroups={costTypeGroups} collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup}
              selectedItems={selectedItems} onToggleItem={toggleItemSelection} onToggleGroupSelection={toggleGroupSelection} onToggleAll={toggleAllSelection}
              filterText={filterText} onFilterChange={setFilterText}
              sortDir={sortDir} onSortChange={() => setSortDir(d => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none')}
              ctFilter={costTypeFilter} onCtFilterToggle={toggleCostTypeFilter} onCtFilterClear={clearCostTypeFilter}
              availablePrefixes={availablePrefixes} prefixFilter={prefixFilter} onPrefixFilterToggle={togglePrefixFilter} onPrefixFilterClear={clearPrefixFilter} />
          : <GridView items={filteredItems} allItems={scheduleItems} months={periods} mode={gridMode} shift={shift} period={period} laborRates={laborRates} markupByCt={buildMarkupByCt(project)} projectId={Number(projectId)} onUpdate={handleInlineUpdate} onEdit={setEditingItem} costTypeGroups={costTypeGroups} collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup}
              selectedItems={selectedItems} onToggleItem={toggleItemSelection} onToggleGroupSelection={toggleGroupSelection} onToggleAll={toggleAllSelection}
              filterText={filterText} onFilterChange={setFilterText}
              sortDir={sortDir} onSortChange={() => setSortDir(d => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none')}
              ctFilter={costTypeFilter} onCtFilterToggle={toggleCostTypeFilter} onCtFilterClear={clearCostTypeFilter}
              availablePrefixes={availablePrefixes} prefixFilter={prefixFilter} onPrefixFilterToggle={togglePrefixFilter} onPrefixFilterClear={clearPrefixFilter} />
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

      {/* Billing Rates Modal */}
      {showBillingModal && project && (
        <BillingRatesModal
          projectId={Number(projectId)}
          project={project}
          rates={laborRates}
          onClose={() => setShowBillingModal(false)}
        />
      )}

      {/* Export Options Modal */}
      {showExportModal && (
        <ExportOptionsModal
          initialMode={gridMode}
          initialShift={shift}
          loading={exportLoading}
          onExport={handleExport}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Edit Panel */}
      {editingItem && (
        <EditItemPanel
          key={editingItem.id}
          item={editingItem}
          months={months}
          projectId={Number(projectId)}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};

export default PhaseSchedule;
