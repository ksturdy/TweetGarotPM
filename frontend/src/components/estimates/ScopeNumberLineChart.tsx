import React from 'react';
import { GeneratedBudget, SimilarProject } from '../../services/budgetGenerator';

const SCOPE_CHART_CONFIG: Record<string, { color: string; label: string; getComparableSF: (p: SimilarProject) => number; sectionMatch: (n: string) => boolean }> = {
  HVAC: {
    color: '#10b981',
    label: 'HVAC (Sheet Metal + Piping)',
    getComparableSF: (p) => (p.sheetMetalCostPerSqft || 0) + (p.pipingCostPerSqft || 0),
    sectionMatch: (n) => n.includes('sheet metal') || ((n.includes('piping') || n.includes('hot water') || n.includes('chilled water')) && !n.includes('plumb')),
  },
  Plumbing: {
    color: '#3b82f6',
    label: 'Plumbing',
    getComparableSF: (p) => p.plumbingCostPerSqft || 0,
    sectionMatch: (n) => n.includes('plumb'),
  },
  BAS: {
    color: '#8b5cf6',
    label: 'BAS / Controls',
    getComparableSF: (p) => p.basCostPerSqft || 0,
    sectionMatch: (n) => n === 'controls' || n === 'bas' || n.startsWith('bas ') || n.includes('control'),
  },
};

const SCOPE_TO_WORK: Record<string, string[]> = {
  HVAC: ['Sheet Metal', 'Piping'],
  Plumbing: ['Plumbing'],
  BAS: ['BAS'],
};

const CHART_SCOPES: Record<string, string[]> = {
  HVAC: ['Sheet Metal', 'Piping'],
  Plumbing: ['Plumbing'],
  BAS: ['BAS'],
};

interface Props {
  budget: GeneratedBudget;
  comparableProjects: SimilarProject[];
  scopeKey: string;
  scopesOfWork?: string[];
}

const ScopeNumberLineChart: React.FC<Props> = ({ budget, comparableProjects, scopeKey, scopesOfWork }) => {
  const config = SCOPE_CHART_CONFIG[scopeKey];
  if (!config) return null;

  // If scopesOfWork is set and doesn't include this scope's trades, skip
  if (scopesOfWork && scopesOfWork.length > 0) {
    const tradeNames = SCOPE_TO_WORK[scopeKey] ?? [];
    if (!tradeNames.some(t => scopesOfWork.includes(t))) return null;
  }

  const sqft = budget.summary.squareFootage || 1;
  const scopeCost = budget.sections
    .filter(s => config.sectionMatch(s.name.toLowerCase()))
    .reduce((sum, s) => sum + s.subtotal, 0);
  const totalSectionCost = budget.sections.reduce((sum, s) => sum + s.subtotal, 0);
  const grandTotal = budget.totals.grandTotal || budget.summary.estimatedTotalCost || 0;
  const budgetSF = scopeCost && totalSectionCost ? (scopeCost / totalSectionCost) * (grandTotal / sqft) : 0;

  interface Pt { name: string; value: number; isBudget: boolean; isFallback: boolean; }
  const pts: Pt[] = [];
  if (budgetSF > 0.01) {
    pts.push({ name: budget.summary.projectName || 'This Budget', value: budgetSF, isBudget: true, isFallback: false });
  }

  const chartTrades = CHART_SCOPES[scopeKey] ?? [];
  comparableProjects.forEach(p => {
    const scopeVal = config.getComparableSF(p);
    if (scopeVal > 0.01) {
      pts.push({ name: p.name, value: scopeVal, isBudget: false, isFallback: false });
    } else {
      const projectScopes: string[] = Array.isArray(p.scopes) ? p.scopes : [];
      const singleScopeMatch = projectScopes.length > 0 && projectScopes.every(s => chartTrades.includes(s));
      if (singleScopeMatch && (p.costPerSqft || 0) > 0.01) {
        pts.push({ name: p.name, value: p.costPerSqft!, isBudget: false, isFallback: true });
      }
    }
  });

  if (pts.length === 0) return null;

  const vals = pts.map(p => p.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const isSingle = pts.length === 1;
  const minVal = isSingle ? 0 : Math.max(0, rawMin - (rawMax - rawMin) * 0.22);
  const maxVal = isSingle ? Math.ceil(rawMax * 1.8 / 10) * 10 : rawMax + (rawMax - rawMin) * 0.22;
  const range = Math.max(maxVal - minVal, 0.01);

  const W = 800; const H = 80;
  const PADX = 50; const CW = W - 2 * PADX;
  const AXIS_Y = 52;
  const TICK_TOP = 46; const TICK_BOT = 58;

  const toX = (v: number) => PADX + ((v - minVal) / range) * CW;
  const sorted = [...pts].map(p => ({ ...p, x: toX(p.value) })).sort((a, b) => a.x - b.x);

  const MIN_GAP = 100;
  const rowTail = [-Infinity, -Infinity, -Infinity];
  const rowOf = sorted.map(p => {
    if (rowTail[0] + MIN_GAP <= p.x) { rowTail[0] = p.x; return 0; }
    if (rowTail[1] + MIN_GAP <= p.x) { rowTail[1] = p.x; return 1; }
    rowTail[2] = p.x; return 2;
  });
  const LABEL_Y = [38, 25, 12];

  const step = (() => {
    const raw = range / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw / mag) * mag;
  })();
  const ticks: number[] = [];
  for (let t = Math.ceil(minVal / step) * step; t <= maxVal; t += step) {
    if (t > minVal + 0.1 && t < maxVal - 0.1) ticks.push(t);
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${config.color}22`,
      borderLeft: `3px solid ${config.color}`,
      borderRadius: '6px',
      padding: '0.375rem 1.25rem 0.25rem',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: config.color }} />
        <span style={{ fontSize: '8pt', fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          {config.label}
        </span>
        {pts.some(p => p.isFallback) && (
          <span style={{ fontSize: '7pt', color: '#9ca3af', marginLeft: 'auto' }}>&#9702; total $/SF (no scope breakdown)</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible', display: 'block' }}>
        <line x1={PADX} y1={AXIS_Y} x2={W - PADX} y2={AXIS_Y} stroke="#e2e8f0" strokeWidth={2} />
        <line x1={PADX} y1={AXIS_Y} x2={W - PADX} y2={AXIS_Y} stroke={config.color} strokeWidth={2} opacity={0.35} />
        <line x1={PADX} y1={AXIS_Y - 4} x2={PADX} y2={AXIS_Y + 4} stroke="#cbd5e1" strokeWidth={1.5} />
        <line x1={W - PADX} y1={AXIS_Y - 4} x2={W - PADX} y2={AXIS_Y + 4} stroke="#cbd5e1" strokeWidth={1.5} />
        {ticks.map(t => (
          <g key={t}>
            <line x1={toX(t)} y1={AXIS_Y - 3} x2={toX(t)} y2={AXIS_Y + 3} stroke="#cbd5e1" strokeWidth={1} />
            <text x={toX(t)} y={AXIS_Y + 13} textAnchor="middle" fontSize={7} fill="#94a3b8">${t.toFixed(0)}</text>
          </g>
        ))}
        <text x={PADX} y={AXIS_Y + 13} textAnchor="middle" fontSize={7} fill="#94a3b8">${minVal.toFixed(0)}</text>
        <text x={W - PADX} y={AXIS_Y + 13} textAnchor="middle" fontSize={7} fill="#94a3b8">${maxVal.toFixed(0)}</text>
        {sorted.map((pt, i) => {
          const lY = LABEL_Y[rowOf[i]];
          return (
            <g key={i}>
              <line x1={pt.x} y1={lY + 4} x2={pt.x} y2={TICK_TOP - 1}
                stroke={pt.isBudget ? config.color : '#d1d5db'}
                strokeWidth={pt.isBudget ? 1.5 : 1}
                strokeDasharray={pt.isBudget ? undefined : '3,3'} />
              <line x1={pt.x} y1={TICK_TOP} x2={pt.x} y2={TICK_BOT}
                stroke={pt.isBudget ? config.color : (pt.isFallback ? '#cbd5e1' : '#94a3b8')}
                strokeWidth={pt.isBudget ? 2.5 : 1.5} />
              {pt.isBudget ? (
                <>
                  <circle cx={pt.x} cy={AXIS_Y} r={9} fill={config.color} opacity={0.1} />
                  <circle cx={pt.x} cy={AXIS_Y} r={5} fill={config.color} />
                  <circle cx={pt.x} cy={AXIS_Y} r={3.5} fill="none" stroke="white" strokeWidth={1.2} opacity={0.5} />
                </>
              ) : (
                <circle cx={pt.x} cy={AXIS_Y} r={4} fill="white"
                  stroke={pt.isFallback ? '#cbd5e1' : '#94a3b8'}
                  strokeWidth={pt.isFallback ? 1.5 : 2}
                  strokeDasharray={pt.isFallback ? '2,2' : undefined} />
              )}
              <text x={pt.x} y={lY} textAnchor="middle"
                fontSize={pt.isBudget ? 10 : 9} fontWeight={pt.isBudget ? '700' : '500'}
                fill={pt.isBudget ? config.color : (pt.isFallback ? '#9ca3af' : '#374151')}>
                {pt.isBudget ? `▸ ${pt.name}` : pt.name}
              </text>
              <text x={pt.x} y={TICK_BOT + 13} textAnchor="middle"
                fontSize={pt.isBudget ? 9.5 : 8.5} fontWeight={pt.isBudget ? '700' : '400'}
                fill={pt.isBudget ? config.color : (pt.isFallback ? '#9ca3af' : '#6b7280')}>
                ${pt.value.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default ScopeNumberLineChart;
