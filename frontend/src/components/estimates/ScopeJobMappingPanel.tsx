import React, { useEffect, useState, useCallback } from 'react';
import { scopeJobMappingsApi, ScopeJobMapping, VistaJobOption } from '../../services/scopeJobMappings';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

const SCOPES: Array<{ key: 'HVAC' | 'Plumbing' | 'BAS'; label: string; color: string }> = [
  { key: 'HVAC',     label: 'HVAC (Sheet Metal + Piping)', color: '#10b981' },
  { key: 'Plumbing', label: 'Plumbing',                    color: '#3b82f6' },
  { key: 'BAS',      label: 'BAS / Controls',              color: '#8b5cf6' },
];

interface Props {
  projectId: number;
  source: 'historical' | 'project';
  onMappingChange?: () => void;
}

interface ScopeRowState {
  mapping: ScopeJobMapping | null;
  selectedJob: string;
  searchPrefix: string;
  searchResults: VistaJobOption[];
  previewCost: number | null;
  saving: boolean;
  searching: boolean;
}

const fmt = (n: number | null) =>
  n == null ? '' : '$' + Math.round(n).toLocaleString();

const ScopeJobMappingPanel: React.FC<Props> = ({ projectId, source, onMappingChange }) => {
  const { toast } = useTitanFeedback();
  const [loading, setLoading] = useState(true);
  const [projectJobs, setProjectJobs] = useState<{ job: string; job_description: string | null }[]>([]);
  const [rows, setRows] = useState<Record<string, ScopeRowState>>(() =>
    Object.fromEntries(SCOPES.map(s => [s.key, {
      mapping: null, selectedJob: '', searchPrefix: '',
      searchResults: [], previewCost: null, saving: false, searching: false,
    }]))
  );

  const updateRow = (scope: string, patch: Partial<ScopeRowState>) =>
    setRows(prev => ({ ...prev, [scope]: { ...prev[scope], ...patch } }));

  // Load existing mappings and (for live projects) available Vista jobs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [mappingsRes, jobsRes] = await Promise.all([
          source === 'project'
            ? scopeJobMappingsApi.getForProject(projectId)
            : scopeJobMappingsApi.getForHistorical(projectId),
          source === 'project'
            ? scopeJobMappingsApi.getProjectJobs(projectId).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        if (source === 'project') setProjectJobs((jobsRes as any).data || []);
        const mappings: ScopeJobMapping[] = mappingsRes.data.mappings || [];
        setRows(prev => {
          const next = { ...prev };
          SCOPES.forEach(s => {
            const m = mappings.find(x => x.scope === s.key) || null;
            next[s.key] = { ...next[s.key], mapping: m, selectedJob: m?.vista_job || '', previewCost: m?.cached_est_cost ?? null };
          });
          return next;
        });
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, source]);

  const handleSearch = useCallback(async (scope: string) => {
    const prefix = rows[scope].searchPrefix.trim();
    if (!prefix) return;
    updateRow(scope, { searching: true });
    try {
      const res = await scopeJobMappingsApi.searchJobs(prefix);
      updateRow(scope, { searchResults: res.data || [], searching: false });
    } catch {
      updateRow(scope, { searching: false });
    }
  }, [rows]);

  const handleJobSelect = useCallback(async (scope: string, job: string) => {
    updateRow(scope, { selectedJob: job, previewCost: null });
    if (!job) return;
    try {
      const res = await scopeJobMappingsApi.getJobTotal(job);
      updateRow(scope, { previewCost: res.data.total_est_cost });
    } catch { /* ignore */ }
  }, []);

  const handleSave = useCallback(async (scope: string) => {
    const row = rows[scope];
    if (!row.selectedJob) return;
    updateRow(scope, { saving: true });
    try {
      const res = source === 'project'
        ? await scopeJobMappingsApi.saveForProject(projectId, scope, row.selectedJob)
        : await scopeJobMappingsApi.saveForHistorical(projectId, scope, row.selectedJob);
      updateRow(scope, { saving: false, mapping: res.data.mapping, previewCost: res.data.mapping.cached_est_cost });
      toast.success(`${scope} mapping saved`);
      onMappingChange?.();
    } catch {
      updateRow(scope, { saving: false });
      toast.error('Failed to save mapping');
    }
  }, [rows, projectId, source, onMappingChange, toast]);

  const handleClear = useCallback(async (scope: string) => {
    const row = rows[scope];
    if (!row.mapping) { updateRow(scope, { selectedJob: '', previewCost: null, searchResults: [] }); return; }
    try {
      await scopeJobMappingsApi.deleteMapping(row.mapping.id);
      updateRow(scope, { mapping: null, selectedJob: '', previewCost: null, searchResults: [] });
      toast.success(`${scope} mapping cleared`);
      onMappingChange?.();
    } catch {
      toast.error('Failed to clear mapping');
    }
  }, [rows, onMappingChange, toast]);

  if (loading) return <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>Loading scope mappings…</div>;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{
        fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: '#002356', marginBottom: '0.5rem',
      }}>
        Vista Scope Job Mapping
      </div>
      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.75rem' }}>
        Assign a Vista subjob to each scope so $/SF is pulled from actual job costs.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {SCOPES.map(({ key, label, color }) => {
          const row = rows[key];
          const isSaved = !!row.mapping && row.mapping.vista_job === row.selectedJob;

          return (
            <div key={key} style={{
              background: '#f8fafc',
              border: `1px solid ${color}22`,
              borderLeft: `3px solid ${color}`,
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
            }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, color,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                marginBottom: '0.375rem',
              }}>
                {label}
                {isSaved && (
                  <span style={{
                    marginLeft: '0.5rem', fontWeight: 500, textTransform: 'none',
                    letterSpacing: 0, color: '#10b981', fontSize: '0.68rem',
                  }}>
                    ✓ {fmt(row.previewCost)} est.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Job selector */}
                {source === 'project' ? (
                  <select
                    value={row.selectedJob}
                    onChange={e => handleJobSelect(key, e.target.value)}
                    style={{
                      flex: 1, minWidth: 140, fontSize: '0.78rem', padding: '3px 6px',
                      border: '1px solid #d1d5db', borderRadius: '4px',
                    }}
                  >
                    <option value="">— Select job —</option>
                    {projectJobs.map(j => (
                      <option key={j.job} value={j.job}>
                        {j.job}{j.job_description ? ` — ${j.job_description}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Contract # (e.g. 40687)"
                      value={row.searchPrefix}
                      onChange={e => updateRow(key, { searchPrefix: e.target.value, searchResults: [] })}
                      onKeyDown={e => e.key === 'Enter' && handleSearch(key)}
                      style={{
                        width: 140, fontSize: '0.78rem', padding: '3px 6px',
                        border: '1px solid #d1d5db', borderRadius: '4px',
                      }}
                    />
                    <button
                      onClick={() => handleSearch(key)}
                      disabled={row.searching || !row.searchPrefix.trim()}
                      style={{
                        fontSize: '0.72rem', padding: '3px 8px',
                        border: '1px solid #d1d5db', borderRadius: '4px',
                        background: '#f1f5f9', cursor: 'pointer',
                      }}
                    >
                      {row.searching ? '…' : 'Search'}
                    </button>
                    {row.searchResults.length > 0 && (
                      <select
                        value={row.selectedJob}
                        onChange={e => handleJobSelect(key, e.target.value)}
                        style={{
                          flex: 1, minWidth: 160, fontSize: '0.78rem', padding: '3px 6px',
                          border: '1px solid #d1d5db', borderRadius: '4px',
                        }}
                      >
                        <option value="">— Select subjob —</option>
                        {row.searchResults.map(j => (
                          <option key={j.job} value={j.job}>
                            {j.job}{j.job_description ? ` — ${j.job_description}` : ''}
                            {j.total_est_cost > 0 ? ` (${fmt(j.total_est_cost)})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {row.selectedJob && !row.searchResults.length && (
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{row.selectedJob}</span>
                    )}
                  </>
                )}

                {/* Preview cost */}
                {row.previewCost != null && !isSaved && (
                  <span style={{ fontSize: '0.72rem', color: '#374151' }}>
                    Est: {fmt(row.previewCost)}
                  </span>
                )}

                {/* Save */}
                <button
                  onClick={() => handleSave(key)}
                  disabled={!row.selectedJob || row.saving}
                  style={{
                    fontSize: '0.72rem', padding: '3px 10px',
                    border: `1px solid ${color}`,
                    borderRadius: '4px', background: color, color: '#fff',
                    cursor: row.selectedJob ? 'pointer' : 'not-allowed',
                    opacity: row.selectedJob ? 1 : 0.4,
                  }}
                >
                  {row.saving ? 'Saving…' : 'Save'}
                </button>

                {/* Clear */}
                {(row.mapping || row.selectedJob) && (
                  <button
                    onClick={() => handleClear(key)}
                    style={{
                      fontSize: '0.72rem', padding: '3px 8px',
                      border: '1px solid #e5e7eb', borderRadius: '4px',
                      background: '#fff', color: '#6b7280', cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScopeJobMappingPanel;
