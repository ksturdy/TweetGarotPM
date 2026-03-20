import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TakeoffItem } from '../../types/takeoff';
import type { TraceoverRun } from '../../types/piping';
import type { ProjectMetadata } from './types';
import { CATEGORY_LABELS } from '../../types/takeoff';
import { MATERIAL_LABELS, SERVICE_TYPE_LABELS } from '../piping/referenceData';
import { migrateServiceType } from '../../types/piping';
import { enrichItemsWithCurrentCosts } from './costEnrichment';

// ── Color Constants (print-friendly light theme) ──

type RGB = [number, number, number];

const C = {
  brandDark: [15, 27, 45] as RGB,
  brandAccent: [59, 130, 246] as RGB,
  sectionHdr: [30, 58, 95] as RGB,
  tableHdr: [232, 238, 245] as RGB,
  altRow: [244, 247, 251] as RGB,
  subtotalBg: [220, 232, 245] as RGB,
  grandTotalBg: [197, 217, 240] as RGB,
  body: [26, 26, 46] as RGB,
  muted: [107, 114, 128] as RGB,
  white: [255, 255, 255] as RGB,
  border: [209, 213, 219] as RGB,
  infoBg: [248, 250, 253] as RGB,
};

const MARGIN = { top: 12, right: 12, bottom: 14, left: 12 };
const HEADER_HEIGHT = 18;

interface AggregatedLine {
  description: string;
  category: string;
  type: string;
  size: string;
  material: string;
  quantity: number;
  unit: string;
  laborHours: number;
  materialCost: number;
}

function itemGroupKey(item: TakeoffItem): string {
  return [item.componentType, item.size ?? '', item.material ?? '', item.fittingType ?? '', item.reducingSize ?? ''].join('|');
}

function aggregateItems(items: TakeoffItem[]): AggregatedLine[] {
  const map = new Map<string, AggregatedLine>();

  for (const item of items) {
    const key = itemGroupKey(item);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.laborHours += item.laborHours ?? 0;
      existing.materialCost += item.materialCostTotal ?? 0;
    } else {
      map.set(key, {
        description: item.label,
        category: CATEGORY_LABELS[item.category] ?? item.category,
        type: item.componentType,
        size: item.size ?? '',
        material: item.material ?? '',
        quantity: item.quantity,
        unit: item.unit,
        laborHours: item.laborHours ?? 0,
        materialCost: item.materialCostTotal ?? 0,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aIsPipe = a.type === 'pipe_segment' ? 0 : 1;
    const bIsPipe = b.type === 'pipe_segment' ? 0 : 1;
    if (aIsPipe !== bIsPipe) return aIsPipe - bIsPipe;
    if (a.size !== b.size) return a.size.localeCompare(b.size);
    return a.type.localeCompare(b.type);
  });
}

function fmtQty(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function fmtHrs(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function fmtDollar(n: number): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

async function loadImageData(src: string): Promise<LoadedImage | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  } catch {
    return null;
  }
}

const SHIELD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72" viewBox="0 0 32 36">
  <path d="M16 2L2 8V16C2 24.8 8.2 32.8 16 35V2Z" fill="#3B7DD8"/>
  <path d="M16 2L30 8V16C30 24.8 23.8 32.8 16 35V2Z" fill="#7CB8F2"/>
</svg>`;

async function loadShieldImage(): Promise<LoadedImage | null> {
  const blob = new Blob([SHIELD_SVG], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const result = await loadImageData(url);
  URL.revokeObjectURL(url);
  return result;
}

function drawHeader(
  doc: jsPDF,
  shieldImage: LoadedImage | null,
  tenantLogo?: LoadedImage | null,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const y = MARGIN.top;

  // Shield logo (rendered from the same SVG as favicon / main app header)
  const shieldH = 10;
  const shieldW = shieldH * (32 / 36); // preserve 32:36 aspect ratio
  if (shieldImage) {
    doc.addImage(shieldImage.dataUrl, 'PNG', MARGIN.left, y, shieldW, shieldH);
  }

  // Brand text — match main app: "TITAN" in blue with wide letter spacing
  const textX = MARGIN.left + shieldW + 3;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 178, 215); // #64b2d7 — midpoint of main app gradient
  doc.setCharSpace(2.5); // wide letter spacing like the main app
  doc.text('TITAN', textX, y + 5);
  const titanW = doc.getTextWidth('TITAN');
  doc.setCharSpace(0);

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.muted);
  doc.text('Mechanical Piping Takeoff Report', textX, y + 9);

  // Tenant logo (upper right)
  if (tenantLogo) {
    const logoH = 10;
    const aspect = tenantLogo.width / tenantLogo.height;
    const logoW = logoH * aspect;
    const logoX = pageW - MARGIN.right - logoW;
    doc.addImage(tenantLogo.dataUrl, 'PNG', logoX, y, logoW, logoH);
  }

  const lineY = y + HEADER_HEIGHT - 6;
  doc.setDrawColor(...C.brandAccent);
  doc.setLineWidth(0.6);
  doc.line(MARGIN.left, lineY, pageW - MARGIN.right, lineY);

  return lineY + 3;
}

function drawProjectInfo(
  doc: jsPDF,
  metadata: ProjectMetadata | null,
  startY: number,
): number {
  if (!metadata) return startY;

  const pageW = doc.internal.pageSize.getWidth();
  const boxW = pageW - MARGIN.left - MARGIN.right;
  const boxX = MARGIN.left;
  const boxY = startY;
  const padding = 4;
  const lineHeight = 4.5;

  const leftCol: [string, string][] = [];
  const rightCol: [string, string][] = [];

  if (metadata.projectName) leftCol.push(['Project:', metadata.projectName]);
  if (metadata.projectNumber) leftCol.push(['Takeoff #:', metadata.projectNumber]);
  if (metadata.date) leftCol.push(['Date:', metadata.date]);
  if (metadata.estimatorName) rightCol.push(['Estimator:', metadata.estimatorName]);

  rightCol.push(['Generated:', new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })]);

  const maxLines = Math.max(leftCol.length, rightCol.length);
  const boxH = padding * 2 + maxLines * lineHeight;

  doc.setFillColor(...C.infoBg);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, 'FD');

  const midX = boxX + boxW * 0.55;

  for (let i = 0; i < leftCol.length; i++) {
    const ty = boxY + padding + lineHeight * i + 3;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(leftCol[i][0], boxX + padding, ty);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.body);
    doc.text(leftCol[i][1], boxX + padding + 18, ty);
  }

  for (let i = 0; i < rightCol.length; i++) {
    const ty = boxY + padding + lineHeight * i + 3;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(rightCol[i][0], midX + padding, ty);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.body);
    doc.text(rightCol[i][1], midX + padding + 18, ty);
  }

  return boxY + boxH + 4;
}

function drawSystemHeader(
  doc: jsPDF,
  label: string,
  pages: number[],
  startY: number,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const barW = pageW - MARGIN.left - MARGIN.right;
  const barH = 6;

  doc.setFillColor(...C.sectionHdr);
  doc.roundedRect(MARGIN.left, startY, barW, barH, 1, 1, 'F');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  doc.text(label.toUpperCase(), MARGIN.left + 3, startY + 4.2);

  if (pages.length > 0) {
    const pagesStr = `Pages: ${pages.join(', ')}`;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(pagesStr, pageW - MARGIN.right - 3, startY + 4.2, { align: 'right' });
  }

  return startY + barH + 1;
}

function drawSystemTable(
  doc: jsPDF,
  aggregated: AggregatedLine[],
  systemLabel: string,
  systemLaborHrs: number,
  systemMaterialCost: number,
  startY: number,
): number {
  const hasCost = aggregated.some((line) => line.materialCost > 0);

  const body = aggregated.map((line) => {
    const row: string[] = [
      line.description, line.size, line.material,
      fmtQty(line.quantity), line.unit,
    ];
    if (hasCost) {
      row.push(
        line.materialCost > 0 && line.quantity > 0
          ? fmtDollar(line.materialCost / line.quantity) : '',
        line.materialCost > 0 ? fmtDollar(line.materialCost) : '',
      );
    }
    row.push(
      line.laborHours > 0 && line.quantity > 0
        ? (line.laborHours / line.quantity).toFixed(2) : '',
      line.laborHours > 0 ? fmtHrs(line.laborHours) : '',
    );
    return row;
  });

  const headers = ['Description', 'Size', 'Material', 'Qty', 'Unit'];
  if (hasCost) headers.push('$/Unit', 'Total $');
  headers.push('Hrs/Unit', 'Total Hrs');

  const footCells: any[] = [];
  const labelColSpan = hasCost ? 6 : 5;
  footCells.push({
    content: `${systemLabel} SUBTOTAL`,
    colSpan: labelColSpan,
    styles: {
      halign: 'right' as const,
      fontStyle: 'bold' as const,
      fillColor: C.subtotalBg,
    },
  });
  if (hasCost) {
    footCells.push({
      content: systemMaterialCost > 0 ? fmtDollar(systemMaterialCost) : '',
      styles: {
        halign: 'right' as const,
        fontStyle: 'bold' as const,
        fillColor: C.subtotalBg,
      },
    });
  }
  footCells.push({
    content: '', // Hrs/Unit column — no subtotal
    styles: {
      fillColor: C.subtotalBg,
    },
  });
  footCells.push({
    content: systemLaborHrs > 0 ? fmtHrs(systemLaborHrs) : '',
    styles: {
      halign: 'right' as const,
      fontStyle: 'bold' as const,
      fillColor: C.subtotalBg,
    },
  });

  const colStyles: Record<number, any> = hasCost
    ? {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 14 },
        2: { cellWidth: 26 },
        3: { cellWidth: 14, halign: 'right' as const },
        4: { cellWidth: 10 },
        5: { cellWidth: 18, halign: 'right' as const },
        6: { cellWidth: 20, halign: 'right' as const },
        7: { cellWidth: 16, halign: 'right' as const },
        8: { cellWidth: 18, halign: 'right' as const },
      }
    : {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 18 },
        2: { cellWidth: 32 },
        3: { cellWidth: 18, halign: 'right' as const },
        4: { cellWidth: 14 },
        5: { cellWidth: 20, halign: 'right' as const },
        6: { cellWidth: 22, halign: 'right' as const },
      };

  autoTable(doc, {
    startY,
    head: [headers],
    body,
    foot: [footCells],
    theme: 'grid',
    styles: {
      fontSize: hasCost ? 6.5 : 7, cellPadding: 1.5,
      lineColor: C.border, lineWidth: 0.15,
    },
    headStyles: {
      fillColor: C.tableHdr,
      textColor: C.sectionHdr,
      fontStyle: 'bold', fontSize: 6, cellPadding: 1.5,
    },
    bodyStyles: { textColor: C.body },
    footStyles: {
      fillColor: C.subtotalBg,
      textColor: C.body,
      fontStyle: 'bold', fontSize: hasCost ? 6.5 : 7,
    },
    alternateRowStyles: { fillColor: C.altRow },
    columnStyles: colStyles,
    margin: { left: MARGIN.left, right: MARGIN.right },
    showHead: 'everyPage',
  });

  return (doc as any).lastAutoTable.finalY as number;
}

function drawGrandTotal(
  doc: jsPDF,
  totalsByUnit: Map<string, number>,
  totalLaborHrs: number,
  totalMaterialCost: number,
  startY: number,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const boxW = pageW - MARGIN.left - MARGIN.right;

  const unitEntries = Array.from(totalsByUnit.entries()).sort();
  const hasCost = totalMaterialCost > 0;
  const summaryLines = (hasCost ? 1 : 0) + (totalLaborHrs > 0 ? 1 : 0);
  const lines = unitEntries.length + (summaryLines > 0 ? summaryLines + 1 : 0); // +1 for divider
  const boxH = 9 + lines * 5.5 + 4;

  if (startY + boxH > pageH - MARGIN.bottom) {
    doc.addPage();
    startY = MARGIN.top + HEADER_HEIGHT + 2;
  }

  doc.setFillColor(...C.sectionHdr);
  doc.roundedRect(MARGIN.left, startY, boxW, 6, 1, 1, 'F');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  doc.text('PROJECT SUMMARY', MARGIN.left + 3, startY + 4.2);

  const contentY = startY + 7.5;
  doc.setFillColor(...C.grandTotalBg);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  const contentH = boxH - 8;
  doc.roundedRect(MARGIN.left, contentY, boxW, contentH, 1, 1, 'FD');

  let y = contentY + 4.5;
  const valueX = MARGIN.left + boxW * 0.35;

  doc.setFontSize(8);
  for (const [unit, qty] of unitEntries) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.body);
    doc.text(`Total ${unit}:`, MARGIN.left + 6, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${fmtQty(qty)} ${unit}`, valueX, y);
    y += 5.5;
  }

  if (hasCost || totalLaborHrs > 0) {
    y += 0.5;
    doc.setDrawColor(...C.sectionHdr);
    doc.setLineWidth(0.3);
    doc.line(MARGIN.left + 4, y, MARGIN.left + boxW - 4, y);
    y += 4;

    if (hasCost) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.sectionHdr);
      doc.text('TOTAL MATERIAL COST:', MARGIN.left + 6, y);
      doc.text(fmtDollar(totalMaterialCost), valueX, y);
      y += 5.5;
    }

    if (totalLaborHrs > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.sectionHdr);
      doc.text('TOTAL LABOR HOURS:', MARGIN.left + 6, y);
      doc.text(fmtHrs(totalLaborHrs), valueX, y);
    }
  }

  return startY + boxH + 3;
}

function drawFooters(doc: jsPDF, projectName?: string): void {
  const totalPages = (doc as any).internal.getNumberOfPages() as number;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - MARGIN.bottom + 6;
  const dateStr = new Date().toLocaleDateString('en-US');

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(MARGIN.left, footerY - 3, pageW - MARGIN.right, footerY - 3);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(projectName || 'Titan Takeoff', MARGIN.left, footerY);
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, footerY, { align: 'center' });
    doc.text(dateStr, pageW - MARGIN.right, footerY, { align: 'right' });
  }
}

export async function exportBomToPdf(
  items: TakeoffItem[],
  runs: TraceoverRun[],
  metadata: ProjectMetadata | null,
): Promise<void> {
  // Re-lookup costs from current PipeSpec data so exports reflect the latest
  // EST catalog imports, even if items were generated before costs were imported.
  const enrichedItems = enrichItemsWithCurrentCosts(items, runs);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const pageH = doc.internal.pageSize.getHeight();
  const runMap = new Map(runs.map((r) => [r.id, r]));

  function systemKey(run: TraceoverRun): string {
    return `${migrateServiceType(run.config.serviceType)}|${run.config.material}`;
  }

  function systemLabel(run: TraceoverRun): string {
    const migrated = migrateServiceType(run.config.serviceType);
    const service = run.config.label || SERVICE_TYPE_LABELS[migrated] || migrated;
    const mat = MATERIAL_LABELS[run.config.material] ?? run.config.material;
    return `${service} - ${mat}`;
  }

  const systemGroups = new Map<string, { label: string; pages: Set<number>; items: TakeoffItem[] }>();
  const otherItems: TakeoffItem[] = [];

  for (const item of enrichedItems) {
    const run = item.traceoverRunId ? runMap.get(item.traceoverRunId) : undefined;
    if (run) {
      const key = systemKey(run);
      const group = systemGroups.get(key);
      if (group) {
        group.items.push(item);
        group.pages.add(run.pageNumber);
      } else {
        systemGroups.set(key, {
          label: systemLabel(run),
          pages: new Set([run.pageNumber]),
          items: [item],
        });
      }
    } else {
      otherItems.push(item);
    }
  }

  const sortedKeys = Array.from(systemGroups.keys()).sort((a, b) => {
    const ga = systemGroups.get(a)!;
    const gb = systemGroups.get(b)!;
    return ga.label.localeCompare(gb.label);
  });

  const projectTotalQtyByUnit = new Map<string, number>();
  let projectTotalLaborHrs = 0;
  let projectTotalMaterialCost = 0;

  function addToProjectTotals(aggregated: AggregatedLine[]) {
    for (const line of aggregated) {
      projectTotalQtyByUnit.set(
        line.unit,
        (projectTotalQtyByUnit.get(line.unit) ?? 0) + line.quantity,
      );
      projectTotalLaborHrs += line.laborHours;
      projectTotalMaterialCost += line.materialCost;
    }
  }

  // Load shield and tenant logo for header
  const shieldImage = await loadShieldImage();
  let tenantLogo: LoadedImage | null = null;
  if (metadata?.tenantLogoUrl) {
    tenantLogo = await loadImageData(metadata.tenantLogoUrl);
  }

  let currentY = drawHeader(doc, shieldImage, tenantLogo);
  currentY = drawProjectInfo(doc, metadata, currentY);

  for (const key of sortedKeys) {
    const group = systemGroups.get(key)!;
    const pages = Array.from(group.pages).sort((a, b) => a - b);
    const aggregated = aggregateItems(group.items);

    let systemLaborHrs = 0;
    let systemMaterialCost = 0;
    for (const line of aggregated) {
      systemLaborHrs += line.laborHours;
      systemMaterialCost += line.materialCost;
    }

    if (currentY + 40 > pageH - MARGIN.bottom) {
      doc.addPage();
      currentY = drawHeader(doc, shieldImage, tenantLogo);
    }

    currentY = drawSystemHeader(doc, group.label, pages, currentY);
    currentY = drawSystemTable(doc, aggregated, group.label, systemLaborHrs, systemMaterialCost, currentY);
    currentY += 4;
    addToProjectTotals(aggregated);
  }

  if (otherItems.length > 0) {
    const aggregated = aggregateItems(otherItems);
    let otherLaborHrs = 0;
    let otherMaterialCost = 0;
    for (const line of aggregated) {
      otherLaborHrs += line.laborHours;
      otherMaterialCost += line.materialCost;
    }

    if (currentY + 40 > pageH - MARGIN.bottom) {
      doc.addPage();
      currentY = drawHeader(doc, shieldImage, tenantLogo);
    }

    currentY = drawSystemHeader(doc, 'Other Items', [], currentY);
    currentY = drawSystemTable(doc, aggregated, 'Other Items', otherLaborHrs, otherMaterialCost, currentY);
    currentY += 4;
    addToProjectTotals(aggregated);
  }

  drawGrandTotal(doc, projectTotalQtyByUnit, projectTotalLaborHrs, projectTotalMaterialCost, currentY);

  const projectName = metadata?.projectName || 'Untitled Project';
  drawFooters(doc, projectName);
  const fileName = `${projectName.replace(/[^a-zA-Z0-9_\- ]/g, '')}-takeoff-report.pdf`;
  doc.save(fileName);
}
