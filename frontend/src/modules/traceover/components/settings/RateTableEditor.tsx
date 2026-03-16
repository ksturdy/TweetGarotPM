import { useState } from 'react';
import type { RateTable, RateTableColumn } from '../../types/pipingSystem';
import { RATE_TABLE_CATEGORIES, RATE_TABLE_CATEGORY_LABELS, type RateTableCategory } from '../../types/pipingSystem';
import { PIPE_SIZES_EXTENDED } from '../../lib/piping/referenceData';
import { normalizeSize } from '../../lib/piping/productivityLookup';
import EditableRateCell from './EditableRateCell';
import RateTableImportModal from './RateTableImportModal';

interface RateTableEditorProps {
  table: RateTable;
  onUpdate: (updates: Partial<RateTable>) => void;
  onUpdateColumn: (columnId: string, updates: Partial<RateTableColumn>) => void;
  onAddColumns: (columns: Omit<RateTableColumn, 'id'>[]) => void;
  onRemoveColumn: (columnId: string) => void;
}

export default function RateTableEditor({
  table,
  onUpdate,
  onUpdateColumn,
  onAddColumns,
  onRemoveColumn,
}: RateTableEditorProps) {
  const [importOpen, setImportOpen] = useState(false);

  const handleRateChange = (
    columnId: string,
    sizeKey: string,
    value: number | undefined,
  ) => {
    const col = table.columns.find((c) => c.id === columnId);
    if (!col) return;
    const newRates = { ...col.rates };
    if (value === undefined) {
      delete newRates[sizeKey];
    } else {
      newRates[sizeKey] = value;
    }
    onUpdateColumn(columnId, { rates: newRates });
  };

  const totalRates = table.columns.reduce(
    (sum, col) => sum + Object.keys(col.rates).length,
    0,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Metadata bar */}
      <div style={{
        display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid #1f3450',
        backgroundColor: '#0d1825', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 9, color: '#4a6a88', textTransform: 'uppercase', fontWeight: 600 }}>Name</label>
          <input
            type="text"
            value={table.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            style={{
              display: 'block', width: '100%', marginTop: 2,
              padding: '4px 8px', fontSize: 13, fontWeight: 600,
              backgroundColor: '#131f33', border: '1px solid #1f3450',
              borderRadius: 4, color: '#d4e3f3', outline: 'none',
            }}
          />
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: 9, color: '#4a6a88', textTransform: 'uppercase', fontWeight: 600 }}>Category</label>
          <select
            value={table.category}
            onChange={(e) => onUpdate({ category: e.target.value })}
            style={{
              display: 'block', width: '100%', marginTop: 2,
              padding: '4px 8px', fontSize: 12,
              backgroundColor: '#131f33', border: '1px solid #1f3450',
              borderRadius: 4, color: '#d4e3f3',
            }}
          >
            {RATE_TABLE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {RATE_TABLE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 9, color: '#4a6a88', textTransform: 'uppercase', fontWeight: 600 }}>Notes</label>
          <input
            type="text"
            value={table.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Optional description"
            style={{
              display: 'block', width: '100%', marginTop: 2,
              padding: '4px 8px', fontSize: 12,
              backgroundColor: '#131f33', border: '1px solid #1f3450',
              borderRadius: 4, color: '#d4e3f3', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 8,
        borderBottom: '1px solid #1f3450', flexShrink: 0,
      }}>
        <p style={{ fontSize: 10, color: '#4a6a88', margin: 0, flex: 1 }}>
          {table.columns.length} column{table.columns.length !== 1 ? 's' : ''}, {totalRates} total rates
        </p>
        <button
          onClick={() => setImportOpen(true)}
          style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 500,
            color: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 4, cursor: 'pointer',
          }}
        >
          Paste / Import Columns
        </button>
      </div>

      {/* Rate grid */}
      {table.columns.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#4a6a88',
        }}>
          No columns yet. Click "Paste / Import Columns" to add rates from a rate book.
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
          <div style={{ borderRadius: 6, border: '1px solid #1f3450', marginTop: 8 }}>
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
                  {table.columns.map((col) => (
                    <th key={col.id} style={{
                      borderBottom: '1px solid #1f3450', borderRight: '1px solid #1f3450',
                      padding: '6px 8px', textAlign: 'right', fontWeight: 500, color: '#7a9ab5',
                      minWidth: 80, whiteSpace: 'nowrap',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span>{col.columnLabel}</span>
                        <span style={{ fontSize: 9, color: '#4a6a88', fontFamily: 'monospace' }}>
                          {col.columnKey}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PIPE_SIZES_EXTENDED.map((size, i) => {
                  const sizeKey = normalizeSize(size.nominal);
                  const rowBg = i % 2 === 0 ? '#0d1825' : '#0f1b2d';
                  // Skip rows where no column has a rate for this size
                  const hasAnyRate = table.columns.some((col) => col.rates[sizeKey] !== undefined);
                  if (!hasAnyRate && table.columns.length > 3) {
                    // Only skip for large tables — for small tables show all sizes
                    return null;
                  }
                  return (
                    <tr key={size.nominal} style={{ backgroundColor: rowBg }}>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 10, backgroundColor: rowBg,
                        borderRight: '1px solid rgba(31,52,80,0.5)', padding: '4px 12px',
                        color: '#7a9ab5', fontFamily: 'monospace',
                      }}>
                        {size.displayLabel}
                      </td>
                      {table.columns.map((col) => (
                        <td key={col.id} style={{ borderRight: '1px solid rgba(31,52,80,0.3)', padding: '2px 2px' }}>
                          <EditableRateCell
                            value={col.rates[sizeKey]}
                            onChange={(v) => handleRateChange(col.id, sizeKey, v)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import modal */}
      <RateTableImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportColumns={(newColumns) => {
          onAddColumns(newColumns);
          setImportOpen(false);
        }}
      />
    </div>
  );
}
