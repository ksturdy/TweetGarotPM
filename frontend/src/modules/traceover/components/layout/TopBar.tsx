import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  FileOutput,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  PanelRightOpen,
  PanelRightClose,
  ArrowLeft,
  Settings,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import PageNavigator from '../pdf/PageNavigator';
import { usePdfStore } from '../../stores/usePdfStore';
import { useUiStore } from '../../stores/useUiStore';
import { useViewportStore } from '../../stores/useViewportStore';
import { useTakeoffStore } from '../../stores/useTakeoffStore';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { exportBomToXlsx } from '../../lib/export/xlsx';
import { exportBomToPdf } from '../../lib/export/pdf';
import { takeoffsApi } from '../../../../services/takeoffs';
import { useAuth } from '../../../../context/AuthContext';
import type { Takeoff } from '../../../../services/takeoffs';
import type { ProjectMetadata } from '../../lib/export/types';

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 6,
  border: 'none',
  backgroundColor: 'transparent',
  color: '#7a9ab5',
  cursor: 'pointer',
};

const btnSmStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 6,
  border: '1px solid #1f3450',
  backgroundColor: '#131f33',
  color: '#d4e3f3',
  cursor: 'pointer',
};

export default function TopBar() {
  const navigate = useNavigate();
  const { id: takeoffId } = useParams<{ id: string }>();
  const { tenant } = useAuth();

  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const documents = usePdfStore((s) => s.documents);
  const activeDoc = documents.find((d) => d.id === activeDocumentId);

  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const setShowSettings = useUiStore((s) => s.setShowSettings);

  const scale = useViewportStore((s) => s.scale);
  const zoomIn = useViewportStore((s) => s.zoomIn);
  const zoomOut = useViewportStore((s) => s.zoomOut);
  const resetZoom = useViewportStore((s) => s.resetZoom);

  const takeoffItems = useTakeoffStore((s) => s.items);
  const traceoverRuns = useTraceoverStore((s) => s.runs);
  const hasData = takeoffItems.length > 0;

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [takeoffData, setTakeoffData] = useState<Takeoff | null>(null);
  const [laborRate, setLaborRate] = useState<string>('');
  const laborRateSaveRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!takeoffId) return;
    takeoffsApi.getById(Number(takeoffId)).then(({ data }) => {
      setTakeoffData(data);
      setLaborRate(data.labor_rate_per_hour ? String(data.labor_rate_per_hour) : '');
    }).catch(() => {});
  }, [takeoffId]);

  const handleLaborRateChange = useCallback((value: string) => {
    setLaborRate(value);
    if (laborRateSaveRef.current) clearTimeout(laborRateSaveRef.current);
    laborRateSaveRef.current = setTimeout(() => {
      if (!takeoffId) return;
      const num = parseFloat(value) || 0;
      takeoffsApi.update(Number(takeoffId), { labor_rate_per_hour: num } as any).catch(() => {});
    }, 600);
  }, [takeoffId]);

  const takeoffName = takeoffData?.name || '';
  const laborRateNum = parseFloat(laborRate) || 0;

  const projectMetadata: ProjectMetadata | null = takeoffData
    ? {
        projectName: takeoffData.estimate_project_name || takeoffData.name,
        projectNumber: takeoffData.takeoff_number || undefined,
        date: takeoffData.created_at
          ? new Date(takeoffData.created_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })
          : undefined,
        estimatorName: takeoffData.created_by_name || undefined,
        tenantLogoUrl: tenant?.settings?.branding?.logo_url || undefined,
        laborRatePerHour: laborRateNum || undefined,
      }
    : null;

  const handleExportXlsx = useCallback(() => {
    if (takeoffItems.length === 0) return;
    exportBomToXlsx(takeoffItems, traceoverRuns, projectMetadata);
  }, [takeoffItems, traceoverRuns, projectMetadata]);

  const handleExportPdf = useCallback(() => {
    if (takeoffItems.length === 0) return;
    exportBomToPdf(takeoffItems, traceoverRuns, projectMetadata);
  }, [takeoffItems, traceoverRuns, projectMetadata]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  const title = takeoffName || 'Traceover Workspace';

  return (
    <div
      style={{
        display: 'flex',
        height: 48,
        flexShrink: 0,
        alignItems: 'center',
        borderBottom: '1px solid #1f3450',
        backgroundColor: '#0d1825',
        padding: '0 16px',
      }}
    >
      {/* Left: Back + document name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => navigate(takeoffId ? `/estimating/takeoffs/${takeoffId}` : '/estimating/takeoffs')}
          style={{ ...iconBtnStyle, width: 28, height: 28 }}
          title="Back to takeoff"
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{ width: 1, height: 20, backgroundColor: '#1f3450' }} />

        <span
          style={{
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 14,
            fontWeight: 500,
            color: '#d4e3f3',
          }}
        >
          {title}
        </span>
      </div>

      {/* Center: Page navigator */}
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <PageNavigator />
      </div>

      {/* Right: Zoom + Export + Right panel toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Zoom controls */}
        <button type="button" title="Zoom out" onClick={zoomOut} style={iconBtnStyle}>
          <ZoomOut size={16} />
        </button>
        <span style={{ minWidth: 48, textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#7a9ab5' }}>
          {Math.round(scale * 100)}%
        </span>
        <button type="button" title="Zoom in" onClick={zoomIn} style={iconBtnStyle}>
          <ZoomIn size={16} />
        </button>
        <button type="button" title="Fit to page" onClick={resetZoom} style={iconBtnStyle}>
          <Maximize size={16} />
        </button>

        <div style={{ width: 1, height: 24, backgroundColor: '#1f3450', margin: '0 8px' }} />

        {/* Labor rate input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label
            style={{ fontSize: 11, color: '#7a9ab5', whiteSpace: 'nowrap' }}
          >
            $/Hr
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={laborRate}
            onChange={(e) => handleLaborRateChange(e.target.value)}
            placeholder="0.00"
            style={{
              width: 64,
              height: 28,
              padding: '0 6px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid #1f3450',
              backgroundColor: '#131f33',
              color: '#d4e3f3',
              textAlign: 'right',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ width: 1, height: 24, backgroundColor: '#1f3450', margin: '0 8px' }} />

        {/* Export menu */}
        <div ref={exportMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={!hasData}
            style={{ ...btnSmStyle, opacity: hasData ? 1 : 0.5 }}
          >
            <FileOutput size={14} />
            Export
            <ChevronDown size={12} />
          </button>
          {exportMenuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                zIndex: 50,
                minWidth: 180,
                borderRadius: 8,
                border: '1px solid #1f3450',
                backgroundColor: '#131f33',
                padding: '4px 0',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              }}
            >
              <button
                type="button"
                onClick={() => { handleExportPdf(); setExportMenuOpen(false); }}
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
                <FileText size={14} style={{ color: '#3b82f6' }} />
                Export PDF Report
              </button>
              <button
                type="button"
                onClick={() => { handleExportXlsx(); setExportMenuOpen(false); }}
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
                <FileSpreadsheet size={14} style={{ color: '#10b981' }} />
                Export Excel (XLSX)
              </button>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 24, backgroundColor: '#1f3450', margin: '0 8px' }} />

        {/* Settings */}
        <button
          type="button"
          title="Traceover Settings"
          onClick={() => setShowSettings(true)}
          style={iconBtnStyle}
        >
          <Settings size={16} />
        </button>

        <div style={{ width: 1, height: 24, backgroundColor: '#1f3450', margin: '0 8px' }} />

        {/* Right panel toggle */}
        <button
          type="button"
          title={rightPanelOpen ? 'Close panel' : 'Open panel'}
          onClick={toggleRightPanel}
          style={iconBtnStyle}
        >
          {rightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>
    </div>
  );
}
