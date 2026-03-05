import { jsPDF } from 'jspdf';

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

interface NearMissReportData {
  number: number;
  report_type: string;
  date_of_incident: string;
  location_on_site?: string;
  description: string;
  corrective_action?: string;
  date_corrected?: string | null;
  reported_by?: string;
  status?: string;
  notes?: string;
  project_name?: string;
  project_number?: string;
  created_by_name?: string;
  created_at?: string;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  near_miss: 'Near Miss',
  hazard_identification: 'Hazard Identification',
  incentive: 'Incentive',
};

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const d = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  const date = new Date(d + 'T00:00:00');
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function generateNearMissPdf(report: NearMissReportData, logoUrl?: string): Promise<Blob> {
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
      console.warn('[NearMiss PDF] Logo failed:', err);
    }
  }

  // ===== HEADER =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text('NEAR MISS / HAZARD / INCENTIVE REPORT', left, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text('Safety First & Always', left, y + 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`NM-${report.number}`, right, y + logoMaxH + 8, { align: 'right' });

  y += Math.max(32, logoMaxH + 14);
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

  // ===== REPORT TYPE BADGE =====
  const typeLabel = REPORT_TYPE_LABELS[report.report_type] || report.report_type;
  const typeColors: Record<string, { fill: [number, number, number]; text: [number, number, number]; border: [number, number, number] }> = {
    near_miss: { fill: [254, 242, 242], text: [220, 38, 38], border: [254, 202, 202] },
    hazard_identification: { fill: [255, 247, 237], text: [194, 65, 12], border: [254, 215, 170] },
    incentive: { fill: [240, 253, 244], text: [21, 128, 61], border: [187, 247, 208] },
  };
  const tc = typeColors[report.report_type] || typeColors.near_miss;

  doc.setFillColor(...tc.fill);
  doc.setDrawColor(...tc.border);
  doc.setLineWidth(1);
  const typeBadgeW = doc.getTextWidth(typeLabel) + 20;
  doc.roundedRect(left, y, typeBadgeW, 18, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...tc.text);
  doc.text(typeLabel, left + typeBadgeW / 2, y + 12, { align: 'center' });

  y += 26;

  // ===== INFO GRID =====
  const infoFields = [
    ['Date', formatDate(report.date_of_incident)],
    ['Reported By', report.reported_by || 'N/A'],
    ['Location on Site', report.location_on_site || 'N/A'],
    ['Created By', report.created_by_name || 'N/A'],
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

  // ===== HELPER: draw text section with box =====
  const drawSection = (title: string, content: string, minHeight = 40) => {
    const lines = doc.splitTextToSize(content || 'N/A', contentW - 12);
    const sectionH = Math.max(minHeight, lines.length * 11 + 10);

    if (y + sectionH + 20 > pageH - margin) {
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

    doc.setDrawColor(204, 204, 204);
    doc.setLineWidth(0.5);
    doc.rect(left, y, contentW, sectionH);
    doc.text(lines, left + 6, y + 11);
    y += sectionH + 8;
  };

  // ===== DESCRIPTION =====
  drawSection('Description of Near Miss / Hazard / Incentive', report.description || '', 60);

  // ===== CORRECTIVE ACTION =====
  drawSection('Corrective Action Taken', report.corrective_action || '', 40);

  // ===== DATE CORRECTED =====
  if (report.date_corrected) {
    if (y + 40 > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('DATE CORRECTED', left, y + 8);
    y += 12;

    doc.setDrawColor(204, 204, 204);
    doc.setLineWidth(0.5);
    doc.rect(left, y, contentW, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(formatDate(report.date_corrected), left + 6, y + 13);
    y += 28;
  }

  // ===== NOTES =====
  if (report.notes) {
    drawSection('Notes', report.notes, 30);
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
    `Tweet Garot Mechanical | Near Miss Report NM-${report.number}`,
    left + contentW / 2, y + 6, { align: 'center' }
  );

  const now = new Date();
  const genDate = formatDate(now.toISOString().split('T')[0]);
  const genTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  doc.text(`Generated on ${genDate} at ${genTime}`, left + contentW / 2, y + 14, { align: 'center' });

  return doc.output('blob');
}
