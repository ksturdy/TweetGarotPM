import React, { useState } from 'react';
import {
  CostControlMatrix as CCMatrix,
  CostControlVersion,
  CostType,
  COST_TYPE_LABELS,
  calcVersionTotals,
  calcRiskTotals,
} from '../../services/costControl';
import { exportCCMComparePdf } from '../../utils/costControlPdf';

interface Props {
  matrix: CCMatrix;
  onClose: () => void;
}

const VER_COLORS = [
  { header: '#dbeafe', cell: '#f0f7ff', border: '#bfdbfe', text: '#1e40af' },
  { header: '#ede9fe', cell: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
  { header: '#d1fae5', cell: '#f0fdf4', border: '#a7f3d0', text: '#065f46' },
  { header: '#fef3c7', cell: '#fffbeb', border: '#fde68a', text: '#92400e' },
  { header: '#fce7f3', cell: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
];

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.round(n).toLocaleString();

const fmtChg = (n: number) => (n >= 0 ? '+' : '') + fmt(n);
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

export default function CostControlCompare({ matrix, onClose }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(matrix.versions.map(v => v.id))
  );

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selVersions: CostControlVersion[] = matrix.versions.filter(v => selected.has(v.id));
  const hasMultiple = selVersions.length >= 2;

  function getVal(itemValues: Record<number, any>, vId: number): number {
    return Number(itemValues[vId]?.value ?? 0);
  }

  function netChange(vals: number[]): number | null {
    if (vals.length < 2) return null;
    return vals[vals.length - 1] - vals[0];
  }

  function netChangePct(vals: number[]): number | null {
    if (vals.length < 2 || vals[0] === 0) return null;
    const nc = netChange(vals);
    return nc != null ? (nc / vals[0]) * 100 : null;
  }

  const sums = selVersions.map(v => calcVersionTotals(matrix, v.id));

  const SUMMARY_ROWS: { label: string; key: keyof ReturnType<typeof calcVersionTotals> }[] = [
    { label: 'Subtotal', key: 'subtotal' },
    { label: `Fee (${Math.round(Number(matrix.fee_pct) * 100)}%)`, key: 'fee' },
    { label: `Overhead (${Math.round(Number(matrix.overhead_pct) * 100)}%)`, key: 'overhead' },
    { label: 'Grand Total', key: 'grand_total' },
  ];

  const ncTextStyle = (nc: number | null) => {
    if (nc == null) return {};
    return { color: nc > 0 ? '#dc2626' : nc < 0 ? '#16a34a' : undefined, fontWeight: 600 };
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 1100,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 24px 14px', borderBottom: '1px solid #e0e2e7',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Compare Versions</h2>
            <div style={{ fontSize: 12, color: '#8888a0', marginTop: 2 }}>{matrix.name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              disabled={selVersions.length === 0}
              onClick={() => exportCCMComparePdf(matrix, selVersions)}
            >
              Export PDF
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Version selector */}
        <div style={{
          padding: '12px 24px', borderBottom: '1px solid #f0f1f3',
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#8888a0', marginRight: 4 }}>Show:</span>
          {matrix.versions.map((v, vi) => {
            const col = VER_COLORS[vi % VER_COLORS.length];
            const isOn = selected.has(v.id);
            return (
              <label
                key={v.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  border: `1px solid ${isOn ? col.border : '#e0e2e7'}`,
                  borderRadius: 20, padding: '4px 12px',
                  background: isOn ? col.header : '#f8f9fa',
                  color: isOn ? col.text : '#5a5a72',
                  fontSize: 12, fontWeight: 600, userSelect: 'none',
                  transition: 'all 0.12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(v.id)}
                  style={{ accentColor: col.text, width: 12, height: 12 }}
                />
                {v.version_name}
                {v.version_date && (
                  <span style={{ opacity: 0.65, fontWeight: 400, fontSize: 11 }}>
                    {new Date(v.version_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </label>
            );
          })}
          {selVersions.length === 0 && (
            <span style={{ fontSize: 12, color: '#ef4444' }}>Select at least one version</span>
          )}
        </div>

        {/* Comparison table */}
        {selVersions.length > 0 && (
          <div style={{ padding: '0 24px 24px', overflowX: 'auto' }}>

            {/* Section / item table */}
            {matrix.areas.filter(a => a.items.length > 0).map(area => (
              <div key={area.id} style={{ marginTop: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0' }}>
                      <th colSpan={2 + selVersions.length + (hasMultiple ? 2 : 0)}
                        style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                        {area.name}
                      </th>
                    </tr>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: '5px 10px', fontWeight: 600, fontSize: 11, color: '#5a5a72', minWidth: 200, whiteSpace: 'nowrap' }}>Description</th>
                      <th style={{ textAlign: 'left', padding: '5px 10px', fontWeight: 600, fontSize: 11, color: '#5a5a72', minWidth: 110 }}>Type</th>
                      {selVersions.map((v, vi) => {
                        const col = VER_COLORS[vi % VER_COLORS.length];
                        return (
                          <th key={v.id} style={{
                            textAlign: 'right', padding: '5px 10px', fontWeight: 700, fontSize: 11,
                            background: col.header, color: col.text, minWidth: 110, whiteSpace: 'nowrap',
                            borderLeft: `2px solid ${col.border}`,
                          }}>
                            {v.version_name}
                          </th>
                        );
                      })}
                      {hasMultiple && <>
                        <th style={{ textAlign: 'right', padding: '5px 10px', fontWeight: 600, fontSize: 11, color: '#5a5a72', minWidth: 100, background: '#e2e8f0' }}>Net Change $</th>
                        <th style={{ textAlign: 'right', padding: '5px 10px', fontWeight: 600, fontSize: 11, color: '#5a5a72', minWidth: 80, background: '#e2e8f0' }}>Net Change %</th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {area.items.map((item, idx) => {
                      const vals = selVersions.map(v => getVal(item.values, v.id));
                      const nc = netChange(vals);
                      const ncp = netChangePct(vals);
                      const costType = item.cost_type as CostType;
                      return (
                        <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa', borderBottom: '1px solid #f0f1f3' }}>
                          <td style={{ padding: '5px 10px', color: '#1a1a2e', fontSize: 13 }}>
                            {item.description || <span style={{ color: '#c0c0d0', fontStyle: 'italic' }}>—</span>}
                          </td>
                          <td style={{ padding: '5px 10px' }}>
                            <span style={{
                              display: 'inline-block', borderRadius: 20, padding: '1px 9px',
                              fontSize: 11, fontWeight: 600,
                              ...(costType === 'labor_field' ? { background: '#dbeafe', color: '#1d4ed8' }
                                : costType === 'labor_shop' ? { background: '#cffafe', color: '#0e7490' }
                                : costType === 'material' ? { background: '#d1fae5', color: '#065f46' }
                                : costType === 'equipment' ? { background: '#fef3c7', color: '#92400e' }
                                : costType === 'subcontract' ? { background: '#ede9fe', color: '#5b21b6' }
                                : { background: '#f3f4f6', color: '#374151' }),
                            }}>
                              {COST_TYPE_LABELS[costType]}
                            </span>
                          </td>
                          {selVersions.map((v, vi) => {
                            const col = VER_COLORS[vi % VER_COLORS.length];
                            return (
                              <td key={v.id} style={{
                                textAlign: 'right', padding: '5px 10px',
                                background: col.cell, borderLeft: `2px solid ${col.border}`,
                                fontVariantNumeric: 'tabular-nums', fontSize: 13,
                              }}>
                                {getVal(item.values, v.id) ? fmt(getVal(item.values, v.id)) : '—'}
                              </td>
                            );
                          })}
                          {hasMultiple && <>
                            <td style={{ textAlign: 'right', padding: '5px 10px', fontVariantNumeric: 'tabular-nums', ...ncTextStyle(nc) }}>
                              {nc != null ? fmtChg(nc) : '—'}
                            </td>
                            <td style={{ textAlign: 'right', padding: '5px 10px', fontVariantNumeric: 'tabular-nums', ...ncTextStyle(nc) }}>
                              {ncp != null ? fmtPct(ncp) : '—'}
                            </td>
                          </>}
                        </tr>
                      );
                    })}
                    {/* Section subtotal */}
                    {(() => {
                      const areaTotals = selVersions.map(v =>
                        area.items.reduce((s, i) => s + getVal(i.values, v.id), 0)
                      );
                      const nc = netChange(areaTotals);
                      const ncp = netChangePct(areaTotals);
                      return (
                        <tr style={{ background: '#f1f5f9', borderTop: '2px solid #e0e2e7', fontWeight: 700 }}>
                          <td colSpan={2} style={{ padding: '6px 10px', fontSize: 13, color: '#1a1a2e' }}>Section Total</td>
                          {selVersions.map((v, vi) => {
                            const col = VER_COLORS[vi % VER_COLORS.length];
                            return (
                              <td key={v.id} style={{
                                textAlign: 'right', padding: '6px 10px',
                                background: col.cell, borderLeft: `2px solid ${col.border}`,
                                fontVariantNumeric: 'tabular-nums', fontSize: 13,
                              }}>
                                {areaTotals[vi] ? fmt(areaTotals[vi]) : '—'}
                              </td>
                            );
                          })}
                          {hasMultiple && <>
                            <td style={{ textAlign: 'right', padding: '6px 10px', fontVariantNumeric: 'tabular-nums', ...ncTextStyle(nc) }}>
                              {nc != null ? fmtChg(nc) : '—'}
                            </td>
                            <td style={{ textAlign: 'right', padding: '6px 10px', fontVariantNumeric: 'tabular-nums', ...ncTextStyle(nc) }}>
                              {ncp != null ? fmtPct(ncp) : '—'}
                            </td>
                          </>}
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Summary totals */}
            <div style={{ marginTop: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1e2937' }}>
                    <th colSpan={2 + selVersions.length + (hasMultiple ? 2 : 0)}
                      style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, fontSize: 12, color: '#fff' }}>
                      Summary
                    </th>
                  </tr>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th colSpan={2} style={{ textAlign: 'left', padding: '5px 10px', fontWeight: 600, fontSize: 11, color: '#5a5a72' }}>Category</th>
                    {selVersions.map((v, vi) => {
                      const col = VER_COLORS[vi % VER_COLORS.length];
                      return (
                        <th key={v.id} style={{
                          textAlign: 'right', padding: '5px 10px', fontWeight: 700, fontSize: 11,
                          background: col.header, color: col.text, minWidth: 110, whiteSpace: 'nowrap',
                          borderLeft: `2px solid ${col.border}`,
                        }}>
                          {v.version_name}
                        </th>
                      );
                    })}
                    {hasMultiple && <>
                      <th style={{ textAlign: 'right', padding: '5px 10px', fontWeight: 600, fontSize: 11, color: '#5a5a72', background: '#e2e8f0' }}>Net Change $</th>
                      <th style={{ textAlign: 'right', padding: '5px 10px', fontWeight: 600, fontSize: 11, color: '#5a5a72', background: '#e2e8f0' }}>Net Change %</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {SUMMARY_ROWS.map((row, idx) => {
                    const vals = sums.map(s => Number(s[row.key] ?? 0));
                    const nc = netChange(vals);
                    const ncp = netChangePct(vals);
                    const isGrand = row.key === 'grand_total';
                    const rowStyle: React.CSSProperties = isGrand
                      ? { background: '#0f172a', fontWeight: 700 }
                      : idx % 2 === 0 ? { background: '#fff' } : { background: '#f8f9fa' };
                    const textColor: React.CSSProperties = isGrand ? { color: '#fff' } : { color: '#1a1a2e' };
                    return (
                      <tr key={row.key} style={{ ...rowStyle, borderTop: isGrand ? '2px solid #0f172a' : '1px solid #f0f1f3' }}>
                        <td colSpan={2} style={{ padding: isGrand ? '9px 10px' : '6px 10px', fontSize: isGrand ? 14 : 13, fontWeight: isGrand ? 700 : 400, ...textColor }}>{row.label}</td>
                        {selVersions.map((v, vi) => {
                          const col = VER_COLORS[vi % VER_COLORS.length];
                          const val = Number(sums[vi]?.[row.key] ?? 0);
                          return (
                            <td key={v.id} style={{
                              textAlign: 'right', padding: isGrand ? '9px 10px' : '6px 10px',
                              background: isGrand ? undefined : col.cell,
                              borderLeft: `2px solid ${isGrand ? '#334155' : col.border}`,
                              fontVariantNumeric: 'tabular-nums', fontSize: isGrand ? 14 : 13,
                              ...textColor,
                            }}>
                              {fmt(val)}
                            </td>
                          );
                        })}
                        {hasMultiple && <>
                          <td style={{
                            textAlign: 'right', padding: isGrand ? '9px 10px' : '6px 10px',
                            fontVariantNumeric: 'tabular-nums',
                            ...(isGrand
                              ? (nc != null && nc > 0 ? { color: '#fca5a5' } : nc != null && nc < 0 ? { color: '#6ee7b7' } : { color: '#94a3b8' })
                              : ncTextStyle(nc)),
                          }}>
                            {nc != null ? fmtChg(nc) : '—'}
                          </td>
                          <td style={{
                            textAlign: 'right', padding: isGrand ? '9px 10px' : '6px 10px',
                            fontVariantNumeric: 'tabular-nums',
                            ...(isGrand
                              ? (nc != null && nc > 0 ? { color: '#fca5a5' } : nc != null && nc < 0 ? { color: '#6ee7b7' } : { color: '#94a3b8' })
                              : ncTextStyle(nc)),
                          }}>
                            {ncp != null ? fmtPct(ncp) : '—'}
                          </td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Risk & Opportunities */}
            {matrix.risks.length > 0 && (() => {
              const { riskEV, oppEV } = calcRiskTotals(matrix.risks);
              const risks = matrix.risks.filter(r => r.type === 'risk');
              const opps  = matrix.risks.filter(r => r.type === 'opportunity');
              const versionName = (vId: number | null) =>
                vId ? (matrix.versions.find(v => v.id === vId)?.version_name ?? '—') : '—';
              const fmtEV = (r: typeof matrix.risks[0]) =>
                r.probability != null && r.impact != null
                  ? fmt((r.probability / 100) * Number(r.impact))
                  : '—';
              const STATUS_LABELS: Record<string, string> = { open: 'Open', realized: 'Realized', mitigated: 'Mitigated', closed: 'Closed' };

              const RiskTable = ({ items, color }: { items: typeof matrix.risks; color: string }) => (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      {['Description', 'Identified In', 'Probability', 'Impact', 'Expected Value', 'Status', 'Notes'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Description' || h === 'Notes' || h === 'Identified In' || h === 'Status' ? 'left' : 'right', padding: '4px 8px', fontSize: 11, fontWeight: 600, color: '#5a5a72', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, idx) => (
                      <tr key={r.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa', borderBottom: '1px solid #f0f1f3' }}>
                        <td style={{ padding: '4px 8px', minWidth: 180 }}>{r.description || <span style={{ color: '#c0c0d0', fontStyle: 'italic' }}>—</span>}</td>
                        <td style={{ padding: '4px 8px', color: '#5a5a72', fontSize: 11 }}>{versionName(r.version_id)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>{r.probability != null ? `${r.probability}%` : '—'}</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', fontVariantNumeric: 'tabular-nums' }}>{r.impact != null ? fmt(Number(r.impact)) : '—'}</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{fmtEV(r)}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <span style={{ display: 'inline-block', borderRadius: 10, padding: '1px 8px', fontSize: 10, fontWeight: 600, background: r.status === 'open' ? '#fee2e2' : '#f1f5f9', color: r.status === 'open' ? '#b91c1c' : '#475569' }}>
                            {STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td style={{ padding: '4px 8px', color: '#5a5a72', fontSize: 11, maxWidth: 160 }}>{r.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );

              return (
                <div style={{ marginTop: 24 }}>
                  <div style={{ background: '#1e2937', color: '#fff', padding: '7px 10px', fontWeight: 700, fontSize: 12, borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Risks &amp; Opportunities</span>
                    <span style={{ fontSize: 11, fontWeight: 400, display: 'flex', gap: 16 }}>
                      {riskEV > 0 && <span>Risk exposure: <strong style={{ color: '#fca5a5' }}>{fmt(riskEV)}</strong></span>}
                      {oppEV  > 0 && <span>Opportunity upside: <strong style={{ color: '#6ee7b7' }}>{fmt(oppEV)}</strong></span>}
                      {(riskEV > 0 || oppEV > 0) && <span>Net: <strong style={{ color: riskEV - oppEV > 0 ? '#fca5a5' : '#6ee7b7' }}>{riskEV - oppEV >= 0 ? '+' : ''}{fmt(riskEV - oppEV)}</strong></span>}
                    </span>
                  </div>
                  {risks.length > 0 && (
                    <div style={{ padding: '10px 0 4px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} /> Risks
                      </div>
                      <RiskTable items={risks} color="#dc2626" />
                    </div>
                  )}
                  {opps.length > 0 && (
                    <div style={{ padding: '10px 0 4px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> Opportunities
                      </div>
                      <RiskTable items={opps} color="#16a34a" />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {selVersions.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#8888a0', fontSize: 14 }}>
            Select one or more versions above to compare.
          </div>
        )}
      </div>
    </div>
  );
}
