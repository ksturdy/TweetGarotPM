export interface PageMetadata {
  name: string;
  drawingNumber: string;
  levelId: string;
  areaId: string;
  revision: string;
  alternateId: string | null;
  addendumId: string | null;
}

export interface BuildingLevel {
  id: string;
  name: string;
  sortOrder: number;
}

export interface BuildingArea {
  id: string;
  name: string;
  sortOrder: number;
}

export interface AlternateGroup {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface AddendumGroup {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}

export type PageKey = `${string}:${number}`;

export function makePageKey(documentId: string, pageNumber: number): PageKey {
  return `${documentId}:${pageNumber}`;
}

export function parsePageKey(key: PageKey): { documentId: string; pageNumber: number } {
  const lastColon = key.lastIndexOf(':');
  return {
    documentId: key.slice(0, lastColon),
    pageNumber: parseInt(key.slice(lastColon + 1), 10),
  };
}

export const DEFAULT_PAGE_METADATA: PageMetadata = {
  name: '',
  drawingNumber: '',
  levelId: '',
  areaId: '',
  revision: '',
  alternateId: null,
  addendumId: null,
};
