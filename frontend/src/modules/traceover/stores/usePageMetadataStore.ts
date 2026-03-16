import { create } from 'zustand';
import type {
  PageMetadata,
  BuildingLevel,
  BuildingArea,
  AlternateGroup,
  AddendumGroup,
  PageKey,
} from '../types/pageMetadata';
import { makePageKey, parsePageKey, DEFAULT_PAGE_METADATA } from '../types/pageMetadata';
import { generateId } from '../lib/utils/idGen';

interface PageMetadataState {
  pages: Map<PageKey, PageMetadata>;
  levels: BuildingLevel[];
  areas: BuildingArea[];
  alternates: AlternateGroup[];
  addenda: AddendumGroup[];

  // Page metadata actions
  getPageMeta: (documentId: string, pageNumber: number) => PageMetadata;
  setPageMeta: (documentId: string, pageNumber: number, updates: Partial<PageMetadata>) => void;
  removeDocumentPages: (documentId: string) => void;

  // Level actions
  addLevel: (name: string) => string;
  updateLevel: (id: string, updates: Partial<Omit<BuildingLevel, 'id'>>) => void;
  removeLevel: (id: string) => void;

  // Area actions
  addArea: (name: string) => string;
  updateArea: (id: string, updates: Partial<Omit<BuildingArea, 'id'>>) => void;
  removeArea: (id: string) => void;

  // Alternate actions
  addAlternate: (name: string, description?: string) => string;
  updateAlternate: (id: string, updates: Partial<Omit<AlternateGroup, 'id'>>) => void;
  removeAlternate: (id: string) => void;

  // Addendum actions
  addAddendum: (name: string, description?: string) => string;
  updateAddendum: (id: string, updates: Partial<Omit<AddendumGroup, 'id'>>) => void;
  removeAddendum: (id: string) => void;

  // Bulk restore / clear
  restoreState: (data: {
    pages: Map<PageKey, PageMetadata>;
    levels: BuildingLevel[];
    areas: BuildingArea[];
    alternates: AlternateGroup[];
    addenda: AddendumGroup[];
  }) => void;
  clearAll: () => void;
}

export const usePageMetadataStore = create<PageMetadataState>()((set, get) => ({
  pages: new Map(),
  levels: [],
  areas: [],
  alternates: [],
  addenda: [],

  getPageMeta: (documentId, pageNumber) => {
    const key = makePageKey(documentId, pageNumber);
    return get().pages.get(key) ?? { ...DEFAULT_PAGE_METADATA };
  },

  setPageMeta: (documentId, pageNumber, updates) => {
    const key = makePageKey(documentId, pageNumber);
    const current = get().pages.get(key) ?? { ...DEFAULT_PAGE_METADATA };
    const updated = { ...current, ...updates };
    const newPages = new Map(get().pages);
    newPages.set(key, updated);
    set({ pages: newPages });
  },

  removeDocumentPages: (documentId) => {
    const newPages = new Map(get().pages);
    for (const key of newPages.keys()) {
      const parsed = parsePageKey(key);
      if (parsed.documentId === documentId) {
        newPages.delete(key);
      }
    }
    set({ pages: newPages });
  },

  addLevel: (name) => {
    const id = generateId();
    const levels = get().levels;
    const sortOrder = levels.length > 0 ? Math.max(...levels.map((l) => l.sortOrder)) + 1 : 0;
    set({ levels: [...levels, { id, name, sortOrder }] });
    return id;
  },

  updateLevel: (id, updates) => {
    set({ levels: get().levels.map((l) => (l.id === id ? { ...l, ...updates } : l)) });
  },

  removeLevel: (id) => {
    set({ levels: get().levels.filter((l) => l.id !== id) });
    const newPages = new Map(get().pages);
    let changed = false;
    for (const [key, meta] of newPages) {
      if (meta.levelId === id) {
        newPages.set(key, { ...meta, levelId: '' });
        changed = true;
      }
    }
    if (changed) set({ pages: newPages });
  },

  addArea: (name) => {
    const id = generateId();
    const areas = get().areas;
    const sortOrder = areas.length > 0 ? Math.max(...areas.map((a) => a.sortOrder)) + 1 : 0;
    set({ areas: [...areas, { id, name, sortOrder }] });
    return id;
  },

  updateArea: (id, updates) => {
    set({ areas: get().areas.map((a) => (a.id === id ? { ...a, ...updates } : a)) });
  },

  removeArea: (id) => {
    set({ areas: get().areas.filter((a) => a.id !== id) });
    const newPages = new Map(get().pages);
    let changed = false;
    for (const [key, meta] of newPages) {
      if (meta.areaId === id) {
        newPages.set(key, { ...meta, areaId: '' });
        changed = true;
      }
    }
    if (changed) set({ pages: newPages });
  },

  addAlternate: (name, description = '') => {
    const id = generateId();
    const alternates = get().alternates;
    const sortOrder = alternates.length > 0 ? Math.max(...alternates.map((a) => a.sortOrder)) + 1 : 0;
    set({ alternates: [...alternates, { id, name, description, sortOrder }] });
    return id;
  },

  updateAlternate: (id, updates) => {
    set({ alternates: get().alternates.map((a) => (a.id === id ? { ...a, ...updates } : a)) });
  },

  removeAlternate: (id) => {
    set({ alternates: get().alternates.filter((a) => a.id !== id) });
    const newPages = new Map(get().pages);
    let changed = false;
    for (const [key, meta] of newPages) {
      if (meta.alternateId === id) {
        newPages.set(key, { ...meta, alternateId: null });
        changed = true;
      }
    }
    if (changed) set({ pages: newPages });
  },

  addAddendum: (name, description = '') => {
    const id = generateId();
    const addenda = get().addenda;
    const sortOrder = addenda.length > 0 ? Math.max(...addenda.map((a) => a.sortOrder)) + 1 : 0;
    set({ addenda: [...addenda, { id, name, description, sortOrder }] });
    return id;
  },

  updateAddendum: (id, updates) => {
    set({ addenda: get().addenda.map((a) => (a.id === id ? { ...a, ...updates } : a)) });
  },

  removeAddendum: (id) => {
    set({ addenda: get().addenda.filter((a) => a.id !== id) });
    const newPages = new Map(get().pages);
    let changed = false;
    for (const [key, meta] of newPages) {
      if (meta.addendumId === id) {
        newPages.set(key, { ...meta, addendumId: null });
        changed = true;
      }
    }
    if (changed) set({ pages: newPages });
  },

  restoreState: (data) => {
    set({
      pages: data.pages,
      levels: data.levels,
      areas: data.areas,
      alternates: data.alternates,
      addenda: data.addenda,
    });
  },

  clearAll: () => {
    set({
      pages: new Map(),
      levels: [],
      areas: [],
      alternates: [],
      addenda: [],
    });
  },
}));
