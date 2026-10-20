import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { projectsApi } from '../../../services/projects';
import { fieldIssuesApi, TRADE_OPTIONS } from '../../../services/fieldIssues';
import { exportListToPdf } from '../../../utils/listExportPdf';

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
  in_progress: '#3b82f6',
  resolved: '#10b981',
  closed: '#94a3b8',
};

const ProjectIssuesLogReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const { tenant } = useAuth();
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterTrade, setFilterTrade] = useState('all');

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

  const { data: allIssues = [] } = useQuery({
    queryKey: ['field-issues', pid],
    queryFn: () => fieldIssuesApi.getByProject(pid).then(r => r.data),
    enabled: !!pid,
  });

  const filtered = useMemo(() => {
    return allIssues.filter(issue => {
      if (filterStatus !== 'all' && issue.status !== filterStatus) return false;
      if (filterPriority !== 'all' && issue.priority !== filterPriority) return false;
      if (filterTrade !== 'all' && issue.trade !== filterTrade) return false;
      return true;
    });
  }, [allIssues, filterStatus, filterPriority, filterTrade]);

  const totalCount = allIssues.length;
  const openCount = allIssues.filter(i => i.status !== 'closed' && i.status !== 'resolved').length;
  const closedCount = allIssues.filter(i => i.status === 'closed' || i.status === 'resolved').length;
  const urgentCount = allIssues.filter(i => (i.status !== 'closed' && i.status !== 'resolved') && (i.priority === 'urgent' || i.priority === 'high')).length;

  const tradeOptions = [{ value: 'all', label: 'All Trades' }, ...TRADE_OPTIONS.map(t => ({ value: t.value, label: t.label }))];

  function handleExportPdf() {
    const subtitleParts: string[] = [];
    if (filterStatus !== 'all') subtitleParts.push(`Status: ${filterStatus}`);
    if (filterPriority !== 'all') subtitleParts.push(`Priority: ${filterPriority}`);
    if (filterTrade !== 'all') subtitleParts.push(`Trade: ${filterTrade}`);
    const subtitle = subtitleParts.length > 0 ? `${project?.name ?? ''} — Filters: ${subtitleParts.join(', ')}` : project?.name ?? '';

    const rows = filtered.map(issue => ({
      number: String(issue.number),
      title: issue.title,
      priority: issue.priority,
      trade: issue.trade ?? '—',
      status: issue.status,
      source: issue.source,
      createdBy: issue.created_by_name,
      date: fmtDate(issue.created_at),
      location: issue.location ?? '—',
    }));

    exportListToPdf({
      title: 'Issues Log',
      subtitle,
      columns: [
        { header: '#', key: 'number', align: 'center', width: 0.5 },
        { header: 'Title', key: 'title', align: 'left', width: 3 },
        { header: 'Priority', key: 'priority', align: 'center', width: 1 },
        { header: 'Trade', key: 'trade', align: 'left', width: 1 },
        { header: 'Status', key: 'status', align: 'center', width: 1 },
        { header: 'Source', key: 'source', align: 'left', width: 1 },
        { header: 'Created By', key: 'createdBy', align: 'left', width: 1.5 },
        { header: 'Date', key: 'date', align: 'center', width: 1.2 },
        { header: 'Location', key: 'location', align: 'left', width: 1.5 },
      ],
      rows,
      summaryRows: [
        { label: 'Total', value: String(totalCount) },
        { label: 'Open', value: String(openCount) },
        { label: 'Closed', value: String(closedCount) },
        { label: 'High/Urgent', value: String(urgentCount), valueColor: urgentCount > 0 ? [239, 68, 68] : undefined },
      ],
      orientation: 'landscape',
      fileName: `issues-log-${projectId}.pdf`,
      logoDataUrl,
      accentColor: [249, 115, 22],
      cellStyleFn: (key, value) => {
        if (key === 'priority') {
          return { textColor: PRIORITY_PDF[value.toLowerCase()] ?? [30, 41, 59] };
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
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Issues Log</h1>
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
          { label: 'Total', value: totalCount },
          { label: 'Open', value: openCount },
          { label: 'Closed', value: closedCount },
          { label: 'High/Urgent', value: urgentCount, color: urgentCount > 0 ? '#ef4444' : '#0f172a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 1.25rem', minWidth: 100 }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: (s as any).color ?? '#0f172a' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={selectStyle}>
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select value={filterTrade} onChange={e => setFilterTrade(e.target.value)} style={selectStyle}>
          {tradeOptions.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Showing {filtered.length} of {totalCount}</span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', 'Title', 'Priority', 'Trade', 'Status', 'Source', 'Created By', 'Date', 'Location'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: ['#'].includes(h) ? 'center' : 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No issues match the selected filters.</td>
                </tr>
              ) : (
                filtered.map((issue, idx) => (
                  <tr key={issue.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{issue.number}</td>
                    <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                        background: `${PRIORITY_COLORS[issue.priority] ?? '#94a3b8'}18`,
                        color: PRIORITY_COLORS[issue.priority] ?? '#94a3b8',
                        textTransform: 'capitalize',
                      }}>
                        {issue.priority}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#475569', textTransform: 'capitalize' }}>{issue.trade ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                        background: `${STATUS_COLORS[issue.status] ?? '#94a3b8'}18`,
                        color: STATUS_COLORS[issue.status] ?? '#94a3b8',
                        textTransform: 'capitalize',
                      }}>
                        {issue.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#475569', textTransform: 'capitalize' }}>{issue.source}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{issue.created_by_name}</td>
                    <td style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(issue.created_at)}</td>
                    <td style={{ padding: '8px 12px', color: '#475569', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.location ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectIssuesLogReport;
