import { Trash2, Ruler, Square, Hash } from 'lucide-react';
import { usePdfStore } from '../../stores/usePdfStore';
import { useMeasurementStore } from '../../stores/useMeasurementStore';
import type { Measurement } from '../../types/measurement';

function formatValue(m: Measurement): string {
  if (m.type === 'count') return m.label || 'Count';
  if (m.scaledValue > 0) return `${m.scaledValue.toFixed(2)} ${m.unit}`;
  return `${m.pixelValue.toFixed(0)} px`;
}

function MeasurementIcon({ type }: { type: Measurement['type'] }) {
  switch (type) {
    case 'linear':
      return <Ruler size={14} />;
    case 'area':
      return <Square size={14} />;
    case 'count':
      return <Hash size={14} />;
  }
}

export default function MeasurementsPanel() {
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const activePageNumber = usePdfStore((s) => s.activePageNumber);
  const measurements = useMeasurementStore((s) => s.measurements);
  const removeMeasurement = useMeasurementStore((s) => s.removeMeasurement);
  const clearMeasurements = useMeasurementStore((s) => s.clearMeasurements);

  if (!activeDocumentId) return null;

  const pageMeasurements = measurements.filter(
    (m) => m.documentId === activeDocumentId && m.pageNumber === activePageNumber,
  );

  const linearCount = pageMeasurements.filter((m) => m.type === 'linear').length;
  const areaCount = pageMeasurements.filter((m) => m.type === 'area').length;
  const countCount = pageMeasurements.filter((m) => m.type === 'count').length;

  if (pageMeasurements.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#4a6a88', padding: '4px 0' }}>
        No measurements on this page
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#4a6a88', marginBottom: 4 }}>
        {linearCount > 0 && <span>{linearCount} linear</span>}
        {areaCount > 0 && <span>{areaCount} area</span>}
        {countCount > 0 && <span>{countCount} count</span>}
      </div>

      {/* List */}
      <div style={{ maxHeight: 192, overflowY: 'auto' }}>
        {pageMeasurements.map((m, i) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 12,
            }}
          >
            <span style={{ color: m.color }}>
              <MeasurementIcon type={m.type} />
            </span>
            <span style={{ color: '#7a9ab5', minWidth: 16, textAlign: 'right' }}>{i + 1}.</span>
            <span style={{ flex: 1, fontWeight: 500, color: '#d4e3f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatValue(m)}
            </span>
            <button
              type="button"
              onClick={() => removeMeasurement(m.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#4a6a88',
                padding: 2,
              }}
              title="Delete measurement"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Clear all */}
      <button
        type="button"
        onClick={() => clearMeasurements(activeDocumentId, activePageNumber)}
        style={{
          fontSize: 10,
          color: '#f87171',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
        }}
      >
        Clear all measurements
      </button>
    </div>
  );
}
