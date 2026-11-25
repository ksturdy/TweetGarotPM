import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { format, startOfWeek, addWeeks, subWeeks, addDays, parseISO, differenceInDays } from 'date-fns';
import { safetyVisitsApi } from '../../services/safetyVisits';
import type { SafetyVisit, ProjectWithPriority } from '../../services/safetyVisits';
import { safetyTeamApi } from '../../services/safetyTeamMembers';
import type { SafetyTeamMember } from '../../services/safetyTeamMembers';
import { teamsApi } from '../../services/teams';
import { departmentsApi } from '../../services/departments';
import { ProjectSidebarItem } from '../../components/safety/ProjectSidebarItem';
import { SafetyCalendarGrid } from '../../components/safety/SafetyCalendarGrid';
import { VisitReportDrawer } from '../../components/safety/VisitReportDrawer';
import ConfirmModal from '../../components/common/ConfirmModal';
import { SeriesScopeModal } from '../../components/safety/SeriesScopeModal';

class LeftClickOnlyPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) =>
        nativeEvent.button === 0,
    },
  ];
}


type ActiveItem =
  | { type: 'project'; data: ProjectWithPriority }
  | { type: 'visit'; data: SafetyVisit };

const SafetyCalendar: React.FC = () => {
  const qc = useQueryClient();
  const [windowStart, setWindowStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedVisit, setSelectedVisit] = useState<SafetyVisit | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [seriesDeleteVisit, setSeriesDeleteVisit] = useState<import('../../services/safetyVisits').SafetyVisit | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [openChecked, setOpenChecked] = useState(true);
  const [softClosedChecked, setSoftClosedChecked] = useState(true);
  const [hardClosedChecked, setHardClosedChecked] = useState(false);
  const [pctMax, setPctMax] = useState(100);
  const [visitsMax, setVisitsMax] = useState(20);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);

  const sensors = useSensors(useSensor(LeftClickOnlyPointerSensor, { activationConstraint: { distance: 5 } }));

  const windowEnd = addWeeks(windowStart, 6);
  const startStr = format(windowStart, 'yyyy-MM-dd');
  const endStr   = format(windowEnd, 'yyyy-MM-dd');

  const statuses = [
    ...(openChecked       ? ['Open']        : []),
    ...(softClosedChecked ? ['Soft-Closed']  : []),
    ...(hardClosedChecked ? ['Hard-Closed']  : []),
  ];
  const effectiveStatuses = statuses.length > 0 ? statuses : ['Open', 'Soft-Closed'];

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll().then(r => {
      const p = r.data as any;
      return Array.isArray(p) ? p : (p?.data ?? []);
    }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll().then(r => {
      const p = r.data as any;
      return Array.isArray(p) ? p : (p?.data ?? []);
    }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['safety-team-members'],
    queryFn: () => safetyTeamApi.getAll().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['safety-visit-projects', teamFilter, deptFilter, effectiveStatuses.join(',')],
    queryFn: () => safetyVisitsApi.getProjects({
      teamId:       teamFilter ? Number(teamFilter) : undefined,
      departmentId: deptFilter ? Number(deptFilter) : undefined,
      statuses:     effectiveStatuses,
    }).then(r => r.data),
  });

  const { data: visits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ['safety-visits', startStr, endStr],
    queryFn: () => safetyVisitsApi.getAll({ start: startStr, end: endStr }).then(r => r.data),
  });

  const filteredVisits = React.useMemo(() =>
    selectedMemberId ? visits.filter(v => v.assigned_to === selectedMemberId) : visits,
  [visits, selectedMemberId]);

  const memberColorMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of teamMembers as import('../../services/safetyTeamMembers').SafetyTeamMember[]) {
      if (m.color) map[m.user_id] = m.color;
    }
    return map;
  }, [teamMembers]);

  const visitCountByProject = React.useMemo(() => {
    const counts: Record<number, number> = {};
    for (const v of visits) {
      if (v.status !== 'cancelled' && v.scheduled_date) {
        counts[v.project_id] = (counts[v.project_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [visits]);

  const maxVisitsInWindow = React.useMemo(() =>
    Math.max(5, ...Object.values(visitCountByProject)),
  [visitCountByProject]);

  const sidebarProjects = React.useMemo(() =>
    projects.filter(p =>
      (p.percent_complete ?? 0) <= pctMax &&
      (visitCountByProject[p.id] ?? 0) <= visitsMax
    ),
  [projects, pctMax, visitsMax, visitCountByProject]);

  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof safetyVisitsApi.create>[0]) =>
      safetyVisitsApi.create(data).then(r => r.data),
    onSuccess: (newVisit) => {
      qc.invalidateQueries({ queryKey: ['safety-visits'] });
      qc.invalidateQueries({ queryKey: ['safety-visit-projects'] });
      setSelectedVisit(newVisit);
    },
  });

  const rescheduleMut = useMutation({
    mutationFn: ({ id, scheduledDate, endDate }: { id: number; scheduledDate: string; endDate: string | null }) =>
      safetyVisitsApi.reschedule(id, scheduledDate, endDate).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['safety-visits'] }),
  });

  const resizeMut = useMutation({
    mutationFn: ({ id, scheduledDate, endDate }: { id: number; scheduledDate: string; endDate: string }) =>
      safetyVisitsApi.reschedule(id, scheduledDate, endDate).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['safety-visits'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => safetyVisitsApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['safety-visits'] });
      qc.invalidateQueries({ queryKey: ['safety-visit-projects'] });
      if (selectedVisit?.id === id) setSelectedVisit(null);
      setConfirmDeleteId(null);
    },
  });

  const deleteSeriesForwardMut = useMutation({
    mutationFn: (visitId: number) => safetyVisitsApi.deleteSeriesForward(visitId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-visits'] }); setSeriesDeleteVisit(null); },
  });

  const deleteSeriesAllMut = useMutation({
    mutationFn: (seriesId: number) => safetyVisitsApi.deleteSeries(seriesId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-visits'] }); setSeriesDeleteVisit(null); },
  });

  const handleDeleteVisit = useCallback((visitId: number) => {
    const visit = visits.find(v => v.id === visitId);
    if (visit?.series_id) {
      setSeriesDeleteVisit(visit);
    } else {
      setConfirmDeleteId(visitId);
    }
  }, [visits]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith('project-')) {
      const projectId = parseInt(id.replace('project-', ''));
      const proj = projects.find(p => p.id === projectId);
      if (proj) setActiveItem({ type: 'project', data: proj });
    } else if (id.startsWith('visit-')) {
      const visitId = parseInt(id.replace('visit-', ''));
      const visit = visits.find(v => v.id === visitId);
      if (visit) setActiveItem({ type: 'visit', data: visit });
    }
  }, [projects, visits]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (!overId.startsWith('day-')) return;

    const dateStr = overId.replace('day-', '');

    if (activeId.startsWith('project-')) {
      const projectId = parseInt(activeId.replace('project-', ''));
      createMut.mutate({
        project_id:     projectId,
        scheduled_date: dateStr,
        status:         'proposed',
        visit_type:     'routine',
        assigned_to:    selectedMemberId ?? undefined,
      });
    } else if (activeId.startsWith('visit-')) {
      const visitId = parseInt(activeId.replace('visit-', ''));
      const visit = visits.find(v => v.id === visitId);
      if (!visit || visit.scheduled_date === dateStr) return;

      let newEndDate: string | null = null;
      if (visit.scheduled_date && visit.end_date) {
        const duration = differenceInDays(parseISO(visit.end_date), parseISO(visit.scheduled_date));
        newEndDate = format(addDays(parseISO(dateStr), duration), 'yyyy-MM-dd');
      }
      rescheduleMut.mutate({ id: visitId, scheduledDate: dateStr, endDate: newEndDate });
    }
  }, [visits, createMut, rescheduleMut, selectedMemberId]);

  const handleResizeVisit = useCallback((visitId: number, newEndDate: string) => {
    const visit = visits.find(v => v.id === visitId);
    if (!visit?.scheduled_date) return;
    resizeMut.mutate({ id: visitId, scheduledDate: visit.scheduled_date, endDate: newEndDate });
  }, [visits, resizeMut]);

  const handleVisitSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['safety-visits'] });
    qc.invalidateQueries({ queryKey: ['safety-visit-projects'] });
    setSelectedVisit(null);
  }, [qc]);

  const isLoading = loadingProjects || loadingVisits;

  const selectStyle: React.CSSProperties = {
    padding: '5px 10px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '12px',
    background: '#fff',
    color: '#374151',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ marginRight: '8px' }}>
          <Link to="/safety" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '12px', display: 'block', marginBottom: '2px' }}>
            ← Safety
          </Link>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>📅 Safety Calendar</div>
        </div>

        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
          <button
            onClick={() => setWindowStart(w => subWeeks(w, 6))}
            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', minWidth: '160px', textAlign: 'center' }}>
            {format(windowStart, 'MMM d')} – {format(addWeeks(windowStart, 5), 'MMM d, yyyy')}
          </span>
          <button
            onClick={() => setWindowStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            Today
          </button>
          <button
            onClick={() => setWindowStart(w => addWeeks(w, 6))}
            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            Next →
          </button>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        <Link
          to="/safety/team"
          style={{
            padding: '5px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: '#fff',
            color: '#374151',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          👥 Team Setup
        </Link>

        {/* Filters */}
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={selectStyle}>
          <option value="">All Teams</option>
          {(teams as any[]).filter(t => t.is_active !== false).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={selectStyle}>
          <option value="">All Depts</option>
          {(departments as any[]).map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {/* Status checkboxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#374151' }}>
          <span style={{ fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Status:</span>
          {[
            { label: 'Open', checked: openChecked, set: setOpenChecked },
            { label: 'Soft-Closed', checked: softClosedChecked, set: setSoftClosedChecked },
            { label: 'Hard-Closed', checked: hardClosedChecked, set: setHardClosedChecked },
          ].map(({ label, checked, set }) => (
            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '3px 8px', borderRadius: '5px', border: '1px solid #d1d5db', background: checked ? '#eff6ff' : '#fff', color: checked ? '#1d4ed8' : '#374151', fontWeight: checked ? 600 : 400 }}>
              <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} style={{ cursor: 'pointer' }} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ flexShrink: 0, display: 'flex', gap: '14px', padding: '5px 20px', background: '#fff', borderBottom: '1px solid #f3f4f6', fontSize: '11px', color: '#6b7280', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { dot: '#dc2626', label: 'Kickoff needed' },
          { dot: '#d97706', label: 'High (>2k hrs)' },
          { dot: '#2563eb', label: 'Medium' },
          { dot: '#6b7280', label: 'Low' },
        ].map(({ dot, label }) => (
          <span key={label}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dot, marginRight: '4px', verticalAlign: 'middle' }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: '8px', borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
          <strong>K</strong>=Kickoff <strong>R</strong>=Routine <strong>F</strong>=Follow-up
          &nbsp;· Drag project onto calendar · Drag bar to move · Drag right edge to resize
        </span>
        {projects.length > 0 && (
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#374151' }}>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Member filter chips */}
      {(
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 20px',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          overflowX: 'auto',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            Showing:
          </span>

          {/* All chip */}
          <button
            onClick={() => setSelectedMemberId(null)}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              border: `1.5px solid ${selectedMemberId === null ? '#002356' : '#d1d5db'}`,
              background: selectedMemberId === null ? '#002356' : '#fff',
              color: selectedMemberId === null ? '#fff' : '#374151',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            All
          </button>

          {/* Per-member chips */}
          {(teamMembers as SafetyTeamMember[]).map(m => {
            const initials = `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`.toUpperCase();
            const selected = selectedMemberId === m.user_id;
            return (
              <button
                key={m.user_id}
                onClick={() => setSelectedMemberId(selected ? null : m.user_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px 3px 4px',
                  borderRadius: '20px',
                  border: `1.5px solid ${selected ? '#1d4ed8' : '#d1d5db'}`,
                  background: selected ? '#eff6ff' : '#fff',
                  color: selected ? '#1d4ed8' : '#374151',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: m.color ?? '#6b7280',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 800,
                }}>
                  {initials}
                </span>
                {m.first_name}
              </button>
            );
          })}

          <div style={{ flex: 1 }} />
          <Link
            to="/safety/team"
            style={{ fontSize: '11px', color: '#6b7280', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Manage team →
          </Link>
        </div>
      )}

      {/* Main content */}
      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '14px' }}>
          Loading…
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveItem(null)}
          >
            {/* Left sidebar: project list */}
            <div style={{
              width: '380px',
              flexShrink: 0,
              borderRight: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              background: '#f9fafb',
              overflow: 'hidden',
            }}>
              {/* Collapsible filter toggle row */}
              <button
                onClick={() => setFiltersOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 12px',
                  border: 'none', borderBottom: '1px solid #e5e7eb',
                  background: filtersOpen ? '#eff6ff' : '#fff',
                  cursor: 'pointer', flexShrink: 0, textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: filtersOpen ? '#1d4ed8' : '#6b7280' }}>
                  ⚙ Filters
                </span>
                <span style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {pctMax < 100 && <span style={{ color: '#3b82f6', fontWeight: 700 }}>≤{pctMax}%</span>}
                  {visitsMax < maxVisitsInWindow && <span style={{ color: '#f97316', fontWeight: 700 }}>≤{visitsMax} visits</span>}
                  <span style={{ fontSize: '10px' }}>{filtersOpen ? '▲' : '▼'}</span>
                </span>
              </button>

              {/* Expanded filter sliders */}
              {filtersOpen && (
                <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '4px' }}>
                        <span>% Complete ≤</span>
                        <span style={{ color: '#374151' }}>{pctMax}%</span>
                      </div>
                      <input
                        type="range" min={0} max={100} step={5} value={pctMax}
                        onChange={e => setPctMax(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#d1d5db' }}>
                        <span>0%</span><span>100%</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '4px' }}>
                        <span>Visits ≤</span>
                        <span style={{ color: '#374151' }}>{visitsMax >= maxVisitsInWindow ? 'Any' : visitsMax}</span>
                      </div>
                      <input
                        type="range" min={0} max={maxVisitsInWindow} step={1} value={visitsMax}
                        onChange={e => setVisitsMax(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#f97316', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#d1d5db' }}>
                        <span>0</span><span>{maxVisitsInWindow}+</span>
                      </div>
                    </div>
                  </div>
                  {(pctMax < 100 || visitsMax < maxVisitsInWindow) && (
                    <button
                      onClick={() => { setPctMax(100); setVisitsMax(maxVisitsInWindow); }}
                      style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              )}

              {/* Header */}
              <div style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Priority Queue — drag to calendar</span>
                <span style={{ fontWeight: 400, color: '#9ca3af' }}>{sidebarProjects.length}</span>
              </div>

              {/* Project list */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {sidebarProjects.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                    No projects match current filters
                  </div>
                ) : (
                  sidebarProjects.map(p => (
                    <ProjectSidebarItem
                      key={p.id}
                      project={p}
                      visitCount={visitCountByProject[p.id] ?? 0}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right: 6-week calendar */}
            <SafetyCalendarGrid
              windowStart={windowStart}
              visits={filteredVisits}
              onVisitClick={setSelectedVisit}
              onResizeVisit={handleResizeVisit}
              onDeleteVisit={handleDeleteVisit}
              memberColorMap={memberColorMap}
            />

            {/* Drag overlay */}
            <DragOverlay dropAnimation={null}>
              {activeItem?.type === 'project' && (
                <div style={{
                  padding: '6px 12px',
                  background: '#002356',
                  color: '#fff',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  pointerEvents: 'none',
                }}>
                  📍 {activeItem.data.name}
                </div>
              )}
              {activeItem?.type === 'visit' && (
                <div style={{
                  padding: '4px 10px',
                  background: '#dbeafe',
                  border: '1px solid #93c5fd',
                  color: '#1d4ed8',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  pointerEvents: 'none',
                }}>
                  {activeItem.data.project_name}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      <VisitReportDrawer
        visit={selectedVisit}
        onClose={() => setSelectedVisit(null)}
        onSaved={handleVisitSaved}
      />

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Delete Visit"
        message={`Remove this scheduled visit from the calendar? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isPending={deleteMut.isPending}
        onConfirm={() => { if (confirmDeleteId !== null) deleteMut.mutate(confirmDeleteId); }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <SeriesScopeModal
        isOpen={seriesDeleteVisit !== null}
        mode="delete"
        isPending={deleteSeriesForwardMut.isPending || deleteSeriesAllMut.isPending || deleteMut.isPending}
        onJustThis={() => { if (seriesDeleteVisit) deleteMut.mutate(seriesDeleteVisit.id); setSeriesDeleteVisit(null); }}
        onThisAndFuture={() => { if (seriesDeleteVisit) deleteSeriesForwardMut.mutate(seriesDeleteVisit.id); }}
        onAll={() => { if (seriesDeleteVisit?.series_id) deleteSeriesAllMut.mutate(seriesDeleteVisit.series_id); }}
        onCancel={() => setSeriesDeleteVisit(null)}
      />
    </div>
  );
};

export default SafetyCalendar;
