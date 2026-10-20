import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { projectsApi } from '../../../services/projects';
import { projectionNotesApi, ProjectionNote } from '../../../services/projectionNotes';
import { exportListToPdf } from '../../../utils/listExportPdf';

const fmt = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

const fmtSigned = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  const abs = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(n));
  return n >= 0 ? `+${abs}` : `(${abs})`;
};

const fmtDate = (v: string | null | undefined) =>
  v == null ? '—' : new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type RGB = [number, number, number];

const COST_TYPE_LABELS: Record<number, string> = {
  1: 'Labor',
  2: 'Material',
  3: 'Subcontracts',
  4: 'Rentals',
  5: 'MEP Equipment',
  6: 'General Conditions',
};

const costTypeLabel = (n: number | null) =>
  n == null ? 'Contract-wide' : (COST_TYPE_LABELS[n] ?? `Type ${n}`);

const noteAmount = (n: ProjectionNote): number => {
  const v = typeof n.amount === 'string' ? parseFloat(n.amount) : (n.amount ?? 0);
  return isNaN(v) ? 0 : v;
};

const ProjectGainFadeReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const { tenant } = useAuth();
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [filterRecognized, setFilterRecognized] = useState<'all' | 'recognized' | 'unrecognized'>('all');
  const [filterCostType, setFilterCostType] = useState<string>('all');

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

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['projectionNotes', pid],
    queryFn: () => projectionNotesApi.list(pid, { type: 'gain_fade' }).then(r => r.data),
    enabled: !!pid,
  });

  const totals = useMemo(() => {
    let gains = 0, fades = 0, recognizedNet = 0, unrecognizedNet = 0;
    notes.forEach(n => {
      const v = noteAmount(n);
      if (v >= 0) gains += v; else fades += v;
      if (n.recognized_in_financials) recognizedNet += v; else unrecognizedNet += v;
    });
    return { gains, fades, net: gains + fades, recognizedNet, unrecognizedNet, count: notes.length };
  }, [notes]);

  const filtered = useMemo(() => {
    return notes.filter(n => {
      if (filterRecognized === 'recognized' && !n.recognized_in_financials) return false;
      if (filterRecognized === 'unrecognized' && n.recognized_in_financials) return false;
      if (filterCostType !== 'all') {
        const ct = filterCostType === 'null' ? null : Number(filterCostType);
        if (n.cost_type !== ct) return false;
      }
      return true;
    });
  }, [notes, filterRecognized, filterCostType]);

  const handleExportPdf = () => {
    const subtitle = [
      project?.name,
      filterRecognized !== 'all' ? (filterRecognized === 'recognized' ? 'Recognized only' : 'Unrecognized only') : null,
      filterCostType !== 'all' ? `Cost Type: ${costTypeLabel(filterCostType === 'null' ? null : Number(filterCostType))}` : null,
    ].filter(Boolean).join('  |  ');

    exportListToPdf({
      title: 'Gain / Fade',
      subtitle,
      orientation: 'landscape',
      fileName: `GainFade_${project?.number ?? pid}_${new Date().toISOString().slice(0, 10)}.pdf`,
      logoDataUrl,
      accentColor: [249, 115, 22],
      columns: [
        { header: 'Date', key: 'date', width: 1 },
        { header: 'Description', key: 'body', width: 3 },
        { header: 'Reasoning', key: 'reasoning', width: 3 },
        { header: 'Cost Type', key: 'costType', width: 1 },
        { header: 'Groups', key: 'groups', width: 1.5 },
        { header: 'Amount', key: 'amount', align: 'right', width: 1 },
        { header: 'Recognized', key: 'recognized', align: 'center', width: 0.8 },
        { header: 'Entered By', key: 'createdBy', width: 1 },
      ],
      rows: filtered.map(n => ({
        date: fmtDate(n.snapshot_date ?? n.created_at),
        body: n.body,
        reasoning: n.reasoning ?? '',
        costType: costTypeLabel(n.cost_type),
        groups: n.groups_affected?.join(', ') ?? '',
        amount: fmtSigned(n.amount),
        recognized: n.recognized_in_financials ? 'Yes' : 'No',
        createdBy: n.created_by_name,
      })),
      summaryRows: [
        { label: 'Total Items', value: String(totals.count) },
        { label: 'Total Gains', value: fmt(totals.gains), valueColor: [16, 185, 129] },
        { label: 'Total Fades', value: fmt(Math.abs(totals.fades)), valueColor: [239, 68, 68] },
        { label: 'Net Gain/(Fade)', value: fmtSigned(totals.net), valueColor: totals.net >= 0 ? [16, 185, 129] : [239, 68, 68] },
        { label: 'Recognized', value: fmtSigned(totals.recognizedNet) },
        { label: 'Unrecognized', value: fmtSigned(totals.unrecognizedNet) },
      ],
      cellStyleFn: (key, value) => {
        if (key === 'amount') {
          if (value.startsWith('+')) return { textColor: [16, 185, 129] as RGB };
          if (value.startsWith('(')) return { textColor: [239, 68, 68] as RGB };
        }
        if (key === 'recognized') {
          if (value === 'Yes') return { textColor: [16, 185, 129] as RGB };
        }
        return undefined;
      },
    });
  };

  const selectStyle: React.CSSProperties = {
    padding: '5px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: '0.8rem',
    color: '#334155',
    background: '#fff',
    cursor: 'pointer',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>{project?.name ?? ''}</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Gain / Fade</h1>
        </div>
        <button onClick={handleExportPdf} style={{
          padding: '8px 16px', background: '#0f172a', color: '#fff',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
        }}>
          Export PDF
        </button>
      </div>

      {/* Source callout */}
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd',
        borderLeft: '4px solid #0ea5e9', borderRadius: 8,
        padding: '0.75rem 1rem', marginBottom: '1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '0.85rem', color: '#0369a1' }}>
          Gain/Fade items are entered in <strong>Financials → Projection Notes → Gain/Fade tab</strong>. Add or edit items there.
        </div>
        <Link
          to={`/projects/${pid}/financials`}
          style={{
            fontSize: '0.8rem', color: '#0369a1', fontWeight: 600,
            textDecoration: 'none', whiteSpace: 'nowrap',
            padding: '4px 12px', border: '1px solid #7dd3fc', borderRadius: 6,
            background: '#fff',
          }}
        >
          Open Financials →
        </Link>
      </div>

      {/* Summary strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem', marginBottom: '1.5rem',
      }}>
        {[
          { label: 'Items', value: String(totals.count), color: '#0f172a' },
          { label: 'Total Gains', value: fmt(totals.gains), color: '#10b981' },
          { label: 'Total Fades', value: fmt(Math.abs(totals.fades)), color: '#ef4444' },
          { label: 'Net Gain/(Fade)', value: fmtSigned(totals.net), color: totals.net >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Recognized', value: fmtSigned(totals.recognizedNet), color: '#475569' },
          { label: 'Unrecognized', value: fmtSigned(totals.unrecognizedNet), color: '#f59e0b' },
        ].map(item => (
          <div key={item.label} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '0.75rem 1rem',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Filter:</span>
        <select value={filterRecognized} onChange={e => setFilterRecognized(e.target.value as typeof filterRecognized)} style={selectStyle}>
          <option value="all">All Items</option>
          <option value="recognized">Recognized</option>
          <option value="unrecognized">Unrecognized</option>
        </select>
        <select value={filterCostType} onChange={e => setFilterCostType(e.target.value)} style={selectStyle}>
          <option value="all">All Cost Types</option>
          <option value="null">Contract-wide</option>
          {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {(filterRecognized !== 'all' || filterCostType !== 'all') && (
          <button
            onClick={() => { setFilterRecognized('all'); setFilterCostType('all'); }}
            style={{ ...selectStyle, color: '#64748b', border: '1px solid #e2e8f0' }}
          >
            Clear
          </button>
        )}
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: 4 }}>
          {filtered.length} of {notes.length} items
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            {notes.length === 0
              ? 'No gain/fade items have been logged for this project yet.'
              : 'No items match the current filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[
                    { label: 'Date', align: 'left' },
                    { label: 'Description', align: 'left' },
                    { label: 'Reasoning', align: 'left' },
                    { label: 'Cost Type', align: 'left' },
                    { label: 'Groups Affected', align: 'left' },
                    { label: 'Amount', align: 'right' },
                    { label: 'Recognized', align: 'center' },
                    { label: 'Entered By', align: 'left' },
                  ].map(h => (
                    <th key={h.label} style={{
                      padding: '8px 14px', textAlign: h.align as 'left' | 'right' | 'center',
                      color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap', fontSize: '0.8rem',
                    }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, idx) => {
                  const amt = noteAmount(n);
                  const amtColor = amt >= 0 ? '#10b981' : '#ef4444';
                  return (
                    <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {fmtDate(n.snapshot_date ?? n.created_at)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#1e293b', maxWidth: 260 }}>
                        {n.body}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', maxWidth: 280, fontSize: '0.8rem' }}>
                        {n.reasoning ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {costTypeLabel(n.cost_type)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', fontSize: '0.8rem' }}>
                        {n.groups_affected?.join(', ') || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: amtColor, whiteSpace: 'nowrap' }}>
                        {fmtSigned(n.amount)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px', borderRadius: 99,
                          fontSize: '0.75rem', fontWeight: 600,
                          background: n.recognized_in_financials ? '#d1fae5' : '#fef9c3',
                          color: n.recognized_in_financials ? '#065f46' : '#854d0e',
                        }}>
                          {n.recognized_in_financials ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {n.created_by_name}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                  <td colSpan={5} style={{ padding: '8px 14px', fontWeight: 600, color: '#64748b', fontSize: '0.8rem' }}>
                    {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', color: (() => {
                    const net = filtered.reduce((s, n) => s + noteAmount(n), 0);
                    return net >= 0 ? '#10b981' : '#ef4444';
                  })() }}>
                    {fmtSigned(filtered.reduce((s, n) => s + noteAmount(n), 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectGainFadeReport;
