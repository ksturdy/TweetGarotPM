import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportColumn {
  header: string;
  key: string;
  align?: 'left' | 'center' | 'right';
  width?: number; // relative weight
}

interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  summaryRows?: { label: string; value: string }[];
  orientation?: 'portrait' | 'landscape';
  fileName: string;
}

export function exportListToPdf(options: ExportOptions): void {
  const {
    title,
    subtitle,
    columns,
    rows,
    summaryRows,
    orientation = 'landscape',
    fileName,
  } = options;

  const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  let y = 40;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text(title, 40, y);

  if (subtitle) {
    y += 18;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // #64748b
    doc.text(subtitle, 40, y);
  }

  // Summary strip
  if (summaryRows && summaryRows.length > 0) {
    y += 20;
    const stripHeight = 32;
    const stripWidth = pageWidth - 80;
    const cellWidth = stripWidth / summaryRows.length;

    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.roundedRect(40, y, stripWidth, stripHeight, 4, 4, 'F');

    summaryRows.forEach((item, i) => {
      const cx = 40 + cellWidth * i + cellWidth / 2;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(item.label.toUpperCase(), cx, y + 12, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(item.value, cx, y + 25, { align: 'center' });
    });
    y += stripHeight + 10;
  } else {
    y += 16;
  }

  // Table
  const tableHeaders = columns.map(c => c.header);
  const tableBody = rows.map(row =>
    columns.map(c => String(row[c.key] ?? '-'))
  );

  const columnStyles: Record<number, { halign: 'left' | 'center' | 'right'; cellWidth?: number }> = {};
  columns.forEach((col, i) => {
    columnStyles[i] = {
      halign: col.align || 'left',
    };
  });

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableBody,
    margin: { left: 40, right: 40 },
    styles: {
      fontSize: 8,
      cellPadding: 5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [241, 245, 249], // #f1f5f9
      textColor: [71, 85, 105], // #475569
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #f8fafc
    },
    columnStyles,
    didDrawPage: (data: any) => {
      // Footer with page numbers
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      const footerY = doc.internal.pageSize.getHeight() - 20;
      doc.text(
        `Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        40,
        footerY
      );
      doc.text(`Page ${pageNum} of ${pageCount}`, pageWidth - 40, footerY, { align: 'right' });
    },
  });

  doc.save(fileName);
}
