import React, { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectPhotosApi, ProjectPhoto } from '../../services/projectPhotos';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';

const ProjectPhotos: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { confirm, toast } = useTitanFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<ProjectPhoto | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<ProjectPhoto | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkTagMode, setBulkTagMode] = useState<'append' | 'replace'>('append');

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: () => projectPhotosApi.getByProject(projectId!).then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const results = [];
      for (const file of Array.from(files)) {
        const res = await projectPhotosApi.upload(projectId!, file, { caption, tags });
        results.push(res.data);
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      toast.success(`${results.length} photo${results.length !== 1 ? 's' : ''} uploaded`);
      setCaption('');
      setTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Upload failed';
      toast.error(msg);
    },
    onSettled: () => setUploading(false),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; caption: string; tags: string }) =>
      projectPhotosApi.update(data.id, { caption: data.caption, tags: data.tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      setEditingPhoto(null);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: () =>
      projectPhotosApi.bulkUpdate(Array.from(selectedIds), {
        caption: bulkCaption,
        tags: bulkTags,
        tagMode: bulkTagMode,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      const n = res.data.updated;
      toast.success(`Updated ${n} photo${n !== 1 ? 's' : ''}`);
      setBulkModalOpen(false);
      setBulkCaption('');
      setBulkTags('');
      setBulkTagMode('append');
      setSelectedIds(new Set());
      setSelectMode(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Bulk update failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectPhotosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      if (lightboxPhoto) setLightboxPhoto(null);
      toast.success('Photo deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to delete photo');
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    uploadMutation.mutate(e.target.files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    setUploading(true);
    uploadMutation.mutate(e.dataTransfer.files);
  };

  const handleDelete = async (photo: ProjectPhoto) => {
    const ok = await confirm(`Delete this photo? This cannot be undone.`);
    if (!ok) return;
    deleteMutation.mutate(photo.id);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkSave = () => {
    if (!bulkCaption && !bulkTags) {
      toast.error('Enter a caption or tags to apply');
      return;
    }
    bulkUpdateMutation.mutate();
  };

  const openEdit = (photo: ProjectPhoto) => {
    setEditingPhoto(photo);
    setEditCaption(photo.caption || '');
    setEditTags(photo.tags || '');
  };

  const saveEdit = () => {
    if (!editingPhoto) return;
    updateMutation.mutate({ id: editingPhoto.id, caption: editCaption, tags: editTags });
  };

  const allTags = Array.from(
    new Set(photos.flatMap((p) => (p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [])))
  );

  const filtered = photos.filter((p) => {
    if (filterTag && !p.tags?.split(',').map((t) => t.trim()).includes(filterTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hit =
        p.caption?.toLowerCase().includes(q) ||
        p.tags?.toLowerCase().includes(q) ||
        p.file_name?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  const projectName = photos[0]?.project_name ?? '';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          to={`/projects/${projectId}`}
          style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14 }}
        >
          ← {projectName || 'Project'}
        </Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Photos</h1>
        <span
          style={{
            marginLeft: 'auto',
            background: '#f3f4f6',
            color: '#6b7280',
            borderRadius: 12,
            padding: '2px 10px',
            fontSize: 13,
          }}
        >
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => { setSelectMode((s) => !s); setSelectedIds(new Set()); }}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid',
            borderColor: selectMode ? '#2563eb' : '#d1d5db',
            background: selectMode ? '#eff6ff' : '#fff',
            color: selectMode ? '#2563eb' : '#6b7280',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* Upload strip */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1.5px dashed #d1d5db',
          borderRadius: 10,
          padding: '10px 14px',
          marginBottom: 16,
          background: '#f9fafb',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <span style={{ fontSize: 20 }}>📷</span>
          <span>Drop or <span style={{ color: '#2563eb', textDecoration: 'underline' }}>browse</span></span>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: '#e5e7eb', margin: '0 2px' }} />
        <input
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          style={{ flex: 1, minWidth: 130, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        />
        <input
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          style={{ flex: 1, minWidth: 150, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '7px 18px',
            fontSize: 13,
            cursor: uploading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? 'Uploading…' : 'Upload Photos'}
        </button>
      </div>

      {/* Search + tag filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 15, pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search captions, tags, filenames…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fff',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
          {(searchQuery || filterTag) && (
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {filtered.length} of {photos.length}
            </span>
          )}
        </div>

      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterTag('')}
            style={{
              padding: '4px 12px',
              borderRadius: 16,
              border: '1px solid',
              borderColor: filterTag === '' ? '#2563eb' : '#d1d5db',
              background: filterTag === '' ? '#eff6ff' : '#fff',
              color: filterTag === '' ? '#2563eb' : '#6b7280',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag === filterTag ? '' : tag)}
              style={{
                padding: '4px 12px',
                borderRadius: 16,
                border: '1px solid',
                borderColor: filterTag === tag ? '#2563eb' : '#d1d5db',
                background: filterTag === tag ? '#eff6ff' : '#fff',
                color: filterTag === tag ? '#2563eb' : '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Gallery */}
      {isLoading ? (
        <p style={{ color: '#6b7280', textAlign: 'center' }}>Loading photos…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
          <p style={{ margin: 0 }}>No photos yet. Upload the first one above.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((photo) => (
            <div
              key={photo.id}
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                outline: selectMode && selectedIds.has(photo.id) ? '3px solid #2563eb' : 'none',
                outlineOffset: '-1px',
              }}
            >
              <div
                style={{ position: 'relative', paddingTop: '66%', background: '#f3f4f6', cursor: 'pointer' }}
                onClick={() => selectMode ? toggleSelect(photo.id) : setLightboxPhoto(photo)}
              >
                {selectMode && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 3,
                    width: 22, height: 22, borderRadius: 5,
                    border: '2px solid #fff',
                    background: selectedIds.has(photo.id) ? '#2563eb' : 'rgba(0,0,0,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}>
                    {selectedIds.has(photo.id) && (
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>
                    )}
                  </div>
                )}
                <img
                  src={resolveMediaUrl(photo.thumb_url || photo.feed_url || photo.url)}
                  alt={photo.caption || photo.file_name}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
              <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {photo.caption && (
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', fontWeight: 500 }}>{photo.caption}</p>
                )}
                {photo.tags && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {photo.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span
                        key={t}
                        style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontSize: 11,
                          borderRadius: 8,
                          padding: '2px 7px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', marginTop: 'auto' }}>
                  {photo.uploaded_by_name} · {new Date(photo.created_at).toLocaleDateString()}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    onClick={() => openEdit(photo)}
                    style={{
                      flex: 1,
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 0',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: '#374151',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(photo)}
                    style={{
                      flex: 1,
                      background: '#fee2e2',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 0',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: '#dc2626',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            onClick={() => setLightboxPhoto(null)}
            style={{
              position: 'absolute',
              top: 20,
              right: 24,
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: 28,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <img
            src={resolveMediaUrl(lightboxPhoto.feed_url || lightboxPhoto.url)}
            alt={lightboxPhoto.caption || lightboxPhoto.file_name}
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxPhoto.caption && (
            <p style={{ color: '#e5e7eb', marginTop: 16, fontSize: 15 }}>{lightboxPhoto.caption}</p>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editingPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setEditingPhoto(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 28,
              width: 400,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 600 }}>Edit Photo</h3>
            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Caption</label>
            <input
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Tags (comma separated)</label>
            <input
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                marginBottom: 24,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingPhoto(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={updateMutation.isPending}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bulk action bar */}
      {selectMode && (
        <div style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b',
          color: '#fff',
          borderRadius: 12,
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          zIndex: 500,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, marginRight: 4 }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setSelectedIds(new Set(filtered.map((p) => p.id)))}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: 12, cursor: 'pointer' }}
          >
            Select all ({filtered.length})
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: 12, cursor: 'pointer' }}
          >
            Clear
          </button>
          <button
            onClick={() => setBulkModalOpen(true)}
            disabled={selectedIds.size === 0}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none',
              background: selectedIds.size === 0 ? '#334155' : '#2563eb',
              color: selectedIds.size === 0 ? '#64748b' : '#fff',
              fontSize: 12, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Edit selected
          </button>
          <button
            onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Bulk edit modal */}
      {bulkModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setBulkModalOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600 }}>
              Edit {selectedIds.size} Photo{selectedIds.size !== 1 ? 's' : ''}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
              Leave a field blank to keep existing values unchanged.
            </p>

            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Caption</label>
            <input
              value={bulkCaption}
              onChange={(e) => setBulkCaption(e.target.value)}
              placeholder="Leave blank to keep existing"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 16, fontSize: 14, boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Tags</label>
            <input
              value={bulkTags}
              onChange={(e) => setBulkTags(e.target.value)}
              placeholder="e.g. roof, hvac, complete"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 12, fontSize: 14, boxSizing: 'border-box' }}
            />

            {bulkTags && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  onClick={() => setBulkTagMode('append')}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid',
                    borderColor: bulkTagMode === 'append' ? '#2563eb' : '#d1d5db',
                    background: bulkTagMode === 'append' ? '#eff6ff' : '#fff',
                    color: bulkTagMode === 'append' ? '#2563eb' : '#6b7280',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Add to existing tags
                </button>
                <button
                  onClick={() => setBulkTagMode('replace')}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid',
                    borderColor: bulkTagMode === 'replace' ? '#dc2626' : '#d1d5db',
                    background: bulkTagMode === 'replace' ? '#fef2f2' : '#fff',
                    color: bulkTagMode === 'replace' ? '#dc2626' : '#6b7280',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Replace existing tags
                </button>
              </div>
            )}
            {!bulkTags && <div style={{ marginBottom: 20 }} />}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBulkModalOpen(false)}
                style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSave}
                disabled={bulkUpdateMutation.isPending}
                style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                {bulkUpdateMutation.isPending ? 'Saving…' : `Apply to ${selectedIds.size} photos`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPhotos;
