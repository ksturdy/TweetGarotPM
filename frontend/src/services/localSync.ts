import api from './api';

// Strip /api suffix to get the server origin (e.g. http://localhost:3001/api → http://localhost:3001)
const API_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url}`;
}

// ── IndexedDB handle persistence ────────────────────────────────────
// FileSystemDirectoryHandle can be stored in IDB and reused within a browser session.
// Permission does NOT survive a browser restart, but queryPermission() lets us check first.

function openSyncDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('titan-sync', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveHandle(projectId: number, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, `project_${projectId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadHandle(projectId: number): Promise<FileSystemDirectoryHandle | null> {
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get(`project_${projectId}`);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function checkHandlePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
    return perm === 'granted';
  } catch {
    return false;
  }
}

// Must be called from a user gesture (button click). Shows a small browser permission
// prompt instead of the full folder picker when the handle was saved from a previous session.
export async function requestHandlePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const perm = await (handle as any).requestPermission({ mode: 'readwrite' });
    return perm === 'granted';
  } catch {
    return false;
  }
}

// ── Core types ───────────────────────────────────────────────────────

export interface ProjectAttachment {
  id: number;
  entity_type: string;
  entity_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  folder_name: string;
  entity_label: string;
}

export interface SyncProgress {
  total: number;
  completed: number;
  skipped: number;
  current: string;
  errors: string[];
}

export const isFileSystemAccessSupported = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function sanitizeName(name: string, maxLen = 60): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').substring(0, maxLen).trim();
}

async function fileExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function writeAttachment(
  attachment: ProjectAttachment,
  projectDir: FileSystemDirectoryHandle
): Promise<'written' | 'skipped'> {
  const folderDir = await projectDir.getDirectoryHandle(attachment.folder_name, { create: true });
  const entityDir = await folderDir.getDirectoryHandle(sanitizeName(attachment.entity_label), { create: true });

  if (await fileExists(entityDir, attachment.original_name)) {
    return 'skipped';
  }

  // Route through backend proxy — avoids CORS issues fetching R2 presigned URLs from the browser
  const proxyUrl = attachment.entity_type === 'drawing'
    ? resolveUrl(`/api/drawings/${attachment.entity_id}/download`)
    : resolveUrl(`/api/attachments/${attachment.id}/download`);

  const token = localStorage.getItem('token');
  const response = await fetch(proxyUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  const fileHandle = await entityDir.getFileHandle(attachment.original_name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return 'written';
}

// ── Main sync function ───────────────────────────────────────────────

export interface SyncResult {
  progress: SyncProgress;
  handle: FileSystemDirectoryHandle;
}

export async function syncProjectToFolder(
  projectId: number,
  projectName: string,
  onProgress: (p: SyncProgress) => void,
  existingHandle?: FileSystemDirectoryHandle
): Promise<SyncResult> {
  const rootDir = existingHandle ?? await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  const projectDir = await rootDir.getDirectoryHandle(sanitizeName(projectName), { create: true });

  const { data: attachments } = await api.get<ProjectAttachment[]>(`/attachments/project/${projectId}`);

  const progress: SyncProgress = {
    total: attachments.length,
    completed: 0,
    skipped: 0,
    current: '',
    errors: [],
  };

  onProgress({ ...progress });

  for (const att of attachments) {
    progress.current = att.original_name;
    onProgress({ ...progress });

    try {
      const result = await writeAttachment(att, projectDir);
      if (result === 'skipped') progress.skipped++;
    } catch (err) {
      progress.errors.push(`${att.original_name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    progress.completed++;
    onProgress({ ...progress });
  }

  progress.current = '';
  onProgress({ ...progress });
  return { progress, handle: rootDir };
}
