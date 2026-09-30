import React, { Suspense, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { scheduleSegmentsService, type SchedulingMode } from '../../services/scheduleSegments';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import CostTypeSchedule from './CostTypeSchedule';
import '../../styles/SalesPipeline.css';

const PhaseSchedule = React.lazy(() => import('./PhaseSchedule'));

type TabKey = 'cost-type' | 'phase';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'cost-type', label: 'Cost Type' },
  { key: 'phase',     label: 'Phase' },
];

const MODE_LABELS: Record<SchedulingMode, string> = {
  summary:   'Summary',
  cost_type: 'Cost Type',
  phase:     'Phase',
};

const ScheduleHub: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') || 'cost-type') as TabKey;
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
    enabled: activeTab === 'cost-type',
  });

  const segments = segmentsData?.segments ?? [];
  const activeKeys = segmentsData?.activeKeys ?? [];

  const segmentMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: { start_date: string | null; end_date: string | null; contour_type?: string; weekly_hours?: number | null } }) =>
      scheduleSegmentsService.updateSegment(pid, key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-segments', pid] });
      queryClient.invalidateQueries({ queryKey: ['schedule-segment-costs', pid] });
      queryClient.invalidateQueries({ queryKey: ['bulkSegments'] });
    },
    onError: () => toast.error('Failed to save'),
  });

  const handleSegmentUpdate = useCallback(
    (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string; weekly_hours?: number | null }) => {
      segmentMutation.mutate({ key, data });
    },
    [segmentMutation]
  );

  const initMutation = useMutation({
    mutationFn: () => scheduleSegmentsService.initialize(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-segments', pid] });
      toast.success('Segments initialized from project dates');
    },
    onError: () => toast.error('Failed to initialize segments'),
  });

  const mode = project?.scheduling_mode ?? 'cost_type';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          <a
            href="/TITAN_Project_Scheduling_Guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="sales-btn sales-btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Scheduling Guide
          </a>
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

      {/* Cost Type tab */}
      {activeTab === 'cost-type' && (
        <CostTypeSchedule
          projectId={pid}
          segments={segments}
          activeKeys={activeKeys}
          onSegmentUpdate={handleSegmentUpdate}
          onInitialize={() => initMutation.mutate()}
          initPending={initMutation.isPending}
          project={project}
        />
      )}

      {/* Phase tab */}
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
