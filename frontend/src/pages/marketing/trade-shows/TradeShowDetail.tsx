import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  tradeShowsApi,
  TradeShowAttendee,
  TradeShowExpense,
  TradeShowTodo,
  ATTENDEE_REGISTRATION_STATUS_OPTIONS,
  ATTENDEE_ROLE_OPTIONS,
  AttendeeRegistrationStatus,
  EXPENSE_CATEGORY_OPTIONS,
  TODO_PRIORITY_OPTIONS,
  REMINDER_OFFSET_OPTIONS,
} from '../../../services/tradeShows';
import { employeesApi, Employee } from '../../../services/employees';
import SearchableSelect from '../../../components/SearchableSelect';
import { useTitanFeedback } from '../../../context/TitanFeedbackContext';
import TradeShowExpensesSection from './TradeShowExpensesSection';
import TradeShowTodosSection from './TradeShowTodosSection';
import '../../../styles/SalesPipeline.css';

const fmtMoney = (val?: number | string | null) => {
  if (val === null || val === undefined || val === '') return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const fmtDate = (val?: string | null) => {
  if (!val) return '—';
  const d = new Date(val.includes('T') ? val : val + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return '—';
  if (start && end && start !== end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  return fmtDate(start || end);
};

const fmtTime = (val?: string | null) => {
  if (!val) return '';
  const t = val.length >= 5 ? val.slice(0, 5) : val;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr);
  if (isNaN(h)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    upcoming: 'badge badge-info',
    registered: 'badge badge-info',
    in_progress: 'badge badge-warning',
    completed: 'badge badge-success',
    cancelled: 'badge badge-danger',
  };
  return map[status] || 'badge';
};

const statusLabel = (status: string) =>
  status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const attendeeName = (a: TradeShowAttendee): string => {
  if (a.employee_id && (a.employee_first_name || a.employee_last_name)) {
    return `${a.employee_first_name || ''} ${a.employee_last_name || ''}`.trim();
  }
  return a.external_name || '—';
};

type AttendeeFormState = {
  type: 'internal' | 'external';
  employee_id: string;
  external_name: string;
  external_email: string;
  external_company: string;
  role: string;
  registration_status: AttendeeRegistrationStatus;
  arrival_date: string;
  departure_date: string;
  notes: string;
};

const emptyAttendee: AttendeeFormState = {
  type: 'internal',
  employee_id: '',
  external_name: '',
  external_email: '',
  external_company: '',
  role: '',
  registration_status: 'pending',
  arrival_date: '',
  departure_date: '',
  notes: '',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#6b7280',
  fontWeight: 600,
  marginBottom: '0.25rem',
};

const valueStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: '#1f2937',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#475569',
  marginTop: 0,
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid #e5e7eb',
};

const TradeShowDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<TradeShowAttendee | null>(null);
  const [attendeeForm, setAttendeeForm] = useState<AttendeeFormState>(emptyAttendee);
  const [attendeeError, setAttendeeError] = useState<string | null>(null);

  const showId = id ? parseInt(id) : 0;

  const { data: show, isLoading, error } = useQuery({
    queryKey: ['trade-show', id],
    queryFn: () => tradeShowsApi.getById(showId).then(res => res.data),
    enabled: !!id,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees', 'active'],
    queryFn: () => employeesApi.getAll({ employmentStatus: 'active' }).then(res => res.data.data),
  });

  const employeeOptions = useMemo(() => {
    const list = employees || [];
    const taken = new Set((show?.attendees || []).map(a => a.employee_id).filter(Boolean));
    return list
      .filter((e: Employee) => editingAttendee?.employee_id === e.id || !taken.has(e.id))
      .map((e: Employee) => ({
        value: e.id.toString(),
        label: `${e.first_name} ${e.last_name}${e.job_title ? ` — ${e.job_title}` : ''}`,
        searchText: `${e.first_name} ${e.last_name} ${e.email || ''} ${e.job_title || ''} ${e.department_name || ''}`,
      }));
  }, [employees, show, editingAttendee]);

  const deleteShowMutation = useMutation({
    mutationFn: () => tradeShowsApi.delete(showId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-shows'] });
      navigate('/marketing/trade-shows');
    },
  });

  const addAttendeeMutation = useMutation({
    mutationFn: (data: Partial<TradeShowAttendee>) => tradeShowsApi.addAttendee(showId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-show', id] });
      setShowAddModal(false);
      setAttendeeForm(emptyAttendee);
      setAttendeeError(null);
    },
    onError: (err: any) => setAttendeeError(err?.response?.data?.error || 'Failed to add attendee'),
  });

  const updateAttendeeMutation = useMutation({
    mutationFn: ({ attendeeId, data }: { attendeeId: number; data: Partial<TradeShowAttendee> }) =>
      tradeShowsApi.updateAttendee(showId, attendeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-show', id] });
      setEditingAttendee(null);
      setAttendeeForm(emptyAttendee);
      setAttendeeError(null);
    },
    onError: (err: any) => setAttendeeError(err?.response?.data?.error || 'Failed to update attendee'),
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: (attendeeId: number) => tradeShowsApi.removeAttendee(showId, attendeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trade-show', id] }),
  });

  const inlineUpdateAttendee = (attendee: TradeShowAttendee, patch: Partial<TradeShowAttendee>) => {
    updateAttendeeMutation.mutate({
      attendeeId: attendee.id,
      data: {
        employee_id: attendee.employee_id ?? null,
        external_name: attendee.external_name ?? null,
        external_email: attendee.external_email ?? null,
        external_company: attendee.external_company ?? null,
        role: attendee.role ?? null,
        registration_status: attendee.registration_status,
        arrival_date: attendee.arrival_date ?? null,
        departure_date: attendee.departure_date ?? null,
        notes: attendee.notes ?? null,
        ...patch,
      },
    });
  };

  const handleDeleteShow = async () => {
    if (!show) return;
    const ok = await confirm({
      message: `Delete "${show.name}"? This will remove all attendees as well.`,
      title: 'Delete Trade Show',
      danger: true,
    });
    if (ok) deleteShowMutation.mutate();
  };

  const handleRemoveAttendee = async (a: TradeShowAttendee) => {
    const ok = await confirm({
      message: `Remove ${attendeeName(a)} from this trade show?`,
      title: 'Remove Attendee',
      danger: true,
    });
    if (ok) removeAttendeeMutation.mutate(a.id);
  };

  const openAddAttendee = () => {
    setEditingAttendee(null);
    setAttendeeForm(emptyAttendee);
    setAttendeeError(null);
    setShowAddModal(true);
  };

  const openEditAttendee = (a: TradeShowAttendee) => {
    setEditingAttendee(a);
    setAttendeeForm({
      type: a.employee_id ? 'internal' : 'external',
      employee_id: a.employee_id ? a.employee_id.toString() : '',
      external_name: a.external_name || '',
      external_email: a.external_email || '',
      external_company: a.external_company || '',
      role: a.role || '',
      registration_status: a.registration_status,
      arrival_date: (a.arrival_date || '').split('T')[0],
      departure_date: (a.departure_date || '').split('T')[0],
      notes: a.notes || '',
    });
    setAttendeeError(null);
    setShowAddModal(true);
  };

  const submitAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    setAttendeeError(null);

    const isInternal = attendeeForm.type === 'internal';
    if (isInternal && !attendeeForm.employee_id) {
      setAttendeeError('Please select an employee');
      return;
    }
    if (!isInternal && !attendeeForm.external_name.trim()) {
      setAttendeeError('Name is required for external attendees');
      return;
    }

    const data: Partial<TradeShowAttendee> = {
      employee_id: isInternal ? parseInt(attendeeForm.employee_id) : null,
      external_name: isInternal ? null : attendeeForm.external_name.trim(),
      external_email: isInternal ? null : (attendeeForm.external_email.trim() || null),
      external_company: isInternal ? null : (attendeeForm.external_company.trim() || null),
      role: attendeeForm.role || null,
      registration_status: attendeeForm.registration_status,
      arrival_date: attendeeForm.arrival_date || null,
      departure_date: attendeeForm.departure_date || null,
      notes: attendeeForm.notes || null,
    };

    if (editingAttendee) {
      updateAttendeeMutation.mutate({ attendeeId: editingAttendee.id, data });
    } else {
      addAttendeeMutation.mutate(data);
    }
  };

  const exportPdf = () => {
    if (!show) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const fmtMoneyPdf = (v: number) =>
      '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const moneyOrDash = (v?: number | string | null) => {
      if (v === null || v === undefined || v === '') return '—';
      const n = typeof v === 'string' ? parseFloat(v) : v;
      return isNaN(n) ? '—' : fmtMoneyPdf(n);
    };

    const eventDateStr = (() => {
      const range = fmtDateRange(show.event_start_date, show.event_end_date);
      return range === '—' ? '' : range;
    })();

    const computedBudget = (() => {
      if (show.total_budget !== null && show.total_budget !== undefined && show.total_budget !== '') {
        const n = typeof show.total_budget === 'string' ? parseFloat(show.total_budget) : show.total_budget;
        if (!isNaN(n)) return n;
      }
      let sum = 0;
      let any = false;
      for (const v of [show.registration_cost, show.booth_cost, show.travel_budget]) {
        if (v !== null && v !== undefined && v !== '') {
          const n = typeof v === 'string' ? parseFloat(v) : v;
          if (!isNaN(n)) { sum += n; any = true; }
        }
      }
      return any ? sum : null;
    })();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(show.name, margin, 50);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const subtitleParts = [statusLabel(show.status), eventDateStr, show.venue].filter(Boolean);
    if (subtitleParts.length) doc.text(subtitleParts.join('  •  '), margin, 68);
    doc.text(`Generated ${today}`, margin, 84);
    doc.setTextColor(0);

    let cursorY = 104;

    const ensureSpace = (needed: number) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (cursorY + needed > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
    };

    const sectionHeading = (label: string) => {
      ensureSpace(34);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(label.toUpperCase(), margin, cursorY);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(margin, cursorY + 4, pageWidth - margin, cursorY + 4);
      doc.setTextColor(0);
      cursorY += 18;
    };

    // ── Event Information ──
    sectionHeading('Event Information');
    const infoRows: [string, string][] = [
      ['Status', statusLabel(show.status)],
      ['Event Date', eventDateStr || '—'],
      ['Registration Deadline', fmtDate(show.registration_deadline)],
      ['Venue', show.venue || '—'],
      ['Location', [show.city, show.state, show.country].filter(Boolean).join(', ') || '—'],
      ['Booth', [show.booth_number, show.booth_size].filter(Boolean).join(' • ') || '—'],
      ['Sales Lead', show.sales_lead_name || '—'],
      ['Coordinator', show.coordinator_name || '—'],
    ];
    if (show.address) infoRows.push(['Address', show.address]);
    if (show.website_url) infoRows.push(['Website', show.website_url]);
    if (show.description) infoRows.push(['Description', show.description]);

    autoTable(doc, {
      startY: cursorY,
      body: infoRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, valign: 'top' },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 130 },
        1: { textColor: [31, 41, 55] },
      },
      margin: { left: margin, right: margin },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 14;

    // ── Budget ──
    sectionHeading('Budget');
    const budgetRows: [string, string][] = [
      ['Registration', moneyOrDash(show.registration_cost)],
      ['Booth', moneyOrDash(show.booth_cost)],
      ['Travel', moneyOrDash(show.travel_budget)],
      ['Total Budget', computedBudget === null ? '—' : fmtMoneyPdf(computedBudget)],
    ];
    autoTable(doc, {
      startY: cursorY,
      body: budgetRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 130 },
        1: { halign: 'right', cellWidth: 120 },
      },
      margin: { left: margin, right: margin },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 14;

    // ── Expenses ──
    const expenses = show.expenses || [];
    if (expenses.length > 0) {
      sectionHeading('Expense Tracking');

      const categoryLabel = (c: string) =>
        EXPENSE_CATEGORY_OPTIONS.find(o => o.value === c)?.label || c;

      const grouped = new Map<string, { items: TradeShowExpense[]; subtotal: number }>();
      for (const e of expenses) {
        const key = e.category || 'other';
        const amt = typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount ?? 0);
        if (!grouped.has(key)) grouped.set(key, { items: [], subtotal: 0 });
        const bucket = grouped.get(key)!;
        bucket.items.push(e);
        bucket.subtotal += isNaN(amt) ? 0 : amt;
      }
      const orderedGroups = Array.from(grouped.entries()).sort((a, b) => {
        const ai = EXPENSE_CATEGORY_OPTIONS.findIndex(o => o.value === a[0]);
        const bi = EXPENSE_CATEGORY_OPTIONS.findIndex(o => o.value === b[0]);
        return ai - bi;
      });

      const body: any[] = [];
      let total = 0;
      for (const [cat, { items, subtotal }] of orderedGroups) {
        for (const e of items) {
          const amt = typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount ?? 0);
          body.push([
            categoryLabel(e.category),
            e.description || '',
            e.vendor || '',
            fmtDate(e.expense_date),
            fmtMoneyPdf(isNaN(amt) ? 0 : amt),
          ]);
        }
        body.push([
          { content: `${categoryLabel(cat)} subtotal`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105] } },
          { content: fmtMoneyPdf(subtotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252], textColor: [71, 85, 105] } },
        ]);
        total += subtotal;
      }
      body.push([
        { content: 'Total Expenses', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [30, 41, 59], textColor: 255 } },
        { content: fmtMoneyPdf(total), styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 41, 59], textColor: 255 } },
      ]);

      autoTable(doc, {
        startY: cursorY,
        head: [['Category', 'Description', 'Vendor', 'Date', 'Amount']],
        body,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          4: { halign: 'right', cellWidth: 70 },
          3: { cellWidth: 65 },
          0: { cellWidth: 90 },
        },
        margin: { left: margin, right: margin },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 8;

      if (computedBudget !== null) {
        const variance = computedBudget - total;
        ensureSpace(20);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const varianceLabel = variance >= 0 ? 'under budget' : 'over budget';
        doc.text(
          `Budget: ${fmtMoneyPdf(computedBudget)}    Actual: ${fmtMoneyPdf(total)}    Variance: ${variance >= 0 ? '+' : ''}${fmtMoneyPdf(variance)} (${varianceLabel})`,
          margin,
          cursorY,
        );
        doc.setTextColor(0);
        cursorY += 16;
      }
      cursorY += 6;
    }

    // ── To-Dos ──
    const todos = show.todos || [];
    if (todos.length > 0) {
      sectionHeading('Conference To-Dos');

      const reminderLabel = (m?: number | null) => {
        if (m === null || m === undefined) return '';
        return REMINDER_OFFSET_OPTIONS.find(o => o.value === m)?.label || `${m} min before`;
      };
      const priorityLabel = (p: string) =>
        TODO_PRIORITY_OPTIONS.find(o => o.value === p)?.label || p;
      const dueStr = (t: TradeShowTodo) => {
        const d = fmtDate(t.due_date);
        if (!t.due_time) return d === '—' ? '' : d;
        const time = t.due_time.length >= 5 ? t.due_time.slice(0, 5) : t.due_time;
        return `${d} ${time}`;
      };

      autoTable(doc, {
        startY: cursorY,
        head: [['Status', 'Priority', 'Task', 'Due', 'Assigned To', 'Reminder']],
        body: todos.map(t => [
          t.status === 'done' ? 'Done' : t.status === 'in_progress' ? 'In Progress' : 'Open',
          priorityLabel(t.priority),
          t.description ? `${t.title}\n${t.description}` : t.title,
          dueStr(t),
          t.assigned_to_name || '',
          reminderLabel(t.reminder_offset_minutes),
        ]),
        styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 55 },
          3: { cellWidth: 75 },
          5: { cellWidth: 75 },
        },
        margin: { left: margin, right: margin },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 14;
    }

    // ── Attendees ──
    const attendees = show.attendees || [];
    if (attendees.length > 0) {
      sectionHeading('Attendees');
      autoTable(doc, {
        startY: cursorY,
        head: [['Name', 'Type', 'Email/Company', 'Role', 'Registration', 'Arrival', 'Departure']],
        body: attendees.map((a: TradeShowAttendee) => [
          attendeeName(a),
          a.employee_id ? 'Employee' : 'External',
          a.employee_id
            ? [a.employee_email, a.employee_job_title].filter(Boolean).join(' • ')
            : [a.external_email, a.external_company].filter(Boolean).join(' • '),
          a.role || '',
          ATTENDEE_REGISTRATION_STATUS_OPTIONS.find(o => o.value === a.registration_status)?.label || a.registration_status,
          fmtDate(a.arrival_date),
          fmtDate(a.departure_date),
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        margin: { left: margin, right: margin },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 14;
    }

    // ── Notes ──
    if (show.notes) {
      sectionHeading('Notes');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(show.notes, pageWidth - margin * 2);
      ensureSpace(lines.length * 12);
      doc.text(lines, margin, cursorY);
      cursorY += lines.length * 12 + 8;
    }

    // Page numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `${show.name} • Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'center' },
      );
    }

    const safeName = show.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    doc.save(`trade-show-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (isLoading) return <div className="loading">Loading…</div>;
  if (error || !show) return <div className="error-message">Trade show not found</div>;

  const computedBudget = (() => {
    if (show.total_budget !== null && show.total_budget !== undefined && show.total_budget !== '') {
      const n = typeof show.total_budget === 'string' ? parseFloat(show.total_budget) : show.total_budget;
      if (!isNaN(n)) return n;
    }
    let sum = 0;
    let any = false;
    for (const v of [show.registration_cost, show.booth_cost, show.travel_budget]) {
      if (v !== null && v !== undefined && v !== '') {
        const n = typeof v === 'string' ? parseFloat(v) : v;
        if (!isNaN(n)) { sum += n; any = true; }
      }
    }
    return any ? sum : null;
  })();

  const eventTime = (() => {
    const start = fmtTime(show.event_start_time);
    const end = fmtTime(show.event_end_time);
    if (!start && !end) return '';
    if (start && end) return `${start} – ${end}`;
    return start || end;
  })();

  return (
    <div className="container" style={{ maxWidth: '1200px', padding: '0 1.5rem' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing/trade-shows" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Trade Shows
            </Link>
            <h1>🎪 {show.name}</h1>
            <div style={{ marginTop: '0.5rem' }}>
              <span className={statusBadge(show.status)}>{statusLabel(show.status)}</span>
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn btn-secondary" onClick={exportPdf}>
            📄 Export PDF
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/marketing/trade-shows/${id}/edit`)}>
            ✏️ Edit
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDeleteShow}
            style={{ color: '#dc2626', borderColor: '#fecaca' }}
            disabled={deleteShowMutation.isPending}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Summary grid */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={sectionTitle}>Event Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem 1.5rem' }}>
          <div>
            <div style={labelStyle}>Event Date</div>
            <div style={valueStyle}>{fmtDateRange(show.event_start_date, show.event_end_date)}</div>
            {eventTime && <div style={{ ...valueStyle, color: '#6b7280', fontSize: '0.85rem' }}>{eventTime}</div>}
          </div>
          <div>
            <div style={labelStyle}>Registration Deadline</div>
            <div style={valueStyle}>{fmtDate(show.registration_deadline)}</div>
          </div>
          <div>
            <div style={labelStyle}>Venue</div>
            <div style={valueStyle}>{show.venue || '—'}</div>
            {(show.city || show.state) && (
              <div style={{ ...valueStyle, color: '#6b7280', fontSize: '0.85rem' }}>
                {[show.city, show.state, show.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div>
            <div style={labelStyle}>Booth</div>
            <div style={valueStyle}>
              {show.booth_number || show.booth_size
                ? `${show.booth_number || ''}${show.booth_number && show.booth_size ? ' • ' : ''}${show.booth_size || ''}`
                : '—'}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Sales Lead</div>
            <div style={valueStyle}>{show.sales_lead_name || '—'}</div>
            {show.sales_lead_email && (
              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{show.sales_lead_email}</div>
            )}
          </div>
          <div>
            <div style={labelStyle}>Coordinator</div>
            <div style={valueStyle}>{show.coordinator_name || '—'}</div>
            {show.coordinator_email && (
              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{show.coordinator_email}</div>
            )}
          </div>
          {show.website_url && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Website</div>
              <a href={show.website_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                {show.website_url}
              </a>
            </div>
          )}
          {show.address && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Address</div>
              <div style={valueStyle}>{show.address}</div>
            </div>
          )}
          {show.description && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Description</div>
              <div style={valueStyle}>{show.description}</div>
            </div>
          )}
        </div>
      </div>

      {/* Budget */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={sectionTitle}>Budget</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={labelStyle}>Registration</div>
            <div style={valueStyle}>{fmtMoney(show.registration_cost)}</div>
          </div>
          <div>
            <div style={labelStyle}>Booth</div>
            <div style={valueStyle}>{fmtMoney(show.booth_cost)}</div>
          </div>
          <div>
            <div style={labelStyle}>Travel Budget</div>
            <div style={valueStyle}>{fmtMoney(show.travel_budget)}</div>
          </div>
          <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '1rem' }}>
            <div style={labelStyle}>Total Budget</div>
            <div style={{ ...valueStyle, fontWeight: 700, fontSize: '1.1rem' }}>
              {computedBudget === null ? '—' : fmtMoney(computedBudget)}
            </div>
          </div>
        </div>
      </div>

      {/* Expense tracking (actuals) */}
      <TradeShowExpensesSection
        tradeShowId={showId}
        expenses={show.expenses || []}
        totalBudget={computedBudget}
      />

      {/* Conference to-dos */}
      <TradeShowTodosSection
        tradeShowId={showId}
        todos={show.todos || []}
      />

      {/* Attendees */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            Attendees ({show.attendees?.length ?? 0})
          </h3>
          <button className="btn btn-primary" onClick={openAddAttendee}>+ Add Attendee</button>
        </div>

        {!show.attendees || show.attendees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#6b7280' }}>
            No attendees yet. Add the first attendee to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Role</th>
                  <th>Registration</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th style={{ width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {show.attendees.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>
                      {attendeeName(a)}
                      {a.employee_id && a.employee_job_title && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>
                          {a.employee_job_title}
                          {a.employee_department ? ` • ${a.employee_department}` : ''}
                        </div>
                      )}
                      {a.employee_id && a.employee_email && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>{a.employee_email}</div>
                      )}
                      {!a.employee_id && a.external_email && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>{a.external_email}</div>
                      )}
                      {!a.employee_id && a.external_company && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>{a.external_company}</div>
                      )}
                    </td>
                    <td>
                      <span className={a.employee_id ? 'badge badge-success' : 'badge badge-info'}>
                        {a.employee_id ? 'Employee' : 'External'}
                      </span>
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '13px' }}
                        value={a.role || ''}
                        onChange={(e) => inlineUpdateAttendee(a, { role: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {ATTENDEE_ROLE_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '13px' }}
                        value={a.registration_status}
                        onChange={(e) => inlineUpdateAttendee(a, { registration_status: e.target.value as AttendeeRegistrationStatus })}
                      >
                        {ATTENDEE_REGISTRATION_STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="sales-date-cell">{fmtDate(a.arrival_date)}</td>
                    <td className="sales-date-cell">{fmtDate(a.departure_date)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openEditAttendee(a)}
                        title="Edit attendee"
                        style={{
                          background: 'none', border: 'none', color: '#6b7280',
                          cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px', marginRight: '4px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleRemoveAttendee(a)}
                        title="Remove attendee"
                        style={{
                          background: 'none', border: 'none', color: '#9ca3af',
                          cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {show.notes && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={sectionTitle}>Notes</h3>
          <div style={{ ...valueStyle, whiteSpace: 'pre-wrap' }}>{show.notes}</div>
        </div>
      )}

      {/* Add/Edit Attendee Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>
              {editingAttendee ? 'Edit Attendee' : 'Add Attendee'}
            </h2>

            {attendeeError && (
              <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', background: '#fee2e2', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem' }}>
                {attendeeError}
              </div>
            )}

            <form onSubmit={submitAttendee}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={labelStyle}>Attendee Type</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${attendeeForm.type === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setAttendeeForm(f => ({ ...f, type: 'internal' }))}
                  >
                    Employee
                  </button>
                  <button
                    type="button"
                    className={`btn ${attendeeForm.type === 'external' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setAttendeeForm(f => ({ ...f, type: 'external' }))}
                  >
                    External
                  </button>
                </div>
              </div>

              {attendeeForm.type === 'internal' ? (
                <div className="form-group">
                  <label className="form-label">Employee *</label>
                  <SearchableSelect
                    options={employeeOptions}
                    value={attendeeForm.employee_id}
                    onChange={(v) => setAttendeeForm(f => ({ ...f, employee_id: v }))}
                    placeholder="-- Select an employee --"
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input
                      className="form-input"
                      value={attendeeForm.external_name}
                      onChange={(e) => setAttendeeForm(f => ({ ...f, external_name: e.target.value }))}
                      placeholder="Full name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      value={attendeeForm.external_email}
                      onChange={(e) => setAttendeeForm(f => ({ ...f, external_email: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input
                      className="form-input"
                      value={attendeeForm.external_company}
                      onChange={(e) => setAttendeeForm(f => ({ ...f, external_company: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-input"
                    value={attendeeForm.role}
                    onChange={(e) => setAttendeeForm(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {ATTENDEE_ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Registration Status</label>
                  <select
                    className="form-input"
                    value={attendeeForm.registration_status}
                    onChange={(e) => setAttendeeForm(f => ({ ...f, registration_status: e.target.value as AttendeeRegistrationStatus }))}
                  >
                    {ATTENDEE_REGISTRATION_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Arrival Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={attendeeForm.arrival_date}
                    onChange={(e) => setAttendeeForm(f => ({ ...f, arrival_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Departure Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={attendeeForm.departure_date}
                    onChange={(e) => setAttendeeForm(f => ({ ...f, departure_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={attendeeForm.notes}
                  onChange={(e) => setAttendeeForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={addAttendeeMutation.isPending || updateAttendeeMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addAttendeeMutation.isPending || updateAttendeeMutation.isPending}
                >
                  {(addAttendeeMutation.isPending || updateAttendeeMutation.isPending)
                    ? 'Saving…'
                    : editingAttendee ? 'Save Changes' : 'Add Attendee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeShowDetail;
