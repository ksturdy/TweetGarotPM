/**
 * Assembly Store — adapted for Titan PM.
 *
 * In Titan Takeoff, assembly templates were persisted in localStorage.
 * In Titan PM, templates are stored in PostgreSQL via the assembly API.
 *
 * This store manages the client-side state (templates loaded from API,
 * instances for the current takeoff). Template CRUD should also call
 * the API service; this store provides the immediate UI state.
 */

import { create } from 'zustand';
import type { AssemblyDefinition, AssemblyInstance } from '../types/assembly';
import type { Point2D } from '../types/measurement';
import { generateId } from '../lib/utils/idGen';
import { useTraceoverStore } from './useTraceoverStore';
import { useTakeoffStore } from './useTakeoffStore';

interface AssemblyState {
  // Template library (loaded from API)
  assemblies: AssemblyDefinition[];

  addAssembly: (def: Omit<AssemblyDefinition, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateAssembly: (id: string, updates: Partial<AssemblyDefinition>) => void;
  removeAssembly: (id: string) => void;
  duplicateAssembly: (id: string) => string | null;
  getAssembly: (id: string) => AssemblyDefinition | undefined;
  loadAssemblies: (assemblies: AssemblyDefinition[]) => void;

  // Placed instances (per-takeoff)
  instances: AssemblyInstance[];

  addInstance: (instance: AssemblyInstance) => void;
  removeInstance: (id: string) => void;
  moveInstance: (id: string, delta: Point2D) => void;
  explodeInstance: (id: string) => void;
  getInstancesForPage: (docId: string, pageNumber: number) => AssemblyInstance[];
  getInstanceForItem: (itemId: string) => AssemblyInstance | undefined;
  getInstanceForRun: (runId: string) => AssemblyInstance | undefined;

  // Persistence
  restoreInstances: (instances: AssemblyInstance[]) => void;
  clearInstances: () => void;
}

export const useAssemblyStore = create<AssemblyState>()((set, get) => ({
  assemblies: [],
  instances: [],

  // Template actions

  addAssembly: (def) => {
    const id = generateId();
    const now = new Date().toISOString();
    const assembly: AssemblyDefinition = { ...def, id, createdAt: now, updatedAt: now };
    set((state) => ({ assemblies: [...state.assemblies, assembly] }));
    return id;
  },

  updateAssembly: (id, updates) => {
    set((state) => ({
      assemblies: state.assemblies.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a,
      ),
    }));
  },

  removeAssembly: (id) => {
    set((state) => ({ assemblies: state.assemblies.filter((a) => a.id !== id) }));
  },

  duplicateAssembly: (id) => {
    const original = get().assemblies.find((a) => a.id === id);
    if (!original) return null;
    const newId = generateId();
    const now = new Date().toISOString();
    const copy: AssemblyDefinition = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ assemblies: [...state.assemblies, copy] }));
    return newId;
  },

  getAssembly: (id) => get().assemblies.find((a) => a.id === id),

  loadAssemblies: (assemblies) => set({ assemblies }),

  // Instance actions

  addInstance: (instance) => {
    set((state) => ({ instances: [...state.instances, instance] }));
  },

  removeInstance: (id) => {
    const instance = get().instances.find((i) => i.id === id);
    if (!instance) return;

    const traceoverStore = useTraceoverStore.getState();
    for (const runId of instance.runIds) {
      traceoverStore.removeRun(runId);
    }

    const takeoffStore = useTakeoffStore.getState();
    for (const itemId of instance.itemIds) {
      takeoffStore.removeItem(itemId);
    }

    set((state) => ({ instances: state.instances.filter((i) => i.id !== id) }));
  },

  moveInstance: (id, delta) => {
    const instance = get().instances.find((i) => i.id === id);
    if (!instance) return;

    const traceoverStore = useTraceoverStore.getState();
    const updatedRuns = traceoverStore.runs.map((run) => {
      if (!instance.runIds.includes(run.id)) return run;
      return {
        ...run,
        segments: run.segments.map((seg) => ({
          ...seg,
          startPoint: { x: seg.startPoint.x + delta.x, y: seg.startPoint.y + delta.y },
          endPoint: { x: seg.endPoint.x + delta.x, y: seg.endPoint.y + delta.y },
        })),
        branches: run.branches.map((b) => ({
          ...b,
          connectionPoint: {
            x: b.connectionPoint.x + delta.x,
            y: b.connectionPoint.y + delta.y,
          },
        })),
        updatedAt: new Date(),
      };
    });
    traceoverStore.restoreState(updatedRuns);

    const takeoffStore = useTakeoffStore.getState();
    for (const itemId of instance.itemIds) {
      const item = takeoffStore.items.find((i) => i.id === itemId);
      if (item?.centerPoint) {
        takeoffStore.updateItem(itemId, {
          centerPoint: {
            x: item.centerPoint.x + delta.x,
            y: item.centerPoint.y + delta.y,
          },
          boundingBox: item.boundingBox
            ? {
                ...item.boundingBox,
                x: item.boundingBox.x + delta.x,
                y: item.boundingBox.y + delta.y,
              }
            : undefined,
        });
      }
    }

    set((state) => ({
      instances: state.instances.map((i) =>
        i.id === id
          ? {
              ...i,
              origin: { x: i.origin.x + delta.x, y: i.origin.y + delta.y },
              updatedAt: new Date().toISOString(),
            }
          : i,
      ),
    }));
  },

  explodeInstance: (id) => {
    set((state) => ({ instances: state.instances.filter((i) => i.id !== id) }));
  },

  getInstancesForPage: (docId, pageNumber) =>
    get().instances.filter((i) => i.documentId === docId && i.pageNumber === pageNumber),

  getInstanceForItem: (itemId) =>
    get().instances.find((i) => i.itemIds.includes(itemId)),

  getInstanceForRun: (runId) =>
    get().instances.find((i) => i.runIds.includes(runId)),

  restoreInstances: (instances) => set({ instances }),
  clearInstances: () => set({ instances: [] }),
}));
