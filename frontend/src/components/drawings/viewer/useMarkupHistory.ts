import { useCallback, useRef } from 'react';
import type { DrawingMarkup } from '../../../lib/drawingViewer/types';

type HistoryEntry =
  | { type: 'add'; markup: DrawingMarkup }
  | { type: 'delete'; markup: DrawingMarkup };

const MAX_HISTORY = 50;

export function useMarkupHistory(
  onDelete: (markup: DrawingMarkup) => Promise<void>,
  onRestore: (markup: DrawingMarkup) => Promise<DrawingMarkup>
) {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);

  const pushAdd = useCallback((markup: DrawingMarkup) => {
    undoStack.current.push({ type: 'add', markup });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const pushDelete = useCallback((markup: DrawingMarkup) => {
    undoStack.current.push({ type: 'delete', markup });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const undo = useCallback(async () => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    if (entry.type === 'add') {
      await onDelete(entry.markup);
      redoStack.current.push({ type: 'delete', markup: entry.markup });
    } else {
      const restored = await onRestore(entry.markup);
      redoStack.current.push({ type: 'add', markup: restored });
    }
  }, [onDelete, onRestore]);

  const redo = useCallback(async () => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    if (entry.type === 'add') {
      await onDelete(entry.markup);
      undoStack.current.push({ type: 'delete', markup: entry.markup });
    } else {
      const restored = await onRestore(entry.markup);
      undoStack.current.push({ type: 'add', markup: restored });
    }
  }, [onDelete, onRestore]);

  const canUndo = () => undoStack.current.length > 0;
  const canRedo = () => redoStack.current.length > 0;
  const clear = () => { undoStack.current = []; redoStack.current = []; };

  return { pushAdd, pushDelete, undo, redo, canUndo, canRedo, clear };
}
