import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  scheduleSegmentsService,
  SEGMENT_DEFINITIONS,
  type ScheduleSegment,
  type SegmentCosts,
} from '../../services/scheduleSegments';
import { phaseScheduleApi, type ProvisionalPhaseCode, type ProvisionalPhaseCodeInput } from '../../services/phaseSchedule';
import { getContourMultipliers, contourOptions, ContourVisual, type ContourType } from '../../utils/contours';
import type { Project } from '../../services/projects';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

const COST_TYPE_NAMES: Record<number, string> = {
  1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions',
};

const COL_GROUP = {
  sched: { hdr: '#eef2f7', cell: '#eef2f7' },
  est:   { hdr: '#dbeafe', cell: '#eff6ff' },
  jtd:   { hdr: '#fef3c7', cell: '#fffbeb' },
  proj:  { hdr: '#dcfce7', cell: '#f0fdf4' },
  rem:   { hdr: '#ede9fe', cell: '#f5f3ff' },
};

const SEGMENT_COLOR: Record<string, string> = {
  '30': '#3b82f6', '35': '#3b82f6',
  '40': '#0ea5e9', '45': '#0ea5e9',
  '50': '#06b6d4', '55': '#06b6d4',
  '70': '#64748b', bas: '#8b5cf6',
  material: '#10b981', subcontract: '#f59e0b',
  rental: '#8b5cf6', equipment: '#ef4444', gc: '#6b7280',
};

interface ShiftSetting { mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number; }
type ShiftSettings = Record<string, ShiftSetting>;

const SHIFT_DAY_KEYS: (keyof ShiftSetting)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SHIFT_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const DEFAULT_SHIFT: ShiftSetting = { mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0 };

const SHIFT_DEFAULTS: ShiftSettings = {
  '30': { ...DEFAULT_SHIFT }, '35': { ...DEFAULT_SHIFT },
  '40': { ...DEFAULT_SHIFT }, '45': { ...DEFAULT_SHIFT },
  '50': { ...DEFAULT_SHIFT }, '55': { ...DEFAULT_SHIFT },
  '70': { ...DEFAULT_SHIFT }, bas:  { ...DEFAULT_SHIFT },
};

const weeklyHours    = (s: ShiftSetting) => SHIFT_DAY_KEYS.reduce((sum, d) => sum + (s[d] ?? 0), 0);
const hoursPerPersonPerMonth = (s: ShiftSetting) => weeklyHours(s) * (52 / 12);

const ROW_H = 28;
const GROUP_H = 22;

const GANTT_COL_DEFAULTS = { label: 220, estHrs: 62, estCost: 78, start: 90, end: 90, dur: 48, contour: 116 };
type GanttColKey = keyof typeof GANTT_COL_DEFAULTS;
const LEFT_PANEL_DEFAULT = Object.values(GANTT_COL_DEFAULTS).reduce((a, b) => a + b, 0);

// ─── Utilities ────────────────────────────────────────────────────────────────

const toInput = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');

const fmtDateShort = (s: string | null | undefined): string => {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};

const safeN = (v: number | null | undefined) => { const n = Number(v); return isNaN(n) ? 0 : n; };

const fmtCompact = (v: number | null | undefined) => {
  if (v == null || isNaN(v as number) || v === 0) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v)}`;
};

const fmt$ = (v: number | null | undefined) => v ? `$${Math.round(v).toLocaleString()}` : '—';
const fmtK = (v: number | null | undefined) => {
  if (!v) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(v / 1000).toLocaleString()}k`;
};
const fmtHrs = (v: number | null | undefined) => v ? Math.round(v).toLocaleString() : '—';

type RemHrsMode = 'est-rate' | 'jtd-rate';

function calcRemHrs(costs: SegmentCosts | undefined, mode: RemHrsMode): number | null {
  const projCost = safeN(costs?.projected_cost);
  const jtdCost  = safeN(costs?.jtd_cost);
  const remCost  = projCost - jtdCost;
  const estCost = safeN(costs?.est_cost);
  const estHrs  = safeN(costs?.est_hours);
  const jtdHrs  = safeN(costs?.jtd_hours);
  if (mode === 'est-rate') {
    if (estCost <= 0 || estHrs <= 0) return null;
    return remCost / (estCost / estHrs);
  }
  if (jtdCost <= 0 || jtdHrs <= 0) return null;
  return remCost / (jtdCost / jtdHrs);
}

const calcDur = (start: string | null, end: string | null): string => {
  if (!start || !end) return '—';
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  if (days < 0) return '—';
  const months = Math.round(days / 30.44);
  return months >= 2 ? `${months}mo` : `${days}d`;
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function distributeMonthly(
  remaining: number | null,
  startDate: string | null,
  endDate: string | null,
  contourType: string,
  allMonths: Date[]
): number[] {
  if (!remaining || !startDate || !endDate) return allMonths.map(() => 0);
  const start = new Date(startDate), end = new Date(endDate);
  const segIdx: number[] = [];
  allMonths.forEach((m, i) => {
    const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    if (m <= end && mEnd > start) segIdx.push(i);
  });
  if (segIdx.length === 0) return allMonths.map(() => 0);
  const mults = getContourMultipliers(segIdx.length, contourType as ContourType);
  const mSum = mults.reduce((a, b) => a + b, 0) || 1;
  const result = allMonths.map(() => 0);
  segIdx.forEach((idx, i) => { result[idx] = (mults[i] / mSum) * remaining; });
  return result;
}

function dateToX(d: Date, firstMonth: Date, colWidth: number): number {
  const mIdx = (d.getFullYear() - firstMonth.getFullYear()) * 12 + (d.getMonth() - firstMonth.getMonth());
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return mIdx * colWidth + ((d.getDate() - 1) / daysInMonth) * colWidth;
}

function xToDate(x: number, firstMonth: Date, colWidth: number): Date {
  const mIdx = Math.max(0, Math.floor(x / colWidth));
  const remainder = x - mIdx * colWidth;
  const totalM = firstMonth.getMonth() + mIdx;
  const year = firstMonth.getFullYear() + Math.floor(totalM / 12);
  const month = totalM % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.max(1, Math.min(Math.round((remainder / colWidth) * daysInMonth) + 1, daysInMonth));
  return new Date(year, month, day);
}

// ─── Row-level date/contour state ─────────────────────────────────────────────

function useRowEdit(
  seg: ScheduleSegment | undefined,
  defKey: string,
  onSave: (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string }) => void
) {
  const [localStart,   setLocalStart]   = useState(() => toInput(seg?.start_date));
  const [localEnd,     setLocalEnd]     = useState(() => toInput(seg?.end_date));
  const [localContour, setLocalContour] = useState(() => seg?.contour_type || 'flat');

  useEffect(() => { setLocalStart(toInput(seg?.start_date)); }, [seg?.start_date]);
  useEffect(() => { setLocalEnd(toInput(seg?.end_date)); }, [seg?.end_date]);
  useEffect(() => { setLocalContour(seg?.contour_type || 'flat'); }, [seg?.contour_type]);

  const handleBlur = useCallback(() => {
    const ns = localStart || null, ne = localEnd || null;
    if (ns !== toInput(seg?.start_date) || ne !== toInput(seg?.end_date))
      onSave(defKey, { start_date: ns, end_date: ne, contour_type: localContour });
  }, [defKey, localStart, localEnd, localContour, seg, onSave]);

  const handleContour = useCallback((c: string) => {
    setLocalContour(c);
    onSave(defKey, { start_date: localStart || null, end_date: localEnd || null, contour_type: c });
  }, [defKey, localStart, localEnd, onSave]);

  return { localStart, localEnd, localContour, setLocalStart, setLocalEnd, handleBlur, handleContour };
}

// ─── Provisional helpers ──────────────────────────────────────────────────────

function segmentForCode(costType: number, phase: string): string {
  const p = (phase || '').toUpperCase();
  if (p.startsWith('BAS')) return 'bas';
  if (costType !== 1) {
    return ({ 2: 'material', 3: 'subcontract', 4: 'rental', 5: 'equipment', 6: 'gc' } as Record<number, string>)[costType] ?? 'other';
  }
  const px = (phase || '').slice(0, 2);
  return ['30', '35', '40', '45', '50', '55', '70'].includes(px) ? px : 'other';
}

const SEG_LABEL: Record<string, string> = Object.fromEntries(SEGMENT_DEFINITIONS.map(d => [d.key, d.label]));

// ─── Provisional codes modal (Cost Type scheduling mode) ──────────────────────

const CostTypeProvisionalsModal: React.FC<{
  projectId: number;
  defaultJob: string;
  onClose: () => void;
}> = ({ projectId, defaultJob, onClose }) => {
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();
  const [tab, setTab] = useState<'paste' | 'single'>('single');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['provisionalPhaseCodes', projectId],
    queryFn: () => phaseScheduleApi.listProvisional(projectId).then(r => r.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['provisionalPhaseCodes', projectId] });
    queryClient.invalidateQueries({ queryKey: ['schedule-segment-costs', projectId] });
    queryClient.invalidateQueries({ queryKey: ['vpShopFieldHours'] });
    queryClient.invalidateQueries({ queryKey: ['bulkSegments'] });
  };

  const [form, setForm] = useState<ProvisionalPhaseCodeInput>({
    job: defaultJob, phase: '', cost_type: 1,
    est_hours: 0, est_cost: 0, phase_description: '', provisional_notes: '',
  });

  const addOne = useMutation({
    mutationFn: (data: ProvisionalPhaseCodeInput) => phaseScheduleApi.createProvisional(projectId, data),
    onSuccess: () => {
      invalidate();
      setForm(f => ({ ...f, phase: '', phase_description: '', est_hours: 0, est_cost: 0, provisional_notes: '' }));
      toast.success('Provisional code added');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to add'),
  });

  const delOne = useMutation({
    mutationFn: (id: number) => phaseScheduleApi.deleteProvisional(id),
    onSuccess: () => { invalidate(); toast.success('Removed'); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Delete failed'),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ProvisionalPhaseCodeInput>>({});
  const startEdit = (r: ProvisionalPhaseCode) => {
    setEditingId(r.id);
    setEditDraft({ phase: r.phase, cost_type: r.cost_type, job: r.job, phase_description: r.phase_description || '', est_hours: Number(r.est_hours) || 0, est_cost: Number(r.est_cost) || 0 });
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft({}); };

  const updateOne = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProvisionalPhaseCodeInput> }) =>
      phaseScheduleApi.updateProvisional(id, data),
    onSuccess: () => { invalidate(); cancelEdit(); toast.success('Updated'); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Update failed'),
  });

  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<{ rows: ProvisionalPhaseCodeInput[]; errors: string[] } | null>(null);

  const addBulk = useMutation({
    mutationFn: (data: ProvisionalPhaseCodeInput[]) => phaseScheduleApi.bulkCreateProvisional(projectId, data),
    onSuccess: (r) => {
      invalidate();
      setPasteText(''); setPreview(null);
      const ins = r.data.inserted.length;
      const skipped = r.data.skipped;
      const parts = [`Added ${ins} code${ins === 1 ? '' : 's'}`];
      if (skipped > 0) parts.push(`${skipped} skipped (duplicate)`);
      toast.success(parts.join(', '));
    },
    onError: () => toast.error('Bulk import failed'),
  });

  const parsePaste = (text: string) => {
    const ctByLabel: Record<string, number> = {
      labor: 1, material: 2, materials: 2, subcontracts: 3, subs: 3, sub: 3,
      rentals: 4, rental: 4, equipment: 5, 'mep equipment': 5, equip: 5,
      'general conditions': 6, gc: 6, 'gen cond': 6,
    };
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out: ProvisionalPhaseCodeInput[] = [];
    const errors: string[] = [];
    lines.forEach((line, idx) => {
      const cols = line.split(/\t|,/).map(s => s.trim());
      if (idx === 0 && /phase/i.test(cols[0]) && /cost|type|ct/i.test(cols[1] || '')) return;
      const [phase, ctRaw, hrsRaw, costRaw, jobRaw, descRaw] = cols;
      if (!phase || !ctRaw) { errors.push(`Line ${idx + 1}: missing phase or cost type`); return; }
      let ct: number = parseInt(ctRaw, 10);
      if (!Number.isFinite(ct)) ct = ctByLabel[ctRaw.toLowerCase()];
      if (!ct || ct < 1 || ct > 6) { errors.push(`Line ${idx + 1}: cost type "${ctRaw}" not recognized`); return; }
      out.push({
        phase, cost_type: ct,
        est_hours: hrsRaw ? parseFloat(hrsRaw.replace(/[,$]/g, '')) || 0 : 0,
        est_cost:  costRaw ? parseFloat(costRaw.replace(/[,$]/g, '')) || 0 : 0,
        job: (jobRaw && jobRaw.length > 0) ? jobRaw : defaultJob,
        phase_description: descRaw || undefined,
      });
    });
    setPreview({ rows: out, errors });
  };

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' };
  const cellInput: React.CSSProperties = { width: '100%', padding: '0.25rem 0.4rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.78rem', boxSizing: 'border-box' };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>Provisional Phase Codes</h2>
            <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748b' }}>
              Use when Vista phase codes aren't set up yet. Hours and costs flow into the labor forecast immediately.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 1.5rem' }}>
          {(['paste', 'single'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '0.6rem 1rem', border: 'none', background: 'none',
              borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
              color: tab === t ? '#3b82f6' : '#64748b', fontWeight: 500, cursor: 'pointer', fontSize: '0.85rem',
            }}>
              {t === 'paste' ? 'Paste from Excel' : 'Add One'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.5rem' }}>

          {/* ── Single entry ── */}
          {tab === 'single' && (() => {
            const liveSegKey = form.phase.trim() ? segmentForCode(form.cost_type, form.phase) : null;
            const liveSegLabel = liveSegKey ? (SEG_LABEL[liveSegKey] ?? COST_TYPE_NAMES[form.cost_type]) : null;
            const liveSegColor = liveSegKey ? (SEGMENT_COLOR[liveSegKey] ?? '#6b7280') : null;
            const liveSegIsLabor = liveSegKey ? SEGMENT_DEFINITIONS.find(d => d.key === liveSegKey)?.isLabor ?? false : false;
            return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Phase Code *</label>
                <input style={inputStyle} value={form.phase}
                  onChange={e => setForm({ ...form, phase: e.target.value })}
                  placeholder="e.g. 35-001 or 350010" />
                {form.phase.trim() && (
                  <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem' }}>
                    <span style={{ color: '#64748b' }}>Routes to:</span>
                    {liveSegLabel ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.5rem', background: (liveSegColor ?? '#6b7280') + '18', border: `1px solid ${liveSegColor ?? '#6b7280'}40`, borderRadius: '4px', color: liveSegColor ?? '#6b7280', fontWeight: 600 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: liveSegColor ?? '#6b7280', flexShrink: 0 }} />
                        {liveSegLabel}
                        {!liveSegIsLabor && <span style={{ fontWeight: 400, color: '#94a3b8' }}>(non-labor)</span>}
                      </span>
                    ) : (
                      <span style={{ color: '#ef4444', fontWeight: 500 }}>No matching segment — check prefix</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Cost Type *</label>
                <select style={inputStyle} value={form.cost_type}
                  onChange={e => setForm({ ...form, cost_type: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6].map(ct => <option key={ct} value={ct}>{COST_TYPE_NAMES[ct]}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Phase Description</label>
                <input style={inputStyle} value={form.phase_description || ''}
                  onChange={e => setForm({ ...form, phase_description: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Est Hours</label>
                <input style={inputStyle} type="text" inputMode="numeric"
                  value={(form.est_hours ?? 0) > 0 ? (form.est_hours ?? 0).toLocaleString() : ''}
                  onChange={e => setForm({ ...form, est_hours: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 })}
                  placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Est Cost</label>
                <input style={inputStyle} type="text" inputMode="numeric"
                  value={(form.est_cost ?? 0) > 0 ? (form.est_cost ?? 0).toLocaleString() : ''}
                  onChange={e => setForm({ ...form, est_cost: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 })}
                  placeholder="0" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Notes</label>
                <input style={inputStyle} value={form.provisional_notes || ''}
                  onChange={e => setForm({ ...form, provisional_notes: e.target.value })} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <button
                  onClick={() => addOne.mutate(form)}
                  disabled={addOne.isPending || !form.phase.trim()}
                  style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: form.phase.trim() ? '#3b82f6' : '#94a3b8', color: 'white', cursor: form.phase.trim() ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 500 }}>
                  {addOne.isPending ? 'Adding…' : 'Add Provisional Code'}
                </button>
              </div>
            </div>
            );
          })()}

          {/* ── Paste tab ── */}
          {tab === 'paste' && (
            <div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Paste TSV/CSV from Excel. Columns: <b>Phase, Cost Type, Est Hours, Est Cost, [Job], [Description]</b>.
                Cost Type accepts <code>1–6</code> or labels like <code>Labor</code>, <code>Material</code>, <code>Subs</code>.
                Job defaults to <code>{defaultJob || '(blank — set in your paste)'}</code>.
              </div>
              <textarea value={pasteText}
                onChange={e => { setPasteText(e.target.value); setPreview(null); }}
                placeholder={'35-001\tLabor\t800\t56000\n35-002\tLabor\t400\t28000'}
                style={{ width: '100%', minHeight: '140px', padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', fontFamily: 'monospace' }} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => parsePaste(pasteText)} disabled={!pasteText.trim()}
                  style={{ padding: '0.4rem 0.9rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', cursor: pasteText.trim() ? 'pointer' : 'default', fontSize: '0.82rem' }}>
                  Preview
                </button>
                {preview && preview.rows.length > 0 && (
                  <button onClick={() => addBulk.mutate(preview.rows)} disabled={addBulk.isPending}
                    style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: '6px', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}>
                    {addBulk.isPending ? 'Importing…' : `Import ${preview.rows.length} row${preview.rows.length === 1 ? '' : 's'}`}
                  </button>
                )}
              </div>
              {preview && preview.errors.length > 0 && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.78rem', color: '#991b1b' }}>
                  {preview.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
              {preview && preview.rows.length > 0 && (
                <div style={{ marginTop: '0.75rem', maxHeight: '180px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Phase</th>
                        <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Segment</th>
                        <th style={{ textAlign: 'right', padding: '0.4rem 0.6rem' }}>Hrs</th>
                        <th style={{ textAlign: 'right', padding: '0.4rem 0.6rem' }}>Cost</th>
                        <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Job</th>
                        <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.3rem 0.6rem', fontFamily: 'monospace' }}>{r.phase}</td>
                          <td style={{ padding: '0.3rem 0.6rem' }}>{SEG_LABEL[segmentForCode(r.cost_type, r.phase)] ?? COST_TYPE_NAMES[r.cost_type]}</td>
                          <td style={{ padding: '0.3rem 0.6rem', textAlign: 'right' }}>{r.est_hours}</td>
                          <td style={{ padding: '0.3rem 0.6rem', textAlign: 'right' }}>${(r.est_cost || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.3rem 0.6rem' }}>{r.job}</td>
                          <td style={{ padding: '0.3rem 0.6rem' }}>{r.phase_description || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Existing codes ── */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
              Existing Provisional Codes ({rows.length})
            </div>
            {isLoading ? (
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Loading…</div>
            ) : rows.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>None yet.</div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fefce8' }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Phase</th>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Segment</th>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Job</th>
                      <th style={{ textAlign: 'right', padding: '0.4rem 0.6rem' }}>Hrs</th>
                      <th style={{ textAlign: 'right', padding: '0.4rem 0.6rem' }}>Cost</th>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Description</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const isEditing = editingId === r.id;
                      const segKey = segmentForCode(r.cost_type, r.phase);
                      return (
                        <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9', backgroundColor: isEditing ? '#f8fafc' : undefined }}>
                          <td style={{ padding: '0.3rem 0.6rem' }}>
                            <span style={{ display: 'inline-block', padding: '0.05rem 0.4rem', backgroundColor: '#fef9c3', color: '#854d0e', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, marginRight: '0.4rem' }}>PROV</span>
                            {isEditing
                              ? <input style={cellInput} value={editDraft.phase ?? ''} onChange={e => setEditDraft(d => ({ ...d, phase: e.target.value }))} />
                              : r.phase}
                          </td>
                          <td style={{ padding: '0.3rem 0.6rem', color: '#64748b', fontSize: '0.75rem' }}>
                            {SEG_LABEL[segKey] ?? COST_TYPE_NAMES[r.cost_type]}
                          </td>
                          <td style={{ padding: '0.3rem 0.6rem', color: '#64748b', fontSize: '0.75rem' }}>
                            {r.job}
                          </td>
                          <td style={{ padding: '0.3rem 0.6rem', textAlign: 'right' }}>
                            {isEditing
                              ? <input type="text" inputMode="numeric" style={{ ...cellInput, textAlign: 'right' }}
                                  value={(editDraft.est_hours ?? 0) > 0 ? (editDraft.est_hours ?? 0).toLocaleString() : ''}
                                  onChange={e => setEditDraft(d => ({ ...d, est_hours: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 }))} />
                              : Number(r.est_hours).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.3rem 0.6rem', textAlign: 'right' }}>
                            {isEditing
                              ? <input type="text" inputMode="numeric" style={{ ...cellInput, textAlign: 'right' }}
                                  value={(editDraft.est_cost ?? 0) > 0 ? (editDraft.est_cost ?? 0).toLocaleString() : ''}
                                  onChange={e => setEditDraft(d => ({ ...d, est_cost: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 }))} />
                              : `$${Number(r.est_cost).toLocaleString()}`}
                          </td>
                          <td style={{ padding: '0.3rem 0.6rem' }}>
                            {isEditing
                              ? <input style={cellInput} value={editDraft.phase_description ?? ''} onChange={e => setEditDraft(d => ({ ...d, phase_description: e.target.value }))} />
                              : (r.phase_description || '')}
                          </td>
                          <td style={{ padding: '0.3rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isEditing ? (
                              <>
                                <button onClick={() => {
                                  if (!editDraft.phase?.trim()) { toast.error('Phase code is required'); return; }
                                  updateOne.mutate({ id: r.id, data: editDraft });
                                }} disabled={updateOne.isPending}
                                  style={{ padding: '0.2rem 0.5rem', border: 'none', borderRadius: '4px', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '0.72rem', marginRight: '0.25rem' }}>
                                  Save
                                </button>
                                <button onClick={cancelEdit}
                                  style={{ padding: '0.2rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.72rem' }}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(r)}
                                  style={{ padding: '0.2rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: 'white', color: '#1e293b', cursor: 'pointer', fontSize: '0.72rem', marginRight: '0.25rem' }}>
                                  Edit
                                </button>
                                <button onClick={async () => {
                                  const ok = await confirm({ title: `Delete ${r.phase}?`, message: 'This will remove the provisional code from all forecasts.', danger: true });
                                  if (ok) delOne.mutate(r.id);
                                }}
                                  style={{ padding: '0.2rem 0.5rem', border: '1px solid #fecaca', borderRadius: '4px', backgroundColor: 'white', color: '#991b1b', cursor: 'pointer', fontSize: '0.72rem' }}>
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Left panel row (Gantt mode) ──────────────────────────────────────────────

const GanttLeftRow: React.FC<{
  def: typeof SEGMENT_DEFINITIONS[0];
  seg: ScheduleSegment | undefined;
  costs: SegmentCosts | undefined;
  isActive: boolean;
  rowBg: string;
  color: string;
  colWidths: typeof GANTT_COL_DEFAULTS;
  hasProvisional?: boolean;
  remainingMode: RemHrsMode;
  onSave: (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string }) => void;
}> = ({ def, seg, costs, isActive, rowBg, color, colWidths, hasProvisional, remainingMode, onSave }) => {
  const { localStart, localEnd, localContour, setLocalStart, setLocalEnd, handleBlur, handleContour } = useRowEdit(seg, def.key, onSave);

  const cell: React.CSSProperties = { borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', height: '100%', fontSize: '0.7rem', color: '#1e293b', flexShrink: 0, overflow: 'hidden' };
  const inputSt: React.CSSProperties = { width: '100%', padding: '0 0.25rem', border: 'none', fontSize: '0.7rem', fontFamily: 'inherit', color: '#1e293b', background: 'transparent', outline: 'none', boxSizing: 'border-box', height: '100%' };

  return (
    <div style={{ height: ROW_H, borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'stretch', background: rowBg, opacity: isActive ? 1 : 0.5 }}>
      {/* Label */}
      <div style={{ ...cell, flex: 1, minWidth: colWidths.label, padding: '0 0.4rem', gap: 6, borderLeft: `3px solid ${def.isLabor ? '#3b82f6' : '#10b981'}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{def.label}</span>
        {hasProvisional && (
          <span title="Provisional — manually entered, not yet from Vista" style={{ padding: '0.05rem 0.35rem', backgroundColor: '#fef9c3', color: '#854d0e', borderRadius: '3px', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>PROV</span>
        )}
        <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>{def.key.toUpperCase()}</span>
      </div>
      {/* Rem Hrs */}
      <div style={{ ...cell, width: colWidths.estHrs, justifyContent: 'center', fontSize: '0.65rem' }}>
        {def.isLabor ? (() => { const v = calcRemHrs(costs, remainingMode); return v != null ? fmtHrs(Math.max(0, v)) : '—'; })() : '—'}
      </div>
      {/* Rem $ */}
      <div style={{ ...cell, width: colWidths.estCost, justifyContent: 'center' }}>
        {costs?.projected_cost != null
          ? <span style={{ fontWeight: 600, color: safeN(costs.projected_cost) - safeN(costs.jtd_cost) < 0 ? '#dc2626' : '#1e293b' }}>
              {fmtCompact(safeN(costs.projected_cost) - safeN(costs.jtd_cost))}
            </span>
          : '—'}
      </div>
      {/* Start */}
      <div style={{ ...cell, width: colWidths.start, justifyContent: 'center', padding: '0 2px' }}>
        <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} onBlur={handleBlur}
          style={{ ...inputSt, textAlign: 'center', cursor: 'pointer', color: localStart ? '#1e293b' : '#94a3b8' }} />
      </div>
      {/* End */}
      <div style={{ ...cell, width: colWidths.end, justifyContent: 'center', padding: '0 2px' }}>
        <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)} onBlur={handleBlur}
          style={{ ...inputSt, textAlign: 'center', cursor: 'pointer', color: localEnd ? '#1e293b' : '#94a3b8' }} />
      </div>
      {/* Dur */}
      <div style={{ ...cell, width: colWidths.dur, justifyContent: 'center', fontSize: '0.65rem', color: '#64748b' }}>
        {calcDur(localStart || null, localEnd || null)}
      </div>
      {/* Contour */}
      <div style={{ width: colWidths.contour, flexShrink: 0, display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 0.2rem', width: '100%' }}>
          <ContourVisual contour={localContour as ContourType} />
          <select value={localContour} onChange={e => handleContour(e.target.value)}
            style={{ ...inputSt, cursor: 'pointer', flex: 1 }}>
            {contourOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};

// ─── Table Row ($ Cost mode) ──────────────────────────────────────────────────

const TableRow: React.FC<{
  def: typeof SEGMENT_DEFINITIONS[0];
  seg: ScheduleSegment | undefined;
  costs: SegmentCosts | undefined;
  isActive: boolean;
  rowBg: string;
  color: string;
  allMonths: Date[];
  hasProvisional?: boolean;
  onSave: (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string }) => void;
}> = ({ def, seg, costs, isActive, rowBg, color, allMonths, hasProvisional, onSave }) => {
  const { localStart, localEnd, localContour, setLocalStart, setLocalEnd, handleBlur, handleContour } = useRowEdit(seg, def.key, onSave);
  const remaining = (costs?.projected_cost ?? 0) - (costs?.jtd_cost ?? 0);
  const todayStr = toIso(new Date());
  const effectiveStart = (localStart && localStart < todayStr) ? todayStr : (localStart || null);
  const monthly = distributeMonthly(remaining > 0 ? remaining : null, effectiveStart, localEnd || null, localContour, allMonths);

  const thSt = (bg: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
    height: 28, padding: '0.15rem 0.3rem', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b',
    background: bg, whiteSpace: 'nowrap', textAlign: 'center', borderBottom: '1px solid #94a3b8',
    borderRight: '1px solid #cbd5e1', verticalAlign: 'middle', position: 'sticky', top: 0, zIndex: 2, ...extra,
  });
  const tdSt = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    height: 28, padding: '0 0.3rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
    verticalAlign: 'middle', fontSize: '0.75rem', color: '#1e293b', ...extra,
  });

  return (
    <tr style={{ background: rowBg, opacity: isActive ? 1 : 0.5 }}>
      <td style={{ ...tdSt({ padding: '0 0.5rem', position: 'sticky', left: 0, zIndex: 2, background: rowBg }), borderLeft: `3px solid ${def.isLabor ? '#3b82f6' : '#10b981'}`, borderRight: '2px solid #94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: isActive ? 600 : 400, color: isActive ? '#1e293b' : '#64748b' }}>{def.label}</span>
              {hasProvisional && (
                <span title="Provisional — manually entered, not yet from Vista" style={{ padding: '0.05rem 0.35rem', backgroundColor: '#fef9c3', color: '#854d0e', borderRadius: '3px', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>PROV</span>
              )}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>{def.key.toUpperCase()}</div>
          </div>
        </div>
      </td>
      <td style={tdSt({ padding: '0 0.25rem', background: COL_GROUP.sched.hdr + '55' })}>
        <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} onBlur={handleBlur}
          style={{ padding: '0.15rem 0.25rem', border: '1px solid #cbd5e1', borderRadius: 3, fontSize: '0.72rem', color: '#1e293b', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </td>
      <td style={tdSt({ padding: '0 0.25rem', background: COL_GROUP.sched.hdr + '55' })}>
        <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)} onBlur={handleBlur}
          style={{ padding: '0.15rem 0.25rem', border: '1px solid #cbd5e1', borderRadius: 3, fontSize: '0.72rem', color: '#1e293b', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </td>
      <td style={tdSt({ textAlign: 'center', color: '#64748b', background: COL_GROUP.sched.hdr + '55' })}>{calcDur(localStart || null, localEnd || null)}</td>
      <td style={tdSt({ padding: '0 0.2rem', background: COL_GROUP.sched.hdr + '55', borderRight: '2px solid #94a3b8' })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ContourVisual contour={localContour as ContourType} />
          <select value={localContour} onChange={e => handleContour(e.target.value)}
            style={{ padding: '0 0.2rem', fontSize: '0.68rem', border: 'none', background: 'transparent', color: '#1e293b', fontFamily: 'inherit', cursor: 'pointer', width: '100%', outline: 'none' }}>
            {contourOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.est.cell })}>{fmt$(costs?.est_cost)}</td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.est.cell, borderRight: '2px solid #94a3b8' })}>{def.isLabor ? fmtHrs(costs?.est_hours) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.jtd.cell })}>{fmt$(costs?.jtd_cost)}</td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.jtd.cell, borderRight: '2px solid #94a3b8' })}>{def.isLabor ? fmtHrs(costs?.jtd_hours) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.proj.cell, borderRight: '2px solid #94a3b8' })}><span style={{ fontWeight: 600 }}>{fmt$(costs?.projected_cost)}</span></td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.rem.cell, borderRight: '2px solid #94a3b8' })}><span style={{ fontWeight: 600, color: remaining < 0 ? '#dc2626' : '#1e293b' }}>{costs?.projected_cost != null ? fmt$(remaining) : '—'}</span></td>
      {allMonths.map((_, i) => {
        const val = monthly[i];
        const bg = i % 2 === 0 ? rowBg : (rowBg === '#fff' ? '#f8fafc' : '#f1f5f9');
        return (
          <td key={i} style={tdSt({ textAlign: 'right', padding: '0 0.25rem', background: bg, color: val > 0 ? color : '#cbd5e1', fontWeight: val > 0 ? 500 : 400 })}>
            {val > 500 ? fmtK(val) : val > 0 ? `$${Math.round(val).toLocaleString()}` : ''}
          </td>
        );
      })}
    </tr>
  );
};

// ─── CostTypeSchedule ─────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  segments: ScheduleSegment[];
  activeKeys: string[];
  onSegmentUpdate: (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string; weekly_hours?: number | null }) => void;
  onInitialize: () => void;
  initPending: boolean;
  project?: Project;
}

const CostTypeSchedule: React.FC<Props> = ({
  projectId, segments, activeKeys, onSegmentUpdate, onInitialize, initPending, project,
}) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'gantt' | 'table' | 'manpower'>('gantt');
  const [showProvisional, setShowProvisional] = useState(false);

  // ── Shift settings ────────────────────────────────────────────────────────
  const shiftKey = `costTypeSchedule_shifts_${projectId}`;
  const loadShifts = (key: string): ShiftSettings => {
    const parse = (raw: string | null): ShiftSettings | null => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        const firstVal = Object.values(parsed)[0] as any;
        if (firstVal && 'hoursPerDay' in firstVal) return null; // old incompatible format
        return { ...SHIFT_DEFAULTS, ...parsed };
      } catch { return null; }
    };
    // Try project-scoped key first; fall back to legacy global key (one-time migration)
    const result = parse(localStorage.getItem(key));
    if (result) return result;
    const legacy = parse(localStorage.getItem('costTypeSchedule_shifts'));
    if (legacy) {
      localStorage.setItem(key, JSON.stringify(legacy)); // migrate
      return legacy;
    }
    return { ...SHIFT_DEFAULTS };
  };
  const [shiftSettings, setShiftSettings] = useState<ShiftSettings>(() => loadShifts(shiftKey));

  // Reload shift settings when projectId changes (component stays mounted across navigation)
  useEffect(() => {
    setShiftSettings(loadShifts(`costTypeSchedule_shifts_${projectId}`));
  }, [projectId]);

  // Sync any locally-stored shift schedules to DB on mount so the labor board
  // picks up weekly_hours even when the user only changed dates (not shift cells).
  useEffect(() => {
    const settings = loadShifts(`costTypeSchedule_shifts_${projectId}`);
    Object.entries(settings).forEach(([key, s]) => {
      const wh = weeklyHours(s as ShiftSetting);
      if (wh > 0) {
        scheduleSegmentsService.updateSegment(projectId, key, { weekly_hours: wh }).catch(() => {});
      }
    });
  }, [projectId]);

  const updateShift = useCallback((key: string, day: keyof ShiftSetting, value: number) => {
    setShiftSettings(prev => {
      const next = { ...prev, [key]: { ...(prev[key] ?? SHIFT_DEFAULTS[key] ?? DEFAULT_SHIFT), [day]: value } };
      localStorage.setItem(`costTypeSchedule_shifts_${projectId}`, JSON.stringify(next));
      // Persist weekly_hours only — targeted update that never touches dates or contour.
      const wh = weeklyHours(next[key]);
      scheduleSegmentsService.updateSegment(projectId, key, { weekly_hours: wh }).catch(() => {});
      return next;
    });
  }, [projectId]);

  const [remainingMode, setRemainingMode] = useState<RemHrsMode>('est-rate');

  // ── Column widths ─────────────────────────────────────────────────────────
  const [colWidths, setColWidths] = useState<typeof GANTT_COL_DEFAULTS>(() => {
    try { const s = localStorage.getItem('costTypeSchedule_ganttCols'); if (!s) return GANTT_COL_DEFAULTS; const saved = JSON.parse(s); return { ...GANTT_COL_DEFAULTS, ...saved, contour: Math.max(GANTT_COL_DEFAULTS.contour, saved.contour ?? 0) }; }
    catch { return GANTT_COL_DEFAULTS; }
  });
  const colWidthsRef = useRef(colWidths);
  useEffect(() => { localStorage.setItem('costTypeSchedule_ganttCols', JSON.stringify(colWidths)); }, [colWidths]);

  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    try { const s = localStorage.getItem('costTypeSchedule_leftW'); return s ? parseInt(s) : LEFT_PANEL_DEFAULT; }
    catch { return LEFT_PANEL_DEFAULT; }
  });
  useEffect(() => { localStorage.setItem('costTypeSchedule_leftW', String(leftPanelWidth)); }, [leftPanelWidth]);

  // ── Drag refs ─────────────────────────────────────────────────────────────
  const colResizeRef  = useRef<{ col: GanttColKey; startX: number; startW: number } | null>(null);
  const panelDragRef  = useRef<{ startX: number; startW: number } | null>(null);
  const barDragRef    = useRef<{ segKey: string; startMouseX: number; originalBarLeft: number; originalStartDate: Date; originalEndDate: Date; durationDays: number; dragStarted: boolean } | null>(null);
  const barResizeRef  = useRef<{ segKey: string; edge: 'left' | 'right'; startMouseX: number; originalBarLeft: number; originalBarWidth: number; originalStartDate: Date; originalEndDate: Date; dragStarted: boolean } | null>(null);
  const dragOccurred  = useRef(false);

  const [barDragOffset,   setBarDragOffset]   = useState<{ segKey: string; deltaX: number } | null>(null);
  const [barResizeOffset, setBarResizeOffset] = useState<{ segKey: string; edge: 'left' | 'right'; deltaX: number } | null>(null);

  const xToDateRef  = useRef<(x: number) => Date>(() => new Date());
  const onSaveRef   = useRef(onSegmentUpdate);
  onSaveRef.current = onSegmentUpdate;

  // ── Mouse handlers ────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panelDragRef.current) {
        const diff = e.clientX - panelDragRef.current.startX;
        setLeftPanelWidth(Math.max(200, panelDragRef.current.startW + diff));
      }
      if (colResizeRef.current) {
        const r = colResizeRef.current;
        const newW = Math.max(32, r.startW + (e.clientX - r.startX));
        const delta = newW - ((colWidthsRef.current as any)[r.col] || r.startW);
        setColWidths(prev => { const next = { ...prev, [r.col]: newW }; colWidthsRef.current = next; return next; });
        if (delta !== 0) setLeftPanelWidth(prev => Math.max(200, prev + delta));
      }
      if (barDragRef.current) {
        const d = barDragRef.current;
        const deltaX = e.clientX - d.startMouseX;
        if (!d.dragStarted) { if (Math.abs(deltaX) < 4) return; d.dragStarted = true; document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'; }
        setBarDragOffset({ segKey: d.segKey, deltaX });
      }
      if (barResizeRef.current) {
        const r = barResizeRef.current;
        const deltaX = e.clientX - r.startMouseX;
        if (!r.dragStarted) { if (Math.abs(deltaX) < 4) return; r.dragStarted = true; document.body.style.cursor = r.edge === 'right' ? 'e-resize' : 'w-resize'; document.body.style.userSelect = 'none'; }
        setBarResizeOffset({ segKey: r.segKey, edge: r.edge, deltaX });
      }
    };
    const onUp = (e: MouseEvent) => {
      if (barDragRef.current?.dragStarted) {
        const d = barDragRef.current;
        const newStart = xToDateRef.current(d.originalBarLeft + (e.clientX - d.startMouseX));
        const newEnd   = new Date(newStart.getTime() + d.durationDays * 86400000);
        onSaveRef.current(d.segKey, { start_date: toIso(newStart), end_date: toIso(newEnd) });
        dragOccurred.current = true;
      }
      if (barResizeRef.current?.dragStarted) {
        const r = barResizeRef.current;
        const deltaX = e.clientX - r.startMouseX;
        if (r.edge === 'left') {
          const newStart = xToDateRef.current(r.originalBarLeft + deltaX);
          if (newStart < r.originalEndDate)
            onSaveRef.current(r.segKey, { start_date: toIso(newStart), end_date: toIso(r.originalEndDate) });
        } else {
          const newEnd = xToDateRef.current(r.originalBarLeft + r.originalBarWidth + deltaX);
          if (newEnd > r.originalStartDate)
            onSaveRef.current(r.segKey, { start_date: toIso(r.originalStartDate), end_date: toIso(newEnd) });
        }
        dragOccurred.current = true;
      }
      barDragRef.current   = null; setBarDragOffset(null);
      barResizeRef.current = null; setBarResizeOffset(null);
      colResizeRef.current = null;
      panelDragRef.current = null;
      document.body.style.cursor = ''; document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: costs = [] } = useQuery({
    queryKey: ['schedule-segment-costs', projectId],
    queryFn: () => scheduleSegmentsService.getCosts(projectId),
  });

  const { data: provisionalCodes = [] } = useQuery({
    queryKey: ['provisionalPhaseCodes', projectId],
    queryFn: () => phaseScheduleApi.listProvisional(projectId).then(r => r.data),
  });
  const provisionalSegKeys = new Set(
    provisionalCodes.map(c => segmentForCode(c.cost_type, c.phase)).filter(k => k !== 'other')
  );

  const segmentMap = new Map(segments.map(s => [s.segment_key, s]));
  const costsMap   = new Map(costs.map(c => [c.segment_key, c]));
  const hasAnyDates = segments.some(s => s.start_date || s.end_date);

  const totalEst = costs.reduce((s, c) => s + safeN(c.est_cost), 0);
  const totalJtd = costs.reduce((s, c) => s + safeN(c.jtd_cost), 0);
  const totalRem = costs.reduce((s, c) => s + (safeN(c.projected_cost) - safeN(c.jtd_cost)), 0);

  // ── Timeline ──────────────────────────────────────────────────────────────
  const allStarts = segments.map(s => s.start_date ? new Date(s.start_date.slice(0, 10)).getTime() : null).filter(Boolean) as number[];
  const allEnds   = segments.map(s => s.end_date   ? new Date(s.end_date.slice(0, 10)).getTime()   : null).filter(Boolean) as number[];
  const tStart = allStarts.length ? Math.min(...allStarts) : Date.now();
  const tEnd   = allEnds.length   ? Math.max(...allEnds)   : tStart + 365 * 86400000;

  const allMonths: Date[] = [];
  const mCur = new Date(tStart); mCur.setDate(1);
  while (mCur.getTime() <= tEnd) { allMonths.push(new Date(mCur)); mCur.setMonth(mCur.getMonth() + 1); }
  const colWidth   = Math.max(52, Math.min(90, Math.floor(600 / (allMonths.length || 1))));
  const firstMonth = allMonths[0] ?? null;
  const totalW     = allMonths.length * colWidth;

  xToDateRef.current = (x: number) => xToDate(x, firstMonth ?? new Date(), colWidth);

  // ── Row items (group headers + segments interleaved) ──────────────────────
  const rowItems: Array<{ type: 'group'; group: string } | { type: 'seg'; def: typeof SEGMENT_DEFINITIONS[0]; idx: number }> = [];
  let lastGroup = '';
  SEGMENT_DEFINITIONS.forEach((def, idx) => {
    const g = def.isLabor ? 'Labor' : 'Non-Labor';
    if (g !== lastGroup) { rowItems.push({ type: 'group', group: g }); lastGroup = g; }
    rowItems.push({ type: 'seg', def, idx });
  });

  // ── Chart data ────────────────────────────────────────────────────────────

  const LABOR_CHART_COLORS: Record<string, string> = {
    '30': '#3b82f6', '35': '#1d4ed8',
    '40': '#0ea5e9', '45': '#0369a1',
    '50': '#06b6d4', '55': '#0e7490',
    '70': '#64748b', bas: '#8b5cf6',
  };

  const chartLabels = allMonths.map(m =>
    m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  );

  const todayIso = toIso(new Date());
  const clampStart = (s: string | null | undefined) =>
    s && s < todayIso ? todayIso : (s ?? null);

  // Precompute monthly remaining-cost distribution per active segment
  const segMonthlyRem = new Map<string, number[]>();
  SEGMENT_DEFINITIONS.forEach(def => {
    if (!activeKeys.includes(def.key)) return;
    const seg = segmentMap.get(def.key);
    const c   = costsMap.get(def.key);
    const rem = safeN(c?.projected_cost) - safeN(c?.jtd_cost);
    segMonthlyRem.set(def.key,
      rem > 0
        ? distributeMonthly(rem, clampStart(seg?.start_date), seg?.end_date ?? null, seg?.contour_type ?? 'flat', allMonths)
        : allMonths.map(() => 0)
    );
  });

  // Manpower datasets: hours ÷ hrs-per-person-per-month
  // Uses original (unclamped) start date so the planned-labor curve reflects the full schedule window.
  const laborDatasets = SEGMENT_DEFINITIONS
    .filter(d => d.isLabor && activeKeys.includes(d.key))
    .map(def => {
      const seg      = segmentMap.get(def.key);
      const c        = costsMap.get(def.key);
      const shift    = shiftSettings[def.key] ?? SHIFT_DEFAULTS[def.key] ?? { hoursPerDay: 8, daysPerWeek: 5 };
      const capacity = hoursPerPersonPerMonth(shift);
      const hours    = c?.est_hours
        ? distributeMonthly(c.est_hours, seg?.start_date ?? null, seg?.end_date ?? null, seg?.contour_type ?? 'flat', allMonths)
        : allMonths.map(() => 0);
      const data = hours.map(h => capacity > 0 ? Math.round((h / capacity) * 10) / 10 : 0);
      return { label: def.label, data, color: LABOR_CHART_COLORS[def.key] ?? '#6b7280' };
    })
    .filter(ds => ds.data.some(v => v > 0));

  // Monthly total cost and revenue
  const monthlyTotalCost = allMonths.map((_, i) =>
    SEGMENT_DEFINITIONS.reduce((sum, def) => sum + (segMonthlyRem.get(def.key)?.[i] ?? 0), 0)
  );

  // Manpower view: monthly remaining headcount per labor segment
  const segMonthlyRemHrs = new Map<string, number[]>();
  SEGMENT_DEFINITIONS.forEach(def => {
    if (!activeKeys.includes(def.key) || !def.isLabor) return;
    const seg    = segmentMap.get(def.key);
    const c      = costsMap.get(def.key);
    const remHrs = calcRemHrs(c, remainingMode);
    segMonthlyRemHrs.set(def.key,
      remHrs != null && remHrs > 0
        ? distributeMonthly(remHrs, clampStart(seg?.start_date), seg?.end_date ?? null, seg?.contour_type ?? 'flat', allMonths)
        : allMonths.map(() => 0)
    );
  });
  const monthlyTotalHC = allMonths.map((_, i) =>
    SEGMENT_DEFINITIONS
      .filter(d => d.isLabor && activeKeys.includes(d.key))
      .reduce((sum, def) => {
        const hpp = hoursPerPersonPerMonth(shiftSettings[def.key] ?? DEFAULT_SHIFT);
        return sum + (hpp > 0 ? (segMonthlyRemHrs.get(def.key)?.[i] ?? 0) / hpp : 0);
      }, 0)
  );

  const projRev = project?.projected_revenue ?? 0;

  // Revenue chart: same shape as the TOTAL row, scaled by revenue/cost ratio.
  // Use segment-derived projected cost so the ratio aligns with the grid numbers.
  const projCostFromSegs = totalJtd + totalRem; // sum of all segment projected_cost values
  const revMultiplier = projRev > 0 && projCostFromSegs > 0 ? projRev / projCostFromSegs : 0;
  const monthlyRevenue = monthlyTotalCost.map(c => c * revMultiplier);
  const hasCharts = allMonths.length > 0 && (laborDatasets.length > 0 || monthlyRevenue.some(v => v > 0));

  // Shared chart options helpers
  const chartScales = {
    x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 as const }, maxRotation: 45 as const, color: '#64748b' } },
  };

  // ── Column resize handle ──────────────────────────────────────────────────
  const resizeHandle = (col: GanttColKey) => (
    <div
      onMouseDown={e => {
        e.preventDefault(); e.stopPropagation();
        colResizeRef.current = { col, startX: e.clientX, startW: (colWidthsRef.current as any)[col] || 60 };
        document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
      }}
      style={{ position: 'absolute', right: -1, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 2 }}
      onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = 'rgba(59,130,246,0.25)'; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    />
  );

  // ── View toggle ───────────────────────────────────────────────────────────
  const viewBtn = (active: boolean): React.CSSProperties => ({
    padding: '0.3rem 0.6rem', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
    background: active ? '#3b82f6' : 'white', color: active ? 'white' : '#1e293b',
  });

  const hdrCell: React.CSSProperties = {
    borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b',
    whiteSpace: 'nowrap', position: 'relative', userSelect: 'none', flexShrink: 0,
  };

  return (
    <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.9rem' }}>
          {[
            { label: 'Est',   value: fmtCompact(totalEst), color: '#1e293b' },
            { label: 'JTD',   value: fmtCompact(totalJtd), color: '#3b82f6' },
            { label: 'Rem',   value: fmtCompact(totalRem), color: '#10b981' },
            { label: 'Types', value: String(costs.length), color: '#64748b' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>{s.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setShowProvisional(true)}
            title="Manually enter phase codes when Vista isn't set up yet"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontFamily: 'inherit', border: '1px solid #fde68a', borderRadius: 6, backgroundColor: '#fefce8', cursor: 'pointer', color: '#854d0e' }}>
            ✎ Manual Codes
          </button>
          <button onClick={onInitialize} disabled={initPending}
            style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#1e293b' }}>
            {initPending ? 'Initializing…' : hasAnyDates ? 'Fill Missing from Project Dates' : 'Initialize from Project Dates'}
          </button>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <button style={viewBtn(viewMode === 'gantt')} onClick={() => setViewMode('gantt')}>Gantt</button>
            <button style={{ ...viewBtn(viewMode === 'table'), borderLeft: '1px solid #e2e8f0' }} onClick={() => setViewMode('table')}>$ Cost</button>
            <button style={{ ...viewBtn(viewMode === 'manpower'), borderLeft: '1px solid #e2e8f0' }} onClick={() => setViewMode('manpower')}>Manpower</button>
          </div>
        </div>
      </div>

      {/* ── CHARTS + SHIFT SETTINGS ────────────────────────────────────────── */}
      {hasCharts && (
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>

          {/* ── Shift Settings card ── */}
          <div style={{ flexShrink: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef2f7', borderBottom: '1px solid #e2e8f0', fontSize: '0.68rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Shift Schedule
            </div>
            {/* Day header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <span style={{ flex: 1, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trade</span>
              {SHIFT_DAY_LABELS.map((lbl, i) => (
                <span key={i} style={{ width: 32, textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: i >= 5 ? '#f59e0b' : '#64748b', flexShrink: 0 }}>{lbl}</span>
              ))}
              <span style={{ width: 40, textAlign: 'right', fontSize: '0.6rem', color: '#94a3b8', flexShrink: 0 }}>Wk</span>
            </div>
            {/* Trade rows */}
            {SEGMENT_DEFINITIONS.filter(d => d.isLabor && activeKeys.includes(d.key)).map((def, ri) => {
              const shift = shiftSettings[def.key] ?? DEFAULT_SHIFT;
              const total = weeklyHours(shift);
              return (
                <div key={def.key} style={{ display: 'flex', alignItems: 'center', padding: '0.28rem 0.75rem', borderBottom: '1px solid #f1f5f9', background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 110 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: LABOR_CHART_COLORS[def.key] ?? '#6b7280', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.7rem', color: '#374151', whiteSpace: 'nowrap' }}>{def.label}</span>
                  </div>
                  {SHIFT_DAY_KEYS.map((day, di) => (
                    <input key={day} type="number" min={0} max={16} step={0.5} value={shift[day]}
                      onChange={e => updateShift(def.key, day, Math.max(0, Math.min(16, Number(e.target.value))))}
                      style={{ width: 32, padding: '0.15rem 0', border: '1px solid #e2e8f0', borderRadius: 3, fontSize: '0.7rem', textAlign: 'center', fontFamily: 'inherit', flexShrink: 0, background: di >= 5 ? '#fffbeb' : '#fff', color: shift[day] === 0 ? '#cbd5e1' : '#1e293b' }}
                    />
                  ))}
                  <span style={{ width: 40, textAlign: 'right', fontSize: '0.7rem', fontWeight: 600, color: '#3b82f6', flexShrink: 0 }}>{total}h</span>
                </div>
              );
            })}
          </div>

          {/* ── Manpower chart (middle) ── */}
          {laborDatasets.length > 0 && (
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Labor Resources by Month
              </div>
              <div style={{ height: 200, position: 'relative' }}>
                <Line
                  data={{
                    labels: chartLabels,
                    datasets: laborDatasets.map(ds => ({
                      label: ds.label,
                      data: ds.data,
                      borderColor: ds.color,
                      backgroundColor: ds.color + '18',
                      tension: 0.4,
                      pointRadius: 0,
                      pointHoverRadius: 5,
                      borderWidth: 2,
                      fill: false,
                    })),
                  }}
                  options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                      legend: {
                        display: laborDatasets.length > 1,
                        position: 'top',
                        labels: { boxWidth: 12, boxHeight: 2, font: { size: 10 }, padding: 8, usePointStyle: true, pointStyleWidth: 12 },
                      },
                      tooltip: {
                        callbacks: {
                          label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)} workers`,
                        },
                      },
                    },
                    scales: {
                      ...chartScales,
                      y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 9 }, color: '#64748b', stepSize: 1, callback: (v) => `${v}` } },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Revenue chart ── */}
          {monthlyRevenue.some(v => v > 0) && (
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Revenue by Month
                {projRev === 0 && (
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    (set Project Revenue to enable)
                  </span>
                )}
              </div>
              <div style={{ height: 200, position: 'relative' }}>
                <Bar
                  data={{
                    labels: chartLabels,
                    datasets: [{
                      label: projRev > 0 ? 'Revenue' : 'Projected Cost',
                      data: monthlyRevenue,
                      backgroundColor: '#10b981' + '70',
                      borderColor: '#10b981',
                      borderWidth: 1,
                      borderRadius: 2,
                    }],
                  }}
                  options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtCompact(ctx.parsed.y)}` },
                      },
                    },
                    scales: {
                      ...chartScales,
                      y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 9 }, color: '#64748b', callback: (v) => fmtCompact(v as number) } },
                    },
                  }}
                />
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Remaining hours method toggle ─────────────────────────────────── */}
      {(viewMode === 'gantt' || viewMode === 'manpower') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Labor Hrs:</span>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            {([
              { value: 'est-rate' as const, label: 'Est Rate', title: '(Proj Cost − JTD Cost) ÷ Estimated labor rate — use early in job when rate is still settling' },
              { value: 'jtd-rate' as const, label: 'JTD Rate', title: '(Proj Cost − JTD Cost) ÷ JTD labor rate — use once rate is stable' },
            ]).map((opt, i) => (
              <button key={opt.value} title={opt.title} onClick={() => setRemainingMode(opt.value)}
                style={{
                  padding: '0.3rem 0.65rem', fontSize: '0.72rem', cursor: 'pointer',
                  border: 'none', borderLeft: i > 0 ? '1px solid #e2e8f0' : 'none',
                  background: remainingMode === opt.value ? '#6366f1' : '#fff',
                  color: remainingMode === opt.value ? '#fff' : '#64748b',
                  fontFamily: 'inherit', fontWeight: remainingMode === opt.value ? 600 : 400,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            {remainingMode === 'est-rate' ? '(Proj − JTD) ÷ Est Rate' : '(Proj − JTD) ÷ JTD Rate'}
          </span>
        </div>
      )}

      {/* ── GANTT VIEW ─────────────────────────────────────────────────────── */}
      {viewMode === 'gantt' && (
        <div style={{ display: 'flex', overflow: 'hidden', border: '1px solid #94a3b8', borderRadius: 6 }}>

          {/* Left panel */}
          <div style={{ width: leftPanelWidth, flexShrink: 0, overflow: 'auto' }}>
            {/* Header */}
            <div style={{ height: ROW_H, display: 'flex', alignItems: 'stretch', background: '#eef2f7', borderBottom: '1px solid #94a3b8', position: 'sticky', top: 0, zIndex: 4 }}>
              <div style={{ ...hdrCell, flex: 1, minWidth: colWidths.label, padding: '0 0.5rem', justifyContent: 'flex-start', borderLeft: '3px solid transparent' }}>
                Cost Type{resizeHandle('label')}
              </div>
              <div style={{ ...hdrCell, width: colWidths.estHrs }}>Rem Hrs{resizeHandle('estHrs')}</div>
              <div style={{ ...hdrCell, width: colWidths.estCost }}>Rem ${resizeHandle('estCost')}</div>
              <div style={{ ...hdrCell, width: colWidths.start }}>Start{resizeHandle('start')}</div>
              <div style={{ ...hdrCell, width: colWidths.end }}>End{resizeHandle('end')}</div>
              <div style={{ ...hdrCell, width: colWidths.dur }}>Dur{resizeHandle('dur')}</div>
              <div style={{ ...hdrCell, width: colWidths.contour, borderRight: 'none' }}>Contour</div>
            </div>

            {/* Rows */}
            {rowItems.map(item => {
              if (item.type === 'group') return (
                <div key={`lg-${item.group}`} style={{
                  height: GROUP_H, display: 'flex', alignItems: 'center', padding: '0 0.75rem',
                  background: item.group === 'Labor' ? '#eff6ff' : '#f0fdf4',
                  borderTop: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0',
                  fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: item.group === 'Labor' ? '#1d4ed8' : '#15803d',
                }}>
                  {item.group}
                </div>
              );
              const { def, idx } = item;
              return (
                <GanttLeftRow key={def.key}
                  def={def} seg={segmentMap.get(def.key)} costs={costsMap.get(def.key)}
                  isActive={activeKeys.includes(def.key)} rowBg={idx % 2 === 0 ? '#fff' : '#f8fafc'}
                  color={SEGMENT_COLOR[def.key] ?? '#6b7280'} colWidths={colWidths} onSave={onSegmentUpdate}
                  hasProvisional={provisionalSegKeys.has(def.key)} remainingMode={remainingMode}
                />
              );
            })}
          </div>

          {/* Panel resize divider */}
          <div
            onMouseDown={e => { e.preventDefault(); panelDragRef.current = { startX: e.clientX, startW: leftPanelWidth }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
            style={{ width: 3, flexShrink: 0, cursor: 'col-resize', background: '#94a3b8', transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3b82f6'; }}
            onMouseLeave={e => { if (!panelDragRef.current) (e.currentTarget as HTMLElement).style.background = '#94a3b8'; }}
          />

          {/* Right panel — timeline */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ minWidth: totalW }}>
              {/* Month header */}
              <div style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid #94a3b8', background: '#eef2f7', position: 'sticky', top: 0, zIndex: 3 }}>
                {allMonths.map((m, i) => (
                  <div key={i} style={{ width: colWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                    {m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
                  </div>
                ))}
              </div>

              {/* Bar rows */}
              {rowItems.map(item => {
                if (item.type === 'group') return (
                  <div key={`rg-${item.group}`} style={{
                    height: GROUP_H, borderTop: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0',
                    background: item.group === 'Labor' ? '#eff6ff' : '#f0fdf4',
                  }}>
                    {allMonths.map((_, i) => (
                      <div key={i} style={{ display: 'inline-block', width: colWidth, height: '100%', borderRight: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                    ))}
                  </div>
                );

                const { def, idx } = item;
                const seg        = segmentMap.get(def.key);
                const color      = SEGMENT_COLOR[def.key] ?? '#6b7280';
                const rowBg      = idx % 2 === 0 ? '#fff' : '#f8fafc';
                const isActive   = activeKeys.includes(def.key);

                const startDate = seg?.start_date ? new Date(seg.start_date.slice(0, 10)) : null;
                const endDate   = seg?.end_date   ? new Date(seg.end_date.slice(0, 10))   : null;

                const today = new Date(); today.setHours(0, 0, 0, 0);
                const visualStart = startDate && startDate < today ? today : startDate;

                let barLeft = 0, barWidth = 0;
                if (visualStart && endDate && firstMonth) {
                  barLeft  = dateToX(visualStart, firstMonth, colWidth) + 2;
                  const eDays = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
                  barWidth = Math.max(0, dateToX(endDate, firstMonth, colWidth) + colWidth / eDays - barLeft);
                }

                const isDragging = barDragOffset?.segKey === def.key;
                const isResizing = barResizeOffset?.segKey === def.key;
                let adjLeft = barLeft + (isDragging ? barDragOffset!.deltaX : 0);
                let adjWidth = barWidth;
                if (isResizing) {
                  if (barResizeOffset!.edge === 'left') { adjLeft = barLeft + barResizeOffset!.deltaX; adjWidth = Math.max(8, barWidth - barResizeOffset!.deltaX); }
                  else { adjWidth = Math.max(8, barWidth + barResizeOffset!.deltaX); }
                }

                return (
                  <div key={def.key} style={{ height: ROW_H, position: 'relative', borderBottom: '1px solid #cbd5e1', background: rowBg, opacity: isActive ? 1 : 0.5 }}>
                    {/* Month stripes */}
                    {allMonths.map((_, i) => (
                      <div key={i} style={{ position: 'absolute', left: i * colWidth, top: 0, bottom: 0, width: colWidth, borderRight: '1px solid #e2e8f0' }} />
                    ))}
                    {/* Bar — only when row has Vista data and dates are set */}
                    {isActive && barWidth > 0 && (
                      <div style={{
                        position: 'absolute', left: adjLeft, top: 4, height: ROW_H - 8, width: adjWidth,
                        backgroundColor: color + '50', border: `2px solid ${color}`, borderRadius: 4,
                        display: 'flex', alignItems: 'center', paddingLeft: 6, paddingRight: 6, overflow: 'hidden',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        zIndex: isDragging || isResizing ? 10 : 1,
                      }}
                        onMouseDown={e => {
                          if (e.button !== 0 || !visualStart || !endDate) return;
                          e.stopPropagation();
                          barDragRef.current = {
                            segKey: def.key, startMouseX: e.clientX, originalBarLeft: barLeft,
                            originalStartDate: visualStart, originalEndDate: endDate,
                            durationDays: Math.round((endDate.getTime() - visualStart.getTime()) / 86400000),
                            dragStarted: false,
                          };
                        }}
                        onMouseEnter={e => { if (!barDragRef.current && !barResizeRef.current) (e.currentTarget as HTMLElement).style.backgroundColor = color + '70'; }}
                        onMouseLeave={e => { if (!barDragRef.current && !barResizeRef.current) (e.currentTarget as HTMLElement).style.backgroundColor = color + '50'; }}
                      >
                        {/* Left resize handle */}
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'w-resize', zIndex: 2 }}
                          onMouseDown={e => {
                            if (e.button !== 0 || !visualStart || !endDate) return;
                            e.stopPropagation(); e.preventDefault();
                            barResizeRef.current = { segKey: def.key, edge: 'left', startMouseX: e.clientX, originalBarLeft: barLeft, originalBarWidth: barWidth, originalStartDate: visualStart, originalEndDate: endDate, dragStarted: false };
                          }} />
                        <span style={{ fontSize: '0.65rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, pointerEvents: 'none' }}>
                          {def.label}
                        </span>
                        {/* Right resize handle */}
                        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'e-resize', zIndex: 2 }}
                          onMouseDown={e => {
                            if (e.button !== 0 || !visualStart || !endDate) return;
                            e.stopPropagation(); e.preventDefault();
                            barResizeRef.current = { segKey: def.key, edge: 'right', startMouseX: e.clientX, originalBarLeft: barLeft, originalBarWidth: barWidth, originalStartDate: visualStart, originalEndDate: endDate, dragStarted: false };
                          }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TABLE ($ COST) VIEW ───────────────────────────────────────────── */}
      {viewMode === 'table' && (() => {
        const monthColW = Math.max(48, Math.min(80, Math.floor(500 / (allMonths.length || 1))));
        lastGroup = '';
        return (
          <div style={{ border: '1px solid #94a3b8', borderRadius: 6, overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 220 }} /><col style={{ width: 105 }} /><col style={{ width: 105 }} />
                <col style={{ width: 46 }} /><col style={{ width: 100 }} /><col style={{ width: 82 }} />
                <col style={{ width: 64 }} /><col style={{ width: 80 }} /><col style={{ width: 64 }} />
                <col style={{ width: 82 }} /><col style={{ width: 78 }} />
                {allMonths.map((_, i) => <col key={i} style={{ width: monthColW }} />)}
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
                <tr>
                  {[
                    [COL_GROUP.sched.hdr, 'Cost Type', { textAlign: 'left', padding: '0.15rem 0.6rem', position: 'sticky', left: 0, zIndex: 6, borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.sched.hdr, 'Start', {}], [COL_GROUP.sched.hdr, 'End', {}],
                    [COL_GROUP.sched.hdr, 'Dur', {}], [COL_GROUP.sched.hdr, 'Contour', { borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.est.hdr, 'Est Cost', {}], [COL_GROUP.est.hdr, 'Est Hrs', { borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.jtd.hdr, 'JTD Cost', {}], [COL_GROUP.jtd.hdr, 'JTD Hrs', { borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.proj.hdr, 'Proj Cost', { borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.rem.hdr, 'Remaining', { borderRight: '2px solid #94a3b8' }],
                  ].map(([bg, label, extra]: any) => (
                    <th key={label} style={{ height: 28, padding: '0.15rem 0.3rem', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b', background: bg, whiteSpace: 'nowrap', textAlign: 'center', borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', verticalAlign: 'middle', ...extra }}>
                      {label}
                    </th>
                  ))}
                  {allMonths.map((m, i) => (
                    <th key={i} style={{ height: 28, padding: '0.15rem 0.1rem', fontSize: '0.62rem', fontWeight: 600, color: '#1e293b', background: '#eef2f7', textAlign: 'center', borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', verticalAlign: 'middle' }}>
                      {m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEGMENT_DEFINITIONS.map((def, idx) => {
                  const g = def.isLabor ? 'Labor' : 'Non-Labor';
                  const showDiv = g !== lastGroup; lastGroup = g;
                  const totalCols = 11 + allMonths.length;
                  const rowBg = idx % 2 === 0 ? '#fff' : '#f8fafc';
                  return (
                    <React.Fragment key={def.key}>
                      {showDiv && (
                        <tr>
                          <td colSpan={totalCols} style={{ background: g === 'Labor' ? '#eff6ff' : '#f0fdf4', padding: '0.15rem 0.75rem', fontSize: '0.63rem', fontWeight: 700, color: g === 'Labor' ? '#1d4ed8' : '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0' }}>
                            {g}
                          </td>
                        </tr>
                      )}
                      <TableRow def={def} seg={segmentMap.get(def.key)} costs={costsMap.get(def.key)}
                        isActive={activeKeys.includes(def.key)} rowBg={rowBg}
                        color={SEGMENT_COLOR[def.key] ?? '#6b7280'} allMonths={allMonths} onSave={onSegmentUpdate}
                        hasProvisional={provisionalSegKeys.has(def.key)}
                      />
                    </React.Fragment>
                  );
                })}
                {/* ── Total row ── */}
                {(() => {
                  const totEstCost  = SEGMENT_DEFINITIONS.reduce((s, d) => activeKeys.includes(d.key) ? s + safeN(costsMap.get(d.key)?.est_cost)  : s, 0);
                  const totEstHrs   = SEGMENT_DEFINITIONS.reduce((s, d) => activeKeys.includes(d.key) && d.isLabor ? s + safeN(costsMap.get(d.key)?.est_hours)  : s, 0);
                  const totJtdCost  = SEGMENT_DEFINITIONS.reduce((s, d) => activeKeys.includes(d.key) ? s + safeN(costsMap.get(d.key)?.jtd_cost)  : s, 0);
                  const totJtdHrs   = SEGMENT_DEFINITIONS.reduce((s, d) => activeKeys.includes(d.key) && d.isLabor ? s + safeN(costsMap.get(d.key)?.jtd_hours)  : s, 0);
                  const totProjCost = SEGMENT_DEFINITIONS.reduce((s, d) => activeKeys.includes(d.key) ? s + safeN(costsMap.get(d.key)?.projected_cost) : s, 0);
                  const totRem      = totProjCost - totJtdCost;
                  const tTd = (extra: React.CSSProperties = {}): React.CSSProperties => ({
                    height: 30, padding: '0 0.3rem', borderTop: '2px solid #475569', borderBottom: '2px solid #475569',
                    borderRight: '1px solid #94a3b8', verticalAlign: 'middle', fontSize: '0.75rem',
                    fontWeight: 700, color: '#1e293b', background: '#e2e8f0', ...extra,
                  });
                  return (
                    <tr>
                      <td style={tTd({ padding: '0 0.6rem', position: 'sticky', left: 0, zIndex: 2, background: '#cbd5e1', borderLeft: '3px solid #475569', borderRight: '2px solid #475569' })}>
                        TOTAL
                      </td>
                      <td colSpan={4} style={tTd({ borderRight: '2px solid #475569' })} />
                      <td style={tTd({ textAlign: 'right', background: '#dbeafe' })}>{fmt$(totEstCost || null)}</td>
                      <td style={tTd({ textAlign: 'right', background: '#dbeafe', borderRight: '2px solid #475569' })}>{fmtHrs(totEstHrs || null)}</td>
                      <td style={tTd({ textAlign: 'right', background: '#fef3c7' })}>{fmt$(totJtdCost || null)}</td>
                      <td style={tTd({ textAlign: 'right', background: '#fef3c7', borderRight: '2px solid #475569' })}>{fmtHrs(totJtdHrs || null)}</td>
                      <td style={tTd({ textAlign: 'right', background: '#dcfce7', borderRight: '2px solid #475569' })}>{fmt$(totProjCost || null)}</td>
                      <td style={tTd({ textAlign: 'right', background: '#ede9fe', borderRight: '2px solid #475569', color: totRem < 0 ? '#dc2626' : '#1e293b' })}>{fmt$(totRem || null)}</td>
                      {allMonths.map((_, i) => {
                        const val = SEGMENT_DEFINITIONS.reduce((s, d) => activeKeys.includes(d.key) ? s + (segMonthlyRem.get(d.key)?.[i] ?? 0) : s, 0);
                        const bg = i % 2 === 0 ? '#e2e8f0' : '#d9dfe8';
                        return (
                          <td key={i} style={tTd({ textAlign: 'right', padding: '0 0.25rem', background: bg, color: val > 0 ? '#1e293b' : '#94a3b8' })}>
                            {val > 500 ? fmtK(val) : val > 0 ? `$${Math.round(val).toLocaleString()}` : ''}
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
      })()}

      {/* ── MANPOWER VIEW ─────────────────────────────────────────────────── */}
      {viewMode === 'manpower' && (() => {
        const colW = Math.max(52, Math.min(80, Math.floor(500 / (allMonths.length || 1))));
        const peakHC = Math.max(...monthlyTotalHC, 0);
        const fmtHC = (v: number) => v >= 0.05 ? v.toFixed(1) : '';
        const cell: React.CSSProperties = {
          padding: '0 0.4rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
          height: ROW_H, verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '0.75rem',
        };
        return (
          <div style={{ overflowX: 'auto', border: '1px solid #94a3b8', borderRadius: 6 }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: '#eef2f7', position: 'sticky', top: 0, zIndex: 3 }}>
                  <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: '0.68rem', minWidth: 180, position: 'sticky', left: 0, background: '#eef2f7', zIndex: 4, borderLeft: '3px solid transparent', borderRight: '2px solid #94a3b8' }}>
                    Cost Type
                  </th>
                  <th style={{ ...cell, textAlign: 'right', fontWeight: 700, fontSize: '0.68rem', minWidth: 72, background: '#eef2f7' }}>Rem Hrs</th>
                  <th style={{ ...cell, textAlign: 'right', fontWeight: 700, fontSize: '0.68rem', minWidth: 72, background: '#eef2f7', borderRight: '2px solid #94a3b8' }}>Rem $</th>
                  {allMonths.map((m, i) => (
                    <th key={i} style={{ ...cell, textAlign: 'center', fontWeight: 700, fontSize: '0.68rem', width: colW, background: '#eef2f7' }}>
                      {m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.ReactNode[] = [];
                  let lastG = '';
                  let rowIdx = 0;
                  SEGMENT_DEFINITIONS.forEach(def => {
                    if (!activeKeys.includes(def.key)) return;
                    const group = def.isLabor ? 'LABOR' : 'NON-LABOR';
                    if (group !== lastG) {
                      lastG = group;
                      rows.push(
                        <tr key={`g-${group}`}>
                          <td colSpan={3 + allMonths.length} style={{ ...cell, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.06em', textTransform: 'uppercase', background: def.isLabor ? '#eff6ff' : '#f0fdf4', color: def.isLabor ? '#1d4ed8' : '#15803d', borderTop: '2px solid #94a3b8', borderLeft: 'none', borderRight: 'none', padding: '0 0.75rem' }}>
                            {group}
                          </td>
                        </tr>
                      );
                    }
                    const c      = costsMap.get(def.key);
                    const color  = SEGMENT_COLOR[def.key] ?? '#6b7280';
                    const remHrs = calcRemHrs(c, remainingMode);
                    const remCost = safeN(c?.projected_cost) - safeN(c?.jtd_cost);
                    const bg = rowIdx % 2 === 0 ? '#fff' : '#f8fafc';
                    rowIdx++;
                    const monthlyHrs = segMonthlyRemHrs.get(def.key) ?? allMonths.map(() => 0);
                    rows.push(
                      <tr key={def.key} style={{ background: bg }}>
                        <td style={{ ...cell, position: 'sticky', left: 0, background: bg, zIndex: 1, borderLeft: `3px solid ${def.isLabor ? '#3b82f6' : '#10b981'}`, borderRight: '2px solid #94a3b8' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 500, fontSize: '0.75rem' }}>{def.label}</span>
                            <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace', marginLeft: 'auto' }}>{def.key.toUpperCase()}</span>
                          </span>
                        </td>
                        <td style={{ ...cell, textAlign: 'right', color: '#64748b', fontSize: '0.7rem' }}>
                          {def.isLabor && remHrs != null ? fmtHrs(Math.max(0, remHrs)) : '—'}
                        </td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: 600, borderRight: '2px solid #94a3b8', color: remCost < 0 ? '#dc2626' : '#1e293b' }}>
                          {c?.projected_cost != null ? fmtCompact(remCost) : '—'}
                        </td>
                        {allMonths.map((_, i) => {
                          if (!def.isLabor) return <td key={i} style={{ ...cell, textAlign: 'center', color: '#cbd5e1' }}>—</td>;
                          const hpp = hoursPerPersonPerMonth(shiftSettings[def.key] ?? DEFAULT_SHIFT);
                          const hc = hpp > 0 ? monthlyHrs[i] / hpp : 0;
                          const intensity = peakHC > 0 ? hc / peakHC : 0;
                          return (
                            <td key={i} style={{ ...cell, textAlign: 'center', fontWeight: hc >= 0.05 ? 600 : 400,
                              background: hc >= 0.05 ? `${color}${Math.round(intensity * 0.35 * 255).toString(16).padStart(2, '0')}` : undefined,
                              color: hc >= 0.05 ? '#1e293b' : '#cbd5e1' }}>
                              {fmtHC(hc)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                  return rows;
                })()}
                {/* Totals row */}
                <tr style={{ background: '#e2e8f0', fontWeight: 700, borderTop: '2px solid #94a3b8' }}>
                  <td style={{ ...cell, position: 'sticky', left: 0, background: '#e2e8f0', zIndex: 1, borderLeft: '3px solid #475569', borderRight: '2px solid #94a3b8', fontSize: '0.72rem' }}>TOTAL</td>
                  <td style={{ ...cell, textAlign: 'right', fontSize: '0.72rem' }}>
                    {fmtHrs(SEGMENT_DEFINITIONS.filter(d => d.isLabor && activeKeys.includes(d.key)).reduce((s, d) => { const v = calcRemHrs(costsMap.get(d.key), remainingMode); return s + (v != null ? Math.max(0, v) : 0); }, 0) || null)}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', borderRight: '2px solid #94a3b8', fontSize: '0.72rem' }}>{fmtCompact(totalRem)}</td>
                  {allMonths.map((_, i) => {
                    const hc = monthlyTotalHC[i];
                    return (
                      <td key={i} style={{ ...cell, textAlign: 'center', background: i % 2 === 0 ? '#d9dfe8' : '#d1d8e2', color: hc >= 0.05 ? '#1e293b' : '#94a3b8' }}>
                        {hc >= 0.05 ? hc.toFixed(1) : ''}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}

      {showProvisional && (
        <CostTypeProvisionalsModal
          projectId={projectId}
          defaultJob={project?.number || ''}
          onClose={() => {
            setShowProvisional(false);
            queryClient.invalidateQueries({ queryKey: ['schedule-segment-costs', projectId] });
            queryClient.invalidateQueries({ queryKey: ['vpShopFieldHours'] });
            queryClient.invalidateQueries({ queryKey: ['bulkSegments'] });
          }}
        />
      )}
    </div>
  );
};

export default CostTypeSchedule;
