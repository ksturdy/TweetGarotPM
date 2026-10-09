import React, { useEffect, useRef, useState } from 'react';
import { MODULE_OPTIONS, SUBMODULE_OPTIONS, feedbackService, UserSearchResult } from '../../services/feedback';
import './FeedbackForm.css';

interface FeedbackFormProps {
  onSubmit: (data: {
    module: string;
    submodule?: string;
    title: string;
    description: string;
    type: 'bug' | 'enhancement' | 'feature_request' | 'improvement' | 'other';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    files?: File[];
    watcherIds?: number[];
  }) => Promise<void>;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB — matches backend attachments cap
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FeedbackForm: React.FC<FeedbackFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    module: '',
    submodule: '',
    title: '',
    description: '',
    type: 'enhancement' as 'bug' | 'enhancement' | 'feature_request' | 'improvement' | 'other',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [pasteFlash, setPasteFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Watcher typeahead state
  const [watchers, setWatchers] = useState<UserSearchResult[]>([]);
  const [addingWatcher, setAddingWatcher] = useState(false);
  const [watcherSearch, setWatcherSearch] = useState('');
  const [watcherResults, setWatcherResults] = useState<UserSearchResult[]>([]);
  const [watcherSearchLoading, setWatcherSearchLoading] = useState(false);
  const watcherInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingWatcher) watcherInputRef.current?.focus();
  }, [addingWatcher]);

  useEffect(() => {
    if (!watcherSearch.trim() || watcherSearch.length < 2) { setWatcherResults([]); return; }
    const tid = setTimeout(async () => {
      setWatcherSearchLoading(true);
      try { setWatcherResults(await feedbackService.searchUsers(watcherSearch)); }
      catch { setWatcherResults([]); }
      finally { setWatcherSearchLoading(false); }
    }, 250);
    return () => clearTimeout(tid);
  }, [watcherSearch]);

  const handlePickWatcher = (result: UserSearchResult) => {
    if (!watchers.some(w => w.id === result.id)) {
      setWatchers(prev => [...prev, result]);
    }
    setAddingWatcher(false);
    setWatcherSearch('');
    setWatcherResults([]);
  };

  const removeWatcher = (id: number) => {
    setWatchers(prev => prev.filter(w => w.id !== id));
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;

    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        rejected.push(`${file.name} (unsupported type)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name} (over 20 MB)`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      setFiles(prev => [...prev, ...accepted]);
    }

    if (rejected.length > 0) {
      setErrors(prev => ({ ...prev, files: `Skipped: ${rejected.join(', ')}` }));
    } else if (errors.files) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.files;
        return next;
      });
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    addFiles(selected);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLFormElement>) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const pasted: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const blob = item.getAsFile();
      if (!blob) continue;
      // Clipboard images arrive with generic names like "image.png" — make them unique.
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const name = blob.name && blob.name !== 'image.png'
        ? blob.name
        : `pasted-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
      pasted.push(new File([blob], name, { type: blob.type }));
    }

    if (pasted.length === 0) return;

    e.preventDefault();
    addFiles(pasted);
    setPasteFlash(true);
    window.setTimeout(() => setPasteFlash(false), 600);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.module) {
      newErrors.module = 'Module is required';
    }
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        submodule: formData.submodule || undefined,
        files: files.length > 0 ? files : undefined,
        watcherIds: watchers.length > 0 ? watchers.map(w => w.id) : undefined,
      });

      // Reset form
      setFormData({
        module: '',
        submodule: '',
        title: '',
        description: '',
        type: 'enhancement',
        priority: 'medium'
      });
      setFiles([]);
      setWatchers([]);
      setErrors({});
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setErrors({ submit: 'Failed to submit feedback. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Reset submodule when module changes
      ...(field === 'module' ? { submodule: '' } : {})
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const availableSubmodules = formData.module ? SUBMODULE_OPTIONS[formData.module] || [] : [];

  return (
    <div className="feedback-form-container">
      <h2 className="feedback-form-title">Submit Feedback</h2>
      <p className="feedback-form-subtitle">
        Help us improve Titan by sharing your ideas, reporting bugs, or suggesting enhancements.
      </p>

      <form onSubmit={handleSubmit} onPaste={handlePaste} className="feedback-form">
        <div className="form-row form-row-4">
          <div className="form-group">
            <label htmlFor="type">Type *</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="form-control"
            >
              <option value="bug">🐛 Bug</option>
              <option value="enhancement">✨ Enhancement</option>
              <option value="feature_request">🚀 Feature</option>
              <option value="improvement">📈 Improvement</option>
              <option value="other">💡 Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="form-control"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="module">Module *</label>
            <select
              id="module"
              value={formData.module}
              onChange={(e) => handleChange('module', e.target.value)}
              className={`form-control ${errors.module ? 'is-invalid' : ''}`}
            >
              <option value="">Select...</option>
              {MODULE_OPTIONS.map(module => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
            {errors.module && <div className="invalid-feedback">{errors.module}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="submodule">Submodule</label>
            <select
              id="submodule"
              value={formData.submodule}
              onChange={(e) => handleChange('submodule', e.target.value)}
              className="form-control"
              disabled={!availableSubmodules.length}
            >
              <option value="">Select...</option>
              {availableSubmodules.map(submodule => (
                <option key={submodule} value={submodule}>{submodule}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className={`form-control ${errors.title ? 'is-invalid' : ''}`}
            placeholder="Brief summary of your feedback..."
            maxLength={255}
          />
          {errors.title && <div className="invalid-feedback">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description *</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className={`form-control ${errors.description ? 'is-invalid' : ''}`}
            placeholder="Provide detailed information about your feedback. For bugs, include steps to reproduce. For enhancements, describe the desired functionality..."
            rows={4}
          />
          {errors.description && <div className="invalid-feedback">{errors.description}</div>}
          <div className="character-count">
            {formData.description.length} characters
          </div>
        </div>

        <div className={`form-group feedback-attachments-zone${pasteFlash ? ' is-pasted' : ''}`}>
          <label htmlFor="feedback-attachments">Attachments</label>
          <input
            ref={fileInputRef}
            id="feedback-attachments"
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf,.xlsx,.xls,.docx,.doc"
            multiple
            onChange={handleFilesChange}
            className="form-control feedback-file-input"
          />
          <div className="feedback-file-hint">
            Images or PDFs, up to 20 MB each. Tip: paste a screenshot here with Ctrl+V.
          </div>
          {files.length > 0 && (
            <ul className="feedback-file-list">
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="feedback-file-item">
                  <span className="feedback-file-name">{file.name}</span>
                  <span className="feedback-file-size">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="feedback-file-remove"
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {errors.files && <div className="invalid-feedback">{errors.files}</div>}
        </div>

        {/* Watchers */}
        <div className="form-group">
          <label>Watching</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', minHeight: 28 }}>
            {watchers.map(w => (
              <span
                key={w.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99,
                  background: '#f0f4ff', border: '1px solid #c7d4f0', color: '#1e3a6e',
                }}
              >
                {w.first_name} {w.last_name}
                <button
                  type="button"
                  onClick={() => removeWatcher(w.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.65rem', padding: 0, lineHeight: 1 }}
                  aria-label={`Remove ${w.first_name}`}
                >✕</button>
              </span>
            ))}

            {addingWatcher ? (
              <div style={{ position: 'relative' }}>
                <input
                  ref={watcherInputRef}
                  value={watcherSearch}
                  onChange={e => setWatcherSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setAddingWatcher(false); setWatcherSearch(''); setWatcherResults([]); }
                  }}
                  placeholder="Search name…"
                  style={{ fontSize: '0.75rem', padding: '3px 7px', borderRadius: 6, border: '1px solid #d1d5db', width: 140, outline: 'none' }}
                />
                {(watcherSearchLoading || watcherResults.length > 0) && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 200, marginTop: 2 }}>
                    {watcherSearchLoading && <div style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#9ca3af' }}>Searching…</div>}
                    {watcherResults.map(r => {
                      const already = watchers.some(w => w.id === r.id);
                      return (
                        <div
                          key={r.id}
                          onClick={() => !already && handlePickWatcher(r)}
                          style={{
                            padding: '6px 10px', fontSize: '0.8rem',
                            cursor: already ? 'default' : 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            color: already ? '#9ca3af' : '#111827',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                          onMouseEnter={e => { if (!already) (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
                        >
                          <span>{r.first_name} {r.last_name}</span>
                          {already && <span style={{ fontSize: '0.65rem' }}>already added</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingWatcher(true)}
                style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, border: '1px dashed #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}
              >
                + Add
              </button>
            )}
          </div>
        </div>

        {errors.submit && (
          <div className="alert alert-danger">
            {errors.submit}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ padding: '2px 10px', fontSize: '11px', height: '24px', width: 'auto', display: 'inline-flex', flex: 'none' }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>

      <div className="feedback-tips">
        <h3>Tips for Great Feedback</h3>
        <ul>
          <li><strong>Be specific:</strong> Include details about what you're experiencing or what you'd like to see</li>
          <li><strong>One topic per submission:</strong> Submit separate feedback for different issues or ideas</li>
          <li><strong>Search first:</strong> Check if someone has already submitted similar feedback and vote for it</li>
          <li><strong>Include context:</strong> For bugs, describe what you expected vs. what happened</li>
        </ul>
      </div>
    </div>
  );
};

export default FeedbackForm;
