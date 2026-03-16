/**
 * PDF Store — adapted for Titan PM.
 *
 * In Titan Takeoff, PDFs were loaded from browser File objects.
 * In Titan PM, PDFs are uploaded to the server and loaded from API URLs.
 * The store manages the client-side PDF rendering state (pdfjs proxies,
 * page image cache) while documents are persisted on the server.
 */

import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfDocument } from '../types/pdf';
import { generateId } from '../lib/utils/idGen';
import { usePageMetadataStore } from './usePageMetadataStore';

interface PdfState {
  documents: PdfDocument[];
  activeDocumentId: string | null;
  activePageNumber: number;
  pdfProxies: Map<string, PDFDocumentProxy>;
  pageImageCache: Map<string, HTMLImageElement>;
  isLoading: boolean;
  error: string | null;
  // Actions
  addDocumentFromProxy: (
    doc: PdfDocument,
    proxy: PDFDocumentProxy,
  ) => void;
  removeDocument: (id: string) => void;
  setActiveDocument: (id: string) => void;
  setActivePage: (pageNumber: number) => void;
  getActiveProxy: () => PDFDocumentProxy | null;
  clearError: () => void;
  restoreDocuments: (
    documents: PdfDocument[],
    proxies: Map<string, PDFDocumentProxy>,
    activeDocumentId: string | null,
    activePageNumber: number,
  ) => void;
  clearAll: () => void;
}

export const usePdfStore = create<PdfState>()((set, get) => ({
  documents: [],
  activeDocumentId: null,
  activePageNumber: 1,
  pdfProxies: new Map(),
  pageImageCache: new Map(),
  isLoading: false,
  error: null,

  addDocumentFromProxy: (doc, proxy) => {
    const id = doc.id || generateId();
    const pdfDocument: PdfDocument = { ...doc, id };

    const newProxies = new Map(get().pdfProxies);
    newProxies.set(id, proxy);

    // Extract page labels from the PDF
    try {
      proxy.getPageLabels().then((labels) => {
        if (labels) {
          const metaStore = usePageMetadataStore.getState();
          for (let i = 0; i < labels.length; i++) {
            if (labels[i]) {
              metaStore.setPageMeta(id, i + 1, { name: labels[i] });
            }
          }
        }
      }).catch(() => {
        // Ignore — some PDFs don't support page labels
      });
    } catch {
      // Ignore
    }

    set({
      documents: [...get().documents, pdfDocument],
      pdfProxies: newProxies,
      activeDocumentId: id,
      activePageNumber: 1,
      isLoading: false,
    });
  },

  removeDocument: (id) => {
    const state = get();
    const newProxies = new Map(state.pdfProxies);
    const proxy = newProxies.get(id);
    if (proxy) {
      proxy.destroy();
      newProxies.delete(id);
    }

    const newImageCache = new Map(state.pageImageCache);
    for (const key of newImageCache.keys()) {
      if (key.startsWith(`${id}-`)) {
        newImageCache.delete(key);
      }
    }

    const remainingDocs = state.documents.filter((doc) => doc.id !== id);
    const isActiveRemoved = state.activeDocumentId === id;

    usePageMetadataStore.getState().removeDocumentPages(id);

    set({
      documents: remainingDocs,
      pdfProxies: newProxies,
      pageImageCache: newImageCache,
      activeDocumentId: isActiveRemoved
        ? (remainingDocs[0]?.id ?? null)
        : state.activeDocumentId,
      activePageNumber: isActiveRemoved ? 1 : state.activePageNumber,
    });
  },

  setActiveDocument: (id) => {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc) return;
    set({ activeDocumentId: id, activePageNumber: 1 });
  },

  setActivePage: (pageNumber) => {
    const state = get();
    const activeDoc = state.documents.find((d) => d.id === state.activeDocumentId);
    if (!activeDoc) return;
    const clamped = Math.max(1, Math.min(pageNumber, activeDoc.pageCount));
    set({ activePageNumber: clamped });
  },

  getActiveProxy: () => {
    const { activeDocumentId, pdfProxies } = get();
    if (!activeDocumentId) return null;
    return pdfProxies.get(activeDocumentId) ?? null;
  },

  clearError: () => set({ error: null }),

  restoreDocuments: (documents, proxies, activeDocumentId, activePageNumber) => {
    for (const proxy of get().pdfProxies.values()) {
      proxy.destroy();
    }
    set({
      documents,
      pdfProxies: proxies,
      pageImageCache: new Map(),
      activeDocumentId,
      activePageNumber,
      isLoading: false,
      error: null,
    });
  },

  clearAll: () => {
    for (const proxy of get().pdfProxies.values()) {
      proxy.destroy();
    }
    set({
      documents: [],
      activeDocumentId: null,
      activePageNumber: 1,
      pdfProxies: new Map(),
      pageImageCache: new Map(),
      isLoading: false,
      error: null,
    });
  },
}));
