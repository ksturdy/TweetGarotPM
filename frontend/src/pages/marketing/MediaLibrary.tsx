import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingMediaApi, CombinedMediaItem, MarketingMediaItem } from '../../services/marketingMedia';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type SourceFilter = 'all' | 'marketing' | 'project';

const MediaLibrary: React.FC = () => {
  const queryClient = useQueryClient();
  const { confirm, toast } = useTitanFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [filterTag, setFilterTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [lightboxItem, setLightboxItem] = useState<CombinedMediaItem | null>(null);
  const [editingItem, setEditingItem] = useState<MarketingMediaItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTitle, setBulkTitle] = useState('');
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkTagMode, setBulkTagMode] = useState<'append' | 'replace'>('append');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['marketing-media-combined'],
    queryFn: () => marketingMediaApi.getCombined().then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const results = [];
      for (const file of Array.from(files)) {
        const res = await marketingMediaApi.upload(file, { title: title || file.name, caption, tags });
        results.push(res.data);
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-media-combined'] });
      toast.success(`${results.length} item${results.length !== 1 ? 's' : ''} uploaded`);
      setTitle('');
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
    mutationFn: (data: { id: number; title: string; caption: string; tags: string }) =>
      marketingMediaApi.update(data.id, { title: data.title, caption: data.caption, tags: data.tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-media-combined'] });
      setEditingItem(null);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: () =>
      marketingMediaApi.bulkUpdate(Array.from(selectedIds), {
        title: bulkTitle,
        caption: bulkCaption,
        tags: bulkTags,
        tagMode: bulkTagMode,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-media-combined'] });
      const n = res.data.updated;
      toast.success(`Updated ${n} item${n !== 1 ? 's' : ''}`);
      setBulkModalOpen(false);
      setBulkTitle('');
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
    mutationFn: (id: number) => marketingMediaApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-media-combined'] });
      if (lightboxItem) setLightboxItem(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleDelete = async (item: CombinedMediaItem) => {
    if (item.source !== 'marketing') return;
    const ok = await confirm('Delete this media item? This cannot be undone.');
    if (!ok) return;
    deleteMutation.mutate(item.id);
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
    if (!bulkTitle && !bulkCaption && !bulkTags) {
      toast.error('Enter a title, caption, or tags to apply');
      return;
    }
    bulkUpdateMutation.mutate();
  };

  const openEdit = (item: MarketingMediaItem) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditCaption(item.caption || '');
    setEditTags(item.tags || '');
  };

  // Collect all tags across all items
  const allTags = Array.from(
    new Set(
      items.flatMap((item) =>
        (item.tags ? item.tags.split(',').map((t) => t.trim()).filter(Boolean) : [])
      )
    )
  );

  const filtered = items.filter((item) => {
    if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
    if (filterTag && !item.tags?.split(',').map((t) => t.trim()).includes(filterTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hit =
        item.file_name?.toLowerCase().includes(q) ||
        item.caption?.toLowerCase().includes(q) ||
        item.tags?.toLowerCase().includes(q) ||
        (item.source === 'marketing' && (item as MarketingMediaItem).title?.toLowerCase().includes(q)) ||
        (item.source === 'project' && (item as any).project_name?.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  const marketingCount = items.filter((i) => i.source === 'marketing').length;
  const projectCount = items.filter((i) => i.source === 'project').length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          to="/marketing"
          style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14 }}
        >
          ← Marketing
        </Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Media Library</h1>
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
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => { setSelectMode((s) => !s); setSelectedIds(new Set()); }}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid',
            borderColor: selectMode ? '#7c3aed' : '#d1d5db',
            background: selectMode ? '#f5f3ff' : '#fff',
            color: selectMode ? '#7c3aed' : '#6b7280',
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
          background: '#fafaf9',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <span style={{ fontSize: 20 }}>🖼️</span>
          <span>Drop or <span style={{ color: '#7c3aed', textDecoration: 'underline' }}>browse</span></span>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: '#e5e7eb', margin: '0 2px' }} />
        <input
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, minWidth: 110, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        />
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
          accept="image/jpeg,image/png,image/heic,image/heif"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            background: '#7c3aed',
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
          {uploading ? 'Uploading…' : 'Upload Media'}
        </button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 15, pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search title, caption, tags, project…"
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
            {filtered.length} of {items.length}
          </span>
        )}
      </div>

      {/* Source + tag filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'marketing', 'project'] as SourceFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              style={{
                padding: '5px 14px',
                borderRadius: 16,
                border: '1px solid',
                borderColor: sourceFilter === s ? '#7c3aed' : '#d1d5db',
                background: sourceFilter === s ? '#f5f3ff' : '#fff',
                color: sourceFilter === s ? '#7c3aed' : '#6b7280',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {s === 'all' ? `All (${items.length})` : s === 'marketing' ? `Marketing (${marketingCount})` : `Projects (${projectCount})`}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterTag('')}
              style={{
                padding: '4px 12px',
                borderRadius: 16,
                border: '1px solid',
                borderColor: filterTag === '' ? '#7c3aed' : '#e5e7eb',
                background: filterTag === '' ? '#f5f3ff' : '#f9fafb',
                color: filterTag === '' ? '#7c3aed' : '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              All tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag === filterTag ? '' : tag)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  border: '1px solid',
                  borderColor: filterTag === tag ? '#7c3aed' : '#e5e7eb',
                  background: filterTag === tag ? '#f5f3ff' : '#f9fafb',
                  color: filterTag === tag ? '#7c3aed' : '#6b7280',
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
        <p style={{ color: '#6b7280', textAlign: 'center' }}>Loading media…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🖼️</div>
          <p style={{ margin: 0 }}>No media found. Upload the first item above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map((item) => {
            const isMarketing = item.source === 'marketing';
            const displayTitle = isMarketing
              ? (item as MarketingMediaItem).title || item.file_name
              : item.file_name;
            const projectName = !isMarketing ? (item as any).project_name : null;
            const jobNumber = !isMarketing ? (item as any).job_number : null;

            return (
              <div
                key={`${item.source}-${item.id}`}
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  border: isMarketing ? '2px solid #ede9fe' : '2px solid #e0f2fe',
                  outline: selectMode && isMarketing && selectedIds.has(item.id) ? '3px solid #7c3aed' : 'none',
                  outlineOffset: '-1px',
                  opacity: selectMode && !isMarketing ? 0.55 : 1,
                }}
              >
                {/* Source badge */}
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      zIndex: 2,
                      background: isMarketing ? '#7c3aed' : '#0284c7',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {isMarketing ? 'Marketing' : 'Project'}
                  </div>
                  <div
                    style={{ paddingTop: '66%', background: '#f3f4f6', cursor: 'pointer', position: 'relative' }}
                    onClick={() => {
                      if (selectMode) {
                        if (isMarketing) toggleSelect(item.id);
                      } else {
                        setLightboxItem(item);
                      }
                    }}
                  >
                    {selectMode && isMarketing && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 3,
                        width: 22, height: 22, borderRadius: 5,
                        border: '2px solid #fff',
                        background: selectedIds.has(item.id) ? '#7c3aed' : 'rgba(0,0,0,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}>
                        {selectedIds.has(item.id) && (
                          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>
                        )}
                      </div>
                    )}
                    <img
                      src={resolveMediaUrl(item.thumb_url || item.feed_url || item.url)}
                      alt={displayTitle}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                </div>

                <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', fontWeight: 500, lineHeight: 1.3 }}>
                    {displayTitle}
                  </p>
                  {!isMarketing && projectName && (
                    <p style={{ margin: 0, fontSize: 11, color: '#0284c7' }}>
                      {jobNumber ? `${jobNumber} · ` : ''}{projectName}
                    </p>
                  )}
                  {item.caption && (
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{item.caption}</p>
                  )}
                  {item.tags && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {item.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                        <span
                          key={t}
                          style={{
                            background: isMarketing ? '#f5f3ff' : '#e0f2fe',
                            color: isMarketing ? '#7c3aed' : '#0284c7',
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
                    {item.uploaded_by_name} · {new Date(item.created_at).toLocaleDateString()}
                  </p>

                  {isMarketing && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        onClick={() => openEdit(item as MarketingMediaItem)}
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
                        onClick={() => handleDelete(item)}
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
                  )}
                  {!isMarketing && (
                    <Link
                      to={`/projects/${(item as any).project_id}/photos`}
                      style={{ fontSize: 12, color: '#0284c7', textDecoration: 'none', marginTop: 6 }}
                    >
                      View in project →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setLightboxItem(null)}
        >
          <button
            onClick={() => setLightboxItem(null)}
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
            src={resolveMediaUrl(lightboxItem.feed_url || lightboxItem.url)}
            alt={lightboxItem.file_name}
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxItem.caption && (
            <p style={{ color: '#e5e7eb', marginTop: 16, fontSize: 15 }}>{lightboxItem.caption}</p>
          )}
        </div>
      )}

      {/* Edit modal (marketing items only) */}
      {editingItem && (
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
          onClick={() => setEditingItem(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 28,
              width: 420,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 600 }}>Edit Media</h3>
            {(['Title', 'Caption', 'Tags (comma separated)'] as const).map((label, i) => {
              const val = [editTitle, editCaption, editTags][i];
              const setter = [setEditTitle, setEditCaption, setEditTags][i];
              return (
                <div key={label} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                    {label}
                  </label>
                  <input
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setEditingItem(null)}
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
                onClick={() =>
                  updateMutation.mutate({ id: editingItem.id, title: editTitle, caption: editCaption, tags: editTags })
                }
                disabled={updateMutation.isPending}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#7c3aed',
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
            onClick={() => setSelectedIds(new Set(
              filtered.filter((i) => i.source === 'marketing').map((i) => i.id)
            ))}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: 12, cursor: 'pointer' }}
          >
            Select all marketing ({filtered.filter((i) => i.source === 'marketing').length})
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
              background: selectedIds.size === 0 ? '#334155' : '#7c3aed',
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
            style={{ background: '#fff', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600 }}>
              Edit {selectedIds.size} Item{selectedIds.size !== 1 ? 's' : ''}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
              Leave a field blank to keep existing values unchanged.
            </p>

            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Title</label>
            <input
              value={bulkTitle}
              onChange={(e) => setBulkTitle(e.target.value)}
              placeholder="Leave blank to keep existing"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 16, fontSize: 14, boxSizing: 'border-box' }}
            />

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
              placeholder="e.g. campaign, exterior, 2026"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 12, fontSize: 14, boxSizing: 'border-box' }}
            />

            {bulkTags && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  onClick={() => setBulkTagMode('append')}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid',
                    borderColor: bulkTagMode === 'append' ? '#7c3aed' : '#d1d5db',
                    background: bulkTagMode === 'append' ? '#f5f3ff' : '#fff',
                    color: bulkTagMode === 'append' ? '#7c3aed' : '#6b7280',
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
                style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                {bulkUpdateMutation.isPending ? 'Saving…' : `Apply to ${selectedIds.size} items`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
