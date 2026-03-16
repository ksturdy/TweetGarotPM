import { Trash2 } from 'lucide-react';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { usePdfStore } from '../../stores/usePdfStore';
import { useTakeoffStore } from '../../stores/useTakeoffStore';
import { useUiStore } from '../../stores/useUiStore';
import { MATERIAL_LABELS, FITTING_TYPE_LABELS } from '../../lib/piping/referenceData';
import type { FittingType } from '../../types/piping';

export default function TraceoverRunsPanel() {
  const runs = useTraceoverStore((s) => s.runs);
  const removeRun = useTraceoverStore((s) => s.removeRun);
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const activePageNumber = usePdfStore((s) => s.activePageNumber);
  const takeoffItems = useTakeoffStore((s) => s.items);
  const removeItem = useTakeoffStore((s) => s.removeItem);
  const hiddenServiceTypes = useUiStore((s) => s.hiddenServiceTypes);

  if (!activeDocumentId) return null;

  const pageRuns = runs.filter(
    (r) => r.documentId === activeDocumentId && r.pageNumber === activePageNumber,
  );

  if (pageRuns.length === 0) return null;

  const handleDelete = (runId: string) => {
    const associated = takeoffItems.filter((item) => item.traceoverRunId === runId);
    for (const item of associated) {
      removeItem(item.id);
    }
    removeRun(runId);
  };

  return (
    <div>
      {pageRuns.map((run) => {
        const materialLabel = MATERIAL_LABELS[run.config.material];
        const sizeLabel = run.config.pipeSize.displayLabel;
        const isHidden = hiddenServiceTypes.has(run.config.serviceType);
        const hasCalibration = run.segments.some((s) => s.unit !== 'px');
        const horizontalLength = hasCalibration ? run.totalScaledLength : run.totalPixelLength;
        const totalLength = horizontalLength + run.verticalPipeLength;
        const unit = hasCalibration
          ? (run.segments.find((s) => s.unit !== 'px')?.unit ?? 'ft')
          : 'px';

        const fittings = (Object.entries(run.fittingCounts) as [FittingType, number][])
          .filter(([, count]) => count > 0);

        return (
          <div
            key={run.id}
            style={{
              borderRadius: 4,
              border: '1px solid #1f3450',
              backgroundColor: '#131f33',
              padding: 8,
              marginBottom: 8,
              opacity: isHidden ? 0.4 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#d4e3f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {run.config.label || `${sizeLabel} ${materialLabel}`}
                </p>
                <p style={{ fontSize: 10, color: '#4a6a88' }}>
                  {sizeLabel} {materialLabel}
                </p>
              </div>
              <button
                onClick={() => handleDelete(run.id)}
                style={{
                  flexShrink: 0,
                  borderRadius: 4,
                  padding: 4,
                  color: '#4a6a88',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                title="Delete run and its takeoff items"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 10, color: '#7a9ab5' }}>
              <span>{totalLength.toFixed(1)} {unit}</span>
              {fittings.map(([type, count]) => (
                <span key={type}>{count} {FITTING_TYPE_LABELS[type]}</span>
              ))}
              <span>{run.segments.length} seg</span>
            </div>

            <div
              style={{
                marginTop: 4,
                height: 4,
                width: '100%',
                borderRadius: 4,
                backgroundColor: run.config.color,
                opacity: 0.5,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
