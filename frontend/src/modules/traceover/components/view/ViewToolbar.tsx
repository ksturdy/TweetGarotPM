import { useEffect } from 'react';
import { Tags, Contrast, Highlighter } from 'lucide-react';
import IconButton from '../ui/IconButton';
import { useUiStore } from '../../stores/useUiStore';
import type { PipeServiceType } from '../../types/piping';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_COLORS } from '../../lib/piping/referenceData';

interface ViewToolbarProps {
  availableServiceTypes: PipeServiceType[];
}

export default function ViewToolbar({ availableServiceTypes }: ViewToolbarProps) {
  const showTags = useUiStore((s) => s.showTags);
  const toggleTags = useUiStore((s) => s.toggleTags);
  const drawingGreyscale = useUiStore((s) => s.drawingGreyscale);
  const toggleDrawingGreyscale = useUiStore((s) => s.toggleDrawingGreyscale);
  const drawingFade = useUiStore((s) => s.drawingFade);
  const setDrawingFade = useUiStore((s) => s.setDrawingFade);
  const pipeHighlight = useUiStore((s) => s.pipeHighlight);
  const togglePipeHighlight = useUiStore((s) => s.togglePipeHighlight);
  const pipeHighlightWidth = useUiStore((s) => s.pipeHighlightWidth);
  const setPipeHighlightWidth = useUiStore((s) => s.setPipeHighlightWidth);
  const hiddenServiceTypes = useUiStore((s) => s.hiddenServiceTypes);
  const toggleServiceVisibility = useUiStore((s) => s.toggleServiceTypeVisibility);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleTags();
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        toggleDrawingGreyscale();
        return;
      }
      if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        togglePipeHighlight();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTags, toggleDrawingGreyscale, togglePipeHighlight]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      <IconButton
        title={showTags ? 'Hide Tags (L)' : 'Show Tags (L)'}
        active={showTags}
        onClick={toggleTags}
      >
        <Tags size={18} />
      </IconButton>

      <IconButton
        title={drawingGreyscale ? 'Color Drawing (G)' : 'Greyscale Drawing (G)'}
        active={drawingGreyscale}
        onClick={toggleDrawingGreyscale}
      >
        <Contrast size={18} />
      </IconButton>

      <IconButton
        title={pipeHighlight ? 'Hide Pipe Highlight (Y)' : 'Show Pipe Highlight (Y)'}
        active={pipeHighlight}
        onClick={togglePipeHighlight}
      >
        <Highlighter size={18} />
      </IconButton>

      {/* Fade slider */}
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 6, padding: '0 4px' }}>
        <span style={{ fontSize: 10, color: '#7a9ab5', flexShrink: 0 }}>Fade</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(drawingFade * 100)}
          onChange={(e) => setDrawingFade(Number(e.target.value) / 100)}
          style={{ height: 4, width: '100%', cursor: 'pointer' }}
          title={`Drawing fade: ${Math.round(drawingFade * 100)}%`}
        />
      </div>

      {/* Glow size slider */}
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 6, padding: '0 4px' }}>
        <span style={{ fontSize: 10, color: '#7a9ab5', flexShrink: 0 }}>Glow</span>
        <input
          type="range"
          min={4}
          max={30}
          value={pipeHighlightWidth}
          onChange={(e) => setPipeHighlightWidth(Number(e.target.value))}
          style={{ height: 4, width: '100%', cursor: 'pointer' }}
          title={`Highlight width: ${pipeHighlightWidth}px`}
        />
      </div>

      {/* System Filter */}
      {availableServiceTypes.length > 0 && (
        <>
          <div style={{ height: 1, width: '100%', backgroundColor: '#1f3450', margin: '2px 0' }} />
          <p style={{ width: '100%', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a6a88', padding: '0 4px' }}>
            Systems
          </p>
          <div style={{ width: '100%', padding: '0 4px' }}>
            {availableServiceTypes.map((st) => {
              const isHidden = hiddenServiceTypes.has(st);
              const color = SERVICE_TYPE_COLORS[st];
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => toggleServiceVisibility(st)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '3px 4px',
                    fontSize: 11,
                    color: isHidden ? '#4a6a88' : '#d4e3f3',
                    opacity: isHidden ? 0.5 : 1,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: color,
                      opacity: isHidden ? 0.3 : 1,
                    }}
                  />
                  {SERVICE_TYPE_LABELS[st]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
