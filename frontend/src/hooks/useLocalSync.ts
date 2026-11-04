import { useState, useCallback } from 'react';
import { syncProjectToFolder, SyncProgress, isFileSystemAccessSupported } from '../services/localSync';

export type SyncState = 'idle' | 'syncing' | 'done' | 'error';

export function useLocalSync(projectId: number, projectName: string) {
  const [state, setState] = useState<SyncState>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const supported = isFileSystemAccessSupported();

  const sync = useCallback(async () => {
    if (!supported) return;
    setState('syncing');
    setProgress(null);

    try {
      await syncProjectToFolder(projectId, projectName, setProgress);
      setState('done');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the folder picker
        setState('idle');
      } else {
        setState('error');
      }
    }
  }, [projectId, projectName, supported]);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
  }, []);

  return { sync, reset, state, progress, supported };
}
