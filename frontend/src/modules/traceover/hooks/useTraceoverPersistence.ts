/**
 * Persistence hook — bridges Zustand stores ↔ backend API.
 *
 * On mount it hydrates every store from the server, then subscribes to
 * store mutations and fires the corresponding API calls (create / delete /
 * update) in the background.
 *
 * Returns an `uploadDocument` helper that uploads a File to the server AND
 * loads the resulting PDF into the viewer.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { generateId } from '../lib/utils/idGen';
import { usePdfStore } from '../stores/usePdfStore';
import { useTraceoverStore } from '../stores/useTraceoverStore';
import { useMeasurementStore } from '../stores/useMeasurementStore';
import { usePageMetadataStore } from '../stores/usePageMetadataStore';
import { parsePageKey } from '../types/pageMetadata';
import type { PdfDocument } from '../types/pdf';
import type { TraceoverRun } from '../types/piping';
import type { ScaleCalibration, Measurement } from '../types/measurement';
import {
  traceoverDocumentsApi,
  traceoverRunsApi,
  traceoverMeasurementsApi,
} from '../../../services/traceover';
import { pipeSpecsApi, type PipeSpec as ApiPipeSpec } from '../../../services/pipeSpecs';
import { rateTablesApi, type RateTable as ApiRateTable } from '../../../services/rateTables';
import {
  pipingServicesApi,
  projectSystemsApi,
  type PipingService as ApiPipingService,
  type ProjectSystem as ApiProjectSystem,
} from '../../../services/pipingServices';
import { useSettingsStore } from '../stores/useSettingsStore';
import type { PipeSpec, PipingService, ProjectSystem, ServiceSizeRule, RateTable, RateTableColumn } from '../types/pipingSystem';
import type { JointType, PipeMaterial, PipeServiceType } from '../types/piping';

// ─── ID mapping between client UUIDs and server integer IDs ───

interface IdMaps {
  docServerToClient: Map<number, string>;
  docClientToServer: Map<string, number>;
  runClientToServer: Map<string, number>;
  measClientToServer: Map<string, number>;
  rateTableClientToServer: Map<string, number>;
  rateTableColClientToServer: Map<string, number>;
  specClientToServer: Map<string, number>;
  serviceClientToServer: Map<string, number>;
  systemClientToServer: Map<string, number>;
  sizeRuleClientToServer: Map<string, number>;
}

function createIdMaps(): IdMaps {
  return {
    docServerToClient: new Map(),
    docClientToServer: new Map(),
    runClientToServer: new Map(),
    measClientToServer: new Map(),
    rateTableClientToServer: new Map(),
    rateTableColClientToServer: new Map(),
    specClientToServer: new Map(),
    serviceClientToServer: new Map(),
    systemClientToServer: new Map(),
    sizeRuleClientToServer: new Map(),
  };
}

// ─── Store → API format converters ───

function specToApiMeta(spec: PipeSpec) {
  return {
    name: spec.name,
    joint_method: spec.jointMethod,
    material: spec.material,
    schedule: spec.schedule,
    stock_pipe_length: spec.stockPipeLength,
    joint_type: spec.jointType,
    pipe_material: spec.pipeMaterial,
    is_default: spec.isDefault,
  };
}

function pipeRatesToApi(rates: Record<string, number>) {
  return Object.entries(rates).map(([size, rate]) => ({
    pipe_size: size,
    hours_per_foot: rate,
  }));
}

function fittingRatesToApi(rates: PipeSpec['fittingRates']) {
  const result: { fitting_type: string; pipe_size: string; hours_per_unit: number }[] = [];
  for (const [ft, sizeRates] of Object.entries(rates)) {
    for (const [size, rate] of Object.entries(sizeRates as Record<string, number>)) {
      result.push({ fitting_type: ft, pipe_size: size, hours_per_unit: rate });
    }
  }
  return result;
}

function reducingRatesToApi(rates: PipeSpec['reducingFittingRates']) {
  const result: { fitting_type: string; main_size: string; reducing_size: string; hours_per_unit: number }[] = [];
  for (const [ft, sizeRates] of Object.entries(rates)) {
    for (const [key, rate] of Object.entries(sizeRates as Record<string, number>)) {
      const [mainSize, reducingSize] = key.split('x');
      result.push({ fitting_type: ft, main_size: mainSize, reducing_size: reducingSize, hours_per_unit: rate });
    }
  }
  return result;
}

function reducingTeeRatesToApi(rates: Record<string, number>) {
  return Object.entries(rates).map(([key, rate]) => {
    const [mainSize, branchSize] = key.split('x');
    return { main_size: mainSize, branch_size: branchSize, hours_per_unit: rate };
  });
}

function crossReducingRatesToApi(rates: Record<string, number>) {
  return Object.entries(rates).map(([key, rate]) => {
    const [mainSize, reducingSize] = key.split('x');
    return { main_size: mainSize, reducing_size: reducingSize, hours_per_unit: rate };
  });
}

// ─── API → Store mappers ───

function mapApiPipeSpec(s: ApiPipeSpec): PipeSpec {
  return {
    id: String(s.id),
    name: s.name,
    jointMethod: s.joint_method,
    material: s.material as any,
    schedule: s.schedule as any,
    stockPipeLength: s.stock_pipe_length,
    jointType: s.joint_type as JointType,
    pipeMaterial: s.pipe_material as PipeMaterial,
    pipeRates: Object.fromEntries((s.pipe_rates ?? []).map((r) => [r.pipe_size, r.hours_per_foot])),
    fittingRates: (s.fitting_rates ?? []).reduce<Record<string, Record<string, number>>>((acc, r) => {
      if (!acc[r.fitting_type]) acc[r.fitting_type] = {};
      acc[r.fitting_type][r.pipe_size] = r.hours_per_unit;
      return acc;
    }, {}),
    reducingFittingRates: (s.reducing_rates ?? []).reduce<Record<string, Record<string, number>>>((acc, r) => {
      if (!acc[r.fitting_type]) acc[r.fitting_type] = {};
      acc[r.fitting_type][`${r.main_size}x${r.reducing_size}`] = r.hours_per_unit;
      return acc;
    }, {}) as PipeSpec['reducingFittingRates'],
    reducingTeeRates: Object.fromEntries(
      (s.reducing_tee_rates ?? []).map((r) => [`${r.main_size}x${r.branch_size}`, r.hours_per_unit]),
    ),
    crossReducingRates: Object.fromEntries(
      (s.cross_reducing_rates ?? []).map((r) => [`${r.main_size}x${r.reducing_size}`, r.hours_per_unit]),
    ),
    isDefault: s.is_default,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function mapApiService(s: ApiPipingService): PipingService {
  return {
    id: String(s.id),
    name: s.name,
    abbreviation: s.abbreviation,
    color: s.color,
    serviceCategory: s.service_category as PipeServiceType,
    defaultPipeSpecId: String(s.default_pipe_spec_id ?? ''),
    fittingTypes: s.fitting_types ?? [],
    valveTypes: s.valve_types ?? [],
    accessories: s.accessories ?? [],
    sizeRules: (s.size_rules ?? []).map((r): ServiceSizeRule => ({
      id: String(r.id),
      maxSizeInches: r.max_size_inches,
      pipeSpecId: String(r.pipe_spec_id),
    })),
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function mapApiSystem(s: ApiProjectSystem): ProjectSystem {
  return {
    id: String(s.id),
    name: s.name,
    abbreviation: s.abbreviation,
    serviceId: String(s.piping_service_id ?? ''),
    color: s.color,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

// ─── API → Store mapper for Rate Tables ───

function mapApiRateTable(t: ApiRateTable): RateTable {
  return {
    id: String(t.id),
    name: t.name,
    category: t.category,
    notes: t.notes || '',
    columns: (t.columns ?? []).map((c): RateTableColumn => ({
      id: String(c.id),
      columnKey: c.column_key,
      columnLabel: c.column_label,
      sortOrder: c.sort_order,
      rates: typeof c.rates === 'string' ? JSON.parse(c.rates) : (c.rates || {}),
    })),
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

// ─── Hook ───

export function useTraceoverPersistence(takeoffId: number | null) {
  const addDocumentFromProxy = usePdfStore((s) => s.addDocumentFromProxy);

  const ids = useRef(createIdMaps());
  const hydrating = useRef(false);   // guard to prevent double-run
  const hydrated = useRef(false);    // true only AFTER data is loaded into stores

  // ─── 1. Hydrate stores from server on mount ───

  useEffect(() => {
    if (!takeoffId || hydrating.current) return;
    hydrating.current = true;

    (async () => {
      try {
        // Fetch rate tables, pipe specs, services, and project systems (settings)
        const [rateTablesRes, specsRes, servicesRes, systemsRes] = await Promise.all([
          rateTablesApi.getAll(),
          pipeSpecsApi.getAll({ includeRates: true }),
          pipingServicesApi.getAll(),
          projectSystemsApi.getByTakeoff(takeoffId),
        ]);

        // Populate settings ID maps — rate tables
        for (const t of rateTablesRes.data) {
          ids.current.rateTableClientToServer.set(String(t.id), t.id);
        }
        // Populate settings ID maps
        for (const s of specsRes.data) {
          ids.current.specClientToServer.set(String(s.id), s.id);
        }
        for (const s of servicesRes.data) {
          ids.current.serviceClientToServer.set(String(s.id), s.id);
          for (const r of s.size_rules ?? []) {
            ids.current.sizeRuleClientToServer.set(String(r.id), r.id);
          }
        }
        for (const s of systemsRes.data) {
          ids.current.systemClientToServer.set(String(s.id), s.id);
        }

        // Rate tables from list endpoint don't include columns — fetch each one
        const fullRateTables = await Promise.all(
          rateTablesRes.data.map(async (t) => {
            const { data } = await rateTablesApi.getById(t.id);
            // Populate column ID maps
            for (const c of data.columns ?? []) {
              ids.current.rateTableColClientToServer.set(String(c.id), c.id);
            }
            return data;
          }),
        );

        useSettingsStore.getState().loadFromApi({
          rateTables: fullRateTables.map(mapApiRateTable),
          pipeSpecs: specsRes.data.map(mapApiPipeSpec),
          services: servicesRes.data.map(mapApiService),
          systems: systemsRes.data.map(mapApiSystem),
        });

        // Mark hydration complete — subscriptions can now process changes
        hydrated.current = true;

        // Fetch documents
        const { data: serverDocs } = await traceoverDocumentsApi.getByTakeoff(takeoffId);

        for (const serverDoc of serverDocs) {
          const clientId = generateId();
          ids.current.docServerToClient.set(serverDoc.id, clientId);
          ids.current.docClientToServer.set(clientId, serverDoc.id);

          // Stream the PDF binary through authenticated fetch
          const streamUrl = traceoverDocumentsApi.getFileStreamUrl(takeoffId, serverDoc.id);
          const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
          // streamUrl is "/api/takeoffs/…", so strip /api from baseUrl
          const origin = baseUrl.replace(/\/api\/?$/, '');
          const fullUrl = `${origin}${streamUrl}`;
          const token = localStorage.getItem('token');

          const resp = await fetch(fullUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!resp.ok) {
            console.error(`[Persistence] Failed to stream doc ${serverDoc.id}: ${resp.status}`);
            continue;
          }

          const arrayBuffer = await resp.arrayBuffer();
          const proxy = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

          const pdfDoc: PdfDocument = {
            id: clientId,
            fileName: serverDoc.original_name,
            fileSize: serverDoc.file_size,
            pageCount: proxy.numPages,
            serverId: serverDoc.id,
            loadedAt: new Date(serverDoc.created_at),
          };
          addDocumentFromProxy(pdfDoc, proxy);

          // Hydrate page metadata
          if (serverDoc.pages && serverDoc.pages.length > 0) {
            const metaStore = usePageMetadataStore.getState();
            for (const p of serverDoc.pages) {
              metaStore.setPageMeta(clientId, p.page_number, {
                name: p.name || '',
                drawingNumber: p.drawing_number || '',
                revision: p.revision || '',
              });
            }
          }

          // Hydrate calibrations
          if (serverDoc.calibrations && serverDoc.calibrations.length > 0) {
            const measStore = useMeasurementStore.getState();
            for (const c of serverDoc.calibrations) {
              const cal: ScaleCalibration = {
                id: generateId(),
                documentId: clientId,
                pageNumber: c.page_number,
                startPoint: c.start_point,
                endPoint: c.end_point,
                pixelDistance: c.pixel_distance,
                realDistance: c.real_distance,
                unit: c.unit,
                pixelsPerUnit: c.pixels_per_unit,
                createdAt: new Date(c.created_at),
              };
              measStore.setCalibration(cal);
            }
          }
        }

        // Fetch runs
        const { data: serverRuns } = await traceoverRunsApi.getByTakeoff(takeoffId);
        const clientRuns: TraceoverRun[] = serverRuns.map((sr) => {
          const clientDocId = sr.document_id
            ? ids.current.docServerToClient.get(sr.document_id) ?? ''
            : '';
          const clientId = generateId();
          ids.current.runClientToServer.set(clientId, sr.id);

          return {
            id: clientId,
            serverId: sr.id,
            documentId: clientDocId,
            pageNumber: sr.page_number ?? 0,
            config: sr.config as any,
            segments: sr.segments as any,
            branches: sr.branches as any,
            isComplete: sr.is_complete,
            totalPixelLength: sr.total_pixel_length,
            totalScaledLength: sr.total_scaled_length,
            verticalPipeLength: sr.vertical_pipe_length,
            fittingCounts: sr.fitting_counts as any,
            generatedTakeoffItemIds: (sr.generated_takeoff_item_ids ?? []).map(String),
            branchParentPipeSize: sr.branch_parent_pipe_size as any,
            createdAt: new Date(sr.created_at),
            updatedAt: new Date(sr.updated_at),
          };
        });
        if (clientRuns.length > 0) {
          useTraceoverStore.getState().restoreState(clientRuns);
        }

        // Fetch measurements for each document
        for (const serverDoc of serverDocs) {
          const clientDocId = ids.current.docServerToClient.get(serverDoc.id);
          if (!clientDocId) continue;
          const { data: serverMeasurements } = await traceoverMeasurementsApi.getByDocument(
            takeoffId,
            serverDoc.id,
          );
          const measStore = useMeasurementStore.getState();
          for (const sm of serverMeasurements) {
            const mId = generateId();
            ids.current.measClientToServer.set(mId, sm.id);
            measStore.addMeasurement({
              id: mId,
              serverId: sm.id,
              documentId: clientDocId,
              pageNumber: sm.page_number,
              type: sm.measurement_type as Measurement['type'],
              points: sm.points as any,
              label: sm.label,
              color: sm.color,
              pixelValue: sm.pixel_value,
              scaledValue: sm.scaled_value,
              unit: sm.unit,
              createdAt: new Date(sm.created_at),
            });
          }
        }
      } catch (err) {
        console.error('[Persistence] Failed to hydrate:', err);
      }
    })();
  }, [takeoffId, addDocumentFromProxy]);

  // ─── 2. Subscribe to run changes → create / delete on server ───

  useEffect(() => {
    if (!takeoffId) return;

    let prevRuns = useTraceoverStore.getState().runs;

    const unsub = useTraceoverStore.subscribe((state) => {
      if (!hydrated.current) {
        prevRuns = state.runs;
        return;
      }

      const newRuns = state.runs;

      // Added runs
      const added = newRuns.filter((r) => !prevRuns.some((p) => p.id === r.id));
      for (const run of added) {
        const serverDocId = ids.current.docClientToServer.get(run.documentId) ?? null;
        traceoverRunsApi
          .create(takeoffId, {
            document_id: serverDocId,
            page_number: run.pageNumber,
            config: run.config as any,
            segments: run.segments as any,
            branches: run.branches as any,
            is_complete: run.isComplete,
            total_pixel_length: run.totalPixelLength,
            total_scaled_length: run.totalScaledLength,
            vertical_pipe_length: run.verticalPipeLength,
            fitting_counts: run.fittingCounts as any,
            generated_takeoff_item_ids: run.generatedTakeoffItemIds.map(Number),
            branch_parent_pipe_size: run.branchParentPipeSize as any,
          })
          .then(({ data }) => {
            ids.current.runClientToServer.set(run.id, data.id);
          })
          .catch((err) => console.error('[Persistence] run create failed:', err));
      }

      // Removed runs
      const removed = prevRuns.filter((r) => !newRuns.some((n) => n.id === r.id));
      for (const run of removed) {
        const serverId = ids.current.runClientToServer.get(run.id) ?? run.serverId;
        if (serverId) {
          traceoverRunsApi
            .delete(takeoffId, serverId)
            .catch((err) => console.error('[Persistence] run delete failed:', err));
          ids.current.runClientToServer.delete(run.id);
        }
      }

      prevRuns = newRuns;
    });

    return unsub;
  }, [takeoffId]);

  // ─── 3. Subscribe to calibration changes → upsert / delete on server ───

  useEffect(() => {
    if (!takeoffId) return;

    let prevCals = new Map(useMeasurementStore.getState().calibrations);

    const unsub = useMeasurementStore.subscribe((state) => {
      if (!hydrated.current) {
        prevCals = new Map(state.calibrations);
        return;
      }

      const newCals = state.calibrations;

      // New or updated calibrations
      for (const [key, cal] of newCals) {
        if (prevCals.get(key) === cal) continue;
        const serverDocId = ids.current.docClientToServer.get(cal.documentId);
        if (serverDocId) {
          traceoverDocumentsApi
            .setCalibration(takeoffId, serverDocId, cal.pageNumber, {
              start_point: cal.startPoint,
              end_point: cal.endPoint,
              pixel_distance: cal.pixelDistance,
              real_distance: cal.realDistance,
              unit: cal.unit,
              pixels_per_unit: cal.pixelsPerUnit,
            })
            .catch((err) => console.error('[Persistence] calibration upsert failed:', err));
        }
      }

      // Deleted calibrations
      for (const [key, cal] of prevCals) {
        if (!newCals.has(key)) {
          const serverDocId = ids.current.docClientToServer.get(cal.documentId);
          if (serverDocId) {
            traceoverDocumentsApi
              .deleteCalibration(takeoffId, serverDocId, cal.pageNumber)
              .catch((err) => console.error('[Persistence] calibration delete failed:', err));
          }
        }
      }

      prevCals = new Map(newCals);
    });

    return unsub;
  }, [takeoffId]);

  // ─── 4. Subscribe to measurement changes → create / delete on server ───

  useEffect(() => {
    if (!takeoffId) return;

    let prevMeasurements = [...useMeasurementStore.getState().measurements];

    const unsub = useMeasurementStore.subscribe((state) => {
      if (!hydrated.current) {
        prevMeasurements = [...state.measurements];
        return;
      }

      const newMeasurements = state.measurements;

      // Added
      const added = newMeasurements.filter((m) => !prevMeasurements.some((p) => p.id === m.id));
      for (const m of added) {
        const serverDocId = ids.current.docClientToServer.get(m.documentId);
        if (serverDocId) {
          traceoverMeasurementsApi
            .create(takeoffId, serverDocId, {
              page_number: m.pageNumber,
              measurement_type: m.type,
              points: m.points as any,
              label: m.label,
              color: m.color,
              pixel_value: m.pixelValue,
              scaled_value: m.scaledValue,
              unit: m.unit,
            })
            .then(({ data }) => {
              ids.current.measClientToServer.set(m.id, data.id);
            })
            .catch((err) => console.error('[Persistence] measurement create failed:', err));
        }
      }

      // Removed
      const removed = prevMeasurements.filter((m) => !newMeasurements.some((n) => n.id === m.id));
      for (const m of removed) {
        const serverId = ids.current.measClientToServer.get(m.id) ?? m.serverId;
        const serverDocId = ids.current.docClientToServer.get(m.documentId);
        if (serverId && serverDocId) {
          traceoverMeasurementsApi
            .delete(takeoffId, serverDocId, serverId)
            .catch((err) => console.error('[Persistence] measurement delete failed:', err));
          ids.current.measClientToServer.delete(m.id);
        }
      }

      prevMeasurements = [...newMeasurements];
    });

    return unsub;
  }, [takeoffId]);

  // ─── 5. Subscribe to page-metadata changes → debounced PUT ───

  useEffect(() => {
    if (!takeoffId) return;

    let prevPages = new Map(usePageMetadataStore.getState().pages);
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const unsub = usePageMetadataStore.subscribe((state) => {
      if (!hydrated.current) {
        prevPages = new Map(state.pages);
        return;
      }

      for (const [key, meta] of state.pages) {
        if (prevPages.get(key) === meta) continue;

        // Debounce 500 ms — user edits page names/revisions live
        const existing = timers.get(key);
        if (existing) clearTimeout(existing);

        timers.set(
          key,
          setTimeout(() => {
            const { documentId, pageNumber } = parsePageKey(key as any);
            const serverDocId = ids.current.docClientToServer.get(documentId);
            if (serverDocId) {
              traceoverDocumentsApi
                .updatePage(takeoffId, serverDocId, pageNumber, {
                  name: meta.name,
                  drawing_number: meta.drawingNumber,
                  revision: meta.revision,
                })
                .catch((err) => console.error('[Persistence] page meta update failed:', err));
            }
            timers.delete(key);
          }, 500),
        );
      }

      prevPages = new Map(state.pages);
    });

    return () => {
      unsub();
      for (const t of timers.values()) clearTimeout(t);
    };
  }, [takeoffId]);

  // ─── 6. Subscribe to pipe spec changes → create / update / delete on server ───

  useEffect(() => {
    if (!takeoffId) return;

    let prevSpecs = useSettingsStore.getState().pipeSpecs;
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const unsub = useSettingsStore.subscribe((state) => {
      if (!hydrated.current) {
        prevSpecs = state.pipeSpecs;
        return;
      }

      const curr = state.pipeSpecs;

      // Added specs
      for (const spec of curr) {
        if (prevSpecs.some((p) => p.id === spec.id)) continue;
        if (ids.current.specClientToServer.has(spec.id)) continue; // already persisted
        (async () => {
          try {
            const { data } = await pipeSpecsApi.create(specToApiMeta(spec));
            ids.current.specClientToServer.set(spec.id, data.id);
            // Upload rates for duplicated specs that come with rates
            const latest = useSettingsStore.getState().pipeSpecs.find((s) => s.id === spec.id);
            if (!latest) return;
            const sid = data.id;
            if (Object.keys(latest.pipeRates).length > 0) {
              await pipeSpecsApi.updatePipeRates(sid, pipeRatesToApi(latest.pipeRates));
            }
            if (Object.keys(latest.fittingRates).length > 0) {
              await pipeSpecsApi.updateFittingRates(sid, fittingRatesToApi(latest.fittingRates));
            }
            if (Object.keys(latest.reducingFittingRates).length > 0) {
              await pipeSpecsApi.updateReducingRates(sid, reducingRatesToApi(latest.reducingFittingRates));
            }
            if (Object.keys(latest.reducingTeeRates).length > 0) {
              await pipeSpecsApi.updateReducingTeeRates(sid, reducingTeeRatesToApi(latest.reducingTeeRates));
            }
            if (Object.keys(latest.crossReducingRates).length > 0) {
              await pipeSpecsApi.updateCrossReducingRates(sid, crossReducingRatesToApi(latest.crossReducingRates));
            }
          } catch (err) {
            console.error('[Persistence] spec create failed:', err);
          }
        })();
      }

      // Removed specs
      for (const spec of prevSpecs) {
        if (curr.some((c) => c.id === spec.id)) continue;
        const serverId = ids.current.specClientToServer.get(spec.id);
        if (serverId) {
          pipeSpecsApi.delete(serverId).catch((err) =>
            console.error('[Persistence] spec delete failed:', err),
          );
          ids.current.specClientToServer.delete(spec.id);
        }
      }

      // Updated specs (debounced)
      for (const spec of curr) {
        const prev = prevSpecs.find((p) => p.id === spec.id);
        if (!prev || prev === spec) continue;

        const existing = debounceTimers.get(spec.id);
        if (existing) clearTimeout(existing);

        // Capture which fields changed before the timer fires
        const metaChanged =
          prev.name !== spec.name || prev.jointMethod !== spec.jointMethod ||
          prev.material !== spec.material || prev.schedule !== spec.schedule ||
          prev.stockPipeLength !== spec.stockPipeLength || prev.jointType !== spec.jointType ||
          prev.pipeMaterial !== spec.pipeMaterial || prev.isDefault !== spec.isDefault;
        const pipeRatesChanged = prev.pipeRates !== spec.pipeRates;
        const fittingRatesChanged = prev.fittingRates !== spec.fittingRates;
        const reducingRatesChanged = prev.reducingFittingRates !== spec.reducingFittingRates;
        const teeRatesChanged = prev.reducingTeeRates !== spec.reducingTeeRates;
        const crossRatesChanged = prev.crossReducingRates !== spec.crossReducingRates;

        debounceTimers.set(
          spec.id,
          setTimeout(async () => {
            const serverId = ids.current.specClientToServer.get(spec.id);
            if (!serverId) { debounceTimers.delete(spec.id); return; }

            // Read latest state at fire time
            const latest = useSettingsStore.getState().pipeSpecs.find((s) => s.id === spec.id);
            if (!latest) { debounceTimers.delete(spec.id); return; }

            try {
              if (metaChanged) {
                await pipeSpecsApi.update(serverId, specToApiMeta(latest));
              }
              if (pipeRatesChanged) {
                await pipeSpecsApi.updatePipeRates(serverId, pipeRatesToApi(latest.pipeRates));
              }
              if (fittingRatesChanged) {
                await pipeSpecsApi.updateFittingRates(serverId, fittingRatesToApi(latest.fittingRates));
              }
              if (reducingRatesChanged) {
                await pipeSpecsApi.updateReducingRates(serverId, reducingRatesToApi(latest.reducingFittingRates));
              }
              if (teeRatesChanged) {
                await pipeSpecsApi.updateReducingTeeRates(serverId, reducingTeeRatesToApi(latest.reducingTeeRates));
              }
              if (crossRatesChanged) {
                await pipeSpecsApi.updateCrossReducingRates(serverId, crossReducingRatesToApi(latest.crossReducingRates));
              }
            } catch (err) {
              console.error('[Persistence] spec update failed:', err);
            }
            debounceTimers.delete(spec.id);
          }, 800),
        );
      }

      prevSpecs = curr;
    });

    return () => {
      unsub();
      for (const t of debounceTimers.values()) clearTimeout(t);
    };
  }, [takeoffId]);

  // ─── 7. Subscribe to service changes → create / update / delete on server ───

  useEffect(() => {
    if (!takeoffId) return;

    let prevServices = useSettingsStore.getState().services;
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const unsub = useSettingsStore.subscribe((state) => {
      if (!hydrated.current) {
        prevServices = state.services;
        return;
      }

      const curr = state.services;

      // Added services
      for (const svc of curr) {
        if (prevServices.some((p) => p.id === svc.id)) continue;
        if (ids.current.serviceClientToServer.has(svc.id)) continue; // already persisted
        (async () => {
          try {
            const specServerId = ids.current.specClientToServer.get(svc.defaultPipeSpecId) ?? null;
            const { data } = await pipingServicesApi.create({
              name: svc.name,
              abbreviation: svc.abbreviation,
              color: svc.color,
              service_category: svc.serviceCategory,
              default_pipe_spec_id: specServerId,
              fitting_types: svc.fittingTypes,
              valve_types: svc.valveTypes,
              accessories: svc.accessories,
            } as any);
            ids.current.serviceClientToServer.set(svc.id, data.id);

            // Back-fill any project systems that reference this service
            // (they may have been saved with piping_service_id=NULL if the
            // service hadn't been persisted yet when the system was created)
            const currentSystems = useSettingsStore.getState().systems;
            for (const sys of currentSystems) {
              if (sys.serviceId !== svc.id) continue;
              const sysServerId = ids.current.systemClientToServer.get(sys.id);
              if (!sysServerId) continue;
              projectSystemsApi
                .update(takeoffId, sysServerId, { piping_service_id: data.id } as any)
                .catch((err) => console.error('[Persistence] system backfill service link failed:', err));
            }
          } catch (err) {
            console.error('[Persistence] service create failed:', err);
          }
        })();
      }

      // Removed services
      for (const svc of prevServices) {
        if (curr.some((c) => c.id === svc.id)) continue;
        const serverId = ids.current.serviceClientToServer.get(svc.id);
        if (serverId) {
          pipingServicesApi.delete(serverId).catch((err) =>
            console.error('[Persistence] service delete failed:', err),
          );
          ids.current.serviceClientToServer.delete(svc.id);
        }
      }

      // Updated services (debounced)
      for (const svc of curr) {
        const prev = prevServices.find((p) => p.id === svc.id);
        if (!prev || prev === svc) continue;

        const existing = debounceTimers.get(svc.id);
        if (existing) clearTimeout(existing);

        const sizeRulesChanged = prev.sizeRules !== svc.sizeRules;

        debounceTimers.set(
          svc.id,
          setTimeout(async () => {
            const serverId = ids.current.serviceClientToServer.get(svc.id);
            if (!serverId) { debounceTimers.delete(svc.id); return; }

            const latest = useSettingsStore.getState().services.find((s) => s.id === svc.id);
            if (!latest) { debounceTimers.delete(svc.id); return; }

            try {
              // Update service metadata
              const specServerId = ids.current.specClientToServer.get(latest.defaultPipeSpecId) ?? null;
              await pipingServicesApi.update(serverId, {
                name: latest.name,
                abbreviation: latest.abbreviation,
                color: latest.color,
                service_category: latest.serviceCategory,
                default_pipe_spec_id: specServerId,
                fitting_types: latest.fittingTypes,
                valve_types: latest.valveTypes,
                accessories: latest.accessories,
              } as any);

              // Sync size rules if changed
              if (sizeRulesChanged) {
                const prevRules = prev.sizeRules;
                const currRules = latest.sizeRules;

                // Added rules
                for (const rule of currRules) {
                  if (prevRules.some((r) => r.id === rule.id)) continue;
                  const ruleSpecId = ids.current.specClientToServer.get(rule.pipeSpecId) ?? null;
                  try {
                    const { data } = await pipingServicesApi.addSizeRule(serverId, {
                      max_size_inches: rule.maxSizeInches,
                      pipe_spec_id: ruleSpecId as any,
                    });
                    ids.current.sizeRuleClientToServer.set(rule.id, data.id);
                  } catch (err) {
                    console.error('[Persistence] size rule create failed:', err);
                  }
                }

                // Removed rules
                for (const rule of prevRules) {
                  if (currRules.some((r) => r.id === rule.id)) continue;
                  const ruleServerId = ids.current.sizeRuleClientToServer.get(rule.id);
                  if (ruleServerId) {
                    pipingServicesApi.deleteSizeRule(serverId, ruleServerId).catch((err) =>
                      console.error('[Persistence] size rule delete failed:', err),
                    );
                    ids.current.sizeRuleClientToServer.delete(rule.id);
                  }
                }

                // Updated rules
                for (const rule of currRules) {
                  const prevRule = prevRules.find((r) => r.id === rule.id);
                  if (!prevRule) continue;
                  if (prevRule.maxSizeInches === rule.maxSizeInches && prevRule.pipeSpecId === rule.pipeSpecId) continue;
                  const ruleServerId = ids.current.sizeRuleClientToServer.get(rule.id);
                  const ruleSpecId = ids.current.specClientToServer.get(rule.pipeSpecId) ?? null;
                  if (ruleServerId) {
                    pipingServicesApi
                      .updateSizeRule(serverId, ruleServerId, {
                        max_size_inches: rule.maxSizeInches,
                        pipe_spec_id: ruleSpecId,
                      } as any)
                      .catch((err) => console.error('[Persistence] size rule update failed:', err));
                  }
                }
              }
            } catch (err) {
              console.error('[Persistence] service update failed:', err);
            }
            debounceTimers.delete(svc.id);
          }, 800),
        );
      }

      prevServices = curr;
    });

    return () => {
      unsub();
      for (const t of debounceTimers.values()) clearTimeout(t);
    };
  }, [takeoffId]);

  // ─── 8. Subscribe to project system changes → create / update / delete on server ───

  useEffect(() => {
    if (!takeoffId) return;

    let prevSystems = useSettingsStore.getState().systems;

    const unsub = useSettingsStore.subscribe((state) => {
      if (!hydrated.current) {
        prevSystems = state.systems;
        return;
      }

      const curr = state.systems;

      // Added systems
      for (const sys of curr) {
        if (prevSystems.some((p) => p.id === sys.id)) continue;
        if (ids.current.systemClientToServer.has(sys.id)) continue; // already persisted
        // If ID is numeric (created by inline API form), register mapping and skip
        const sysNumId = Number(sys.id);
        if (!isNaN(sysNumId) && sysNumId > 0 && Number.isInteger(sysNumId)) {
          ids.current.systemClientToServer.set(sys.id, sysNumId);
          continue;
        }
        (async () => {
          try {
            const serviceServerId = ids.current.serviceClientToServer.get(sys.serviceId) ?? null;
            const { data } = await projectSystemsApi.create(takeoffId, {
              name: sys.name,
              abbreviation: sys.abbreviation,
              piping_service_id: serviceServerId,
              color: sys.color,
            } as any);
            ids.current.systemClientToServer.set(sys.id, data.id);
          } catch (err) {
            console.error('[Persistence] system create failed:', err);
          }
        })();
      }

      // Removed systems
      for (const sys of prevSystems) {
        if (curr.some((c) => c.id === sys.id)) continue;
        const serverId = ids.current.systemClientToServer.get(sys.id);
        if (serverId) {
          projectSystemsApi.delete(takeoffId, serverId).catch((err) =>
            console.error('[Persistence] system delete failed:', err),
          );
          ids.current.systemClientToServer.delete(sys.id);
        }
      }

      // Updated systems (no debounce — small payload)
      for (const sys of curr) {
        const prev = prevSystems.find((p) => p.id === sys.id);
        if (!prev || prev === sys) continue;
        const serverId = ids.current.systemClientToServer.get(sys.id);
        if (!serverId) continue;
        const serviceServerId = ids.current.serviceClientToServer.get(sys.serviceId) ?? null;
        projectSystemsApi
          .update(takeoffId, serverId, {
            name: sys.name,
            abbreviation: sys.abbreviation,
            piping_service_id: serviceServerId,
            color: sys.color,
          } as any)
          .catch((err) => console.error('[Persistence] system update failed:', err));
      }

      prevSystems = curr;
    });

    return unsub;
  }, [takeoffId]);

  // ─── 9. Subscribe to rate table changes → create / update / delete on server ───

  useEffect(() => {
    if (!takeoffId) return;

    let prevTables = useSettingsStore.getState().rateTables;
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const unsub = useSettingsStore.subscribe((state) => {
      if (!hydrated.current) {
        prevTables = state.rateTables;
        return;
      }

      const curr = state.rateTables;

      // Added tables
      for (const table of curr) {
        if (prevTables.some((p) => p.id === table.id)) continue;
        if (ids.current.rateTableClientToServer.has(table.id)) continue;
        (async () => {
          try {
            const { data } = await rateTablesApi.create({
              name: table.name,
              category: table.category,
              notes: table.notes,
              columns: table.columns.map((c) => ({
                column_key: c.columnKey,
                column_label: c.columnLabel,
                sort_order: c.sortOrder,
                rates: c.rates,
              })),
            });
            ids.current.rateTableClientToServer.set(table.id, data.id);
            // Map column IDs
            if (data.columns) {
              const latest = useSettingsStore.getState().rateTables.find((t) => t.id === table.id);
              if (latest) {
                for (let i = 0; i < data.columns.length && i < latest.columns.length; i++) {
                  ids.current.rateTableColClientToServer.set(latest.columns[i].id, data.columns[i].id);
                }
              }
            }
          } catch (err) {
            console.error('[Persistence] rate table create failed:', err);
          }
        })();
      }

      // Removed tables
      for (const table of prevTables) {
        if (curr.some((c) => c.id === table.id)) continue;
        const serverId = ids.current.rateTableClientToServer.get(table.id);
        if (serverId) {
          rateTablesApi.delete(serverId).catch((err) =>
            console.error('[Persistence] rate table delete failed:', err),
          );
          ids.current.rateTableClientToServer.delete(table.id);
        }
      }

      // Updated tables (debounced)
      for (const table of curr) {
        const prev = prevTables.find((p) => p.id === table.id);
        if (!prev || prev === table) continue;

        const existing = debounceTimers.get(table.id);
        if (existing) clearTimeout(existing);

        const metaChanged = prev.name !== table.name || prev.category !== table.category || prev.notes !== table.notes;
        const columnsChanged = prev.columns !== table.columns;

        debounceTimers.set(
          table.id,
          setTimeout(async () => {
            const serverId = ids.current.rateTableClientToServer.get(table.id);
            if (!serverId) { debounceTimers.delete(table.id); return; }

            const latest = useSettingsStore.getState().rateTables.find((t) => t.id === table.id);
            if (!latest) { debounceTimers.delete(table.id); return; }

            try {
              if (metaChanged) {
                await rateTablesApi.update(serverId, {
                  name: latest.name,
                  category: latest.category,
                  notes: latest.notes,
                });
              }
              if (columnsChanged) {
                // Sync columns: detect added, removed, updated
                const prevColIds = new Set(prev.columns.map((c) => c.id));
                const currColIds = new Set(latest.columns.map((c) => c.id));

                // Added columns
                const addedCols = latest.columns.filter((c) => !prevColIds.has(c.id));
                if (addedCols.length > 0) {
                  const { data: newCols } = await rateTablesApi.addColumns(
                    serverId,
                    addedCols.map((c) => ({
                      column_key: c.columnKey,
                      column_label: c.columnLabel,
                      sort_order: c.sortOrder,
                      rates: c.rates,
                    })),
                  );
                  for (let i = 0; i < newCols.length && i < addedCols.length; i++) {
                    ids.current.rateTableColClientToServer.set(addedCols[i].id, newCols[i].id);
                  }
                }

                // Removed columns
                for (const col of prev.columns) {
                  if (currColIds.has(col.id)) continue;
                  const colServerId = ids.current.rateTableColClientToServer.get(col.id);
                  if (colServerId) {
                    await rateTablesApi.removeColumn(serverId, colServerId).catch((err) =>
                      console.error('[Persistence] rate table column delete failed:', err),
                    );
                    ids.current.rateTableColClientToServer.delete(col.id);
                  }
                }

                // Updated columns
                for (const col of latest.columns) {
                  const prevCol = prev.columns.find((c) => c.id === col.id);
                  if (!prevCol || prevCol === col) continue;
                  const colServerId = ids.current.rateTableColClientToServer.get(col.id);
                  if (colServerId) {
                    await rateTablesApi.updateColumn(serverId, colServerId, {
                      column_key: col.columnKey,
                      column_label: col.columnLabel,
                      sort_order: col.sortOrder,
                      rates: col.rates,
                    }).catch((err) =>
                      console.error('[Persistence] rate table column update failed:', err),
                    );
                  }
                }
              }
            } catch (err) {
              console.error('[Persistence] rate table update failed:', err);
            }
            debounceTimers.delete(table.id);
          }, 800),
        );
      }

      prevTables = curr;
    });

    return () => {
      unsub();
      for (const t of debounceTimers.values()) clearTimeout(t);
    };
  }, [takeoffId]);

  // ─── Upload document helper (for DropZone / drag-and-drop) ───

  const uploadDocument = useCallback(
    async (file: File) => {
      if (!takeoffId) return;

      // Load the PDF locally first (to get page count)
      const arrayBuffer = await file.arrayBuffer();
      const proxy = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

      // Upload to server
      const { data: serverDoc } = await traceoverDocumentsApi.upload(
        takeoffId,
        file,
        proxy.numPages,
      );

      // Map IDs
      const clientId = generateId();
      ids.current.docServerToClient.set(serverDoc.id, clientId);
      ids.current.docClientToServer.set(clientId, serverDoc.id);

      // Add to PDF store
      const pdfDoc: PdfDocument = {
        id: clientId,
        fileName: file.name,
        fileSize: file.size,
        pageCount: proxy.numPages,
        serverId: serverDoc.id,
        loadedAt: new Date(),
      };
      addDocumentFromProxy(pdfDoc, proxy);
    },
    [takeoffId, addDocumentFromProxy],
  );

  return { uploadDocument };
}
