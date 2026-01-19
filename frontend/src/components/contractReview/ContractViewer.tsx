import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ContractRiskFinding, ContractAnnotation } from '../../services/contractReviews';
import './ContractViewer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface ContractViewerProps {
  fileUrl: string;
  selectedFinding?: ContractRiskFinding | null;
  annotations: ContractAnnotation[];
  onAddAnnotation: (annotation: Partial<ContractAnnotation>) => void;
  onUpdateAnnotation: (annotationId: number, data: Partial<ContractAnnotation>) => void;
  onDeleteAnnotation: (annotationId: number) => void;
}

type AnnotationTool = 'none' | 'strikethrough' | 'comment' | 'highlight' | 'note';

const ContractViewer: React.FC<ContractViewerProps> = ({
  fileUrl,
  selectedFinding,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('none');
  const [selectedText, setSelectedText] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [showCommentDialog, setShowCommentDialog] = useState<boolean>(false);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  // Fetch PDF with authentication
  useEffect(() => {
    const fetchPDF = async () => {
      try {
        console.log('Fetching PDF from:', fileUrl);
        const response = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        console.log('Blob type:', blob.type, 'Size:', blob.size);
        const arrayBuffer = await blob.arrayBuffer();
        console.log('ArrayBuffer size:', arrayBuffer.byteLength);
        setPdfData(arrayBuffer);
      } catch (error) {
        console.error('Error fetching PDF:', error);
      }
    };
    fetchPDF();
  }, [fileUrl]);

  // Scroll to selected finding
  useEffect(() => {
    if (selectedFinding && selectedFinding.page_number) {
      console.log('Selected finding:', selectedFinding);
      console.log('Setting page to:', selectedFinding.page_number);
      setPageNumber(selectedFinding.page_number);

      // After page loads, try to find and scroll to the quoted text
      setTimeout(() => {
        if (selectedFinding.quoted_text) {
          console.log('Searching for text:', selectedFinding.quoted_text);
          // Find all text layer spans
          const textLayer = document.querySelector('.react-pdf__Page__textContent');
          console.log('Text layer found:', !!textLayer);

          if (textLayer) {
            const spans = Array.from(textLayer.querySelectorAll('span'));
            console.log('Number of text spans:', spans.length);

            // Search for the quoted text across spans
            const searchText = selectedFinding.quoted_text.toLowerCase().trim();
            let foundIndex = -1;

            for (let i = 0; i < spans.length; i++) {
              const spanText = spans[i].textContent?.toLowerCase() || '';

              // Check if this span or a combination of consecutive spans contains the search text
              let combinedText = spanText;
              let endIndex = i;

              // Look ahead up to 10 spans to find the text
              while (combinedText.length < searchText.length + 50 && endIndex < spans.length - 1 && endIndex - i < 10) {
                endIndex++;
                combinedText += ' ' + (spans[endIndex].textContent?.toLowerCase() || '');
              }

              if (combinedText.includes(searchText)) {
                foundIndex = i;
                console.log('Found text at span index:', foundIndex);
                break;
              }
            }

            // Scroll to the found text
            if (foundIndex >= 0) {
              const targetSpan = spans[foundIndex] as HTMLElement;
              targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });

              // Highlight the found text temporarily
              targetSpan.style.backgroundColor = 'yellow';
              targetSpan.style.transition = 'background-color 0.3s';

              setTimeout(() => {
                targetSpan.style.backgroundColor = '';
              }, 3000);
            } else {
              console.log('Text not found in spans');
            }
          }
        }
      }, 1000); // Increased delay to ensure page is fully rendered
    }
  }, [selectedFinding]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF loaded successfully, pages:', numPages);
    setNumPages(numPages);
    // Reset to page 1 if no finding is selected
    if (!selectedFinding) {
      setPageNumber(1);
    }
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF.js load error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      setSelectedText(selection.toString());

      if (activeTool === 'strikethrough') {
        handleStrikethrough(selection.toString());
      } else if (activeTool === 'highlight') {
        handleHighlight(selection.toString());
      } else if (activeTool === 'comment') {
        setShowCommentDialog(true);
      }
    }
  };

  const handleStrikethrough = (text: string) => {
    onAddAnnotation({
      annotation_type: 'strikethrough',
      page_number: pageNumber,
      quoted_text: text,
      color: 'red',
    });
    setActiveTool('none');
  };

  const handleHighlight = (text: string) => {
    onAddAnnotation({
      annotation_type: 'highlight',
      page_number: pageNumber,
      quoted_text: text,
      color: 'yellow',
    });
    setActiveTool('none');
  };

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddAnnotation({
        annotation_type: 'comment',
        page_number: pageNumber,
        quoted_text: selectedText,
        content: commentText,
        color: 'blue',
      });
      setCommentText('');
      setShowCommentDialog(false);
      setActiveTool('none');
    }
  };

  const handleAddNote = () => {
    const noteText = prompt('Enter your note:');
    if (noteText && noteText.trim()) {
      onAddAnnotation({
        annotation_type: 'note',
        page_number: pageNumber,
        content: noteText,
        color: 'green',
      });
      setActiveTool('none');
    }
  };

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPageNumber = prevPageNumber + offset;
      return Math.min(Math.max(1, newPageNumber), numPages);
    });
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));

  // Get annotations for current page
  const currentPageAnnotations = annotations.filter(
    (ann) => ann.page_number === pageNumber
  );

  return (
    <div className="contract-viewer">
      {/* Toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-section">
          <button
            className={`tool-btn ${activeTool === 'strikethrough' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'strikethrough' ? 'none' : 'strikethrough')}
            title="Strikethrough"
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>
          <button
            className={`tool-btn ${activeTool === 'highlight' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'highlight' ? 'none' : 'highlight')}
            title="Highlight"
          >
            <span style={{ backgroundColor: 'yellow' }}>H</span>
          </button>
          <button
            className={`tool-btn ${activeTool === 'comment' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'comment' ? 'none' : 'comment')}
            title="Add Comment"
          >
            💬
          </button>
          <button
            className="tool-btn"
            onClick={handleAddNote}
            title="Add Note"
          >
            📝
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={zoomOut} disabled={scale <= 0.5}>
            -
          </button>
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={scale >= 3.0}>
            +
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={previousPage} disabled={pageNumber <= 1}>
            ◀
          </button>
          <span className="page-info">
            Page {pageNumber} of {numPages}
          </span>
          <button onClick={nextPage} disabled={pageNumber >= numPages}>
            ▶
          </button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="pdf-container" onMouseUp={handleTextSelection}>
        {pdfData ? (
          <>
            <Document
              file={pdfData}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="loading">Loading PDF...</div>}
              error={<div className="error">Failed to load PDF</div>}
            >
              <Page
                key={`page_${pageNumber}`}
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>

            {/* Render annotations overlay */}
            <div className="annotations-overlay">
              {selectedFinding && selectedFinding.page_number === pageNumber && (
                <div className="finding-highlight">
                  {selectedFinding.quoted_text}
                </div>
              )}
              {currentPageAnnotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className={`annotation annotation-${annotation.annotation_type}`}
                  style={{ borderColor: annotation.color }}
                >
                  <div className="annotation-content">
                    {annotation.quoted_text && (
                      <div
                        className="annotation-text"
                        style={{
                          textDecoration:
                            annotation.annotation_type === 'strikethrough'
                              ? 'line-through'
                              : 'none',
                          backgroundColor:
                            annotation.annotation_type === 'highlight'
                              ? annotation.color
                              : 'transparent',
                        }}
                      >
                        {annotation.quoted_text}
                      </div>
                    )}
                    {annotation.content && (
                      <div className="annotation-comment">{annotation.content}</div>
                    )}
                    <div className="annotation-meta">
                      {annotation.created_by_name} - {new Date(annotation.created_at!).toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="annotation-delete"
                    onClick={() => onDeleteAnnotation(annotation.id!)}
                    title="Delete annotation"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="loading">Loading PDF...</div>
        )}
      </div>

      {/* Comment Dialog */}
      {showCommentDialog && (
        <div className="comment-dialog-overlay">
          <div className="comment-dialog">
            <h3>Add Comment</h3>
            {selectedText && (
              <div className="selected-text">
                <strong>Selected text:</strong>
                <p>{selectedText}</p>
              </div>
            )}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment..."
              rows={4}
              autoFocus
            />
            <div className="dialog-actions">
              <button onClick={handleAddComment} className="btn btn-primary">
                Add Comment
              </button>
              <button
                onClick={() => {
                  setShowCommentDialog(false);
                  setCommentText('');
                  setActiveTool('none');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractViewer;
