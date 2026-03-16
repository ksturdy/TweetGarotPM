import { useState } from 'react';
import type { PipeSpec, SystemFittingType } from '../../types/pipingSystem';
import { SYSTEM_FITTING_TYPE_LABELS, FITTING_TYPE_GROUPS } from '../../types/pipingSystem';
import { PIPE_SIZES_EXTENDED } from '../../lib/piping/referenceData';
import { normalizeSize } from '../../lib/piping/productivityLookup';
import EditableRateCell from './EditableRateCell';
import RateImportModal from './RateImportModal';
import BuildFromTablesModal from './BuildFromTablesModal';

interface FittingRatesTabProps {
  spec: PipeSpec;
  onUpdate: (updates: Partial<PipeSpec>) => void;
}

/** Convert a snake_case key to Title Case label */
function keyToLabel(key: string): string {
  return SYSTEM_FITTING_TYPE_LABELS[key as SystemFittingType] ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FittingRatesTab({ spec, onUpdate }: FittingRatesTabProps) {
  const [activeGroup, setActiveGroup] = useState<string>('standard');
  const [importOpen, setImportOpen] = useState(false);
  const [buildFromTablesOpen, setBuildFromTablesOpen] = useState(false);

  // Collect all predefined fitting type keys
  const predefinedKeys = new Set(FITTING_TYPE_GROUPS.flatMap((g) => g.types));

  // Detect custom types: any key in fittingRates that isn't in predefined groups
  const customTypes = Object.keys(spec.fittingRates).filter(
    (key) => !predefinedKeys.has(key as SystemFittingType) && Object.keys(spec.fittingRates[key]).length > 0,
  );

  // Build active column list based on selected group
  let activeTypes: string[];
  let activeGroupLabel: string;
  if (activeGroup === 'custom') {
    activeTypes = customTypes;
    activeGroupLabel = 'Custom';
  } else {
    const group = FITTING_TYPE_GROUPS.find((g) => g.key === activeGroup);
    activeTypes = group?.types ?? [];
    activeGroupLabel = group?.label ?? '';
  }

  const handleRateChange = (
    fittingType: string,
    sizeKey: string,
    value: number | undefined,
  ) => {
    const currentFittingRates = spec.fittingRates[fittingType] ?? {};
    const newFittingRates = { ...currentFittingRates };
    if (value === undefined) {
      delete newFittingRates[sizeKey];
    } else {
      newFittingRates[sizeKey] = value;
    }
    onUpdate({
      fittingRates: {
        ...spec.fittingRates,
        [fittingType]: newFittingRates,
      },
    });
  };

  const totalDefined = Object.values(spec.fittingRates).reduce(
    (sum, rates) => sum + (rates ? Object.keys(rates).length : 0),
    0,
  );

  const groupRateCount = (types: string[]) =>
    types.reduce((sum, ft) => sum + Object.keys(spec.fittingRates[ft] ?? {}).length, 0);

  return (
    <div>
      {/* Group sub-tabs + Import button */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 4, flexWrap: 'wrap' }}>
        {FITTING_TYPE_GROUPS.map((group) => {
          const isActive = activeGroup === group.key;
          const count = groupRateCount(group.types);
          return (
            <button
              key={group.key}
              onClick={() => setActiveGroup(group.key)}
              style={{
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#d4e3f3' : '#4a6a88',
                backgroundColor: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : 'rgba(31,52,80,0.5)'}`,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {group.label}
              {count > 0 && (
                <span style={{ marginLeft: 4, fontSize: 9, color: '#3b82f6' }}>({count})</span>
              )}
            </button>
          );
        })}

        {/* Custom group tab — only shown when custom types exist */}
        {customTypes.length > 0 && (
          <button
            onClick={() => setActiveGroup('custom')}
            style={{
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: activeGroup === 'custom' ? 600 : 400,
              color: activeGroup === 'custom' ? '#d4e3f3' : '#c084fc',
              backgroundColor: activeGroup === 'custom' ? 'rgba(192,132,252,0.12)' : 'transparent',
              border: `1px solid ${activeGroup === 'custom' ? 'rgba(192,132,252,0.3)' : 'rgba(192,132,252,0.3)'}`,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Custom
            <span style={{ marginLeft: 4, fontSize: 9, color: '#c084fc' }}>
              ({groupRateCount(customTypes)})
            </span>
          </button>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setBuildFromTablesOpen(true)}
          style={{
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 500,
            color: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Build from Tables
        </button>
        <button
          onClick={() => setImportOpen(true)}
          style={{
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 500,
            color: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Import Rates
        </button>
      </div>

      <p style={{ fontSize: 10, color: '#4a6a88', margin: '0 0 8px 0' }}>
        {totalDefined} total rates defined.
        Showing {activeTypes.length} types in "{activeGroupLabel}".
      </p>

      {/* Rate grid */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 320px)', borderRadius: 6, border: '1px solid #1f3450' }}>
        <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ backgroundColor: '#131f33' }}>
              <th style={{
                position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#131f33',
                borderBottom: '1px solid #1f3450', borderRight: '1px solid #1f3450',
                padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#7a9ab5', minWidth: 72,
              }}>
                Size
              </th>
              {activeTypes.map((ft) => (
                <th key={ft} style={{
                  borderBottom: '1px solid #1f3450', borderRight: '1px solid #1f3450',
                  padding: '8px 8px', textAlign: 'right', fontWeight: 500, color: '#7a9ab5',
                  minWidth: 80, whiteSpace: 'nowrap',
                }}>
                  {keyToLabel(ft)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PIPE_SIZES_EXTENDED.map((size, i) => {
              const sizeKey = normalizeSize(size.nominal);
              const rowBg = i % 2 === 0 ? '#0d1825' : '#0f1b2d';
              return (
                <tr key={size.nominal} style={{ backgroundColor: rowBg }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 10, backgroundColor: rowBg,
                    borderRight: '1px solid rgba(31,52,80,0.5)', padding: '4px 12px',
                    color: '#7a9ab5', fontFamily: 'monospace',
                  }}>
                    {size.displayLabel}
                  </td>
                  {activeTypes.map((ft) => (
                    <td key={ft} style={{ borderRight: '1px solid rgba(31,52,80,0.3)', padding: '2px 2px' }}>
                      <EditableRateCell
                        value={(spec.fittingRates[ft] ?? {})[sizeKey]}
                        onChange={(v) => handleRateChange(ft, sizeKey, v)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Import modal */}
      <RateImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        spec={spec}
        onImportComplete={(newFittingRates) => {
          onUpdate({ fittingRates: newFittingRates });
          setImportOpen(false);
        }}
      />

      {/* Build from Tables modal */}
      <BuildFromTablesModal
        open={buildFromTablesOpen}
        onClose={() => setBuildFromTablesOpen(false)}
        spec={spec}
        onImportComplete={(updates) => {
          onUpdate(updates);
          setBuildFromTablesOpen(false);
        }}
      />
    </div>
  );
}
