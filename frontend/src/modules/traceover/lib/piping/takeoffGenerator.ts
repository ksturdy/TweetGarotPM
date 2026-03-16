/**
 * Takeoff Generator — generates TakeoffItems from completed traceover runs.
 *
 * Adapted for Titan PM: always uses PipeSpec-based rate lookups
 * (from PostgreSQL) instead of hardcoded rate tables.
 */

import type { TakeoffItem } from '../../types/takeoff';
import type { TraceoverRun } from '../../types/piping';
import type { PipeSpec } from '../../types/pipingSystem';
import { MATERIAL_LABELS, FITTING_TYPE_LABELS, JOINT_TYPE_LABELS } from './referenceData';
import { generateId } from '../utils/idGen';
import {
  lookupPipeRateFromSpec,
  lookupFittingRateFromSpec,
} from './productivityLookup';

/**
 * Generate TakeoffItems from a completed traceover run.
 *
 * Requires a PipeSpec for productivity rate lookups. If no spec is provided,
 * items will be generated without labor hours.
 */
export function generateTakeoffItems(run: TraceoverRun, spec?: PipeSpec): TakeoffItem[] {
  const items: TakeoffItem[] = [];
  const now = new Date();
  const materialLabel = MATERIAL_LABELS[run.config.material];
  const sizeLabel = run.config.pipeSize.displayLabel;
  const runLabel = run.config.label || '';

  const hasCalibration = run.segments.some((s) => s.unit !== 'px');
  const unit = hasCalibration
    ? (run.segments.find((s) => s.unit !== 'px')?.unit ?? 'ft')
    : 'ft';
  const displayUnit = unit === 'px' ? 'lf' : unit;

  const jointType = run.segments[0]?.jointType ?? null;
  const jointLabel = jointType ? JOINT_TYPE_LABELS[jointType] : '';
  const descBase = [runLabel, jointLabel].filter(Boolean).join(' - ');

  // ── Pipe rate lookup ──
  const pipeRate = spec
    ? lookupPipeRateFromSpec(spec, sizeLabel)
    : { found: false as const, error: 'No pipe spec selected' };

  // ── Walk segments, group by elevation ──
  const startingElevation = run.config.startingElevation ?? 0;

  interface ElevGroup { elevation: number; length: number; }
  const groups: ElevGroup[] = [];
  const verticals: { fromElev: number; toElev: number; length: number }[] = [];
  let prevElevation = startingElevation;

  for (const seg of run.segments) {
    const segLength = hasCalibration ? seg.scaledLength : seg.pixelLength;
    const elevDiff = Math.abs(seg.elevation - prevElevation);

    if (elevDiff > 0) {
      verticals.push({ fromElev: prevElevation, toElev: seg.elevation, length: elevDiff });
    }

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.elevation === seg.elevation) {
      lastGroup.length += segLength;
    } else {
      groups.push({ elevation: seg.elevation, length: segLength });
    }

    prevElevation = seg.elevation;
  }

  function pipeHoursFields(qty: number): Pick<TakeoffItem, 'laborHours' | 'laborHoursError'> {
    if (pipeRate.found) {
      return { laborHours: Math.round(pipeRate.hours * qty * 1000) / 1000 };
    }
    return { laborHoursError: pipeRate.error };
  }

  // ── Emit pipe items ──
  let vertIdx = 0;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];

    if (vertIdx < verticals.length && i > 0) {
      const v = verticals[vertIdx];
      const dir = v.toElev > v.fromElev ? 'up' : 'down';
      const qty = Math.round(v.length * 10) / 10;
      items.push({
        id: generateId(),
        documentId: run.documentId,
        pageNumber: run.pageNumber,
        category: 'piping',
        componentType: 'pipe_segment',
        label: `${sizeLabel} ${materialLabel}`,
        description: [descBase, `Vertical (${dir} ${v.fromElev}' to ${v.toElev}')`].filter(Boolean).join(' - '),
        quantity: qty,
        unit: displayUnit,
        size: sizeLabel,
        material: materialLabel,
        source: 'traceover',
        verified: false,
        traceoverRunId: run.id,
        jointType: jointType ?? undefined,
        pipeMaterial: run.config.material,
        ...pipeHoursFields(qty),
        createdAt: now,
        updatedAt: now,
      });
      vertIdx++;
    }

    if (g.length > 0) {
      const qty = Math.round(g.length * 10) / 10;
      items.push({
        id: generateId(),
        documentId: run.documentId,
        pageNumber: run.pageNumber,
        category: 'piping',
        componentType: 'pipe_segment',
        label: `${sizeLabel} ${materialLabel}`,
        description: [descBase, `Horizontal @ ${g.elevation}' elev`].filter(Boolean).join(' - '),
        quantity: qty,
        unit: displayUnit,
        size: sizeLabel,
        material: materialLabel,
        source: 'traceover',
        verified: false,
        traceoverRunId: run.id,
        jointType: jointType ?? undefined,
        pipeMaterial: run.config.material,
        ...pipeHoursFields(qty),
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // ── Emit fitting items ──
  for (const seg of run.segments) {
    if (!seg.fitting) continue;

    const fittingLabel = FITTING_TYPE_LABELS[seg.fitting];
    let laborFields: Pick<TakeoffItem, 'laborHours' | 'laborHoursError'> = {};
    const fResult = spec
      ? lookupFittingRateFromSpec(spec, seg.fitting, sizeLabel)
      : { found: false as const, error: 'No pipe spec selected' };
    if (fResult.found) {
      laborFields = { laborHours: fResult.hours };
    } else {
      laborFields = { laborHoursError: fResult.error };
    }

    items.push({
      id: generateId(),
      documentId: run.documentId,
      pageNumber: run.pageNumber,
      category: 'piping',
      componentType: 'pipe_fitting',
      label: `${sizeLabel} ${materialLabel} ${fittingLabel}`,
      description: [descBase, `@ ${seg.elevation}' elev`].filter(Boolean).join(' - '),
      quantity: 1,
      unit: 'ea',
      size: sizeLabel,
      material: materialLabel,
      source: 'traceover',
      verified: false,
      traceoverRunId: run.id,
      jointType: jointType ?? undefined,
      fittingType: seg.fitting,
      pipeMaterial: run.config.material,
      ...laborFields,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Elevation-change fittings: 2 elbows per vertical transition
  for (const v of verticals) {
    const elevDesc = `Elevation offset ${v.fromElev}' to ${v.toElev}'`;
    let laborFields: Pick<TakeoffItem, 'laborHours' | 'laborHoursError'> = {};
    const elbowResult = spec
      ? lookupFittingRateFromSpec(spec, 'elbow_90', sizeLabel)
      : { found: false as const, error: 'No pipe spec selected' };
    if (elbowResult.found) {
      laborFields = { laborHours: elbowResult.hours };
    } else {
      laborFields = { laborHoursError: elbowResult.error };
    }

    for (let i = 0; i < 2; i++) {
      items.push({
        id: generateId(),
        documentId: run.documentId,
        pageNumber: run.pageNumber,
        category: 'piping',
        componentType: 'pipe_fitting',
        label: `${sizeLabel} ${materialLabel} ${FITTING_TYPE_LABELS.elbow_90}`,
        description: [descBase, elevDesc].filter(Boolean).join(' - '),
        quantity: 1,
        unit: 'ea',
        size: sizeLabel,
        material: materialLabel,
        source: 'traceover',
        verified: false,
        traceoverRunId: run.id,
        jointType: jointType ?? undefined,
        fittingType: 'elbow_90',
        pipeMaterial: run.config.material,
        ...laborFields,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Branch tee
  if (run.fittingCounts.tee > 0) {
    let fittingLabel: string;
    let teeSize = sizeLabel;
    let laborFields: Pick<TakeoffItem, 'laborHours' | 'laborHoursError'> = {};

    if (run.branchParentPipeSize) {
      const parentSize = run.branchParentPipeSize.displayLabel;
      fittingLabel = parentSize === sizeLabel
        ? `${parentSize}x${parentSize}x${sizeLabel} Tee`
        : `${parentSize}x${parentSize}x${sizeLabel} Reducing Tee`;
      teeSize = `${parentSize}x${sizeLabel}`;

      const redTeeResult = spec
        ? lookupFittingRateFromSpec(spec, 'tee', parentSize, sizeLabel)
        : { found: false as const, error: 'No pipe spec selected' };
      if (redTeeResult.found) {
        laborFields = { laborHours: redTeeResult.hours };
      } else {
        laborFields = { laborHoursError: redTeeResult.error };
      }
    } else {
      fittingLabel = FITTING_TYPE_LABELS.tee;
      const stdTeeResult = spec
        ? lookupFittingRateFromSpec(spec, 'tee', sizeLabel)
        : { found: false as const, error: 'No pipe spec selected' };
      if (stdTeeResult.found) {
        laborFields = { laborHours: stdTeeResult.hours };
      } else {
        laborFields = { laborHoursError: stdTeeResult.error };
      }
    }

    for (let i = 0; i < run.fittingCounts.tee; i++) {
      items.push({
        id: generateId(),
        documentId: run.documentId,
        pageNumber: run.pageNumber,
        category: 'piping',
        componentType: 'pipe_fitting',
        label: `${sizeLabel} ${materialLabel} ${fittingLabel}`,
        description: descBase,
        quantity: 1,
        unit: 'ea',
        size: teeSize,
        material: materialLabel,
        source: 'traceover',
        verified: false,
        traceoverRunId: run.id,
        jointType: jointType ?? undefined,
        fittingType: 'tee',
        pipeMaterial: run.config.material,
        reducingSize: run.branchParentPipeSize ? sizeLabel : undefined,
        ...laborFields,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return items;
}
