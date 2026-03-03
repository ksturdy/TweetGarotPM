import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import { pipingFittingOrdersApi, PipingFittingOrder } from '../../../services/pipingFittingOrders';

const FieldPipingFittingOrderForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Partial<PipingFittingOrder>>({
    project_id: Number(projectId),
    title: '',
    description: '',
    priority: 'normal',
    required_by_date: null,
    drawing_number: '',
    drawing_revision: '',
    spec_section: '',
    location_on_site: '',
    material_type: '',
    pipe_size: '',
    pipe_schedule: '',
    fitting_type: '',
    weld_required: false,
    weld_spec: '',
    quantity: 1,
    unit: 'EA',
    cost_code: '',
    phase_code: '',
    notes: '',
  });

  const { isLoading: loadingExisting } = useQuery({
    queryKey: ['field-piping-fitting-order', id],
    queryFn: async () => {
      const res = await pipingFittingOrdersApi.getById(Number(id));
      setForm(res.data);
      return res.data;
    },
    enabled: isEdit,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PipingFittingOrder>) => pipingFittingOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-piping-fitting-orders'] });
      navigate(`/field/projects/${projectId}/piping-fitting-orders`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PipingFittingOrder>) =>
      pipingFittingOrdersApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-piping-fitting-orders'] });
      queryClient.invalidateQueries({ queryKey: ['field-piping-fitting-order', id] });
      navigate(`/field/projects/${projectId}/piping-fitting-orders/${id}`);
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target;
    const name = target.name;
    const value =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!form.title?.trim()) return;
    if (isEdit) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  if (isEdit && loadingExisting) {
    return <div className="field-loading">Loading order...</div>;
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <h1 className="field-page-title">
        {isEdit ? 'Edit Fitting Order' : 'New Piping Fitting Order'}
      </h1>
      <p className="field-page-subtitle">Piping fabrication request</p>

      {/* Order Details */}
      <div className="field-form-section">
        <div className="field-form-section-title">Order Details</div>
        <div className="field-form-group">
          <label className="field-form-label">Title *</label>
          <input
            className="field-form-input"
            name="title"
            value={form.title || ''}
            onChange={handleChange}
            placeholder="Brief description of fitting needed"
          />
        </div>
        <div className="field-form-group">
          <label className="field-form-label">Description</label>
          <textarea
            className="field-form-textarea"
            name="description"
            value={form.description || ''}
            onChange={handleChange}
            placeholder="Detailed description..."
          />
        </div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Priority</label>
            <select
              className="field-form-select"
              name="priority"
              value={form.priority || 'normal'}
              onChange={handleChange}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Required By</label>
            <input
              className="field-form-input"
              type="date"
              name="required_by_date"
              value={form.required_by_date || ''}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Drawing Reference */}
      <div className="field-form-section">
        <div className="field-form-section-title">Drawing Reference</div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Drawing Number</label>
            <input
              className="field-form-input"
              name="drawing_number"
              value={form.drawing_number || ''}
              onChange={handleChange}
              placeholder="DWG-001"
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Revision</label>
            <input
              className="field-form-input"
              name="drawing_revision"
              value={form.drawing_revision || ''}
              onChange={handleChange}
              placeholder="Rev A"
            />
          </div>
        </div>
        <div className="field-form-group">
          <label className="field-form-label">Spec Section</label>
          <input
            className="field-form-input"
            name="spec_section"
            value={form.spec_section || ''}
            onChange={handleChange}
            placeholder="231113"
          />
        </div>
        <div className="field-form-group">
          <label className="field-form-label">Location on Site</label>
          <input
            className="field-form-input"
            name="location_on_site"
            value={form.location_on_site || ''}
            onChange={handleChange}
            placeholder="Boiler Room, Basement"
          />
        </div>
      </div>

      {/* Material Specs */}
      <div className="field-form-section">
        <div className="field-form-section-title">Material Specs</div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Material Type</label>
            <select
              className="field-form-select"
              name="material_type"
              value={form.material_type || ''}
              onChange={handleChange}
            >
              <option value="">Select...</option>
              <option value="Black Iron">Black Iron</option>
              <option value="Copper">Copper</option>
              <option value="Stainless Steel">Stainless Steel</option>
              <option value="PVC">PVC</option>
              <option value="CPVC">CPVC</option>
              <option value="Carbon Steel">Carbon Steel</option>
            </select>
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Pipe Size</label>
            <input
              className="field-form-input"
              name="pipe_size"
              value={form.pipe_size || ''}
              onChange={handleChange}
              placeholder='2"'
            />
          </div>
        </div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Pipe Schedule</label>
            <input
              className="field-form-input"
              name="pipe_schedule"
              value={form.pipe_schedule || ''}
              onChange={handleChange}
              placeholder="Sch 40"
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Fitting Type</label>
            <input
              className="field-form-input"
              name="fitting_type"
              value={form.fitting_type || ''}
              onChange={handleChange}
              placeholder="90 Elbow"
            />
          </div>
        </div>
      </div>

      {/* Welding Options */}
      <div className="field-form-section">
        <div className="field-form-section-title">Options</div>
        <label className="field-form-checkbox">
          <input
            type="checkbox"
            name="weld_required"
            checked={form.weld_required || false}
            onChange={handleChange}
          />
          Weld Required
        </label>
        {form.weld_required && (
          <div className="field-form-group">
            <label className="field-form-label">Weld Spec</label>
            <input
              className="field-form-input"
              name="weld_spec"
              value={form.weld_spec || ''}
              onChange={handleChange}
              placeholder="ASME B31.1"
            />
          </div>
        )}
      </div>

      {/* Quantities */}
      <div className="field-form-section">
        <div className="field-form-section-title">Quantities</div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Quantity</label>
            <input
              className="field-form-input"
              type="number"
              name="quantity"
              value={form.quantity || ''}
              onChange={handleChange}
              min="1"
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Unit</label>
            <select
              className="field-form-select"
              name="unit"
              value={form.unit || 'EA'}
              onChange={handleChange}
            >
              <option value="EA">EA</option>
              <option value="LF">LF</option>
              <option value="SF">SF</option>
            </select>
          </div>
        </div>
      </div>

      {/* Coding */}
      <div className="field-form-section">
        <div className="field-form-section-title">Coding</div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Cost Code</label>
            <input
              className="field-form-input"
              name="cost_code"
              value={form.cost_code || ''}
              onChange={handleChange}
              placeholder="Cost code"
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Phase Code</label>
            <input
              className="field-form-input"
              name="phase_code"
              value={form.phase_code || ''}
              onChange={handleChange}
              placeholder="Phase code"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="field-form-section">
        <div className="field-form-section-title">Notes</div>
        <div className="field-form-group">
          <textarea
            className="field-form-textarea"
            name="notes"
            value={form.notes || ''}
            onChange={handleChange}
            placeholder="Additional notes or instructions..."
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, marginBottom: 24 }}>
        <button
          className="field-btn field-btn-secondary"
          onClick={() => navigate(-1)}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          className="field-btn field-btn-primary"
          onClick={handleSubmit}
          disabled={isSaving || !form.title?.trim()}
          style={{ flex: 2 }}
        >
          <SaveIcon style={{ fontSize: 18 }} />
          {isSaving ? 'Saving...' : isEdit ? 'Update Order' : 'Save Draft'}
        </button>
      </div>
    </div>
  );
};

export default FieldPipingFittingOrderForm;
