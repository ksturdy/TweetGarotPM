import type { PipeSpec } from '../../types/pipingSystem';
import { PIPE_SIZES_EXTENDED } from '../../lib/piping/referenceData';
import { normalizeSize } from '../../lib/piping/productivityLookup';
import EditableRateCell from './EditableRateCell';

interface ReducingTeeRatesTabProps {
  spec: PipeSpec;
  onUpdate: (updates: Partial<PipeSpec>) => void;
}

const thStyle: React.CSSProperties = {
  borderBottom: '1px solid #1f3450',
  borderRight: '1px solid #1f3450',
  padding: '8px 4px',
  textAlign: 'right',
  fontWeight: 500,
  color: '#7a9ab5',
  minWidth: 60,
  whiteSpace: 'nowrap',
  fontSize: 10,
};

export default function ReducingTeeRatesTab({ spec, onUpdate }: ReducingTeeRatesTabProps) {
  const handleTeeRateChange = (key: string, value: number | undefined) => {
    const newRates = { ...spec.reducingTeeRates };
    if (value === undefined) {
      delete newRates[key];
    } else {
      newRates[key] = value;
    }
    onUpdate({ reducingTeeRates: newRates });
  };

  const handleCrossRateChange = (key: string, value: number | undefined) => {
    const newRates = { ...spec.crossReducingRates };
    if (value === undefined) {
      delete newRates[key];
    } else {
      newRates[key] = value;
    }
    onUpdate({ crossReducingRates: newRates });
  };

  const teeCount = Object.keys(spec.reducingTeeRates).length;
  const crossCount = Object.keys(spec.crossReducingRates).length;
  const sizes = PIPE_SIZES_EXTENDED;

  const renderMatrix = (
    title: string,
    count: number,
    description: string,
    table: Record<string, number>,
    onChange: (key: string, value: number | undefined) => void,
  ) => (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#7a9ab5' }}>
        {title} ({count} rates)
      </h3>
      <p style={{ marginBottom: 12, fontSize: 10, color: '#4a6a88' }}>{description}</p>

      <div style={{ overflow: 'auto', maxHeight: 'calc(50vh - 160px)', borderRadius: 6, border: '1px solid #1f3450' }}>
        <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ backgroundColor: '#131f33' }}>
              <th style={{
                position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#131f33',
                borderBottom: '1px solid #1f3450', borderRight: '1px solid #1f3450',
                padding: '8px 8px', textAlign: 'left', fontWeight: 500, color: '#7a9ab5', minWidth: 72,
              }}>
                Main ↓ / {title.includes('Tee') ? 'Branch' : 'Red'} →
              </th>
              {sizes.map((s) => (
                <th key={s.nominal} style={thStyle}>{s.displayLabel}</th>
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
                  {sizes.map((otherSize) => {
                    const otherKey = normalizeSize(otherSize.nominal);
                    if (otherSize.nominalInches >= mainSize.nominalInches) {
                      return (
                        <td key={otherSize.nominal} style={{ borderRight: '1px solid rgba(31,52,80,0.2)', backgroundColor: '#0a1420' }} />
                      );
                    }
                    const compositeKey = `${mainKey}|${otherKey}`;
                    return (
                      <td key={otherSize.nominal} style={{ borderRight: '1px solid rgba(31,52,80,0.2)', padding: '2px 2px' }}>
                        <EditableRateCell
                          value={table[compositeKey]}
                          onChange={(v) => onChange(compositeKey, v)}
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

  return (
    <div>
      {renderMatrix(
        'Reducing Tees',
        teeCount,
        'Rows = main/run size, columns = branch/reducing size. Hours per each.',
        spec.reducingTeeRates,
        handleTeeRateChange,
      )}
      {renderMatrix(
        'Cross Reducing',
        crossCount,
        'Rows = main size, columns = reducing size. Hours per each.',
        spec.crossReducingRates,
        handleCrossRateChange,
      )}
    </div>
  );
}
