import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportColumn {
  header: string;
  key: string;
  align?: 'left' | 'center' | 'right';
  width?: number; // relative weight
}

type RGB = [number, number, number];

interface SummaryRow {
  label: string;
  value: string;
  valueColor?: RGB;
}

interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  summaryRows?: SummaryRow[];
  orientation?: 'portrait' | 'landscape';
  fileName: string;
  /** Base64 data URL of logo image (e.g. "data:image/png;base64,...") */
  logoDataUrl?: string;
  /** Table header background color, defaults to light gray */
  headerFillColor?: RGB;
  /** Table header text color, defaults to dark slate */
  headerTextColor?: RGB;
  /** Accent bar color at top of page */
  accentColor?: RGB;
  /** Per-cell text color callback. Return undefined to use default. */
  cellStyleFn?: (columnKey: string, cellValue: string, rowIndex: number) => { textColor?: RGB } | undefined;
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
    logoDataUrl,
    headerFillColor = [241, 245, 249],
    headerTextColor = [71, 85, 105],
    accentColor,
    cellStyleFn,
  } = options;

  const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Accent bar at very top of page
  if (accentColor) {
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 0, pageWidth, 4, 'F');
  }

  // Logo in top-right corner
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', pageWidth - 170, 12, 130, 36);
    } catch {
      // Silently skip if image can't be added
    }
  }

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
    const itemCount = summaryRows.length;
    // Scale fonts and height when there are many items
    const labelSize = itemCount > 7 ? 6 : 7;
    const valueSize = itemCount > 7 ? 8 : 10;
    const stripHeight = itemCount > 7 ? 30 : 32;
    const stripWidth = pageWidth - 80;
    const cellWidth = stripWidth / itemCount;

    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.roundedRect(40, y, stripWidth, stripHeight, 4, 4, 'F');

    summaryRows.forEach((item, i) => {
      const cx = 40 + cellWidth * i + cellWidth / 2;
      doc.setFontSize(labelSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(item.label.toUpperCase(), cx, y + 11, { align: 'center' });
      doc.setFontSize(valueSize);
      doc.setFont('helvetica', 'bold');
      if (item.valueColor) {
        doc.setTextColor(item.valueColor[0], item.valueColor[1], item.valueColor[2]);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(item.value, cx, y + 23, { align: 'center' });
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

  // Convert relative width weights to actual point widths
  const tableWidth = pageWidth - 80; // left + right margins
  const totalWeight = columns.reduce((sum, col) => sum + (col.width || 1), 0);

  const columnStyles: Record<number, { halign: 'left' | 'center' | 'right'; cellWidth?: number }> = {};
  columns.forEach((col, i) => {
    const style: { halign: 'left' | 'center' | 'right'; cellWidth?: number } = {
      halign: col.align || 'left',
    };
    if (col.width !== undefined) {
      style.cellWidth = (col.width / totalWeight) * tableWidth;
    }
    columnStyles[i] = style;
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
      fillColor: headerFillColor,
      textColor: headerTextColor,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #f8fafc
    },
    columnStyles,
    // Per-cell coloring hook
    didParseCell: cellStyleFn ? (data: any) => {
      if (data.section !== 'body') return;
      const colIndex = data.column.index;
      const colKey = columns[colIndex]?.key;
      if (!colKey) return;
      const cellValue = String(data.cell.raw ?? '');
      const result = cellStyleFn(colKey, cellValue, data.row.index);
      if (result?.textColor) {
        data.cell.styles.textColor = result.textColor;
      }
    } : undefined,
    didDrawPage: (data: any) => {
      // Accent bar on every page
      if (accentColor) {
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, 0, pageWidth, 4, 'F');
      }
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
