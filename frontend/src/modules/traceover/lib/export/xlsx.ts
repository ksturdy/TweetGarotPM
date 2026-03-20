import * as XLSX from 'xlsx';
import type { TakeoffItem } from '../../types/takeoff';
import type { TraceoverRun } from '../../types/piping';
import type { ProjectMetadata } from './types';
import { CATEGORY_LABELS } from '../../types/takeoff';
import { MATERIAL_LABELS, SERVICE_TYPE_LABELS } from '../piping/referenceData';
import { migrateServiceType } from '../../types/piping';
import { enrichItemsWithCurrentCosts } from './costEnrichment';

const COLUMNS = [
  'System', 'Page', 'Category', 'Type', 'Description',
  'Size', 'Material', 'Quantity', 'Unit',
  '$/Unit', 'Total $',
  'Labor Hrs/Unit', 'Total Labor Hrs',
] as const;

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

export function exportBomToXlsx(
  items: TakeoffItem[],
  runs: TraceoverRun[],
  metadata: ProjectMetadata | null,
): void {
  // Re-lookup costs from current PipeSpec data so exports reflect the latest
  // EST catalog imports, even if items were generated before costs were imported.
  const enrichedItems = enrichItemsWithCurrentCosts(items, runs);
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

  const data: (string | number)[][] = [];
  const boldRows = new Set<number>();

  const projectName = metadata?.projectName || 'Untitled Project';
  data.push([projectName]);
  boldRows.add(0);

  if (metadata?.projectNumber) data.push([`Project #: ${metadata.projectNumber}`]);
  if (metadata?.date) data.push([`Date: ${metadata.date}`]);
  if (metadata?.estimatorName) data.push([`Estimator: ${metadata.estimatorName}`]);
  data.push([`Generated: ${new Date().toLocaleDateString()}`]);
  data.push([]);

  const headerRowIdx = data.length;
  data.push([...COLUMNS]);
  boldRows.add(headerRowIdx);

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

  for (const key of sortedKeys) {
    const group = systemGroups.get(key)!;
    const pages = Array.from(group.pages).sort((a, b) => a - b);
    const pagesStr = pages.join(', ');
    const aggregated = aggregateItems(group.items);

    const sysHeaderIdx = data.length;
    data.push([group.label, `Page ${pagesStr}`, '', '', '', '', '', '', '', '', '', '', '']);
    boldRows.add(sysHeaderIdx);

    let systemLaborHrs = 0;
    let systemMaterialCost = 0;
    for (const line of aggregated) {
      systemLaborHrs += line.laborHours;
      systemMaterialCost += line.materialCost;
      data.push([
        group.label, pagesStr, line.category, line.type, line.description,
        line.size, line.material,
        Math.round(line.quantity * 100) / 100, line.unit,
        line.materialCost > 0 && line.quantity > 0
          ? Math.round((line.materialCost / line.quantity) * 100) / 100 : '',
        line.materialCost > 0 ? Math.round(line.materialCost * 100) / 100 : '',
        line.laborHours > 0 && line.quantity > 0
          ? Math.round((line.laborHours / line.quantity) * 100) / 100 : '',
        line.laborHours > 0 ? Math.round(line.laborHours * 10) / 10 : '',
      ]);
    }

    const subtotalIdx = data.length;
    data.push([
      group.label, '', '', '', `${group.label} SUBTOTAL`,
      '', '', '', '', '',
      systemMaterialCost > 0 ? Math.round(systemMaterialCost * 100) / 100 : '',
      '',
      systemLaborHrs > 0 ? Math.round(systemLaborHrs * 10) / 10 : '',
    ]);
    boldRows.add(subtotalIdx);
    data.push([]);
    addToProjectTotals(aggregated);
  }

  if (otherItems.length > 0) {
    const aggregated = aggregateItems(otherItems);
    const otherHeaderIdx = data.length;
    data.push(['Other Items', '', '', '', '', '', '', '', '', '', '', '', '']);
    boldRows.add(otherHeaderIdx);

    let otherLaborHrs = 0;
    let otherMaterialCost = 0;
    for (const line of aggregated) {
      otherLaborHrs += line.laborHours;
      otherMaterialCost += line.materialCost;
      data.push([
        'Other', '', line.category, line.type, line.description,
        line.size, line.material,
        Math.round(line.quantity * 100) / 100, line.unit,
        line.materialCost > 0 && line.quantity > 0
          ? Math.round((line.materialCost / line.quantity) * 100) / 100 : '',
        line.materialCost > 0 ? Math.round(line.materialCost * 100) / 100 : '',
        line.laborHours > 0 && line.quantity > 0
          ? Math.round((line.laborHours / line.quantity) * 100) / 100 : '',
        line.laborHours > 0 ? Math.round(line.laborHours * 10) / 10 : '',
      ]);
    }

    const otherSubIdx = data.length;
    data.push([
      '', '', '', '', 'Other Items SUBTOTAL',
      '', '', '', '', '',
      otherMaterialCost > 0 ? Math.round(otherMaterialCost * 100) / 100 : '',
      '',
      otherLaborHrs > 0 ? Math.round(otherLaborHrs * 10) / 10 : '',
    ]);
    boldRows.add(otherSubIdx);
    data.push([]);
    addToProjectTotals(aggregated);
  }

  const totalHeaderIdx = data.length;
  data.push(['PROJECT TOTAL', '', '', '', '', '', '', '', '', '', '', '', '']);
  boldRows.add(totalHeaderIdx);

  for (const [unit, qty] of Array.from(projectTotalQtyByUnit.entries()).sort()) {
    const totalLineIdx = data.length;
    data.push(['', '', '', '', `Total ${unit}`, '', '', Math.round(qty * 100) / 100, unit, '', '', '', '']);
    boldRows.add(totalLineIdx);
  }

  if (projectTotalMaterialCost > 0) {
    const costTotalIdx = data.length;
    data.push(['', '', '', '', 'TOTAL MATERIAL COST', '', '', '', '', '', Math.round(projectTotalMaterialCost * 100) / 100, '', '']);
    boldRows.add(costTotalIdx);
  }

  if (projectTotalLaborHrs > 0) {
    const laborTotalIdx = data.length;
    data.push(['', '', '', '', 'TOTAL LABOR HOURS', '', '', '', '', '', '', '', Math.round(projectTotalLaborHrs * 10) / 10]);
    boldRows.add(laborTotalIdx);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  const colWidths: number[] = COLUMNS.map((h) => h.length);
  for (const row of data) {
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      const len = val != null ? String(val).length : 0;
      if (len > (colWidths[c] ?? 0)) colWidths[c] = len;
    }
  }
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w + 2, 50) }));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLUMNS.length - 1 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOM');

  const fileName = `${projectName.replace(/[^a-zA-Z0-9_\- ]/g, '')}-bom.xlsx`;
  XLSX.writeFile(wb, fileName);
}
