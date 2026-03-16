/**
 * Settings Store — adapted for Titan PM.
 *
 * Manages rate tables, pipe specs, services, and project systems in Zustand.
 * Data is loaded from the PostgreSQL API via `loadFromApi()` and
 * local mutations are mirrored to the API by the settings UI.
 */

import { create } from 'zustand';
import type { PipeSpec, PipingService, ProjectSystem, ServiceSizeRule, RateTable, RateTableColumn } from '../types/pipingSystem';

interface SettingsState {
  rateTables: RateTable[];
  pipeSpecs: PipeSpec[];
  services: PipingService[];
  systems: ProjectSystem[];

  // ─── Read-only lookups ───
  getRateTable: (id: string) => RateTable | undefined;
  getPipeSpec: (id: string) => PipeSpec | undefined;
  getService: (id: string) => PipingService | undefined;
  getSystem: (id: string) => ProjectSystem | undefined;

  // ─── Populate from API data ───
  loadFromApi: (data: {
    rateTables?: RateTable[];
    pipeSpecs?: PipeSpec[];
    services?: PipingService[];
    systems?: ProjectSystem[];
  }) => void;

  // ─── Rate Table CRUD ───
  addRateTable: (table: Omit<RateTable, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateRateTable: (id: string, updates: Partial<RateTable>) => void;
  removeRateTable: (id: string) => void;
  duplicateRateTable: (id: string) => string | null;
  updateRateTableColumn: (tableId: string, columnId: string, updates: Partial<RateTableColumn>) => void;
  addRateTableColumns: (tableId: string, columns: Omit<RateTableColumn, 'id'>[]) => string[];
  removeRateTableColumn: (tableId: string, columnId: string) => void;

  // ─── Pipe Spec CRUD ───
  addPipeSpec: (spec: Omit<PipeSpec, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePipeSpec: (id: string, updates: Partial<PipeSpec>) => void;
  removePipeSpec: (id: string) => void;
  duplicatePipeSpec: (id: string) => string | null;

  // ─── Service CRUD ───
  addService: (service: Omit<PipingService, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateService: (id: string, updates: Partial<PipingService>) => void;
  removeService: (id: string) => void;

  // ─── System CRUD ───
  setSystems: (systems: ProjectSystem[]) => void;
  addSystem: (system: Omit<ProjectSystem, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateSystem: (id: string, updates: Partial<ProjectSystem>) => void;
  removeSystem: (id: string) => void;

  // ─── Service size rule helpers ───
  addSizeRule: (serviceId: string, maxSizeInches: number, pipeSpecId: string) => void;
  removeSizeRule: (serviceId: string, ruleId: string) => void;
  updateSizeRule: (serviceId: string, ruleId: string, updates: Partial<ServiceSizeRule>) => void;

  // ─── Import / Export ───
  exportServicesJson: () => string;
  importServicesJson: (json: string) => { imported: number; errors: string[] };
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  rateTables: [],
  pipeSpecs: [],
  services: [],
  systems: [],

  getRateTable: (id) => get().rateTables.find((t) => t.id === id),
  getPipeSpec: (id) => get().pipeSpecs.find((s) => s.id === id),
  getService: (id) => get().services.find((s) => s.id === id),
  getSystem: (id) => get().systems.find((s) => s.id === id),

  loadFromApi: (data) => {
    set({
      ...(data.rateTables !== undefined ? { rateTables: data.rateTables } : {}),
      ...(data.pipeSpecs !== undefined ? { pipeSpecs: data.pipeSpecs } : {}),
      ...(data.services !== undefined ? { services: data.services } : {}),
      ...(data.systems !== undefined ? { systems: data.systems } : {}),
    });
  },

  // ── Rate Table CRUD ──

  addRateTable: (table) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newTable: RateTable = { ...table, id, createdAt: now, updatedAt: now };
    set({ rateTables: [...get().rateTables, newTable] });
    return id;
  },

  updateRateTable: (id, updates) => {
    set({
      rateTables: get().rateTables.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
      ),
    });
  },

  removeRateTable: (id) => {
    set({ rateTables: get().rateTables.filter((t) => t.id !== id) });
  },

  duplicateRateTable: (id) => {
    const source = get().rateTables.find((t) => t.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
    const copy: RateTable = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      columns: source.columns.map((c) => ({ ...c, id: crypto.randomUUID() })),
      createdAt: now,
      updatedAt: now,
    };
    set({ rateTables: [...get().rateTables, copy] });
    return newId;
  },

  updateRateTableColumn: (tableId, columnId, updates) => {
    set({
      rateTables: get().rateTables.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c)),
          updatedAt: new Date().toISOString(),
        };
      }),
    });
  },

  addRateTableColumns: (tableId, columns) => {
    const ids: string[] = [];
    set({
      rateTables: get().rateTables.map((t) => {
        if (t.id !== tableId) return t;
        const maxOrder = t.columns.reduce((max, c) => Math.max(max, c.sortOrder), -1);
        const newCols = columns.map((c, i) => {
          const id = crypto.randomUUID();
          ids.push(id);
          return { ...c, id, sortOrder: c.sortOrder ?? maxOrder + 1 + i };
        });
        return {
          ...t,
          columns: [...t.columns, ...newCols],
          updatedAt: new Date().toISOString(),
        };
      }),
    });
    return ids;
  },

  removeRateTableColumn: (tableId, columnId) => {
    set({
      rateTables: get().rateTables.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.filter((c) => c.id !== columnId),
          updatedAt: new Date().toISOString(),
        };
      }),
    });
  },

  // ── Pipe Spec CRUD ──

  addPipeSpec: (spec) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newSpec: PipeSpec = { ...spec, id, createdAt: now, updatedAt: now } as PipeSpec;
    set({ pipeSpecs: [...get().pipeSpecs, newSpec] });
    return id;
  },

  updatePipeSpec: (id, updates) => {
    set({
      pipeSpecs: get().pipeSpecs.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s,
      ),
    });
  },

  removePipeSpec: (id) => {
    set({ pipeSpecs: get().pipeSpecs.filter((s) => s.id !== id) });
  },

  duplicatePipeSpec: (id) => {
    const source = get().pipeSpecs.find((s) => s.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
    const copy: PipeSpec = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };
    set({ pipeSpecs: [...get().pipeSpecs, copy] });
    return newId;
  },

  // ── Service CRUD ──

  addService: (service) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newService: PipingService = { ...service, id, createdAt: now, updatedAt: now } as PipingService;
    set({ services: [...get().services, newService] });
    return id;
  },

  updateService: (id, updates) => {
    set({
      services: get().services.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s,
      ),
    });
  },

  removeService: (id) => {
    set({ services: get().services.filter((s) => s.id !== id) });
  },

  // ── System CRUD ──

  setSystems: (systems) => set({ systems }),

  addSystem: (system) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newSystem: ProjectSystem = { ...system, id, createdAt: now, updatedAt: now };
    set({ systems: [...get().systems, newSystem] });
    return id;
  },

  updateSystem: (id, updates) => {
    set({
      systems: get().systems.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s,
      ),
    });
  },

  removeSystem: (id) => {
    set({ systems: get().systems.filter((s) => s.id !== id) });
  },

  // ── Size rule mutations ──

  addSizeRule: (serviceId, maxSizeInches, pipeSpecId) => {
    set({
      services: get().services.map((s) => {
        if (s.id !== serviceId) return s;
        const rule: ServiceSizeRule = { id: crypto.randomUUID(), maxSizeInches, pipeSpecId };
        const rules = [...s.sizeRules, rule].sort((a, b) => a.maxSizeInches - b.maxSizeInches);
        return { ...s, sizeRules: rules, updatedAt: new Date().toISOString() };
      }),
    });
  },

  removeSizeRule: (serviceId, ruleId) => {
    set({
      services: get().services.map((s) => {
        if (s.id !== serviceId) return s;
        return {
          ...s,
          sizeRules: s.sizeRules.filter((r) => r.id !== ruleId),
          updatedAt: new Date().toISOString(),
        };
      }),
    });
  },

  updateSizeRule: (serviceId, ruleId, updates) => {
    set({
      services: get().services.map((s) => {
        if (s.id !== serviceId) return s;
        const rules = s.sizeRules
          .map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
          .sort((a, b) => a.maxSizeInches - b.maxSizeInches);
        return { ...s, sizeRules: rules, updatedAt: new Date().toISOString() };
      }),
    });
  },

  // ── Import / Export ──

  exportServicesJson: () => {
    const { services } = get();
    return JSON.stringify(services, null, 2);
  },

  importServicesJson: (json) => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return { imported: 0, errors: ['Expected array'] };
      const now = new Date().toISOString();
      const imported: PipingService[] = [];
      const errors: string[] = [];
      for (const item of parsed) {
        if (!item.name) {
          errors.push('Service missing name, skipped');
          continue;
        }
        imported.push({
          ...item,
          id: item.id || crypto.randomUUID(),
          sizeRules: item.sizeRules || [],
          createdAt: item.createdAt || now,
          updatedAt: now,
        });
      }
      set({ services: [...get().services, ...imported] });
      return { imported: imported.length, errors };
    } catch {
      return { imported: 0, errors: ['Invalid JSON'] };
    }
  },
}));
