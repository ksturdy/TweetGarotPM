import React, { useEffect, useState } from 'react';
import { budgetsApi, Budget } from '../../services/budgets';

interface Props {
  groupId: number;
  currentBudgetId: number;
  onClose: () => void;
}

interface SectionRow {
  name: string;
  aValue: number | null;
  bValue: number | null;
}

const fmt = (v: number | null) =>
  v === null ? '—' : '$' + Math.round(v).toLocaleString();

const delta = (a: number | null, b: number | null) => {
  if (a === null || b === null) return null;
  return b - a;
};

const pct = (a: number | null, b: number | null) => {
  if (a === null || b === null || a === 0) return null;
  return ((b! - a!) / a!) * 100;
};

const DeltaCell: React.FC<{ a: number | null; b: number | null; invert?: boolean }> = ({ a, b, invert }) => {
  const d = delta(a, b);
  const p = pct(a, b);
  if (d === null || p === null) return <td style={{ textAlign: 'right', color: '#94a3b8', padding: '7px 20px' }}>—</td>;
  const isPositive = d > 0;
  // For costs, an increase is bad (red); invert=true flips the color logic
  const isGood = invert ? isPositive : !isPositive;
  const color = Math.abs(d) < 1 ? '#64748b' : isGood ? '#16a34a' : '#dc2626';
  return (
    <td style={{ textAlign: 'right', color, fontWeight: 600, fontSize: '13px', padding: '7px 20px' }}>
      {d >= 0 ? '+' : ''}{fmt(d)}
      <span style={{ fontSize: '11px', marginLeft: '4px', opacity: 0.8 }}>
        ({p >= 0 ? '+' : ''}{p.toFixed(1)}%)
      </span>
    </td>
  );
};

const BudgetVersionCompare: React.FC<Props> = ({ groupId, currentBudgetId, onClose }) => {
  const [versions, setVersions] = useState<Budget[]>([]);
  const [vA, setVA] = useState<number>(0);
  const [vB, setVB] = useState<number>(0);
  const [budgetA, setBudgetA] = useState<Budget | null>(null);
  const [budgetB, setBudgetB] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    budgetsApi.getVersions(groupId).then(res => {
      const sorted = res.data.sort((a, b) => a.version_number - b.version_number);
      setVersions(sorted);
      // Default: compare the two most recent versions
      if (sorted.length >= 2) {
        setVA(sorted[sorted.length - 2].id);
        setVB(sorted[sorted.length - 1].id);
      } else if (sorted.length === 1) {
        setVA(sorted[0].id);
        setVB(sorted[0].id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    if (vA) budgetsApi.getById(vA).then(r => setBudgetA(r.data)).catch(() => setBudgetA(null));
  }, [vA]);

  useEffect(() => {
    if (vB) budgetsApi.getById(vB).then(r => setBudgetB(r.data)).catch(() => setBudgetB(null));
  }, [vB]);

  const buildSectionRows = (): SectionRow[] => {
    const aMap = new Map((budgetA?.sections || []).map(s => [s.name, s.subtotal]));
    const bMap = new Map((budgetB?.sections || []).map(s => [s.name, s.subtotal]));
    const names = Array.from(new Set([...aMap.keys(), ...bMap.keys()]));
    return names.map(name => ({
      name,
      aValue: aMap.has(name) ? Number(aMap.get(name)) : null,
      bValue: bMap.has(name) ? Number(bMap.get(name)) : null,
    }));
  };

  const labelA = versions.find(v => v.id === vA);
  const labelB = versions.find(v => v.id === vB);

  const thStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'right',
    borderBottom: '2px solid #002356',
    fontSize: '12px',
    fontWeight: 700,
    color: '#1e293b',
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '7px 12px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px',
    textAlign: 'right',
  };
  const tdNameStyle: React.CSSProperties = {
    ...tdStyle,
    textAlign: 'left',
    color: '#334155',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: '10px', width: '90%', maxWidth: '900px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          background: '#002356', color: '#fff', padding: '14px 20px',
          borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontWeight: 700, fontSize: '16px', flex: 1 }}>Compare Budget Versions</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Version pickers */}
        <div style={{ display: 'flex', gap: '16px', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Compare:</label>
          <select value={vA} onChange={e => setVA(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                V{v.version_number} — {new Date(v.created_at).toLocaleDateString()} (${Math.round(Number(v.grand_total)).toLocaleString()})
              </option>
            ))}
          </select>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>vs</span>
          <select value={vB} onChange={e => setVB(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                V{v.version_number} — {new Date(v.created_at).toLocaleDateString()} (${Math.round(Number(v.grand_total)).toLocaleString()})
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 0 16px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading versions…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ ...thStyle, textAlign: 'left', width: '35%' }}>Section</th>
                  <th style={thStyle}>V{labelA?.version_number} ({labelA ? new Date(labelA.created_at).toLocaleDateString() : ''})</th>
                  <th style={thStyle}>V{labelB?.version_number} ({labelB ? new Date(labelB.created_at).toLocaleDateString() : ''})</th>
                  <th style={{ ...thStyle, padding: '8px 20px' }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {/* Summary rows */}
                {[
                  { label: 'Grand Total', a: budgetA ? Number(budgetA.grand_total) : null, b: budgetB ? Number(budgetB.grand_total) : null },
                  { label: 'Cost per SF', a: budgetA ? Number(budgetA.cost_per_sqft) : null, b: budgetB ? Number(budgetB.cost_per_sqft) : null },
                  { label: 'Direct Cost Subtotal', a: budgetA ? Number(budgetA.direct_cost_subtotal) : null, b: budgetB ? Number(budgetB.direct_cost_subtotal) : null },
                ].map(row => (
                  <tr key={row.label} style={{ background: '#f0f4ff' }}>
                    <td style={{ ...tdNameStyle, fontWeight: 700, color: '#002356' }}>{row.label}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(row.a)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(row.b)}</td>
                    <DeltaCell a={row.a} b={row.b} />
                  </tr>
                ))}

                {/* Spacer */}
                <tr><td colSpan={4} style={{ padding: '4px 0', background: '#e2e8f0' }} /></tr>

                {/* Section rows */}
                {buildSectionRows().map(row => (
                  <tr key={row.name} style={{ ':hover': { background: '#f8fafc' } } as any}>
                    <td style={tdNameStyle}>{row.name}</td>
                    <td style={{ ...tdStyle, color: row.aValue === null ? '#94a3b8' : undefined }}>{fmt(row.aValue)}</td>
                    <td style={{ ...tdStyle, color: row.bValue === null ? '#94a3b8' : undefined }}>{fmt(row.bValue)}</td>
                    <DeltaCell a={row.aValue} b={row.bValue} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Confidence + methodology summary */}
        {budgetA && budgetB && (
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12px', color: '#475569' }}>
            <span><strong>V{labelA?.version_number} confidence:</strong> {budgetA.confidence_level}</span>
            <span><strong>V{labelB?.version_number} confidence:</strong> {budgetB.confidence_level}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetVersionCompare;
