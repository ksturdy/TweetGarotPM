import { useState, useCallback, useMemo } from 'react';
import { usePdfStore } from '../../stores/usePdfStore';
import { usePageMetadataStore } from '../../stores/usePageMetadataStore';
import DrawingPageRow from './DrawingPageRow';
import DrawingGroupHeader from './DrawingGroupHeader';

export default function DrawingList() {
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const activePageNumber = usePdfStore((s) => s.activePageNumber);
  const setActivePage = usePdfStore((s) => s.setActivePage);
  const documents = usePdfStore((s) => s.documents);

  const pages = usePageMetadataStore((s) => s.pages);
  const levels = usePageMetadataStore((s) => s.levels);
  const areas = usePageMetadataStore((s) => s.areas);
  const alternates = usePageMetadataStore((s) => s.alternates);
  const addenda = usePageMetadataStore((s) => s.addenda);
  const getPageMeta = usePageMetadataStore((s) => s.getPageMeta);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const activeDocument = documents.find((d) => d.id === activeDocumentId);
  const pageCount = activeDocument?.pageCount ?? 0;

  const allPages = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => i + 1),
    [pageCount],
  );

  const { basePages, alternatePages, addendumPages } = useMemo(() => {
    if (!activeDocumentId) {
      return { basePages: [] as number[], alternatePages: new Map<string, number[]>(), addendumPages: new Map<string, number[]>() };
    }

    const base: number[] = [];
    const altMap = new Map<string, number[]>();
    const addMap = new Map<string, number[]>();

    for (const p of allPages) {
      const meta = getPageMeta(activeDocumentId, p);
      if (meta.alternateId) {
        const list = altMap.get(meta.alternateId) ?? [];
        list.push(p);
        altMap.set(meta.alternateId, list);
      } else if (meta.addendumId) {
        const list = addMap.get(meta.addendumId) ?? [];
        list.push(p);
        addMap.set(meta.addendumId, list);
      } else {
        base.push(p);
      }
    }

    return { basePages: base, alternatePages: altMap, addendumPages: addMap };
  }, [activeDocumentId, allPages, pages]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  if (!activeDocumentId || pageCount === 0) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <p style={{ fontSize: 12, color: '#4a6a88' }}>No document</p>
      </div>
    );
  }

  const sortedAlternates = [...alternates].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedAddenda = [...addenda].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Base drawings */}
      {basePages.length > 0 && (
        <>
          {(sortedAlternates.length > 0 || sortedAddenda.length > 0) && (
            <p style={{ marginTop: 4, padding: '0 4px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a6a88' }}>
              Base Drawings
            </p>
          )}
          {basePages.map((pageNumber) => (
            <DrawingPageRow
              key={pageNumber}
              documentId={activeDocumentId}
              pageNumber={pageNumber}
              isActive={pageNumber === activePageNumber}
              onNavigate={setActivePage}
              levels={levels}
              areas={areas}
              alternates={alternates}
              addenda={addenda}
            />
          ))}
        </>
      )}

      {/* Alternate groups */}
      {sortedAlternates.map((alt) => {
        const groupPages = alternatePages.get(alt.id) ?? [];
        if (groupPages.length === 0 && alternates.length > 0) {
          return (
            <div key={`alt-${alt.id}`} style={{ marginTop: 4 }}>
              <DrawingGroupHeader label={alt.name} count={0} isOpen={false} onToggle={() => toggleGroup(`alt-${alt.id}`)} variant="alternate" />
            </div>
          );
        }
        if (groupPages.length === 0) return null;
        const isOpen = !collapsedGroups.has(`alt-${alt.id}`);
        return (
          <div key={`alt-${alt.id}`} style={{ marginTop: 4 }}>
            <DrawingGroupHeader label={alt.name} count={groupPages.length} isOpen={isOpen} onToggle={() => toggleGroup(`alt-${alt.id}`)} variant="alternate" />
            {isOpen && groupPages.map((pageNumber) => (
              <DrawingPageRow
                key={pageNumber}
                documentId={activeDocumentId}
                pageNumber={pageNumber}
                isActive={pageNumber === activePageNumber}
                onNavigate={setActivePage}
                levels={levels}
                alternates={alternates}
                addenda={addenda}
              />
            ))}
          </div>
        );
      })}

      {/* Addendum groups */}
      {sortedAddenda.map((add) => {
        const groupPages = addendumPages.get(add.id) ?? [];
        if (groupPages.length === 0 && addenda.length > 0) {
          return (
            <div key={`add-${add.id}`} style={{ marginTop: 4 }}>
              <DrawingGroupHeader label={add.name} count={0} isOpen={false} onToggle={() => toggleGroup(`add-${add.id}`)} variant="addendum" />
            </div>
          );
        }
        if (groupPages.length === 0) return null;
        const isOpen = !collapsedGroups.has(`add-${add.id}`);
        return (
          <div key={`add-${add.id}`} style={{ marginTop: 4 }}>
            <DrawingGroupHeader label={add.name} count={groupPages.length} isOpen={isOpen} onToggle={() => toggleGroup(`add-${add.id}`)} variant="addendum" />
            {isOpen && groupPages.map((pageNumber) => (
              <DrawingPageRow
                key={pageNumber}
                documentId={activeDocumentId}
                pageNumber={pageNumber}
                isActive={pageNumber === activePageNumber}
                onNavigate={setActivePage}
                levels={levels}
                alternates={alternates}
                addenda={addenda}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
