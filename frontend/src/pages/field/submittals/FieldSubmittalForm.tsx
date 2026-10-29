import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import { submittalsApi } from '../../../services/submittals';

const STATUS_OPTIONS = [
  { value: 'requested_from_vendor', label: 'Requested from Vendor' },
  { value: 'submitted_for_approval', label: 'Submitted for Approval' },
  { value: 'revise_resubmit', label: 'Revise and Resubmit' },
  { value: 'approved', label: 'Approved' },
];

const FieldSubmittalForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [specSection, setSpecSection] = useState('');
  const [description, setDescription] = useState('');
  const [subcontractor, setSubcontractor] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('requested_from_vendor');
  const [error, setError] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['field-submittal', id],
    queryFn: async () => {
      const res = await submittalsApi.getById(Number(id));
      return res.data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name || '');
      setSpecSection(existing.spec_section || '');
      setDescription(existing.description || '');
      setSubcontractor(existing.subcontractor || '');
      setDueDate(existing.due_date ? existing.due_date.split('T')[0] : '');
      setStatus(existing.status || 'requested_from_vendor');
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const res = await submittalsApi.update(Number(id), {
          name,
          spec_section: specSection,
          description,
          subcontractor: subcontractor || undefined,
          due_date: dueDate || undefined,
          status,
        } as any);
        return res.data;
      }
      const res = await submittalsApi.create({
        projectId: Number(projectId),
        name,
        specSection,
        description,
        subcontractor: subcontractor || undefined,
        dueDate: dueDate || undefined,
      } as any);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['field-submittals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['submittals', projectId] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['field-submittal', id] });
        navigate(`/field/projects/${projectId}/submittals/${id}`);
      } else {
        navigate(`/field/projects/${projectId}/submittals/${data.id}`);
      }
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.error ||
        'Error saving submittal. Please try again.'
      );
    },
  });

  const handleSave = async () => {
    if (!name.trim() || !specSection.trim() || !description.trim()) {
      setError('Name, Spec Section, and Description are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await saveMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="field-page-title">{isEdit ? 'Edit Submittal' : 'New Submittal'}</h1>
      <p className="field-page-subtitle">
        {isEdit ? 'Update submittal details' : 'Submit shop drawings or product data'}
      </p>

      {isEdit && (
        <div className="field-form-section">
          <div className="field-form-section-title">Status</div>
          <div className="field-ppe-grid">
            {STATUS_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className={`field-ppe-item ${status === opt.value ? 'selected' : ''}`}
                onClick={() => setStatus(opt.value)}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="field-form-section">
        <div className="field-form-section-title">Submittal Details</div>

        <div className="field-form-group">
          <label className="field-form-label">Submittal Name *</label>
          <input
            type="text"
            className="field-form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., HVAC Equipment Submittal"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Spec Section *</label>
          <input
            type="text"
            className="field-form-input"
            value={specSection}
            onChange={(e) => setSpecSection(e.target.value)}
            placeholder="e.g., 23 05 13"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Description *</label>
          <textarea
            className="field-form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the submittal content"
            rows={4}
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Vendor / Supplier</label>
          <input
            type="text"
            className="field-form-input"
            value={subcontractor}
            onChange={(e) => setSubcontractor(e.target.value)}
            placeholder="Vendor or supplier name"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Due Date</label>
          <input
            type="date"
            className="field-form-input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div style={{ margin: '0 0 16px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="field-actions-bar">
        <button
          className="field-btn field-btn-success"
          onClick={handleSave}
          disabled={saving}
          type="button"
          style={{ opacity: saving ? 0.5 : 1 }}
        >
          <SaveIcon style={{ fontSize: 18 }} />
          {saving ? 'Saving...' : isEdit ? 'Update Submittal' : 'Create Submittal'}
        </button>
      </div>
    </div>
  );
};

export default FieldSubmittalForm;
