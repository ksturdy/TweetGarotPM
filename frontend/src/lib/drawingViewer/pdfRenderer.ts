import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface RenderResult {
  width: number;
  height: number;
}

/**
 * Renders a single PDF page onto an HTMLCanvasElement.
 * Returns CSS pixel dimensions (not physical pixels).
 */
export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<RenderResult> {
  if (pageNumber < 1 || pageNumber > doc.numPages) {
    throw new Error(`Page ${pageNumber} out of range (1–${doc.numPages}).`);
  }

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2D context from canvas.');
  ctx.scale(dpr, dpr);

  await page.render({ canvas, viewport } as any).promise;

  return { width: viewport.width, height: viewport.height };
}
