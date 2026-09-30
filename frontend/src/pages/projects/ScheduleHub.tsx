import React, { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { scheduleSegmentsService } from '../../services/scheduleSegments';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import CostTypeSchedule from './CostTypeSchedule';
import '../../styles/SalesPipeline.css';

const ScheduleHub: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => projectsApi.getById(pid).then((r) => r.data),
  });

  const { data: segmentsData } = useQuery({
    queryKey: ['schedule-segments', pid],
    queryFn: () => scheduleSegmentsService.getSegments(pid),
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

  return (
    <div>
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

      <CostTypeSchedule
        projectId={pid}
        segments={segments}
        activeKeys={activeKeys}
        onSegmentUpdate={handleSegmentUpdate}
        onInitialize={() => initMutation.mutate()}
        initPending={initMutation.isPending}
        project={project}
      />
    </div>
  );
};

export default ScheduleHub;
