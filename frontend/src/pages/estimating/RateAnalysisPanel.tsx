import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import {
  getRateAnalysis,
  saveRateAnalysis,
  RateAnalysis,
  RateAnalysisConfig,
  RateAnalysisLaborRow,
} from '../../services/costControl';

// ------------------------------------------------------------------
// Trade / classification definitions
// ------------------------------------------------------------------

const FIELD_SHOP_CLASSES = [
  { key: 'journeyman',      label: 'Journeyman' },
  { key: 'superintendent',  label: 'Superintendent' },
  { key: 'general_foreman', label: 'General Foreman' },
  { key: 'foreman',         label: 'Foreman' },
  { key: 'app_5th',         label: 'App. 5th Year' },
  { key: 'app_4th',         label: 'App. 4th Year' },
  { key: 'app_3rd',         label: 'App. 3rd Year' },
  { key: 'app_2nd',         label: 'App. 2nd Year' },
  { key: 'app_1st',         label: 'App. 1st Year' },
];

const TRADE_DEFS: { key: string; label: string; classifications: { key: string; label: string }[] }[] = [
  { key: 'sm_field', label: 'Sheet Metal — Field',   classifications: FIELD_SHOP_CLASSES },
  { key: 'sm_shop',  label: 'Sheet Metal — Shop',    classifications: FIELD_SHOP_CLASSES },
  { key: 'pf_field', label: 'Pipefitter — Field',    classifications: FIELD_SHOP_CLASSES },
  { key: 'pf_shop',  label: 'Pipefitter — Shop',     classifications: FIELD_SHOP_CLASSES },
  { key: 'pl_field', label: 'Plumber — Field',       classifications: FIELD_SHOP_CLASSES },
  { key: 'pl_shop',  label: 'Plumber — Shop',        classifications: FIELD_SHOP_CLASSES },
  { key: 'general',  label: 'General / Admin', classifications: [
    { key: 'project_manager',       label: 'Project Manager' },
    { key: 'project_engineer',      label: 'Project Engineer' },
    { key: 'project_administrator', label: 'Project Administrator' },
    { key: 'project_coordinator',   label: 'Project Coordinator' },
  ]},
  { key: 'service',  label: 'Service', classifications: [
    { key: 'rts',          label: 'RTS' },
    { key: 'service_tech', label: 'Service Tech' },
  ]},
];

// ------------------------------------------------------------------
// Formatting helpers
// ------------------------------------------------------------------

const fmtD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtI = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%';

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/[$,%,]/g, '')) || 0;
}

// ------------------------------------------------------------------
// Calculation helpers
// ------------------------------------------------------------------

function computeLaborRow(row: RateAnalysisLaborRow, feePct: number, feeApplies: boolean) {
  const hrs = Number(row.estimated_hours) || 0;
  const actualRate = Number(row.actual_rate) || 0;
  const billRate = Number(row.billable_rate) || 0;
  const actualCost = hrs * actualRate;
  const exposedValue = hrs * billRate;
  const rateMargin = exposedValue - actualCost;
  const feeIncome = feeApplies ? exposedValue * feePct : 0;
  const totalMargin = rateMargin + feeIncome;
  return { hrs, actualCost, exposedValue, rateMargin, feeIncome, totalMargin };
}

interface NonLaborSummary {
  materialActual: number;
  materialMarkup: number;
  materialFee: number;
  equipmentActual: number;
  equipmentMarkup: number;
  equipmentFee: number;
  subActual: number;
  subMarkup: number;
  subFee: number;
  gcActual: number;
  gcFee: number;
}

function computeNonLabor(cfg: RateAnalysisConfig): NonLaborSummary {
  const feePct   = Number(cfg.construction_fee_pct)  || 0;
  const matPct   = Number(cfg.material_markup_pct)   || 0;
  const equipPct = Number(cfg.equipment_markup_pct)  || 0;
  const subPct   = Number(cfg.sub_markup_pct)        || 0;
  const mat   = Number(cfg.material_cost)       || 0;
  const equip = Number(cfg.equipment_cost)      || 0;
  const sub   = Number(cfg.subcontract_cost)    || 0;
  const gc    = Number(cfg.gen_conditions_cost) || 0;
  return {
    materialActual:  mat,
    materialMarkup:  mat * matPct,
    materialFee:     cfg.fee_applies_material    ? mat   * feePct : 0,
    equipmentActual: equip,
    equipmentMarkup: equip * equipPct,
    equipmentFee:    cfg.fee_applies_equipment   ? equip * feePct : 0,
    subActual:       sub,
    subMarkup:       sub * subPct,
    subFee:          cfg.fee_applies_subcontract ? sub   * feePct : 0,
    gcActual:        gc,
    gcFee:           cfg.fee_applies_gc          ? gc    * feePct : 0,
  };
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface Props {
  matrixId: number;
}

export default function RateAnalysisPanel({ matrixId }: Props) {
  const { toast } = useTitanFeedback();
  const [data, setData] = useState<RateAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collapsed trade groups
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (trade: string) =>
    setCollapsed(prev => { const n = new Set(prev); if (n.has(trade)) n.delete(trade); else n.add(trade); return n; });

  const load = useCallback(async () => {
    try {
      const d = await getRateAnalysis(matrixId);
      setData(d);
    } catch {
      toast.error('Failed to load rate analysis');
    } finally {
      setLoading(false);
    }
  }, [matrixId]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const scheduleSave = useCallback((next: RateAnalysis) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try { await saveRateAnalysis(matrixId, next); }
      catch { toast.error('Failed to save rate analysis'); }
      finally { setSaving(false); }
    }, 1200);
  }, [matrixId]); // eslint-disable-line

  const patchConfig = (patch: Partial<RateAnalysisConfig>) => {
    setData(prev => {
      if (!prev) return prev;
      const next = { ...prev, config: { ...prev.config, ...patch } };
      scheduleSave(next);
      return next;
    });
  };

  const patchLaborRow = (trade: string, classification: string, patch: Partial<RateAnalysisLaborRow>) => {
    setData(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        labor: prev.labor.map(r =>
          r.trade === trade && r.classification === classification ? { ...r, ...patch } : r
        ),
      };
      scheduleSave(next);
      return next;
    });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#8888a0' }}>Loading…</div>;
  if (!data) return null;

  const { config, labor } = data;
  const feePct = Number(config.construction_fee_pct) || 0;

  // Build labor lookup for quick access
  const laborByKey: Record<string, RateAnalysisLaborRow> = {};
  for (const row of labor) laborByKey[`${row.trade}__${row.classification}`] = row;

  // Compute grand totals across all labor rows
  let totalLaborActual = 0;
  let totalLaborExposed = 0;
  let totalLaborRateMargin = 0;
  let totalLaborFeeMargin = 0;
  for (const row of labor) {
    const c = computeLaborRow(row, feePct, config.fee_applies_labor ?? true);
    totalLaborActual += c.actualCost;
    totalLaborExposed += c.exposedValue;
    totalLaborRateMargin += c.rateMargin;
    totalLaborFeeMargin += c.feeIncome;
  }

  const nl = computeNonLabor(config);
  const totalNonLaborActual = nl.materialActual + nl.equipmentActual + nl.subActual + nl.gcActual;
  const totalNonLaborMargin = nl.materialMarkup + nl.materialFee + nl.equipmentMarkup + nl.equipmentFee + nl.subMarkup + nl.subFee + nl.gcFee;

  const grandActual = totalLaborActual + totalNonLaborActual;
  const grandMargin = totalLaborRateMargin + totalLaborFeeMargin + totalNonLaborMargin;
  const grandRevenue = grandActual + grandMargin;
  const profitPct = grandRevenue > 0 ? grandMargin / grandRevenue : 0;

  const thStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#5a5a72',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid #e0e2e7',
    background: '#f8f9fa',
  };
  const thL: React.CSSProperties = { ...thStyle, textAlign: 'left' };
  const tdR: React.CSSProperties = {
    padding: '4px 10px',
    textAlign: 'right',
    fontSize: 12,
    borderBottom: '1px solid #f0f1f3',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  };
  const tdL: React.CSSProperties = { ...tdR, textAlign: 'left' };

  return (
    <div>
      {saving && (
        <div style={{ textAlign: 'right', fontSize: 11, color: '#8888a0', marginBottom: 8 }}>Saving…</div>
      )}

      {/* ── KPI Summary (always visible) ── */}
      <div className="ccm-card">
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Project Profitability Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'Total Actual Cost',  value: fmtI(grandActual),   sub: 'Internal burden cost',  color: '#1e40af', bg: '#eff6ff' },
            { label: 'Total Revenue',      value: fmtI(grandRevenue),  sub: 'What client pays',      color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'Total Margin',       value: fmtI(grandMargin),   sub: grandRevenue > 0 ? fmtPct(profitPct) + ' of revenue' : 'Enter data above', color: grandMargin >= 0 ? '#059669' : '#dc2626', bg: grandMargin >= 0 ? '#f0fdf4' : '#fef2f2' },
            { label: 'Profit %',           value: grandRevenue > 0 ? fmtPct(profitPct) : '—',        sub: 'Margin / Revenue',      color: profitPct >= 0.15 ? '#059669' : profitPct >= 0.08 ? '#d97706' : '#dc2626', bg: '#fff' },
          ].map(({ label, value, sub, color, bg }) => (
            <div key={label} style={{ background: bg, border: '1px solid #e0e2e7', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8888a0', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 11, color: '#8888a0', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Margin breakdown — only when there's data */}
        {grandRevenue > 0 && (() => {
          const breakdown = [
            { label: 'Labor — Rate Spread',      value: totalLaborRateMargin },
            { label: 'Labor — Fee Income',        value: totalLaborFeeMargin },
            { label: 'Material — Markup',         value: nl.materialMarkup },
            { label: 'Material — Fee',            value: nl.materialFee },
            { label: 'Equipment — Markup',        value: nl.equipmentMarkup },
            { label: 'Equipment — Fee',           value: nl.equipmentFee },
            { label: 'Subcontracts — Markup',     value: nl.subMarkup },
            { label: 'Subcontracts — Fee',        value: nl.subFee },
            { label: 'General Conditions — Fee',  value: nl.gcFee },
          ].filter(r => r.value !== 0);
          return (
            <div style={{ marginTop: 20, borderTop: '1px solid #f0f1f3', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#5a5a72', marginBottom: 10 }}>Margin by Source</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {breakdown.map(({ label, value }) => {
                  const share = grandMargin > 0 ? value / grandMargin : 0;
                  return (
                    <div key={label} style={{ background: '#f8f9fa', border: '1px solid #e0e2e7', borderRadius: 8, padding: '8px 12px', minWidth: 160 }}>
                      <div style={{ fontSize: 10, color: '#8888a0', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: value >= 0 ? '#059669' : '#dc2626' }}>{fmtI(value)}</div>
                      <div style={{ marginTop: 4, height: 4, background: '#e0e2e7', borderRadius: 2 }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, share * 100))}%`, height: '100%', background: '#3b82f6', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#8888a0', marginTop: 2 }}>{(share * 100).toFixed(1)}% of margin</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Fee Structure ── */}
      <div className="ccm-card">
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Fee Structure</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          {[
            { label: 'Construction Fee %',    field: 'construction_fee_pct'  as const },
            { label: 'Material Markup %',     field: 'material_markup_pct'   as const },
            { label: 'Equipment Markup %',    field: 'equipment_markup_pct'  as const },
            { label: 'Subcontract Markup %',  field: 'sub_markup_pct'        as const },
          ].map(({ label, field }) => (
            <label key={field} style={{ fontSize: 11, fontWeight: 600, color: '#5a5a72', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {label}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  style={{ width: 80, background: '#f8f9fa', border: '1px solid #e0e2e7', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: '#1a1a2e' }}
                  value={+(Number(config[field]) * 100).toFixed(2)}
                  onChange={e => patchConfig({ [field]: parseNum(e.target.value) / 100 })}
                />
                <span style={{ fontSize: 12, color: '#8888a0' }}>%</span>
              </div>
            </label>
          ))}
        </div>

        {/* Fee applicability toggles */}
        <div style={{ borderTop: '1px solid #f0f1f3', paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#5a5a72', marginBottom: 10 }}>
            Construction fee applies to:
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {([
              { label: 'Labor',         field: 'fee_applies_labor'       as const },
              { label: 'Material',      field: 'fee_applies_material'    as const },
              { label: 'Equipment',     field: 'fee_applies_equipment'   as const },
              { label: 'Subcontracts',  field: 'fee_applies_subcontract' as const },
              { label: 'Gen. Conditions', field: 'fee_applies_gc'        as const },
            ] as { label: string; field: keyof RateAnalysisConfig }[]).map(({ label, field }) => {
              const checked = config[field] as boolean ?? true;
              return (
                <label
                  key={field}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '5px 12px', borderRadius: 20,
                    background: checked ? '#dbeafe' : '#f0f1f3',
                    border: `1px solid ${checked ? '#bfdbfe' : '#e0e2e7'}`,
                    fontSize: 12, fontWeight: 600,
                    color: checked ? '#1e40af' : '#8888a0',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => patchConfig({ [field]: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  {checked ? '✓' : '○'} {label}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Labor Rates ── */}
      <div className="ccm-card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Labor Hours &amp; Rates</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#8888a0' }}>
          Enter estimated hours per classification. Actual rate = internal burden. Billable rate = submitted schedule of values.
        </p>

        {TRADE_DEFS.map(trade => {
          const isCollapsed = collapsed.has(trade.key);
          // Compute trade totals
          let tradeActual = 0, tradeExposed = 0, tradeRateMargin = 0, tradeFeeMargin = 0;
          for (const cls of trade.classifications) {
            const row = laborByKey[`${trade.key}__${cls.key}`];
            if (row) {
              const c = computeLaborRow(row, feePct, config.fee_applies_labor ?? true);
              tradeActual += c.actualCost;
              tradeExposed += c.exposedValue;
              tradeRateMargin += c.rateMargin;
              tradeFeeMargin += c.feeIncome;
            }
          }
          const hasHours = tradeActual > 0 || tradeExposed > 0;

          return (
            <div key={trade.key} style={{ marginBottom: 12 }}>
              {/* Trade header */}
              <div
                onClick={() => toggleCollapse(trade.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 12px',
                  background: '#f8f9fa',
                  border: '1px solid #e0e2e7',
                  borderRadius: isCollapsed ? 8 : '8px 8px 0 0',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 11, color: '#8888a0', width: 14 }}>{isCollapsed ? '▶' : '▼'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>{trade.label}</span>
                {hasHours && !isCollapsed && (
                  <span style={{ fontSize: 11, color: '#5a5a72' }}>
                    Actual: {fmtI(tradeActual)} · Exposed: {fmtI(tradeExposed)} · Rate Margin: {fmtI(tradeRateMargin)} · Fee: {fmtI(tradeFeeMargin)}
                  </span>
                )}
                {hasHours && isCollapsed && (
                  <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                    Total Margin: {fmtI(tradeRateMargin + tradeFeeMargin)}
                  </span>
                )}
              </div>

              {!isCollapsed && (
                <div className="ccm-table-scroll" style={{ border: '1px solid #e0e2e7', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                  <table className="ccm-items-table" style={{ minWidth: 860 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thL, minWidth: 160 }}>Classification</th>
                        <th style={{ ...thStyle, minWidth: 90 }}>Est. Hours</th>
                        <th style={{ ...thStyle, minWidth: 100 }}>Actual Rate</th>
                        <th style={{ ...thStyle, minWidth: 100 }}>Billable Rate</th>
                        <th style={{ ...thStyle, minWidth: 110, background: '#f0f4ff', color: '#3b5dc9' }}>Actual Cost</th>
                        <th style={{ ...thStyle, minWidth: 110, background: '#f0f4ff', color: '#3b5dc9' }}>Exposed Value</th>
                        <th style={{ ...thStyle, minWidth: 110, background: '#ecfdf5', color: '#059669' }}>Rate Margin</th>
                        <th style={{ ...thStyle, minWidth: 100, background: '#ecfdf5', color: '#059669' }}>Fee Income</th>
                        <th style={{ ...thStyle, minWidth: 110, background: '#ecfdf5', color: '#059669', fontWeight: 700 }}>Total Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trade.classifications.map(cls => {
                        const row = laborByKey[`${trade.key}__${cls.key}`];
                        if (!row) return null;
                        const c = computeLaborRow(row, feePct, config.fee_applies_labor ?? true);
                        const hasData = c.hrs > 0;

                        return (
                          <tr key={cls.key} style={{ background: hasData ? undefined : '#fafafa' }}>
                            <td style={{ ...tdL, color: hasData ? '#1a1a2e' : '#8888a0' }}>{cls.label}</td>
                            <td style={tdR}>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                style={{ width: 72, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', fontSize: 12, textAlign: 'right', color: '#1a1a2e' }}
                                value={row.estimated_hours || ''}
                                placeholder="0"
                                onChange={e => patchLaborRow(trade.key, cls.key, { estimated_hours: parseNum(e.target.value) })}
                                onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                                onBlur={e => (e.target.style.borderColor = 'transparent')}
                              />
                            </td>
                            <td style={tdR}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                style={{ width: 76, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', fontSize: 12, textAlign: 'right', color: '#1a1a2e' }}
                                value={row.actual_rate || ''}
                                placeholder="0.00"
                                onChange={e => patchLaborRow(trade.key, cls.key, { actual_rate: parseNum(e.target.value) })}
                                onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                                onBlur={e => (e.target.style.borderColor = 'transparent')}
                              />
                            </td>
                            <td style={tdR}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                style={{ width: 76, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', fontSize: 12, textAlign: 'right', color: '#1a1a2e' }}
                                value={row.billable_rate || ''}
                                placeholder="0.00"
                                onChange={e => patchLaborRow(trade.key, cls.key, { billable_rate: parseNum(e.target.value) })}
                                onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                                onBlur={e => (e.target.style.borderColor = 'transparent')}
                              />
                            </td>
                            <td style={{ ...tdR, background: '#f5f7ff', color: '#1e40af' }}>{hasData ? fmtI(c.actualCost) : '—'}</td>
                            <td style={{ ...tdR, background: '#f5f7ff', color: '#1e40af' }}>{hasData ? fmtI(c.exposedValue) : '—'}</td>
                            <td style={{ ...tdR, background: '#f0fdf4', color: c.rateMargin >= 0 ? '#059669' : '#dc2626', fontWeight: hasData ? 600 : 400 }}>
                              {hasData ? fmtI(c.rateMargin) : '—'}
                            </td>
                            <td style={{ ...tdR, background: '#f0fdf4', color: '#059669' }}>{hasData ? fmtI(c.feeIncome) : '—'}</td>
                            <td style={{ ...tdR, background: '#f0fdf4', color: c.totalMargin >= 0 ? '#059669' : '#dc2626', fontWeight: hasData ? 700 : 400 }}>
                              {hasData ? fmtI(c.totalMargin) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Trade subtotal row */}
                      {hasHours && (
                        <tr style={{ background: '#f0f4ff', borderTop: '2px solid #e0e2e7' }}>
                          <td style={{ ...tdL, fontWeight: 700, color: '#1e40af', fontSize: 12 }} colSpan={4}>
                            {trade.label} Subtotal
                          </td>
                          <td style={{ ...tdR, background: '#e8eeff', color: '#1e40af', fontWeight: 700 }}>{fmtI(tradeActual)}</td>
                          <td style={{ ...tdR, background: '#e8eeff', color: '#1e40af', fontWeight: 700 }}>{fmtI(tradeExposed)}</td>
                          <td style={{ ...tdR, background: '#dcfce7', color: '#059669', fontWeight: 700 }}>{fmtI(tradeRateMargin)}</td>
                          <td style={{ ...tdR, background: '#dcfce7', color: '#059669', fontWeight: 700 }}>{fmtI(tradeFeeMargin)}</td>
                          <td style={{ ...tdR, background: '#dcfce7', color: '#059669', fontWeight: 700 }}>{fmtI(tradeRateMargin + tradeFeeMargin)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Labor grand subtotal */}
        {totalLaborActual > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 16, background: '#1e40af', borderRadius: 8, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 600, flexWrap: 'wrap' }}>
            <span>All Labor — Actual Cost: {fmtI(totalLaborActual)}</span>
            <span>·</span>
            <span>Exposed: {fmtI(totalLaborExposed)}</span>
            <span>·</span>
            <span>Rate Margin: {fmtI(totalLaborRateMargin)}</span>
            <span>·</span>
            <span>Fee Income: {fmtI(totalLaborFeeMargin)}</span>
            <span>·</span>
            <span>Total Labor Margin: {fmtI(totalLaborRateMargin + totalLaborFeeMargin)}</span>
          </div>
        )}
      </div>

      {/* ── Non-Labor Costs ── */}
      <div className="ccm-card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Non-Labor Costs</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#8888a0' }}>
          Enter estimated cost. Markup % and fee % apply automatically.
        </p>
        <div className="ccm-table-scroll">
          <table className="ccm-items-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ ...thL, minWidth: 160 }}>Category</th>
                <th style={{ ...thStyle, minWidth: 130 }}>Cost ($)</th>
                <th style={{ ...thStyle, minWidth: 80 }}>Markup %</th>
                <th style={{ ...thStyle, minWidth: 100, background: '#f0f4ff', color: '#3b5dc9' }}>Markup $</th>
                <th style={{ ...thStyle, minWidth: 80 }}>Fee %</th>
                <th style={{ ...thStyle, minWidth: 100, background: '#ecfdf5', color: '#059669' }}>Fee $</th>
                <th style={{ ...thStyle, minWidth: 110, background: '#ecfdf5', color: '#059669', fontWeight: 700 }}>Total Margin</th>
              </tr>
            </thead>
            <tbody>
              {/* Material */}
              <tr>
                <td style={tdL}>Material</td>
                <td style={tdR}>
                  <input
                    type="number" min="0" step="100"
                    style={{ width: 110, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', fontSize: 12, textAlign: 'right', color: '#1a1a2e' }}
                    value={config.material_cost || ''}
                    placeholder="0"
                    onChange={e => patchConfig({ material_cost: parseNum(e.target.value) })}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                  />
                </td>
                <td style={{ ...tdR, color: '#8888a0' }}>{fmtPct(Number(config.material_markup_pct) || 0)}</td>
                <td style={{ ...tdR, background: '#f5f7ff', color: '#1e40af' }}>{nl.materialActual > 0 ? fmtI(nl.materialMarkup) : '—'}</td>
                <td style={{ ...tdR, color: '#8888a0' }}>{fmtPct(feePct)}</td>
                <td style={{ ...tdR, background: '#f0fdf4', color: '#059669' }}>{nl.materialActual > 0 ? fmtI(nl.materialFee) : '—'}</td>
                <td style={{ ...tdR, background: '#f0fdf4', color: '#059669', fontWeight: 700 }}>{nl.materialActual > 0 ? fmtI(nl.materialMarkup + nl.materialFee) : '—'}</td>
              </tr>
              {/* Equipment */}
              <tr>
                <td style={tdL}>Equipment</td>
                <td style={tdR}>
                  <input
                    type="number" min="0" step="100"
                    style={{ width: 110, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', fontSize: 12, textAlign: 'right', color: '#1a1a2e' }}
                    value={config.equipment_cost || ''}
                    placeholder="0"
                    onChange={e => patchConfig({ equipment_cost: parseNum(e.target.value) })}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                  />
                </td>
                <td style={{ ...tdR, color: '#8888a0' }}>{fmtPct(Number(config.equipment_markup_pct) || 0)}</td>
                <td style={{ ...tdR, background: '#f5f7ff', color: '#1e40af' }}>{nl.equipmentActual > 0 ? fmtI(nl.equipmentMarkup) : '—'}</td>
                <td style={{ ...tdR, color: '#8888a0' }}>{fmtPct(feePct)}</td>
                <td style={{ ...tdR, background: '#f0fdf4', color: '#059669' }}>{nl.equipmentActual > 0 ? fmtI(nl.equipmentFee) : '—'}</td>
                <td style={{ ...tdR, background: '#f0fdf4', color: '#059669', fontWeight: 700 }}>{nl.equipmentActual > 0 ? fmtI(nl.equipmentMarkup + nl.equipmentFee) : '—'}</td>
              </tr>
              {/* Subcontracts */}
              <tr>
                <td style={tdL}>Subcontracts</td>
                <td style={tdR}>
                  <input
                    type="number" min="0" step="100"
                    style={{ width: 110, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', fontSize: 12, textAlign: 'right', color: '#1a1a2e' }}
                    value={config.subcontract_cost || ''}
                    placeholder="0"
                    onChange={e => patchConfig({ subcontract_cost: parseNum(e.target.value) })}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                  />
                </td>
                <td style={{ ...tdR, color: '#8888a0' }}>{fmtPct(Number(config.sub_markup_pct) || 0)}</td>
                <td style={{ ...tdR, background: '#f5f7ff', color: '#1e40af' }}>{nl.subActual > 0 ? fmtI(nl.subMarkup) : '—'}</td>
                <td style={{ ...tdR, color: '#8888a0' }}>{fmtPct(feePct)}</td>
                <td style={{ ...tdR, background: '#f0fdf4', color: '#059669' }}>{nl.subActual > 0 ? fmtI(nl.subFee) : '—'}</td>
                <td style={{ ...tdR, background: '#f0fdf4', color: '#059669', fontWeight: 700 }}>{nl.subActual > 0 ? fmtI(nl.subMarkup + nl.subFee) : '—'}</td>
              </tr>
              {/* General Conditions */}
              <tr>
                <td style={tdL}>General Conditions</td>
                <td style={tdR}>
                  <input
                    type="number" min="0" step="100"
                    style={{ width: 110, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', fontSize: 12, textAlign: 'right', color: '#1a1a2e' }}
                    value={config.gen_conditions_cost || ''}
                    placeholder="0"
                    onChange={e => patchConfig({ gen_conditions_cost: parseNum(e.target.value) })}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                  />
                </td>
                <td style={{ ...tdR, color: '#c0c0d0' }}>—</td>
                <td style={{ ...tdR, background: '#f5f7ff', color: '#c0c0d0' }}>—</td>
                <td style={{ ...tdR, color: '#8888a0' }}>{fmtPct(feePct)}</td>
                <td style={{ ...tdR, background: '#f0fdf4', color: '#059669' }}>{nl.gcActual > 0 ? fmtI(nl.gcFee) : '—'}</td>
                <td style={{ ...tdR, background: '#f0fdf4', color: '#059669', fontWeight: 700 }}>{nl.gcActual > 0 ? fmtI(nl.gcFee) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
