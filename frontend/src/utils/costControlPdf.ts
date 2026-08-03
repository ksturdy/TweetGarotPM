import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CostControlMatrix, CostControlVersion, CostType, COST_TYPE_LABELS, calcVersionTotals } from '../services/costControl';

type RGB = [number, number, number];

function sanitize(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/[‐-―]/g, '-')
    .replace(/[''‚′]/g, "'")
    .replace(/[""„″]/g, '"')
    .replace(/…/g, '...')
    .replace(/•/g, '*')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtChg(n: number): string {
  return (n >= 0 ? '+' : '') + fmtMoney(n);
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

// Pastel fills for each version column
const VER_FILLS: RGB[] = [
  [219, 234, 254], // blue-100
  [237, 233, 254], // violet-100
  [209, 250, 229], // emerald-100
  [254, 243, 199], // amber-100
  [252, 231, 243], // pink-100
];

// Darker header fills for version group headers
const VER_HEADER_FILLS: RGB[] = [
  [191, 219, 254], // blue-200
  [221, 214, 254], // violet-200
  [167, 243, 208], // emerald-200
  [253, 230, 138], // amber-200
  [251, 207, 232], // pink-200
];

const VER_TEXT: RGB[] = [
  [30, 64, 175],   // blue-800
  [91, 33, 182],   // violet-800
  [6, 95, 70],     // emerald-800
  [146, 64, 14],   // amber-800
  [157, 23, 77],   // pink-800
];

const DARK: RGB = [15, 23, 42];
const SLATE: RGB = [71, 85, 105];
const MUTED: RGB = [148, 163, 184];
const SECTION_BG: RGB = [226, 232, 240];
const SUBTOTAL_BG: RGB = [241, 245, 249];
const GRAND_BG: RGB = [30, 41, 59];
const WHITE: RGB = [255, 255, 255];
const GREEN: RGB = [22, 163, 74];
const RED: RGB = [220, 38, 38];
const ACCENT: RGB = [37, 99, 235];

type RowType = 'section' | 'item' | 'subtotal' | 'grand' | 'fee' | 'grand_total';

interface TableRow {
  _type: RowType;
  cells: string[];
  _nc?: number | null;
  _ncp?: number | null;
}

export function exportCCMComparePdf(
  matrix: CostControlMatrix,
  selectedVersions: CostControlVersion[]
): void {
  if (selectedVersions.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const hasMultiple = selectedVersions.length >= 2;

  // ── Accent bar ──────────────────────────────────────────────────────
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageW, 4, 'F');

  // ── Title ────────────────────────────────────────────────────────────
  let y = 34;
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Cost Control Matrix — Version Comparison', 40, y);

  y += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE);
  doc.text(sanitize(matrix.name), 40, y);

  y += 11;
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const verNames = selectedVersions.map(v => sanitize(v.version_name)).join('  →  ');
  doc.text(`Versions: ${verNames}`, 40, y);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    pageW - 40, y, { align: 'right' }
  );

  y += 14;

  // ── Build table rows ─────────────────────────────────────────────────
  const bodyRows: TableRow[] = [];

  const getVal = (itemValues: Record<number, any>, vId: number): number =>
    Number(itemValues[vId]?.value ?? 0);

  for (const area of matrix.areas) {
    if (area.items.length === 0) continue;

    bodyRows.push({
      _type: 'section',
      cells: Array(3 + selectedVersions.length + (hasMultiple ? 2 : 0)).fill(''),
    });
    // We'll treat the first cell as the section name via didParseCell colSpan trick below

    for (const item of area.items) {
      const vals = selectedVersions.map(v => getVal(item.values, v.id));
      const nc = hasMultiple ? vals[vals.length - 1] - vals[0] : null;
      const ncp = hasMultiple && vals[0] !== 0 ? (nc! / vals[0]) * 100 : null;

      const row: TableRow = {
        _type: 'item',
        _nc: nc,
        _ncp: ncp,
        cells: [
          '',
          sanitize(item.description) || '—',
          sanitize(COST_TYPE_LABELS[item.cost_type as CostType]),
          ...vals.map(v => v ? fmtMoney(v) : '—'),
        ],
      };
      if (hasMultiple) {
        row.cells.push(nc != null ? fmtChg(nc) : '—');
        row.cells.push(ncp != null ? fmtPct(ncp) : '—');
      }
      bodyRows.push(row);
    }

    // Section subtotal
    const areaTotals = selectedVersions.map(v =>
      area.items.reduce((s, i) => s + getVal(i.values, v.id), 0)
    );
    const aNC = hasMultiple ? areaTotals[areaTotals.length - 1] - areaTotals[0] : null;
    const aNCP = hasMultiple && areaTotals[0] !== 0 ? (aNC! / areaTotals[0]) * 100 : null;

    const subRow: TableRow = {
      _type: 'subtotal',
      _nc: aNC,
      _ncp: aNCP,
      cells: ['', 'Section Total', '', ...areaTotals.map(t => t ? fmtMoney(t) : '—')],
    };
    if (hasMultiple) {
      subRow.cells.push(aNC != null ? fmtChg(aNC) : '—');
      subRow.cells.push(aNCP != null ? fmtPct(aNCP) : '—');
    }
    bodyRows.push(subRow);
  }

  // Summary rows
  const sums = selectedVersions.map(v => calcVersionTotals(matrix, v.id));

  const addSum = (label: string, getFn: (s: ReturnType<typeof calcVersionTotals>) => number, type: RowType) => {
    const vals = sums.map(getFn);
    const nc = hasMultiple ? vals[vals.length - 1] - vals[0] : null;
    const ncp = hasMultiple && vals[0] !== 0 ? (nc! / vals[0]) * 100 : null;
    const row: TableRow = {
      _type: type,
      _nc: nc,
      _ncp: ncp,
      cells: ['', label, '', ...vals.map(fmtMoney)],
    };
    if (hasMultiple) {
      row.cells.push(nc != null ? fmtChg(nc) : '—');
      row.cells.push(ncp != null ? fmtPct(ncp) : '—');
    }
    bodyRows.push(row);
  };

  addSum('Subtotal', s => s.subtotal, 'grand');
  addSum(`Fee (${Math.round(Number(matrix.fee_pct) * 100)}%)`, s => s.fee, 'fee');
  addSum(`Overhead (${Math.round(Number(matrix.overhead_pct) * 100)}%)`, s => s.overhead, 'fee');
  addSum('Grand Total', s => s.grand_total, 'grand_total');

  // ── Column widths ─────────────────────────────────────────────────────
  const marginL = 36;
  const marginR = 36;
  const usableW = pageW - marginL - marginR;
  const fixedW = 50 + 150 + 80; // section | description | type
  const changeW = hasMultiple ? 130 : 0; // 65 each for $ and %
  const verTotalW = usableW - fixedW - changeW;
  const verColW = Math.max(60, verTotalW / selectedVersions.length);

  const colStyles: Record<number, any> = {
    0: { cellWidth: 50 },
    1: { cellWidth: 150 },
    2: { cellWidth: 80 },
  };
  selectedVersions.forEach((_, i) => {
    colStyles[3 + i] = { cellWidth: verColW, halign: 'right' };
  });
  if (hasMultiple) {
    colStyles[3 + selectedVersions.length]     = { cellWidth: 65, halign: 'right' };
    colStyles[3 + selectedVersions.length + 1] = { cellWidth: 65, halign: 'right' };
  }

  // ── Header rows ────────────────────────────────────────────────────────
  const headerRow1 = [
    { content: 'Section',     rowSpan: 2, styles: { halign: 'left', fillColor: SUBTOTAL_BG, textColor: DARK, fontStyle: 'bold' } },
    { content: 'Description', rowSpan: 2, styles: { halign: 'left', fillColor: SUBTOTAL_BG, textColor: DARK, fontStyle: 'bold' } },
    { content: 'Type',        rowSpan: 2, styles: { halign: 'left', fillColor: SUBTOTAL_BG, textColor: DARK, fontStyle: 'bold' } },
    ...selectedVersions.map((v, i) => ({
      content: sanitize(v.version_name) + (v.version_date ? `\n${new Date(v.version_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''),
      styles: { halign: 'center', fillColor: VER_HEADER_FILLS[i % 5], textColor: VER_TEXT[i % 5], fontStyle: 'bold' },
    })),
    ...(hasMultiple ? [
      { content: 'Net Change $', rowSpan: 2, styles: { halign: 'right', fillColor: SECTION_BG, textColor: DARK, fontStyle: 'bold' } },
      { content: 'Net Change %', rowSpan: 2, styles: { halign: 'right', fillColor: SECTION_BG, textColor: DARK, fontStyle: 'bold' } },
    ] : []),
  ];

  // ── Section name tracking (for the span row) ──────────────────────────
  // We stored empty cells for section rows; we'll override content in didParseCell
  const sectionNames: string[] = [];
  for (const area of matrix.areas) {
    if (area.items.length > 0) sectionNames.push(sanitize(area.name));
  }
  let sectionIdx = 0;

  autoTable(doc, {
    startY: y,
    head: [headerRow1 as any],
    body: bodyRows.map(r => r.cells),
    columnStyles: colStyles,
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, right: 5, bottom: 3, left: 5 },
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
      overflow: 'ellipsize',
      textColor: DARK,
    },
    headStyles: { fontSize: 8, fontStyle: 'bold', minCellHeight: 20 },
    margin: { left: marginL, right: marginR, top: 40, bottom: 30 },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = bodyRows[data.row.index];
      if (!row) return;

      switch (row._type) {
        case 'section': {
          // Make first cell span all columns and show the section name
          if (data.column.index === 0) {
            data.cell.colSpan = Object.keys(data.row.cells).length;
            data.cell.text = [sectionNames[sectionIdx] ?? ''];
            if (data.column.index === 0) sectionIdx++;
          }
          data.cell.styles.fillColor = SECTION_BG;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = DARK;
          data.cell.styles.fontSize = 8.5;
          break;
        }
        case 'subtotal': {
          data.cell.styles.fillColor = SUBTOTAL_BG;
          data.cell.styles.fontStyle = 'bold';
          // Color net-change cells
          if (hasMultiple && data.column.index >= 3 + selectedVersions.length) {
            applyChangeColor(data.cell, row._nc ?? null);
          }
          // Color version cells
          if (data.column.index >= 3 && data.column.index < 3 + selectedVersions.length) {
            data.cell.styles.fillColor = VER_FILLS[(data.column.index - 3) % 5];
          }
          break;
        }
        case 'item': {
          // Version cells
          if (data.column.index >= 3 && data.column.index < 3 + selectedVersions.length) {
            data.cell.styles.fillColor = VER_FILLS[(data.column.index - 3) % 5];
          }
          // Net change cells
          if (hasMultiple && data.column.index >= 3 + selectedVersions.length) {
            applyChangeColor(data.cell, row._nc ?? null);
          }
          break;
        }
        case 'fee': {
          data.cell.styles.fillColor = SUBTOTAL_BG;
          data.cell.styles.textColor = SLATE;
          break;
        }
        case 'grand': {
          data.cell.styles.fillColor = [232, 236, 241];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9;
          if (hasMultiple && data.column.index >= 3 + selectedVersions.length) {
            applyChangeColor(data.cell, row._nc ?? null);
          }
          break;
        }
        case 'grand_total': {
          data.cell.styles.fillColor = GRAND_BG;
          data.cell.styles.textColor = WHITE;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
          if (hasMultiple && data.column.index >= 3 + selectedVersions.length) {
            applyChangeColorOnDark(data.cell, row._nc ?? null);
          }
          break;
        }
      }
    },
    didDrawPage: (data) => {
      // Footer
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(sanitize(matrix.name), marginL, pageH - 18);
      doc.text(`Page ${data.pageNumber}`, pageW - marginR, pageH - 18, { align: 'right' });
      // Re-draw accent bar on continuation pages
      if (data.pageNumber > 1) {
        doc.setFillColor(...ACCENT);
        doc.rect(0, 0, pageW, 4, 'F');
      }
    },
  });

  const safeName = matrix.name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();
  doc.save(`${safeName}_version_comparison.pdf`);
}

function applyChangeColor(cell: any, nc: number | null) {
  if (nc == null) return;
  if (nc > 0) cell.styles.textColor = RED;
  else if (nc < 0) cell.styles.textColor = GREEN;
}

function applyChangeColorOnDark(cell: any, nc: number | null) {
  if (nc == null) return;
  // Lighter tints on dark background
  if (nc > 0)      cell.styles.textColor = [252, 165, 165]; // red-300
  else if (nc < 0) cell.styles.textColor = [110, 231, 183]; // emerald-300
}
