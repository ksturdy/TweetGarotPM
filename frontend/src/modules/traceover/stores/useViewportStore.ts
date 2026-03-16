import { create } from 'zustand';

interface ViewportState {
  scale: number;
  x: number;
  y: number;
  cursorX: number;
  cursorY: number;
  setViewport: (v: { scale: number; x: number; y: number }) => void;
  setCursor: (x: number, y: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_FACTOR = 1.2;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export const useViewportStore = create<ViewportState>()((set) => ({
  scale: 1,
  x: 0,
  y: 0,
  cursorX: 0,
  cursorY: 0,

  setViewport: (v) =>
    set({
      scale: clampScale(v.scale),
      x: v.x,
      y: v.y,
    }),

  setCursor: (x, y) =>
    set({ cursorX: x, cursorY: y }),

  zoomIn: () =>
    set((state) => ({ scale: clampScale(state.scale * ZOOM_FACTOR) })),

  zoomOut: () =>
    set((state) => ({ scale: clampScale(state.scale / ZOOM_FACTOR) })),

  resetZoom: () =>
    set({ scale: 1, x: 0, y: 0 }),
}));
