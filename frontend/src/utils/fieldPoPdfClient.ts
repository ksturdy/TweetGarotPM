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

interface POItemData {
  sort_order: number;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  quantity_received?: number;
}

interface FieldPOData {
  number: number;
  project_name?: string;
  project_number?: string;
  vendor_name?: string;
  vendor_contact?: string;
  vendor_phone?: string;
  vendor_email?: string;
  description?: string;
  delivery_date?: string | null;
  delivery_location?: string;
  shipping_method?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  shipping_cost: number;
  total: number;
  cost_code?: string;
  phase_code?: string;
  status?: string;
  notes?: string;
  created_by_name?: string;
  approved_by_name?: string | null;
  created_at?: string;
  items?: POItemData[];
}

function fpoDisplayNumber(po: FieldPOData): string {
  const initials = (po.created_by_name || '')
    .split(' ')
    .map(n => n.charAt(0).toUpperCase())
    .filter(Boolean)
    .join('');
  return `${po.project_number || ''}-FPO-${po.number}${initials ? '-' + initials : ''}`;
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const d = dateString.includes('T') ? dateString : dateString + 'T00:00:00';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number | undefined | null): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

export async function generateFieldPoPdf(po: FieldPOData, logoUrl?: string): Promise<Blob> {
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
      console.warn('[FieldPO PDF] Logo failed:', err);
    }
  }

  // ===== HEADER =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text('FIELD PURCHASE ORDER', left, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text('Tweet Garot Mechanical', left, y + 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0);
  // Place FPO number below the logo area
  doc.text(fpoDisplayNumber(po), right, y + logoMaxH + 8, { align: 'right' });

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
  const projectText = `${po.project_name || ''}${po.project_number ? ` (${po.project_number})` : ''}`;
  doc.text(projectText, left + 6, y + 12);

  // Status badge
  if (po.status) {
    const badgeText = po.status.toUpperCase();
    const badgeW = doc.getTextWidth(badgeText) + 14;
    const badgeX = right - 6 - badgeW;
    const colors: Record<string, [number, number, number]> = {
      draft: [107, 114, 128],
      submitted: [37, 99, 235],
      approved: [22, 163, 74],
      ordered: [147, 51, 234],
      received: [6, 182, 212],
      closed: [75, 85, 99],
      cancelled: [239, 68, 68],
    };
    const [r, g, b] = colors[po.status] || [107, 114, 128];
    doc.setFillColor(r, g, b);
    doc.rect(badgeX, y + 3, badgeW, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, badgeX + badgeW / 2, y + 11.5, { align: 'center' });
  }

  y += 24;

  // ===== VENDOR INFO GRID =====
  const vendorFields = [
    ['Vendor', po.vendor_name || 'N/A'],
    ['Contact', po.vendor_contact || 'N/A'],
    ['Phone', po.vendor_phone || 'N/A'],
    ['Email', po.vendor_email || 'N/A'],
  ];

  const infoCellH = 24;
  const infoColW = contentW / 2;
  const infoRows = Math.ceil(vendorFields.length / 2);

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, infoRows * infoCellH);

  for (let r = 0; r < infoRows; r++) {
    for (let c = 0; c < 2; c++) {
      const idx = r * 2 + c;
      if (idx >= vendorFields.length) continue;
      const [label, value] = vendorFields[idx];
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

  y += infoRows * infoCellH + 4;

  // ===== DELIVERY & CODING INFO =====
  const deliveryFields = [
    ['Delivery Date', formatDate(po.delivery_date)],
    ['Delivery Location', po.delivery_location || 'N/A'],
    ['Shipping Method', po.shipping_method || 'N/A'],
    ['Cost Code', po.cost_code || 'N/A'],
    ['Phase Code', po.phase_code || 'N/A'],
    ['Created By', po.created_by_name || 'N/A'],
  ];

  const delRows = Math.ceil(deliveryFields.length / 2);
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(left, y, contentW, delRows * infoCellH);

  for (let r = 0; r < delRows; r++) {
    for (let c = 0; c < 2; c++) {
      const idx = r * 2 + c;
      if (idx >= deliveryFields.length) continue;
      const [label, value] = deliveryFields[idx];
      const cx = left + c * infoColW;
      const cy = y + r * infoCellH;

      doc.setDrawColor(204, 204, 204);
      doc.setLineWidth(0.5);
      if (r < delRows - 1) doc.line(cx, cy + infoCellH, cx + infoColW, cy + infoCellH);
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

  y += delRows * infoCellH + 10;

  // ===== DESCRIPTION =====
  if (po.description) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('DESCRIPTION', left, y + 8);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    const descLines = doc.splitTextToSize(po.description, contentW - 12);
    const descH = Math.max(20, descLines.length * 11 + 10);
    doc.setDrawColor(204, 204, 204);
    doc.setLineWidth(0.5);
    doc.rect(left, y, contentW, descH);
    doc.text(descLines, left + 6, y + 11);
    y += descH + 8;
  }

  // ===== LINE ITEMS TABLE =====
  const items = po.items || [];
  if (items.length > 0) {
    if (y + 60 > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(`LINE ITEMS (${items.length})`, left, y + 8);
    y += 12;

    const tableBody = items.map((item) => [
      String(item.sort_order),
      item.description || '',
      String(item.quantity),
      item.unit || '',
      formatCurrency(item.unit_cost),
      formatCurrency(item.total_cost),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left, right: margin },
      head: [['#', 'Description', 'Qty', 'Unit', 'Unit Cost', 'Total']],
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
        0: { cellWidth: 28, halign: 'center' },
        1: {},
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 40, halign: 'center' },
        4: { cellWidth: 65, halign: 'right' },
        5: { cellWidth: 65, halign: 'right', fontStyle: 'bold' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== FINANCIAL SUMMARY =====
  if (y + 80 > pageH - margin) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text('FINANCIAL SUMMARY', left, y + 8);
  y += 12;

  const summaryW = 200;
  const summaryX = right - summaryW;
  const summaryRowH = 16;
  const summaryRows = [
    ['Subtotal', formatCurrency(po.subtotal)],
    [`Tax (${po.tax_rate || 0}%)`, formatCurrency(po.tax_amount)],
    ['Shipping', formatCurrency(po.shipping_cost)],
    ['TOTAL', formatCurrency(po.total)],
  ];

  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.5);

  summaryRows.forEach(([label, value], idx) => {
    const rowY = y + idx * summaryRowH;
    const isTotal = idx === summaryRows.length - 1;

    if (isTotal) {
      doc.setFillColor(240, 240, 240);
      doc.rect(summaryX, rowY, summaryW, summaryRowH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
    } else {
      doc.rect(summaryX, rowY, summaryW, summaryRowH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    doc.setTextColor(0);
    doc.text(label, summaryX + 6, rowY + 11);
    doc.text(value, summaryX + summaryW - 6, rowY + 11, { align: 'right' });
  });

  y += summaryRows.length * summaryRowH + 10;

  // ===== NOTES =====
  if (po.notes) {
    if (y + 50 > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('NOTES', left, y + 8);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    const noteLines = doc.splitTextToSize(po.notes, contentW - 12);
    const notesH = Math.max(30, noteLines.length * 11 + 10);
    doc.setDrawColor(204, 204, 204);
    doc.setLineWidth(0.5);
    doc.rect(left, y, contentW, notesH);
    doc.text(noteLines, left + 6, y + 11);
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
  doc.text(
    `Tweet Garot Mechanical | Field Purchase Order ${fpoDisplayNumber(po)}`,
    left + contentW / 2, y + 6, { align: 'center' }
  );

  const now = new Date();
  const genDate = formatDate(now.toISOString().split('T')[0]);
  const genTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  doc.text(`Generated on ${genDate} at ${genTime}`, left + contentW / 2, y + 14, { align: 'center' });

  return doc.output('blob');
}
