import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { gcSchedulesApi, GCScheduleActivity, GCScheduleVersion } from '../../services/gcSchedules';
import { phaseScheduleLinksApi } from '../../services/phaseScheduleLinks';
import { PhaseScheduleItem } from '../../services/phaseSchedule';

interface Props {
  phaseItem: PhaseScheduleItem;
  projectId: number;
  onClose: () => void;
}

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'to', 'of', 'in', 'on', 'at',
  'a', 'an', 'or', 'by', 'as', 'is', 'be', 'are', 'this', 'that',
]);

const tokenize = (s: string | null | undefined): Set<string> => {
  if (!s) return new Set();
  const out = new Set<string>();
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).forEach((t) => {
    if (t.length >= 3 && !STOPWORDS.has(t)) out.add(t);
  });
  return out;
};

const fmtIso = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? '' : format(d, 'M/d/yy');
};

const PhaseGCLinkModal: React.FC<Props> = ({ phaseItem, projectId, onClose }) => {
  const queryClient = useQueryClient();

  // Versions for this project — default to most recent 'completed'.
  const { data: versions = [], isLoading: versionsLoading } = useQuery<GCScheduleVersion[]>({
    queryKey: ['gcScheduleVersions', projectId],
    queryFn: () => gcSchedulesApi.listVersions(projectId).then((r) => r.data),
  });

  const latestCompletedId = useMemo(
    () => versions.find((v) => v.parse_status === 'completed')?.id ?? null,
    [versions]
  );

  const [versionId, setVersionId] = useState<number | null>(null);
  useEffect(() => {
    if (versionId == null && latestCompletedId != null) setVersionId(latestCompletedId);
  }, [latestCompletedId, versionId]);

  // Filters — default Mechanical OFF so a poorly-tagged PDF schedule still
  // shows everything. User can opt in.
  const [mechanicalOnly, setMechanicalOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Selection — text activity_id values
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    phaseItem.linked_gc_activities?.forEach((a) => initial.add(a.activity_id));
    return initial;
  });

  const { data: activitiesResp, isLoading: actsLoading } = useQuery({
    queryKey: ['gcScheduleActivitiesForLink', versionId, mechanicalOnly],
    queryFn: () =>
      versionId == null
        ? Promise.resolve({ activities: [] as GCScheduleActivity[] })
        : gcSchedulesApi.getActivities(versionId, { mechanicalOnly }).then((r) => r.data),
    enabled: versionId != null,
  });
  const activities: GCScheduleActivity[] = (activitiesResp as any)?.activities ?? [];

  // Smart ranking — tokens from the phase name + phase_code_display
  const sourceTokens = useMemo(() => {
    const tokens = new Set<string>();
    tokenize(phaseItem.name).forEach((t) => tokens.add(t));
    tokenize(phaseItem.phase_code_display || '').forEach((t) => tokens.add(t));
    return tokens;
  }, [phaseItem.name, phaseItem.phase_code_display]);

  const matchScores = useMemo(() => {
    const scores = new Map<number, number>();
    if (sourceTokens.size === 0) return scores;
    activities.forEach((a) => {
      if (a.is_summary) return;
      const combined = `${a.activity_name || ''} ${a.wbs_code || ''} ${a.wbs_path || ''}`;
      const acts = tokenize(combined);
      let hits = 0;
      sourceTokens.forEach((t) => { if (acts.has(t)) hits += 1; });
      if (hits > 0) scores.set(a.id, hits);
    });
    return scores;
  }, [activities, sourceTokens]);

  // Search filter (case-insensitive, matches activity_id, name, wbs)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activities;
    return activities.filter((a) => {
      if (a.is_summary) return true; // keep headers; they'll be hidden if empty below
      return (
        (a.activity_id || '').toLowerCase().includes(term) ||
        (a.activity_name || '').toLowerCase().includes(term) ||
        (a.wbs_code || '').toLowerCase().includes(term)
      );
    });
  }, [activities, search]);

  // Hide summary headers that have no visible non-summary descendants.
  // Runs unconditionally so the user never sees an empty section.
  const visible = useMemo(() => {
    const out: GCScheduleActivity[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const a = filtered[i];
      if (!a.is_summary) { out.push(a); continue; }
      let hasChild = false;
      for (let j = i + 1; j < filtered.length; j++) {
        if (filtered[j].is_summary) break;
        hasChild = true;
        break;
      }
      if (hasChild) out.push(a);
    }
    return out;
  }, [filtered]);

  // Count linkable rows: non-summary with activity_id. When zero, the modal
  // surfaces an explanation rather than just looking broken.
  const linkableCount = useMemo(
    () => activities.filter((a) => !a.is_summary && !!a.activity_id).length,
    [activities]
  );

  // Derived dates preview from current selection across loaded activities
  const derivedDates = useMemo(() => {
    let start: string | null = null;
    let finish: string | null = null;
    activities.forEach((a) => {
      if (!a.activity_id || !selected.has(a.activity_id)) return;
      if (a.start_date && (!start || a.start_date < start)) start = a.start_date;
      if (a.finish_date && (!finish || a.finish_date > finish)) finish = a.finish_date;
    });
    return { start, finish };
  }, [activities, selected]);

  const toggleOne = (activityId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => phaseScheduleLinksApi.replaceForItem(phaseItem.id, Array.from(selected)),
    onSuccess: async () => {
      // refetchQueries (not just invalidate) — without an active observer the
      // page sometimes won't pull fresh data even after invalidation. The key
      // uses the projectId param from useParams, which is a string.
      await queryClient.refetchQueries({ queryKey: ['phaseScheduleItems'] });
      onClose();
    },
  });

  // Activities we couldn't resolve in this version (link exists but activity missing)
  // are still in `selected` but won't appear in the tree — show them as orphan chips below.
  const orphanLinks = useMemo(() => {
    if (versionId == null) return [];
    const present = new Set(activities.map((a) => a.activity_id).filter(Boolean));
    return Array.from(selected).filter((id) => !present.has(id));
  }, [selected, activities, versionId]);

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, width: '90%', maxWidth: 760,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Link to GC Activities
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                {phaseItem.name}
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, lineHeight: 1, cursor: 'pointer' }}
              aria-label="Close">×</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={versionId ?? ''}
              onChange={(e) => setVersionId(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            >
              {versionsLoading && <option>Loading versions…</option>}
              {!versionsLoading && versions.length === 0 && <option>No GC schedule uploaded</option>}
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_label || v.source_filename || `Version ${v.id}`}
                  {v.id === latestCompletedId ? ' (active)' : ''}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#374151' }}>
              <input
                type="checkbox"
                checked={mechanicalOnly}
                onChange={(e) => setMechanicalOnly(e.target.checked)}
              />
              Mechanical only
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity id, name, WBS…"
              style={{ flex: 1, minWidth: 180, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {versionId == null && !versionsLoading && (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
              No GC schedule has been uploaded for this project yet. Upload one on the GC Schedule page to enable linking.
            </div>
          )}
          {versionId != null && actsLoading && (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Loading activities…</div>
          )}
          {versionId != null && !actsLoading && visible.length === 0 && linkableCount > 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              No activities match the current filters.
            </div>
          )}
          {versionId != null && !actsLoading && linkableCount === 0 && activities.length > 0 && (
            <div style={{ padding: '20px 28px', color: '#92400e', fontSize: 13, background: '#fffbeb', borderTop: '1px solid #fde68a', borderBottom: '1px solid #fde68a', lineHeight: 1.5 }}>
              <strong>This version has no linkable activities.</strong>{' '}
              All {activities.length} row{activities.length === 1 ? '' : 's'} are summary headers
              {activities.every((a) => !a.activity_id) ? ' with no activity IDs' : ''}.
              {' '}This usually means the schedule was parsed from a PDF without per-activity IDs.
              Re-upload the schedule as XER, MS Project XML, or an Excel export with an Activity&nbsp;ID column,
              or pick a different version above.
            </div>
          )}
          {versionId != null && !actsLoading && visible.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                <tr>
                  <th style={{ width: 32, padding: '6px 8px' }}></th>
                  <th style={{ width: 100, textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 500 }}>Activity ID</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 500 }}>Name</th>
                  <th style={{ width: 90, textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 500 }}>Start</th>
                  <th style={{ width: 90, textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 500 }}>Finish</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  if (a.is_summary) {
                    return (
                      <tr key={a.id} style={{ background: '#f3f4f6' }}>
                        <td colSpan={5} style={{ padding: '4px 8px', fontWeight: 600, color: '#374151' }}>
                          {a.activity_name}
                        </td>
                      </tr>
                    );
                  }
                  const canLink = !!a.activity_id;
                  const isSelected = canLink && selected.has(a.activity_id!);
                  const score = matchScores.get(a.id) || 0;
                  const indent = (a.outline_level || 0) > 0 ? 16 : 0;
                  return (
                    <tr key={a.id}
                        style={{
                          background: isSelected ? '#eff6ff' : undefined,
                          cursor: canLink ? 'pointer' : 'default',
                        }}
                        onClick={() => canLink && toggleOne(a.activity_id!)}>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        {canLink && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(a.activity_id!)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </td>
                      <td style={{ padding: '4px 8px', paddingLeft: 8 + indent, fontFamily: 'monospace', color: '#6b7280' }}>
                        {a.activity_id || '—'}
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        {a.activity_name}
                        {score > 0 && (
                          <span title="Likely match for this phase"
                                style={{ marginLeft: 6, fontSize: 11, color: '#b45309' }}>★</span>
                        )}
                      </td>
                      <td style={{ padding: '4px 8px', color: '#374151' }}>{fmtIso(a.start_date)}</td>
                      <td style={{ padding: '4px 8px', color: '#374151' }}>{fmtIso(a.finish_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '12px 22px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
          {orphanLinks.length > 0 && (
            <div style={{ marginBottom: 8, fontSize: 12, color: '#92400e' }}>
              {orphanLinks.length} linked activity{orphanLinks.length === 1 ? '' : 'ies'} not present in this version:{' '}
              {orphanLinks.map((id) => (
                <span key={id} style={{
                  display: 'inline-block', margin: '0 4px 2px 0', padding: '1px 6px',
                  background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10,
                  fontFamily: 'monospace', fontSize: 11,
                }}>
                  {id}
                  <button
                    onClick={() => setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; })}
                    style={{ marginLeft: 4, background: 'none', border: 'none', color: '#92400e', cursor: 'pointer' }}
                  >✕</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#374151' }}>
              <strong>{selected.size}</strong> selected
              {selected.size > 0 && (derivedDates.start || derivedDates.finish) && (
                <span style={{ marginLeft: 12, color: '#6b7280' }}>
                  Derived dates: <strong>{fmtIso(derivedDates.start)}</strong> → <strong>{fmtIso(derivedDates.finish)}</strong>
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-sm btn-primary"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save Links'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PhaseGCLinkModal;
