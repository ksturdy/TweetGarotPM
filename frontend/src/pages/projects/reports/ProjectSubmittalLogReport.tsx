import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { projectsApi } from '../../../services/projects';
import { submittalsApi } from '../../../services/submittals';
import { exportListToPdf } from '../../../utils/listExportPdf';

const fmtDate = (v: string | null | undefined) =>
  v == null ? '—' : new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type RGB = [number, number, number];

const STATUS_LABELS: Record<string, string> = {
  requested_from_vendor: 'Requested from Vendor',
  submitted_for_approval: 'Submitted for Approval',
  revise_resubmit: 'Revise and Resubmit',
  approved: 'Approved',
};
const STATUS_COLORS: Record<string, string> = {
  requested_from_vendor: '#f59e0b',
  submitted_for_approval: '#3b82f6',
  revise_resubmit: '#f97316',
  approved: '#10b981',
};
const STATUS_PDF: Record<string, RGB> = {
  requested_from_vendor: [245, 158, 11],
  submitted_for_approval: [59, 130, 246],
  revise_resubmit: [249, 115, 22],
  approved: [16, 185, 129],
};

const ProjectSubmittalLogReport: React.FC = () => {
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

  const { data: allSubmittals = [] } = useQuery({
    queryKey: ['submittals', pid],
    queryFn: () => submittalsApi.getByProject(pid).then(r => r.data),
    enabled: !!pid,
  });

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return allSubmittals;
    return allSubmittals.filter(s => s.status === filterStatus);
  }, [allSubmittals, filterStatus]);

  const totalCount = allSubmittals.length;
  const requestedCount = allSubmittals.filter(s => s.status === 'requested_from_vendor').length;
  const submittedCount = allSubmittals.filter(s => s.status === 'submitted_for_approval').length;
  const approvedCount = allSubmittals.filter(s => s.status === 'approved').length;
  const reviseCount = allSubmittals.filter(s => s.status === 'revise_resubmit').length;

  function handleExportPdf() {
    const subtitle = filterStatus !== 'all'
      ? `${project?.name ?? ''} — Status: ${filterStatus.replace('_', ' ')}`
      : project?.name ?? '';

    const rows = filtered.map(sub => ({
      number: String(sub.number),
      specSection: sub.spec_section,
      description: sub.description,
      vendorSupplier: sub.subcontractor ?? '—',
      status: STATUS_LABELS[sub.status] ?? sub.status.replace(/_/g, ' '),
      dueDate: fmtDate(sub.due_date),
      reviewedBy: sub.reviewed_by != null ? String(sub.reviewed_by) : '—',
      reviewedAt: fmtDate(sub.reviewed_at),
      date: fmtDate(sub.created_at),
    }));

    exportListToPdf({
      title: 'Submittal Log',
      subtitle,
      columns: [
        { header: '#', key: 'number', align: 'center', width: 0.5 },
        { header: 'Spec Section', key: 'specSection', align: 'left', width: 1.2 },
        { header: 'Description', key: 'description', align: 'left', width: 3 },
        { header: 'Vendor/Supplier', key: 'vendorSupplier', align: 'left', width: 1.5 },
        { header: 'Status', key: 'status', align: 'center', width: 1.1 },
        { header: 'Due Date', key: 'dueDate', align: 'center', width: 1.1 },
        { header: 'Reviewed By', key: 'reviewedBy', align: 'left', width: 1.3 },
        { header: 'Reviewed At', key: 'reviewedAt', align: 'center', width: 1.1 },
        { header: 'Date', key: 'date', align: 'center', width: 1.1 },
      ],
      rows,
      summaryRows: [
        { label: 'Total', value: String(totalCount) },
        { label: 'Requested from Vendor', value: String(requestedCount), valueColor: requestedCount > 0 ? [245, 158, 11] : undefined },
        { label: 'Submitted for Approval', value: String(submittedCount), valueColor: submittedCount > 0 ? [59, 130, 246] : undefined },
        { label: 'Approved', value: String(approvedCount), valueColor: [16, 185, 129] },
        { label: 'Revise and Resubmit', value: String(reviseCount), valueColor: reviseCount > 0 ? [249, 115, 22] : undefined },
      ],
      orientation: 'landscape',
      fileName: `submittal-log-${projectId}.pdf`,
      logoDataUrl,
      accentColor: [249, 115, 22],
      cellStyleFn: (key, value) => {
        if (key === 'status') {
          const normalized = Object.entries(STATUS_LABELS).find(([, label]) => label === value)?.[0];
          return { textColor: normalized ? STATUS_PDF[normalized] ?? [30, 41, 59] : [30, 41, 59] };
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
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Submittal Log</h1>
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
          { label: 'Requested from Vendor', value: requestedCount, color: requestedCount > 0 ? '#f59e0b' : '#0f172a' },
          { label: 'Submitted for Approval', value: submittedCount, color: submittedCount > 0 ? '#3b82f6' : '#0f172a' },
          { label: 'Approved', value: approvedCount, color: '#10b981' },
          { label: 'Revise and Resubmit', value: reviseCount, color: reviseCount > 0 ? '#f97316' : '#0f172a' },
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
          <option value="requested_from_vendor">Requested from Vendor</option>
          <option value="submitted_for_approval">Submitted for Approval</option>
          <option value="revise_resubmit">Revise and Resubmit</option>
          <option value="approved">Approved</option>
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Showing {filtered.length} of {totalCount}</span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', 'Spec Section', 'Description', 'Vendor/Supplier', 'Status', 'Due Date', 'Reviewed By', 'Reviewed At', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px',
                    textAlign: ['#', 'Status', 'Due Date', 'Reviewed At', 'Date'].includes(h) ? 'center' : 'left',
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
                  <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No submittals match the selected filter.</td>
                </tr>
              ) : (
                filtered.map((sub, idx) => (
                  <tr key={sub.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{sub.number}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{sub.spec_section}</td>
                    <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.description}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{sub.subcontractor ?? '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                        background: `${STATUS_COLORS[sub.status] ?? '#94a3b8'}20`,
                        color: STATUS_COLORS[sub.status] ?? '#94a3b8',
                      }}>
                        {STATUS_LABELS[sub.status] ?? sub.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(sub.due_date)}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{sub.reviewed_by != null ? String(sub.reviewed_by) : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(sub.reviewed_at)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(sub.created_at)}</td>
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

export default ProjectSubmittalLogReport;
