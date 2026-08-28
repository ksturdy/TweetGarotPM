import React, { Suspense, useState, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, type Project } from '../../services/projects';
import {
  scheduleSegmentsService,
  type SchedulingMode,
} from '../../services/scheduleSegments';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import CostTypeSchedule from './CostTypeSchedule';
import '../../styles/SalesPipeline.css';

// Heavy components loaded on-demand
const PhaseSchedule = React.lazy(() => import('./PhaseSchedule'));
type TabKey = 'summary' | 'cost-type' | 'phase';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'summary',   label: 'Summary' },
  { key: 'cost-type', label: 'Cost Type' },
  { key: 'phase',     label: 'Phase' },
];

const MODE_LABELS: Record<SchedulingMode, string> = {
  summary:   'Summary',
  cost_type: 'Cost Type',
  phase:     'Phase',
};

const LABOR_TRADE_KEYS = new Set(['30', '35', '40', '45', '50', '55']);

// ─── Summary Tab ──────────────────────────────────────────────────────────────

interface SummaryTabProps {
  project: Project;
  activeKeys: string[];
  onModeChange: (mode: SchedulingMode) => void;
  modeChangePending: boolean;
  onGoToTab: (tab: TabKey) => void;
  onDateSave: (dates: { start_date?: string; end_date?: string }) => void;
}

const SummaryTab: React.FC<SummaryTabProps> = ({ project, activeKeys, onModeChange, modeChangePending, onGoToTab, onDateSave }) => {
  const mode = project.scheduling_mode ?? 'summary';
  const activeTrades = activeKeys.filter((k) => LABOR_TRADE_KEYS.has(k));
  const showMultiTradeBanner = activeTrades.length > 1 && mode === 'summary';
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem(`multi-trade-banner-${project.id}`) === '1'
  );

  // Use effective dates (vp_contracts > projects table > computed) as the displayed values.
  // These reflect what the forecasts actually use for this project.
  const toInputVal = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');
  const effectiveStart = project.effective_start_date ?? project.start_date;
  const effectiveEnd   = project.effective_end_date   ?? project.end_date;
  const [localStart, setLocalStart] = useState(() => toInputVal(effectiveStart));
  const [localEnd, setLocalEnd] = useState(() => toInputVal(effectiveEnd));

  // Re-sync when project data refreshes
  React.useEffect(() => { setLocalStart(toInputVal(project.effective_start_date ?? project.start_date)); }, [project.effective_start_date, project.start_date]);
  React.useEffect(() => { setLocalEnd(toInputVal(project.effective_end_date ?? project.end_date)); }, [project.effective_end_date, project.end_date]);

  const dismiss = () => {
    sessionStorage.setItem(`multi-trade-banner-${project.id}`, '1');
    setBannerDismissed(true);
  };

  const datesLocked = mode !== 'summary';
  const inputStyle: React.CSSProperties = {
    padding: '0.375rem 0.5rem', borderRadius: 6,
    fontSize: '0.875rem', color: datesLocked ? '#6b7280' : '#111827',
    background: datesLocked ? '#f3f4f6' : '#fff', width: 160,
    border: datesLocked ? '1px solid #e5e7eb' : '1px solid #d1d5db',
    cursor: datesLocked ? 'not-allowed' : 'text',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 700 }}>
      {/* Multi-trade banner */}
      {showMultiTradeBanner && !bannerDismissed && (
        <div style={{
          background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8,
          padding: '0.875rem 1rem', marginBottom: '1.5rem', display: 'flex',
          alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.1rem', marginTop: 2 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
              Multiple trades detected
            </div>
            <div style={{ color: '#78350f', fontSize: '0.875rem' }}>
              This project has labor for {activeTrades.length} trade code groups. Consider switching to{' '}
              <button
                onClick={() => { dismiss(); onGoToTab('cost-type'); }}
                style={{ background: 'none', border: 'none', color: '#d97706', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Cost Type scheduling
              </button>{' '}
              for more accurate revenue and labor forecasting.
            </div>
          </div>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.1rem', padding: 0 }}>✕</button>
        </div>
      )}

      {/* Project dates */}
      <div style={{ background: '#f9fafb', border: `1px solid ${datesLocked ? '#e5e7eb' : '#e5e7eb'}`, borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 600, color: '#374151' }}>Project Date Range</div>
          {datesLocked && (
            <span style={{ fontSize: '0.72rem', color: '#6b7280', background: '#e5e7eb', borderRadius: 4, padding: '0.15rem 0.5rem' }}>
              🔒 Locked — dates controlled by {mode === 'cost_type' ? 'Cost Type' : 'Phase'} tab
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>Start Date</label>
            <input
              type="date"
              value={localStart}
              disabled={datesLocked}
              onChange={(e) => setLocalStart(e.target.value)}
              onBlur={() => { if (!datesLocked && localStart !== toInputVal(effectiveStart)) onDateSave({ start_date: localStart || undefined }); }}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>End Date</label>
            <input
              type="date"
              value={localEnd}
              disabled={datesLocked}
              onChange={(e) => setLocalEnd(e.target.value)}
              onBlur={() => { if (!datesLocked && localEnd !== toInputVal(effectiveEnd)) onDateSave({ end_date: localEnd || undefined }); }}
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ marginTop: '0.625rem', fontSize: '0.75rem', color: '#6b7280' }}>
          {datesLocked
            ? `Switch back to Summary mode to edit these dates directly. The Labor Forecast will follow the ${mode === 'cost_type' ? 'Cost Type segment' : 'phase'} dates instead.`
            : project.effective_date_source === 'user_override'
            ? 'Dates synced with the Labor Forecast. Changes here update the contract schedule.'
            : project.effective_date_source === 'computed'
            ? 'End date estimated from contract value and % complete. Enter a date above to lock it.'
            : 'Changes here sync to the Labor Forecast schedule for this project.'}
        </div>
      </div>

      {/* Scheduling mode selector */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.25rem' }}>
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Forecast Scheduling Mode</div>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
          Controls which dates drive the revenue and labor forecasts for this project.
        </div>

        {(['summary', 'cost_type', 'phase'] as SchedulingMode[]).map((m) => {
          const isActive = mode === m;
          return (
            <label
              key={m}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.75rem', borderRadius: 6, marginBottom: '0.5rem', cursor: 'pointer',
                border: `1px solid ${isActive ? '#3b82f6' : '#e5e7eb'}`,
                background: isActive ? '#eff6ff' : '#fff',
              }}
            >
              <input
                type="radio"
                name="scheduling_mode"
                value={m}
                checked={isActive}
                disabled={modeChangePending}
                onChange={() => onModeChange(m)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{MODE_LABELS[m]}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {m === 'summary' && 'One start + end date for the entire project. Forecasts use the project record dates.'}
                  {m === 'cost_type' && 'Separate date windows per trade (Sheet Metal, Pipefitter, Plumbing) and non-labor cost type. Set dates on the Cost Type tab.'}
                  {m === 'phase' && 'Every phase item drives its own revenue and labor forecast window. Set dates on the Phase tab.'}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};


// ─── Schedule Hub (main) ──────────────────────────────────────────────────────

const ScheduleHub: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') || 'summary') as TabKey;
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();

  const setTab = (tab: TabKey) => setSearchParams({ tab }, { replace: true });

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => projectsApi.getById(pid).then((r) => r.data),
  });

  const { data: segmentsData } = useQuery({
    queryKey: ['schedule-segments', pid],
    queryFn: () => scheduleSegmentsService.getSegments(pid),
    enabled: activeTab === 'summary' || activeTab === 'cost-type',
  });

  const segments = segmentsData?.segments ?? [];
  const activeKeys = segmentsData?.activeKeys ?? [];

  // Mode change
  const modeMutation = useMutation({
    mutationFn: (mode: SchedulingMode) => projectsApi.updateSchedulingMode(pid, mode),
    onSuccess: (_, mode) => {
      queryClient.invalidateQueries({ queryKey: ['project', pid] });
      queryClient.invalidateQueries({ queryKey: ['schedule-segments', pid] });
      toast.success(`Scheduling mode updated to ${MODE_LABELS[mode]}`);
    },
    onError: () => toast.error('Failed to update scheduling mode'),
  });

  // Segment update (saves dates and/or contour_type on blur/change)
  const segmentMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: { start_date: string | null; end_date: string | null; contour_type?: string } }) =>
      scheduleSegmentsService.updateSegment(pid, key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-segments', pid] });
      queryClient.invalidateQueries({ queryKey: ['schedule-segment-costs', pid] });
    },
    onError: () => toast.error('Failed to save'),
  });

  const handleSegmentUpdate = useCallback(
    (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string }) => {
      segmentMutation.mutate({ key, data });
    },
    [segmentMutation]
  );

  // Save project start/end dates — writes to vp_contracts.user_adjusted_* AND projects table
  // so Labor Forecast and Schedule Hub stay in sync (same source of truth).
  const projectDateMutation = useMutation({
    mutationFn: (dates: { start_date?: string; end_date?: string }) =>
      projectsApi.updateSummaryDates(pid, dates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', pid] });
      toast.success('Project dates saved');
    },
    onError: () => toast.error('Failed to save project dates'),
  });

  // Initialize segments from project dates
  const initMutation = useMutation({
    mutationFn: () => scheduleSegmentsService.initialize(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-segments', pid] });
      toast.success('Segments initialized from project dates');
    },
    onError: () => toast.error('Failed to initialize segments'),
  });

  const mode = project?.scheduling_mode ?? 'summary';

  return (
    <div>
      {/* Page header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link
              to={`/projects/${pid}`}
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}
            >
              &larr; Back to Project
            </Link>
            <h1>Schedule</h1>
            <div className="sales-subtitle">{project?.name ?? ''}</div>
          </div>
        </div>
        {/* Active mode badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Forecast source:</span>
          <span style={{
            background: mode === 'phase' ? '#f0fdf4' : mode === 'cost_type' ? '#eff6ff' : '#f9fafb',
            color: mode === 'phase' ? '#166534' : mode === 'cost_type' ? '#1d4ed8' : '#374151',
            border: `1px solid ${mode === 'phase' ? '#bbf7d0' : mode === 'cost_type' ? '#bfdbfe' : '#e5e7eb'}`,
            borderRadius: 12, padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 600,
          }}>
            {MODE_LABELS[mode as SchedulingMode]}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb',
        padding: '0 1.5rem', background: '#fff',
      }}>
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '0.75rem 1.25rem',
                border: 'none',
                borderBottom: isActive ? '2px solid #1e3a5f' : '2px solid transparent',
                marginBottom: -2,
                background: 'transparent',
                color: isActive ? '#1e3a5f' : '#6b7280',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'summary' && project && (
        <SummaryTab
          project={project}
          activeKeys={activeKeys}
          onModeChange={(m) => modeMutation.mutate(m)}
          modeChangePending={modeMutation.isPending}
          onGoToTab={setTab}
          onDateSave={(dates) => projectDateMutation.mutate(dates)}
        />
      )}

      {activeTab === 'cost-type' && (
        <CostTypeSchedule
          projectId={pid}
          segments={segments}
          activeKeys={activeKeys}
          onSegmentUpdate={handleSegmentUpdate}
          onInitialize={() => initMutation.mutate()}
          initPending={initMutation.isPending}
        />
      )}

      {activeTab === 'phase' && (
        <>
          {mode === 'phase' && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '0.625rem 1rem', margin: '1rem 1.5rem 0',
              fontSize: '0.875rem', color: '#166534', fontWeight: 500,
            }}>
              ✓ Phase dates are driving the revenue and labor forecast for this project.
            </div>
          )}
          {/* Suppress the embedded component's own page header */}
          <div className="schedule-hub-embedded">
            <Suspense fallback={<div style={{ padding: '2rem', color: '#6b7280' }}>Loading phase schedule…</div>}>
              <PhaseSchedule />
            </Suspense>
          </div>
        </>
      )}

    </div>
  );
};

export default ScheduleHub;
