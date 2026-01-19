import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ContractRiskFinding } from '../../services/contractReviews';
import './ContractViewerNew.css';

// Configure PDF.js worker - use local worker file for better reliability
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface ContractViewerProps {
  fileUrl: string;
  selectedFinding?: ContractRiskFinding | null;
}

const ContractViewerNew: React.FC<ContractViewerProps> = ({
  fileUrl,
  selectedFinding,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchingText, setSearchingText] = useState<boolean>(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Fetch PDF with authentication
  useEffect(() => {
    const fetchPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        console.log('[ContractViewer] Fetching PDF from:', fileUrl);
        console.log('[ContractViewer] Token exists:', !!token, 'Token length:', token?.length);
        if (token) {
          console.log('[ContractViewer] Token preview:', token.substring(0, 20) + '...');
        }

        const response = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log('[ContractViewer] PDF blob received, size:', blob.size, 'type:', blob.type);

        const arrayBuffer = await blob.arrayBuffer();
        setPdfData(arrayBuffer);
        setLoading(false);
      } catch (err: any) {
        console.error('[ContractViewer] Error fetching PDF:', err);
        setError(err.message || 'Failed to load PDF');
        setLoading(false);
      }
    };

    fetchPDF();
  }, [fileUrl]);

  // Handle document load success
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log('[ContractViewer] PDF loaded successfully, pages:', numPages);
    setNumPages(numPages);
    setError(null);
  }, []);

  // Handle document load error
  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('[ContractViewer] PDF.js load error:', error);
    setError(`Failed to load PDF: ${error.message}`);
  }, []);

  // Navigate to finding when selected
  useEffect(() => {
    if (!selectedFinding) return;

    console.log('[ContractViewer] Selected finding:', selectedFinding);

    // If finding has page_number, navigate to that page
    if (selectedFinding.page_number && selectedFinding.page_number > 0) {
      console.log('[ContractViewer] Navigating to page:', selectedFinding.page_number);
      setPageNumber(selectedFinding.page_number);

      // If there's quoted text, try to highlight it after page loads
      if (selectedFinding.quoted_text) {
        setSearchingText(true);

        // Wait for page to render, then search for text
        setTimeout(() => {
          highlightTextInPage(selectedFinding.quoted_text!);
          setSearchingText(false);
        }, 1500);
      }
    } else if (selectedFinding.quoted_text) {
      // No page number, but we have quoted text - search through pages
      console.log('[ContractViewer] No page number, searching for text:', selectedFinding.quoted_text);
      searchForText(selectedFinding.quoted_text);
    }
  }, [selectedFinding]);

  // Search for text across all pages
  const searchForText = async (searchText: string) => {
    if (!searchText || numPages === 0) return;

    setSearchingText(true);
    const normalizedSearch = searchText.toLowerCase().trim();

    // Try each page
    for (let page = 1; page <= numPages; page++) {
      setPageNumber(page);

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 800));

      // Search in current page
      const found = highlightTextInPage(searchText);
      if (found) {
        console.log('[ContractViewer] Text found on page:', page);
        setSearchingText(false);
        return;
      }
    }

    console.log('[ContractViewer] Text not found in any page');
    setSearchingText(false);
    setPageNumber(1); // Reset to first page if not found
  };

  // Highlight text in current page
  const highlightTextInPage = (searchText: string): boolean => {
    const textLayer = document.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) {
      console.log('[ContractViewer] Text layer not found');
      return false;
    }

    const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[];
    const normalizedSearch = searchText.toLowerCase().trim();

    console.log('[ContractViewer] Searching for text in', spans.length, 'spans');

    // Clear previous highlights
    spans.forEach(span => {
      span.style.backgroundColor = '';
      span.style.border = '';
      span.style.padding = '';
    });

    // Search for text
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const spanText = span.textContent?.toLowerCase() || '';

      // Check if this span contains the search text
      if (spanText.includes(normalizedSearch)) {
        console.log('[ContractViewer] Found exact match in span:', i);
        highlightSpan(span);
        return true;
      }

      // Check multi-span match (text split across spans)
      let combinedText = spanText;
      let endIndex = i;
      const spansToHighlight: HTMLElement[] = [span];

      // Look ahead up to 15 spans
      while (endIndex < Math.min(i + 15, spans.length - 1)) {
        endIndex++;
        const nextSpan = spans[endIndex];
        const nextText = nextSpan.textContent?.toLowerCase() || '';
        combinedText += ' ' + nextText;
        spansToHighlight.push(nextSpan);

        if (combinedText.includes(normalizedSearch)) {
          console.log('[ContractViewer] Found multi-span match from span', i, 'to', endIndex);
          spansToHighlight.forEach(s => highlightSpan(s));
          return true;
        }

        // Stop if combined text is much longer than search text
        if (combinedText.length > normalizedSearch.length * 3) {
          break;
        }
      }
    }

    // Try fuzzy match (partial word boundaries)
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const spanText = span.textContent?.toLowerCase() || '';

      // Try to find key words from the search text
      const searchWords = normalizedSearch.split(' ').filter(w => w.length > 3);
      if (searchWords.length > 0) {
        const firstWord = searchWords[0];

        if (spanText.includes(firstWord)) {
          console.log('[ContractViewer] Found fuzzy match in span:', i);
          highlightSpan(span);
          return true;
        }
      }
    }

    console.log('[ContractViewer] Text not found in current page');
    return false;
  };

  // Highlight a span and scroll to it
  const highlightSpan = (span: HTMLElement) => {
    span.style.backgroundColor = '#ffeb3b';
    span.style.border = '2px solid #ffc107';
    span.style.padding = '2px 4px';
    span.style.borderRadius = '3px';
    span.style.transition = 'background-color 0.3s';

    // Scroll to the span
    span.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    // Remove highlight after 5 seconds
    setTimeout(() => {
      span.style.backgroundColor = '#fff9c4';
      span.style.border = '1px solid #fdd835';
    }, 3000);
  };

  // Page navigation
  const previousPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const nextPage = () => {
    setPageNumber(prev => Math.min(numPages, prev + 1));
  };

  const goToPage = (page: number) => {
    setPageNumber(Math.max(1, Math.min(numPages, page)));
  };

  // Zoom controls
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.2);

  if (loading) {
    return (
      <div className="contract-viewer-new">
        <div className="viewer-loading">
          <div className="spinner"></div>
          <p>Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="contract-viewer-new">
        <div className="viewer-error">
          <div className="error-icon">⚠️</div>
          <h3>Failed to Load PDF</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="contract-viewer-new">
      {/* Toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-group">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="toolbar-btn"
            title="Previous page"
          >
            ◀
          </button>

          <div className="page-controls">
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (!isNaN(page)) goToPage(page);
              }}
              className="page-input"
            />
            <span className="page-separator">/</span>
            <span className="total-pages">{numPages}</span>
          </div>

          <button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className="toolbar-btn"
            title="Next page"
          >
            ▶
          </button>
        </div>

        <div className="toolbar-group">
          <button onClick={zoomOut} disabled={scale <= 0.5} className="toolbar-btn" title="Zoom out">
            −
          </button>
          <button onClick={resetZoom} className="toolbar-btn zoom-indicator" title="Reset zoom">
            {Math.round(scale * 100)}%
          </button>
          <button onClick={zoomIn} disabled={scale >= 3.0} className="toolbar-btn" title="Zoom in">
            +
          </button>
        </div>

        {searchingText && (
          <div className="toolbar-status">
            <div className="searching-indicator">
              <div className="spinner-small"></div>
              <span>Searching for text...</span>
            </div>
          </div>
        )}
      </div>

      {/* PDF Document */}
      <div className="pdf-viewer-container" ref={pageContainerRef}>
        {pdfData && (
          <Document
            file={pdfData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading document...</p>
              </div>
            }
            error={
              <div className="page-error">
                <p>Failed to load document</p>
              </div>
            }
          >
            <Page
              key={`page_${pageNumber}`}
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div className="page-loading">
                  <div className="spinner"></div>
                  <p>Loading page {pageNumber}...</p>
                </div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  );
};

export default ContractViewerNew;
