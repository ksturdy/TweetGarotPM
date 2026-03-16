import { useCallback, useMemo } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useBomStore } from '../../stores/useBomStore';
import { useTakeoffStore } from '../../stores/useTakeoffStore';
import { usePdfStore } from '../../stores/usePdfStore';
import { useToolStore } from '../../stores/useToolStore';
import { exportBomToCsv, downloadCsv } from '../../lib/export/csv';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../types/takeoff';
import type { BOMEntry, BOMSection } from '../../types/bom';
import type { ComponentCategory } from '../../types/takeoff';

export default function BomTable() {
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const items = useTakeoffStore((s) => s.items);
  const bomEntries = useBomStore((s) => s.bomEntries);
  const generateBom = useBomStore((s) => s.generateBom);

  const selectedItems = useToolStore((s) => s.selectedItems);
  const selectedRunIds = useMemo(
    () => selectedItems.filter((s) => s.type === 'traceover_run').map((s) => s.id),
    [selectedItems],
  );

  const documentItems = useMemo(() => {
    if (!activeDocumentId) return [];
    return items.filter((item) => item.documentId === activeDocumentId);
  }, [items, activeDocumentId]);

  const highlightedItemIds = useMemo(() => {
    if (selectedRunIds.length === 0) return new Set<string>();
    const runIdSet = new Set(selectedRunIds);
    return new Set(
      items
        .filter((item) => item.traceoverRunId && runIdSet.has(item.traceoverRunId))
        .map((item) => item.id),
    );
  }, [items, selectedRunIds]);

  const sections = useMemo((): BOMSection[] => {
    if (bomEntries.length === 0) return [];
    const groupMap = new Map<ComponentCategory, BOMEntry[]>();
    for (const entry of bomEntries) {
      const existing = groupMap.get(entry.category) ?? [];
      existing.push(entry);
      groupMap.set(entry.category, existing);
    }
    return Array.from(groupMap.entries()).map(([category, entries]) => ({
      category,
      label: CATEGORY_LABELS[category],
      entries,
      subtotalItems: entries.reduce((sum, e) => sum + e.quantity, 0),
    }));
  }, [bomEntries]);

  const handleGenerate = useCallback(() => {
    generateBom(documentItems);
  }, [generateBom, documentItems]);

  const handleExport = useCallback(() => {
    const csvContent = exportBomToCsv(bomEntries);
    downloadCsv(csvContent, 'bill-of-materials.csv');
  }, [bomEntries]);

  if (!activeDocumentId) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: '#7a9ab5' }}>
        Open a PDF to generate a Bill of Materials.
      </div>
    );
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: '#d4e3f3' }}>
          Bill of Materials
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={documentItems.length === 0}
            style={{ ...btnBase, backgroundColor: '#1e3a5f', color: '#fff', opacity: documentItems.length === 0 ? 0.5 : 1 }}
          >
            <RefreshCw size={14} />
            Generate BOM
          </button>
          {bomEntries.length > 0 && (
            <button onClick={handleExport} style={{ ...btnBase, backgroundColor: '#131f33', color: '#d4e3f3', border: '1px solid #1f3450' }}>
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {bomEntries.length === 0 && (
        <div
          style={{
            borderRadius: 8,
            border: '1px dashed #1f3450',
            backgroundColor: '#131f33',
            padding: 32,
            textAlign: 'center',
            fontSize: 14,
            color: '#7a9ab5',
          }}
        >
          {documentItems.length === 0
            ? 'Add takeoff items first, then generate a BOM.'
            : 'Click "Generate BOM" to aggregate takeoff items into a bill of materials.'}
        </div>
      )}

      {sections.map((section) => (
        <div key={section.category} style={{ overflow: 'hidden', borderRadius: 8, border: '1px solid #1f3450' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              fontSize: 10,
              fontWeight: 600,
              color: 'white',
              backgroundColor: CATEGORY_COLORS[section.category],
            }}
          >
            <span>{section.label}</span>
            <span style={{ opacity: 0.8 }}>{section.entries.length} line items</span>
          </div>

          <table style={{ width: '100%', textAlign: 'left', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f3450', backgroundColor: '#0d1825', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', color: '#4a6a88' }}>
                <th style={{ padding: '6px 8px' }}>Description</th>
                <th style={{ padding: '6px 8px' }}>Size</th>
                <th style={{ padding: '6px 8px' }}>Material</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '6px 8px' }}>Unit</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Hrs/Unit</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total Hrs</th>
                <th style={{ padding: '6px 8px' }}>Pages</th>
              </tr>
            </thead>
            <tbody>
              {section.entries.map((entry) => {
                const isHighlighted = highlightedItemIds.size > 0 &&
                  entry.sourceItemIds.some((id) => highlightedItemIds.has(id));
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #1f3450', backgroundColor: isHighlighted ? 'rgba(59, 130, 246, 0.1)' : '#131f33' }}>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 8px', fontWeight: 500, color: '#d4e3f3' }}>
                      {entry.description}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', padding: '6px 8px', color: '#7a9ab5' }}>{entry.size || '\u2014'}</td>
                    <td style={{ whiteSpace: 'nowrap', padding: '6px 8px', color: '#7a9ab5' }}>{entry.material || '\u2014'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, color: '#d4e3f3' }}>{entry.quantity.toLocaleString()}</td>
                    <td style={{ whiteSpace: 'nowrap', padding: '6px 8px', color: '#7a9ab5' }}>{entry.unit}</td>
                    <td style={{ whiteSpace: 'nowrap', padding: '6px 8px', textAlign: 'right', color: '#7a9ab5' }}>
                      {entry.laborHoursError
                        ? <span style={{ color: '#fbbf24' }} title={entry.laborHoursError}>ERR</span>
                        : entry.laborHoursPerUnit?.toFixed(1) ?? '\u2014'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', padding: '6px 8px', textAlign: 'right', fontWeight: 500, color: '#d4e3f3' }}>
                      {entry.laborHoursError
                        ? <span style={{ color: '#fbbf24' }} title={entry.laborHoursError}>ERR</span>
                        : entry.totalLaborHours?.toFixed(1) ?? '\u2014'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', padding: '6px 8px', fontSize: 10, color: '#4a6a88' }}>
                      {entry.pages.join(', ')}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: '#0d1825', fontWeight: 500 }}>
                <td colSpan={3} style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: '#4a6a88' }}>
                  Subtotal
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#d4e3f3' }}>
                  {section.subtotalItems.toLocaleString()}
                </td>
                <td />
                <td />
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#d4e3f3' }}>
                  {section.entries.reduce((sum, e) => sum + (e.totalLaborHours ?? 0), 0).toFixed(1)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {bomEntries.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            borderRadius: 8,
            border: '1px solid #1f3450',
            backgroundColor: '#0d1825',
            padding: '8px 12px',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', color: '#4a6a88', marginRight: 12 }}>
            Total Labor Hours
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#d4e3f3' }}>
            {bomEntries.reduce((sum, e) => sum + (e.totalLaborHours ?? 0), 0).toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}
