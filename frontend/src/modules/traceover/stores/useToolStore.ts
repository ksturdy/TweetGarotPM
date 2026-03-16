import { create } from 'zustand';
import type { ToolType, ActiveDrawing } from '../types/canvas';
import type { Point2D } from '../types/measurement';
import type { PlaceableItemDef } from '../types/placeableItem';
import type { AssemblyDefinition } from '../types/assembly';

export type SelectedItemType = 'measurement' | 'traceover_run' | 'takeoff_item' | 'assembly_instance';

export interface SelectedItem {
  id: string;
  type: SelectedItemType;
}

interface ToolState {
  activeTool: ToolType;
  activeDrawing: ActiveDrawing | null;
  measurementColor: string;
  countColor: string;
  countLabel: string;
  selectedItems: SelectedItem[];
  selectedItemId: string | null;
  selectedItemType: SelectedItemType | null;
  selectedPlaceableItem: PlaceableItemDef | null;
  selectedAssembly: AssemblyDefinition | null;
  // Actions
  setTool: (tool: ToolType) => void;
  startDrawing: (tool: ToolType, point: Point2D) => void;
  addPoint: (point: Point2D) => void;
  completeDrawing: () => void;
  cancelDrawing: () => void;
  setMeasurementColor: (color: string) => void;
  setCountColor: (color: string) => void;
  setCountLabel: (label: string) => void;
  setSelectedItem: (id: string, type: SelectedItemType) => void;
  setSelectedItems: (items: SelectedItem[]) => void;
  isItemSelected: (id: string) => boolean;
  clearSelection: () => void;
  setPlaceableItem: (item: PlaceableItemDef) => void;
  clearPlaceableItem: () => void;
  setPlaceableAssembly: (assembly: AssemblyDefinition) => void;
  clearPlaceableAssembly: () => void;
}

export const useToolStore = create<ToolState>()((set, get) => ({
  activeTool: 'select',
  activeDrawing: null,
  measurementColor: '#ef4444',
  countColor: '#3b82f6',
  countLabel: 'Item',
  selectedItems: [],
  selectedItemId: null,
  selectedItemType: null,
  selectedPlaceableItem: null,
  selectedAssembly: null,

  setTool: (tool) =>
    set({
      activeTool: tool,
      activeDrawing: null,
      selectedItems: [],
      selectedItemId: null,
      selectedItemType: null,
      selectedPlaceableItem:
        tool === 'place_piping_item' || tool === 'place_equipment'
          ? get().selectedPlaceableItem
          : null,
      selectedAssembly:
        tool === 'place_assembly' ? get().selectedAssembly : null,
    }),

  startDrawing: (tool, point) =>
    set({
      activeDrawing: {
        tool,
        points: [point],
        isComplete: false,
      },
    }),

  addPoint: (point) => {
    const { activeDrawing } = get();
    if (!activeDrawing || activeDrawing.isComplete) return;
    set({
      activeDrawing: {
        ...activeDrawing,
        points: [...activeDrawing.points, point],
      },
    });
  },

  completeDrawing: () => {
    const { activeDrawing } = get();
    if (!activeDrawing) return;
    set({
      activeDrawing: { ...activeDrawing, isComplete: true },
    });
  },

  cancelDrawing: () => set({ activeDrawing: null }),

  setMeasurementColor: (color) => set({ measurementColor: color }),
  setCountColor: (color) => set({ countColor: color }),
  setCountLabel: (label) => set({ countLabel: label }),

  setSelectedItem: (id, type) =>
    set({
      selectedItems: [{ id, type }],
      selectedItemId: id,
      selectedItemType: type,
    }),

  setSelectedItems: (items) =>
    set({
      selectedItems: items,
      selectedItemId: items.length > 0 ? items[0].id : null,
      selectedItemType: items.length > 0 ? items[0].type : null,
    }),

  isItemSelected: (id) => get().selectedItems.some((item) => item.id === id),

  clearSelection: () =>
    set({ selectedItems: [], selectedItemId: null, selectedItemType: null }),

  setPlaceableItem: (item) => {
    const toolType = item.category === 'piping_item' ? 'place_piping_item' : 'place_equipment';
    set({
      activeTool: toolType,
      selectedPlaceableItem: item,
      activeDrawing: null,
      selectedItems: [],
      selectedItemId: null,
      selectedItemType: null,
    });
  },

  clearPlaceableItem: () =>
    set({ selectedPlaceableItem: null, activeTool: 'select' }),

  setPlaceableAssembly: (assembly) =>
    set({
      activeTool: 'place_assembly',
      selectedAssembly: assembly,
      selectedPlaceableItem: null,
      activeDrawing: null,
      selectedItems: [],
      selectedItemId: null,
      selectedItemType: null,
    }),

  clearPlaceableAssembly: () =>
    set({ selectedAssembly: null, activeTool: 'select' }),
}));
