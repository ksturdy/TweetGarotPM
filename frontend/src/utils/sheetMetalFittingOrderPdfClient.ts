import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const FITTING_LABELS: Record<string, string> = {
  '90': '90\u00B0 Elbow',
  '45': '45\u00B0 Elbow',
  tee: 'Tee',
  wye: 'Wye',
  reducer: 'Reducer',
  offset: 'Offset',
  transition: 'Transition',
  end_cap: 'End Cap',
  takeoff: 'Takeoff/Tap',
  start_collar: 'Start Collar',
  flex_connector: 'Flex Connector',
  volume_damper: 'Volume Damper',
  fire_damper: 'Fire Damper',
  turning_vanes: 'Turning Vanes',
  duct: 'Duct (Straight)',
  other: 'Other',
  // Accessories
  register: 'Register',
  grille: 'Grille',
  diffuser: 'Diffuser',
  access_door: 'Access Door',
  smoke_detector: 'Smoke Det. Housing',
  filter_box: 'Filter Box',
  vav_box: 'VAV Box',
  mixing_box: 'Mixing Box',
  // Hardware
  drive_cleat: 'Drive Cleat',
  s_cleat: 'S-Cleat',
  hanger_strap: 'Hanger Strap',
  threaded_rod: 'Threaded Rod',
  nut: 'Nut',
  bolt: 'Bolt',
  washer: 'Washer',
  screw: 'Screw',
  all_thread: 'All-Thread',
  other_hardware: 'Other',
};

const JOIN_LABELS: Record<string, string> = {
  s_drive: 'S & Drive',
  tdc: 'TDC',
  flanged: 'Flanged',
  raw_crimped: 'Raw/Crimped',
  welded: 'Welded',
  slip_joint: 'Slip Joint',
  standing_seam: 'Standing Seam',
};

interface SheetMetalFittingItem {
  quantity?: number;
  fitting_type?: string;
  size?: string;
  join_type?: string;
  remarks?: string;
}

interface SheetMetalFittingOrderData {
  number: number;
  title?: string;
  project_name?: string;
  project_number?: string;
  material_type?: string;
  priority?: string;
  required_by_date?: string | null;
  location_on_site?: string;
  drawing_number?: string;
  drawing_revision?: string;
  notes?: string;
  items?: SheetMetalFittingItem[];
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const str = String(dateString);
  const date = new Date(str.includes('T') ? str : str + 'T00:00:00');
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function generateSheetMetalFittingOrderPdf(order: SheetMetalFittingOrderData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageW = 612;
  const margin = 36;
  const contentW = pageW - 2 * margin;
  const left = margin;
  const right = pageW - margin;
  let y = margin;

  // ===== HEADER =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text('SHEET METAL FITTING ORDER', left, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text('Tweet Garot Mechanical', left, y + 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`FO-SM-${order.number || ''}`, right, y + 16, { align: 'right' });

  y += 34;
  doc.setDrawColor(0);
  doc.setLineWidth(2);
  doc.line(left, y, right, y);
  y += 10;

  // ===== PROJECT BAR =====
  doc.setFillColor(240, 240, 240);
  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, 20, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0);
  const projectText = `${order.project_name || ''}${order.project_number ? ` (${order.project_number})` : ''}`;
  doc.text(projectText, left + 8, y + 14);

  if (order.priority === 'urgent' || order.priority === 'high') {
    const badgeText = order.priority.toUpperCase();
    const badgeW = doc.getTextWidth(badgeText) + 16;
    const badgeX = right - 8 - badgeW;
    doc.setFillColor(order.priority === 'urgent' ? 220 : 255, order.priority === 'urgent' ? 38 : 140, order.priority === 'urgent' ? 38 : 0);
    doc.rect(badgeX, y + 4, badgeW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255);
    doc.text(badgeText, badgeX + badgeW / 2, y + 13, { align: 'center' });
  }

  y += 28;

  // ===== INFO GRID =====
  const infoFields: [string, string][] = [];
  if (order.title) infoFields.push(['Title', order.title]);
  if (order.material_type) infoFields.push(['Material', order.material_type]);
  if (order.required_by_date) infoFields.push(['Required By', formatDate(order.required_by_date)]);
  if (order.location_on_site) infoFields.push(['Location', order.location_on_site]);
  if (order.drawing_number) infoFields.push(['Drawing', `${order.drawing_number}${order.drawing_revision ? ` Rev ${order.drawing_revision}` : ''}`]);

  if (infoFields.length > 0) {
    const infoCellH = 26;
    const infoColW = contentW / 2;
    const infoRows = Math.ceil(infoFields.length / 2);

    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.rect(left, y, contentW, infoRows * infoCellH);

    for (let r = 0; r < infoRows; r++) {
      for (let c = 0; c < 2; c++) {
        const idx = r * 2 + c;
        if (idx >= infoFields.length) continue;
        const [label, value] = infoFields[idx];
        const cx = left + c * infoColW;
        const cy = y + r * infoCellH;

        if (r < infoRows - 1) {
          doc.setDrawColor(220);
          doc.line(cx, cy + infoCellH, cx + infoColW, cy + infoCellH);
        }
        if (c === 0 && infoFields.length > 1) {
          doc.setDrawColor(220);
          doc.line(left + infoColW, cy, left + infoColW, cy + infoCellH);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(label.toUpperCase(), cx + 6, cy + 10);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(value, cx + 6, cy + 21);
      }
    }

    y += infoRows * infoCellH + 10;
  }

  // ===== ITEMS TABLE =====
  const items = order.items || [];
  const tableBody: string[][] = items.map((item) => [
    String(item.quantity || 1),
    FITTING_LABELS[item.fitting_type || ''] || item.fitting_type || '',
    item.size || '',
    JOIN_LABELS[item.join_type || ''] || item.join_type || '',
    item.remarks || '',
  ]);

  const minRows = Math.max(10, items.length);
  while (tableBody.length < minRows) {
    tableBody.push(['', '', '', '', '']);
  }

  autoTable(doc, {
    startY: y,
    margin: { left, right: margin },
    head: [['QTY', 'ITEM', 'SIZE', 'CONNECTION', 'REMARKS']],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      lineColor: [180, 180, 180],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      valign: 'middle',
      minCellHeight: 18,
    },
    headStyles: {
      fillColor: [180, 83, 9],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      lineColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 100 },
      2: { cellWidth: 110 },
      3: { cellWidth: 80 },
      4: { fontStyle: 'italic', fontSize: 8 },
    },
  });

  y = (doc as any).lastAutoTable.finalY;

  // ===== NOTES =====
  if (order.notes) {
    y += 10;
    const pageH = 792;
    if (y + 50 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('NOTES', left, y + 10);
    y += 14;

    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(order.notes, contentW - 12);
    const notesH = Math.max(30, noteLines.length * 12 + 10);
    doc.rect(left, y, contentW, notesH);
    doc.text(noteLines, left + 6, y + 12);
    y += notesH;
  }

  // ===== FOOTER =====
  y += 12;
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140);
  doc.text(`Tweet Garot Mechanical | Sheet Metal Fitting Order FO-SM-${order.number || ''}`, left + contentW / 2, y + 6, { align: 'center' });

  const now = new Date();
  const genDate = formatDate(now.toISOString());
  const genTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  doc.text(`Generated on ${genDate} at ${genTime}`, left + contentW / 2, y + 16, { align: 'center' });

  return doc.output('blob');
}
