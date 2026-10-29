import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface LoadPdfResult {
  document: PDFDocumentProxy;
  pageCount: number;
}

export async function loadPdfFromUrl(url: string): Promise<LoadPdfResult> {
  const loadingTask = pdfjsLib.getDocument({
    url,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/',
    cMapPacked: true,
  });
  const document = await loadingTask.promise;
  return { document, pageCount: document.numPages };
}

export async function loadPdfFromBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<LoadPdfResult> {
  if (buffer.byteLength === 0) {
    throw new Error(`PDF buffer for "${fileName}" is empty.`);
  }
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/',
    cMapPacked: true,
  });
  const document = await loadingTask.promise;
  return { document, pageCount: document.numPages };
}
