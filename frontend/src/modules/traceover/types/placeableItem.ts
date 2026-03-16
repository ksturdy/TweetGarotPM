import type { ComponentCategory, ComponentType } from './takeoff';
import type { FittingType } from './piping';

export type PlaceableItemShape = 'circle' | 'rectangle' | 'diamond';

export type PlaceableItemCategory = 'piping_item' | 'equipment';

export interface PlaceableItemDef {
  id: string;
  name: string;
  abbreviation: string;
  category: PlaceableItemCategory;
  subcategory: string;
  defaultSize?: string;
  iconType: string;
  shape: PlaceableItemShape;
  color: string;
  takeoffCategory: ComponentCategory;
  takeoffComponentType: ComponentType;
  unit: string;
  fittingType?: FittingType;
  /** When true, prompt the user for an outlet/branch size (e.g. o'lets) */
  needsOutletSize?: boolean;
}

export interface PlacedItemRenderMeta {
  shape: PlaceableItemShape;
  color: string;
  abbreviation: string;
  catalogId: string;
  rotation?: number;
  runId?: string;
  segmentId?: string;
}
