import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import { fieldIssuesApi, TRADE_OPTIONS, PRIORITY_OPTIONS } from '../../../services/fieldIssues';

const FieldIssueForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [trade, setTrade] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const { data: existingIssue } = useQuery({
    queryKey: ['field-issue', id],
    queryFn: async () => {
      const res = await fieldIssuesApi.getById(Number(id));
      return res.data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingIssue) {
      setTitle(existingIssue.title || '');
      setDescription(existingIssue.description || '');
      setPriority(existingIssue.priority || 'normal');
      setTrade(existingIssue.trade || '');
      setLocation(existingIssue.location || '');
      setNotes(existingIssue.notes || '');
    }
  }, [existingIssue]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const res = await fieldIssuesApi.update(Number(id), {
          title,
          description,
          priority: priority as any,
          trade,
          location,
          notes,
        });
        return res.data;
      }
      const res = await fieldIssuesApi.create({
        project_id: Number(projectId),
        title,
        description,
        priority: priority as any,
        trade: trade || undefined,
        location: location || undefined,
        notes: notes || undefined,
      } as any);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-issues', projectId] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['field-issue', id] });
      }
      navigate(`/field/projects/${projectId}/issues`);
    },
  });

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="field-page-title">{isEdit ? 'Edit Issue' : 'New Issue'}</h1>
      <p className="field-page-subtitle">Report a field issue for the PM</p>

      <div className="field-form-section">
        <div className="field-form-section-title">Priority</div>
        <div className="field-ppe-grid">
          {PRIORITY_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`field-ppe-item ${priority === opt.value ? 'selected' : ''}`}
              onClick={() => setPriority(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>

      <div className="field-form-section">
        <div className="field-form-section-title">Trade / Discipline</div>
        <div className="field-ppe-grid">
          {TRADE_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`field-ppe-item ${trade === opt.value ? 'selected' : ''}`}
              onClick={() => setTrade(trade === opt.value ? '' : opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>

      <div className="field-form-section">
        <div className="field-form-section-title">Details</div>

        <div className="field-form-group">
          <label className="field-form-label">Title *</label>
          <input
            type="text"
            className="field-form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of the issue"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Description *</label>
          <textarea
            className="field-form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            rows={5}
            style={{ minHeight: 120 }}
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Location on Site</label>
          <input
            type="text"
            className="field-form-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., 2nd Floor Mechanical Room"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Additional Notes</label>
          <textarea
            className="field-form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={3}
            style={{ minHeight: 80 }}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="field-actions-bar">
        <button
          className="field-btn field-btn-success"
          onClick={handleSave}
          disabled={saving || !title.trim() || !description.trim()}
          type="button"
          style={{ opacity: saving || !title.trim() || !description.trim() ? 0.5 : 1 }}
        >
          <SaveIcon style={{ fontSize: 18 }} />
          {saving ? 'Saving...' : isEdit ? 'Update Issue' : 'Save Issue'}
        </button>
      </div>
    </div>
  );
};

export default FieldIssueForm;
