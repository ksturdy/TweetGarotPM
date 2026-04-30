import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { drawingsApi, Drawing, DrawingPage } from '../../services/drawings';
import DrawingPdfViewer from './DrawingPdfViewer';
import '../../styles/DrawingSetReview.css';

const DISCIPLINE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Mechanical:       { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
  Plumbing:         { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
  'Sheet Metal':    { bg: '#fefce8', text: '#854d0e', border: '#fde047' },
  Electrical:       { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  Architectural:    { bg: '#fdf2f8', text: '#9d174d', border: '#f9a8d4' },
  Structural:       { bg: '#f5f3ff', text: '#5b21b6', border: '#c4b5fd' },
  Civil:            { bg: '#ecfdf5', text: '#065f46', border: '#6ee7b7' },
  'Fire Protection':{ bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
  General:          { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
  Specifications:   { bg: '#f3f4f6', text: '#4b5563', border: '#9ca3af' },
  Unknown:          { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
};

const ALL_DISCIPLINES = Object.keys(DISCIPLINE_COLORS);

interface DrawingSetReviewProps {
  drawing: Drawing;
}

const DrawingSetReview: React.FC<DrawingSetReviewProps> = ({ drawing }) => {
  const queryClient = useQueryClient();
  const [selectedPage, setSelectedPage] = useState(1);
  const [disciplineFilters, setDisciplineFilters] = useState<Set<string>>(new Set());
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editDiscipline, setEditDiscipline] = useState('');

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['drawing-pages', drawing.id],
    queryFn: () => drawingsApi.getPages(drawing.id).then(res => res.data.data),
  });

  const quickClassifyMutation = useMutation({
    mutationFn: () => drawingsApi.classifyPagesQuick(drawing.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawing-pages', drawing.id] });
    },
  });

  const aiClassifyMutation = useMutation({
    mutationFn: () => drawingsApi.classifyPagesAI(drawing.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawing-pages', drawing.id] });
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: ({ pageNumber, discipline }: { pageNumber: number; discipline: string }) =>
      drawingsApi.updatePage(drawing.id, pageNumber, { discipline }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawing-pages', drawing.id] });
      setEditingPage(null);
    },
  });

  const pages = pagesData?.pages || [];
  const summary = pagesData?.summary || {};

  const filteredPages = useMemo(() => {
    if (disciplineFilters.size === 0) return pages;
    return pages.filter(p => p.discipline && disciplineFilters.has(p.discipline));
  }, [pages, disciplineFilters]);

  const toggleFilter = (discipline: string) => {
    setDisciplineFilters(prev => {
      const next = new Set(prev);
      if (next.has(discipline)) {
        next.delete(discipline);
      } else {
        next.add(discipline);
      }
      return next;
    });
  };

  const handleStartEdit = (page: DrawingPage) => {
    setEditingPage(page.page_number);
    setEditDiscipline(page.discipline || 'Unknown');
  };

  const handleSaveEdit = (pageNumber: number) => {
    updatePageMutation.mutate({ pageNumber, discipline: editDiscipline });
  };

  const hasClassifications = pages.some(p => p.discipline && p.discipline !== 'Unknown');
  const hasUnknownPages = pages.some(p => !p.discipline || p.discipline === 'Unknown');

  const getDisciplineStyle = (discipline: string | null) => {
    const colors = DISCIPLINE_COLORS[discipline || 'Unknown'] || DISCIPLINE_COLORS.Unknown;
    return {
      backgroundColor: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 500 as const,
      display: 'inline-block',
    };
  };

  return (
    <div className="drawing-set-review">
      {/* Header bar */}
      <div className="dsr-header">
        <div className="dsr-header-left">
          <h3 style={{ margin: 0 }}>
            {drawing.title}
            <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: '0.5rem', fontSize: '0.9rem' }}>
              ({drawing.page_count} pages)
            </span>
          </h3>
        </div>
        <div className="dsr-header-right" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => quickClassifyMutation.mutate()}
            disabled={quickClassifyMutation.isPending || aiClassifyMutation.isPending}
            className="btn btn-primary"
          >
            {quickClassifyMutation.isPending ? 'Classifying...' : hasClassifications ? 'Re-classify Pages' : 'Classify Pages'}
          </button>
          {hasUnknownPages && (
            <button
              onClick={() => aiClassifyMutation.mutate()}
              disabled={quickClassifyMutation.isPending || aiClassifyMutation.isPending}
              className="btn btn-secondary"
              title="Use AI to classify pages that couldn't be identified by drawing number"
            >
              {aiClassifyMutation.isPending ? 'AI Analyzing...' : 'Enhance with AI'}
            </button>
          )}
        </div>
      </div>

      {/* Classification progress */}
      {quickClassifyMutation.isPending && (
        <div className="dsr-progress-bar">
          <div className="dsr-progress-text">
            Classifying pages by drawing number patterns...
          </div>
          <div className="dsr-progress-track">
            <div className="dsr-progress-fill dsr-progress-indeterminate" />
          </div>
        </div>
      )}

      {aiClassifyMutation.isPending && (
        <div className="dsr-progress-bar">
          <div className="dsr-progress-text">
            AI is analyzing unrecognized pages. This may take a moment for large drawing sets...
          </div>
          <div className="dsr-progress-track">
            <div className="dsr-progress-fill dsr-progress-indeterminate" />
          </div>
        </div>
      )}

      {(quickClassifyMutation.isError || aiClassifyMutation.isError) && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', color: '#991b1b', borderBottom: '1px solid #fca5a5', fontSize: '0.875rem' }}>
          Classification failed: {
            ((quickClassifyMutation.error || aiClassifyMutation.error) as any)?.response?.data?.error || 'Unknown error'
          }
        </div>
      )}

      {/* Discipline summary + filter chips */}
      {Object.keys(summary).length > 0 && (
        <div className="dsr-filters">
          <span style={{ fontSize: '0.8rem', color: '#6b7280', marginRight: '0.5rem' }}>Filter:</span>
          {Object.entries(summary)
            .sort((a, b) => b[1] - a[1])
            .map(([discipline, count]) => {
              const active = disciplineFilters.has(discipline);
              const colors = DISCIPLINE_COLORS[discipline] || DISCIPLINE_COLORS.Unknown;
              return (
                <button
                  key={discipline}
                  onClick={() => toggleFilter(discipline)}
                  className={`dsr-filter-chip ${active ? 'active' : ''}`}
                  style={{
                    backgroundColor: active ? colors.text : colors.bg,
                    color: active ? '#fff' : colors.text,
                    borderColor: colors.border,
                  }}
                >
                  {discipline} ({count})
                </button>
              );
            })}
          {disciplineFilters.size > 0 && (
            <button
              onClick={() => setDisciplineFilters(new Set())}
              className="dsr-filter-chip"
              style={{ backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Main two-column layout */}
      <div className="dsr-body">
        {/* Left: page list */}
        <div className="dsr-sidebar">
          {pagesLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading pages...</div>
          ) : filteredPages.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              {pages.length === 0 ? 'No pages found. Upload a PDF drawing set.' : 'No pages match the selected filters.'}
            </div>
          ) : (
            <div className="dsr-page-list">
              {filteredPages.map((page) => (
                <div
                  key={page.page_number}
                  className={`dsr-page-row ${selectedPage === page.page_number ? 'active' : ''}`}
                  onClick={() => setSelectedPage(page.page_number)}
                >
                  <div className="dsr-page-num">{page.page_number}</div>
                  <div className="dsr-page-info">
                    <div className="dsr-page-drawing-num">
                      {page.drawing_number || `Page ${page.page_number}`}
                    </div>
                    {page.title && (
                      <div className="dsr-page-title">{page.title}</div>
                    )}
                  </div>
                  <div className="dsr-page-discipline">
                    {editingPage === page.page_number ? (
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <select
                          value={editDiscipline}
                          onChange={(e) => setEditDiscipline(e.target.value)}
                          style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: 4 }}
                        >
                          {ALL_DISCIPLINES.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleSaveEdit(page.page_number)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                          disabled={updatePageMutation.isPending}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPage(null)}
                          style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={getDisciplineStyle(page.discipline)}>
                          {page.discipline || 'Unclassified'}
                        </span>
                        {page.confidence != null && (
                          <span style={{ fontSize: '0.65rem', color: '#9ca3af' }} title={page.ai_classified ? 'AI classified' : 'Pattern matched'}>
                            {Math.round(page.confidence * 100)}%
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(page); }}
                          className="dsr-edit-btn"
                          title="Change discipline"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: PDF viewer */}
        <div className="dsr-viewer">
          <DrawingPdfViewer
            drawingId={drawing.id}
            initialPage={selectedPage}
            onPageChange={(page) => setSelectedPage(page)}
          />
        </div>
      </div>
    </div>
  );
};

export default DrawingSetReview;
