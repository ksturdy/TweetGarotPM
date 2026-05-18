import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import GroupsIcon from '@mui/icons-material/Groups';
import TuneIcon from '@mui/icons-material/Tune';
import {
  pmWorkloadReportApi,
  pmWorkloadSettingsApi,
  PMWorkloadRow,
  PMWorkloadSavedThresholds,
  WorkloadBucket,
} from '../../services/pmWorkloadReport';
import './PMWorkloadReport.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const fmtHrs = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

// Strip non-digits from input and reformat with comma separators for display.
const formatNumberInput = (raw: string): string => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
};
const parseNumberInput = (formatted: string): number => Number(formatted.replace(/,/g, ''));

const BUCKET_META: Record<WorkloadBucket, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  overloaded: { label: 'Overloaded', color: '#b91c1c', bg: '#fef2f2', icon: <WarningAmberIcon /> },
  available: { label: 'Available Soon', color: '#047857', bg: '#ecfdf5', icon: <HourglassBottomIcon /> },
  sideways: { label: 'Trending Sideways', color: '#b45309', bg: '#fffbeb', icon: <TrendingDownIcon /> },
  healthy: { label: 'Healthy', color: '#15803d', bg: '#f0fdf4', icon: <CheckCircleOutlineIcon /> },
};

type SortKey = 'pmName' | 'activeProjects' | 'backlogDollars' | 'backlogHours' | 'hoursOverEstimate' | 'pctOverEstimate';

const PMWorkloadReport: React.FC = () => {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('backlogHours');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<{ maxBacklogHours: string; maxBacklogDollars: string; lowBacklogHours: string }>({
    maxBacklogHours: '',
    maxBacklogDollars: '',
    lowBacklogHours: '',
  });

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['pm-workload-report', departmentId, teamId],
    queryFn: () => pmWorkloadReportApi.getReport({ departmentId, teamId }).then(res => res.data),
  });

  // Hydrate the settings inputs from the report's current thresholds whenever it loads.
  useEffect(() => {
    if (!report) return;
    setSettingsDraft({
      maxBacklogHours: report.thresholds.maxBacklogHours.toLocaleString('en-US'),
      maxBacklogDollars: report.thresholds.maxBacklogDollars.toLocaleString('en-US'),
      lowBacklogHours: report.thresholds.lowBacklogHours.toLocaleString('en-US'),
    });
  }, [report]);

  const saveSettings = async (payload: PMWorkloadSavedThresholds) => {
    setSavingSettings(true);
    try {
      await pmWorkloadSettingsApi.save(payload);
      await queryClient.invalidateQueries({ queryKey: ['pm-workload-report'] });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveSettings = () => {
    const parsed: PMWorkloadSavedThresholds = {};
    const mh = parseNumberInput(settingsDraft.maxBacklogHours);
    const md = parseNumberInput(settingsDraft.maxBacklogDollars);
    const lh = parseNumberInput(settingsDraft.lowBacklogHours);
    if (Number.isFinite(mh) && mh >= 0) parsed.maxBacklogHours = mh;
    if (Number.isFinite(md) && md >= 0) parsed.maxBacklogDollars = md;
    if (Number.isFinite(lh) && lh >= 0) parsed.lowBacklogHours = lh;
    saveSettings(parsed);
  };

  const handleResetSettings = () => {
    if (!report) return;
    saveSettings({
      maxBacklogHours: report.defaultThresholds.maxBacklogHours,
      maxBacklogDollars: report.defaultThresholds.maxBacklogDollars,
      lowBacklogHours: report.defaultThresholds.lowBacklogHours,
    });
  };

  const sortedPMs = useMemo(() => {
    if (!report) return [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...report.pms].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [report, sortKey, sortDir]);

  const chartData = useMemo(() => {
    if (!report) return null;
    // Top 15 by backlog hours so labels stay readable
    const top = [...report.pms].sort((a, b) => b.backlogHours - a.backlogHours).slice(0, 15);
    return {
      labels: top.map(p => p.pmName),
      datasets: [
        {
          label: 'PF Backlog Hours',
          data: top.map(p => Math.round(p.pfBacklogHours)),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'SM Backlog Hours',
          data: top.map(p => Math.round(p.smBacklogHours)),
          backgroundColor: '#f97316',
        },
        {
          label: 'Other / Unbucketed',
          data: top.map(p => Math.max(0, Math.round(p.backlogHours - p.pfBacklogHours - p.smBacklogHours))),
          backgroundColor: '#9ca3af',
        },
      ],
    };
  }, [report]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="pm-workload">
        <div className="pmw-loading">Loading PM workload report...</div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="pm-workload">
        <h1>PM Workload Report</h1>
        <div className="pmw-empty">
          <GroupsIcon style={{ fontSize: '3rem', color: '#9ca3af' }} />
          <h2>Unable to load report</h2>
          <p>There was an error fetching the report. Please try again.</p>
        </div>
      </div>
    );
  }

  const { attention, unmatched, filterOptions, meta } = report;
  const hasAttention = attention.overloaded.length > 0 || attention.available.length > 0 || attention.sideways.length > 0;

  return (
    <div className="pm-workload">
      {/* Header */}
      <div className="pmw-header">
        <div className="pmw-header-left">
          <Link to="/reports" className="pmw-back">&larr; Back to Reports</Link>
          <h1>PM Workload Report</h1>
          <p>Capacity health and overload signals from Vista contract data</p>
        </div>
        <div className="pmw-header-actions">
          <div className="pmw-filter">
            <label>Department</label>
            <select
              value={departmentId ?? ''}
              onChange={e => setDepartmentId(e.target.value ? parseInt(e.target.value, 10) : null)}
            >
              <option value="">All</option>
              {filterOptions.departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="pmw-filter">
            <label>Team</label>
            <select
              value={teamId ?? ''}
              onChange={e => setTeamId(e.target.value ? parseInt(e.target.value, 10) : null)}
            >
              <option value="">All</option>
              {filterOptions.teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="pmw-settings-btn"
            onClick={() => setShowSettings(s => !s)}
          >
            <TuneIcon style={{ fontSize: '1rem' }} />
            Thresholds
          </button>
        </div>
      </div>

      {showSettings && (
        <section className="pmw-section pmw-settings">
          <h2 className="pmw-section-title">Thresholds</h2>
          <p className="pmw-section-sub">
            Tune the cutoffs Titan uses to flag PMs. Saved per tenant — applies to everyone in the report.
          </p>
          <div className="pmw-settings-grid">
            <div className="pmw-settings-field">
              <label>Overloaded · Backlog Hours</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsDraft.maxBacklogHours}
                onChange={e => setSettingsDraft(d => ({ ...d, maxBacklogHours: formatNumberInput(e.target.value) }))}
              />
              <span className="pmw-settings-hint">PM is overloaded above this many hours (default {report.defaultThresholds.maxBacklogHours.toLocaleString()})</span>
            </div>
            <div className="pmw-settings-field">
              <label>Overloaded · Backlog $</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsDraft.maxBacklogDollars}
                onChange={e => setSettingsDraft(d => ({ ...d, maxBacklogDollars: formatNumberInput(e.target.value) }))}
              />
              <span className="pmw-settings-hint">PM is overloaded above this dollar backlog (default ${report.defaultThresholds.maxBacklogDollars.toLocaleString()})</span>
            </div>
            <div className="pmw-settings-field">
              <label>Available · Backlog Hours</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsDraft.lowBacklogHours}
                onChange={e => setSettingsDraft(d => ({ ...d, lowBacklogHours: formatNumberInput(e.target.value) }))}
              />
              <span className="pmw-settings-hint">PM is "Available Soon" below this many hours (default {report.defaultThresholds.lowBacklogHours.toLocaleString()})</span>
            </div>
          </div>
          <div className="pmw-settings-actions">
            <button type="button" className="pmw-btn pmw-btn-save" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="pmw-btn pmw-btn-reset" onClick={handleResetSettings} disabled={savingSettings}>
              Reset to Defaults
            </button>
          </div>
        </section>
      )}

      {/* Attention list — the headline */}
      <section className="pmw-section">
        <h2 className="pmw-section-title">Attention List</h2>
        <p className="pmw-section-sub">PMs Titan flags based on active workload and forecast creep.</p>

        {!hasAttention && (
          <div className="pmw-empty-attention">
            <CheckCircleOutlineIcon style={{ color: '#15803d' }} />
            <span>No PMs are currently flagged. Everyone is below the configured thresholds.</span>
          </div>
        )}

        {attention.overloaded.length > 0 && (
          <div className="pmw-bucket">
            <div className="pmw-bucket-header" style={{ background: BUCKET_META.overloaded.bg, color: BUCKET_META.overloaded.color }}>
              {BUCKET_META.overloaded.icon}
              <span>Overloaded · {attention.overloaded.length}</span>
            </div>
            <div className="pmw-cards">
              {attention.overloaded.map(pm => (
                <AttentionCard key={pm.key} pm={pm} bucket="overloaded" />
              ))}
            </div>
          </div>
        )}

        {attention.available.length > 0 && (
          <div className="pmw-bucket">
            <div className="pmw-bucket-header" style={{ background: BUCKET_META.available.bg, color: BUCKET_META.available.color }}>
              {BUCKET_META.available.icon}
              <span>Available Soon · {attention.available.length}</span>
            </div>
            <div className="pmw-cards">
              {attention.available.map(pm => (
                <AttentionCard key={pm.key} pm={pm} bucket="available" />
              ))}
            </div>
          </div>
        )}

        {attention.sideways.length > 0 && (
          <div className="pmw-bucket">
            <div className="pmw-bucket-header" style={{ background: BUCKET_META.sideways.bg, color: BUCKET_META.sideways.color }}>
              {BUCKET_META.sideways.icon}
              <span>Trending Sideways · {attention.sideways.length}</span>
            </div>
            <div className="pmw-cards">
              {attention.sideways.map(pm => (
                <AttentionCard key={pm.key} pm={pm} bucket="sideways" />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Chart */}
      {chartData && (
        <section className="pmw-section">
          <h2 className="pmw-section-title">Backlog Hours by PM</h2>
          <p className="pmw-section-sub">Top 15 PMs by remaining hours, split by trade.</p>
          <div className="pmw-chart">
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' as const },
                  tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtHrs(ctx.parsed.y ?? 0)} hrs` } },
                },
                scales: {
                  x: { stacked: true },
                  y: { stacked: true, ticks: { callback: (v) => `${v}` } },
                },
              }}
            />
          </div>
        </section>
      )}

      {/* Full table */}
      <section className="pmw-section">
        <h2 className="pmw-section-title">All PMs</h2>
        <p className="pmw-section-sub">{meta.activeContractsCounted} active contracts across {report.pms.length} PMs.</p>
        <div className="pmw-table-wrapper">
          <table className="pmw-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('pmName')}>PM</th>
                <th>Department</th>
                <th className="num sortable" onClick={() => handleSort('activeProjects')}>Active Projects</th>
                <th className="num sortable" onClick={() => handleSort('backlogDollars')}>Backlog $</th>
                <th className="num sortable" onClick={() => handleSort('backlogHours')}>Backlog Hours</th>
                <th className="num sortable" onClick={() => handleSort('hoursOverEstimate')}>Hours Over Est.</th>
                <th className="num sortable" onClick={() => handleSort('pctOverEstimate')}>% Over Est.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedPMs.map(pm => (
                <tr key={pm.key} className={`pmw-row-${pm.bucket}`}>
                  <td>
                    {pm.pmName}
                    {!pm.linked && <span className="pmw-unlinked" title="Contract not linked to an employee">unlinked</span>}
                  </td>
                  <td>{pm.departmentName || <span className="pmw-muted">—</span>}</td>
                  <td className="num">{pm.activeProjects}</td>
                  <td className="num">{fmtMoney(pm.backlogDollars)}</td>
                  <td className="num">{fmtHrs(pm.backlogHours)}</td>
                  <td className="num">{pm.hoursOverEstimate > 0 ? fmtHrs(pm.hoursOverEstimate) : '—'}</td>
                  <td className="num">{pm.activeProjects > 0 ? `${Math.round(pm.pctOverEstimate * 100)}%` : '—'}</td>
                  <td>
                    <span className="pmw-pill" style={{ background: BUCKET_META[pm.bucket].bg, color: BUCKET_META[pm.bucket].color }}>
                      {BUCKET_META[pm.bucket].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {unmatched.contractCount > 0 && (
          <div className="pmw-warning">
            <WarningAmberIcon style={{ fontSize: '1rem' }} />
            <span>
              {unmatched.contractCount} contract{unmatched.contractCount === 1 ? '' : 's'} ({fmtHrs(unmatched.backlogHours)} backlog hrs)
              {' '}aren't linked to an employee — they're grouped by PM name only and won't respond to department/team filters.
              Link them from the Vista Data page to get cleaner numbers.
            </span>
          </div>
        )}
      </section>
    </div>
  );
};

const AttentionCard: React.FC<{ pm: PMWorkloadRow; bucket: WorkloadBucket }> = ({ pm, bucket }) => {
  const meta = BUCKET_META[bucket];
  return (
    <div className="pmw-card" style={{ borderLeftColor: meta.color }}>
      <div className="pmw-card-header">
        <strong>{pm.pmName}</strong>
        {pm.departmentName && <span className="pmw-card-dept">{pm.departmentName}</span>}
      </div>
      <div className="pmw-card-stats">
        <div><span className="pmw-stat-num">{pm.activeProjects}</span><span className="pmw-stat-lbl">projects</span></div>
        <div><span className="pmw-stat-num">{fmtHrs(pm.backlogHours)}</span><span className="pmw-stat-lbl">backlog hrs</span></div>
        <div><span className="pmw-stat-num">{fmtMoney(pm.backlogDollars)}</span><span className="pmw-stat-lbl">backlog $</span></div>
      </div>
      {pm.reasons.length > 0 && (
        <ul className="pmw-card-reasons">
          {pm.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </div>
  );
};

export default PMWorkloadReport;
