import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { safetyVisitsApi } from '../../services/safetyVisits';
import type { SafetyVisit, VisitType, VisitStatus, RecurrenceRule } from '../../services/safetyVisits';
import { safetyTeamApi } from '../../services/safetyTeamMembers';
import { SeriesScopeModal } from './SeriesScopeModal';
import { RecurrenceModal } from './RecurrenceModal';
import {
  AUDIT_AREAS,
  buildBlankSection,
  type ObservationSection,
  type ObservationAnswer,
} from '../../services/safetyObservations';

interface Props {
  visit: SafetyVisit | null;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = 'schedule' | 'report';

const STATUS_COLORS: Record<VisitStatus, { bg: string; color: string }> = {
  proposed:  { bg: '#f3f4f6', color: '#374151' },
  confirmed: { bg: '#dbeafe', color: '#1d4ed8' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
};

const ANSWER_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  yes: { bg: '#d1fae5', color: '#065f46', label: '✓ Yes' },
  no:  { bg: '#fee2e2', color: '#991b1b', label: '✗ No'  },
  na:  { bg: '#f3f4f6', color: '#6b7280', label: '– N/A' },
};

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ORDINAL_LABELS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', [-1]: 'last' };

function describeRule(r: RecurrenceRule): string {
  const end = r.endType === 'occurrences'
    ? `, ${r.occurrences ?? '?'} occurrences`
    : r.endType === 'by_date' && r.endByDate
      ? ` until ${r.endByDate}`
      : '';
  if (r.type === 'daily') {
    return r.dailyWeekdaysOnly
      ? `Every weekday${end}`
      : `Every ${r.dailyInterval ?? 1} day(s)${end}`;
  }
  if (r.type === 'weekly') {
    const on = (r.weeklyDays ?? []).map(d => DAYS_SHORT[d]).join('/') || '';
    const every = r.weeklyInterval === 2 ? 'Every 2 weeks' : r.weeklyInterval && r.weeklyInterval > 2 ? `Every ${r.weeklyInterval} weeks` : 'Weekly';
    return `${every}${on ? ' on ' + on : ''}${end}`;
  }
  if (r.type === 'monthly') {
    const intv = r.monthlyInterval && r.monthlyInterval > 1 ? ` every ${r.monthlyInterval} mo` : ' monthly';
    if (r.monthlyType === 'day_of_week') {
      const ord = ORDINAL_LABELS[r.monthlyWeek ?? 1] ?? `${r.monthlyWeek}th`;
      const wd = DAYS_SHORT[r.monthlyWeekday ?? 0];
      return `${ord} ${wd}${intv}${end}`;
    }
    return `Day ${r.monthlyDay ?? '?'}${intv}${end}`;
  }
  if (r.type === 'yearly') {
    const mo = MONTH_SHORT[(r.yearlyMonth ?? 1) - 1];
    if (r.yearlyType === 'day_of_week') {
      const ord = ORDINAL_LABELS[r.yearlyWeek ?? 1] ?? `${r.yearlyWeek}th`;
      const wd = DAYS_SHORT[r.yearlyWeekday ?? 0];
      return `${ord} ${wd} of ${mo} yearly${end}`;
    }
    return `${mo} ${r.yearlyDay ?? '?'} yearly${end}`;
  }
  return 'Recurring';
}

export const VisitReportDrawer: React.FC<Props> = ({ visit, onClose, onSaved }) => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('schedule');

  // Schedule fields
  const [scheduledDate, setScheduledDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visitType, setVisitType] = useState<VisitType>('routine');
  const [status, setStatus] = useState<VisitStatus>('proposed');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [travelHours, setTravelHours] = useState('');
  const [travelNotes, setTravelNotes] = useState('');
  const [isOutOfState, setIsOutOfState] = useState(false);

  // Recurrence
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null);
  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false);
  const [seriesScopeOpen, setSeriesScopeOpen] = useState(false);
  const [pendingScheduleFields, setPendingScheduleFields] = useState<Record<string, unknown> | null>(null);

  // Report fields
  const [reportWeather, setReportWeather] = useState('');
  const [reportTemp, setReportTemp] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [sections, setSections] = useState<ObservationSection[]>(() =>
    AUDIT_AREAS.map(a => buildBlankSection(a.key))
  );

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['safety-team-members'],
    queryFn: () => safetyTeamApi.getAll().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!visit) return;
    setScheduledDate(visit.scheduled_date ? visit.scheduled_date.substring(0, 10) : '');
    setEndDate(visit.end_date ? visit.end_date.substring(0, 10) : '');
    setVisitType(visit.visit_type);
    setStatus(visit.status);
    setAssignedTo(visit.assigned_to ? String(visit.assigned_to) : '');
    setTravelHours(visit.travel_hours_ow ? String(visit.travel_hours_ow) : '');
    setTravelNotes(visit.travel_notes ?? '');
    setIsOutOfState(visit.is_out_of_state);
    setReportWeather(visit.report_weather ?? '');
    setReportTemp(visit.report_temp !== null && visit.report_temp !== undefined ? String(visit.report_temp) : '');
    setReportNotes(visit.report_notes ?? '');
    setSections(
      visit.report_sections?.length
        ? visit.report_sections
        : AUDIT_AREAS.map(a => buildBlankSection(a.key))
    );
  }, [visit?.id]);

  const updateMut = useMutation({
    mutationFn: (data: Partial<SafetyVisit>) => safetyVisitsApi.update(visit!.id, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-visits'] }); onSaved(); },
  });

  const createSeriesMut = useMutation({
    mutationFn: (data: Parameters<typeof safetyVisitsApi.createSeries>[0]) =>
      safetyVisitsApi.createSeries(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-visits'] }); onSaved(); },
  });

  const updateSeriesMut = useMutation({
    mutationFn: (data: Parameters<typeof safetyVisitsApi.updateSeries>[1] & { seriesId: number }) =>
      safetyVisitsApi.updateSeries(data.seriesId, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-visits'] }); setSeriesScopeOpen(false); onSaved(); },
  });

  const completeMut = useMutation({
    mutationFn: () => safetyVisitsApi.complete(visit!.id, {
      report_weather: reportWeather || null,
      report_temp: reportTemp ? Number(reportTemp) : null,
      report_notes: reportNotes || null,
      report_sections: sections,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-visits'] }); onSaved(); },
  });

  const handleSaveSchedule = () => {
    const fields = {
      scheduled_date: scheduledDate || null,
      end_date: endDate || null,
      visit_type: visitType,
      status,
      assigned_to: assignedTo ? Number(assignedTo) : null,
      travel_hours_ow: travelHours ? Number(travelHours) : null,
      travel_notes: travelNotes || null,
      is_out_of_state: isOutOfState,
    };

    // If recurrence rule set on a non-series visit, create a series
    if (recurrenceRule && !visit!.series_id) {
      if (!scheduledDate) return;
      const duration = scheduledDate && endDate
        ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(scheduledDate).getTime()) / 86400000))
        : 0;
      createSeriesMut.mutate({
        project_id: visit!.project_id,
        recurrence_rule: recurrenceRule,
        anchor_date: scheduledDate,
        duration_days: duration,
        visit_type: visitType,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        travel_hours_ow: travelHours ? Number(travelHours) : null,
        travel_notes: travelNotes || null,
        is_out_of_state: isOutOfState,
      });
      return;
    }

    // If this visit belongs to a series, prompt for scope
    if (visit!.series_id) {
      setPendingScheduleFields(fields);
      setSeriesScopeOpen(true);
      return;
    }

    updateMut.mutate(fields as Partial<SafetyVisit>);
  };

  const dispatchSeriesUpdate = (scope: 'just_this' | 'forward' | 'all') => {
    if (!visit || !pendingScheduleFields) return;
    if (scope === 'just_this') {
      updateMut.mutate(pendingScheduleFields as Partial<SafetyVisit>);
      setSeriesScopeOpen(false);
    } else {
      updateSeriesMut.mutate({
        seriesId: visit.series_id!,
        scope: scope === 'forward' ? 'forward' : 'all',
        from_position: scope === 'forward' ? (visit.series_position ?? undefined) : undefined,
        visit_type: pendingScheduleFields.visit_type as VisitType,
        assigned_to: pendingScheduleFields.assigned_to as number | null,
        travel_hours_ow: pendingScheduleFields.travel_hours_ow as number | null,
        travel_notes: pendingScheduleFields.travel_notes as string | null,
        is_out_of_state: pendingScheduleFields.is_out_of_state as boolean,
      });
    }
  };

  const handleAnswer = (sectionIdx: number, itemIdx: number, answer: ObservationAnswer) => {
    setSections(prev => {
      const next = prev.map(s => ({ ...s, items: [...s.items] }));
      next[sectionIdx].items[itemIdx] = { ...next[sectionIdx].items[itemIdx], answer };
      return next;
    });
  };

  const handleSectionComment = (sectionIdx: number, comments: string) => {
    setSections(prev => {
      const next = [...prev];
      next[sectionIdx] = { ...next[sectionIdx], comments };
      return next;
    });
  };

  if (!visit) return null;

  const statusStyle = STATUS_COLORS[visit.status] ?? STATUS_COLORS.proposed;
  const isCompleted = visit.status === 'completed';
  const totalTripHours = travelHours ? (Number(travelHours) * 2).toFixed(1) : null;

  const drawerStyle: React.CSSProperties = {
    position: 'fixed',
    right: 0,
    top: 0,
    bottom: 0,
    width: '640px',
    background: '#fff',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <>
      <SeriesScopeModal
        isOpen={seriesScopeOpen}
        mode="edit"
        isPending={updateMut.isPending || updateSeriesMut.isPending}
        onJustThis={() => dispatchSeriesUpdate('just_this')}
        onThisAndFuture={() => dispatchSeriesUpdate('forward')}
        onAll={() => dispatchSeriesUpdate('all')}
        onCancel={() => setSeriesScopeOpen(false)}
      />
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000 }}
        onClick={onClose}
      />
      <div style={drawerStyle}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #002356 0%, #004080 100%)',
          padding: '20px 24px 16px',
          color: '#fff',
          borderBottom: '3px solid #f97316',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Safety Visit
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.2 }}>
                {visit.project_name}
                <span style={{ marginLeft: '8px', fontSize: '13px', opacity: 0.7 }}>#{visit.project_number}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: statusStyle.bg,
                  color: statusStyle.color,
                }}>
                  {visit.status.toUpperCase()}
                </span>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>
                  Visit #{visit.number} · {visit.visit_type.replace('_', ' ')}
                </span>
                {visit.series_id && (
                  <span style={{
                    fontSize: '10px', background: 'rgba(109,40,217,0.2)', color: '#c4b5fd',
                    borderRadius: '10px', padding: '1px 8px', fontWeight: 700,
                  }}>
                    ↻ {visit.series_frequency} · #{visit.series_position}
                  </span>
                )}
                {visit.is_out_of_state && <span style={{ fontSize: '14px' }} title="Out of state">✈</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', opacity: 0.8, padding: '0' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          {(['schedule', 'report'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                background: tab === t ? '#fff' : '#f9fafb',
                borderBottom: tab === t ? '2px solid #002356' : '2px solid transparent',
                fontWeight: tab === t ? 700 : 400,
                color: tab === t ? '#002356' : '#6b7280',
                cursor: 'pointer',
                fontSize: '13px',
                textTransform: 'capitalize',
              }}
            >
              {t === 'schedule' ? '📅 Schedule' : '📋 Visit Report'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {tab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Start Date
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>End Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(multi-day)</span></span>
                  <input
                    type="date"
                    value={endDate}
                    min={scheduledDate || undefined}
                    onChange={e => setEndDate(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Visit Type
                  <select value={visitType} onChange={e => setVisitType(e.target.value as VisitType)}
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}>
                    <option value="kickoff">Kickoff</option>
                    <option value="routine">Routine</option>
                    <option value="follow_up">Follow Up</option>
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Status
                  <select value={status} onChange={e => setStatus(e.target.value as VisitStatus)}
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}>
                    <option value="proposed">Proposed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Assigned To
                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}>
                    <option value="">Unassigned</option>
                    {[...teamMembers].sort((a, b) => a.last_name.localeCompare(b.last_name)).map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Travel Time (one-way hours)
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={travelHours}
                    onChange={e => setTravelHours(e.target.value)}
                    placeholder="e.g. 2.5"
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#374151', paddingBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={isOutOfState}
                    onChange={e => setIsOutOfState(e.target.checked)}
                  />
                  Out of state ✈
                </label>
              </div>

              {totalTripHours && (
                <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', fontSize: '13px', color: '#1d4ed8' }}>
                  Total round-trip travel time: <strong>{totalTripHours} hrs</strong>
                </div>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                Travel Notes
                <textarea
                  value={travelNotes}
                  onChange={e => setTravelNotes(e.target.value)}
                  rows={3}
                  placeholder="Flight info, rental car, hotel, etc."
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', resize: 'vertical' }}
                />
              </label>

              {visit.project_address && (
                <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: '8px', fontSize: '13px', color: '#6b7280' }}>
                  📍 {visit.project_address}
                </div>
              )}

              {/* Recurrence — only shown when visit is not already in a series */}
              {!visit.series_id && !isCompleted && (
                <div>
                  {recurrenceRule ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #ede9fe' }}>
                      <span style={{ fontSize: '14px' }}>↻</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', flex: 1 }}>
                        {describeRule(recurrenceRule)}
                      </span>
                      <button onClick={() => setRecurrenceModalOpen(true)}
                        style={{ fontSize: '11px', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontWeight: 700, textDecoration: 'underline' }}>
                        Edit
                      </button>
                      <button onClick={() => setRecurrenceRule(null)}
                        style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontWeight: 600, textDecoration: 'underline' }}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRecurrenceModalOpen(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '9px 14px', borderRadius: '8px',
                        border: '1px dashed #c4b5fd', background: '#faf5ff',
                        color: '#7c3aed', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', width: '100%',
                      }}
                    >
                      ↻ Make this a recurring visit…
                    </button>
                  )}
                  <RecurrenceModal
                    isOpen={recurrenceModalOpen}
                    anchorDate={scheduledDate || new Date().toISOString().slice(0, 10)}
                    durationDays={scheduledDate && endDate
                      ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(scheduledDate).getTime()) / 86400000))
                      : 0}
                    initial={recurrenceRule}
                    onConfirm={rule => { setRecurrenceRule(rule); setRecurrenceModalOpen(false); }}
                    onCancel={() => setRecurrenceModalOpen(false)}
                  />
                </div>
              )}

              {/* Series info for existing series visits */}
              {visit.series_id && (
                <div style={{ padding: '10px 14px', background: '#f5f3ff', borderRadius: '8px', fontSize: '12px', color: '#7c3aed', border: '1px solid #ede9fe' }}>
                  ↻ Visit {visit.series_position} in a recurring series
                  ({visit.series_frequency}).
                  Saving will prompt you to apply changes to this visit, all future visits, or the entire series.
                </div>
              )}
            </div>
          )}

          {tab === 'report' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isCompleted && (
                <div style={{ padding: '10px 14px', background: '#d1fae5', borderRadius: '8px', fontSize: '13px', color: '#065f46', fontWeight: 600 }}>
                  ✓ Visit completed {visit.completed_date} by {visit.completed_by_name}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Weather
                  <input
                    value={reportWeather}
                    onChange={e => setReportWeather(e.target.value)}
                    placeholder="e.g. Sunny, 72°F"
                    disabled={isCompleted}
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Temperature (°F)
                  <input
                    type="number"
                    value={reportTemp}
                    onChange={e => setReportTemp(e.target.value)}
                    disabled={isCompleted}
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                General Notes
                <textarea
                  value={reportNotes}
                  onChange={e => setReportNotes(e.target.value)}
                  rows={3}
                  disabled={isCompleted}
                  placeholder="Summary of the visit, key observations, action items..."
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', resize: 'vertical' }}
                />
              </label>

              {/* Audit checklist */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
                  Site Audit Checklist
                </div>
                {AUDIT_AREAS.map((area, si) => {
                  const sec = sections[si] ?? buildBlankSection(area.key);
                  return (
                    <div key={area.key} style={{ marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: '#002356', color: '#fff', padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}>
                        {area.label}
                      </div>
                      {area.items.map((item, ii) => {
                        const ans = sec.items[ii]?.answer;
                        return (
                          <div key={item.key} style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '7px 12px',
                            borderBottom: ii < area.items.length - 1 ? '1px solid #f3f4f6' : 'none',
                            gap: '8px',
                          }}>
                            <span style={{ flex: 1, fontSize: '12px', color: '#374151' }}>{item.label}</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {(['yes', 'no', 'na'] as ObservationAnswer[]).map(a => {
                                const st = ANSWER_STYLES[a as string];
                                return (
                                  <button
                                    key={a}
                                    disabled={isCompleted}
                                    onClick={() => handleAnswer(si, ii, ans === a ? null : a)}
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      border: `1px solid ${ans === a ? st.color : '#d1d5db'}`,
                                      background: ans === a ? st.bg : '#fff',
                                      color: ans === a ? st.color : '#9ca3af',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      cursor: isCompleted ? 'default' : 'pointer',
                                    }}
                                  >
                                    {st.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ padding: '8px 12px', background: '#f9fafb' }}>
                        <input
                          value={sec.comments}
                          onChange={e => handleSectionComment(si, e.target.value)}
                          disabled={isCompleted}
                          placeholder="Comments for this section..."
                          style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: '1px solid #e5e7eb', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          background: '#f9fafb',
          flexShrink: 0,
        }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: '7px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
          {tab === 'schedule' && !isCompleted && (
            <button
              onClick={handleSaveSchedule}
              disabled={updateMut.isPending}
              style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#002356', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              {updateMut.isPending ? 'Saving…' : 'Save Schedule'}
            </button>
          )}
          {tab === 'report' && !isCompleted && (
            <button
              onClick={() => completeMut.mutate()}
              disabled={completeMut.isPending}
              style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#059669', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              {completeMut.isPending ? 'Submitting…' : '✓ Complete Visit'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};
