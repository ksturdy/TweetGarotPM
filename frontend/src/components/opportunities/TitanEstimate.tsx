import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { OpportunityEstimateData } from '../../services/opportunities';

interface TitanEstimateProps {
  opportunityId: number;
  estimatedValue: number;
}

const DEFAULT_ESTIMATE: OpportunityEstimateData = {
  labor_pct: 0.35,
  material_pct: 0.25,
  subcontracts_pct: 0.20,
  rentals_pct: 0.05,
  mep_equip_pct: 0.05,
  general_conditions_pct: 0.10,
  pf_labor_pct: 0.45,
  sm_labor_pct: 0.35,
  pl_labor_pct: 0.20,
  pf_shop_pct: 0.30,
  pf_field_pct: 0.70,
  sm_shop_pct: 0.35,
  sm_field_pct: 0.65,
  pl_shop_pct: 0.25,
  pl_field_pct: 0.75,
  pf_labor_rate: 85.00,
  sm_labor_rate: 82.00,
  pl_labor_rate: 78.00,
};

type Trade = 'pf' | 'sm' | 'pl';
const TRADES: { key: Trade; label: string }[] = [
  { key: 'pf', label: 'Pipefitting' },
  { key: 'sm', label: 'Sheet Metal' },
  { key: 'pl', label: 'Plumbing' },
];

function fmtCur(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtHrs(v: number): string { return v.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function p2d(pct: number): string { return (pct * 100).toFixed(1); }
function d2p(s: string): number { const v = parseFloat(s); return isNaN(v) ? 0 : Math.max(0, Math.min(100, v)) / 100; }

const PercentInput: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!focused.current && inputRef.current) {
      inputRef.current.value = p2d(value);
    }
  }, [value]);

  return (
    <span className="te-pi">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        defaultValue={p2d(value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
            onChangeRef.current(d2p(raw));
          }
        }}
        onFocus={(e) => { focused.current = true; e.target.select(); }}
        onBlur={() => {
          focused.current = false;
          if (inputRef.current) inputRef.current.value = p2d(value);
        }}
      />
      <span className="te-pct-sym">%</span>
    </span>
  );
};

const RateInput: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!focused.current && inputRef.current) {
      inputRef.current.value = String(value || '');
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      defaultValue={value || ''}
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
          onChangeRef.current(parseFloat(raw) || 0);
        }
      }}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => {
        focused.current = false;
        if (inputRef.current) inputRef.current.value = String(value || '');
      }}
    />
  );
};

const TitanEstimate: React.FC<TitanEstimateProps> = ({ opportunityId, estimatedValue }) => {
  const queryClient = useQueryClient();
  const [pct, setPct] = useState<OpportunityEstimateData>(DEFAULT_ESTIMATE);
  const [initialized, setInitialized] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: savedEstimate } = useQuery({
    queryKey: ['opportunity-estimate', opportunityId],
    queryFn: () => opportunitiesService.getEstimate(opportunityId),
    enabled: !!opportunityId,
  });

  // Track which trades are active for conditional default fetching
  const activeTrades = useMemo(() =>
    TRADES.filter(t => (pct[`${t.key}_labor_pct` as keyof OpportunityEstimateData] as number) > 0).map(t => t.key),
    [pct]
  );

  const { data: defaults } = useQuery({
    queryKey: ['estimate-defaults', activeTrades.sort().join(',')],
    queryFn: () => opportunitiesService.getEstimateDefaults(activeTrades),
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (data: OpportunityEstimateData) => opportunitiesService.saveEstimate(opportunityId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['opportunity-estimate', opportunityId] }); },
  });

  useEffect(() => {
    if (initialized) return;
    if (savedEstimate) {
      const data = {} as any;
      for (const key of Object.keys(DEFAULT_ESTIMATE)) data[key] = parseFloat(String((savedEstimate as any)[key])) || 0;
      setPct(data);
      setInitialized(true);
    } else if (defaults) {
      setPct(defaults);
      setInitialized(true);
    }
  }, [savedEstimate, defaults, initialized]);

  const debouncedSave = useCallback((data: OpportunityEstimateData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveMutation.mutate(data); }, 800);
  }, [saveMutation]);

  useEffect(() => { return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }; }, []);

  const updateField = useCallback((field: keyof OpportunityEstimateData, value: number) => {
    setPct(prev => {
      const next = { ...prev, [field]: value };
      if (field.endsWith('_shop_pct')) {
        const trade = field.replace('_shop_pct', '');
        (next as any)[`${trade}_field_pct`] = Math.max(0, 1 - value);
      }
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  // Toggle a trade on/off — fetch new defaults for the new trade mix
  // and apply them to ALL cost categories (not just trade splits)
  const toggleTrade = useCallback(async (trade: Trade) => {
    const field = `${trade}_labor_pct` as keyof OpportunityEstimateData;
    const isDisabling = (pct[field] as number) > 0;

    // Determine new active trades
    const newTrades = TRADES
      .filter(t => {
        if (t.key === trade) return !isDisabling;
        return (pct[`${t.key}_labor_pct` as keyof OpportunityEstimateData] as number) > 0;
      })
      .map(t => t.key);

    // Fetch conditional defaults from backend for this trade mix
    try {
      const newDefaults = await opportunitiesService.getEstimateDefaults(newTrades);
      // Apply ALL defaults — cost categories, trade splits, and rates
      setPct(newDefaults);
      debouncedSave(newDefaults);
    } catch {
      // Fallback: just zero/redistribute trade percentages locally
      setPct(prev => {
        const next = { ...prev };
        if (isDisabling) {
          (next as any)[field] = 0;
          const others = TRADES.filter(t => t.key !== trade && (prev[`${t.key}_labor_pct` as keyof OpportunityEstimateData] as number) > 0);
          if (others.length > 0) {
            const othersSum = others.reduce((s, t) => s + (prev[`${t.key}_labor_pct` as keyof OpportunityEstimateData] as number), 0);
            for (const t of others) {
              const k = `${t.key}_labor_pct` as keyof OpportunityEstimateData;
              (next as any)[k] = othersSum > 0 ? (prev[k] as number) / othersSum : 1 / others.length;
            }
          }
        } else {
          const fallback = 1 / newTrades.length;
          for (const t of TRADES) {
            (next as any)[`${t.key}_labor_pct`] = newTrades.includes(t.key) ? fallback : 0;
          }
        }
        debouncedSave(next);
        return next;
      });
    }
  }, [pct, debouncedSave]);

  const resetToDefaults = useCallback(async () => {
    try {
      // Fetch defaults for all 3 trades (full reset)
      const allDefaults = await opportunitiesService.getEstimateDefaults(['pf', 'sm', 'pl']);
      setPct(allDefaults);
      debouncedSave(allDefaults);
    } catch {
      const source = defaults || DEFAULT_ESTIMATE;
      setPct(source);
      debouncedSave(source);
    }
  }, [defaults, debouncedSave]);

  const calc = useMemo(() => {
    const ev = estimatedValue || 0;
    const p = pct;
    const laborAmt = ev * p.labor_pct;
    const materialAmt = ev * p.material_pct;
    const subAmt = ev * p.subcontracts_pct;
    const rentAmt = ev * p.rentals_pct;
    const mepAmt = ev * p.mep_equip_pct;
    const gcAmt = ev * p.general_conditions_pct;
    const costTotal = laborAmt + materialAmt + subAmt + rentAmt + mepAmt + gcAmt;

    const trades = TRADES.map(({ key }) => {
      const tPct = p[`${key}_labor_pct` as keyof OpportunityEstimateData] as number;
      const amt = laborAmt * tPct;
      const rate = (p[`${key}_labor_rate` as keyof OpportunityEstimateData] as number) || 0;
      const hrs = rate > 0 ? amt / rate : 0;
      const shopPct = p[`${key}_shop_pct` as keyof OpportunityEstimateData] as number;
      const fieldPct = p[`${key}_field_pct` as keyof OpportunityEstimateData] as number;
      return {
        key, amt, hrs, rate, tPct,
        shopHrs: rate > 0 ? amt * shopPct / rate : 0,
        fieldHrs: rate > 0 ? amt * fieldPct / rate : 0,
        enabled: tPct > 0,
      };
    });

    const costPctSum = p.labor_pct + p.material_pct + p.subcontracts_pct + p.rentals_pct + p.mep_equip_pct + p.general_conditions_pct;
    const tradePctSum = trades.reduce((s, t) => s + t.tPct, 0);
    const totalHrs = trades.reduce((s, t) => s + t.hrs, 0);

    return { laborAmt, materialAmt, subAmt, rentAmt, mepAmt, gcAmt, costTotal, trades, costPctSum, tradePctSum, totalHrs };
  }, [estimatedValue, pct]);

  if (!estimatedValue) {
    return (
      <div className="titan-estimate">
        <div className="te-hdr"><span className="te-title">TITAN ESTIMATE</span></div>
        <div className="te-empty">Enter an estimated value to see cost breakdown</div>
      </div>
    );
  }

  return (
    <div className="titan-estimate">
      <div className="te-hdr">
        <span className="te-title">TITAN ESTIMATE</span>
        <button className="te-reset-btn" onClick={resetToDefaults}>Reset</button>
      </div>

      {/* Cost Breakdown */}
      <table className="te-tbl">
        <thead><tr><th></th><th>%</th><th className="r">Amount</th></tr></thead>
        <tbody>
          <tr><td>Labor</td><td><PercentInput value={pct.labor_pct} onChange={(v) => updateField('labor_pct', v)} /></td><td className="r">{fmtCur(calc.laborAmt)}</td></tr>
          <tr><td>Material</td><td><PercentInput value={pct.material_pct} onChange={(v) => updateField('material_pct', v)} /></td><td className="r">{fmtCur(calc.materialAmt)}</td></tr>
          <tr><td>Subcontracts</td><td><PercentInput value={pct.subcontracts_pct} onChange={(v) => updateField('subcontracts_pct', v)} /></td><td className="r">{fmtCur(calc.subAmt)}</td></tr>
          <tr><td>Rentals</td><td><PercentInput value={pct.rentals_pct} onChange={(v) => updateField('rentals_pct', v)} /></td><td className="r">{fmtCur(calc.rentAmt)}</td></tr>
          <tr><td>MEP Equip</td><td><PercentInput value={pct.mep_equip_pct} onChange={(v) => updateField('mep_equip_pct', v)} /></td><td className="r">{fmtCur(calc.mepAmt)}</td></tr>
          <tr><td>Gen. Cond.</td><td><PercentInput value={pct.general_conditions_pct} onChange={(v) => updateField('general_conditions_pct', v)} /></td><td className="r">{fmtCur(calc.gcAmt)}</td></tr>
        </tbody>
        <tfoot>
          <tr className="te-tbl-total">
            <td>Total</td>
            <td><span className={Math.abs(calc.costPctSum - 1) > 0.001 ? 'te-warn' : ''}>{(calc.costPctSum * 100).toFixed(1)}%</span></td>
            <td className="r">{fmtCur(calc.costTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Labor by Trade */}
      <div className="te-sec-hdr">
        Labor by Trade
        {calc.laborAmt > 0 && Math.abs(calc.tradePctSum - 1) > 0.001 && (
          <span className="te-warn te-warn-inline"> ({(calc.tradePctSum * 100).toFixed(1)}%)</span>
        )}
      </div>

      <table className="te-tbl te-trade-tbl">
        <thead><tr><th></th><th>%</th><th className="r">Amount</th><th className="r">Hours</th><th>Shop%</th></tr></thead>
        <tbody>
          {calc.trades.map(t => {
            const trade = TRADES.find(tr => tr.key === t.key)!;
            return (
              <React.Fragment key={t.key}>
                <tr className={`te-trade-row ${!t.enabled ? 'te-disabled' : ''}`}>
                  <td className="te-tn">
                    <label className="te-trade-check">
                      <input type="checkbox" checked={t.enabled} onChange={() => toggleTrade(t.key)} />
                      {trade.label}
                    </label>
                  </td>
                  <td>{t.enabled && <PercentInput value={pct[`${t.key}_labor_pct` as keyof OpportunityEstimateData] as number} onChange={(v) => updateField(`${t.key}_labor_pct` as keyof OpportunityEstimateData, v)} />}</td>
                  <td className="r">{t.enabled ? fmtCur(t.amt) : '—'}</td>
                  <td className="r">{t.enabled ? fmtHrs(t.hrs) : '—'}</td>
                  <td>{t.enabled && <PercentInput value={pct[`${t.key}_shop_pct` as keyof OpportunityEstimateData] as number} onChange={(v) => updateField(`${t.key}_shop_pct` as keyof OpportunityEstimateData, v)} />}</td>
                </tr>
                {t.enabled && (
                  <tr className="te-sf-detail">
                    <td></td>
                    <td colSpan={4}>
                      <span className="te-sf-info">Shop {fmtHrs(t.shopHrs)} / Field {fmtHrs(t.fieldHrs)} hrs</span>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="te-tbl-total">
            <td>Total</td><td></td><td></td><td className="r"><strong>{fmtHrs(calc.totalHrs)}</strong></td><td></td>
          </tr>
        </tfoot>
      </table>

      {/* Labor Rates */}
      <div className="te-rates">
        <span className="te-sec-hdr">Rates $/hr</span>
        <div className="te-rates-row">
          {TRADES.map(t => (
            <label key={t.key}>{t.key.toUpperCase()} $
              <RateInput value={pct[`${t.key}_labor_rate` as keyof OpportunityEstimateData] as number} onChange={(v) => updateField(`${t.key}_labor_rate` as keyof OpportunityEstimateData, v)} />
            </label>
          ))}
        </div>
      </div>

      {saveMutation.isPending && <div className="te-saving">Saving...</div>}
    </div>
  );
};

export default TitanEstimate;
