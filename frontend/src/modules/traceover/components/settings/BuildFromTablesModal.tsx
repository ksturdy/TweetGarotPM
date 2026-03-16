import { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import type { PipeSpec, RateTable } from '../../types/pipingSystem';
import {
  SYSTEM_FITTING_TYPE_LABELS,
  RATE_TABLE_CATEGORY_LABELS,
  type RateTableCategory,
  type SystemFittingType,
} from '../../types/pipingSystem';
import { useSettingsStore } from '../../stores/useSettingsStore';

// ─── Styles ───

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

// ─── Types ───

interface ColumnSelection {
  tableId: string;
  columnId: string;
  columnKey: string;
  columnLabel: string;
  tableName: string;
  enabled: boolean;
  targetField: 'fitting' | 'pipe';
  targetKey: string; // fitting type key
  rateCount: number;
}

// ─── Component ───

interface BuildFromTablesModalProps {
  open: boolean;
  onClose: () => void;
  spec: PipeSpec;
  onImportComplete: (updates: Partial<PipeSpec>) => void;
}

function keyToLabel(key: string): string {
  return SYSTEM_FITTING_TYPE_LABELS[key as SystemFittingType] ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BuildFromTablesModal({ open, onClose, spec, onImportComplete }: BuildFromTablesModalProps) {
  const rateTables = useSettingsStore((s) => s.rateTables);
  const [selections, setSelections] = useState<ColumnSelection[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize selections when modal opens
  if (open && !initialized) {
    const sels: ColumnSelection[] = [];
    for (const table of rateTables) {
      for (const col of table.columns) {
        const rateCount = Object.keys(col.rates).length;
        if (rateCount === 0) continue;
        // Auto-detect target field based on table category
        const isPipe = table.category === 'pipe';
        sels.push({
          tableId: table.id,
          columnId: col.id,
          columnKey: col.columnKey,
          columnLabel: col.columnLabel,
          tableName: table.name,
          enabled: false,
          targetField: isPipe ? 'pipe' : 'fitting',
          targetKey: col.columnKey,
          rateCount,
        });
      }
    }
    setSelections(sels);
    setInitialized(true);
  }

  // Reset when closing
  const handleClose = () => {
    setInitialized(false);
    setSelections([]);
    onClose();
  };

  const handleToggle = (columnId: string) => {
    setSelections((prev) =>
      prev.map((s) => (s.columnId === columnId ? { ...s, enabled: !s.enabled } : s)),
    );
  };

  const handleTargetKeyChange = (columnId: string, targetKey: string) => {
    setSelections((prev) =>
      prev.map((s) => (s.columnId === columnId ? { ...s, targetKey } : s)),
    );
  };

  const enabledSelections = selections.filter((s) => s.enabled);
  const totalRates = enabledSelections.reduce((sum, s) => sum + s.rateCount, 0);

  // Group selections by table
  const grouped = useMemo(() => {
    const map = new Map<string, { table: RateTable; sels: ColumnSelection[] }>();
    for (const sel of selections) {
      if (!map.has(sel.tableId)) {
        const table = rateTables.find((t) => t.id === sel.tableId);
        if (table) map.set(sel.tableId, { table, sels: [] });
      }
      map.get(sel.tableId)?.sels.push(sel);
    }
    return [...map.values()];
  }, [selections, rateTables]);

  const handleImport = () => {
    if (enabledSelections.length === 0) return;

    // Build the merged rates
    const fittingRates = { ...spec.fittingRates };
    const pipeRates = { ...spec.pipeRates };

    for (const sel of enabledSelections) {
      const table = rateTables.find((t) => t.id === sel.tableId);
      const col = table?.columns.find((c) => c.id === sel.columnId);
      if (!col) continue;

      if (sel.targetField === 'pipe') {
        for (const [size, value] of Object.entries(col.rates)) {
          pipeRates[size] = value;
        }
      } else {
        if (!fittingRates[sel.targetKey]) fittingRates[sel.targetKey] = {};
        for (const [size, value] of Object.entries(col.rates)) {
          fittingRates[sel.targetKey][size] = value;
        }
      }
    }

    onImportComplete({ fittingRates, pipeRates });
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Build from Rate Tables" maxWidth={800} zIndex={300}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {rateTables.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#7a9ab5' }}>
            No rate tables available. Create rate tables first in the Rate Tables tab, then come back to build specs from them.
          </p>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 12, color: '#7a9ab5', lineHeight: 1.5 }}>
              Select columns from your rate tables to import into this spec.
              Each column's rates will be mapped to the specified fitting type.
            </p>

            {/* Table groups */}
            <div style={{ maxHeight: 400, overflowY: 'auto', borderRadius: 6, border: '1px solid #1f3450' }}>
              {grouped.map(({ table, sels }) => (
                <div key={table.id}>
                  <div style={{
                    padding: '6px 12px',
                    fontSize: 11, fontWeight: 600, color: '#7a9ab5',
                    backgroundColor: '#0a1420',
                    borderBottom: '1px solid rgba(31,52,80,0.5)',
                  }}>
                    {table.name}
                    <span style={{ marginLeft: 6, fontSize: 9, color: '#4a6a88', fontWeight: 400 }}>
                      {RATE_TABLE_CATEGORY_LABELS[table.category as RateTableCategory] ?? table.category}
                    </span>
                  </div>
                  {sels.map((sel) => (
                    <div
                      key={sel.columnId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 12px', borderBottom: '1px solid rgba(31,52,80,0.3)',
                        backgroundColor: '#0d1825',
                        opacity: sel.enabled ? 1 : 0.5,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sel.enabled}
                        onChange={() => handleToggle(sel.columnId)}
                        style={{ accentColor: '#3b82f6' }}
                      />
                      <span style={{ fontSize: 12, color: '#d4e3f3', minWidth: 120 }}>
                        {sel.columnLabel}
                      </span>
                      <span style={{ fontSize: 10, color: '#4a6a88' }}>
                        ({sel.rateCount} rates)
                      </span>
                      <span style={{ fontSize: 11, color: '#4a6a88', marginLeft: 'auto' }}>→</span>
                      <input
                        type="text"
                        value={sel.targetKey}
                        onChange={(e) => handleTargetKeyChange(sel.columnId, e.target.value)}
                        style={{
                          padding: '3px 6px', fontSize: 11, borderRadius: 4, width: 130,
                          border: '1px solid #1f3450', backgroundColor: '#0d1a2a',
                          color: '#d4e3f3', fontFamily: 'monospace',
                        }}
                        title={keyToLabel(sel.targetKey)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{
              padding: '8px 12px', borderRadius: 6,
              backgroundColor: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
              fontSize: 12, color: '#94b3cc',
            }}>
              {enabledSelections.length} column{enabledSelections.length !== 1 ? 's' : ''} selected = <strong style={{ color: '#d4e3f3' }}>{totalRates} rates</strong> to import
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={handleClose} style={btnSecondary}>Cancel</button>
          <button
            type="button"
            onClick={handleImport}
            disabled={enabledSelections.length === 0}
            style={enabledSelections.length > 0 ? btnPrimary : btnDisabled}
          >
            Import {totalRates} Rates
          </button>
        </div>
      </div>
    </Modal>
  );
}
