import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { pipingFittingOrdersApi, PipingFittingOrder, PipingFittingOrderItem } from '../../../services/pipingFittingOrders';

const FITTING_TYPES = [
  { value: '90', label: '90\u00B0 Elbow' },
  { value: '45', label: '45\u00B0 Elbow' },
  { value: 'tee', label: 'Tee' },
  { value: 'wye', label: 'Wye' },
  { value: 'reducer', label: 'Reducer' },
  { value: 'coupling', label: 'Coupling' },
  { value: 'union', label: 'Union' },
  { value: 'cap', label: 'Cap' },
  { value: 'valve', label: 'Valve' },
  { value: 'flange', label: 'Flange' },
  { value: 'nipple', label: 'Nipple' },
  { value: 'bushing', label: 'Bushing' },
  { value: 'pipe', label: 'Pipe' },
  { value: 'other', label: 'Other' },
];

const PIPE_SIZES = [
  '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"', '5"', '6"', '8"', '10"', '12"', '14"', '16"',
];

const JOIN_TYPES = [
  { value: 'threaded', label: 'Threaded' },
  { value: 'welded', label: 'Welded' },
  { value: 'flanged', label: 'Flanged' },
  { value: 'grooved', label: 'Grooved' },
  { value: 'press', label: 'Press' },
  { value: 'soldered', label: 'Soldered' },
  { value: 'glued', label: 'Glued' },
];

interface LocalLineItem {
  id?: number;
  fitting_type: string;
  size: string;
  join_type: string;
  quantity: number;
  remarks: string;
}

// How many size picks each fitting type needs, and labels for each pick
const getSizeConfig = (fittingType: string): { count: number; labels: string[] } => {
  switch (fittingType) {
    case 'tee':
    case 'wye':
      return { count: 3, labels: ['Run', 'Run', 'Branch'] };
    case 'reducer':
    case 'bushing':
      return { count: 2, labels: ['Large End', 'Small End'] };
    default:
      return { count: 1, labels: ['Size'] };
  }
};

const FieldPipingFittingOrderForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Order header
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
    cost_code: '',
    phase_code: '',
    notes: '',
  });

  // Line items
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([]);

  // Quick-add state
  const [selectedFitting, setSelectedFitting] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedJoinType, setSelectedJoinType] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [joinTypeLocked, setJoinTypeLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step tracking for guided flow
  const [step, setStep] = useState<'fitting' | 'size' | 'join' | 'qty'>('fitting');

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const sizeConfig = getSizeConfig(selectedFitting);

  const { isLoading: loadingExisting } = useQuery({
    queryKey: ['field-piping-fitting-order', id],
    queryFn: async () => {
      const res = await pipingFittingOrdersApi.getById(Number(id));
      const order = res.data;
      setForm({
        project_id: order.project_id,
        title: order.title || '',
        description: order.description || '',
        priority: order.priority || 'normal',
        required_by_date: order.required_by_date,
        drawing_number: order.drawing_number || '',
        drawing_revision: order.drawing_revision || '',
        spec_section: order.spec_section || '',
        location_on_site: order.location_on_site || '',
        material_type: order.material_type || '',
        cost_code: order.cost_code || '',
        phase_code: order.phase_code || '',
        notes: order.notes || '',
      });
      if (order.items && order.items.length > 0) {
        setLineItems(
          order.items.map((item: PipingFittingOrderItem) => ({
            id: item.id,
            fitting_type: item.fitting_type || '',
            size: item.size || '',
            join_type: item.join_type || '',
            quantity: item.quantity || 1,
            remarks: item.remarks || '',
          }))
        );
      }
      return order;
    },
    enabled: isEdit,
  });

  // Auto-focus quantity input when reaching qty step
  useEffect(() => {
    if (step === 'qty' && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [step]);

  const handleSelectFitting = (value: string) => {
    setSelectedFitting(value);
    setSelectedSizes([]);
    setStep('size');
  };

  const handleSelectSize = (value: string) => {
    const newSizes = [...selectedSizes, value];
    setSelectedSizes(newSizes);

    const config = getSizeConfig(selectedFitting);
    if (newSizes.length < config.count) {
      // Need more size picks - stay on size step (React will re-render with updated label)
      return;
    }

    // All sizes picked
    if (joinTypeLocked && selectedJoinType) {
      setStep('qty');
    } else {
      setStep('join');
    }
  };

  const handleSelectJoinType = (value: string) => {
    setSelectedJoinType(value);
    setStep('qty');
  };

  const handleAddItem = () => {
    if (!selectedFitting || selectedSizes.length === 0) return;

    const sizeStr = selectedSizes.join(' x ');
    const newItem: LocalLineItem = {
      fitting_type: selectedFitting,
      size: sizeStr,
      join_type: selectedJoinType,
      quantity: quantity || 1,
      remarks: '',
    };

    setLineItems((prev) => [...prev, newItem]);

    // Reset for next item
    setSelectedFitting('');
    setSelectedSizes([]);
    if (!joinTypeLocked) {
      setSelectedJoinType('');
    }
    setQuantity(1);
    setStep('fitting');

    // Scroll to bottom after a tick
    setTimeout(() => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const removeItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target;
    const name = target.name;
    const value = target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<PipingFittingOrder>) => pipingFittingOrdersApi.create(data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: Partial<PipingFittingOrder> }) =>
      pipingFittingOrdersApi.update(orderId, data),
  });

  const addItemMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: Partial<PipingFittingOrderItem> }) =>
      pipingFittingOrdersApi.addItem(orderId, data),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ orderId, itemId, data }: { orderId: number; itemId: number; data: Partial<PipingFittingOrderItem> }) =>
      pipingFittingOrdersApi.updateItem(orderId, itemId, data),
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: number; itemId: number }) =>
      pipingFittingOrdersApi.deleteItem(orderId, itemId),
  });

  const handleSave = async () => {
    if (!form.title?.trim()) {
      window.alert('Title is required.');
      return;
    }
    if (lineItems.length === 0) {
      window.alert('Add at least one fitting to the order.');
      return;
    }
    setSaving(true);
    try {
      const orderData: Partial<PipingFittingOrder> = {
        ...form,
        project_id: Number(projectId),
      };

      if (isEdit) {
        const orderId = Number(id);
        await updateMutation.mutateAsync({ orderId, data: orderData });

        // Get existing items to compare
        const existingRes = await pipingFittingOrdersApi.getById(orderId);
        const existingItems = existingRes.data.items || [];
        const existingIds = existingItems.map((item: PipingFittingOrderItem) => item.id);
        const currentIds = lineItems.filter((item) => item.id).map((item) => item.id as number);

        // Delete removed items
        const deletedIds = existingIds.filter((eid: number) => !currentIds.includes(eid));
        for (const itemId of deletedIds) {
          await deleteItemMutation.mutateAsync({ orderId, itemId });
        }

        // Update existing and add new items
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          const itemData: Partial<PipingFittingOrderItem> = {
            sort_order: i + 1,
            fitting_type: item.fitting_type,
            size: item.size,
            join_type: item.join_type,
            quantity: item.quantity,
            remarks: item.remarks,
          };
          if (item.id) {
            await updateItemMutation.mutateAsync({ orderId, itemId: item.id, data: itemData });
          } else {
            await addItemMutation.mutateAsync({ orderId, data: itemData });
          }
        }
      } else {
        const res = await createMutation.mutateAsync(orderData);
        const newOrderId = res.data.id;

        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          await addItemMutation.mutateAsync({
            orderId: newOrderId,
            data: {
              sort_order: i + 1,
              fitting_type: item.fitting_type,
              size: item.size,
              join_type: item.join_type,
              quantity: item.quantity,
              remarks: item.remarks,
            },
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['field-piping-fitting-orders'] });
      queryClient.invalidateQueries({ queryKey: ['field-piping-fitting-order', id] });
      navigate(`/field/projects/${projectId}/piping-fitting-orders`);
    } catch (err) {
      console.error('Failed to save:', err);
      window.alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingExisting) {
    return <div className="field-loading">Loading order...</div>;
  }

  const getFittingLabel = (value: string) => FITTING_TYPES.find((f) => f.value === value)?.label || value;
  const getJoinLabel = (value: string) => JOIN_TYPES.find((j) => j.value === value)?.label || value;

  const compactLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 2, whiteSpace: 'nowrap' };
  const compactInput: React.CSSProperties = { width: '100%', height: 36, padding: '0 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16, boxSizing: 'border-box', WebkitAppearance: 'none' };

  return (
    <div>
      <h1 className="field-page-title" style={{ marginBottom: 2 }}>
        {isEdit ? 'Edit Fitting Order' : 'New Piping Fitting Order'}
      </h1>

      {/* Compact Header Info */}
      <div className="field-form-section" style={{ padding: '10px 12px', marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 8px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={compactLabel}>Title *</label>
            <input style={compactInput} name="title" value={form.title || ''} onChange={handleChange} placeholder="e.g. Boiler Room Piping" />
          </div>
          <div>
            <label style={compactLabel}>Material</label>
            <select style={{ ...compactInput, background: '#fff' }} name="material_type" value={form.material_type || ''} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="Black Iron">Black Iron</option>
              <option value="Copper">Copper</option>
              <option value="Stainless Steel">Stainless Steel</option>
              <option value="PVC">PVC</option>
              <option value="CPVC">CPVC</option>
              <option value="Carbon Steel">Carbon Steel</option>
            </select>
          </div>
          <div>
            <label style={compactLabel}>Priority</label>
            <select style={{ ...compactInput, background: '#fff' }} name="priority" value={form.priority || 'normal'} onChange={handleChange}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label style={compactLabel}>Required By</label>
            <input style={compactInput} type="date" name="required_by_date" value={form.required_by_date || ''} onChange={handleChange} />
          </div>
          <div>
            <label style={compactLabel}>Location</label>
            <input style={compactInput} name="location_on_site" value={form.location_on_site || ''} onChange={handleChange} placeholder="e.g. Mech Room" />
          </div>
          <div>
            <label style={compactLabel}>Drawing #</label>
            <input style={compactInput} name="drawing_number" value={form.drawing_number || ''} onChange={handleChange} placeholder="DWG-001" />
          </div>
          <div>
            <label style={compactLabel}>Notes</label>
            <input style={compactInput} name="notes" value={form.notes || ''} onChange={handleChange} placeholder="Notes..." />
          </div>
        </div>
      </div>

      {/* Quick Add Section */}
      <div style={{
        background: '#fff',
        border: '2px solid #3b82f6',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>
            Quick Add Fitting
          </div>
          {/* Lock Join Type Toggle */}
          <button
            type="button"
            onClick={() => setJoinTypeLocked(!joinTypeLocked)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              border: joinTypeLocked ? '2px solid #3b82f6' : '1px solid #d1d5db',
              borderRadius: 6,
              background: joinTypeLocked ? '#eff6ff' : '#fff',
              color: joinTypeLocked ? '#1e40af' : '#6b7280',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {joinTypeLocked ? <LockIcon style={{ fontSize: 14 }} /> : <LockOpenIcon style={{ fontSize: 14 }} />}
            {joinTypeLocked ? `Joint: ${getJoinLabel(selectedJoinType)}` : 'Lock Joint'}
          </button>
        </div>

        {/* Step breadcrumb */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, fontSize: 11, color: '#9ca3af', flexWrap: 'wrap' }}>
          <span style={{ color: step === 'fitting' ? '#1e40af' : selectedFitting ? '#10b981' : '#9ca3af', fontWeight: step === 'fitting' ? 700 : 400 }}>
            {selectedFitting ? getFittingLabel(selectedFitting) : 'Fitting'}
          </span>
          <span>&rsaquo;</span>
          <span style={{ color: step === 'size' ? '#1e40af' : selectedSizes.length === sizeConfig.count ? '#10b981' : '#9ca3af', fontWeight: step === 'size' ? 700 : 400 }}>
            {selectedSizes.length > 0 ? selectedSizes.join(' x ') + (selectedSizes.length < sizeConfig.count ? ' x ?' : '') : 'Size'}
          </span>
          <span>&rsaquo;</span>
          <span style={{ color: step === 'join' ? '#1e40af' : selectedJoinType ? '#10b981' : '#9ca3af', fontWeight: step === 'join' ? 700 : 400 }}>
            {selectedJoinType ? getJoinLabel(selectedJoinType) : 'Joint'}
          </span>
          <span>&rsaquo;</span>
          <span style={{ color: step === 'qty' ? '#1e40af' : '#9ca3af', fontWeight: step === 'qty' ? 700 : 400 }}>
            Qty
          </span>
        </div>

        {/* Step 1: Fitting Type - button grid */}
        {step === 'fitting' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {FITTING_TYPES.map((ft) => (
              <button
                key={ft.value}
                type="button"
                onClick={() => handleSelectFitting(ft.value)}
                style={{
                  padding: '12px 4px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {ft.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Size - button grid (multi-pick for tee/reducer) */}
        {step === 'size' && (
          <div>
            {sizeConfig.count > 1 && (
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Select {sizeConfig.labels[selectedSizes.length]}
                {selectedSizes.length > 0 && (
                  <span style={{ fontWeight: 400, color: '#6b7280' }}>
                    {' '}({selectedSizes.length} of {sizeConfig.count}: {selectedSizes.join(' x ')})
                  </span>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {PIPE_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleSelectSize(sz)}
                  style={{
                    padding: '12px 4px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#374151',
                    textAlign: 'center',
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {selectedSizes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedSizes((prev) => prev.slice(0, -1))}
                  style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Undo last size
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setSelectedFitting(''); setSelectedSizes([]); setStep('fitting'); }}
                  style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Back to fitting type
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Join Type - button grid */}
        {step === 'join' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {JOIN_TYPES.map((jt) => (
                <button
                  key={jt.value}
                  type="button"
                  onClick={() => handleSelectJoinType(jt.value)}
                  style={{
                    padding: '12px 4px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    textAlign: 'center',
                  }}
                >
                  {jt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setSelectedSizes((prev) => prev.slice(0, -1)); setStep('size'); }}
              style={{ marginTop: 8, fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Back to size
            </button>
          </div>
        )}

        {/* Step 4: Quantity + Add */}
        {step === 'qty' && (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Quantity</label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  onKeyDown={handleQtyKeyDown}
                  min={1}
                  style={{
                    width: '100%',
                    height: 48,
                    padding: '0 12px',
                    border: '2px solid #3b82f6',
                    borderRadius: 8,
                    fontSize: 24,
                    fontWeight: 700,
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedFitting || selectedSizes.length === 0}
                style={{
                  height: 48,
                  padding: '0 24px',
                  background: '#1a56db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <AddIcon style={{ fontSize: 20 }} />
                Add
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (joinTypeLocked && selectedJoinType) {
                    setSelectedSizes((prev) => prev.slice(0, -1)); setStep('size');
                  } else {
                    setSelectedJoinType(''); setStep('join');
                  }
                }}
                style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Back
              </button>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>or press Enter to add</span>
            </div>
          </div>
        )}
      </div>

      {/* Items List */}
      {lineItems.length > 0 && (
        <div className="field-form-section" style={{ padding: '8px 0', marginBottom: 70 }}>
          <div style={{ padding: '6px 12px', fontSize: 13, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
            Fittings ({lineItems.length} items)
          </div>
          {lineItems.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                borderBottom: '1px solid #f3f4f6',
                background: index % 2 === 0 ? '#fff' : '#f9fafb',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    {item.quantity}x
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#1e40af' }}>
                    {item.size}
                  </span>
                  <span style={{ fontSize: 14, color: '#374151' }}>
                    {getFittingLabel(item.fitting_type)}
                  </span>
                  {item.join_type && (
                    <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
                      {getJoinLabel(item.join_type)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, lineHeight: 1 }}
              >
                <DeleteIcon style={{ fontSize: 18 }} />
              </button>
            </div>
          ))}
          <div ref={listEndRef} />
        </div>
      )}

      {lineItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af', fontSize: 14, marginBottom: 70 }}>
          No fittings added yet. Use the quick add above to start building your list.
        </div>
      )}

      {/* Actions */}
      <div className="field-actions-bar">
        <button
          type="button"
          className="field-btn field-btn-secondary"
          onClick={() => navigate(-1)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="field-btn field-btn-primary"
          onClick={handleSave}
          disabled={saving || !form.title?.trim() || lineItems.length === 0}
        >
          <SaveIcon style={{ fontSize: 18, marginRight: 4 }} />
          {saving ? 'Saving...' : isEdit ? 'Update Order' : 'Save Draft'}
        </button>
      </div>
    </div>
  );
};

export default FieldPipingFittingOrderForm;
