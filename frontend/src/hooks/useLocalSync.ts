import { useState, useCallback, useEffect, useRef } from 'react';
import {
  syncProjectToFolder,
  SyncProgress,
  isFileSystemAccessSupported,
  saveHandle,
  loadHandle,
  checkHandlePermission,
  requestHandlePermission,
} from '../services/localSync';

export type SyncState = 'idle' | 'syncing' | 'done' | 'error';

const INTERVAL_KEY = (id: number) => `sync_interval_${id}`;

export function useLocalSync(projectId: number, projectName: string) {
  const [state, setState] = useState<SyncState>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [hasHandle, setHasHandle] = useState(false);
  const [autoInterval, setAutoIntervalState] = useState<number>(
    () => Number(localStorage.getItem(INTERVAL_KEY(projectId)) ?? 0)
  );
  const supported = isFileSystemAccessSupported();
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);

  // On mount, restore handle from IndexedDB — just having it stored means the user
  // has synced before, so we enable the auto dropdown. Permission is re-requested
  // lazily on the next sync click (requires user gesture anyway).
  useEffect(() => {
    if (!supported) return;
    loadHandle(projectId).then(async (stored) => {
      if (!stored) return;
      handleRef.current = stored;
      setHasHandle(true);
      // If permission is already active (same browser session), nothing extra needed
    }).catch(() => {});
  }, [projectId, supported]);

  const runSync = useCallback(async (handle?: FileSystemDirectoryHandle) => {
    setState('syncing');
    setProgress(null);
    try {
      const { handle: usedHandle } = await syncProjectToFolder(projectId, projectName, setProgress, handle);
      handleRef.current = usedHandle;
      setHasHandle(true);
      await saveHandle(projectId, usedHandle);
      setState('done');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState('idle');
      } else {
        setState('error');
      }
    }
  }, [projectId, projectName]);

  const sync = useCallback(async () => {
    if (!supported) return;

    let handle = handleRef.current;

    if (handle) {
      // Check if permission is still active; if not, request it via a small browser
      // prompt (requires user gesture — the button click qualifies)
      const active = await checkHandlePermission(handle);
      if (!active) {
        const granted = await requestHandlePermission(handle);
        if (!granted) handle = null; // permission denied — fall back to full folder picker
      }
    }

    await runSync(handle ?? undefined);
  }, [supported, runSync]);

  // Auto-sync timer — fires only when a handle exists and permission is still active
  useEffect(() => {
    if (!autoInterval || !supported) return;

    const intervalMs = autoInterval * 60 * 1000;
    const timer = setInterval(async () => {
      if (!handleRef.current) return;
      const ok = await checkHandlePermission(handleRef.current);
      if (!ok) return; // permission expired — wait for next manual sync
      if (state === 'syncing') return;
      await runSync(handleRef.current);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoInterval, supported, runSync, state]);

  const setAutoInterval = useCallback((minutes: number) => {
    setAutoIntervalState(minutes);
    localStorage.setItem(INTERVAL_KEY(projectId), String(minutes));
  }, [projectId]);

  const changeFolder = useCallback(async () => {
    if (!supported) return;
    try {
      const rootDir = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      handleRef.current = rootDir;
      setHasHandle(true);
      await saveHandle(projectId, rootDir);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }, [supported, projectId]);

  return { sync, changeFolder, state, progress, supported, hasHandle, autoInterval, setAutoInterval };
}
