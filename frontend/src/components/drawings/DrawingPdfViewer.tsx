import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import api from '../../services/api';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface DrawingPdfViewerProps {
  drawingId: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onDocumentLoaded?: (numPages: number) => void;
}

const DrawingPdfViewer: React.FC<DrawingPdfViewerProps> = ({
  drawingId,
  initialPage = 1,
  onPageChange,
  onDocumentLoaded,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync page when initialPage prop changes
  useEffect(() => {
    if (initialPage > 0 && initialPage !== pageNumber) {
      setPageNumber(initialPage);
    }
  }, [initialPage]);

  // Fetch PDF with authentication
  useEffect(() => {
    const fetchPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/drawings/${drawingId}/download`, {
          responseType: 'arraybuffer',
        });
        setPdfData(response.data);
        setLoading(false);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('PDF file not found.');
        } else {
          setError(err.response?.data?.error || err.message || 'Failed to load PDF');
        }
        setLoading(false);
      }
    };
    fetchPDF();
  }, [drawingId]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
    onDocumentLoaded?.(numPages);
  }, [onDocumentLoaded]);

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(`Failed to load PDF: ${error.message}`);
  }, []);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(numPages, page));
    setPageNumber(clamped);
    onPageChange?.(clamped);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 4.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.3));
  const resetZoom = () => setScale(1.0);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.5rem 0.75rem', background: '#fff', borderBottom: '1px solid #e5e7eb',
        flexShrink: 0, gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => goToPage(pageNumber - 1)}
            disabled={pageNumber <= 1}
            className="btn btn-secondary btn-sm"
            title="Previous page"
          >
            &lt;
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (!isNaN(page)) goToPage(page);
              }}
              style={{
                width: 50, padding: '0.25rem', border: '1px solid #d1d5db',
                borderRadius: 4, textAlign: 'center', fontSize: '0.875rem',
              }}
            />
            <span style={{ color: '#9ca3af' }}>/</span>
            <span style={{ color: '#6b7280' }}>{numPages}</span>
          </div>
          <button
            onClick={() => goToPage(pageNumber + 1)}
            disabled={pageNumber >= numPages}
            className="btn btn-secondary btn-sm"
            title="Next page"
          >
            &gt;
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button onClick={zoomOut} disabled={scale <= 0.3} className="btn btn-secondary btn-sm">-</button>
          <button onClick={resetZoom} className="btn btn-secondary btn-sm" style={{ minWidth: 50, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </button>
          <button onClick={zoomIn} disabled={scale >= 4.0} className="btn btn-secondary btn-sm">+</button>
        </div>
      </div>

      {/* PDF content */}
      <div
        ref={containerRef}
        style={{
          flex: 1, overflow: 'auto', background: '#525252',
          display: 'flex', justifyContent: 'center', padding: '1rem',
          minHeight: 0,
        }}
      >
        {pdfData && (
          <Document
            file={pdfData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>Loading document...</div>
            }
          >
            <Page
              key={`page_${pageNumber}`}
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={
                <div style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>Loading page {pageNumber}...</div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  );
};

export default DrawingPdfViewer;
