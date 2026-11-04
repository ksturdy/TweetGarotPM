import api from './api';

// Strip /api suffix to get the server origin (e.g. http://localhost:3001/api → http://localhost:3001)
const API_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url}`;
}

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

export async function syncProjectToFolder(
  projectId: number,
  projectName: string,
  onProgress: (p: SyncProgress) => void
): Promise<SyncProgress> {
  // Prompt user to pick a root folder
  const rootDir = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
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
  return progress;
}
