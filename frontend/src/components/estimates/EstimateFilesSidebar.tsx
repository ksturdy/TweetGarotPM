import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { estimateFilesApi, EstimateFolder, EstimateFile } from '../../services/estimateFiles';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

interface EstimateFilesSidebarProps {
  estimateId: number;
  isOpen: boolean;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string): string {
  if (!mimeType) return '\u{1F4C4}';
  if (mimeType.startsWith('image/')) return '\u{1F5BC}';
  if (mimeType === 'application/pdf') return '\u{1F4D1}';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '\u{1F4CA}';
  if (mimeType.includes('word') || mimeType.includes('document')) return '\u{1F4DD}';
  if (mimeType.includes('dwg') || mimeType.includes('dxf') || mimeType.includes('autocad')) return '\u{1F4D0}';
  return '\u{1F4C4}';
}

/** Build a map of parentId -> child folders */
function buildChildMap(folders: EstimateFolder[]): Map<number | null, EstimateFolder[]> {
  const map = new Map<number | null, EstimateFolder[]>();
  for (const f of folders) {
    const key = f.parent_folder_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return map;
}

// ── Folder Section (recursive) ───────────────────────────────

interface FolderSectionProps {
  folder: EstimateFolder;
  estimateId: number;
  childMap: Map<number | null, EstimateFolder[]>;
  depth: number;
  expandedFolders: Set<number>;
  onToggle: (id: number) => void;
  onCreateSubfolder: (parentId: number) => void;
}

const FolderSection: React.FC<FolderSectionProps> = ({
  folder, estimateId, childMap, depth, expandedFolders, onToggle, onCreateSubfolder,
}) => {
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.folder_name);

  const isExpanded = expandedFolders.has(folder.id);
  const children = childMap.get(folder.id) || [];

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['estimate-files', estimateId, folder.id],
    queryFn: () => estimateFilesApi.getFiles(estimateId, folder.id),
    enabled: isExpanded,
  });

  const uploadMutation = useMutation({
    mutationFn: (fileList: File[]) => estimateFilesApi.uploadFiles(estimateId, folder.id, fileList),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-files', estimateId, folder.id] });
      queryClient.invalidateQueries({ queryKey: ['estimate-folders', estimateId] });
      toast.success('Files uploaded successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Upload failed');
    },
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => estimateFilesApi.renameFolder(estimateId, folder.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-folders', estimateId] });
      setIsRenaming(false);
      toast.success('Folder renamed');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Rename failed');
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: () => estimateFilesApi.deleteFolder(estimateId, folder.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-folders', estimateId] });
      toast.success('Folder deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Delete failed');
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: number) => estimateFilesApi.deleteFile(estimateId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-files', estimateId, folder.id] });
      queryClient.invalidateQueries({ queryKey: ['estimate-folders', estimateId] });
    },
  });

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    uploadMutation.mutate(Array.from(fileList));
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDownload = async (file: EstimateFile) => {
    try {
      const { url } = await estimateFilesApi.getDownloadUrl(estimateId, file.id);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to get download URL');
    }
  };

  const handleDeleteFile = async (file: EstimateFile) => {
    const yes = await confirm(`Delete "${file.original_name}"?`);
    if (yes) deleteFileMutation.mutate(file.id);
  };

  const handleDeleteFolder = async () => {
    const msg = children.length > 0
      ? `Delete folder "${folder.folder_name}", all subfolders, and all files?`
      : `Delete folder "${folder.folder_name}" and all its files?`;
    const yes = await confirm(msg);
    if (yes) deleteFolderMutation.mutate();
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === folder.folder_name) {
      setIsRenaming(false);
      setRenameValue(folder.folder_name);
      return;
    }
    renameMutation.mutate(trimmed);
  };

  const indent = depth * 16;

  return (
    <div style={{ borderBottom: depth === 0 ? '1px solid var(--border, #e5e7eb)' : 'none' }}>
      {/* Folder Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.5rem 0.75rem',
          paddingLeft: `${0.75 + indent / 16}rem`,
          cursor: 'pointer',
          backgroundColor: isExpanded ? 'var(--bg-hover, #f9fafb)' : 'transparent',
          transition: 'background-color 0.15s',
        }}
        onClick={() => onToggle(folder.id)}
      >
        <span style={{ marginRight: '0.375rem', fontSize: '0.7rem', color: '#6b7280' }}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
        <span style={{ marginRight: '0.375rem', fontSize: depth > 0 ? '0.8125rem' : '1rem' }}>
          {isExpanded ? '\u{1F4C2}' : '\u{1F4C1}'}
        </span>

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(folder.folder_name); }
            }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1,
              border: '1px solid var(--primary, #3b82f6)',
              borderRadius: 4,
              padding: '0.125rem 0.375rem',
              fontSize: '0.8125rem',
              outline: 'none',
            }}
          />
        ) : (
          <span style={{ flex: 1, fontWeight: 500, fontSize: '0.8125rem' }}>{folder.folder_name}</span>
        )}

        <span style={{
          backgroundColor: 'var(--bg-secondary, #e5e7eb)',
          color: '#6b7280',
          borderRadius: 10,
          padding: '0 0.5rem',
          fontSize: '0.6875rem',
          fontWeight: 600,
          minWidth: 20,
          textAlign: 'center',
        }}>
          {folder.file_count}
        </span>

        {/* Action buttons */}
        <div style={{ display: 'flex', marginLeft: '0.375rem', gap: '0.125rem' }} onClick={e => e.stopPropagation()}>
          {/* Add subfolder (available on all folders) */}
          <button
            onClick={() => onCreateSubfolder(folder.id)}
            title="New subfolder"
            style={iconBtnStyle}
          >
            {'+'}
          </button>
          {folder.folder_type === 'custom' && (
            <>
              <button
                onClick={() => { setIsRenaming(true); setRenameValue(folder.folder_name); }}
                title="Rename"
                style={iconBtnStyle}
              >
                {'\u270F'}
              </button>
              <button
                onClick={handleDeleteFolder}
                title="Delete folder"
                style={{ ...iconBtnStyle, color: '#ef4444' }}
              >
                {'\u2715'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ paddingLeft: `${indent / 16}rem` }}>
          {/* Child folders (recursive) */}
          {children.map(child => (
            <FolderSection
              key={child.id}
              folder={child}
              estimateId={estimateId}
              childMap={childMap}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onCreateSubfolder={onCreateSubfolder}
            />
          ))}

          {/* Files in this folder */}
          <div style={{ padding: '0 0.75rem 0.5rem 1.75rem' }}>
            {filesLoading ? (
              <div style={{ color: '#9ca3af', fontSize: '0.75rem', padding: '0.25rem 0' }}>Loading...</div>
            ) : files.length > 0 ? (
              <div style={{ marginBottom: '0.375rem' }}>
                {files.map((file: EstimateFile) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.3rem 0',
                      fontSize: '0.75rem',
                      borderBottom: '1px solid var(--border-light, #f3f4f6)',
                    }}
                  >
                    <span style={{ marginRight: '0.375rem' }}>{getFileIcon(file.mime_type)}</span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        color: 'var(--primary, #3b82f6)',
                      }}
                      title={file.original_name}
                      onClick={() => handleDownload(file)}
                    >
                      {file.original_name}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '0.6875rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                      {formatFileSize(file.size || 0)}
                    </span>
                    <button
                      onClick={() => handleDownload(file)}
                      title="Download"
                      style={{ ...iconBtnStyle, marginLeft: '0.25rem', fontSize: '0.75rem' }}
                    >
                      {'\u2B07'}
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file)}
                      title="Delete"
                      style={{ ...iconBtnStyle, color: '#ef4444', fontSize: '0.75rem' }}
                    >
                      {'\u2715'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--primary, #3b82f6)' : '#d1d5db'}`,
                borderRadius: 6,
                padding: '0.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: '0.6875rem',
                color: dragOver ? 'var(--primary, #3b82f6)' : '#9ca3af',
                backgroundColor: dragOver ? 'rgba(59,130,246,0.04)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {uploadMutation.isPending
                ? 'Uploading...'
                : 'Drop files here or click to upload'}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sidebar ──────────────────────────────────────────────────

const EstimateFilesSidebar: React.FC<EstimateFilesSidebarProps> = ({ estimateId, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['estimate-folders', estimateId],
    queryFn: () => estimateFilesApi.getFolders(estimateId),
    enabled: isOpen,
  });

  const childMap = buildChildMap(folders);
  const rootFolders = childMap.get(null) || [];

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      estimateFilesApi.createFolder(estimateId, name, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-folders', estimateId] });
      setNewFolderName('');
      setShowNewFolder(false);
      setNewFolderParentId(null);
      toast.success('Folder created');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create folder');
    },
  });

  const toggleFolder = (folderId: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleCreateSubfolder = (parentId: number) => {
    // Expand the parent so the new input is visible
    setExpandedFolders(prev => new Set(prev).add(parentId));
    setNewFolderParentId(parentId);
    setShowNewFolder(true);
    setNewFolderName('');
  };

  const handleCreateRootFolder = () => {
    setNewFolderParentId(null);
    setShowNewFolder(true);
    setNewFolderName('');
  };

  const handleSubmitNewFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    createFolderMutation.mutate({ name: trimmed, parentId: newFolderParentId });
  };

  const handleCancelNewFolder = () => {
    setShowNewFolder(false);
    setNewFolderName('');
    setNewFolderParentId(null);
  };

  // Find the parent folder name for the inline input label
  const parentFolder = newFolderParentId ? folders.find(f => f.id === newFolderParentId) : null;

  return (
    <>
      {/* Overlay backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.15)',
            zIndex: 49,
          }}
        />
      )}

      {/* Sidebar panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 380,
          height: '100vh',
          backgroundColor: 'var(--bg-card, #ffffff)',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.875rem 1rem',
          borderBottom: '1px solid var(--border, #e5e7eb)',
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>
            {'\u{1F4C1}'} Project Files
          </h3>
          <button onClick={onClose} style={{ ...iconBtnStyle, fontSize: '1rem' }} title="Close">
            {'\u2715'}
          </button>
        </div>

        {/* New folder bar */}
        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border, #e5e7eb)', flexShrink: 0 }}>
          {showNewFolder ? (
            <div>
              {parentFolder && (
                <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Subfolder of <strong>{parentFolder.folder_name}</strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <input
                  autoFocus
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSubmitNewFolder();
                    if (e.key === 'Escape') handleCancelNewFolder();
                  }}
                  style={{
                    flex: 1,
                    border: '1px solid var(--border, #d1d5db)',
                    borderRadius: 4,
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSubmitNewFolder}
                  disabled={createFolderMutation.isPending || !newFolderName.trim()}
                  style={{
                    padding: '0.25rem 0.625rem',
                    borderRadius: 4,
                    border: 'none',
                    backgroundColor: 'var(--primary, #3b82f6)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
                <button
                  onClick={handleCancelNewFolder}
                  style={{ ...iconBtnStyle, fontSize: '0.875rem' }}
                >
                  {'\u2715'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleCreateRootFolder}
              style={{
                background: 'none',
                border: '1px dashed var(--border, #d1d5db)',
                borderRadius: 4,
                padding: '0.3rem 0.625rem',
                fontSize: '0.75rem',
                color: '#6b7280',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              + New Folder
            </button>
          )}
        </div>

        {/* Folder tree (scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
              Loading folders...
            </div>
          ) : rootFolders.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
              No folders yet
            </div>
          ) : (
            rootFolders.map((folder: EstimateFolder) => (
              <FolderSection
                key={folder.id}
                folder={folder}
                estimateId={estimateId}
                childMap={childMap}
                depth={0}
                expandedFolders={expandedFolders}
                onToggle={toggleFolder}
                onCreateSubfolder={handleCreateSubfolder}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

// Shared minimal icon button style
const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.125rem 0.25rem',
  fontSize: '0.8125rem',
  color: '#6b7280',
  borderRadius: 3,
  lineHeight: 1,
};

export default EstimateFilesSidebar;
