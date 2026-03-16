import { useCallback } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { usePdfStore } from '../../stores/usePdfStore';
import type { BranchDirection } from '../../types/piping';

/**
 * Contextual popover shown when the user clicks near an existing traceover run.
 * Offers "Branch from Top" or "Branch from Bottom" to start a branch connection.
 */
export default function BranchConnectionMenu() {
  const showBranchMenu = useUiStore((s) => s.showBranchMenu);
  const branchMenuPosition = useUiStore((s) => s.branchMenuPosition);
  const branchSnapResult = useUiStore((s) => s.branchSnapResult);
  const closeBranchMenu = useUiStore((s) => s.closeBranchMenu);

  const startBranchTraceover = useTraceoverStore((s) => s.startBranchTraceover);
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const activePageNumber = usePdfStore((s) => s.activePageNumber);

  const handleBranch = useCallback(
    (direction: BranchDirection) => {
      if (!branchSnapResult || !activeDocumentId) return;

      const offset = direction === 'top' ? -10 : 10;
      const connectionPoint = {
        x: branchSnapResult.connectionPoint.x,
        y: branchSnapResult.connectionPoint.y + offset,
      };

      startBranchTraceover(
        branchSnapResult.runId,
        branchSnapResult.segmentId,
        connectionPoint,
        direction,
        activeDocumentId,
        activePageNumber,
      );

      closeBranchMenu();
    },
    [
      branchSnapResult,
      activeDocumentId,
      activePageNumber,
      startBranchTraceover,
      closeBranchMenu,
    ],
  );

  if (!showBranchMenu || !branchMenuPosition) return null;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 50,
        left: branchMenuPosition.x,
        top: branchMenuPosition.y,
      }}
    >
      <div
        style={{
          minWidth: 160,
          borderRadius: 8,
          border: '1px solid #1f3450',
          backgroundColor: '#131f33',
          paddingTop: 4,
          paddingBottom: 4,
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
      >
        <p
          style={{
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#4a6a88',
            margin: 0,
          }}
        >
          Branch Connection
        </p>
        <button
          onClick={() => handleBranch('top')}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#d4e3f3',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <ArrowUp size={14} color="#3b82f6" />
          Branch from Top
        </button>
        <button
          onClick={() => handleBranch('bottom')}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#d4e3f3',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <ArrowDown size={14} color="#3b82f6" />
          Branch from Bottom
        </button>
        <div style={{ borderTop: '1px solid #1f3450' }} />
        <button
          onClick={closeBranchMenu}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#7a9ab5',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  );
}
