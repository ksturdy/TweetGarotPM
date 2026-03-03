import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import { smFittingOrdersApi, SmFittingOrder } from '../../../services/smFittingOrders';

const FieldSmFittingOrderForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Partial<SmFittingOrder>>({
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
    material_gauge: '',
    duct_type: '',
    dimensions: '',
    insulation_required: false,
    insulation_spec: '',
    liner_required: false,
    quantity: 1,
    unit: 'EA',
    cost_code: '',
    phase_code: '',
    notes: '',
  });

  const { isLoading: loadingExisting } = useQuery({
    queryKey: ['field-sm-fitting-order', id],
    queryFn: async () => {
      const res = await smFittingOrdersApi.getById(Number(id));
      setForm(res.data);
      return res.data;
    },
    enabled: isEdit,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SmFittingOrder>) => smFittingOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-orders'] });
      navigate(`/field/projects/${projectId}/sm-fitting-orders`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SmFittingOrder>) =>
      smFittingOrdersApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-orders'] });
      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-order', id] });
      navigate(`/field/projects/${projectId}/sm-fitting-orders/${id}`);
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
        {isEdit ? 'Edit Fitting Order' : 'New SM Fitting Order'}
      </h1>
      <p className="field-page-subtitle">Sheet metal fabrication request</p>

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
            placeholder="233113"
          />
        </div>
        <div className="field-form-group">
          <label className="field-form-label">Location on Site</label>
          <input
            className="field-form-input"
            name="location_on_site"
            value={form.location_on_site || ''}
            onChange={handleChange}
            placeholder="2nd Floor, Mechanical Room"
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
              <option value="Galvanized">Galvanized</option>
              <option value="Aluminum">Aluminum</option>
              <option value="Stainless Steel">Stainless Steel</option>
              <option value="Black Iron">Black Iron</option>
            </select>
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Material Gauge</label>
            <input
              className="field-form-input"
              name="material_gauge"
              value={form.material_gauge || ''}
              onChange={handleChange}
              placeholder="26 ga"
            />
          </div>
        </div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Duct Type</label>
            <select
              className="field-form-select"
              name="duct_type"
              value={form.duct_type || ''}
              onChange={handleChange}
            >
              <option value="">Select...</option>
              <option value="Rectangular">Rectangular</option>
              <option value="Round">Round</option>
              <option value="Oval">Oval</option>
            </select>
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Dimensions</label>
            <input
              className="field-form-input"
              name="dimensions"
              value={form.dimensions || ''}
              onChange={handleChange}
              placeholder='24" x 12"'
            />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="field-form-section">
        <div className="field-form-section-title">Options</div>
        <label className="field-form-checkbox">
          <input
            type="checkbox"
            name="insulation_required"
            checked={form.insulation_required || false}
            onChange={handleChange}
          />
          Insulation Required
        </label>
        {form.insulation_required && (
          <div className="field-form-group">
            <label className="field-form-label">Insulation Spec</label>
            <input
              className="field-form-input"
              name="insulation_spec"
              value={form.insulation_spec || ''}
              onChange={handleChange}
              placeholder='1" Fiberglass wrap'
            />
          </div>
        )}
        <label className="field-form-checkbox">
          <input
            type="checkbox"
            name="liner_required"
            checked={form.liner_required || false}
            onChange={handleChange}
          />
          Liner Required
        </label>
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

export default FieldSmFittingOrderForm;
