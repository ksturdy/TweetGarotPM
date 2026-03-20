import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import type { PipeSpec, SystemFittingType } from '../../types/pipingSystem';
import { SYSTEM_FITTING_TYPE_LABELS, SYSTEM_FITTING_TYPES } from '../../types/pipingSystem';
import {
  detectFittingType,
  extractSchedule,
  findBestInstallType,
  findBestMaterial,
  type EstProductRate,
  type EstRatesForSpec,
} from '../../lib/estProductMapper';
import { estProductService } from '../../../../services/estProducts';

// ─── Styles ───

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#7a9ab5', fontWeight: 500, display: 'block', marginBottom: 4,
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 12,
  backgroundColor: '#0d1b2a', color: '#c8dae8',
  border: '1px solid #1f3450', borderRadius: 4,
};

const btnBase: React.CSSProperties = {
  padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', fontWeight: 600,
};

const btnPrimary: React.CSSProperties = {
  ...btnBase, border: 'none', backgroundColor: '#2563eb', color: '#fff',
};

const btnSecondary: React.CSSProperties = {
  ...btnBase, border: '1px solid #1f3450', backgroundColor: 'transparent', color: '#7a9ab5',
};

const btnDisabled: React.CSSProperties = {
  ...btnBase, border: 'none', backgroundColor: '#1e3a5f', color: '#4a6a88', cursor: 'not-allowed',
};

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #1f3450',
  color: '#7a9ab5', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px', borderBottom: '1px solid #152a3e', color: '#c8dae8',
};

// ─── Types ───

interface MappedFitting {
  product: EstProductRate;
  fittingType: SystemFittingType | 'unknown';
  included: boolean;
  schedule: string | null;
  isReducing: boolean;
  isReducingTee: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  spec: PipeSpec;
  onImportComplete: (updates: Partial<PipeSpec>) => void;
}

type FilterOption = { value: string; count: number };

export default function EstCatalogImportModal({ open, onClose, spec, onImportComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter dropdown options (from API)
  const [installTypeOptions, setInstallTypeOptions] = useState<FilterOption[]>([]);
  const [materialOptions, setMaterialOptions] = useState<FilterOption[]>([]);

  // Selected filter values
  const [selectedInstallType, setSelectedInstallType] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('ALL');

  // Data from API
  const [data, setData] = useState<EstRatesForSpec | null>(null);

  // Mapped fittings with user-adjustable types
  const [mappedFittings, setMappedFittings] = useState<MappedFitting[]>([]);
  const [includePipeRates, setIncludePipeRates] = useState(true);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setStep(1);
      setData(null);
      setMappedFittings([]);
      setIncludePipeRates(true);
      setError(null);
      setSelectedSchedule('ALL');
    }
  }, [open]);

  // Load filter options on open
  useEffect(() => {
    if (!open) return;
    setLoadingOptions(true);
    estProductService.getSpecFilterOptions({})
      .then((options) => {
        setInstallTypeOptions(options.installTypes);
        setMaterialOptions(options.materials);

        // Use spec's saved EST mapping if available, otherwise find best match
        if (spec.estInstallType) {
          setSelectedInstallType(spec.estInstallType);
        } else {
          const bestIT = findBestInstallType(spec.jointMethod, options.installTypes);
          if (bestIT) setSelectedInstallType(bestIT);
          else if (options.installTypes.length > 0) setSelectedInstallType(options.installTypes[0].value);
        }

        if (spec.estMaterial) {
          setSelectedMaterial(spec.estMaterial);
        } else {
          const bestMat = findBestMaterial(spec.material, options.materials);
          if (bestMat) setSelectedMaterial(bestMat);
          else if (options.materials.length > 0) setSelectedMaterial(options.materials[0].value);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load filter options');
      })
      .finally(() => setLoadingOptions(false));
  }, [open, spec.estInstallType, spec.estMaterial, spec.jointMethod, spec.material]);

  // Reload materials when install type changes
  useEffect(() => {
    if (!open || !selectedInstallType) return;
    estProductService.getSpecFilterOptions({ installType: selectedInstallType })
      .then((options) => {
        setMaterialOptions(options.materials);
        // Keep current material if still available, otherwise pick best match
        const stillAvailable = options.materials.find(m => m.value === selectedMaterial);
        if (!stillAvailable) {
          const bestMat = findBestMaterial(spec.material, options.materials);
          if (bestMat) setSelectedMaterial(bestMat);
          else if (options.materials.length > 0) setSelectedMaterial(options.materials[0].value);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line
  }, [selectedInstallType]);

  // Fetch rates when user clicks "Load Products"
  const handleLoadProducts = useCallback(() => {
    if (!selectedInstallType || !selectedMaterial) return;

    setLoading(true);
    setError(null);
    setData(null);
    setMappedFittings([]);
    setSelectedSchedule('ALL');

    estProductService.getRatesForSpec({ installType: selectedInstallType, material: selectedMaterial })
      .then((result) => {
        setData(result);
        // Auto-detect fitting types and extract schedules
        const mapped = result.fittingProducts.map((p): MappedFitting => {
          const detected = detectFittingType(p);
          const schedule = extractSchedule(p.description || '');
          return {
            product: p,
            fittingType: detected.kind === 'fitting' ? detected.type : 'unknown',
            included: detected.kind === 'fitting',
            schedule,
            isReducing: detected.kind === 'reducing',
            isReducingTee: detected.kind === 'reducing_tee',
          };
        });
        setMappedFittings(mapped);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load products');
      })
      .finally(() => setLoading(false));
  }, [selectedInstallType, selectedMaterial]);

  // Available schedules derived from the data
  const availableSchedules = useMemo(() => {
    if (!data) return [];
    return data.schedules || [];
  }, [data]);

  // Filter fittings by schedule (items without a schedule, like valves, always show)
  const filteredFittings = useMemo(() => {
    if (selectedSchedule === 'ALL') return mappedFittings;
    return mappedFittings.filter(m => {
      return !m.schedule || m.schedule === selectedSchedule;
    });
  }, [mappedFittings, selectedSchedule]);

  // Separate into categories for display
  const standardFittings = useMemo(
    () => filteredFittings.filter(m => !m.isReducing && !m.isReducingTee),
    [filteredFittings]
  );
  const reducingItems = useMemo(
    () => filteredFittings.filter(m => m.isReducing),
    [filteredFittings]
  );
  const reducingTees = useMemo(
    () => filteredFittings.filter(m => m.isReducingTee),
    [filteredFittings]
  );

  const handleImport = useCallback(() => {
    if (!data) return;

    const updates: Partial<PipeSpec> = {};

    // Import pipe rates (filtered by schedule if selected)
    if (includePipeRates && data.pipeRates.length > 0) {
      const pipeRates: Record<string, number> = { ...spec.pipeRates };
      const pipeCosts: Record<string, number> = { ...(spec.pipeCosts || {}) };
      const pipesToImport = selectedSchedule === 'ALL'
        ? data.pipeRates
        : data.pipeRates.filter(r => {
            const sched = extractSchedule(r.description || '');
            return !sched || sched === selectedSchedule;
          });
      for (const rate of pipesToImport) {
        if (rate.size_normalized) {
          pipeRates[rate.size_normalized] = rate.labor_time;
          if (rate.cost != null) {
            pipeCosts[rate.size_normalized] = rate.cost;
          }
        }
      }
      if (Object.keys(pipeRates).length > 0) {
        updates.pipeRates = pipeRates;
      }
      if (Object.keys(pipeCosts).length > 0) {
        updates.pipeCosts = pipeCosts;
      }
    }

    // Import standard fitting rates (from filteredFittings, not reducing)
    const includedFittings = standardFittings.filter(
      (m) => m.included && m.fittingType !== 'unknown'
    );
    if (includedFittings.length > 0) {
      const fittingRates: Record<string, Record<string, number>> = { ...spec.fittingRates };
      const fittingCosts: Record<string, Record<string, number>> = { ...(spec.fittingCosts || {}) };
      for (const m of includedFittings) {
        const ft = m.fittingType as SystemFittingType;
        if (!fittingRates[ft]) {
          fittingRates[ft] = {};
        } else {
          fittingRates[ft] = { ...fittingRates[ft] };
        }
        if (!fittingCosts[ft]) {
          fittingCosts[ft] = {};
        } else {
          fittingCosts[ft] = { ...fittingCosts[ft] };
        }
        const size = m.product.size_normalized;
        if (size) {
          fittingRates[ft][size] = m.product.labor_time;
          if (m.product.cost != null) {
            fittingCosts[ft][size] = m.product.cost;
          }
        }
      }
      updates.fittingRates = fittingRates;
      if (Object.keys(fittingCosts).length > 0) {
        updates.fittingCosts = fittingCosts;
      }
    }

    // Import reducing fitting rates
    const includedReducing = reducingItems.filter(m => m.included);
    if (includedReducing.length > 0) {
      const reducingFittingRates = { ...spec.reducingFittingRates };
      const reducingFittingCosts = { ...(spec.reducingFittingCosts || {}) };
      for (const m of includedReducing) {
        const detected = detectFittingType(m.product);
        if (detected.kind === 'reducing') {
          const rt = detected.type;
          if (!reducingFittingRates[rt]) {
            reducingFittingRates[rt] = {};
          } else {
            reducingFittingRates[rt] = { ...reducingFittingRates[rt] };
          }
          if (!reducingFittingCosts[rt]) {
            reducingFittingCosts[rt] = {};
          } else {
            reducingFittingCosts[rt] = { ...reducingFittingCosts[rt] };
          }
          const size = m.product.size_normalized;
          if (size) {
            reducingFittingRates[rt]![size] = m.product.labor_time;
            if (m.product.cost != null) {
              reducingFittingCosts[rt]![size] = m.product.cost;
            }
          }
        }
      }
      updates.reducingFittingRates = reducingFittingRates;
      if (Object.keys(reducingFittingCosts).length > 0) {
        updates.reducingFittingCosts = reducingFittingCosts;
      }
    }

    // Import reducing tee rates
    const includedReducingTees = reducingTees.filter(m => m.included);
    if (includedReducingTees.length > 0) {
      const reducingTeeRates = { ...spec.reducingTeeRates };
      const reducingTeeCosts: Record<string, number> = { ...(spec.reducingTeeCosts || {}) };
      for (const m of includedReducingTees) {
        const size = m.product.size_normalized;
        if (size) {
          reducingTeeRates[size] = m.product.labor_time;
          if (m.product.cost != null) {
            reducingTeeCosts[size] = m.product.cost;
          }
        }
      }
      updates.reducingTeeRates = reducingTeeRates;
      if (Object.keys(reducingTeeCosts).length > 0) {
        updates.reducingTeeCosts = reducingTeeCosts;
      }
    }

    onImportComplete(updates);
    onClose();
  }, [data, includePipeRates, standardFittings, reducingItems, reducingTees, spec, selectedSchedule, onImportComplete, onClose]);

  const updateFittingType = (index: number, type: SystemFittingType | 'unknown') => {
    setMappedFittings((prev) => {
      const next = [...prev];
      // Find the actual index in the full array (since we may be viewing filtered)
      const actual = filteredFittings[index];
      const realIdx = prev.indexOf(actual);
      if (realIdx >= 0) {
        next[realIdx] = { ...next[realIdx], fittingType: type, included: type !== 'unknown' };
      }
      return next;
    });
  };

  const toggleFittingIncluded = (index: number) => {
    setMappedFittings((prev) => {
      const next = [...prev];
      const actual = filteredFittings[index];
      const realIdx = prev.indexOf(actual);
      if (realIdx >= 0) {
        next[realIdx] = { ...next[realIdx], included: !next[realIdx].included };
      }
      return next;
    });
  };

  const toggleReducingIncluded = (list: MappedFitting[], index: number) => {
    setMappedFittings((prev) => {
      const next = [...prev];
      const actual = list[index];
      const realIdx = prev.indexOf(actual);
      if (realIdx >= 0) {
        next[realIdx] = { ...next[realIdx], included: !next[realIdx].included };
      }
      return next;
    });
  };

  // Counts for summary
  const includedPipeCount = includePipeRates && data ? data.pipeRates.length : 0;
  const includedFittingCount = standardFittings.filter((m) => m.included && m.fittingType !== 'unknown').length;
  const includedReducingCount = reducingItems.filter(m => m.included).length;
  const includedReducingTeeCount = reducingTees.filter(m => m.included).length;
  const totalImportCount = includedPipeCount + includedFittingCount + includedReducingCount + includedReducingTeeCount;
  const unknownCount = standardFittings.filter((m) => m.fittingType === 'unknown').length;

  return (
    <Modal open={open} onClose={onClose} title="Import from EST Catalog" maxWidth={900}>
      <div style={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>
        {/* Filter bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f3450', display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>INSTALL TYPE</label>
            <select
              style={selectStyle}
              value={selectedInstallType}
              onChange={(e) => setSelectedInstallType(e.target.value)}
              disabled={loadingOptions}
            >
              <option value="">-- Select --</option>
              {installTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} ({opt.count.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>MATERIAL</label>
            <select
              style={selectStyle}
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              disabled={loadingOptions}
            >
              <option value="">-- Select --</option>
              {materialOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} ({opt.count.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          {availableSchedules.length > 0 && (
            <div style={{ minWidth: 120 }}>
              <label style={labelStyle}>SCHEDULE</label>
              <select
                style={selectStyle}
                value={selectedSchedule}
                onChange={(e) => setSelectedSchedule(e.target.value)}
              >
                <option value="ALL">All</option>
                {availableSchedules.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleLoadProducts}
            disabled={!selectedInstallType || !selectedMaterial || loading}
            style={!selectedInstallType || !selectedMaterial || loading ? btnDisabled : btnPrimary}
          >
            {loading ? 'Loading...' : 'Load Products'}
          </button>
        </div>

        {/* Summary bar */}
        {data && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #1f3450', display: 'flex', gap: 24, fontSize: 12, color: '#7a9ab5' }}>
            <span>{data.summary.perFt} pipe rates</span>
            <span>{standardFittings.length} fittings ({unknownCount} unmatched)</span>
            <span>{reducingItems.length} reducers</span>
            <span>{reducingTees.length} reducing tees</span>
          </div>
        )}

        {/* Loading / Error */}
        {loadingOptions && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a9ab5' }}>
            Loading filter options...
          </div>
        )}
        {error && (
          <div style={{ padding: 16, color: '#ef4444' }}>
            {error}
          </div>
        )}
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a9ab5' }}>
            Loading products from EST catalog...
          </div>
        )}

        {/* No data yet prompt */}
        {!loadingOptions && !loading && !error && !data && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a88', fontSize: 13 }}>
            Select an install type and material, then click "Load Products"
          </div>
        )}

        {/* Step 1: Review data */}
        {!loading && !error && data && step === 1 && (
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {data.summary.total === 0 ? (
              <div style={{ color: '#7a9ab5', textAlign: 'center', padding: 40 }}>
                No matching products found for {selectedInstallType} + {selectedMaterial}.
                <br />Try different filter selections.
              </div>
            ) : (
              <>
                {/* Pipe rates section */}
                {data.pipeRates.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={includePipeRates}
                        onChange={(e) => setIncludePipeRates(e.target.checked)}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#d4e3f3' }}>
                        Pipe Rates ({data.pipeRates.length} sizes)
                      </span>
                    </div>
                    <div style={{ maxHeight: 200, overflow: 'auto', borderRadius: 6, border: '1px solid #1f3450' }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Size</th>
                            <th style={thStyle}>Hrs/LF</th>
                            <th style={thStyle}>Product</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.pipeRates.map((r, i) => (
                            <tr key={i}>
                              <td style={tdStyle}>{r.size}</td>
                              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.labor_time.toFixed(4)}</td>
                              <td style={{ ...tdStyle, color: '#7a9ab5', fontSize: 11 }}>{r.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Standard fittings section */}
                {standardFittings.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#d4e3f3', marginBottom: 8 }}>
                      Fittings ({standardFittings.length} items, {unknownCount} unmatched)
                    </div>
                    <div style={{ maxHeight: 300, overflow: 'auto', borderRadius: 6, border: '1px solid #1f3450' }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={{ ...thStyle, width: 30 }}></th>
                            <th style={thStyle}>Description</th>
                            <th style={thStyle}>Size</th>
                            <th style={thStyle}>Hrs/Ea</th>
                            <th style={{ ...thStyle, width: 180 }}>Fitting Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standardFittings.map((m, i) => (
                            <tr key={i} style={{ opacity: m.included ? 1 : 0.5 }}>
                              <td style={tdStyle}>
                                <input
                                  type="checkbox"
                                  checked={m.included}
                                  onChange={() => toggleFittingIncluded(i)}
                                />
                              </td>
                              <td style={{ ...tdStyle, fontSize: 11 }}>{m.product.description}</td>
                              <td style={tdStyle}>{m.product.size}</td>
                              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{m.product.labor_time.toFixed(4)}</td>
                              <td style={tdStyle}>
                                <select
                                  value={m.fittingType}
                                  onChange={(e) => updateFittingType(i, e.target.value as SystemFittingType | 'unknown')}
                                  style={{
                                    width: '100%', padding: '3px 4px', fontSize: 11,
                                    backgroundColor: '#0d1b2a', color: '#c8dae8',
                                    border: `1px solid ${m.fittingType === 'unknown' ? '#f59e0b' : '#1f3450'}`,
                                    borderRadius: 4,
                                  }}
                                >
                                  <option value="unknown">-- Skip --</option>
                                  {SYSTEM_FITTING_TYPES.map((ft) => (
                                    <option key={ft} value={ft}>{SYSTEM_FITTING_TYPE_LABELS[ft]}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Reducing items section */}
                {reducingItems.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#d4e3f3', marginBottom: 8 }}>
                      Reducers ({reducingItems.length} items) — imports to Reducing tab
                    </div>
                    <div style={{ maxHeight: 200, overflow: 'auto', borderRadius: 6, border: '1px solid #1f3450' }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={{ ...thStyle, width: 30 }}></th>
                            <th style={thStyle}>Description</th>
                            <th style={thStyle}>Size</th>
                            <th style={thStyle}>Hrs/Ea</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reducingItems.map((m, i) => (
                            <tr key={i} style={{ opacity: m.included ? 1 : 0.5 }}>
                              <td style={tdStyle}>
                                <input
                                  type="checkbox"
                                  checked={m.included}
                                  onChange={() => toggleReducingIncluded(reducingItems, i)}
                                />
                              </td>
                              <td style={{ ...tdStyle, fontSize: 11 }}>{m.product.description}</td>
                              <td style={tdStyle}>{m.product.size}</td>
                              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{m.product.labor_time.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Reducing tees section */}
                {reducingTees.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#d4e3f3', marginBottom: 8 }}>
                      Reducing Tees ({reducingTees.length} items) — imports to Tees tab
                    </div>
                    <div style={{ maxHeight: 200, overflow: 'auto', borderRadius: 6, border: '1px solid #1f3450' }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={{ ...thStyle, width: 30 }}></th>
                            <th style={thStyle}>Description</th>
                            <th style={thStyle}>Size</th>
                            <th style={thStyle}>Hrs/Ea</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reducingTees.map((m, i) => (
                            <tr key={i} style={{ opacity: m.included ? 1 : 0.5 }}>
                              <td style={tdStyle}>
                                <input
                                  type="checkbox"
                                  checked={m.included}
                                  onChange={() => toggleReducingIncluded(reducingTees, i)}
                                />
                              </td>
                              <td style={{ ...tdStyle, fontSize: 11 }}>{m.product.description}</td>
                              <td style={tdStyle}>{m.product.size}</td>
                              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{m.product.labor_time.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, color: '#d4e3f3', fontWeight: 600 }}>
              Ready to import
            </div>
            <div style={{ color: '#7a9ab5', fontSize: 13, textAlign: 'center' }}>
              {includedPipeCount > 0 && <div>{includedPipeCount} pipe rate{includedPipeCount !== 1 ? 's' : ''} (hours/LF)</div>}
              {includedFittingCount > 0 && <div>{includedFittingCount} fitting rate{includedFittingCount !== 1 ? 's' : ''} (hours/each)</div>}
              {includedReducingCount > 0 && <div>{includedReducingCount} reducing rate{includedReducingCount !== 1 ? 's' : ''} (hours/each)</div>}
              {includedReducingTeeCount > 0 && <div>{includedReducingTeeCount} reducing tee rate{includedReducingTeeCount !== 1 ? 's' : ''} (hours/each)</div>}
              {totalImportCount === 0 && (
                <div>No rates selected for import.</div>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: '#4a6a88' }}>
                Existing rates for matching sizes will be overwritten.
              </div>
            </div>
          </div>
        )}

        {/* Footer with buttons */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #1f3450',
          display: 'flex', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step === 2 && (
              <button onClick={() => setStep(1)} style={btnSecondary}>Back</button>
            )}
            {step === 1 && data && data.summary.total > 0 && (
              <button
                onClick={() => setStep(2)}
                disabled={totalImportCount === 0}
                style={totalImportCount === 0 ? btnDisabled : btnPrimary}
              >
                Review Import ({totalImportCount} rates)
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleImport}
                disabled={totalImportCount === 0}
                style={totalImportCount === 0 ? btnDisabled : btnPrimary}
              >
                Import Rates
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
