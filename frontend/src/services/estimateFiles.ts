import api from './api';

export interface EstimateFolder {
  id: number;
  estimate_id: number;
  tenant_id: number;
  folder_name: string;
  folder_type: 'default' | 'custom';
  sort_order: number;
  parent_folder_id: number | null;
  file_count: number;
  created_at: string;
  updated_at: string;
}

export interface EstimateFile {
  id: number;
  folder_id: number;
  estimate_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  created_at: string;
  url?: string;
}

export const estimateFilesApi = {
  // Folders
  getFolders: (estimateId: number) =>
    api.get<EstimateFolder[]>(`/estimate-files/${estimateId}/folders`).then(res => res.data),

  createFolder: (estimateId: number, folderName: string, parentFolderId?: number | null) =>
    api.post<EstimateFolder>(`/estimate-files/${estimateId}/folders`, {
      folder_name: folderName,
      parent_folder_id: parentFolderId || null,
    }).then(res => res.data),

  renameFolder: (estimateId: number, folderId: number, folderName: string) =>
    api.put<EstimateFolder>(`/estimate-files/${estimateId}/folders/${folderId}`, { folder_name: folderName }).then(res => res.data),

  deleteFolder: (estimateId: number, folderId: number) =>
    api.delete(`/estimate-files/${estimateId}/folders/${folderId}`),

  // Files
  getFiles: (estimateId: number, folderId: number) =>
    api.get<EstimateFile[]>(`/estimate-files/${estimateId}/folders/${folderId}/files`).then(res => res.data),

  uploadFiles: (estimateId: number, folderId: number, files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post<EstimateFile[]>(`/estimate-files/${estimateId}/folders/${folderId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  deleteFile: (estimateId: number, fileId: number) =>
    api.delete(`/estimate-files/${estimateId}/files/${fileId}`),

  getDownloadUrl: (estimateId: number, fileId: number) =>
    api.get<{ url: string; originalName: string; mimeType: string }>(
      `/estimate-files/${estimateId}/files/${fileId}/download`
    ).then(res => res.data),
};
