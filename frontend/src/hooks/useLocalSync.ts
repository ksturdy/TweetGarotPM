import { useState, useCallback, useEffect, useRef } from 'react';
import {
  syncProjectToFolder,
  SyncProgress,
  isFileSystemAccessSupported,
  saveHandle,
  loadHandle,
  checkHandlePermission,
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

  // On mount, restore handle from IndexedDB and check if permission is still active
  useEffect(() => {
    if (!supported) return;
    loadHandle(projectId).then(async (stored) => {
      if (!stored) return;
      const ok = await checkHandlePermission(stored);
      if (ok) {
        handleRef.current = stored;
        setHasHandle(true);
      }
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

  // Manual sync — always shows the folder picker if no handle stored
  const sync = useCallback(async () => {
    if (!supported) return;
    await runSync(handleRef.current ?? undefined);
  }, [supported, runSync]);

  // Auto-sync timer — only fires when a handle is available and permission is still active
  useEffect(() => {
    if (!autoInterval || !supported) return;

    const intervalMs = autoInterval * 60 * 1000;
    const timer = setInterval(async () => {
      if (!handleRef.current) return;
      const ok = await checkHandlePermission(handleRef.current);
      if (!ok) return;
      if (state === 'syncing') return;
      await runSync(handleRef.current);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoInterval, supported, runSync, state]);

  const setAutoInterval = useCallback((minutes: number) => {
    setAutoIntervalState(minutes);
    localStorage.setItem(INTERVAL_KEY(projectId), String(minutes));
  }, [projectId]);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
  }, []);

  return { sync, reset, state, progress, supported, hasHandle, autoInterval, setAutoInterval };
}
