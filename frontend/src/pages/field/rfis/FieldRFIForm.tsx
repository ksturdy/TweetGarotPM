import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import { rfisApi } from '../../../services/rfis';
import FieldPhotoUpload from '../../../components/field/FieldPhotoUpload';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const DISCIPLINE_OPTIONS = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'piping', label: 'Piping' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'controls', label: 'Controls' },
  { value: 'other', label: 'Other' },
];

const FieldRFIForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [priority, setPriority] = useState('normal');
  const [discipline, setDiscipline] = useState('');
  const [drawingSheet, setDrawingSheet] = useState('');
  const [specSection, setSpecSection] = useState('');

  const { data: existingRfi } = useQuery({
    queryKey: ['field-rfi', id],
    queryFn: async () => {
      const res = await rfisApi.getById(Number(id));
      return res.data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingRfi) {
      setSubject(existingRfi.subject || '');
      setQuestion(existingRfi.question || '');
      setPriority(existingRfi.priority || 'normal');
      setDiscipline(existingRfi.discipline || '');
      setDrawingSheet(existingRfi.drawing_sheet || '');
      setSpecSection(existingRfi.spec_section || '');
    }
  }, [existingRfi]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const res = await rfisApi.update(Number(id), {
          subject,
          question,
          priority,
          discipline: (discipline as any) || undefined,
          drawing_sheet: drawingSheet || undefined,
          spec_section: specSection || undefined,
        } as any);
        return res.data;
      }
      const res = await rfisApi.create({
        projectId: Number(projectId),
        subject,
        question,
        priority,
        discipline: (discipline as any) || undefined,
        drawingSheet: drawingSheet || undefined,
        specSection: specSection || undefined,
        source: 'field',
      } as any);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['field-rfis', projectId] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['field-rfi', id] });
        navigate(`/field/projects/${projectId}/rfis/${id}`);
      } else {
        navigate(`/field/projects/${projectId}/rfis/${data.id}`);
      }
    },
  });

  const handleSave = async () => {
    if (!subject.trim() || !question.trim()) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="field-page-title">{isEdit ? 'Edit RFI' : 'New RFI'}</h1>
      <p className="field-page-subtitle">Submit a request for information to the PM</p>

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
        <div className="field-form-section-title">Discipline</div>
        <div className="field-ppe-grid">
          {DISCIPLINE_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`field-ppe-item ${discipline === opt.value ? 'selected' : ''}`}
              onClick={() => setDiscipline(discipline === opt.value ? '' : opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>

      <div className="field-form-section">
        <div className="field-form-section-title">RFI Details</div>

        <div className="field-form-group">
          <label className="field-form-label">Subject *</label>
          <input
            type="text"
            className="field-form-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief subject of the RFI"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Question *</label>
          <textarea
            className="field-form-textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you need clarification on?"
            rows={5}
            style={{ minHeight: 120 }}
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Drawing Sheet Reference</label>
          <input
            type="text"
            className="field-form-input"
            value={drawingSheet}
            onChange={(e) => setDrawingSheet(e.target.value)}
            placeholder="e.g., M-101, M-102"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Spec Section</label>
          <input
            type="text"
            className="field-form-input"
            value={specSection}
            onChange={(e) => setSpecSection(e.target.value)}
            placeholder="e.g., 23 05 00"
          />
        </div>
      </div>

      {/* Photos (edit mode only) */}
      {isEdit && id && (
        <FieldPhotoUpload entityType="rfi" entityId={Number(id)} />
      )}

      {/* Save Button */}
      <div className="field-actions-bar">
        <button
          className="field-btn field-btn-success"
          onClick={handleSave}
          disabled={saving || !subject.trim() || !question.trim()}
          type="button"
          style={{ opacity: saving || !subject.trim() || !question.trim() ? 0.5 : 1 }}
        >
          <SaveIcon style={{ fontSize: 18 }} />
          {saving ? 'Saving...' : isEdit ? 'Update RFI' : 'Submit RFI'}
        </button>
      </div>
    </div>
  );
};

export default FieldRFIForm;
