import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import LeftSidebar from '../components/layout/LeftSidebar';
import RightPanel from '../components/layout/RightPanel';
import StatusBar from '../components/layout/StatusBar';
import PdfViewer from '../components/pdf/PdfViewer';
import FloatingRunTotals from '../components/piping/FloatingRunTotals';
import BranchConnectionMenu from '../components/piping/BranchConnectionMenu';
import AssemblyPalette from '../components/assembly/AssemblyPalette';
import PipingPalette from '../components/piping/PipingPalette';
import EquipmentPalette from '../components/equipment/EquipmentPalette';
import SaveAssemblyDialog from '../components/assembly/SaveAssemblyDialog';
import AssemblyManager from '../components/assembly/AssemblyManager';
import TraceoverSettings from '../components/settings/TraceoverSettings';
import { usePdfStore } from '../stores/usePdfStore';
import { useUiStore } from '../stores/useUiStore';
import { useToolStore } from '../stores/useToolStore';
import DropZone from '../components/ui/DropZone';
import { useTraceoverPersistence } from '../hooks/useTraceoverPersistence';

/**
 * Main traceover workspace page.
 * Full-screen layout with TopBar, LeftSidebar, canvas center, RightPanel, and StatusBar.
 * This page has its own layout (no Layout wrapper from the main app).
 */
export default function TraceoverWorkspace() {
  const { id: takeoffId } = useParams<{ id: string }>();
  const numericTakeoffId = takeoffId ? Number(takeoffId) : null;

  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const showAssemblyEditor = useUiStore((s) => s.showAssemblyEditor);
  const setShowAssemblyEditor = useUiStore((s) => s.setShowAssemblyEditor);
  const setTool = useToolStore((s) => s.setTool);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Persistence: hydrates stores from server on mount, auto-syncs changes back
  const { uploadDocument } = useTraceoverPersistence(numericTakeoffId);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        setTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool]);

  // File drag-and-drop for PDF upload
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  const handleFileDrop = useCallback(
    (files: File[]) => {
      const pdfFile = files.find((f) => f.type === 'application/pdf');
      if (pdfFile) {
        uploadDocument(pdfFile).catch(console.error);
      }
    },
    [uploadDocument],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);

      const files = Array.from(e.dataTransfer.files);
      handleFileDrop(files);
    },
    [handleFileDrop],
  );

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#0a1628',
        color: '#d4e3f3',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top bar */}
      <TopBar />

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left sidebar */}
        <LeftSidebar />

        {/* Center: PDF canvas */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {activeDocumentId ? (
            <PdfViewer />
          ) : (
            <div
              style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <DropZone
                onFileDrop={handleFileDrop}
                accept=".pdf"
                label="Drop a PDF drawing here or click to browse"
              />
              <p style={{ fontSize: 12, color: '#4a6a88' }}>
                Upload a construction drawing PDF to begin your traceover takeoff.
              </p>
            </div>
          )}

          {/* Floating overlays */}
          <FloatingRunTotals />
          <BranchConnectionMenu />

          {/* File drag overlay */}
          {isDraggingFile && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '2px dashed #3b82f6',
                borderRadius: 8,
                pointerEvents: 'none',
              }}
            >
              <p style={{ fontSize: 18, fontWeight: 600, color: '#3b82f6' }}>
                Drop PDF to open
              </p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <RightPanel />
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Floating palettes */}
      <PipingPalette />
      <EquipmentPalette />
      <AssemblyPalette />

      {/* Dialogs */}
      <SaveAssemblyDialog />
      <AssemblyManager
        open={showAssemblyEditor}
        onClose={() => setShowAssemblyEditor(false)}
      />
      <TraceoverSettings />
    </div>
  );
}
