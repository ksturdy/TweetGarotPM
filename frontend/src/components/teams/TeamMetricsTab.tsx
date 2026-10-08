import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  teamsApi,
  Team,
  TeamMember,
  TeamMetricConfig,
  TeamMetricSnapshot,
  TeamMetricCurrent,
  TeamSnapshotSettings,
  METRIC_DEFINITIONS,
  MetricKey,
} from '../../services/teams';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy;
}

function formatWeekStart(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

function formatValue(value: number | null, format: string): string {
  if (value === null || value === undefined) return '—';
  if (format === 'count') return value.toLocaleString();
  if (format === 'percent') return `${value.toFixed(1)}%`;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function buildWeekGrid(): string[] {
  const weeks: string[] = [];
  const monday = getMonday(new Date());
  for (let i = 11; i >= 0; i--) {
    const d = new Date(monday);
    d.setDate(d.getDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

function scopeKey(member_user_id: number | null, member_team_id: number | null): string {
  if (member_team_id !== null) return `sub_team:${member_team_id}`;
  if (member_user_id !== null) return `user:${member_user_id}`;
  return 'all_team';
}

function rowKey(config: TeamMetricConfig): string {
  return `${scopeKey(config.member_user_id, config.member_team_id)}_${config.metric_key}`;
}

function trendColor(values: (number | null)[]): string {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return '#94a3b8';
  return valid[valid.length - 1] > valid[0] ? '#10b981' : valid[valid.length - 1] < valid[0] ? '#ef4444' : '#94a3b8';
}

function goalColor(value: number | null, goal: number | null, format: string, lowerIsBetter?: boolean): string {
  if (value === null) return '#94a3b8';
  if (goal !== null) {
    return (lowerIsBetter ? value <= goal : value >= goal) ? '#166534' : '#dc2626';
  }
  if (format === 'count') return value >= 0 ? '#166534' : '#dc2626';
  return value < 0 ? '#dc2626' : '#166534';
}

function goalBarColor(weekValues: (number | null)[], goal: number | null, lowerIsBetter?: boolean): string {
  if (goal !== null) {
    const valid = weekValues.filter((v): v is number => v !== null);
    if (valid.length === 0) return '#94a3b8';
    const last = valid[valid.length - 1];
    return (lowerIsBetter ? last <= goal : last >= goal) ? '#10b981' : '#ef4444';
  }
  return trendColor(weekValues);
}

function getScopeLabel(cfg: TeamMetricConfig): string {
  if (cfg.member_team_id !== null) return cfg.member_team_name ?? 'Sub-team';
  if (cfg.member_user_id !== null) return cfg.member_name ?? 'Member';
  return 'All Team';
}

type GroupMode = 'none' | 'member' | 'metric';
type SortDir = 'none' | 'asc' | 'desc';

function computeTrend(values: (number | null)[]): { direction: 'up' | 'down' | 'flat' | 'none'; pct: number | null } {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return { direction: 'none', pct: null };
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (first === 0) return { direction: last > 0 ? 'up' : last < 0 ? 'down' : 'flat', pct: null };
  const pct = ((last - first) / Math.abs(first)) * 100;
  return { direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat', pct };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Member option model ───────────────────────────────────────────────────────

interface MemberOption {
  value: string;
  label: string;
  group?: string;
  member_user_id: number | null;
  member_team_id: number | null;
}

function buildMemberOptions(members: TeamMember[], allTeams: Team[]): MemberOption[] {
  const options: MemberOption[] = [
    { value: 'all_team', label: 'All Team', member_user_id: null, member_team_id: null },
  ];

  for (const m of members) {
    if (!m.user_id) continue;
    const subTeam = allTeams.find(t => t.team_lead_id === m.employee_id);
    if (subTeam) {
      options.push({
        value: `sub_team:${subTeam.id}`,
        label: `${m.first_name} ${m.last_name}'s Team`,
        group: `${m.first_name} ${m.last_name}`,
        member_user_id: null,
        member_team_id: subTeam.id,
      });
      options.push({
        value: `user:${m.user_id}`,
        label: `${m.first_name} ${m.last_name} (individual)`,
        group: `${m.first_name} ${m.last_name}`,
        member_user_id: m.user_id,
        member_team_id: null,
      });
    } else {
      options.push({
        value: `user:${m.user_id}`,
        label: `${m.first_name} ${m.last_name}`,
        member_user_id: m.user_id,
        member_team_id: null,
      });
    }
  }

  return options;
}

// ── Settings Modal ─────────────────────────────────────────────────────────

interface SettingsModalProps {
  teamId: number;
  members: TeamMember[];
  allTeams: Team[];
  configs: TeamMetricConfig[];
  settings: TeamSnapshotSettings;
  groupMode: GroupMode;
  onGroupModeChange: (mode: GroupMode) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  teamId, members, allTeams, configs, settings, groupMode, onGroupModeChange, onClose,
}) => {
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();

  const [scopeVal, setScopeVal] = useState<string>('all_team');
  const [metricKey, setMetricKey] = useState<MetricKey>(METRIC_DEFINITIONS[0].key);

  const [schedDay, setSchedDay] = useState(settings.snapshot_day_of_week);
  const [schedHour, setSchedHour] = useState(settings.snapshot_hour);
  const [schedDirty, setSchedDirty] = useState(false);

  // Local goal edits: configId → string (raw input)
  const [goalEdits, setGoalEdits] = useState<Record<number, string>>(() =>
    Object.fromEntries(configs.map(c => [c.id, c.goal !== null ? String(c.goal) : '']))
  );

  const memberOptions = useMemo(() => buildMemberOptions(members, allTeams), [members, allTeams]);

  const addMutation = useMutation({
    mutationFn: (data: Parameters<typeof teamsApi.addMetricConfig>[1]) =>
      teamsApi.addMetricConfig(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-metric-configs', teamId] });
      toast.success('Metric row added');
    },
    onError: () => toast.error('Failed to add metric row'),
  });

  const deleteMutation = useMutation({
    mutationFn: (configId: number) => teamsApi.deleteMetricConfig(teamId, configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-metric-configs', teamId] });
      toast.success('Metric row removed');
    },
    onError: () => toast.error('Failed to remove metric row'),
  });

  const settingsMutation = useMutation({
    mutationFn: (data: Omit<TeamSnapshotSettings, 'team_id'>) =>
      teamsApi.updateSnapshotSettings(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-snapshot-settings', teamId] });
      toast.success('Schedule saved');
      setSchedDirty(false);
    },
    onError: () => toast.error('Failed to save schedule'),
  });

  const goalMutation = useMutation({
    mutationFn: ({ configId, goal }: { configId: number; goal: number | null }) =>
      teamsApi.updateMetricConfig(teamId, configId, { goal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-metric-configs', teamId] });
    },
    onError: () => toast.error('Failed to save goal'),
  });

  const libMutation = useMutation({
    mutationFn: ({ configId, lower_is_better }: { configId: number; lower_is_better: boolean }) =>
      teamsApi.updateMetricConfig(teamId, configId, { lower_is_better }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-metric-configs', teamId] });
    },
    onError: () => toast.error('Failed to save direction'),
  });

  const handleGoalBlur = (cfg: TeamMetricConfig) => {
    const raw = goalEdits[cfg.id]?.trim();
    const parsed = raw === '' ? null : parseFloat(raw.replace(/[$,]/g, ''));
    if (isNaN(parsed as number) && parsed !== null) return;
    const current = cfg.goal;
    if (parsed === current) return;
    goalMutation.mutate({ configId: cfg.id, goal: parsed });
  };

  const handleAdd = () => {
    const opt = memberOptions.find(o => o.value === scopeVal);
    if (!opt) return;
    const def = METRIC_DEFINITIONS.find(d => d.key === metricKey)!;
    const memberLabel = opt.label;
    addMutation.mutate({
      member_user_id: opt.member_user_id,
      member_team_id: opt.member_team_id,
      metric_key: metricKey,
      label: `${memberLabel} – ${def.label}`,
      display_order: configs.length,
      lower_is_better: metricKey === 'buyout_remaining',
    });
  };

  const hours = Array.from({ length: 24 }, (_, i) => {
    const ampm = i < 12 ? 'am' : 'pm';
    const h = i === 0 ? 12 : i > 12 ? i - 12 : i;
    return { value: i, label: `${h}:00 ${ampm}` };
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 16, padding: 28, width: 540, maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Metric Settings</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {/* Add Row */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add a Row</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={scopeVal}
              onChange={e => setScopeVal(e.target.value)}
              style={{ flex: 1, minWidth: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.875rem', background: 'white' }}
            >
              {memberOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={metricKey}
              onChange={e => setMetricKey(e.target.value as MetricKey)}
              style={{ flex: 1, minWidth: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.875rem', background: 'white' }}
            >
              {METRIC_DEFINITIONS.map(d => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0f172a',
                color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              + Add
            </button>
          </div>
        </div>

        {/* Existing Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configured Rows</div>
          {configs.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '16px 0' }}>
              No rows yet.
            </div>
          )}
          {configs.map(cfg => {
            const isSubTeam = cfg.member_team_id !== null;
            const def = METRIC_DEFINITIONS.find(d => d.key === cfg.metric_key);
            const scopeLabel = isSubTeam
              ? (cfg.member_team_name ?? 'Sub-team')
              : cfg.member_user_id !== null
                ? (cfg.member_name ?? 'Member')
                : 'All Team';
            return (
              <div
                key={cfg.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>{cfg.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {scopeLabel} &middot; {def?.label}
                    {isSubTeam && (
                      <span style={{ marginLeft: 6, background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '0px 5px', fontSize: '0.65rem' }}>team</span>
                    )}
                  </div>
                </div>
                {/* Goal input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>Goal</span>
                  <input
                    type="text"
                    placeholder="—"
                    value={goalEdits[cfg.id] ?? ''}
                    onChange={e => setGoalEdits(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                    onBlur={() => handleGoalBlur(cfg)}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    style={{
                      width: 80, padding: '4px 8px', borderRadius: 6,
                      border: '1px solid #e2e8f0', fontSize: '0.8rem',
                      textAlign: 'right', color: '#0f172a',
                    }}
                  />
                </div>
                {/* Above/Below toggle */}
                <button
                  title={cfg.lower_is_better ? 'Below goal = good. Click to flip.' : 'Above goal = good. Click to flip.'}
                  onClick={() => libMutation.mutate({ configId: cfg.id, lower_is_better: !cfg.lower_is_better })}
                  style={{
                    flexShrink: 0, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem',
                    fontWeight: 700, border: '1px solid #16a34a', whiteSpace: 'nowrap',
                    background: '#f0fdf4', color: '#166534',
                  }}
                >
                  {cfg.lower_is_better ? '↓ Good' : '↑ Good'}
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm({ message: `Remove "${cfg.label}" from the metrics grid?\n\nAll tracked weekly history for this row will be permanently deleted and cannot be recovered.`, danger: true });
                    if (ok) deleteMutation.mutate(cfg.id);
                  }}
                  style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '1rem', cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Default View */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Default View</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>Group rows by default when opening this tab.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['none', 'member', 'metric'] as GroupMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => onGroupModeChange(mode)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid',
                  borderColor: groupMode === mode ? '#0f172a' : '#e2e8f0',
                  background: groupMode === mode ? '#0f172a' : 'white',
                  color: groupMode === mode ? 'white' : '#374151',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {mode === 'none' ? 'None' : mode === 'member' ? 'By Member' : 'By Metric'}
              </button>
            ))}
          </div>
        </div>

        {/* Snapshot Schedule */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-Snapshot Schedule</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Titan will automatically capture a snapshot at this time each week.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={schedDay}
              onChange={e => { setSchedDay(Number(e.target.value)); setSchedDirty(true); }}
              style={{ flex: 1, minWidth: 130, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.875rem', background: 'white' }}
            >
              {DAY_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
            <select
              value={schedHour}
              onChange={e => { setSchedHour(Number(e.target.value)); setSchedDirty(true); }}
              style={{ flex: 1, minWidth: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.875rem', background: 'white' }}
            >
              {hours.map(h => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
            <button
              onClick={() => settingsMutation.mutate({ snapshot_day_of_week: schedDay, snapshot_hour: schedHour })}
              disabled={!schedDirty || settingsMutation.isPending}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: schedDirty ? '#0f172a' : '#e2e8f0',
                color: schedDirty ? 'white' : '#94a3b8',
                fontSize: '0.875rem', fontWeight: 600, cursor: schedDirty ? 'pointer' : 'default',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface TeamMetricsTabProps {
  teamId: number;
  members: TeamMember[];
}

const TeamMetricsTab: React.FC<TeamMetricsTabProps> = ({ teamId, members }) => {
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();
  const [showSettings, setShowSettings] = useState(false);
  const groupModeKey = `team-metrics-group-${teamId}`;
  const [groupMode, setGroupModeState] = useState<GroupMode>(
    () => (localStorage.getItem(groupModeKey) as GroupMode | null) ?? 'member'
  );
  const setGroupMode = (mode: GroupMode) => {
    setGroupModeState(mode);
    localStorage.setItem(groupModeKey, mode);
  };
  const [sortDir, setSortDir] = useState<SortDir>('none');

  const { data: configsRes, isLoading: configsLoading } = useQuery({
    queryKey: ['team-metric-configs', teamId],
    queryFn: () => teamsApi.getMetricConfigs(teamId),
  });
  const configs: TeamMetricConfig[] = configsRes?.data.data ?? [];

  const { data: snapshotsRes, isLoading: snapshotsLoading } = useQuery({
    queryKey: ['team-metric-snapshots', teamId],
    queryFn: () => teamsApi.getMetricSnapshots(teamId),
    enabled: configs.length > 0,
  });
  const snapshots: TeamMetricSnapshot[] = snapshotsRes?.data.data ?? [];

  const { data: currentRes, isLoading: currentLoading } = useQuery({
    queryKey: ['team-metric-current', teamId],
    queryFn: () => teamsApi.getCurrentMetrics(teamId),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });
  const currentMetrics: TeamMetricCurrent[] = currentRes?.data.data ?? [];

  const { data: settingsRes } = useQuery({
    queryKey: ['team-snapshot-settings', teamId],
    queryFn: () => teamsApi.getSnapshotSettings(teamId),
  });
  const snapshotSettings: TeamSnapshotSettings = settingsRes?.data.data ?? {
    team_id: teamId,
    snapshot_day_of_week: 1,
    snapshot_hour: 18,
  };

  const { data: allTeamsRes } = useQuery({
    queryKey: ['all-teams-for-metrics'],
    queryFn: async (): Promise<Team[]> => {
      const r = await teamsApi.getAll();
      return r.data.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const allTeams: Team[] = allTeamsRes ?? [];

  // Inline goal editing: configId → raw string input
  const [editingGoal, setEditingGoal] = useState<{ configId: number; value: string } | null>(null);

  const goalMutation = useMutation({
    mutationFn: ({ configId, goal }: { configId: number; goal: number | null }) =>
      teamsApi.updateMetricConfig(teamId, configId, { goal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-metric-configs', teamId] });
    },
    onError: () => toast.error('Failed to save goal'),
  });

  const commitGoal = (cfg: TeamMetricConfig, raw: string) => {
    setEditingGoal(null);
    const cleaned = raw.trim().replace(/[$,]/g, '');
    const parsed = cleaned === '' ? null : parseFloat(cleaned);
    if (parsed !== null && isNaN(parsed)) return;
    const current = cfg.goal !== null ? Number(cfg.goal) : null;
    if (parsed === current) return;
    goalMutation.mutate({ configId: cfg.id, goal: parsed });
  };

  // Silent background capture — no toast, runs at most once per mount
  const autoCaptureFired = React.useRef(false);
  const silentCaptureMutation = useMutation({
    mutationFn: () => teamsApi.captureMetricSnapshot(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-metric-snapshots', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-metric-current', teamId] });
    },
  });

  useEffect(() => {
    if (autoCaptureFired.current) return;
    if (configs.length === 0 || snapshotsLoading) return;
    const thisWeek = getMonday(new Date()).toISOString().slice(0, 10);
    const hasThisWeek = snapshots.some(s => s.week_start === thisWeek);
    if (!hasThisWeek) {
      autoCaptureFired.current = true;
      silentCaptureMutation.mutate();
    } else {
      autoCaptureFired.current = true; // already have data, don't check again
    }
  }, [configs.length, snapshotsLoading]); // eslint-disable-line

  const weeks = useMemo(() => buildWeekGrid(), []);

  // Snapshot lookup: scopeKey_metricKey → week_start → value
  const snapshotMap = useMemo(() => {
    const map: Record<string, Record<string, number | null>> = {};
    for (const s of snapshots) {
      const key = `${scopeKey(s.member_user_id, s.member_team_id)}_${s.metric_key}`;
      if (!map[key]) map[key] = {};
      map[key][s.week_start] = s.value !== null ? Number(s.value) : null;
    }
    return map;
  }, [snapshots]);

  // Current values lookup: scopeKey_metricKey → value
  const currentMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const c of currentMetrics) {
      const key = `${scopeKey(c.member_user_id, c.member_team_id)}_${c.metric_key}`;
      map[key] = c.value;
    }
    return map;
  }, [currentMetrics]);

  // Build grouped + sorted rows
  const groupedRows = useMemo(() => {
    let sorted = [...configs];
    if (sortDir !== 'none') {
      sorted.sort((a, b) => {
        const aVal = currentMap[rowKey(a)] ?? (sortDir === 'asc' ? Infinity : -Infinity);
        const bVal = currentMap[rowKey(b)] ?? (sortDir === 'asc' ? Infinity : -Infinity);
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    if (groupMode === 'none') {
      return [{ key: 'all', label: null as string | null, isSubTeam: false, rows: sorted }];
    }
    const groups = new Map<string, { label: string; isSubTeam: boolean; rows: TeamMetricConfig[] }>();
    for (const cfg of sorted) {
      let gKey: string;
      let gLabel: string;
      let gIsSubTeam = false;
      if (groupMode === 'member') {
        gKey = scopeKey(cfg.member_user_id, cfg.member_team_id);
        gLabel = getScopeLabel(cfg);
        gIsSubTeam = cfg.member_team_id !== null;
      } else {
        gKey = cfg.metric_key;
        gLabel = METRIC_DEFINITIONS.find(d => d.key === cfg.metric_key)?.label ?? cfg.metric_key;
      }
      if (!groups.has(gKey)) groups.set(gKey, { label: gLabel, isSubTeam: gIsSubTeam, rows: [] });
      groups.get(gKey)!.rows.push(cfg);
    }
    return Array.from(groups.entries()).map(([key, v]) => ({ key, label: v.label, isSubTeam: v.isSubTeam, rows: v.rows }));
  }, [configs, groupMode, sortDir, currentMap]);

  if (configsLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Loading…</div>;
  }

  const isEmpty = configs.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        padding: '10px 16px', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
      }}>
        {/* Group By */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Group by</span>
          {(['none', 'member', 'metric'] as GroupMode[]).map(mode => (
            <button key={mode} onClick={() => setGroupMode(mode)} style={{
              padding: '5px 11px', borderRadius: 6, border: '1px solid',
              borderColor: groupMode === mode ? '#0f172a' : '#e2e8f0',
              background: groupMode === mode ? '#0f172a' : 'white',
              color: groupMode === mode ? 'white' : '#374151',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}>
              {mode === 'none' ? 'None' : mode === 'member' ? 'Member' : 'Metric'}
            </button>
          ))}
          <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Sort</span>
          {([['none', '—'], ['desc', '↓ High'], ['asc', '↑ Low']] as [SortDir, string][]).map(([dir, label]) => (
            <button key={dir} onClick={() => setSortDir(dir)} style={{
              padding: '5px 11px', borderRadius: 6, border: '1px solid',
              borderColor: sortDir === dir ? '#6366f1' : '#e2e8f0',
              background: sortDir === dir ? '#6366f1' : 'white',
              color: sortDir === dir ? 'white' : '#374151',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}>
              {label}
            </button>
          ))}
          {currentLoading && (
            <span style={{ fontSize: '0.75rem', color: '#6366f1', marginLeft: 4 }}>Loading…</span>
          )}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: '#0f172a', color: 'white', fontSize: '0.8125rem',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#64748b' }}>
          <div style={{ fontSize: 40 }}>📊</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>No metrics configured</div>
          <div style={{ fontSize: '0.875rem', maxWidth: 340, textAlign: 'center' }}>
            Click <strong>Settings</strong> to add team members and metrics to track weekly.
          </div>
          <button
            onClick={() => setShowSettings(true)}
            style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Open Settings
          </button>
        </div>
      )}

      {/* Grid */}
      {!isEmpty && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <th style={thStyle(220, true)}>
                  {groupMode === 'metric' ? 'Member / Team' : groupMode === 'member' ? 'Metric' : 'Metric'}
                </th>
                <th style={{ ...thStyle(80), textAlign: 'right', background: '#fefce8', color: '#92400e' }}>Goal</th>
                {weeks.map((w, wi) => (
                  <th key={w} style={thStyle(80)}>
                    <div style={{ fontWeight: wi === weeks.length - 1 ? 700 : 600 }}>{formatWeekStart(w)}</div>
                    <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.7rem' }}>{w.slice(0, 4)}</div>
                  </th>
                ))}
                <th style={{ ...thStyle(88), background: '#f0fdf4', color: '#166534' }}>Current</th>
                <th style={{ ...thStyle(88), background: '#eff6ff', color: '#1e40af' }}>12-Wk Avg</th>
                <th style={{ ...thStyle(72), background: '#fafaf9', color: '#374151' }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(group => {
                const totalCols = weeks.length + 5; // label + goal + weeks + current + avg + trend
                return (
                  <React.Fragment key={group.key}>
                    {/* Group header */}
                    {group.label !== null && (
                      <tr>
                        <td colSpan={totalCols} style={{
                          padding: '5px 12px', background: '#f1f5f9',
                          fontWeight: 700, fontSize: '0.72rem', color: '#334155',
                          borderTop: '2px solid #cbd5e1', borderBottom: '1px solid #e2e8f0',
                          position: 'sticky', left: 0,
                        }}>
                          {group.label}
                          {group.isSubTeam && (
                            <span style={{ marginLeft: 8, background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 600 }}>TEAM</span>
                          )}
                        </td>
                      </tr>
                    )}
                    {/* Data rows */}
                    {group.rows.map((cfg, rowIdx) => {
                      const key = rowKey(cfg);
                      const def = METRIC_DEFINITIONS.find(d => d.key === cfg.metric_key)!;
                      const weekValues = weeks.map(w => snapshotMap[key]?.[w] ?? null);
                      const currentVal = currentMap[key] ?? null;
                      const validValues = weekValues.filter((v): v is number => v !== null);
                      const avg = validValues.length > 0
                        ? validValues.reduce((a, b) => a + b, 0) / validValues.length
                        : null;
                      const goal = cfg.goal !== null ? Number(cfg.goal) : null;
                      const barColor = goalBarColor(weekValues, goal, cfg.lower_is_better);
                      const isSubTeam = cfg.member_team_id !== null;
                      const trend = computeTrend(weekValues);
                      const rowBg = rowIdx % 2 === 0 ? 'white' : '#f8fafc';

                      // Label: shorten when grouped
                      const primaryLabel = groupMode === 'metric'
                        ? getScopeLabel(cfg)
                        : groupMode === 'member'
                          ? (def?.label ?? cfg.metric_key)
                          : cfg.label;
                      const showTeamBadge = isSubTeam && groupMode !== 'member';

                      return (
                        <tr key={cfg.id} style={{ background: rowBg }}>
                          {/* Label */}
                          <td style={{
                            padding: '5px 10px', borderBottom: '1px solid #f1f5f9',
                            position: 'sticky', left: 0, zIndex: 5,
                            background: rowBg, borderRight: '2px solid #e2e8f0', minWidth: 180,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 3, height: 22, borderRadius: 2, background: barColor, flexShrink: 0 }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.75rem' }}>{primaryLabel}</span>
                                {showTeamBadge && (
                                  <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 3, padding: '0px 4px', fontSize: '0.6rem', fontWeight: 600 }}>TEAM</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Goal */}
                          <td style={{
                            padding: '3px 6px', borderBottom: '1px solid #f1f5f9',
                            textAlign: 'right', background: '#fefce8', whiteSpace: 'nowrap',
                          }}>
                            {editingGoal?.configId === cfg.id ? (
                              <input
                                autoFocus
                                type="text"
                                value={editingGoal.value}
                                onChange={e => setEditingGoal({ configId: cfg.id, value: e.target.value })}
                                onBlur={() => commitGoal(cfg, editingGoal.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  if (e.key === 'Escape') setEditingGoal(null);
                                }}
                                style={{
                                  width: 70, padding: '2px 6px', borderRadius: 4,
                                  border: '1px solid #d97706', fontSize: '0.75rem',
                                  textAlign: 'right', background: 'white', outline: 'none',
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => setEditingGoal({ configId: cfg.id, value: goal !== null ? String(goal) : '' })}
                                title="Click to set goal"
                                style={{
                                  cursor: 'text', fontSize: '0.75rem', fontWeight: 600,
                                  color: goal !== null ? '#92400e' : '#d1d5db',
                                  borderBottom: '1px dashed #d97706', paddingBottom: 1,
                                }}
                              >
                                {goal !== null ? formatValue(goal, def?.format ?? 'currency') : '—'}
                              </span>
                            )}
                          </td>

                          {/* Week cells */}
                          {weekValues.map((val, wi) => (
                            <td key={weeks[wi]} style={tdStyle(wi === weeks.length - 1)}>
                              {formatValue(val, def?.format ?? 'currency')}
                            </td>
                          ))}

                          {/* Current */}
                          <td style={{
                            padding: '5px 8px', borderBottom: '1px solid #f1f5f9',
                            textAlign: 'right', fontWeight: 700, fontSize: '0.75rem',
                            background: '#f0fdf4',
                            color: goalColor(currentVal, goal, def?.format ?? 'currency', cfg.lower_is_better), whiteSpace: 'nowrap',
                          }}>
                            {formatValue(currentVal, def?.format ?? 'currency')}
                          </td>

                          {/* 12-Wk Avg */}
                          <td style={{
                            padding: '5px 8px', borderBottom: '1px solid #f1f5f9',
                            textAlign: 'right', fontWeight: 700, fontSize: '0.75rem',
                            background: '#eff6ff',
                            color: goalColor(avg, goal, def?.format ?? 'currency', cfg.lower_is_better), whiteSpace: 'nowrap',
                          }}>
                            {formatValue(avg, def?.format ?? 'currency')}
                          </td>

                          {/* Trend */}
                          <td style={{
                            padding: '5px 6px', borderBottom: '1px solid #f1f5f9',
                            textAlign: 'center', background: '#fafaf9', whiteSpace: 'nowrap',
                          }}>
                            {trend.direction === 'none' ? (
                              <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <span style={{
                                  fontSize: '0.85rem', lineHeight: 1,
                                  color: trend.direction === 'up' ? '#10b981' : trend.direction === 'down' ? '#ef4444' : '#94a3b8',
                                }}>
                                  {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                                </span>
                                {trend.pct !== null && (
                                  <span style={{
                                    fontSize: '0.65rem', fontWeight: 700,
                                    color: trend.direction === 'up' ? '#10b981' : trend.direction === 'down' ? '#ef4444' : '#94a3b8',
                                  }}>
                                    {Math.abs(trend.pct) >= 10
                                      ? `${Math.round(trend.pct)}%`
                                      : `${trend.pct.toFixed(1)}%`}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          teamId={teamId}
          members={members}
          allTeams={allTeams}
          configs={configs}
          settings={snapshotSettings}
          groupMode={groupMode}
          onGroupModeChange={setGroupMode}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

function thStyle(minWidth?: number, sticky?: boolean): React.CSSProperties {
  return {
    padding: '6px 8px',
    borderBottom: '2px solid #e2e8f0',
    textAlign: 'right' as const,
    fontWeight: 600,
    color: '#374151',
    fontSize: '0.7rem',
    whiteSpace: 'nowrap' as const,
    minWidth: minWidth ?? 68,
    ...(sticky ? {
      textAlign: 'left' as const,
      position: 'sticky' as const,
      left: 0,
      background: '#f8fafc',
      zIndex: 11,
      borderRight: '2px solid #e2e8f0',
    } : {}),
  };
}

function tdStyle(isCurrentWeek: boolean): React.CSSProperties {
  return {
    padding: '5px 8px',
    borderBottom: '1px solid #f1f5f9',
    textAlign: 'right' as const,
    color: '#0f172a',
    fontSize: '0.75rem',
    fontWeight: isCurrentWeek ? 700 : 400,
    background: isCurrentWeek ? '#fefce8' : undefined,
    whiteSpace: 'nowrap' as const,
  };
}

export default TeamMetricsTab;
