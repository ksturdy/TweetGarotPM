import { create } from 'zustand';
import type { ScaleCalibration, Measurement } from '../types/measurement';

interface MeasurementState {
  calibrations: Map<string, ScaleCalibration>;
  measurements: Measurement[];
  // Actions
  setCalibration: (cal: ScaleCalibration) => void;
  getCalibrationForPage: (docId: string, pageNumber: number) => ScaleCalibration | null;
  addMeasurement: (m: Measurement) => void;
  removeMeasurement: (id: string) => void;
  getMeasurementsForPage: (docId: string, pageNumber: number) => Measurement[];
  clearMeasurements: (docId: string, pageNumber: number) => void;
  restoreState: (calibrations: Map<string, ScaleCalibration>, measurements: Measurement[]) => void;
  clearAll: () => void;
}

function calibrationKey(docId: string, pageNumber: number): string {
  return `${docId}-${pageNumber}`;
}

export const useMeasurementStore = create<MeasurementState>()((set, get) => ({
  calibrations: new Map(),
  measurements: [],

  setCalibration: (cal) => {
    const key = calibrationKey(cal.documentId, cal.pageNumber);
    set({
      calibrations: new Map(get().calibrations).set(key, cal),
    });
  },

  getCalibrationForPage: (docId, pageNumber) => {
    const key = calibrationKey(docId, pageNumber);
    return get().calibrations.get(key) ?? null;
  },

  addMeasurement: (m) =>
    set({ measurements: [...get().measurements, m] }),

  removeMeasurement: (id) =>
    set({
      measurements: get().measurements.filter((m) => m.id !== id),
    }),

  getMeasurementsForPage: (docId, pageNumber) => {
    return get().measurements.filter(
      (m) => m.documentId === docId && m.pageNumber === pageNumber
    );
  },

  clearMeasurements: (docId, pageNumber) =>
    set({
      measurements: get().measurements.filter(
        (m) => !(m.documentId === docId && m.pageNumber === pageNumber)
      ),
    }),

  restoreState: (calibrations, measurements) =>
    set({ calibrations, measurements }),

  clearAll: () =>
    set({ calibrations: new Map(), measurements: [] }),
}));
