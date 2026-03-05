import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    const token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status !== 200) {
        reject(new Error(`Failed to load image: ${xhr.status}`));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = () => reject(new Error('Failed to load image'));
    xhr.send();
  });
}

interface CrewData {
  trade: string;
  foreman?: string;
  crew_size: number;
  hours_worked: number;
  work_description?: string;
}

interface DailyReportData {
  id: number;
  report_date: string;
  project_name?: string;
  project_number?: string;
  weather?: string;
  temperature?: string;
  work_performed?: string;
  materials?: string;
  equipment?: string;
  visitors?: string;
  issues?: string;
  status?: string;
  delay_hours?: number;
  delay_reason?: string;
  safety_incidents?: number;
  safety_notes?: string;
  created_by_name?: string;
  crews?: CrewData[];
}

function parseDate(dateString: string): Date {
  // Handle both "2026-03-05" and "2026-03-05T05:00:00.000Z" formats
  const d = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  return new Date(d + 'T00:00:00');
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = parseDate(dateString);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatLongDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = parseDate(dateString);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const TRADE_LABELS: Record<string, string> = {
  plumbing: 'Plumbing',
  piping: 'Piping',
  sheet_metal: 'Sheet Metal',
  general: 'General',
  other: 'Other',
};

export async function generateDailyReportPdf(report: DailyReportData, logoUrl?: string): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageW = 612;
  const pageH = 792;
  const margin = 36;
  const contentW = pageW - 2 * margin;
  const left = margin;
  const right = pageW - margin;
  let y = margin;

  // ===== LOGO (upper right) =====
  const logoMaxH = 36;
  const logoMaxW = 100;
  if (logoUrl) {
    try {
      const imgData = await loadImageAsDataUrl(logoUrl);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imgData;
      });
      const aspect = img.width / img.height;
      let drawW = logoMaxW;
      let drawH = drawW / aspect;
      if (drawH > logoMaxH) {
        drawH = logoMaxH;
        drawW = drawH * aspect;
      }
      doc.addImage(imgData, right - drawW, y, drawW, drawH);
    } catch (err) {
      console.warn('[DailyReport PDF] Logo failed:', err);
    }
  }

  // ===== HEADER =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text('DAILY REPORT', left, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text('Tweet Garot Mechanical', left, y + 26);

  y += Math.max(32, logoMaxH + 4);
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
  const projectText = `${report.project_name || ''}${report.project_number ? ` (${report.project_number})` : ''}`;
  doc.text(projectText, left + 6, y + 12);

  // Status badge
  if (report.status) {
    const badgeText = report.status.toUpperCase();
    const badgeW = doc.getTextWidth(badgeText) + 14;
    const badgeX = right - 6 - badgeW;
    const colors: Record<string, [number, number, number]> = {
      draft: [107, 114, 128],
      submitted: [37, 99, 235],
    };
    const [r, g, b] = colors[report.status] || [107, 114, 128];
    doc.setFillColor(r, g, b);
    doc.rect(badgeX, y + 3, badgeW, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, badgeX + badgeW / 2, y + 11.5, { align: 'center' });
  }

  y += 24;

  // ===== INFO GRID =====
  const infoFields = [
    ['Report Date', formatDate(report.report_date)],
    ['Created By', report.created_by_name || ''],
    ['Weather', report.weather || 'N/A'],
    ['Temperature', report.temperature || 'N/A'],
  ];

  const infoCellH = 24;
  const infoColW = contentW / 2;
  const infoRows = Math.ceil(infoFields.length / 2);

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, infoRows * infoCellH);

  for (let r = 0; r < infoRows; r++) {
    for (let c = 0; c < 2; c++) {
      const idx = r * 2 + c;
      if (idx >= infoFields.length) continue;
      const [label, value] = infoFields[idx];
      const cx = left + c * infoColW;
      const cy = y + r * infoCellH;

      doc.setDrawColor(204, 204, 204);
      doc.setLineWidth(0.5);
      if (r < infoRows - 1) doc.line(cx, cy + infoCellH, cx + infoColW, cy + infoCellH);
      if (c === 0) doc.line(left + infoColW, cy, left + infoColW, cy + infoCellH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(85, 85, 85);
      doc.text(label.toUpperCase(), cx + 6, cy + 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text(value, cx + 6, cy + 19);
    }
  }

  y += infoRows * infoCellH + 10;

  // ===== WORK PERFORMED =====
  const drawSection = (title: string, content: string, minHeight = 30) => {
    if (y + 50 > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(title.toUpperCase(), left, y + 8);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    const lines = doc.splitTextToSize(content || 'N/A', contentW - 12);
    const sectionH = Math.max(minHeight, lines.length * 11 + 10);

    doc.setDrawColor(204, 204, 204);
    doc.setLineWidth(0.5);
    doc.rect(left, y, contentW, sectionH);
    doc.text(lines, left + 6, y + 11);
    y += sectionH + 8;
  };

  drawSection('Work Performed', report.work_performed || '', 40);

  // ===== CREW TABLE =====
  const crews = report.crews || [];
  if (crews.length > 0) {
    if (y + 60 > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('CREWS', left, y + 8);
    y += 12;

    const tableBody = crews.map((crew) => [
      TRADE_LABELS[crew.trade] || crew.trade,
      crew.foreman || '-',
      String(crew.crew_size),
      String(crew.hours_worked),
      String(crew.crew_size * crew.hours_worked),
      crew.work_description || '',
    ]);

    const totalManHours = crews.reduce((sum, c) => sum + c.crew_size * c.hours_worked, 0);
    tableBody.push(['', '', '', '', String(totalManHours), 'TOTAL MAN-HOURS']);

    autoTable(doc, {
      startY: y,
      margin: { left, right: margin },
      head: [['Trade', 'Foreman', 'Crew', 'Hours', 'Man-Hrs', 'Work Description']],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
        lineColor: [187, 187, 187],
        lineWidth: 0.5,
        textColor: [0, 0, 0],
        valign: 'middle',
        minCellHeight: 16,
      },
      headStyles: {
        fillColor: [51, 51, 51],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 80 },
        2: { cellWidth: 36, halign: 'center' },
        3: { cellWidth: 40, halign: 'center' },
        4: { cellWidth: 48, halign: 'center', fontStyle: 'bold' },
        5: {},
      },
      didParseCell: (data: any) => {
        // Bold the totals row
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== MATERIALS & EQUIPMENT =====
  if (report.materials) {
    drawSection('Materials', report.materials);
  }
  if (report.equipment) {
    drawSection('Equipment', report.equipment);
  }

  // ===== DELAYS =====
  if ((report.delay_hours && report.delay_hours > 0) || report.delay_reason) {
    if (y + 50 > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('DELAYS', left, y + 8);
    y += 12;

    doc.setDrawColor(204, 204, 204);
    doc.setLineWidth(0.5);

    const delayText = `${report.delay_hours || 0} hour(s)${report.delay_reason ? ' - ' + report.delay_reason : ''}`;
    const delayLines = doc.splitTextToSize(delayText, contentW - 12);
    const delayH = Math.max(20, delayLines.length * 11 + 10);
    doc.rect(left, y, contentW, delayH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text(delayLines, left + 6, y + 11);
    y += delayH + 8;
  }

  // ===== SAFETY =====
  if (y + 50 > pageH - margin) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text('SAFETY', left, y + 8);
  y += 12;

  const safetyText = `Incidents: ${report.safety_incidents || 0}${report.safety_notes ? '\nNotes: ' + report.safety_notes : ''}`;
  const safetyLines = doc.splitTextToSize(safetyText, contentW - 12);
  const safetyH = Math.max(20, safetyLines.length * 11 + 10);
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, safetyH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 51, 51);
  doc.text(safetyLines, left + 6, y + 11);
  y += safetyH + 8;

  // ===== VISITORS / ISSUES =====
  if (report.visitors) {
    drawSection('Visitors', report.visitors);
  }
  if (report.issues) {
    drawSection('Issues', report.issues);
  }

  // ===== FOOTER =====
  y += 4;
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
  doc.text(
    `Tweet Garot Mechanical | Daily Report - ${formatDate(report.report_date)}`,
    left + contentW / 2, y + 6, { align: 'center' }
  );

  const now = new Date();
  const genDate = formatDate(now.toISOString().split('T')[0]);
  const genTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  doc.text(`Generated on ${genDate} at ${genTime}`, left + contentW / 2, y + 14, { align: 'center' });

  return doc.output('blob');
}
