import { create } from 'zustand';
import type { TakeoffItem } from '../types/takeoff';
import type { AiAnalysisStatus } from '../types/ai';
import { generateId } from '../lib/utils/idGen';

interface TakeoffState {
  items: TakeoffItem[];
  analysisStatus: Map<string, AiAnalysisStatus>;
  analysisErrors: Map<string, string>;
  placementUndoStack: string[];
  // Actions
  addItems: (items: TakeoffItem[]) => void;
  addManualItem: (item: Omit<TakeoffItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  undoLastPlacement: () => boolean;
  updateItem: (id: string, updates: Partial<TakeoffItem>) => void;
  updateItems: (ids: string[], updates: Partial<TakeoffItem>) => void;
  removeItem: (id: string) => void;
  verifyItem: (id: string) => void;
  getItemsForPage: (docId: string, pageNumber: number) => TakeoffItem[];
  setAnalysisStatus: (docId: string, pageNumber: number, status: AiAnalysisStatus) => void;
  setAnalysisError: (docId: string, pageNumber: number, error: string) => void;
  replaceItem: (targetId: string, newItems: TakeoffItem[]) => void;
  replaceRunItems: (runId: string, newItems: TakeoffItem[]) => void;
  clearPageItems: (docId: string, pageNumber: number) => void;
  restoreState: (items: TakeoffItem[], analysisStatus: Map<string, AiAnalysisStatus>, analysisErrors: Map<string, string>) => void;
  clearAll: () => void;
}

function pageKey(docId: string, pageNumber: number): string {
  return `${docId}-${pageNumber}`;
}

export const useTakeoffStore = create<TakeoffState>()((set, get) => ({
  items: [],
  analysisStatus: new Map(),
  analysisErrors: new Map(),
  placementUndoStack: [],

  addItems: (items) =>
    set({ items: [...get().items, ...items] }),

  addManualItem: (item) => {
    const now = new Date();
    const newItem: TakeoffItem = {
      ...item,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const isPlacedCatalogItem = item.source === 'manual' && item.userNotes?.startsWith('{');
    set({
      items: [...get().items, newItem],
      placementUndoStack: isPlacedCatalogItem
        ? [...get().placementUndoStack, newItem.id]
        : get().placementUndoStack,
    });
  },

  undoLastPlacement: () => {
    const stack = get().placementUndoStack;
    if (stack.length === 0) return false;
    const lastId = stack[stack.length - 1];
    set({
      items: get().items.filter((item) => item.id !== lastId),
      placementUndoStack: stack.slice(0, -1),
    });
    return true;
  },

  updateItem: (id, updates) =>
    set({
      items: get().items.map((item) =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date() }
          : item
      ),
    }),

  updateItems: (ids, updates) => {
    const idSet = new Set(ids);
    const now = new Date();
    set({
      items: get().items.map((item) =>
        idSet.has(item.id)
          ? { ...item, ...updates, updatedAt: now }
          : item
      ),
    });
  },

  removeItem: (id) =>
    set({ items: get().items.filter((item) => item.id !== id) }),

  replaceItem: (targetId, newItems) => {
    const items = get().items;
    const idx = items.findIndex((i) => i.id === targetId);
    if (idx === -1) return;
    set({ items: [...items.slice(0, idx), ...newItems, ...items.slice(idx + 1)] });
  },

  verifyItem: (id) =>
    set({
      items: get().items.map((item) =>
        item.id === id
          ? { ...item, verified: true, updatedAt: new Date() }
          : item
      ),
    }),

  getItemsForPage: (docId, pageNumber) => {
    return get().items.filter(
      (item) => item.documentId === docId && item.pageNumber === pageNumber
    );
  },

  setAnalysisStatus: (docId, pageNumber, status) => {
    const key = pageKey(docId, pageNumber);
    set({
      analysisStatus: new Map(get().analysisStatus).set(key, status),
    });
  },

  setAnalysisError: (docId, pageNumber, error) => {
    const key = pageKey(docId, pageNumber);
    const newStatus = new Map(get().analysisStatus).set(key, 'error' as AiAnalysisStatus);
    const newErrors = new Map(get().analysisErrors).set(key, error);
    set({
      analysisStatus: newStatus,
      analysisErrors: newErrors,
    });
  },

  replaceRunItems: (runId, newItems) =>
    set({
      items: [
        ...get().items.filter((item) => item.traceoverRunId !== runId),
        ...newItems,
      ],
    }),

  clearPageItems: (docId, pageNumber) =>
    set({
      items: get().items.filter(
        (item) => !(item.documentId === docId && item.pageNumber === pageNumber)
      ),
    }),

  restoreState: (items, analysisStatus, analysisErrors) =>
    set({ items, analysisStatus, analysisErrors }),

  clearAll: () =>
    set({ items: [], analysisStatus: new Map(), analysisErrors: new Map() }),
}));
