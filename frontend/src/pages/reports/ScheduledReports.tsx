import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  scheduledReportsApi,
  ScheduledReport,
  ScheduledReportInput,
} from '../../services/scheduledReports';
import { usersApi, User } from '../../services/users';
import { cashFlowReportApi } from '../../services/cashFlowReport';
import { buyoutMetricReportApi } from '../../services/buyoutMetricReport';
import { executiveReportApi } from '../../services/executiveReport';
import { teamsApi, Team } from '../../services/teams';
import { getCampaigns, Campaign } from '../../services/campaigns';
import '../../styles/SalesPipeline.css';

const REPORT_TYPES: { value: string; label: string }[] = [
  { value: 'executive_report', label: 'Executive Report' },
  { value: 'backlog_fit', label: 'Backlog Fit Analysis' },
  { value: 'cash_flow', label: 'Cash Flow Report' },
  { value: 'buyout_metric', label: 'Buyout Metric Report' },
  { value: 'campaign', label: 'Campaign Report' },
];

const FREQUENCIES: { value: string; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'UTC',
];

const reportTypeLabel = (type: string) => REPORT_TYPES.find(r => r.value === type)?.label || type;

const frequencyLabel = (freq: string, dow: number | null, dom: number | null) => {
  if (freq === 'daily') return 'Daily';
  if (freq === 'weekly') return `Weekly (${DAYS_OF_WEEK[dow ?? 0]}s)`;
  if (freq === 'monthly') return `Monthly (${dom ?? 1}${ordinalSuffix(dom ?? 1)})`;
  return freq;
};

const ordinalSuffix = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

const formatTimeOfDay = (time: string) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
};

interface FormState {
  name: string;
  report_type: string;
  frequency: string;
  day_of_week: number;
  day_of_month: number;
  time_of_day: string;
  timezone: string;
  filters: Record<string, unknown>;
  is_enabled: boolean;
  recipient_user_ids: number[];
}

const DEFAULT_FORM: FormState = {
  name: '',
  report_type: 'executive_report',
  frequency: 'weekly',
  day_of_week: 1,
  day_of_month: 1,
  time_of_day: '08:00',
  timezone: 'America/Chicago',
  filters: {},
  is_enabled: true,
  recipient_user_ids: [],
};

const ScheduledReports: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [recipientSearch, setRecipientSearch] = useState('');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: scheduledReportsApi.getAll,
  });

  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });
  const users: User[] = useMemo(() => {
    const raw = (usersResponse as any)?.data || usersResponse || [];
    return (Array.isArray(raw) ? raw : []).filter((u: User) => u.is_active);
  }, [usersResponse]);

  // Fetch cash flow data for filter dropdowns
  const { data: cashFlowProjects = [] } = useQuery({
    queryKey: ['cashFlowReport'],
    queryFn: cashFlowReportApi.getData,
    enabled: dialogOpen && form.report_type === 'cash_flow',
  });

  // Fetch buyout metric data for filter dropdowns
  const { data: buyoutMetricProjects = [] } = useQuery({
    queryKey: ['buyoutMetricReport'],
    queryFn: () => buyoutMetricReportApi.getData({ min_percent_complete: 0 }),
    enabled: dialogOpen && form.report_type === 'buyout_metric',
  });

  // Fetch teams for filter dropdown
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await teamsApi.getAll();
      return response.data.data || [];
    },
    enabled: dialogOpen && (form.report_type === 'cash_flow' || form.report_type === 'buyout_metric'),
  });

  // Fetch campaigns for campaign report type
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
    enabled: dialogOpen && form.report_type === 'campaign',
  });

  const cfFilterOptions = useMemo(() => ({
    statuses: [...new Set(cashFlowProjects.map(p => p.status).filter(Boolean))].sort() as string[],
    pms: [...new Set(cashFlowProjects.map(p => p.manager_name).filter(Boolean))].sort() as string[],
    departments: [...new Set(cashFlowProjects.map(p => p.department_number).filter(Boolean))].sort() as string[],
    markets: [...new Set(cashFlowProjects.map(p => p.market).filter(Boolean))].sort() as string[],
  }), [cashFlowProjects]);

  const bmFilterOptions = useMemo(() => ({
    statuses: [...new Set(buyoutMetricProjects.map(p => p.status).filter(Boolean))].sort() as string[],
    pms: [...new Set(buyoutMetricProjects.map(p => p.manager_name).filter(Boolean))].sort() as string[],
    departments: [...new Set(buyoutMetricProjects.map(p => p.department_number).filter(Boolean))].sort() as string[],
    markets: [...new Set(buyoutMetricProjects.map(p => p.market).filter(Boolean))].sort() as string[],
  }), [buyoutMetricProjects]);

  // Fetch executive report data for snapshot date dropdown
  const { data: execReportResponse } = useQuery({
    queryKey: ['executiveReport'],
    queryFn: () => executiveReportApi.getReport(),
    enabled: dialogOpen && form.report_type === 'executive_report',
  });
  const availableSnapshotDates: string[] = useMemo(() => {
    const data = (execReportResponse as any)?.data || execReportResponse || {};
    return data.availableDates || [];
  }, [execReportResponse]);

  const createMutation = useMutation({
    mutationFn: (data: ScheduledReportInput) => scheduledReportsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      closeDialog();
      showToast('Schedule created successfully', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to create schedule', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ScheduledReportInput> }) =>
      scheduledReportsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      closeDialog();
      showToast('Schedule updated successfully', 'success');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Failed to update schedule', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scheduledReportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setDeleteConfirmId(null);
      showToast('Schedule deleted', 'success');
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: (id: number) => scheduledReportsApi.sendNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setSendingId(null);
      showToast('Report sent successfully', 'success');
    },
    onError: (err: any) => {
      setSendingId(null);
      showToast(err?.response?.data?.error || 'Failed to send report', 'error');
    },
  });

  const toggleEnabled = (report: ScheduledReport) => {
    updateMutation.mutate({ id: report.id, data: { is_enabled: !report.is_enabled } });
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const filteredUsers = useMemo(() => {
    if (!recipientSearch.trim()) return users;
    const term = recipientSearch.toLowerCase();
    return users.filter(u =>
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  }, [users, recipientSearch]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
    setRecipientSearch('');
    setDialogOpen(true);
  };

  const openEdit = (report: ScheduledReport) => {
    setEditingId(report.id);
    setRecipientSearch('');
    setForm({
      name: report.name,
      report_type: report.report_type,
      frequency: report.frequency,
      day_of_week: report.day_of_week ?? 1,
      day_of_month: report.day_of_month ?? 1,
      time_of_day: report.time_of_day?.substring(0, 5) || '08:00',
      timezone: report.timezone || 'America/Chicago',
      filters: report.filters || {},
      is_enabled: report.is_enabled,
      recipient_user_ids: report.recipients.map(r => r.user_id),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
  };

  const handleSave = () => {
    const payload: ScheduledReportInput = {
      name: form.name,
      report_type: form.report_type,
      frequency: form.frequency,
      day_of_week: form.frequency === 'weekly' ? form.day_of_week : null,
      day_of_month: form.frequency === 'monthly' ? form.day_of_month : null,
      time_of_day: form.time_of_day,
      timezone: form.timezone,
      filters: form.filters,
      is_enabled: form.is_enabled,
      recipient_user_ids: form.recipient_user_ids,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleRecipient = (userId: number) => {
    setForm(f => ({
      ...f,
      recipient_user_ids: f.recipient_user_ids.includes(userId)
        ? f.recipient_user_ids.filter(id => id !== userId)
        : [...f.recipient_user_ids, userId],
    }));
  };

  // Styles
  const dialogOverlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  };
  const dialogStyle: React.CSSProperties = {
    background: 'white', borderRadius: '12px', width: '640px', maxHeight: '90vh',
    overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
  };
  const sectionStyle: React.CSSProperties = {
    marginBottom: '1.25rem',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b',
    marginBottom: '0.375rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.875rem',
    border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none',
    boxSizing: 'border-box',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

  const canSave = form.name.trim() && form.recipient_user_ids.length > 0 &&
    (form.report_type !== 'campaign' || !!form.filters.campaign_id);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="sales-page" style={{ maxWidth: '1500px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 2000,
          padding: '0.75rem 1.25rem', borderRadius: '8px',
          background: toast.type === 'success' ? '#059669' : '#dc2626',
          color: 'white', fontSize: '0.875rem', fontWeight: 500,
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            Scheduled Reports
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0' }}>
            Configure automatic report delivery via email
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
            background: 'linear-gradient(135deg, #002356, #004080)', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          + New Schedule
        </button>
      </div>

      {/* Table */}
      <div className="sales-table-section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, #002356, #3b82f6, #8b5cf6)',
        }} />
        <table className="sales-table" style={{ width: '100%', paddingTop: '0.5rem' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Report</th>
              <th>Frequency</th>
              <th>Time</th>
              <th>Next Run</th>
              <th>Last Run</th>
              <th style={{ textAlign: 'center', width: '50px' }}>To</th>
              <th style={{ textAlign: 'center', width: '60px' }}>On</th>
              <th style={{ textAlign: 'center', width: '220px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  Loading...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>No scheduled reports yet</h3>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    Click "New Schedule" to set up automatic report delivery.
                  </p>
                </td>
              </tr>
            ) : (
              reports.map((report: ScheduledReport) => (
                <tr key={report.id} style={{ opacity: report.is_enabled ? 1 : 0.55 }}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{report.name}</div>
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      background: report.report_type === 'executive_report' ? 'rgba(0,35,86,0.1)' :
                        report.report_type === 'backlog_fit' ? 'rgba(139,92,246,0.1)' :
                        report.report_type === 'buyout_metric' ? 'rgba(245,158,11,0.1)' :
                        report.report_type === 'campaign' ? 'rgba(234,88,12,0.1)' : 'rgba(59,130,246,0.1)',
                      color: report.report_type === 'executive_report' ? '#002356' :
                        report.report_type === 'backlog_fit' ? '#7c3aed' :
                        report.report_type === 'buyout_metric' ? '#d97706' :
                        report.report_type === 'campaign' ? '#ea580c' : '#2563eb',
                    }}>
                      {reportTypeLabel(report.report_type)}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                    {frequencyLabel(report.frequency, report.day_of_week, report.day_of_month)}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                    {formatTimeOfDay(report.time_of_day)}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                    {report.is_enabled ? formatDateTime(report.next_run_at) : '-'}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                    {formatDateTime(report.last_run_at)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600, color: '#475569',
                    }}>
                      {report.recipients.length}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => toggleEnabled(report)}
                      style={{
                        width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: report.is_enabled ? '#059669' : '#d1d5db',
                        position: 'relative', transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                        position: 'absolute', top: '2px',
                        left: report.is_enabled ? '18px' : '2px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'nowrap' }}>
                      <button
                        onClick={() => openEdit(report)}
                        title="Edit"
                        style={{
                          padding: '5px 12px', fontSize: '0.75rem', fontWeight: 500, background: '#f1f5f9',
                          border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: '#475569',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setSendingId(report.id); sendNowMutation.mutate(report.id); }}
                        disabled={sendingId === report.id}
                        title="Send now"
                        style={{
                          padding: '5px 12px', fontSize: '0.75rem', fontWeight: 500,
                          background: sendingId === report.id ? '#94a3b8' : '#002356',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'white',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sendingId === report.id ? '...' : 'Send'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(report.id)}
                        title="Delete"
                        style={{
                          padding: '5px 12px', fontSize: '0.75rem', fontWeight: 500, background: '#fef2f2',
                          border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', color: '#dc2626',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirm Dialog */}
      {deleteConfirmId !== null && (
        <div style={dialogOverlayStyle} onClick={() => setDeleteConfirmId(null)}>
          <div style={{ ...dialogStyle, width: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', color: '#1e293b' }}>Delete Schedule?</h2>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
                This will permanently remove this scheduled report. Recipients will no longer receive it.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirmId)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      {dialogOpen && (
        <div style={dialogOverlayStyle} onClick={closeDialog}>
          <div style={dialogStyle} onClick={e => e.stopPropagation()}>
            {/* Dialog Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e5e7eb',
              background: 'linear-gradient(135deg, #002356, #004080)',
              borderRadius: '12px 12px 0 0',
              color: 'white',
            }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
                {editingId ? 'Edit Schedule' : 'New Scheduled Report'}
              </h2>
            </div>

            {/* Dialog Body */}
            <div style={{ padding: '1.5rem' }}>
              {/* Name */}
              <div style={sectionStyle}>
                <label style={labelStyle}>Schedule Name</label>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Weekly Executive Report for Leadership"
                />
              </div>

              {/* Report Type */}
              <div style={sectionStyle}>
                <label style={labelStyle}>Report Type</label>
                <select style={selectStyle} value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value, filters: {} }))}>
                  {REPORT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {/* Frequency Row */}
              <div style={{ ...sectionStyle, display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Frequency</label>
                  <select style={selectStyle} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                {form.frequency === 'weekly' && (
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Day of Week</label>
                    <select style={selectStyle} value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}>
                      {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}

                {form.frequency === 'monthly' && (
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Day of Month</label>
                    <select style={selectStyle} value={form.day_of_month} onChange={e => setForm(f => ({ ...f, day_of_month: parseInt(e.target.value) }))}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}{ordinalSuffix(d)}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Time</label>
                  <input type="time" style={inputStyle} value={form.time_of_day} onChange={e => setForm(f => ({ ...f, time_of_day: e.target.value }))} />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Timezone</label>
                  <select style={selectStyle} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('America/', '').replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Filters (for Cash Flow) */}
              {form.report_type === 'cash_flow' && (
                <div style={sectionStyle}>
                  <label style={labelStyle}>Filters (Optional)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '160px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Status</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.status as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, status: e.target.value || undefined } }))}
                      >
                        <option value="">All Statuses</option>
                        {cfFilterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: '180px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Project Manager</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.pm as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, pm: e.target.value || undefined } }))}
                      >
                        <option value="">All PMs</option>
                        {cfFilterOptions.pms.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: '160px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Department</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.department as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, department: e.target.value || undefined } }))}
                      >
                        <option value="">All Departments</option>
                        {cfFilterOptions.departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: '160px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Market</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.market as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, market: e.target.value || undefined } }))}
                      >
                        <option value="">All Markets</option>
                        {cfFilterOptions.markets.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: '160px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Team</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.team as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, team: e.target.value || undefined } }))}
                      >
                        <option value="">All Teams</option>
                        {teams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters (for Buyout Metric) */}
              {form.report_type === 'buyout_metric' && (
                <div style={sectionStyle}>
                  <label style={labelStyle}>Filters (Optional)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '160px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Status</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.status as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, status: e.target.value || undefined } }))}
                      >
                        <option value="">All Statuses</option>
                        {bmFilterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: '180px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Project Manager</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.pm as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, pm: e.target.value || undefined } }))}
                      >
                        <option value="">All PMs</option>
                        {bmFilterOptions.pms.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: '160px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Department</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.department as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, department: e.target.value || undefined } }))}
                      >
                        <option value="">All Departments</option>
                        {bmFilterOptions.departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: '160px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Market</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.market as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, market: e.target.value || undefined } }))}
                      >
                        <option value="">All Markets</option>
                        {bmFilterOptions.markets.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: '160px' }}>
                      <label style={{ ...labelStyle, fontSize: '0.6875rem', marginBottom: '0.25rem' }}>Team</label>
                      <select
                        style={selectStyle}
                        value={(form.filters.team as string) || ''}
                        onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, team: e.target.value || undefined } }))}
                      >
                        <option value="">All Teams</option>
                        {teams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters (for Executive Report) */}
              {form.report_type === 'executive_report' && (
                <div style={sectionStyle}>
                  <label style={labelStyle}>Snapshot Date (Optional)</label>
                  <select
                    style={{ ...selectStyle, maxWidth: '280px' }}
                    value={(form.filters.snapshotDate as string) || ''}
                    onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, snapshotDate: e.target.value || undefined } }))}
                  >
                    <option value="">Latest Available</option>
                    {availableSnapshotDates.map(d => (
                      <option key={d} value={d}>
                        {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filters (for Campaign Report) */}
              {form.report_type === 'campaign' && (
                <div style={sectionStyle}>
                  <label style={labelStyle}>Campaign *</label>
                  <select
                    style={{ ...selectStyle, maxWidth: '400px' }}
                    value={(form.filters.campaign_id as string) || ''}
                    onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, campaign_id: e.target.value ? Number(e.target.value) : undefined } }))}
                  >
                    <option value="">Select a campaign...</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipients */}
              <div style={sectionStyle}>
                <label style={labelStyle}>
                  Recipients ({form.recipient_user_ids.length} selected)
                </label>
                <div style={{
                  border: '1px solid #d1d5db', borderRadius: '6px',
                  overflow: 'hidden',
                }}>
                  {/* Search input */}
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={recipientSearch}
                      onChange={e => setRecipientSearch(e.target.value)}
                      style={{
                        border: 'none', outline: 'none', background: 'transparent',
                        fontSize: '0.8125rem', width: '100%', color: '#1e293b',
                      }}
                    />
                    {recipientSearch && (
                      <button
                        onClick={() => setRecipientSearch('')}
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: '#94a3b8', fontSize: '1rem', padding: 0, lineHeight: 1,
                        }}
                      >
                        x
                      </button>
                    )}
                  </div>
                  {/* User list */}
                  <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {users.length === 0 ? (
                      <div style={{ padding: '1rem', color: '#94a3b8', textAlign: 'center', fontSize: '0.875rem' }}>
                        No active users found
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div style={{ padding: '1rem', color: '#94a3b8', textAlign: 'center', fontSize: '0.875rem' }}>
                        No users match "{recipientSearch}"
                      </div>
                    ) : (
                      filteredUsers.map(user => {
                        const isSelected = form.recipient_user_ids.includes(user.id);
                        return (
                          <div
                            key={user.id}
                            onClick={() => toggleRecipient(user.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.75rem',
                              padding: '0.5rem 0.75rem', cursor: 'pointer',
                              background: isSelected ? '#f0f9ff' : 'transparent',
                              borderBottom: '1px solid #f1f5f9',
                            }}
                          >
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '4px',
                              border: isSelected ? '2px solid #002356' : '2px solid #d1d5db',
                              background: isSelected ? '#002356' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {isSelected && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>
                                {user.first_name} {user.last_name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{user.email}</div>
                            </div>
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 600, padding: '2px 6px',
                              borderRadius: '4px', background: '#f1f5f9', color: '#64748b',
                              textTransform: 'uppercase',
                            }}>
                              {user.role}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Enabled toggle */}
              <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => setForm(f => ({ ...f, is_enabled: !f.is_enabled }))}
                  style={{
                    width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
                    background: form.is_enabled ? '#059669' : '#d1d5db',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '2px',
                    left: form.is_enabled ? '20px' : '2px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <span style={{ fontSize: '0.875rem', color: '#475569' }}>
                  {form.is_enabled ? 'Enabled — reports will be sent on schedule' : 'Disabled — reports will not be sent'}
                </span>
              </div>
            </div>

            {/* Dialog Footer */}
            <div style={{
              padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
              background: '#f9fafb', borderRadius: '0 0 12px 12px',
            }}>
              <button
                onClick={closeDialog}
                style={{
                  padding: '0.5rem 1.25rem', fontSize: '0.875rem',
                  background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || isSaving}
                style={{
                  padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
                  background: canSave && !isSaving ? 'linear-gradient(135deg, #002356, #004080)' : '#94a3b8',
                  color: 'white', border: 'none', borderRadius: '6px',
                  cursor: canSave && !isSaving ? 'pointer' : 'not-allowed',
                }}
              >
                {isSaving ? 'Saving...' : editingId ? 'Update Schedule' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledReports;
