import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface JsaData {
  number: number;
  project_name?: string;
  project_number?: string;
  date_of_work: string;
  customer_name?: string;
  department_trade?: string;
  filled_out_by?: string;
  task_description?: string;
  work_location?: string;
  ppe_required?: string[];
  permits_required?: string[];
  equipment_required?: string[];
  additional_comments?: string;
  notes?: string;
  worker_names?: string[];
  hazards?: {
    step_description?: string;
    hazard?: string;
    control_measure?: string;
  }[];
}

const PPE_OPTIONS = [
  'Safety Glasses', 'Gloves', 'Ear Plugs', 'Hard Hat',
  'Face Shield', 'Respirator', 'Fall Protection', 'FR Clothing',
];
const PERMIT_OPTIONS = [
  'Lockout/Tagout', 'Confined Space', 'Hot Work',
  'Critical Lift', 'Excavation', 'Customer Work Permit',
];
const EQUIPMENT_OPTIONS = [
  'Scissor/Boom Lift', 'Scaffold', 'Forklift',
  'All Terrain Forklift', 'Crane/Carry Deck', 'Excavation',
];

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function drawCheckbox(doc: jsPDF, x: number, y: number, size: number, checked: boolean) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(x, y, size, size);
  if (checked) {
    doc.setLineWidth(0.7);
    doc.line(x + 1.5, y + 1.5, x + size - 1.5, y + size - 1.5);
    doc.line(x + size - 1.5, y + 1.5, x + 1.5, y + size - 1.5);
    doc.setLineWidth(0.4);
  }
}

function drawCheckboxRow(
  doc: jsPDF,
  left: number,
  yPos: number,
  width: number,
  height: number,
  label: string,
  options: string[],
  selected: string[],
) {
  const cbSize = 7;
  const textY = yPos + height / 2 + 2.5;
  const cbY = yPos + (height - cbSize) / 2;
  let x = left + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text(label + ':', x, textY);
  x += doc.getTextWidth(label + ':') + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const allSelected = selected || [];
  const otherItems = allSelected.filter(s => !options.includes(s));

  options.forEach(item => {
    drawCheckbox(doc, x, cbY, cbSize, allSelected.includes(item));
    x += cbSize + 2;
    doc.text(item, x, textY);
    x += doc.getTextWidth(item) + 5;
  });

  drawCheckbox(doc, x, cbY, cbSize, otherItems.length > 0);
  x += cbSize + 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Other(s):', x, textY);
  if (otherItems.length > 0) {
    x += doc.getTextWidth('Other(s): ');
    doc.setFont('helvetica', 'normal');
    doc.text(otherItems.join(', '), x, textY);
  }
}

export async function generateJsaPdf(jsa: JsaData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  });

  const pageW = 792;
  const pageH = 612;
  const margin = 25;
  const contentW = pageW - 2 * margin;
  const left = margin;
  const right = pageW - margin;
  let y = margin;

  // ===== HEADER =====
  const headerH = 68;
  const logoW = 130;

  doc.setDrawColor(0);
  doc.setLineWidth(1.5);
  doc.rect(left, y, contentW, headerH);

  doc.setLineWidth(0.5);
  doc.line(left + logoW, y, left + logoW, y + headerH);

  // Logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 58, 92);
  doc.text('Tweet Garot', left + logoW / 2, y + 28, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('LIVE, WORK, PLAY - SAFE', left + logoW / 2, y + 40, { align: 'center' });

  // Title
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const titleCX = left + logoW + (contentW - logoW) / 2;
  doc.text('JSA - Jobsite Safety Analysis', titleCX, y + 15, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(left + logoW, y + 20, right, y + 20);

  // Info fields (2 rows x 3 cols)
  const fsy = y + 20;
  const frh = (headerH - 20) / 2;
  const c1 = left + logoW;
  const c1w = (contentW - logoW) * 0.55;
  const c2 = c1 + c1w;
  const c2w = (contentW - logoW) * 0.22;
  const c3 = c2 + c2w;

  doc.line(c1, fsy + frh, right, fsy + frh);
  doc.line(c2, fsy, c2, y + headerH);
  doc.line(c3, fsy, c3, y + headerH);

  function infoField(fx: number, fy: number, lbl: string, val: string) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(0);
    doc.text(lbl.toUpperCase(), fx + 3, fy + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(val || '', fx + 3, fy + 19);
  }

  infoField(c1, fsy, 'Name of Project or Jobsite:', jsa.project_name || '');
  infoField(c2, fsy, 'Project #:', jsa.project_number || '');
  infoField(c3, fsy, 'Date:', formatDate(jsa.date_of_work));
  infoField(c1, fsy + frh, 'Name of Customer and/or General Contractor:', jsa.customer_name || '');
  infoField(c2, fsy + frh, 'Department / Trade:', jsa.department_trade || '');
  infoField(c3, fsy + frh, 'Filled Out By:', jsa.filled_out_by || '');

  y += headerH;

  // ===== PPE / PERMITS / EQUIPMENT =====
  const rowH = 17;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, rowH);
  drawCheckboxRow(doc, left, y, contentW, rowH, 'PPE', PPE_OPTIONS, jsa.ppe_required || []);
  y += rowH;

  doc.rect(left, y, contentW, rowH);
  drawCheckboxRow(doc, left, y, contentW, rowH, 'PERMITS', PERMIT_OPTIONS, jsa.permits_required || []);
  y += rowH;

  // Equipment - thin sides, thick bottom
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);
  doc.line(left, y, left, y + rowH);
  doc.line(right, y, right, y + rowH);
  doc.setLineWidth(1.5);
  doc.line(left, y + rowH, right, y + rowH);
  drawCheckboxRow(doc, left, y, contentW, rowH, 'EQUIPMENT', EQUIPMENT_OPTIONS, jsa.equipment_required || []);
  y += rowH;

  // ===== HAZARD CATEGORIES =====
  const catH = 14;
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, catH, 'FD');
  doc.setLineWidth(1.5);
  doc.line(left, y + catH, right, y + catH);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text(
    'Gravity / Mechanical / Electrical / Motion / Temperature / Chemical / Sound / Pressure / Radiation / Biological',
    left + contentW / 2, y + 10, { align: 'center' }
  );
  y += catH;

  // ===== HAZARD TABLE =====
  const hazards = jsa.hazards || [];
  const ROW_COUNT = Math.max(10, hazards.length);
  const tableBody: string[][] = [];
  for (let i = 0; i < ROW_COUNT; i++) {
    const h = hazards[i];
    tableBody.push([
      String(i + 1),
      h?.step_description || '',
      h?.hazard || '',
      h?.control_measure || '',
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left, right: margin },
    head: [['', 'MAJOR TASKS', 'POTENTIAL HAZARDS', 'CONTROL ACTION']],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      lineColor: [187, 187, 187],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      valign: 'top',
      minCellHeight: 16,
    },
    headStyles: {
      fillColor: [232, 232, 232],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.75,
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [85, 85, 85] },
      1: { cellWidth: (contentW - 20) * 0.30 },
      2: { cellWidth: (contentW - 20) * 0.35 },
      3: { cellWidth: (contentW - 20) * 0.35 },
    },
  });

  y = (doc as any).lastAutoTable.finalY;

  // New page if not enough room for comments + workers + footer
  if (y + 120 > pageH - margin) {
    doc.addPage();
    y = margin;
  }

  // ===== ADDITIONAL COMMENTS =====
  doc.setDrawColor(0);
  doc.setLineWidth(1.5);
  doc.line(left, y, right, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text('ADDITIONAL COMMENTS:', left + 5, y + 10);

  const commentsText = jsa.additional_comments || jsa.notes || '';
  if (commentsText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(commentsText, contentW - 10);
    doc.text(lines, left + 5, y + 20);
    y += 22 + lines.length * 9;
  } else {
    y += 25;
  }

  // ===== WORKER SIGN-IN =====
  doc.setDrawColor(0);
  doc.setLineWidth(1.5);
  doc.line(left, y, right, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(0);
  doc.text(
    'WORKER SIGN-IN (entire crew): By printing my name, I acknowledge my participation in the JSA and commit to work safely',
    left + 5, y + 10
  );
  y += 14;

  const names = jsa.worker_names || [];
  const wCols = 3;
  const wRows = Math.ceil(Math.max(names.length, 6) / wCols);
  const wColW = contentW / wCols;
  const wCellH = 14;

  for (let r = 0; r < wRows; r++) {
    for (let c = 0; c < wCols; c++) {
      const idx = r * wCols + c;
      const name = names[idx] || '';
      const cx = left + c * wColW;
      doc.setDrawColor(204, 204, 204);
      doc.setLineWidth(0.5);
      doc.rect(cx, y, wColW, wCellH);
      if (name) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(0);
        doc.text(name, cx + 4, y + 10);
      }
    }
    y += wCellH;
  }

  // ===== FOOTER =====
  doc.setDrawColor(0);
  doc.setLineWidth(1.5);
  doc.line(left, y, right, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(26, 58, 92);
  doc.text('Send completed JSA to jsa@tweetgarot.com and to your Account or Project Manager', left + 5, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(85, 85, 85);
  doc.text('Rev 10/04/23', right - 5, y + 9, { align: 'right' });

  return doc.output('blob');
}
