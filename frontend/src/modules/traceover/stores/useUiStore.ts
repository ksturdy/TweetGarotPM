import { create } from 'zustand';
import type { Point2D } from '../types/measurement';
import type { BranchSnapResult, PipeServiceType } from '../types/piping';

interface UiState {
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: 'takeoff' | 'bom' | 'cost';
  showAiSettings: boolean;
  showPageExtractor: boolean;
  showPdfCombiner: boolean;
  showManualAdd: boolean;
  rightPanelWidth: number;
  showCalibrationDialog: boolean;
  calibrationPoints: { start: Point2D; end: Point2D } | null;
  showBranchMenu: boolean;
  branchMenuPosition: Point2D | null;
  branchSnapResult: BranchSnapResult | null;
  showTags: boolean;
  drawingGreyscale: boolean;
  drawingFade: number;
  pipeHighlight: boolean;
  pipeHighlightWidth: number;
  showPipingPalette: boolean;
  showEquipmentPalette: boolean;
  showAssemblyPalette: boolean;
  showAssemblyEditor: boolean;
  showSaveAssemblyDialog: boolean;
  showSelectionPanel: boolean;
  showSettings: boolean;
  hiddenServiceTypes: Set<PipeServiceType>;
  // Actions
  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;
  togglePipingPalette: () => void;
  toggleEquipmentPalette: () => void;
  toggleAssemblyPalette: () => void;
  setShowAssemblyEditor: (show: boolean) => void;
  setShowSaveAssemblyDialog: (show: boolean) => void;
  setShowSelectionPanel: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setRightPanelTab: (tab: 'takeoff' | 'bom' | 'cost') => void;
  setShowAiSettings: (show: boolean) => void;
  setShowPageExtractor: (show: boolean) => void;
  setShowPdfCombiner: (show: boolean) => void;
  setShowManualAdd: (show: boolean) => void;
  setRightPanelWidth: (width: number) => void;
  setShowCalibrationDialog: (show: boolean) => void;
  setCalibrationPoints: (points: { start: Point2D; end: Point2D } | null) => void;
  toggleTags: () => void;
  toggleDrawingGreyscale: () => void;
  setDrawingFade: (fade: number) => void;
  togglePipeHighlight: () => void;
  setPipeHighlightWidth: (width: number) => void;
  openBranchMenu: (position: Point2D, snapResult: BranchSnapResult) => void;
  closeBranchMenu: () => void;
  toggleServiceTypeVisibility: (serviceType: PipeServiceType) => void;
  setAllServiceTypesVisible: () => void;
  setAllServiceTypesHidden: (serviceTypes: PipeServiceType[]) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  leftSidebarOpen: true,
  rightPanelOpen: true,
  rightPanelTab: 'takeoff',
  showAiSettings: false,
  showPageExtractor: false,
  showPdfCombiner: false,
  showManualAdd: false,
  rightPanelWidth: 400,
  showCalibrationDialog: false,
  calibrationPoints: null,
  showBranchMenu: false,
  branchMenuPosition: null,
  branchSnapResult: null,
  showTags: true,
  drawingGreyscale: false,
  drawingFade: 0,
  pipeHighlight: false,
  pipeHighlightWidth: 10,
  showPipingPalette: false,
  showEquipmentPalette: false,
  showAssemblyPalette: false,
  showAssemblyEditor: false,
  showSaveAssemblyDialog: false,
  showSelectionPanel: true,
  showSettings: false,
  hiddenServiceTypes: new Set<PipeServiceType>(),

  togglePipingPalette: () =>
    set((state) => ({ showPipingPalette: !state.showPipingPalette })),

  toggleEquipmentPalette: () =>
    set((state) => ({ showEquipmentPalette: !state.showEquipmentPalette })),

  toggleAssemblyPalette: () =>
    set((state) => ({ showAssemblyPalette: !state.showAssemblyPalette })),

  setShowAssemblyEditor: (show) => set({ showAssemblyEditor: show }),
  setShowSaveAssemblyDialog: (show) => set({ showSaveAssemblyDialog: show }),
  setShowSelectionPanel: (show) => set({ showSelectionPanel: show }),
  setShowSettings: (show) => set({ showSettings: show }),

  toggleLeftSidebar: () =>
    set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  setRightPanelTab: (tab) =>
    set({ rightPanelTab: tab, rightPanelOpen: true }),

  setShowAiSettings: (show) => set({ showAiSettings: show }),
  setShowPageExtractor: (show) => set({ showPageExtractor: show }),
  setShowPdfCombiner: (show) => set({ showPdfCombiner: show }),
  setShowManualAdd: (show) => set({ showManualAdd: show }),

  setRightPanelWidth: (width) =>
    set({ rightPanelWidth: Math.max(300, Math.min(800, width)) }),

  setShowCalibrationDialog: (show) => set({ showCalibrationDialog: show }),
  setCalibrationPoints: (points) => set({ calibrationPoints: points }),

  toggleTags: () =>
    set((state) => ({ showTags: !state.showTags })),

  toggleDrawingGreyscale: () =>
    set((state) => ({ drawingGreyscale: !state.drawingGreyscale })),

  setDrawingFade: (fade) =>
    set({ drawingFade: Math.max(0, Math.min(1, fade)) }),

  togglePipeHighlight: () =>
    set((state) => ({ pipeHighlight: !state.pipeHighlight })),

  setPipeHighlightWidth: (width) =>
    set({ pipeHighlightWidth: Math.max(4, Math.min(30, width)) }),

  openBranchMenu: (position, snapResult) =>
    set({
      showBranchMenu: true,
      branchMenuPosition: position,
      branchSnapResult: snapResult,
    }),

  closeBranchMenu: () =>
    set({
      showBranchMenu: false,
      branchMenuPosition: null,
      branchSnapResult: null,
    }),

  toggleServiceTypeVisibility: (serviceType) =>
    set((state) => {
      const next = new Set(state.hiddenServiceTypes);
      if (next.has(serviceType)) next.delete(serviceType);
      else next.add(serviceType);
      return { hiddenServiceTypes: next };
    }),

  setAllServiceTypesVisible: () =>
    set({ hiddenServiceTypes: new Set() }),

  setAllServiceTypesHidden: (serviceTypes) =>
    set({ hiddenServiceTypes: new Set(serviceTypes) }),
}));
