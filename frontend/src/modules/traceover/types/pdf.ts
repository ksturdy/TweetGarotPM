export interface PdfDocument {
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  /** In Titan PM, the file is stored server-side; this may be null for API-loaded docs */
  file?: File;
  /** Server-side document ID (from traceover_documents table) */
  serverId?: number;
  loadedAt: Date;
}

export interface PdfPageMeta {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  documentId: string;
}
