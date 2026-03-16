import { useCallback } from 'react';
import { usePdfStore } from '../../stores/usePdfStore';
import { useMeasurementStore } from '../../stores/useMeasurementStore';
import { useViewportStore } from '../../stores/useViewportStore';
import {
  getScaleRatio,
  SCALE_PRESETS,
  presetToPixelsPerFoot,
} from '../../lib/measurement/scale';
import { generateId } from '../../lib/utils/idGen';

export default function StatusBar() {
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const activePageNumber = usePdfStore((s) => s.activePageNumber);
  const getCalibrationForPage = useMeasurementStore((s) => s.getCalibrationForPage);
  const setCalibration = useMeasurementStore((s) => s.setCalibration);

  const cursorX = useViewportStore((s) => s.cursorX);
  const cursorY = useViewportStore((s) => s.cursorY);
  const scale = useViewportStore((s) => s.scale);

  const calibration =
    activeDocumentId
      ? getCalibrationForPage(activeDocumentId, activePageNumber)
      : null;

  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const idx = parseInt(e.target.value, 10);
      if (isNaN(idx) || !activeDocumentId) return;

      const preset = SCALE_PRESETS[idx];
      const pixelsPerFoot = presetToPixelsPerFoot(preset);
      const origin = { x: 0, y: 0 };

      setCalibration({
        id: generateId(),
        pageNumber: activePageNumber,
        documentId: activeDocumentId,
        startPoint: origin,
        endPoint: { x: pixelsPerFoot, y: 0 },
        pixelDistance: pixelsPerFoot,
        realDistance: 1,
        unit: 'ft',
        pixelsPerUnit: pixelsPerFoot,
        createdAt: new Date(),
      });
    },
    [activeDocumentId, activePageNumber, setCalibration],
  );

  return (
    <div
      style={{
        display: 'flex',
        height: 28,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #1f3450',
        backgroundColor: '#0d1825',
        padding: '0 16px',
        fontSize: 11,
        color: '#4a6a88',
      }}
    >
      {/* Left: Cursor position */}
      <span>X: {Math.round(cursorX)}, Y: {Math.round(cursorY)}</span>

      {/* Center: Scale */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {calibration ? (
          <span style={{ fontWeight: 500, color: '#6db3f8' }}>
            Scale: {getScaleRatio(calibration)}
          </span>
        ) : (
          <span style={{ color: '#7a5a2e' }}>No scale set</span>
        )}
        {activeDocumentId && (
          <select
            value=""
            onChange={handlePresetChange}
            style={{
              borderRadius: 4,
              border: '1px solid #1f3450',
              backgroundColor: '#131f33',
              padding: '2px 6px',
              fontSize: 10,
              color: '#7a9ab5',
              outline: 'none',
            }}
          >
            <option value="" disabled>
              Set scale...
            </option>
            <optgroup label="Architectural">
              {SCALE_PRESETS.filter((p) => p.group === 'architectural').map((p) => {
                const globalIdx = SCALE_PRESETS.indexOf(p);
                return (
                  <option key={globalIdx} value={globalIdx}>
                    {p.label}
                  </option>
                );
              })}
            </optgroup>
            <optgroup label="Engineering">
              {SCALE_PRESETS.filter((p) => p.group === 'engineering').map((p) => {
                const globalIdx = SCALE_PRESETS.indexOf(p);
                return (
                  <option key={globalIdx} value={globalIdx}>
                    {p.label}
                  </option>
                );
              })}
            </optgroup>
          </select>
        )}
      </div>

      {/* Right: Zoom percentage */}
      <span>{Math.round(scale * 100)}%</span>
    </div>
  );
}
