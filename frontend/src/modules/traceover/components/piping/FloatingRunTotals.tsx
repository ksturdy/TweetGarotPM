import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { useViewportStore } from '../../stores/useViewportStore';
import { MATERIAL_LABELS, JOINT_TYPE_LABELS } from '../../lib/piping/referenceData';

/**
 * HTML overlay (not Konva) positioned near the cursor showing running totals
 * for the active traceover. pointer-events: none so it doesn't block clicks.
 */
export default function FloatingRunTotals() {
  const activeTraceover = useTraceoverStore((s) => s.activeTraceover);
  const cursorX = useViewportStore((s) => s.cursorX);
  const cursorY = useViewportStore((s) => s.cursorY);
  const viewportScale = useViewportStore((s) => s.scale);
  const viewportX = useViewportStore((s) => s.x);
  const viewportY = useViewportStore((s) => s.y);

  if (!activeTraceover || activeTraceover.segments.length === 0) return null;

  const { segments, config, currentElevation } = activeTraceover;

  // Compute running totals
  let totalPixelLength = 0;
  let totalScaledLength = 0;
  let verticalPipe = 0;
  let elbow90 = 0;
  let elbow45 = 0;
  let teeCount = 0;
  const hasCalibration = segments.some((s) => s.unit !== 'px');
  const unit = hasCalibration
    ? (segments.find((s) => s.unit !== 'px')?.unit ?? 'ft')
    : 'px';

  let prevElevation = 0;
  for (const seg of segments) {
    totalPixelLength += seg.pixelLength;
    totalScaledLength += seg.scaledLength;
    if (seg.fitting === 'elbow_90') elbow90++;
    if (seg.fitting === 'elbow_45') elbow45++;
    if (seg.fitting === 'tee') teeCount++;

    // Elevation change adds vertical pipe + 2 elbows
    const elevDiff = Math.abs(seg.elevation - prevElevation);
    if (elevDiff > 0) {
      verticalPipe += elevDiff;
      elbow90 += 2;
    }
    prevElevation = seg.elevation;
  }

  const horizontalLength = hasCalibration ? totalScaledLength : totalPixelLength;
  const totalLength = horizontalLength + verticalPipe;
  const materialLabel = MATERIAL_LABELS[config.material];
  const sizeLabel = config.pipeSize.displayLabel;
  const jointLabel = segments[0]?.jointType
    ? JOINT_TYPE_LABELS[segments[0].jointType]
    : null;

  // Position the overlay near the cursor in screen coordinates
  const screenX = cursorX * viewportScale + viewportX + 24;
  const screenY = cursorY * viewportScale + viewportY + 24;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 50,
        pointerEvents: 'none',
        left: screenX,
        top: screenY,
      }}
    >
      <div
        style={{
          borderRadius: 8,
          border: '1px solid #1f3450',
          backgroundColor: 'rgba(19, 31, 51, 0.95)',
          padding: 12,
          fontSize: 12,
          backdropFilter: 'blur(4px)',
        }}
      >
        <div style={{ marginBottom: 6, fontWeight: 600, color: '#d4e3f3' }}>
          {sizeLabel} {materialLabel}
        </div>

        <div style={{ color: '#7a9ab5' }}>
          <div style={{ marginBottom: 2 }}>
            Length:{' '}
            <span style={{ color: '#d4e3f3' }}>
              {totalLength.toFixed(1)} {unit}
            </span>
            {verticalPipe > 0 && (
              <span style={{ color: '#4a6a88' }}>
                {' '}
                ({verticalPipe.toFixed(1)} vert)
              </span>
            )}
          </div>

          {elbow90 > 0 && (
            <div style={{ marginBottom: 2 }}>
              90&deg; Elbows:{' '}
              <span style={{ color: '#d4e3f3' }}>{elbow90}</span>
            </div>
          )}

          {elbow45 > 0 && (
            <div style={{ marginBottom: 2 }}>
              45&deg; Elbows:{' '}
              <span style={{ color: '#d4e3f3' }}>{elbow45}</span>
            </div>
          )}

          {teeCount > 0 && (
            <div style={{ marginBottom: 2 }}>
              Tees: <span style={{ color: '#d4e3f3' }}>{teeCount}</span>
            </div>
          )}

          {jointLabel && (
            <div style={{ marginBottom: 2 }}>
              Joint: <span style={{ color: '#d4e3f3' }}>{jointLabel}</span>
            </div>
          )}

          {currentElevation !== 0 && (
            <div>
              Elev: <span style={{ color: '#d4e3f3' }}>{currentElevation} ft</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
