import React from 'react';
import type Konva from 'konva';
import { PDFDocument } from 'pdf-lib';

export async function exportDrawingToPdf(
  stageRef: React.MutableRefObject<Konva.Stage | null>,
  originalPdfUrl: string,
  pageNumber: number,
  drawingTitle: string
): Promise<void> {
  const stage = stageRef.current;
  if (!stage) return;

  // Render the Konva stage to a PNG (pixelRatio 2 for retina quality)
  const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });

  try {
    // Fetch original PDF
    const pdfBytes = await fetch(originalPdfUrl).then(r => r.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[pageNumber - 1];
    if (!page) throw new Error('Page not found');

    // Embed the annotated PNG as overlay
    const pngData = dataUrl.split(',')[1];
    const pngBytes = Uint8Array.from(atob(pngData), c => c.charCodeAt(0));
    const pngImage = await pdfDoc.embedPng(pngBytes);

    const { width, height } = page.getSize();
    page.drawImage(pngImage, {
      x: 0, y: 0,
      width, height,
      opacity: 1,
    });

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${drawingTitle.replace(/[^a-zA-Z0-9\-_]/g, '_')}_annotated.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    // Fallback: just download the PNG
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${drawingTitle.replace(/[^a-zA-Z0-9\-_]/g, '_')}_annotated.png`;
    a.click();
  }
}
