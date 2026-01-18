import React, { useState } from 'react';
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
  }) => Promise<void>;
}

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
        submodule: formData.submodule || undefined
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

      <form onSubmit={handleSubmit} className="feedback-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="type">Type *</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="form-control"
            >
              <option value="bug">🐛 Bug Report</option>
              <option value="enhancement">✨ Enhancement</option>
              <option value="feature_request">🚀 Feature Request</option>
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
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="module">Module *</label>
            <select
              id="module"
              value={formData.module}
              onChange={(e) => handleChange('module', e.target.value)}
              className={`form-control ${errors.module ? 'is-invalid' : ''}`}
            >
              <option value="">Select a module...</option>
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
              <option value="">Select a submodule...</option>
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
            rows={8}
          />
          {errors.description && <div className="invalid-feedback">{errors.description}</div>}
          <div className="character-count">
            {formData.description.length} characters
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
