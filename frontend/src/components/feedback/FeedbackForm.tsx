import React, { useRef, useState } from 'react';
import { MODULE_OPTIONS, SUBMODULE_OPTIONS } from '../../services/feedback';
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
  }) => Promise<void>;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB — matches backend attachments cap
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'application/pdf'];

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
        files: files.length > 0 ? files : undefined
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
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf"
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
