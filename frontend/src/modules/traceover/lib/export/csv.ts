import Papa from 'papaparse';
import type { BOMEntry } from '../../types/bom';
import type { TakeoffItem } from '../../types/takeoff';
import type { TraceoverRun } from '../../types/piping';
import type { CostEstimate } from '../../types/cost';
import { CATEGORY_LABELS } from '../../types/takeoff';
import { MATERIAL_LABELS, SERVICE_TYPE_LABELS } from '../piping/referenceData';
import { migrateServiceType } from '../../types/piping';

/**
 * Exports a Bill of Materials (BOM) to a CSV-formatted string.
 */
export function exportBomToCsv(entries: BOMEntry[]): string {
  const rows = entries.map((entry) => ({
    Category: CATEGORY_LABELS[entry.category] ?? entry.category,
    Type: entry.componentType,
    Description: entry.description,
    Size: entry.size ?? '',
    Material: entry.material ?? '',
    Quantity: entry.quantity,
    Unit: entry.unit,
    'Labor Hrs/Unit': entry.laborHoursPerUnit?.toFixed(1) ?? '',
    'Total Labor Hrs': entry.totalLaborHours?.toFixed(1) ?? '',
    'Labor Hrs Status': entry.laborHoursError ?? (entry.totalLaborHours !== undefined ? 'OK' : ''),
    Pages: entry.pages.join(', '),
  }));

  return Papa.unparse(rows, {
    quotes: true,
    header: true,
  });
}

type BomCsvRow = Record<string, string | number>;

function emptyRow(): BomCsvRow {
  return {
    System: '', Page: '', Category: '', Type: '', Description: '',
    Size: '', Material: '', Quantity: '', Unit: '',
    'Labor Hrs/Unit': '', 'Total Labor Hrs': '',
  };
}

/**
 * Aggregation key for rolling up takeoff items within a system.
 */
function itemGroupKey(item: TakeoffItem): string {
  return [item.componentType, item.size ?? '', item.material ?? ''].join('|');
}

interface AggregatedLine {
  description: string;
  category: string;
  type: string;
  size: string;
  material: string;
  quantity: number;
  unit: string;
  laborHours: number;
}

function aggregateItems(items: TakeoffItem[]): AggregatedLine[] {
  const map = new Map<string, AggregatedLine>();

  for (const item of items) {
    const key = itemGroupKey(item);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.laborHours += item.laborHours ?? 0;
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

/**
 * Exports takeoff items grouped by system to CSV.
 */
export function exportBomBySystemToCsv(
  items: TakeoffItem[],
  runs: TraceoverRun[],
): string {
  const runMap = new Map(runs.map((r) => [r.id, r]));

  function systemKey(run: TraceoverRun): string {
    return `${migrateServiceType(run.config.serviceType)}|${run.config.material}`;
  }

  function systemLabel(run: TraceoverRun): string {
    const migrated = migrateServiceType(run.config.serviceType);
    const service = run.config.label
      || SERVICE_TYPE_LABELS[migrated]
      || migrated;
    const mat = MATERIAL_LABELS[run.config.material] ?? run.config.material;
    return `${service} - ${mat}`;
  }

  const systemGroups = new Map<string, { label: string; pages: Set<number>; items: TakeoffItem[] }>();
  const otherItems: TakeoffItem[] = [];

  for (const item of items) {
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

  const allRows: BomCsvRow[] = [];

  const sortedKeys = Array.from(systemGroups.keys()).sort((a, b) => {
    const ga = systemGroups.get(a)!;
    const gb = systemGroups.get(b)!;
    return ga.label.localeCompare(gb.label);
  });

  const projectTotalQtyByUnit = new Map<string, number>();
  let projectTotalLaborHrs = 0;

  function addToProjectTotals(aggregated: AggregatedLine[]) {
    for (const line of aggregated) {
      projectTotalQtyByUnit.set(
        line.unit,
        (projectTotalQtyByUnit.get(line.unit) ?? 0) + line.quantity,
      );
      projectTotalLaborHrs += line.laborHours;
    }
  }

  for (const key of sortedKeys) {
    const group = systemGroups.get(key)!;
    const pages = Array.from(group.pages).sort((a, b) => a - b);
    const aggregated = aggregateItems(group.items);

    allRows.push({
      ...emptyRow(),
      System: `--- ${group.label} ---`,
      Page: pages.map((p) => `${p}`).join(', '),
    });

    let systemLaborHrs = 0;
    for (const line of aggregated) {
      systemLaborHrs += line.laborHours;
      allRows.push({
        System: group.label,
        Page: pages.join(', '),
        Category: line.category,
        Type: line.type,
        Description: line.description,
        Size: line.size,
        Material: line.material,
        Quantity: Math.round(line.quantity * 100) / 100,
        Unit: line.unit,
        'Labor Hrs/Unit': line.laborHours > 0 && line.quantity > 0
          ? (line.laborHours / line.quantity).toFixed(2) : '',
        'Total Labor Hrs': line.laborHours > 0
          ? line.laborHours.toFixed(1) : '',
      });
    }

    allRows.push({
      ...emptyRow(),
      System: group.label,
      Description: `${group.label} SUBTOTAL`,
      'Total Labor Hrs': systemLaborHrs > 0 ? systemLaborHrs.toFixed(1) : '',
    });

    allRows.push(emptyRow());
    addToProjectTotals(aggregated);
  }

  if (otherItems.length > 0) {
    const aggregated = aggregateItems(otherItems);

    allRows.push({
      ...emptyRow(),
      System: '--- Other Items ---',
    });

    let otherLaborHrs = 0;
    for (const line of aggregated) {
      otherLaborHrs += line.laborHours;
      allRows.push({
        System: 'Other',
        Page: '',
        Category: line.category,
        Type: line.type,
        Description: line.description,
        Size: line.size,
        Material: line.material,
        Quantity: Math.round(line.quantity * 100) / 100,
        Unit: line.unit,
        'Labor Hrs/Unit': line.laborHours > 0 && line.quantity > 0
          ? (line.laborHours / line.quantity).toFixed(2) : '',
        'Total Labor Hrs': line.laborHours > 0
          ? line.laborHours.toFixed(1) : '',
      });
    }

    allRows.push({
      ...emptyRow(),
      Description: 'Other Items SUBTOTAL',
      'Total Labor Hrs': otherLaborHrs > 0 ? otherLaborHrs.toFixed(1) : '',
    });

    allRows.push(emptyRow());
    addToProjectTotals(aggregated);
  }

  // ── Project Grand Total ──
  allRows.push({
    ...emptyRow(),
    System: '=== PROJECT TOTAL ===',
  });

  for (const [unit, qty] of Array.from(projectTotalQtyByUnit.entries()).sort()) {
    allRows.push({
      ...emptyRow(),
      Description: `Total ${unit}`,
      Quantity: Math.round(qty * 100) / 100,
      Unit: unit,
    });
  }

  if (projectTotalLaborHrs > 0) {
    allRows.push({
      ...emptyRow(),
      Description: 'TOTAL LABOR HOURS',
      'Total Labor Hrs': projectTotalLaborHrs.toFixed(1),
    });
  }

  return Papa.unparse(allRows, {
    quotes: true,
    header: true,
  });
}

function formatCurrency(value: number): string {
  return value.toFixed(2);
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * Exports a cost estimate to a CSV-formatted string.
 */
export function exportCostToCsv(estimate: CostEstimate): string {
  type CsvRow = Record<string, string | number>;

  const dataRows: CsvRow[] = estimate.lineItems.map((item) => ({
    Description: item.description,
    Qty: item.quantity,
    Unit: item.unit,
    'Material $/Unit': formatCurrency(item.materialUnitCost),
    'Labor $/Unit': formatCurrency(item.laborUnitCost),
    'Material Total': formatCurrency(item.materialTotal),
    'Labor Total': formatCurrency(item.laborTotal),
    'Line Total': formatCurrency(item.lineTotal),
  }));

  const blankRow: CsvRow = {
    Description: '', Qty: '', Unit: '',
    'Material $/Unit': '', 'Labor $/Unit': '',
    'Material Total': '', 'Labor Total': '', 'Line Total': '',
  };

  const summaryRows: CsvRow[] = [
    blankRow,
    { ...blankRow, Description: 'Material Subtotal', 'Material Total': formatCurrency(estimate.materialSubtotal) },
    { ...blankRow, Description: 'Labor Subtotal', 'Labor Total': formatCurrency(estimate.laborSubtotal) },
    { ...blankRow, Description: 'Subtotal', 'Line Total': formatCurrency(estimate.subtotal) },
    { ...blankRow, Description: `Tax (${formatPercent(estimate.taxRate)})`, 'Line Total': formatCurrency(estimate.taxAmount) },
    { ...blankRow, Description: `Overhead (${formatPercent(estimate.overheadRate)})`, 'Line Total': formatCurrency(estimate.overheadAmount) },
    { ...blankRow, Description: `Profit (${formatPercent(estimate.profitRate)})`, 'Line Total': formatCurrency(estimate.profitAmount) },
    { ...blankRow, Description: 'GRAND TOTAL', 'Line Total': formatCurrency(estimate.grandTotal) },
  ];

  return Papa.unparse([...dataRows, ...summaryRows], {
    quotes: true,
    header: true,
  });
}

/**
 * Triggers a browser download of a CSV string as a file.
 */
export function downloadCsv(csvString: string, fileName: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 150);
}
