import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

type RGB = [number, number, number];

interface DiffMeta {
  projectName: string;
  projectNumber?: string | null;
  fromVersionLabel: string;
  toVersionLabel: string;
  fromUploadedAt?: string | null;
  toUploadedAt?: string | null;
  generatedBy?: string | null;
}

interface DiffCounts {
  added: number;
  removed: number;
  changed: number;
}

interface DiffRowChanged {
  activity_id: string | null;
  name: string | null;
  is_mechanical?: boolean;
  diffs: Record<string, any>;
}

interface DiffRowSimple {
  activity_id: string | null;
  activity_name?: string | null;
  name?: string | null;
  is_mechanical?: boolean;
  start_date?: string | null;
  finish_date?: string | null;
}

interface ExportOptions {
  meta: DiffMeta;
  counts: DiffCounts;
  changed: DiffRowChanged[];
  added: DiffRowSimple[];
  removed: DiffRowSimple[];
  fileName: string;
  logoDataUrl?: string;
}

const ACCENT: RGB = [37, 99, 235];
const SLATE_900: RGB = [15, 23, 42];
const SLATE_700: RGB = [51, 65, 85];
const SLATE_500: RGB = [100, 116, 139];
const SLATE_400: RGB = [148, 163, 184];
const SLATE_50: RGB = [248, 250, 252];
const SLATE_200: RGB = [226, 232, 240];
const RED_600: RGB = [220, 38, 38];
const GREEN_600: RGB = [22, 163, 74];

// jsPDF's standard fonts only cover Latin-1 (WinAnsi). Any char outside that
// range triggers a broken-width fallback that renders every character in the
// string with huge spacing. Replace common offenders with ASCII equivalents
// and strip anything else.
function sanitize(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/[‐-―]/g, '-')   // hyphens, en/em dashes
    .replace(/[‘’‚′]/g, "'") // curly single quotes, prime
    .replace(/[“”„″]/g, '"') // curly double quotes
    .replace(/…/g, '...')           // ellipsis
    .replace(/•/g, '*')             // bullet
    .replace(/[←-⇿]/g, '->')   // arrows
    .replace(/™/g, '(TM)')          // trademark
    .replace(/ /g, ' ')             // nbsp
    // Strip anything still outside WinAnsi printable range
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '-';
  const iso = s.length >= 10 ? s.slice(0, 10) : s;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return s;
  return format(d, 'MMM d, yyyy');
}

function fmtTimestamp(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return format(d, 'MMM d, yyyy h:mm a');
}

function days(n: number): string {
  return `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`;
}

// Returns an array of plain-text "Label  Verdict (context)" lines plus the
// color for the verdict portion of each line. autoTable can't render rich
// text per-substring, so we draw it ourselves in didDrawCell.
interface ChangeLine {
  label: string;
  verdict: string;
  verdictColor: RGB;
  context: string;
}

function buildChangeLines(diffs: Record<string, any>): ChangeLine[] {
  const order = ['start', 'finish', 'duration', 'percent', 'name'];
  const keys = Object.keys(diffs).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const lines: ChangeLine[] = [];
  for (const k of keys) {
    const v = diffs[k];
    if (k === 'start' || k === 'finish') {
      const label = k === 'start' ? 'Start Date' : 'Finish Date';
      const d: number | null = v.deltaDays;
      let verdict = '—';
      let color: RGB = SLATE_500;
      if (d != null) {
        if (d > 0) { verdict = `Delayed by ${days(d)}`; color = RED_600; }
        else if (d < 0) { verdict = `Earlier by ${days(d)}`; color = GREEN_600; }
        else verdict = 'No change';
      } else if (!v.from && v.to) { verdict = 'Date set'; color = GREEN_600; }
      else if (v.from && !v.to) { verdict = 'Date cleared'; color = RED_600; }
      lines.push({ label, verdict, verdictColor: color, context: `(${fmtDate(v.from)} -> ${fmtDate(v.to)})` });
    } else if (k === 'duration') {
      const d: number | null = v.deltaDays;
      let verdict = '—';
      let color: RGB = SLATE_500;
      if (d != null) {
        if (d > 0) { verdict = `Increased by ${days(d)}`; color = RED_600; }
        else if (d < 0) { verdict = `Decreased by ${days(d)}`; color = GREEN_600; }
        else verdict = 'No change';
      } else if (v.from == null && v.to != null) verdict = 'Set';
      else if (v.from != null && v.to == null) verdict = 'Cleared';
      lines.push({ label: 'Duration', verdict, verdictColor: color, context: `(${v.from ?? '-'} -> ${v.to ?? '-'} days)` });
    } else if (k === 'percent') {
      const d: number | null = v.deltaPoints;
      let verdict = '—';
      let color: RGB = SLATE_500;
      if (d != null) {
        if (d > 0) { verdict = `Increased by ${Math.abs(d)} pts`; color = GREEN_600; }
        else if (d < 0) { verdict = `Decreased by ${Math.abs(d)} pts`; color = RED_600; }
        else verdict = 'No change';
      }
      lines.push({ label: '% Complete', verdict, verdictColor: color, context: `(${v.from ?? '-'}% -> ${v.to ?? '-'}%)` });
    } else if (k === 'name') {
      lines.push({
        label: 'Name',
        verdict: 'Renamed',
        verdictColor: SLATE_500,
        context: `("${String(v.from ?? '')}" -> "${String(v.to ?? '')}")`,
      });
    }
  }
  return lines;
}

export function exportGcScheduleDiffPdf(options: ExportOptions): void {
  const { meta, counts, changed, added, removed, fileName, logoDataUrl } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 40;
  const rightMargin = 40;

  const drawPageChrome = () => {
    // Accent bar
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(0, 0, pageWidth, 4, 'F');
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(SLATE_400[0], SLATE_400[1], SLATE_400[2]);
    const footerY = pageHeight - 20;
    doc.text(
      sanitize(`Generated ${format(new Date(), 'MMM d, yyyy h:mm a')}${meta.generatedBy ? `  ·  ${meta.generatedBy}` : ''}`),
      leftMargin,
      footerY
    );
    doc.text(`Page ${pageNum} of ${pageCount}`, pageWidth - rightMargin, footerY, { align: 'right' });
  };

  // Logo top-right (fixed bounding box; jsPDF preserves aspect when one
  // dimension is generous relative to the source)
  if (logoDataUrl) {
    try {
      const drawW = 130;
      const drawH = 36;
      doc.addImage(logoDataUrl, 'PNG', pageWidth - rightMargin - drawW, 14, drawW, drawH);
    } catch {
      // Silently skip
    }
  }

  drawPageChrome();

  // Title block
  let y = 44;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2]);
  doc.text('GC Schedule — Version Comparison', leftMargin, y);

  y += 16;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
  const projLine = sanitize(meta.projectNumber ? `${meta.projectNumber} - ${meta.projectName}` : meta.projectName);
  doc.text(projLine, leftMargin, y);

  // Versions strip
  y += 18;
  doc.setFontSize(9);
  doc.setTextColor(SLATE_700[0], SLATE_700[1], SLATE_700[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('From (older):', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    sanitize(`${meta.fromVersionLabel}${meta.fromUploadedAt ? `  ·  uploaded ${fmtTimestamp(meta.fromUploadedAt)}` : ''}`),
    leftMargin + 72,
    y
  );
  y += 13;
  doc.setFont('helvetica', 'bold');
  doc.text('To (newer):', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    sanitize(`${meta.toVersionLabel}${meta.toUploadedAt ? `  ·  uploaded ${fmtTimestamp(meta.toUploadedAt)}` : ''}`),
    leftMargin + 72,
    y
  );

  // Counts strip
  y += 14;
  const stripWidth = pageWidth - leftMargin - rightMargin;
  const stripHeight = 38;
  doc.setFillColor(SLATE_50[0], SLATE_50[1], SLATE_50[2]);
  doc.roundedRect(leftMargin, y, stripWidth, stripHeight, 4, 4, 'F');
  const cells: Array<{ label: string; value: string; color: RGB }> = [
    { label: 'Changed', value: String(counts.changed), color: SLATE_900 },
    { label: 'Added', value: String(counts.added), color: GREEN_600 },
    { label: 'Removed', value: String(counts.removed), color: RED_600 },
  ];
  const cellW = stripWidth / cells.length;
  cells.forEach((c, i) => {
    const cx = leftMargin + cellW * i + cellW / 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
    doc.text(c.label.toUpperCase(), cx, y + 14, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, cx, y + 30, { align: 'center' });
  });
  y += stripHeight + 14;

  // CHANGED section
  if (changed.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2]);
    doc.text(`Changed (${changed.length})`, leftMargin, y);
    y += 8;

    const rows = changed.map((r) => {
      const lines = buildChangeLines(r.diffs).map((l) => ({
        ...l,
        label: sanitize(l.label),
        verdict: sanitize(l.verdict),
        context: sanitize(l.context),
      }));
      return {
        activityId: sanitize(r.activity_id || '-'),
        name: sanitize((r.name || '') + (r.is_mechanical ? '  [MECH]' : '')),
        lines,
      };
    });

    autoTable(doc, {
      startY: y,
      head: [['Activity ID', 'Name', 'What changed']],
      body: rows.map((r) => [r.activityId, r.name, '']),
      margin: { left: leftMargin, right: rightMargin },
      styles: {
        fontSize: 8,
        cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
        textColor: SLATE_900,
        lineColor: SLATE_200,
        lineWidth: 0.5,
        valign: 'top',
      },
      headStyles: {
        fillColor: SLATE_50,
        textColor: SLATE_700,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [255, 251, 235] }, // soft amber for changed
      columnStyles: {
        0: { cellWidth: 80, font: 'courier', fontSize: 7.5 },
        1: { cellWidth: 220 },
        2: { cellWidth: pageWidth - leftMargin - rightMargin - 300 },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 2) {
          const row = rows[data.row.index];
          if (row) {
            // Reserve vertical space based on number of change lines
            const lineCount = Math.max(1, row.lines.length);
            data.cell.styles.minCellHeight = 12 + lineCount * 11;
            data.cell.text = ['']; // we'll draw it manually
          }
        }
      },
      didDrawCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== 2) return;
        const row = rows[data.row.index];
        if (!row) return;
        const x = data.cell.x + 6;
        let ly = data.cell.y + 12;
        doc.setFontSize(8);
        for (const line of row.lines) {
          // Label (bold, slate)
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(SLATE_700[0], SLATE_700[1], SLATE_700[2]);
          doc.text(line.label, x, ly);
          // Verdict (bold, color)
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(line.verdictColor[0], line.verdictColor[1], line.verdictColor[2]);
          doc.text(line.verdict, x + 78, ly);
          // Context (normal, muted)
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
          const verdictWidth = doc.getTextWidth(line.verdict);
          doc.text(line.context, x + 78 + verdictWidth + 6, ly);
          ly += 11;
        }
      },
      didDrawPage: drawPageChrome,
    });

    y = (doc as any).lastAutoTable.finalY + 18;
  }

  const simpleSection = (
    title: string,
    rows: DiffRowSimple[],
    rowFill: RGB
  ) => {
    if (rows.length === 0) return;
    // Page break if not enough room for header + a row
    if (y > pageHeight - 100) {
      doc.addPage();
      drawPageChrome();
      y = 44;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2]);
    doc.text(`${title} (${rows.length})`, leftMargin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Activity ID', 'Name', 'Start', 'Finish']],
      body: rows.map((r) => [
        sanitize(r.activity_id || '-'),
        sanitize((r.name || r.activity_name || '') + (r.is_mechanical ? '  [MECH]' : '')),
        fmtDate(r.start_date),
        fmtDate(r.finish_date),
      ]),
      margin: { left: leftMargin, right: rightMargin },
      styles: {
        fontSize: 8,
        cellPadding: 5,
        textColor: SLATE_900,
        lineColor: SLATE_200,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: SLATE_50,
        textColor: SLATE_700,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: rowFill },
      columnStyles: {
        0: { cellWidth: 80, font: 'courier', fontSize: 7.5 },
        2: { cellWidth: 90 },
        3: { cellWidth: 90 },
      },
      didDrawPage: drawPageChrome,
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  };

  simpleSection('Added (only in newer)', added, [236, 253, 245]);
  simpleSection('Removed (only in older)', removed, [254, 242, 242]);

  if (counts.changed === 0 && counts.added === 0 && counts.removed === 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
    doc.text('No differences between these versions.', leftMargin, y + 10);
  }

  doc.save(fileName);
}

// Load an authenticated image URL into a base64 data URL so it can be
// embedded in the PDF.
export function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    const token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status !== 200) { reject(new Error(`Failed: ${xhr.status}`)); return; }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = () => reject(new Error('Failed to load image'));
    xhr.send();
  });
}
