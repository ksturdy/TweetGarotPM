import { useState, useCallback } from 'react';
import Modal from '../ui/Modal';
import type { PipeSpec } from '../../types/pipingSystem';
import { SYSTEM_FITTING_TYPE_LABELS } from '../../types/pipingSystem';
import { pipeSpecsApi } from '../../../../services/pipeSpecs';
import {
  parseTabSeparatedText,
  analyzeGrid,
  buildRates,
  getFittingTypeOptions,
  type ColumnMapping,
  type SizeRow,
  type ParseResult,
  type ParsedRate,
} from '../../lib/piping/rateImportParser';

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

interface RateImportModalProps {
  open: boolean;
  onClose: () => void;
  spec: PipeSpec;
  onImportComplete: (newFittingRates: PipeSpec['fittingRates']) => void;
}

export default function RateImportModal({ open, onClose, spec, onImportComplete }: RateImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columns, setColumns] = useState<ColumnMapping[]>([]);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const fittingTypeOptions = getFittingTypeOptions();

  const handleParse = useCallback(() => {
    const grid = parseTabSeparatedText(rawText);
    if (grid.length < 2) return;
    const result = analyzeGrid(grid);
    setParseResult(result);
    setColumns(result.columns);
    setSizes(result.sizes);
    setStep(2);
  }, [rawText]);

  const handleColumnToggle = (colIndex: number) => {
    setColumns((prev) =>
      prev.map((c) => (c.columnIndex === colIndex ? { ...c, enabled: !c.enabled } : c)),
    );
  };

  const handleColumnTypeChange = (colIndex: number, fittingType: string | null) => {
    setColumns((prev) =>
      prev.map((c) =>
        c.columnIndex === colIndex
          ? { ...c, fittingType, enabled: fittingType !== null && fittingType !== '', autoDetected: false }
          : c,
      ),
    );
  };

  const handleCustomTypeInput = (colIndex: number, customName: string) => {
    // Normalize to snake_case key: "Y-Strainer" → "y_strainer"
    const key = customName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    setColumns((prev) =>
      prev.map((c) =>
        c.columnIndex === colIndex
          ? { ...c, fittingType: key || null, enabled: key !== '', autoDetected: false }
          : c,
      ),
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

  const enabledColumns = columns.filter((c) => c.enabled && c.fittingType);
  const enabledSizes = sizes.filter((s) => s.enabled);

  // Get a sample numeric value from a column (for display in column mapping UI)
  const getSampleValue = useCallback(
    (colIndex: number): string | null => {
      if (!parseResult) return null;
      for (const sz of sizes) {
        const cell = parseResult.grid[sz.rowIndex]?.[colIndex];
        if (cell && cell !== '' && !isNaN(parseFloat(cell))) return cell;
      }
      return null;
    },
    [parseResult, sizes],
  );

  const previewRates: ParsedRate[] =
    parseResult && step >= 2 ? buildRates(parseResult.grid, columns, sizes) : [];

  const handleImport = useCallback(async () => {
    if (!parseResult || previewRates.length === 0) return;
    setImporting(true);
    setImportError(null);

    try {
      const specNumId = Number(spec.id);
      await pipeSpecsApi.updateFittingRates(specNumId, previewRates);

      // Merge imported rates into local fittingRates object
      const merged = { ...spec.fittingRates };
      for (const r of previewRates) {
        if (!merged[r.fitting_type]) merged[r.fitting_type] = {};
        merged[r.fitting_type][r.pipe_size] = r.hours_per_unit;
      }

      setImportedCount(previewRates.length);
      onImportComplete(merged);
      setStep(1);
      setRawText('');
      setParseResult(null);
      onClose();
    } catch (err: any) {
      // Extract the most useful error message
      const serverMsg = err?.response?.data?.error;
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      let msg = serverMsg || err?.message || 'Import failed';
      if (detail) msg += ` — ${detail}`;
      if (status) msg = `[${status}] ${msg}`;
      setImportError(msg);
    } finally {
      setImporting(false);
    }
  }, [parseResult, previewRates, spec, onImportComplete, onClose]);

  const handleClose = () => {
    setStep(1);
    setRawText('');
    setParseResult(null);
    setImportError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import Productivity Rates" maxWidth={900} zIndex={300}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          {[
            { n: 1, label: 'Paste Data' },
            { n: 2, label: 'Select & Map' },
            { n: 3, label: 'Preview & Import' },
          ].map(({ n, label }) => (
            <div
              key={n}
              style={{
                flex: 1,
                padding: '6px 0',
                textAlign: 'center',
                fontSize: 11,
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
              The first row should contain column headers (fitting type names).
              The first column should contain pipe sizes.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={'Dia. In.\tBlind\tLap Joint\tSlip-On\t...\n1/2\t0.31\t0.31\t0.69\t...\n3/4\t0.44\t0.44\t1.01\t...'}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 200,
                padding: 12,
                fontSize: 12,
                fontFamily: 'monospace',
                borderRadius: 6,
                border: '1px solid #1f3450',
                backgroundColor: '#0d1a2a',
                color: '#d4e3f3',
                outline: 'none',
                resize: 'vertical',
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

        {/* ─── Step 2: Select & Map ─── */}
        {step === 2 && parseResult && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: '#7a9ab5' }}>
              {columns.length} columns and {sizes.length} sizes detected.
              Select which columns and sizes to import, and map each column to a fitting type.
            </p>

            {/* Column mappings */}
            <div>
              <p style={{ ...labelStyle, marginBottom: 6 }}>COLUMNS</p>
              <div style={{
                maxHeight: 240, overflowY: 'auto', borderRadius: 6,
                border: '1px solid #1f3450', backgroundColor: '#0d1825',
              }}>
                {columns.map((col) => (
                  <div
                    key={col.columnIndex}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px',
                      borderBottom: '1px solid rgba(31,52,80,0.3)',
                      opacity: col.enabled ? 1 : 0.4,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={col.enabled}
                      onChange={() => handleColumnToggle(col.columnIndex)}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <span style={{
                      flex: 1, fontSize: 12, color: '#d4e3f3',
                      fontFamily: 'monospace', minWidth: 120,
                    }}>
                      {col.columnHeader || `Column ${col.columnIndex + 1}`}
                      {!col.columnHeader && (() => {
                        const sample = getSampleValue(col.columnIndex);
                        return sample ? (
                          <span style={{ color: '#4a6a88', fontSize: 10, marginLeft: 4 }}>(e.g. {sample})</span>
                        ) : null;
                      })()}
                    </span>
                    <span style={{ fontSize: 11, color: '#4a6a88', marginRight: 4 }}>→</span>
                    {(() => {
                      const isCustom = col.fittingType !== null && col.fittingType !== '' &&
                        !fittingTypeOptions.some((opt) => opt.value === col.fittingType);
                      const selectValue = isCustom ? '__custom__' : (col.fittingType ?? '');
                      return (
                        <>
                          <select
                            value={selectValue}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '__custom__') {
                                handleColumnTypeChange(col.columnIndex, col.columnHeader.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom');
                              } else {
                                handleColumnTypeChange(col.columnIndex, v || null);
                              }
                            }}
                            style={{
                              padding: '4px 6px', fontSize: 11, borderRadius: 4,
                              border: '1px solid #1f3450', backgroundColor: '#0d1a2a',
                              color: col.fittingType ? '#d4e3f3' : '#4a6a88',
                              minWidth: 140,
                            }}
                          >
                            <option value="">— Skip —</option>
                            {fittingTypeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                            <option value="__custom__">— Custom —</option>
                          </select>
                          {isCustom && (
                            <input
                              type="text"
                              defaultValue={col.fittingType ?? ''}
                              onBlur={(e) => handleCustomTypeInput(col.columnIndex, e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              placeholder="type_name"
                              style={{
                                padding: '3px 6px', fontSize: 11, borderRadius: 4, width: 100,
                                border: '1px solid #1f3450', backgroundColor: '#0d1a2a',
                                color: '#d4e3f3', fontFamily: 'monospace',
                              }}
                            />
                          )}
                          {col.autoDetected && !isCustom && (
                            <span style={{ fontSize: 9, color: '#3b82f6', whiteSpace: 'nowrap' }}>auto</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>

            {/* Size selection */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <p style={{ ...labelStyle, margin: 0 }}>SIZES</p>
                <button
                  type="button"
                  onClick={() => handleSelectAllSizes(true)}
                  style={{ ...btnSecondary, padding: '2px 8px', fontSize: 10 }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAllSizes(false)}
                  style={{ ...btnSecondary, padding: '2px 8px', fontSize: 10 }}
                >
                  None
                </button>
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

            {/* Summary */}
            <div style={{
              padding: '8px 12px', borderRadius: 6,
              backgroundColor: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
              fontSize: 12, color: '#94b3cc',
            }}>
              {enabledColumns.length} columns x {enabledSizes.length} sizes = <strong style={{ color: '#d4e3f3' }}>{previewRates.length} rates</strong> to import
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setStep(1)} style={btnSecondary}>Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleClose} style={btnSecondary}>Cancel</button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={previewRates.length === 0}
                  style={previewRates.length > 0 ? btnPrimary : btnDisabled}
                >
                  Preview ({previewRates.length})
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── Step 3: Preview & Import ─── */}
        {step === 3 && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: '#7a9ab5' }}>
              Review the rates below. Existing rates for the same fitting type and size will be updated.
            </p>

            <div style={{
              maxHeight: 360, overflowY: 'auto', borderRadius: 6,
              border: '1px solid #1f3450',
            }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr style={{ backgroundColor: '#131f33' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#7a9ab5', fontWeight: 500, borderBottom: '1px solid #1f3450' }}>
                      Fitting Type
                    </th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#7a9ab5', fontWeight: 500, borderBottom: '1px solid #1f3450' }}>
                      Size
                    </th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', color: '#7a9ab5', fontWeight: 500, borderBottom: '1px solid #1f3450' }}>
                      Hrs/Each
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRates.map((r, i) => (
                    <tr key={`${r.fitting_type}-${r.pipe_size}`} style={{ backgroundColor: i % 2 === 0 ? '#0d1825' : '#0f1b2d' }}>
                      <td style={{ padding: '4px 10px', color: '#d4e3f3' }}>
                        {SYSTEM_FITTING_TYPE_LABELS[r.fitting_type as keyof typeof SYSTEM_FITTING_TYPE_LABELS] ??
                          r.fitting_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </td>
                      <td style={{ padding: '4px 10px', color: '#94b3cc', fontFamily: 'monospace' }}>
                        {r.pipe_size}
                      </td>
                      <td style={{ padding: '4px 10px', color: '#60a5fa', textAlign: 'right', fontFamily: 'monospace' }}>
                        {r.hours_per_unit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importError && (
              <div style={{
                padding: '10px 14px', borderRadius: 6,
                backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                fontSize: 12, color: '#ef4444', lineHeight: 1.5, wordBreak: 'break-word',
              }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>Import failed</strong>
                {importError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setStep(2)} style={btnSecondary}>Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleClose} style={btnSecondary}>Cancel</button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || previewRates.length === 0}
                  style={importing ? btnDisabled : btnPrimary}
                >
                  {importing ? 'Importing...' : `Import ${previewRates.length} Rates`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
