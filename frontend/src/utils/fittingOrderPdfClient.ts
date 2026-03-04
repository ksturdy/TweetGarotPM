import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fittingTypesImg from '../assets/fitting-types-reference.png';

function loadImageAsDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then(res => res.blob())
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));
}

interface FittingOrderItem {
  quantity?: number | null;
  fitting_type?: number | null;
  dim_a?: string;
  dim_b?: string;
  dim_c?: string;
  dim_d?: string;
  dim_e?: string;
  dim_f?: string;
  dim_l?: string;
  dim_r?: string;
  dim_x?: string;
  gauge?: string;
  liner?: string;
  connection?: string;
  remarks?: string;
}

interface FittingOrderData {
  number: number;
  title?: string;
  project_name?: string;
  project_number?: string;
  requested_by?: string;
  date_required?: string | null;
  material?: string;
  static_pressure_class?: string;
  longitudinal_seam?: string;
  prepared_by?: string;
  labor_phase_code?: string;
  material_phase_code?: string;
  priority?: string;
  notes?: string;
  items?: FittingOrderItem[];
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function generateFittingOrderPdf(order: FittingOrderData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageW = 612;
  const pageH = 792;
  const margin = 29;
  const contentW = pageW - 2 * margin;
  const left = margin;
  const right = pageW - margin;
  let y = margin;

  // ===== HEADER =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text('DUCT WORK FITTING ORDER', left, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text('Tweet Garot Mechanical', left, y + 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`FO-SM-${order.number || ''}`, right, y + 14, { align: 'right' });

  y += 32;
  doc.setDrawColor(0);
  doc.setLineWidth(2);
  doc.line(left, y, right, y);
  y += 8;

  // ===== PROJECT BAR =====
  doc.setFillColor(240, 240, 240);
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, 18, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0);
  const projectText = `${order.project_name || ''}${order.project_number ? ` (${order.project_number})` : ''}`;
  doc.text(projectText, left + 6, y + 12);

  if (order.priority === 'urgent' || order.priority === 'high') {
    const badgeText = order.priority.toUpperCase();
    const badgeW = doc.getTextWidth(badgeText) + 14;
    const badgeX = right - 6 - badgeW;
    if (order.priority === 'urgent') {
      doc.setFillColor(255, 0, 0);
    } else {
      doc.setFillColor(255, 140, 0);
    }
    doc.rect(badgeX, y + 3, badgeW, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, badgeX + badgeW / 2, y + 11.5, { align: 'center' });
  }

  y += 24;

  // ===== INFO GRID (2 cols x 4 rows) =====
  const infoFields = [
    ['Requested By', order.requested_by || ''],
    ['Date Required', formatDate(order.date_required)],
    ['Material', order.material || ''],
    ['Static Pressure Class', order.static_pressure_class || ''],
    ['Longitudinal Seam', order.longitudinal_seam || ''],
    ['Prepared By', order.prepared_by || ''],
    ['Labor Phase Code', order.labor_phase_code || ''],
    ['Material Phase Code', order.material_phase_code || ''],
  ];

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, 0); // top border

  const infoCellH = 24;
  const infoColW = contentW / 2;
  const infoRows = Math.ceil(infoFields.length / 2);

  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, infoRows * infoCellH);

  for (let r = 0; r < infoRows; r++) {
    for (let c = 0; c < 2; c++) {
      const idx = r * 2 + c;
      if (idx >= infoFields.length) continue;
      const [label, value] = infoFields[idx];
      const cx = left + c * infoColW;
      const cy = y + r * infoCellH;

      // Cell borders
      doc.setDrawColor(204, 204, 204);
      doc.setLineWidth(0.5);
      if (r < infoRows - 1) doc.line(cx, cy + infoCellH, cx + infoColW, cy + infoCellH);
      if (c === 0) doc.line(left + infoColW, cy, left + infoColW, cy + infoCellH);

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(85, 85, 85);
      doc.text(label.toUpperCase(), cx + 6, cy + 9);

      // Value
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text(value, cx + 6, cy + 19);
    }
  }

  y += infoRows * infoCellH + 8;

  // ===== FITTING TYPES REFERENCE IMAGE =====
  try {
    const imgData = await loadImageAsDataUrl(fittingTypesImg);
    // Original image is ~1567x168px; scale to content width, preserving aspect ratio
    const imgH = contentW * (168 / 1567);
    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.5);
    doc.rect(left, y, contentW, imgH + 4);
    doc.addImage(imgData, 'PNG', left + 2, y + 2, contentW - 4, imgH);
    y += imgH + 8;
  } catch {
    // Fallback to text legend if image fails to load
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.5);
    doc.rect(left, y, contentW, 14, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(85, 85, 85);
    doc.text(
      'FITTING TYPES:  1-St. Joint   2-Reducer   3-Offset   4-Elbow   5-Tee   6-Wye   7-Dbl Branch   8-Tap   9-Transition   10-End Cap',
      left + 4, y + 9
    );
    y += 18;
  }

  // ===== FITTINGS TABLE =====
  const items = order.items || [];
  const ROW_COUNT = Math.max(15, items.length);
  const tableBody: string[][] = [];

  for (let i = 0; i < ROW_COUNT; i++) {
    const item = items[i];
    if (item) {
      const axb = [item.dim_a, item.dim_b].filter(Boolean).join(' x ') || '';
      const cxd = [item.dim_c, item.dim_d].filter(Boolean).join(' x ') || '';
      tableBody.push([
        String(item.quantity || ''),
        String(item.fitting_type || ''),
        axb, cxd,
        item.dim_e || '', item.dim_f || '',
        item.dim_l || '', item.dim_r || '', item.dim_x || '',
        item.gauge || '', item.liner || '', item.connection || '',
        item.remarks || '',
      ]);
    } else {
      tableBody.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
    }
  }

  autoTable(doc, {
    startY: y,
    margin: { left, right: margin },
    head: [['#REQ', 'TYPE', 'A x B', 'C x D', 'E', 'F', 'L', 'R', 'X', 'GA', 'LINER', 'CONN', 'REMARKS']],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.5,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      lineColor: [187, 187, 187],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      halign: 'center',
      valign: 'middle',
      minCellHeight: 14,
    },
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6,
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 48 },
      3: { cellWidth: 48 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28 },
      6: { cellWidth: 28 },
      7: { cellWidth: 28 },
      8: { cellWidth: 28 },
      9: { cellWidth: 26 },
      10: { cellWidth: 32 },
      11: { cellWidth: 36 },
      12: { halign: 'left', fontStyle: 'italic', fontSize: 6 },
    },
  });

  y = (doc as any).lastAutoTable.finalY;

  // ===== NOTES =====
  if (order.notes) {
    y += 8;
    if (y + 50 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(0);
    doc.text('NOTES', left, y + 8);
    y += 12;

    doc.setDrawColor(204, 204, 204);
    doc.setLineWidth(0.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(order.notes, contentW - 12);
    const notesH = Math.max(30, noteLines.length * 10 + 10);
    doc.rect(left, y, contentW, notesH);
    doc.text(noteLines, left + 6, y + 10);
    y += notesH;
  }

  // ===== FOOTER =====
  y += 10;
  if (y + 20 > pageH - margin) {
    doc.addPage();
    y = margin;
  }
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(136, 136, 136);
  doc.text(`Tweet Garot Mechanical | Fitting Order FO-SM-${order.number || ''}`, left + contentW / 2, y + 6, { align: 'center' });

  const now = new Date();
  const genDate = formatDate(now.toISOString());
  const genTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  doc.text(`Generated on ${genDate} at ${genTime}`, left + contentW / 2, y + 14, { align: 'center' });

  return doc.output('blob');
}
