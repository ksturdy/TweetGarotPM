import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { projectsApi } from '../../../services/projects';
import { rfisApi } from '../../../services/rfis';
import { exportListToPdf } from '../../../utils/listExportPdf';

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtDate = (v: string | null | undefined) =>
  v == null ? '—' : new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type RGB = [number, number, number];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  normal: '#3b82f6',
  low: '#94a3b8',
};
const PRIORITY_PDF: Record<string, RGB> = {
  urgent: [239, 68, 68],
  high: [249, 115, 22],
  normal: [59, 130, 246],
  low: [148, 163, 184],
};

const STATUS_COLORS: Record<string, string> = {
  open: '#f59e0b',
  responded: '#3b82f6',
  closed: '#94a3b8',
};
const STATUS_PDF: Record<string, RGB> = {
  open: [245, 158, 11],
  responded: [59, 130, 246],
  closed: [148, 163, 184],
};

const ProjectRFILogReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const { tenant } = useAuth();
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  useEffect(() => {
    if (!tenant?.settings?.branding?.logo_url) return;
    const token = localStorage.getItem('token');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/tenant/logo', true);
    xhr.responseType = 'blob';
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status !== 200) return;
      const reader = new FileReader();
      reader.onloadend = () => setLogoDataUrl(reader.result as string);
      reader.readAsDataURL(xhr.response);
    };
    xhr.send();
  }, [tenant]);

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => projectsApi.getById(pid).then(r => r.data),
    enabled: !!pid,
  });

  const { data: allRFIs = [] } = useQuery({
    queryKey: ['rfis', pid],
    queryFn: () => rfisApi.getByProject(pid).then(r => r.data),
    enabled: !!pid,
  });

  const filtered = useMemo(() => {
    return allRFIs.filter(rfi => {
      if (filterStatus !== 'all' && rfi.status !== filterStatus) return false;
      if (filterPriority !== 'all' && rfi.priority !== filterPriority) return false;
      return true;
    });
  }, [allRFIs, filterStatus, filterPriority]);

  const now = new Date();
  const totalCount = allRFIs.length;
  const openCount = allRFIs.filter(r => r.status !== 'closed').length;
  const closedCount = allRFIs.filter(r => r.status === 'closed').length;
  const overdueCount = allRFIs.filter(r => r.status !== 'closed' && r.due_date && new Date(r.due_date) < now).length;
  const costImpactCount = allRFIs.filter(r => r.cost_impact).length;
  const schedImpactCount = allRFIs.filter(r => r.schedule_impact).length;

  function handleExportPdf() {
    const subtitleParts: string[] = [];
    if (filterStatus !== 'all') subtitleParts.push(`Status: ${filterStatus}`);
    if (filterPriority !== 'all') subtitleParts.push(`Priority: ${filterPriority}`);
    const subtitle = subtitleParts.length > 0 ? `${project?.name ?? ''} — Filters: ${subtitleParts.join(', ')}` : project?.name ?? '';

    const rows: Record<string, string | number>[] = filtered.map(rfi => ({
      number: String(rfi.number),
      subject: rfi.subject,
      priority: rfi.priority,
      status: rfi.status,
      discipline: rfi.discipline ?? '—',
      dueDate: fmtDate(rfi.due_date),
      ballInCourt: rfi.ball_in_court_name ?? '—',
      respondedBy: rfi.responded_by_name ?? '—',
      costImpact: rfi.cost_impact ? (rfi.cost_impact_amount != null ? fmt(rfi.cost_impact_amount) : 'Yes') : 'No',
      schedImpact: rfi.schedule_impact ? (rfi.schedule_impact_days != null ? `${rfi.schedule_impact_days}d` : 'Yes') : 'No',
      date: fmtDate(rfi.created_at),
    }));

    exportListToPdf({
      title: 'RFI Log',
      subtitle,
      columns: [
        { header: '#', key: 'number', align: 'center', width: 0.5 },
        { header: 'Subject', key: 'subject', align: 'left', width: 3 },
        { header: 'Priority', key: 'priority', align: 'center', width: 0.9 },
        { header: 'Status', key: 'status', align: 'center', width: 0.9 },
        { header: 'Discipline', key: 'discipline', align: 'left', width: 1 },
        { header: 'Due Date', key: 'dueDate', align: 'center', width: 1.1 },
        { header: 'Ball In Court', key: 'ballInCourt', align: 'left', width: 1.5 },
        { header: 'Responded By', key: 'respondedBy', align: 'left', width: 1.5 },
        { header: 'Cost Impact', key: 'costImpact', align: 'right', width: 1 },
        { header: 'Sched Impact', key: 'schedImpact', align: 'center', width: 0.9 },
        { header: 'Date', key: 'date', align: 'center', width: 1.1 },
      ],
      rows,
      summaryRows: [
        { label: 'Total', value: String(totalCount) },
        { label: 'Open', value: String(openCount) },
        { label: 'Closed', value: String(closedCount) },
        { label: 'Overdue', value: String(overdueCount), valueColor: overdueCount > 0 ? [239, 68, 68] : undefined },
        { label: 'Cost Impact', value: String(costImpactCount) },
        { label: 'Sched Impact', value: String(schedImpactCount) },
      ],
      orientation: 'landscape',
      fileName: `rfi-log-${projectId}.pdf`,
      logoDataUrl,
      accentColor: [249, 115, 22],
      cellStyleFn: (key, value) => {
        if (key === 'priority') {
          return { textColor: PRIORITY_PDF[value.toLowerCase()] ?? [30, 41, 59] };
        }
        if (key === 'status') {
          return { textColor: STATUS_PDF[value.toLowerCase()] ?? [30, 41, 59] };
        }
        return undefined;
      },
    });
  }

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem', color: '#374151', background: '#fff', cursor: 'pointer',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>{project?.name ?? ''}</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>RFI Log</h1>
        </div>
        <button
          onClick={handleExportPdf}
          style={{ padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
        >
          Export PDF
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { label: 'Total', value: totalCount, color: '#0f172a' },
          { label: 'Open', value: openCount, color: '#0f172a' },
          { label: 'Closed', value: closedCount, color: '#94a3b8' },
          { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? '#ef4444' : '#0f172a' },
          { label: 'Cost Impact', value: costImpactCount, color: '#0f172a' },
          { label: 'Sched Impact', value: schedImpactCount, color: '#0f172a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 1.25rem', minWidth: 100 }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="responded">Responded</option>
          <option value="closed">Closed</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={selectStyle}>
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Showing {filtered.length} of {totalCount}</span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', 'Subject', 'Priority', 'Status', 'Discipline', 'Due Date', 'Ball In Court', 'Responded By', 'Cost Impact', 'Sched Impact', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px',
                    textAlign: ['Cost Impact'].includes(h) ? 'right' : ['#', 'Priority', 'Status', 'Sched Impact', 'Due Date', 'Date'].includes(h) ? 'center' : 'left',
                    color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '0.78rem'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No RFIs match the selected filters.</td>
                </tr>
              ) : (
                filtered.map((rfi, idx) => {
                  const isOverdue = rfi.status !== 'closed' && rfi.due_date && new Date(rfi.due_date) < now;
                  return (
                    <tr key={rfi.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{rfi.number}</td>
                      <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rfi.subject}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                          background: `${PRIORITY_COLORS[rfi.priority] ?? '#94a3b8'}18`,
                          color: PRIORITY_COLORS[rfi.priority] ?? '#94a3b8',
                          textTransform: 'capitalize',
                        }}>
                          {rfi.priority}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                          background: `${STATUS_COLORS[rfi.status] ?? '#94a3b8'}18`,
                          color: STATUS_COLORS[rfi.status] ?? '#94a3b8',
                          textTransform: 'capitalize',
                        }}>
                          {rfi.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#475569', textTransform: 'capitalize' }}>{rfi.discipline ?? '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: isOverdue ? '#ef4444' : '#475569', fontWeight: isOverdue ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {fmtDate(rfi.due_date)}
                        {isOverdue && <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>▲</span>}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{rfi.ball_in_court_name ?? '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{rfi.responded_by_name ?? '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: rfi.cost_impact ? '#0f172a' : '#94a3b8' }}>
                        {rfi.cost_impact ? (rfi.cost_impact_amount != null ? fmt(rfi.cost_impact_amount) : 'Yes') : 'No'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: rfi.schedule_impact ? '#f59e0b' : '#94a3b8', fontWeight: rfi.schedule_impact ? 600 : 400 }}>
                        {rfi.schedule_impact ? (rfi.schedule_impact_days != null ? `${rfi.schedule_impact_days}d` : 'Yes') : 'No'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(rfi.created_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectRFILogReport;
