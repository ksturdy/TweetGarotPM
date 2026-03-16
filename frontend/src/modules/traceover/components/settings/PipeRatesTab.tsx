import type { PipeSpec } from '../../types/pipingSystem';
import { PIPE_SIZES_EXTENDED } from '../../lib/piping/referenceData';
import { normalizeSize } from '../../lib/piping/productivityLookup';
import EditableRateCell from './EditableRateCell';

interface PipeRatesTabProps {
  spec: PipeSpec;
  onUpdate: (updates: Partial<PipeSpec>) => void;
}

export default function PipeRatesTab({ spec, onUpdate }: PipeRatesTabProps) {
  const handleRateChange = (sizeKey: string, value: number | undefined) => {
    const newRates = { ...spec.pipeRates };
    if (value === undefined) {
      delete newRates[sizeKey];
    } else {
      newRates[sizeKey] = value;
    }
    onUpdate({ pipeRates: newRates });
  };

  const definedCount = Object.keys(spec.pipeRates).length;

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 10, color: '#4a6a88', margin: 0 }}>
          Pipe installation rates in hours per linear foot. {definedCount} sizes defined.
        </p>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)', borderRadius: 6, border: '1px solid #1f3450' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ backgroundColor: '#131f33' }}>
              <th style={{ borderBottom: '1px solid #1f3450', borderRight: '1px solid #1f3450', padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#7a9ab5', width: 112 }}>
                Size
              </th>
              <th style={{ borderBottom: '1px solid #1f3450', padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: '#7a9ab5', width: 128 }}>
                Hrs / LF
              </th>
            </tr>
          </thead>
          <tbody>
            {PIPE_SIZES_EXTENDED.map((size, i) => {
              const sizeKey = normalizeSize(size.nominal);
              return (
                <tr key={size.nominal} style={{ backgroundColor: i % 2 === 0 ? '#0d1825' : '#0f1b2d' }}>
                  <td style={{ borderRight: '1px solid rgba(31,52,80,0.5)', padding: '4px 12px', color: '#7a9ab5', fontFamily: 'monospace' }}>
                    {size.displayLabel}
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <EditableRateCell
                      value={spec.pipeRates[sizeKey]}
                      onChange={(v) => handleRateChange(sizeKey, v)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
