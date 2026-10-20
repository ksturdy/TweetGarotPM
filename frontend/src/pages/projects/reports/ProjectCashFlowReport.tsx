import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { vistaDataService } from '../../../services/vistaData';
import { projectsApi } from '../../../services/projects';
import { exportListToPdf } from '../../../utils/listExportPdf';

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const ProjectCashFlowReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const { tenant } = useAuth();
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();

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

  const { data: contract } = useQuery({
    queryKey: ['vista-contract', pid],
    queryFn: () => vistaDataService.getContractByProjectId(pid),
    enabled: !!pid,
  });

  const summaryItems = contract
    ? [
        { label: 'Contract Value', value: fmt(contract.contract_amount) },
        { label: 'Billed (JTD)', value: fmt(contract.billed_amount) },
        { label: 'Received (JTD)', value: fmt(contract.received_amount) },
        { label: 'Open Receivables', value: fmt(contract.open_receivables) },
        { label: 'Projected Revenue', value: fmt(contract.projected_revenue) },
        { label: 'Backlog', value: fmt(contract.backlog) },
        { label: 'Actual Cost (JTD)', value: fmt(contract.actual_cost) },
      ]
    : [];

  const financialRows = contract
    ? [
        { metric: 'Contract Value', value: fmt(contract.contract_amount), notes: 'Current approved contract' },
        { metric: 'Billed Amount (JTD)', value: fmt(contract.billed_amount), notes: 'Total invoiced to date' },
        { metric: 'Received Amount (JTD)', value: fmt(contract.received_amount), notes: 'Total collections to date' },
        { metric: 'Open Receivables', value: fmt(contract.open_receivables), notes: 'Outstanding amounts due' },
        { metric: 'Cash Flow Position', value: fmt(contract.cash_flow), notes: 'Net cash position' },
        { metric: 'Projected Revenue', value: fmt(contract.projected_revenue), notes: 'Total projected at completion' },
        { metric: 'Backlog', value: fmt(contract.backlog), notes: 'Remaining revenue to bill' },
        { metric: 'Actual Cost (JTD)', value: fmt(contract.actual_cost), notes: 'Total costs incurred to date' },
        { metric: 'Projected Cost', value: fmt(contract.projected_cost), notes: 'Total projected cost at completion' },
        { metric: 'Gross Profit (Projected)', value: fmt(contract.gross_profit_dollars), notes: 'Projected profit at completion' },
      ]
    : [];

  function handleExportPdf() {
    exportListToPdf({
      title: 'Cash Flow Report',
      subtitle: project?.name ?? '',
      columns: [
        { header: 'Metric', key: 'metric', align: 'left', width: 2.5 },
        { header: 'Value', key: 'value', align: 'right', width: 1.5 },
        { header: 'Notes', key: 'notes', align: 'left', width: 3 },
      ],
      rows: financialRows,
      summaryRows: summaryItems.map(s => ({ label: s.label, value: s.value })),
      orientation: 'landscape',
      fileName: `cash-flow-${projectId}.pdf`,
      logoDataUrl,
      accentColor: [249, 115, 22],
    });
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>{project?.name ?? ''}</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Cash Flow Report</h1>
        </div>
        <button
          onClick={handleExportPdf}
          style={{ padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
        >
          Export PDF
        </button>
      </div>

      {/* Summary strip */}
      {summaryItems.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {summaryItems.map(s => (
            <div key={s.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 1.25rem', minWidth: 130 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Financial metrics table */}
      {contract ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
            Financial Summary
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Metric</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Value</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {financialRows.map((row, idx) => (
                  <tr key={row.metric} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 14px', color: '#1e293b', fontWeight: 500 }}>{row.metric}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>{row.value}</td>
                    <td style={{ padding: '9px 14px', color: '#64748b', fontSize: '0.8rem' }}>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          No Vista contract data linked to this project.
        </div>
      )}

      {/* Navigation note */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '0.85rem', color: '#1d4ed8' }}>
          For the full interactive cash flow forecast with monthly projections and schedule-aware billing curves, visit{' '}
          <Link
            to={`/projects/${projectId}/cash-flow`}
            style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'underline' }}
          >
            Cash Flow in Cost &amp; Finance
          </Link>
          .
        </span>
      </div>
    </div>
  );
};

export default ProjectCashFlowReport;
