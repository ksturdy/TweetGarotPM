import { useState, useCallback } from 'react';
import Modal from '../ui/Modal';
import type { RateTableColumn } from '../../types/pipingSystem';
import {
  parseTabSeparatedText,
  analyzeGrid,
  type SizeRow,
  type ParseResult,
} from '../../lib/piping/rateImportParser';

// ─── Helpers ───

/** Convert a column header like "Double Extra Heavy - 21 Ft." to "double_extra_heavy_21_ft" */
function headerToKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ─── Local column type ───

interface ImportColumn {
  columnIndex: number;
  columnHeader: string;       // editable display label
  columnKey: string;           // editable snake_case key
  enabled: boolean;
  rateCount: number;
}

// ─── Styles ───

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#7a9ab5', fontWeight: 500,
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

// ─── Component ───

interface RateTableImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportColumns: (columns: Omit<RateTableColumn, 'id'>[]) => void;
}

export default function RateTableImportModal({ open, onClose, onImportColumns }: RateTableImportModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columns, setColumns] = useState<ImportColumn[]>([]);
  const [sizes, setSizes] = useState<SizeRow[]>([]);

  const handleParse = useCallback(() => {
    const grid = parseTabSeparatedText(rawText);
    if (grid.length < 2) return;
    const result = analyzeGrid(grid);
    setParseResult(result);
    setSizes(result.sizes);

    // Build simple column list with auto-generated keys, all enabled by default
    const usedKeys = new Set<string>();
    const cols: ImportColumn[] = result.columns.map((c) => {
      // Count numeric values for this column across all detected sizes
      let rateCount = 0;
      for (const sz of result.sizes) {
        const cell = result.grid[sz.rowIndex]?.[c.columnIndex];
        if (cell && cell !== '' && cell !== '--' && cell !== '-' && !isNaN(parseFloat(cell))) {
          rateCount++;
        }
      }

      // Auto-generate unique key: append _2, _3, etc. if base key already taken
      const baseKey = headerToKey(c.columnHeader || `column_${c.columnIndex + 1}`);
      let key = baseKey;
      let suffix = 2;
      while (usedKeys.has(key)) {
        key = `${baseKey}_${suffix}`;
        suffix++;
      }
      usedKeys.add(key);

      return {
        columnIndex: c.columnIndex,
        columnHeader: c.columnHeader || `Column ${c.columnIndex + 1}`,
        columnKey: key,
        enabled: rateCount > 0,
        rateCount,
      };
    });
    setColumns(cols);
    setStep(2);
  }, [rawText]);

  const handleColumnToggle = (colIndex: number) => {
    setColumns((prev) =>
      prev.map((c) => (c.columnIndex === colIndex ? { ...c, enabled: !c.enabled } : c)),
    );
  };

  const handleLabelChange = (colIndex: number, newLabel: string) => {
    // Update label and auto-regenerate key from new label
    const newKey = headerToKey(newLabel || `column_${colIndex + 1}`);
    setColumns((prev) =>
      prev.map((c) => (c.columnIndex === colIndex ? { ...c, columnHeader: newLabel, columnKey: newKey } : c)),
    );
  };

  const handleKeyChange = (colIndex: number, newKey: string) => {
    const sanitized = newKey.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
    setColumns((prev) =>
      prev.map((c) => (c.columnIndex === colIndex ? { ...c, columnKey: sanitized } : c)),
    );
  };

  const handleSizeToggle = (rowIndex: number) => {
    setSizes((prev) =>
      prev.map((s) => (s.rowIndex === rowIndex ? { ...s, enabled: !s.enabled } : s)),
    );
  };

  const handleSelectAllSizes = (enabled: boolean) => {
    setSizes((prev) => prev.map((s) => ({ ...s, enabled })));
  };

  const handleSelectAllColumns = (enabled: boolean) => {
    setColumns((prev) => prev.map((c) => ({ ...c, enabled })));
  };

  const enabledColumns = columns.filter((c) => c.enabled && c.columnKey);
  const enabledSizes = sizes.filter((s) => s.enabled);

  // Build column objects from enabled columns/sizes
  const buildColumns = (): Omit<RateTableColumn, 'id'>[] => {
    if (!parseResult) return [];
    const result: Omit<RateTableColumn, 'id'>[] = [];

    for (let i = 0; i < enabledColumns.length; i++) {
      const col = enabledColumns[i];
      const rates: Record<string, number> = {};

      for (const sz of enabledSizes) {
        const cell = parseResult.grid[sz.rowIndex]?.[col.columnIndex];
        if (!cell || cell === '--' || cell === '-' || cell === '') continue;
        const value = parseFloat(cell);
        if (isNaN(value) || value <= 0) continue;
        rates[sz.normalizedSize] = value;
      }

      if (Object.keys(rates).length > 0) {
        result.push({
          columnKey: col.columnKey,
          columnLabel: col.columnHeader,
          sortOrder: i,
          rates,
        });
      }
    }

    return result;
  };

  const previewColumns = step >= 2 ? buildColumns() : [];
  const totalRates = previewColumns.reduce((sum, c) => sum + Object.keys(c.rates).length, 0);

  const handleImport = () => {
    if (previewColumns.length === 0) return;
    onImportColumns(previewColumns);
    handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setRawText('');
    setParseResult(null);
    setColumns([]);
    setSizes([]);
    onClose();
  };

  // Check for duplicate keys among enabled columns
  const enabledKeys = enabledColumns.map((c) => c.columnKey);
  const hasDuplicateKeys = new Set(enabledKeys).size !== enabledKeys.length;

  return (
    <Modal open={open} onClose={handleClose} title="Import Rate Table Columns" maxWidth={960} zIndex={300}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          {[
            { n: 1, label: 'Paste Data' },
            { n: 2, label: 'Select Columns' },
          ].map(({ n, label }) => (
            <div
              key={n}
              style={{
                flex: 1, padding: '6px 0', textAlign: 'center', fontSize: 11,
                fontWeight: step === n ? 600 : 400,
                color: step === n ? '#d4e3f3' : step > n ? '#3b82f6' : '#4a6a88',
                borderBottom: `2px solid ${step === n ? '#3b82f6' : step > n ? '#1f3450' : 'transparent'}`,
              }}
            >
              {n}. {label}
            </div>
          ))}
        </div>

        {/* ─── Step 1: Paste ─── */}
        {step === 1 && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: '#7a9ab5', lineHeight: 1.5 }}>
              Copy a productivity rate table from Excel, PDF, or a rate book and paste it below.
              The first row(s) should contain column headers. The first column should contain pipe sizes.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={'Size\tSchedule 40\tSchedule 80\tXH\t...\n1/2\t0.31\t0.35\t0.42\t...\n3/4\t0.44\t0.50\t0.58\t...'}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 200, padding: 12, fontSize: 12,
                fontFamily: 'monospace', borderRadius: 6,
                border: '1px solid #1f3450', backgroundColor: '#0d1a2a',
                color: '#d4e3f3', outline: 'none', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={handleClose} style={btnSecondary}>Cancel</button>
              <button
                type="button"
                onClick={handleParse}
                disabled={!rawText.trim()}
                style={rawText.trim() ? btnPrimary : btnDisabled}
              >
                Parse & Continue
              </button>
            </div>
          </>
        )}

        {/* ─── Step 2: Select Columns ─── */}
        {step === 2 && parseResult && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: '#7a9ab5' }}>
              {columns.length} columns and {sizes.length} sizes detected.
              Click any label or key to edit it. Uncheck columns you don't want.
            </p>

            {/* Column list */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <p style={{ ...labelStyle, margin: 0 }}>COLUMNS</p>
                <button type="button" onClick={() => handleSelectAllColumns(true)} style={{ ...btnSecondary, padding: '2px 8px', fontSize: 10 }}>All</button>
                <button type="button" onClick={() => handleSelectAllColumns(false)} style={{ ...btnSecondary, padding: '2px 8px', fontSize: 10 }}>None</button>
              </div>
              <div style={{
                maxHeight: 280, overflowY: 'auto', borderRadius: 6,
                border: '1px solid #1f3450', backgroundColor: '#0d1825',
              }}>
                {/* Header row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr 44px 180px',
                  gap: 8, padding: '6px 10px', borderBottom: '1px solid #1f3450',
                  backgroundColor: '#131f33',
                }}>
                  <span />
                  <span style={{ fontSize: 10, color: '#4a6a88', fontWeight: 600 }}>LABEL</span>
                  <span style={{ fontSize: 10, color: '#4a6a88', fontWeight: 600, textAlign: 'center' }}>N</span>
                  <span style={{ fontSize: 10, color: '#4a6a88', fontWeight: 600 }}>KEY</span>
                </div>
                {columns.map((col) => {
                  // Detect if this header appears more than once
                  const sameHeaderCols = columns.filter((c) => c.columnHeader === col.columnHeader);
                  const isDuplicateHeader = sameHeaderCols.length > 1;
                  const dupIndex = isDuplicateHeader ? sameHeaderCols.indexOf(col) + 1 : 0;
                  return (
                  <div
                    key={col.columnIndex}
                    style={{
                      display: 'grid', gridTemplateColumns: '28px 1fr 44px 180px',
                      gap: 8, alignItems: 'center',
                      padding: '4px 10px', borderBottom: '1px solid rgba(31,52,80,0.3)',
                      opacity: col.enabled ? 1 : 0.4,
                      backgroundColor: isDuplicateHeader ? 'rgba(251,191,36,0.04)' : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={col.enabled}
                      onChange={() => handleColumnToggle(col.columnIndex)}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      <input
                        type="text"
                        value={col.columnHeader}
                        onChange={(e) => handleLabelChange(col.columnIndex, e.target.value)}
                        disabled={!col.enabled}
                        style={{
                          flex: 1, minWidth: 0,
                          padding: '3px 6px', fontSize: 12, borderRadius: 4,
                          border: '1px solid transparent', backgroundColor: 'transparent',
                          color: col.enabled ? '#d4e3f3' : '#4a6a88',
                          outline: 'none',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = '#1f3450'; e.target.style.backgroundColor = '#0d1a2a'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
                      />
                      {isDuplicateHeader && (
                        <span style={{ fontSize: 9, color: '#fbbf24', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          #{dupIndex}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#4a6a88', textAlign: 'center' }}>
                      {col.rateCount}
                    </span>
                    <input
                      type="text"
                      value={col.columnKey}
                      onChange={(e) => handleKeyChange(col.columnIndex, e.target.value)}
                      disabled={!col.enabled}
                      placeholder="column_key"
                      style={{
                        padding: '3px 6px', fontSize: 11, borderRadius: 4, width: '100%',
                        border: '1px solid #1f3450', backgroundColor: '#0d1a2a',
                        color: col.enabled ? '#d4e3f3' : '#4a6a88', fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Size selection */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <p style={{ ...labelStyle, margin: 0 }}>SIZES</p>
                <button type="button" onClick={() => handleSelectAllSizes(true)} style={{ ...btnSecondary, padding: '2px 8px', fontSize: 10 }}>All</button>
                <button type="button" onClick={() => handleSelectAllSizes(false)} style={{ ...btnSecondary, padding: '2px 8px', fontSize: 10 }}>None</button>
              </div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflowY: 'auto',
                padding: 8, borderRadius: 6, border: '1px solid #1f3450', backgroundColor: '#0d1825',
              }}>
                {sizes.map((sz) => (
                  <label
                    key={sz.rowIndex}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                      backgroundColor: sz.enabled ? 'rgba(59,130,246,0.12)' : 'transparent',
                      color: sz.enabled ? '#d4e3f3' : '#4a6a88',
                      border: `1px solid ${sz.enabled ? 'rgba(59,130,246,0.3)' : 'rgba(31,52,80,0.3)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sz.enabled}
                      onChange={() => handleSizeToggle(sz.rowIndex)}
                      style={{ accentColor: '#3b82f6', width: 12, height: 12 }}
                    />
                    {sz.rawSize}
                  </label>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {hasDuplicateKeys && (
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                fontSize: 12, color: '#f87171',
              }}>
                Some enabled columns have duplicate key names. Each key must be unique.
              </div>
            )}

            {/* Summary */}
            <div style={{
              padding: '8px 12px', borderRadius: 6,
              backgroundColor: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
              fontSize: 12, color: '#94b3cc',
            }}>
              {previewColumns.length} columns x {enabledSizes.length} sizes = <strong style={{ color: '#d4e3f3' }}>{totalRates} rates</strong> to import
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setStep(1)} style={btnSecondary}>Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleClose} style={btnSecondary}>Cancel</button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={previewColumns.length === 0 || hasDuplicateKeys}
                  style={previewColumns.length > 0 && !hasDuplicateKeys ? btnPrimary : btnDisabled}
                >
                  Import {previewColumns.length} Columns ({totalRates} rates)
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
