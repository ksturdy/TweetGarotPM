import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { projectsApi } from '../../../services/projects';
import { changeOrdersApi } from '../../../services/changeOrders';
import { exportListToPdf } from '../../../utils/listExportPdf';

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtDate = (v: string | null | undefined) =>
  v == null ? '—' : new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type RGB = [number, number, number];

const STATUS_COLORS: Record<string, string> = {
  approved: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444',
  draft: '#94a3b8',
};
const STATUS_PDF: Record<string, RGB> = {
  approved: [16, 185, 129],
  pending: [245, 158, 11],
  rejected: [239, 68, 68],
  draft: [148, 163, 184],
};

const ProjectChangeOrderLogReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const { tenant } = useAuth();
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState('all');

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

  const { data: allCOs = [] } = useQuery({
    queryKey: ['change-orders', pid],
    queryFn: () => changeOrdersApi.getByProject(pid).then(r => r.data),
    enabled: !!pid,
  });

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return allCOs;
    return allCOs.filter(co => co.status === filterStatus);
  }, [allCOs, filterStatus]);

  const totalCount = allCOs.length;
  const approvedCOs = allCOs.filter(c => c.status === 'approved');
  const approvedCount = approvedCOs.length;
  const approvedAmount = approvedCOs.reduce((s, c) => s + (c.amount ?? 0), 0);
  const approvedDays = approvedCOs.reduce((s, c) => s + (c.days_added ?? 0), 0);
  const pendingCOs = allCOs.filter(c => c.status === 'pending');
  const pendingCount = pendingCOs.length;
  const pendingAmount = pendingCOs.reduce((s, c) => s + (c.amount ?? 0), 0);

  function handleExportPdf() {
    const subtitle = filterStatus !== 'all'
      ? `${project?.name ?? ''} — Status: ${filterStatus}`
      : project?.name ?? '';

    const rows = filtered.map(co => ({
      number: String(co.number),
      title: co.title,
      reason: co.reason,
      amount: fmt(co.amount),
      days: co.days_added != null ? String(co.days_added) : '0',
      status: co.status,
      createdBy: co.created_by_name,
      approvedBy: co.approved_by_name ?? '—',
      date: fmtDate(co.created_at),
    }));

    exportListToPdf({
      title: 'Change Order Log',
      subtitle,
      columns: [
        { header: '#', key: 'number', align: 'center', width: 0.5 },
        { header: 'Title', key: 'title', align: 'left', width: 3 },
        { header: 'Reason', key: 'reason', align: 'left', width: 2 },
        { header: 'Amount', key: 'amount', align: 'right', width: 1.2 },
        { header: 'Days Added', key: 'days', align: 'center', width: 0.8 },
        { header: 'Status', key: 'status', align: 'center', width: 1 },
        { header: 'Created By', key: 'createdBy', align: 'left', width: 1.5 },
        { header: 'Approved By', key: 'approvedBy', align: 'left', width: 1.5 },
        { header: 'Date', key: 'date', align: 'center', width: 1.2 },
      ],
      rows,
      summaryRows: [
        { label: 'Total', value: String(totalCount) },
        { label: 'Approved', value: String(approvedCount), valueColor: [16, 185, 129] },
        { label: 'Approved Amt', value: fmt(approvedAmount) },
        { label: 'Approved Days', value: String(approvedDays) },
        { label: 'Pending', value: String(pendingCount), valueColor: pendingCount > 0 ? [245, 158, 11] : undefined },
        { label: 'Pending Amt', value: fmt(pendingAmount) },
      ],
      orientation: 'landscape',
      fileName: `change-order-log-${projectId}.pdf`,
      logoDataUrl,
      accentColor: [249, 115, 22],
      cellStyleFn: (key, value) => {
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
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Change Order Log</h1>
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
          { label: 'Total', value: String(totalCount), color: '#0f172a' },
          { label: 'Approved', value: String(approvedCount), color: '#10b981' },
          { label: 'Approved Amount', value: fmt(approvedAmount), color: '#10b981' },
          { label: 'Approved Days', value: String(approvedDays), color: '#0f172a' },
          { label: 'Pending', value: String(pendingCount), color: pendingCount > 0 ? '#f59e0b' : '#0f172a' },
          { label: 'Pending Amount', value: fmt(pendingAmount), color: pendingCount > 0 ? '#f59e0b' : '#0f172a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 1.25rem', minWidth: 110 }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: s.label.includes('Amount') ? '0.95rem' : '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Showing {filtered.length} of {totalCount}</span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', 'Title', 'Reason', 'Amount', 'Days Added', 'Status', 'Created By', 'Approved By', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px',
                    textAlign: ['Amount'].includes(h) ? 'right' : ['#', 'Days Added', 'Status'].includes(h) ? 'center' : 'left',
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
                  <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No change orders match the selected filter.</td>
                </tr>
              ) : (
                filtered.map((co, idx) => (
                  <tr key={co.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{co.number}</td>
                    <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.title}</td>
                    <td style={{ padding: '8px 12px', color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.reason}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a', fontWeight: 500 }}>{fmt(co.amount)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>{co.days_added ?? 0}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                        background: `${STATUS_COLORS[co.status] ?? '#94a3b8'}20`,
                        color: STATUS_COLORS[co.status] ?? '#94a3b8',
                        textTransform: 'capitalize',
                      }}>
                        {co.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{co.created_by_name}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{co.approved_by_name ?? '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(co.created_at)}</td>
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

export default ProjectChangeOrderLogReport;
