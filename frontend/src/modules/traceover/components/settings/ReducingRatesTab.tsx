import { useState } from 'react';
import type { PipeSpec, ReducingFittingType } from '../../types/pipingSystem';
import { REDUCING_FITTING_TYPES, REDUCING_FITTING_TYPE_LABELS } from '../../types/pipingSystem';
import { PIPE_SIZES_EXTENDED } from '../../lib/piping/referenceData';
import { normalizeSize } from '../../lib/piping/productivityLookup';
import EditableRateCell from './EditableRateCell';

interface ReducingRatesTabProps {
  spec: PipeSpec;
  onUpdate: (updates: Partial<PipeSpec>) => void;
}

export default function ReducingRatesTab({ spec, onUpdate }: ReducingRatesTabProps) {
  const [activeType, setActiveType] = useState<ReducingFittingType>('reducer_concentric');

  const handleRateChange = (key: string, value: number | undefined) => {
    const currentTable = spec.reducingFittingRates[activeType] ?? {};
    const newTable = { ...currentTable };
    if (value === undefined) {
      delete newTable[key];
    } else {
      newTable[key] = value;
    }
    onUpdate({
      reducingFittingRates: {
        ...spec.reducingFittingRates,
        [activeType]: newTable,
      },
    });
  };

  const currentTable = spec.reducingFittingRates[activeType] ?? {};
  const totalDefined = Object.keys(currentTable).length;
  const sizes = PIPE_SIZES_EXTENDED;

  return (
    <div>
      {/* Sub-type selector */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        {REDUCING_FITTING_TYPES.map((rt) => {
          const count = Object.keys(spec.reducingFittingRates[rt] ?? {}).length;
          const isActive = activeType === rt;
          return (
            <button
              key={rt}
              onClick={() => setActiveType(rt)}
              style={{
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 10,
                fontWeight: 500,
                backgroundColor: isActive ? '#3b82f6' : '#131f33',
                color: isActive ? '#fff' : '#7a9ab5',
                border: isActive ? 'none' : '1px solid #1f3450',
                cursor: 'pointer',
              }}
            >
              {REDUCING_FITTING_TYPE_LABELS[rt]} ({count})
            </button>
          );
        })}
      </div>

      <p style={{ marginBottom: 12, fontSize: 10, color: '#4a6a88' }}>
        Reducing fitting rates in hours per each. Rows = main size, columns = reducing size. {totalDefined} rates defined.
      </p>

      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 320px)', borderRadius: 6, border: '1px solid #1f3450' }}>
        <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ backgroundColor: '#131f33' }}>
              <th style={{
                position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#131f33',
                borderBottom: '1px solid #1f3450', borderRight: '1px solid #1f3450',
                padding: '8px 8px', textAlign: 'left', fontWeight: 500, color: '#7a9ab5', minWidth: 72,
              }}>
                Main ↓ / Red →
              </th>
              {sizes.map((s) => (
                <th key={s.nominal} style={{
                  borderBottom: '1px solid #1f3450', borderRight: '1px solid #1f3450',
                  padding: '8px 4px', textAlign: 'right', fontWeight: 500, color: '#7a9ab5',
                  minWidth: 60, whiteSpace: 'nowrap', fontSize: 10,
                }}>
                  {s.displayLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((mainSize, i) => {
              const mainKey = normalizeSize(mainSize.nominal);
              const rowBg = i % 2 === 0 ? '#0d1825' : '#0f1b2d';
              return (
                <tr key={mainSize.nominal} style={{ backgroundColor: rowBg }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 10, backgroundColor: rowBg,
                    borderRight: '1px solid rgba(31,52,80,0.5)', padding: '4px 8px',
                    color: '#7a9ab5', fontFamily: 'monospace', whiteSpace: 'nowrap',
                  }}>
                    {mainSize.displayLabel}
                  </td>
                  {sizes.map((redSize) => {
                    const redKey = normalizeSize(redSize.nominal);
                    if (redSize.nominalInches >= mainSize.nominalInches) {
                      return (
                        <td key={redSize.nominal} style={{ borderRight: '1px solid rgba(31,52,80,0.2)', backgroundColor: '#0a1420' }} />
                      );
                    }
                    const compositeKey = `${mainKey}|${redKey}`;
                    return (
                      <td key={redSize.nominal} style={{ borderRight: '1px solid rgba(31,52,80,0.2)', padding: '2px 2px' }}>
                        <EditableRateCell
                          value={currentTable[compositeKey]}
                          onChange={(v) => handleRateChange(compositeKey, v)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
