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

// After pre-processing with splitTextToSize the context may span multiple
// visual lines. contextLines[0] sits on the same row as label + verdict;
// subsequent entries flow onto additional rows.
interface RenderedChangeLine {
  label: string;
  verdict: string;
  verdictColor: RGB;
  contextLines: string[];
}

interface RenderedRow {
  activityId: string;
  name: string;
  lines: RenderedChangeLine[];
  totalVisualLines: number;
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
        if (d > 0) { verdict = `Increased by ${days(d)}`; color = GREEN_600; }
        else if (d < 0) { verdict = `Decreased by ${days(d)}`; color = RED_600; }
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

  const LOGO_W = 84;
  const LOGO_H = 21;
  // Placeholder replaced by putTotalPages() after all content is rendered.
  const TOTAL_PH = '{total_pages}';

  const drawPageChrome = () => {
    // Accent bar
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(0, 0, pageWidth, 4, 'F');
    // Footer
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(SLATE_400[0], SLATE_400[1], SLATE_400[2]);
    const footerY = pageHeight - 14;
    doc.text(
      sanitize(`Generated ${format(new Date(), 'MMM d, yyyy h:mm a')}${meta.generatedBy ? `  ·  ${meta.generatedBy}` : ''}`),
      leftMargin,
      footerY
    );
    doc.text(`Page ${pageNum} of ${TOTAL_PH}`, pageWidth - rightMargin, footerY, { align: 'right' });
    // Logo — drawn on page 1 each time drawPageChrome is invoked (startup + didDrawPage)
    if (pageNum === 1 && logoDataUrl) {
      console.log('[GC Schedule PDF] Drawing logo on page 1');
      try {
        doc.addImage(logoDataUrl, 'PNG', pageWidth - 10 - LOGO_W, 5, LOGO_W, LOGO_H);
      } catch (e) {
        console.warn('[GC Schedule PDF] addImage failed:', e);
      }
    }
  };

  drawPageChrome();

  // Title block — compact
  const textMaxX = pageWidth - 10 - LOGO_W - 8; // don't overlap logo
  let y = 22;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2]);
  doc.text('GC Schedule - Version Comparison', leftMargin, y);

  y += 9;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
  const projLine = sanitize(meta.projectNumber ? `${meta.projectNumber} - ${meta.projectName}` : meta.projectName);
  doc.text(projLine, leftMargin, y);

  // Version rows — label bold, value normal, truncated to stay left of logo
  const VER_LABEL_W = 58;
  doc.setFontSize(7);
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_700[0], SLATE_700[1], SLATE_700[2]);
  doc.text('From (older):', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  const fromText = sanitize(`${meta.fromVersionLabel}${meta.fromUploadedAt ? `  -  uploaded ${fmtTimestamp(meta.fromUploadedAt)}` : ''}`);
  const fromLines = doc.splitTextToSize(fromText, textMaxX - leftMargin - VER_LABEL_W) as string[];
  doc.text(fromLines[0], leftMargin + VER_LABEL_W, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('To (newer):', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  const toText = sanitize(`${meta.toVersionLabel}${meta.toUploadedAt ? `  -  uploaded ${fmtTimestamp(meta.toUploadedAt)}` : ''}`);
  const toLines = doc.splitTextToSize(toText, textMaxX - leftMargin - VER_LABEL_W) as string[];
  doc.text(toLines[0], leftMargin + VER_LABEL_W, y);

  // Counts strip — compact
  y += 7;
  const stripWidth = pageWidth - leftMargin - rightMargin;
  const stripHeight = 20;
  doc.setFillColor(SLATE_50[0], SLATE_50[1], SLATE_50[2]);
  doc.roundedRect(leftMargin, y, stripWidth, stripHeight, 3, 3, 'F');
  const cells: Array<{ label: string; value: string; color: RGB }> = [
    { label: 'Changed', value: String(counts.changed), color: SLATE_900 },
    { label: 'Added', value: String(counts.added), color: GREEN_600 },
    { label: 'Removed', value: String(counts.removed), color: RED_600 },
  ];
  const cellW = stripWidth / cells.length;
  cells.forEach((c, i) => {
    const cx = leftMargin + cellW * i + cellW / 2;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
    doc.text(c.label.toUpperCase(), cx, y + 6, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, cx, y + 16, { align: 'center' });
  });
  y += stripHeight + 6;

  // CHANGED section
  if (changed.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2]);
    doc.text(`Changed (${changed.length})`, leftMargin, y);
    y += 5;

    // Column geometry (must match columnStyles below)
    const LABEL_W = 78;
    const CELL_PAD = 3;
    const COL0_W = 110;
    const COL1_W = 250;
    const col2Width = pageWidth - leftMargin - rightMargin - COL0_W - COL1_W;

    // Pre-compute wrapped context lines so we can size rows correctly and
    // avoid text running off the right edge of the "What changed" cell.
    doc.setFontSize(7);
    const rows: RenderedRow[] = changed.map((r) => {
      const changeLines = buildChangeLines(r.diffs);
      const renderedLines: RenderedChangeLine[] = changeLines.map((l) => {
        const sanitizedLabel = sanitize(l.label);
        const sanitizedVerdict = sanitize(l.verdict);
        const sanitizedContext = sanitize(l.context);

        doc.setFont('helvetica', 'bold');
        const verdictW = doc.getTextWidth(sanitizedVerdict);
        // Context starts after: left-pad + label column + verdict + gap
        const contextStartX = CELL_PAD + LABEL_W + verdictW + 8;
        const contextAvailW = col2Width - contextStartX - CELL_PAD;

        let contextLines: string[];
        if (contextAvailW > 20) {
          doc.setFont('helvetica', 'normal');
          contextLines = doc.splitTextToSize(sanitizedContext, contextAvailW) as string[];
        } else {
          contextLines = [sanitizedContext.slice(0, 25) + '…'];
        }

        return { label: sanitizedLabel, verdict: sanitizedVerdict, verdictColor: l.verdictColor, contextLines };
      });

      // Each change entry occupies max(1, contextLines.length) visual rows.
      // The first context line shares a row with label+verdict; extras add rows.
      const totalVisualLines = renderedLines.reduce(
        (sum, l) => sum + Math.max(1, l.contextLines.length),
        0
      );



      return {
        activityId: sanitize(r.activity_id || '-'),
        name: sanitize((r.name || '') + (r.is_mechanical ? '  [MECH]' : '')),
        lines: renderedLines,
        totalVisualLines,
      };
    });

    autoTable(doc, {
      startY: y,
      head: [['Activity ID', 'Name', 'What changed']],
      body: rows.map((r) => [r.activityId, r.name, '']),
      margin: { left: leftMargin, right: rightMargin },
      styles: {
        fontSize: 7,
        cellPadding: { top: 2.5, right: 4, bottom: 2.5, left: 4 },
        textColor: SLATE_900,
        lineColor: SLATE_200,
        lineWidth: 0.5,
        valign: 'top',
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [255, 251, 235] }, // soft amber for changed
      columnStyles: {
        0: { cellWidth: COL0_W, fontSize: 7 },
        1: { cellWidth: COL1_W },
        2: { cellWidth: col2Width },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 2) {
          const row = rows[data.row.index];
          if (row) {
            data.cell.styles.minCellHeight = 7 + row.totalVisualLines * 9;
            data.cell.text = ['']; // drawn manually in didDrawCell
          }
        }
      },
      didDrawCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== 2) return;
        const row = rows[data.row.index];
        if (!row) return;
        const x = data.cell.x + CELL_PAD;
        let ly = data.cell.y + 8;
        doc.setFontSize(7);
        for (const line of row.lines) {
          // Label (bold, slate)
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(SLATE_700[0], SLATE_700[1], SLATE_700[2]);
          doc.text(line.label, x, ly);
          // Verdict (bold, colored)
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(line.verdictColor[0], line.verdictColor[1], line.verdictColor[2]);
          doc.text(line.verdict, x + LABEL_W, ly);
          // Context (normal, muted) — first line beside verdict, remainder indented
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
          const verdictW = doc.getTextWidth(line.verdict);
          for (let ci = 0; ci < line.contextLines.length; ci++) {
            if (ci === 0) {
              doc.text(line.contextLines[0], x + LABEL_W + verdictW + 8, ly);
            } else {
              ly += 9;
              doc.text(line.contextLines[ci], x + LABEL_W + 4, ly);
            }
          }
          ly += 9;
        }
      },
      didDrawPage: drawPageChrome,
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  const simpleSection = (
    title: string,
    rows: DiffRowSimple[],
    rowFill: RGB
  ) => {
    if (rows.length === 0) return;
    // Page break if not enough room for header + a row
    if (y > pageHeight - 80) {
      doc.addPage();
      drawPageChrome();
      y = 26;
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2]);
    doc.text(`${title} (${rows.length})`, leftMargin, y);
    y += 5;

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
        fontSize: 7,
        cellPadding: { top: 2.5, right: 4, bottom: 2.5, left: 4 },
        textColor: SLATE_900,
        lineColor: SLATE_200,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: rowFill },
      columnStyles: {
        0: { cellWidth: 110, fontSize: 7 },
        2: { cellWidth: 85 },
        3: { cellWidth: 85 },
      },
      didDrawPage: drawPageChrome,
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  };

  simpleSection('Added (only in newer)', added, [236, 253, 245]);
  simpleSection('Removed (only in older)', removed, [254, 242, 242]);

  if (counts.changed === 0 && counts.added === 0 && counts.removed === 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
    doc.text('No differences between these versions.', leftMargin, y + 10);
  }

  // Replace placeholder in all footer instances with the true final page count.
  doc.putTotalPages(TOTAL_PH);
  doc.save(fileName);
}

// Load an authenticated image URL into a base64 data URL for PDF embedding.
export async function loadImageAsDataUrl(url: string): Promise<string> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string' && reader.result.length > 100) {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader returned empty or invalid data'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}
