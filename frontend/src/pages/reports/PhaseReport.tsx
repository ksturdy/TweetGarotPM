import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { phaseReportApi, PhaseReportRow, PhaseReportParams } from '../../services/phaseReport';
import { teamsApi, Team } from '../../services/teams';

const fmtHours = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

const parseNum = (v: number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const SortIcon: React.FC<{ col: string; sortCol: string; sortDir: string }> = ({ col, sortCol, sortDir }) => (
  <span style={{ marginLeft: 4, opacity: sortCol === col ? 1 : 0.3 }}>
    {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
  </span>
);

interface MsOption { value: string; label: string; }

const MultiSelectDropdown: React.FC<{
  label: string;
  options: MsOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  minWidth?: number;
  showSelectAll?: boolean;
}> = ({ label, options, selected, onChange, placeholder = 'All', minWidth = 130, showSelectAll = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(o => !search || o.label.toLowerCase().includes(search.toLowerCase()));

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>
        {label}{selected.length > 0 && <span style={{ color: '#F37B03' }}> ({selected.length})</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder={selected.length > 0 ? `${selected.length} selected` : placeholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', borderRadius: 5, border: '1px solid #cbd5e1', width: minWidth }}
        />
        {open && filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: 220, overflowY: 'auto', minWidth, marginTop: 2,
          }}>
            {showSelectAll && search && (
              <div
                onClick={() => onChange([...new Set([...selected, ...filtered.map(o => o.value)])])}
                style={{
                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600,
                  color: '#1e40af', background: '#dbeafe', cursor: 'pointer',
                  borderBottom: '1px solid #bfdbfe', userSelect: 'none',
                }}
              >
                ✓ Select all {filtered.length} matching &ldquo;{search}&rdquo;
              </div>
            )}
            {filtered.slice(0, 100).map(o => (
              <label key={o.value} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                cursor: 'pointer', fontSize: '0.78rem', color: '#334155',
                background: selected.includes(o.value) ? '#eff6ff' : undefined,
              }}>
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  style={{ accentColor: '#1a2b4a' }}
                />
                {o.label}
              </label>
            ))}
            {filtered.length > 100 && (
              <div style={{ padding: '4px 10px', fontSize: '0.72rem', color: '#94a3b8' }}>
                {filtered.length - 100} more — refine your search
              </div>
            )}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
          {selected.map(v => {
            const displayLabel = options.find(o => o.value === v)?.label ?? v;
            return (
              <span key={v} style={{
                fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8,
                background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', gap: 3,
              }}>
                {displayLabel}
                <button onClick={() => toggle(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: '0.75rem', lineHeight: 1, padding: 0 }}>×</button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PhaseReport: React.FC = () => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>(['Open', 'Soft-Closed']);
  const [billMethods, setBillMethods] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [sortCol, setSortCol] = useState<'job_number' | 'phase_code' | 'est_hours' | 'jtd_hours' | 'burn'>('job_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const activeParams: PhaseReportParams = {
    departments: departments.length > 0 ? departments : undefined,
    statuses: statuses.length > 0 ? statuses : undefined,
    bill_methods: billMethods.length > 0 ? billMethods : undefined,
    teams: teams.length > 0 ? teams : undefined,
    phases: selectedPhases.length > 0 ? selectedPhases : undefined,
  };

  const { data: rows = [], isLoading } = useQuery<PhaseReportRow[]>({
    queryKey: ['phase-report', activeParams],
    queryFn: () => phaseReportApi.getData(activeParams),
    staleTime: 2 * 60 * 1000,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['phase-report-filters'],
    queryFn: () => phaseReportApi.getFilters(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll().then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  const deptOptions: MsOption[] = useMemo(
    () => (filterOptions?.departments ?? []).map(d => ({ value: d, label: d })),
    [filterOptions?.departments]
  );
  const statusOptions: MsOption[] = useMemo(
    () => (filterOptions?.statuses ?? []).map(s => ({ value: s, label: s })),
    [filterOptions?.statuses]
  );
  const billMethodOptions: MsOption[] = useMemo(
    () => (filterOptions?.billMethods ?? []).map(b => ({ value: b, label: b })),
    [filterOptions?.billMethods]
  );
  const teamOptions: MsOption[] = useMemo(
    () => (teamsData ?? []).map((t: Team) => ({ value: String(t.id), label: t.name })),
    [teamsData]
  );
  const phaseOptions: MsOption[] = useMemo(
    () => (filterOptions?.phases ?? []).map(p => ({ value: p, label: p })),
    [filterOptions?.phases]
  );

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortCol === 'job_number') { av = a.job_number || ''; bv = b.job_number || ''; }
      else if (sortCol === 'phase_code') { av = a.phase_code || ''; bv = b.phase_code || ''; }
      else if (sortCol === 'est_hours') { av = parseNum(a.est_hours); bv = parseNum(b.est_hours); }
      else if (sortCol === 'jtd_hours') { av = parseNum(a.jtd_hours); bv = parseNum(b.jtd_hours); }
      else if (sortCol === 'burn') {
        av = parseNum(a.est_hours) > 0 ? parseNum(a.jtd_hours) / parseNum(a.est_hours) : 0;
        bv = parseNum(b.est_hours) > 0 ? parseNum(b.jtd_hours) / parseNum(b.est_hours) : 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortCol, sortDir]);

  const totals = useMemo(() => ({
    est: rows.reduce((s, r) => s + parseNum(r.est_hours), 0),
    jtd: rows.reduce((s, r) => s + parseNum(r.jtd_hours), 0),
    distinctJobs: new Set(rows.map(r => r.job_number)).size,
  }), [rows]);

  const handleSort = (col: typeof sortCol) => {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setDepartments([]);
    setStatuses([]);
    setBillMethods([]);
    setTeams([]);
    setSelectedPhases([]);
  };

  const anyFilter = departments.length > 0 || statuses.length > 0 || billMethods.length > 0 || teams.length > 0 || selectedPhases.length > 0;

  const selectedTeamNames = (teamsData ?? [])
    .filter((t: Team) => teams.includes(String(t.id)))
    .map((t: Team) => t.name);

  const activeParamsForExport: PhaseReportParams = {
    ...activeParams,
    teamNames: selectedTeamNames.length > 0 ? selectedTeamNames : undefined,
  };

  const handlePdf = async () => {
    setPdfLoading(true);
    try { await phaseReportApi.downloadPdf(activeParamsForExport); }
    finally { setPdfLoading(false); }
  };

  const handleExcel = async () => {
    setExcelLoading(true);
    try { await phaseReportApi.downloadExcel(activeParamsForExport); }
    finally { setExcelLoading(false); }
  };

  const thStyle = (col: typeof sortCol): React.CSSProperties => ({
    padding: '8px 10px',
    textAlign: (col === 'job_number' || col === 'phase_code') ? 'left' : 'right',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#fff',
    background: '#1a2b4a',
  });

  const thBase: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#fff',
    background: '#1a2b4a',
  };

  const burnColor = (est: number, jtd: number): string => {
    if (!est) return '#475569';
    const pct = jtd / est;
    if (pct > 1.1) return '#dc2626';
    if (pct > 0.9) return '#d97706';
    return '#16a34a';
  };

  return (
    <div style={{ padding: '1.25rem', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/reports" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.8rem' }}>
          &larr; Reports
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#1a2b4a' }}>Phase Report</h1>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
              Vista job hours by phase &mdash; {isLoading ? '…' : `${totals.distinctJobs} job${totals.distinctJobs !== 1 ? 's' : ''}, ${rows.length} phase${rows.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleExcel}
              disabled={excelLoading || isLoading}
              className="sales-btn sales-btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.9rem' }}
            >
              {excelLoading ? 'Generating…' : '⬇ Excel'}
            </button>
            <button
              onClick={handlePdf}
              disabled={pdfLoading || isLoading}
              className="sales-btn"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.9rem', background: '#1a2b4a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              {pdfLoading ? 'Generating…' : '⬇ PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', position: 'relative', zIndex: 20, overflow: 'visible' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <MultiSelectDropdown
            label="Department"
            options={deptOptions}
            selected={departments}
            onChange={setDepartments}
            placeholder="All Departments"
            minWidth={140}
          />
          <MultiSelectDropdown
            label="Status"
            options={statusOptions}
            selected={statuses}
            onChange={setStatuses}
            placeholder="All Statuses"
            minWidth={130}
          />
          <MultiSelectDropdown
            label="Bill Method"
            options={billMethodOptions}
            selected={billMethods}
            onChange={setBillMethods}
            placeholder="All Bill Methods"
            minWidth={140}
          />
          <MultiSelectDropdown
            label="Team"
            options={teamOptions}
            selected={teams}
            onChange={setTeams}
            placeholder="All Teams"
            minWidth={130}
          />
          <MultiSelectDropdown
            label="Phase"
            options={phaseOptions}
            selected={selectedPhases}
            onChange={setSelectedPhases}
            placeholder="Search phases…"
            minWidth={150}
            showSelectAll
          />
          {anyFilter && (
            <button
              onClick={clearFilters}
              style={{ fontSize: '0.75rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-end', marginBottom: 4 }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '0.75rem' }}>
        {[
          { label: 'Total Jobs', value: totals.distinctJobs.toLocaleString() },
          { label: 'Est Hours', value: fmtHours(totals.est) },
          { label: 'JTD Hours', value: fmtHours(totals.jtd) },
          { label: 'Burn %', value: totals.est > 0 ? `${((totals.jtd / totals.est) * 100).toFixed(1)}%` : '-' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '0.6rem 0.85rem' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 600, color: '#64748b', letterSpacing: '0.04em' }}>{kpi.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2b4a', marginTop: 2 }}>{isLoading ? '…' : kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No jobs match the selected filters.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle('job_number'), textAlign: 'left' }} onClick={() => handleSort('job_number')}>
                  Job # <SortIcon col="job_number" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th style={{ ...thBase, textAlign: 'left' }}>Job Name</th>
                <th style={{ ...thBase, textAlign: 'left' }}>PM</th>
                <th style={{ ...thStyle('phase_code'), textAlign: 'left' }} onClick={() => handleSort('phase_code')}>
                  Phase Code <SortIcon col="phase_code" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th style={{ ...thBase, textAlign: 'left' }}>Phase Name</th>
                <th style={{ ...thBase, textAlign: 'center' }}>Dept</th>
                <th style={{ ...thBase, textAlign: 'center' }}>Status</th>
                <th style={{ ...thBase, textAlign: 'center' }}>Bill Method</th>
                <th style={{ ...thStyle('est_hours'), textAlign: 'right' }} onClick={() => handleSort('est_hours')}>
                  Est Hours <SortIcon col="est_hours" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th style={{ ...thStyle('jtd_hours'), textAlign: 'right' }} onClick={() => handleSort('jtd_hours')}>
                  JTD Hours <SortIcon col="jtd_hours" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th style={{ ...thStyle('burn'), textAlign: 'right' }} onClick={() => handleSort('burn')}>
                  Burn % <SortIcon col="burn" sortCol={sortCol} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const est = parseNum(row.est_hours);
                const jtd = parseNum(row.jtd_hours);
                const burn = est > 0 ? (jtd / est) * 100 : null;
                return (
                  <tr
                    key={`${row.job_number}-${row.phase_code || ''}`}
                    style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f8fafc')}
                  >
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#1e3a5f', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{row.job_number}</td>
                    <td style={{ padding: '7px 10px', color: '#334155', fontSize: '0.8rem', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.job_name || '-'}</td>
                    <td style={{ padding: '7px 10px', color: '#475569', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{row.manager_name || '-'}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 500, color: '#1e3a5f', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{row.phase_code || '-'}</td>
                    <td style={{ padding: '7px 10px', color: '#475569', fontSize: '0.78rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.phase_name || '-'}</td>
                    <td style={{ padding: '7px 10px', color: '#475569', fontSize: '0.78rem', textAlign: 'center' }}>{row.department_code || '-'}</td>
                    <td style={{ padding: '7px 10px', fontSize: '0.78rem', textAlign: 'center' }}>
                      {row.status ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                          background: row.status.toLowerCase().includes('open') ? '#dcfce7' : '#f1f5f9',
                          color: row.status.toLowerCase().includes('open') ? '#166534' : '#475569',
                        }}>{row.status}</span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#475569', fontSize: '0.78rem', textAlign: 'center' }}>{row.bill_method || '-'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.8rem', color: '#1a2b4a' }}>{fmtHours(row.est_hours)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.8rem', color: '#1a2b4a' }}>{fmtHours(row.jtd_hours)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', color: burn !== null ? burnColor(est, jtd) : '#94a3b8' }}>
                      {burn !== null ? `${burn.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1a2b4a', color: '#fff' }}>
                <td colSpan={8} style={{ padding: '7px 10px', fontWeight: 700, fontSize: '0.8rem' }}>TOTAL ({totals.distinctJobs} jobs · {rows.length} phases)</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem' }}>{fmtHours(totals.est)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem' }}>{fmtHours(totals.jtd)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem' }}>
                  {totals.est > 0 ? `${((totals.jtd / totals.est) * 100).toFixed(1)}%` : '-'}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

export default PhaseReport;
