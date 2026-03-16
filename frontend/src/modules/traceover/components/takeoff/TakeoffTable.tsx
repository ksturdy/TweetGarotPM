import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { usePdfStore } from '../../stores/usePdfStore';
import { useTakeoffStore } from '../../stores/useTakeoffStore';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { useToolStore } from '../../stores/useToolStore';
import { useUiStore } from '../../stores/useUiStore';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../types/takeoff';
import type { TakeoffItem } from '../../types/takeoff';

export default function TakeoffTable() {
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const items = useTakeoffStore((s) => s.items);
  const updateItem = useTakeoffStore((s) => s.updateItem);
  const removeItem = useTakeoffStore((s) => s.removeItem);
  const verifyItem = useTakeoffStore((s) => s.verifyItem);
  const removeRun = useTraceoverStore((s) => s.removeRun);
  const selectedItems = useToolStore((s) => s.selectedItems);
  const setShowManualAdd = useUiStore((s) => s.setShowManualAdd);

  const selectedRunIds = useMemo(
    () => selectedItems.filter((s) => s.type === 'traceover_run').map((s) => s.id),
    [selectedItems],
  );

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      if (item.traceoverRunId) {
        const siblings = items.filter(
          (i) => i.traceoverRunId === item.traceoverRunId && i.id !== itemId,
        );
        if (siblings.length === 0) {
          removeRun(item.traceoverRunId);
        }
      }

      removeItem(itemId);
    },
    [items, removeItem, removeRun],
  );

  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [qtyValue, setQtyValue] = useState('');

  const documentItems = useMemo(() => {
    if (!activeDocumentId) return [];
    return items.filter((item) => item.documentId === activeDocumentId);
  }, [items, activeDocumentId]);

  const handleQtyDoubleClick = useCallback(
    (itemId: string, currentQty: number) => {
      setEditingQty(itemId);
      setQtyValue(String(currentQty));
    },
    [],
  );

  const handleQtyBlur = useCallback(
    (itemId: string) => {
      const parsed = parseFloat(qtyValue);
      if (!isNaN(parsed) && parsed >= 0) {
        updateItem(itemId, { quantity: parsed });
      }
      setEditingQty(null);
    },
    [qtyValue, updateItem],
  );

  const handleQtyKeyDown = useCallback(
    (e: React.KeyboardEvent, itemId: string) => {
      if (e.key === 'Enter') handleQtyBlur(itemId);
      else if (e.key === 'Escape') setEditingQty(null);
    },
    [handleQtyBlur],
  );

  if (!activeDocumentId) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: '#7a9ab5' }}>
        Open a PDF to view the takeoff table.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: '#d4e3f3' }}>
          Takeoff Items ({documentItems.length})
        </h3>
        <button
          onClick={() => setShowManualAdd(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            fontSize: 11,
            borderRadius: 6,
            border: '1px solid #1f3450',
            backgroundColor: '#131f33',
            color: '#d4e3f3',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Add Manual Item
        </button>
      </div>

      {documentItems.length === 0 ? (
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
          No takeoff items yet. Use AI analysis or add items manually to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documentItems.map((item) => {
            const isHighlighted = !!(item.traceoverRunId && selectedRunIds.includes(item.traceoverRunId));
            return (
              <div
                key={item.id}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${isHighlighted ? '#3b82f6' : '#1f3450'}`,
                  backgroundColor: isHighlighted ? 'rgba(59, 130, 246, 0.1)' : '#131f33',
                  padding: 8,
                }}
              >
                {/* Row 1: Category + Label + Qty */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: 12,
                      padding: '2px 6px',
                      fontSize: 8,
                      fontWeight: 500,
                      backgroundColor: CATEGORY_COLORS[item.category] + '30',
                      color: CATEGORY_COLORS[item.category],
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: CATEGORY_COLORS[item.category],
                      }}
                    />
                    {CATEGORY_LABELS[item.category]}
                  </span>

                  <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: '#d4e3f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>

                  {editingQty === item.id ? (
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={qtyValue}
                      onChange={(e) => setQtyValue(e.target.value)}
                      onBlur={() => handleQtyBlur(item.id)}
                      onKeyDown={(e) => handleQtyKeyDown(e, item.id)}
                      style={{
                        width: 64,
                        borderRadius: 4,
                        border: '1px solid #3b82f6',
                        backgroundColor: '#0d1825',
                        padding: '2px 6px',
                        textAlign: 'right',
                        fontSize: 10,
                        color: '#d4e3f3',
                        outline: 'none',
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      style={{
                        cursor: 'pointer',
                        borderRadius: 4,
                        backgroundColor: '#0d1825',
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#6db3f8',
                      }}
                      onDoubleClick={() => handleQtyDoubleClick(item.id, item.quantity)}
                      title="Double-click to edit"
                    >
                      {item.quantity.toLocaleString()} {item.unit}
                    </span>
                  )}
                </div>

                {/* Row 2: Description + Size + Labor */}
                {(item.description || item.size || item.laborHours !== undefined) && (
                  <div style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 8, color: '#7a9ab5' }}>
                    {item.description && <span style={{ flex: 1 }}>{item.description}</span>}
                    {item.size && <span style={{ flexShrink: 0, color: '#4a6a88' }}>{item.size}</span>}
                    {item.laborHours != null ? (
                      <span style={{ flexShrink: 0, fontWeight: 500, color: '#34d399' }}>
                        {Number(item.laborHours).toFixed(1)} hrs
                      </span>
                    ) : item.laborHoursError ? (
                      <span style={{ flexShrink: 0, color: '#fbbf24' }} title={item.laborHoursError}>
                        No rate
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Row 3: Source + Verified + Delete */}
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      borderRadius: 4,
                      padding: '2px 4px',
                      fontSize: 7,
                      fontWeight: 600,
                      backgroundColor: item.source === 'ai' ? 'rgba(168, 85, 247, 0.15)' : item.source === 'traceover' ? 'rgba(16, 185, 129, 0.15)' : '#1f3450',
                      color: item.source === 'ai' ? '#c084fc' : item.source === 'traceover' ? '#34d399' : '#7a9ab5',
                    }}
                  >
                    {item.source === 'ai' ? 'AI' : item.source === 'traceover' ? 'Traceover' : 'Manual'}
                  </span>

                  <span style={{ fontSize: 7, color: '#4a6a88' }}>p.{item.pageNumber}</span>

                  <div style={{ flex: 1 }} />

                  <button
                    type="button"
                    onClick={() => verifyItem(item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.verified ? '#22c55e' : '#4a6a88', padding: 2 }}
                    title={item.verified ? 'Verified' : 'Mark as verified'}
                  >
                    {item.verified ? <CheckSquare size={13} /> : <Square size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a6a88', padding: 2 }}
                    title="Delete item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Total labor hours */}
          {documentItems.some((i) => i.laborHours !== undefined) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 8,
                border: '1px solid rgba(16, 185, 129, 0.3)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                padding: '10px 12px',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#34d399' }}>
                Total Labor Hours
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#6ee7b7' }}>
                {documentItems
                  .reduce((sum, i) => sum + Number(i.laborHours ?? 0), 0)
                  .toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
