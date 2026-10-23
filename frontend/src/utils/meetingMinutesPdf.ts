import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Meeting, MeetingActionItem, MEETING_TYPES } from '../services/meetings';

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    const token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status !== 200) { reject(new Error(`Failed to load image: ${xhr.status}`)); return; }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = () => reject(new Error('Failed to load image'));
    xhr.send();
  });
}

function parseDate(d: string): Date {
  const s = d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00');
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  const dt = parseDate(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function formatDueDate(d: string | null | undefined): string {
  if (!d) return '';
  const dt = parseDate(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  ongoing: 'Ongoing',
  on_hold: 'On Hold',
  closed: 'Closed',
  information: 'Information',
};

const STATUS_COLORS: Record<string, [number, number, number]> = {
  open: [249, 115, 22],
  in_progress: [59, 130, 246],
  ongoing: [59, 130, 246],
  on_hold: [236, 72, 153],
  closed: [107, 114, 128],
  information: [14, 165, 233],
};

function renderActionItemsTable(
  doc: jsPDF,
  items: MeetingActionItem[],
  startY: number,
  left: number,
  right: number,
  contentW: number,
  indent: number = 0,
): number {
  autoTable(doc, {
    startY,
    margin: { left: left + indent, right: right - left - contentW + (right - left - contentW) },
    tableWidth: contentW - indent,
    head: [['', 'Description', 'Assignee', 'Due Date', 'Status']],
    body: items.map((ai, i) => [
      String(i + 1),
      ai.description + (ai.originated_meeting_number && ai.originated_meeting_id ? ` (From #${ai.originated_meeting_number})` : ''),
      ai.assignee_user_name || ai.assignee_name || '—',
      formatDueDate(ai.due_date) || '—',
      STATUS_LABELS[ai.status] || ai.status,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [50, 95, 150], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: (contentW - indent) * 0.4 },
      2: { cellWidth: (contentW - indent) * 0.22 },
      3: { cellWidth: (contentW - indent) * 0.18 },
      4: { cellWidth: (contentW - indent) * 0.14 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        const label = data.cell.raw as string;
        const colorEntry = Object.entries(STATUS_LABELS).find(([, v]) => v === label);
        if (colorEntry) {
          const col = STATUS_COLORS[colorEntry[0]];
          if (col) data.cell.styles.textColor = col;
        }
      }
    },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

export async function generateMeetingMinutesPdf(
  meeting: Meeting,
  projectName: string,
  logoUrl?: string,
  tenantCompany?: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const pageW = 612;
  const margin = 36;
  const left = margin;
  const right = pageW - margin;
  const contentW = right - left;
  let y = margin;

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoMaxH = 40;
  const logoMaxW = 110;
  if (logoUrl) {
    try {
      const imgData = await loadImageAsDataUrl(logoUrl);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = imgData; });
      const aspect = img.width / img.height;
      let drawW = logoMaxW;
      let drawH = drawW / aspect;
      if (drawH > logoMaxH) { drawH = logoMaxH; drawW = drawH * aspect; }
      doc.addImage(imgData, right - drawW, y, drawW, drawH);
    } catch { /* skip */ }
  }

  // ── Title block ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 95);
  doc.text('MEETING MINUTES', left, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(projectName, left, y + 30);

  y += Math.max(46, logoMaxH + 6);

  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(2);
  doc.line(left, y, right, y);
  y += 10;

  // ── Meeting info grid ─────────────────────────────────────────────────────
  const infoRows: [string, string][] = [
    ['Meeting', `#${meeting.number} — ${meeting.title}`],
    ['Type', MEETING_TYPES[meeting.meeting_type] || meeting.meeting_type],
    ['Status', meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)],
    ['Date', formatDate(meeting.scheduled_date) || '—'],
  ];
  if (meeting.start_time) {
    const timeStr = meeting.end_time
      ? `${formatTime(meeting.start_time)} – ${formatTime(meeting.end_time)}`
      : formatTime(meeting.start_time);
    infoRows.push(['Time', timeStr]);
  }
  if (meeting.location) infoRows.push(['Location', meeting.location]);
  if (meeting.series_title) infoRows.push(['Series', meeting.series_title]);
  if (meeting.created_by_name) infoRows.push(['Prepared by', meeting.created_by_name]);

  const col1W = 90;
  doc.setFontSize(9);
  infoRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(label + ':', left, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(val, left + col1W, y + 9);
    y += 14;
  });
  y += 6;

  // ── Attendees ─────────────────────────────────────────────────────────────
  const attendees = meeting.attendees || [];
  if (attendees.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text(`ATTENDEES (${attendees.length})`, left, y + 10);
    y += 16;

    autoTable(doc, {
      startY: y,
      margin: { left, right: margin },
      head: [['Name', 'Company', 'Attended']],
      body: attendees.map(a => [
        a.user_name || a.contact_name || a.name || '—',
        a.contact_company || a.company || (a.user_id ? (tenantCompany || '—') : '—'),
        a.attended ? 'Yes' : 'No',
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { cellWidth: contentW * 0.45 }, 1: { cellWidth: contentW * 0.35 }, 2: { cellWidth: contentW * 0.2 } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ── Agenda with nested action items ───────────────────────────────────────
  const agendaItems = meeting.agenda_items || [];
  const actionItems = meeting.action_items || [];

  // Group action items by agenda_item_id
  const actionsByAgendaId = new Map<number | null, MeetingActionItem[]>();
  actionItems.forEach(ai => {
    const key = ai.agenda_item_id ?? null;
    if (!actionsByAgendaId.has(key)) actionsByAgendaId.set(key, []);
    actionsByAgendaId.get(key)!.push(ai);
  });

  const unlinkedActions = actionsByAgendaId.get(null) || [];
  const linkedActionCount = actionItems.length - unlinkedActions.length;

  if (agendaItems.length > 0) {
    if (y > 680) { doc.addPage(); y = margin; }

    const agendaLabel = linkedActionCount > 0
      ? `AGENDA (${agendaItems.length} ITEMS · ${linkedActionCount} ACTION ITEMS)`
      : `AGENDA (${agendaItems.length} ITEMS)`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text(agendaLabel, left, y + 10);
    y += 18;

    agendaItems.forEach((item, idx) => {
      if (y > 700) { doc.addPage(); y = margin; }

      // Item number + title
      doc.setFillColor(240, 244, 248);
      doc.roundedRect(left, y, contentW, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 95);
      doc.text(`${idx + 1}.`, left + 6, y + 12);
      doc.setTextColor(20, 20, 20);
      doc.text(item.title, left + 22, y + 12);
      y += 22;

      // Notes
      if (item.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(item.notes, contentW - 20);
        lines.forEach((line: string) => {
          if (y > 720) { doc.addPage(); y = margin; }
          doc.text(line, left + 14, y + 9);
          y += 13;
        });
      }

      // Nested action items
      const itemActions = actionsByAgendaId.get(item.id) || [];
      if (itemActions.length > 0) {
        if (y > 680) { doc.addPage(); y = margin; }

        // Small "Action Items" label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text('ACTION ITEMS', left + 14, y + 8);
        y += 10;

        y = renderActionItemsTable(doc, itemActions, y, left + 14, right, contentW - 14, 0);
      } else {
        y += 6;
      }
    });
    y += 4;
  }

  // ── Unlinked Action Items ─────────────────────────────────────────────────
  if (unlinkedActions.length > 0) {
    if (y > 640) { doc.addPage(); y = margin; }

    const openCount = unlinkedActions.filter(a => a.status !== 'closed').length;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text(`UNLINKED ACTION ITEMS (${unlinkedActions.length})`, left, y + 10);
    if (openCount > 0) {
      doc.setFontSize(9);
      doc.setTextColor(245, 158, 11);
      doc.text(`${openCount} open`, left + 200, y + 10);
    }
    y += 16;

    y = renderActionItemsTable(doc, unlinkedActions, y, left, right, contentW, 0);
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Meeting #${meeting.number} · Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      left,
      792 - 20
    );
    doc.text(`Page ${p} of ${pageCount}`, right, 792 - 20, { align: 'right' });
  }

  return doc.output('blob');
}
