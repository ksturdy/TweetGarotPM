import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { smFittingOrdersApi, SmFittingOrder, SmFittingOrderItem } from '../../../services/smFittingOrders';
import { FittingTypeReference } from './FittingTypeDiagrams';

const FITTING_TYPES: { value: number; label: string }[] = [
  { value: 1, label: '1-St. Joint' },
  { value: 2, label: '2-Reducer' },
  { value: 3, label: '3-Offset' },
  { value: 4, label: '4-Elbow' },
  { value: 5, label: '5-Tee' },
  { value: 6, label: '6-Wye' },
  { value: 7, label: '7-Dbl Branch' },
  { value: 8, label: '8-Tap' },
  { value: 9, label: '9-Transition' },
  { value: 10, label: '10-End Cap' },
];

const LINER_OPTIONS = ['', '.5"', '1"'];
const CONNECTION_OPTIONS = ['', 'S&DR', 'TDC', 'Raw', 'V'];

interface LineItem {
  id?: number;
  quantity: number;
  fitting_type: number | null;
  dim_a: string;
  dim_b: string;
  dim_c: string;
  dim_d: string;
  dim_e: string;
  dim_f: string;
  dim_l: string;
  dim_r: string;
  dim_x: string;
  gauge: string;
  liner: string;
  connection: string;
  remarks: string;
}

const emptyLineItem = (): LineItem => ({
  quantity: 1,
  fitting_type: null,
  dim_a: '',
  dim_b: '',
  dim_c: '',
  dim_d: '',
  dim_e: '',
  dim_f: '',
  dim_l: '',
  dim_r: '',
  dim_x: '',
  gauge: '',
  liner: '',
  connection: '',
  remarks: '',
});

const FieldSmFittingOrderForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Header fields
  const [title, setTitle] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [dateRequired, setDateRequired] = useState('');
  const [material, setMaterial] = useState('');
  const [staticPressureClass, setStaticPressureClass] = useState('');
  const [longitudinalSeam, setLongitudinalSeam] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [laborPhaseCode, setLaborPhaseCode] = useState('');
  const [materialPhaseCode, setMaterialPhaseCode] = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);
  const [saving, setSaving] = useState(false);

  const { isLoading: loadingExisting } = useQuery({
    queryKey: ['field-sm-fitting-order', id],
    queryFn: async () => {
      const res = await smFittingOrdersApi.getById(Number(id));
      const order = res.data;
      setTitle(order.title || '');
      setRequestedBy(order.requested_by || '');
      setDateRequired(order.date_required || '');
      setMaterial(order.material || '');
      setStaticPressureClass(order.static_pressure_class || '');
      setLongitudinalSeam(order.longitudinal_seam || '');
      setPreparedBy(order.prepared_by || '');
      setLaborPhaseCode(order.labor_phase_code || '');
      setMaterialPhaseCode(order.material_phase_code || '');
      setPriority(order.priority || 'normal');
      setNotes(order.notes || '');
      if (order.items && order.items.length > 0) {
        setLineItems(
          order.items.map((item: SmFittingOrderItem) => ({
            id: item.id,
            quantity: item.quantity,
            fitting_type: item.fitting_type,
            dim_a: item.dim_a || '',
            dim_b: item.dim_b || '',
            dim_c: item.dim_c || '',
            dim_d: item.dim_d || '',
            dim_e: item.dim_e || '',
            dim_f: item.dim_f || '',
            dim_l: item.dim_l || '',
            dim_r: item.dim_r || '',
            dim_x: item.dim_x || '',
            gauge: item.gauge || '',
            liner: item.liner || '',
            connection: item.connection || '',
            remarks: item.remarks || '',
          }))
        );
      }
      return order;
    },
    enabled: isEdit,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SmFittingOrder>) => smFittingOrdersApi.create(data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: Partial<SmFittingOrder> }) =>
      smFittingOrdersApi.update(orderId, data),
  });

  const addItemMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: Partial<SmFittingOrderItem> }) =>
      smFittingOrdersApi.addItem(orderId, data),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ orderId, itemId, data }: { orderId: number; itemId: number; data: Partial<SmFittingOrderItem> }) =>
      smFittingOrdersApi.updateItem(orderId, itemId, data),
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: number; itemId: number }) =>
      smFittingOrdersApi.deleteItem(orderId, itemId),
  });

  const addLineItem = () => {
    setLineItems([...lineItems, emptyLineItem()]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number | null) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const orderData: Partial<SmFittingOrder> = {
        project_id: Number(projectId),
        title,
        requested_by: requestedBy,
        date_required: dateRequired || null,
        material,
        static_pressure_class: staticPressureClass,
        longitudinal_seam: longitudinalSeam,
        prepared_by: preparedBy,
        labor_phase_code: laborPhaseCode,
        material_phase_code: materialPhaseCode,
        priority,
        notes,
      };

      if (isEdit) {
        const orderId = Number(id);
        await updateMutation.mutateAsync({ orderId, data: orderData });

        // Get existing items to compare
        const existingRes = await smFittingOrdersApi.getById(orderId);
        const existingItems = existingRes.data.items || [];
        const existingIds = existingItems.map((item: SmFittingOrderItem) => item.id);
        const currentIds = lineItems.filter((item) => item.id).map((item) => item.id as number);

        // Delete removed items
        const deletedIds = existingIds.filter((eid: number) => !currentIds.includes(eid));
        for (const itemId of deletedIds) {
          await deleteItemMutation.mutateAsync({ orderId, itemId });
        }

        // Update existing and add new items
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          const itemData: Partial<SmFittingOrderItem> = {
            sort_order: i + 1,
            quantity: item.quantity,
            fitting_type: item.fitting_type,
            dim_a: item.dim_a,
            dim_b: item.dim_b,
            dim_c: item.dim_c,
            dim_d: item.dim_d,
            dim_e: item.dim_e,
            dim_f: item.dim_f,
            dim_l: item.dim_l,
            dim_r: item.dim_r,
            dim_x: item.dim_x,
            gauge: item.gauge,
            liner: item.liner,
            connection: item.connection,
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

        // Add line items
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          await addItemMutation.mutateAsync({
            orderId: newOrderId,
            data: {
              sort_order: i + 1,
              quantity: item.quantity,
              fitting_type: item.fitting_type,
              dim_a: item.dim_a,
              dim_b: item.dim_b,
              dim_c: item.dim_c,
              dim_d: item.dim_d,
              dim_e: item.dim_e,
              dim_f: item.dim_f,
              dim_l: item.dim_l,
              dim_r: item.dim_r,
              dim_x: item.dim_x,
              gauge: item.gauge,
              liner: item.liner,
              connection: item.connection,
              remarks: item.remarks,
            },
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-orders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-order', id] });
      navigate(`/field/projects/${projectId}/sm-fitting-orders`);
    } catch (err) {
      console.error('Failed to save fitting order:', err);
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingExisting) {
    return <div className="field-loading">Loading order...</div>;
  }

  const compactInput: React.CSSProperties = { width: '100%', height: 36, padding: '0 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16, boxSizing: 'border-box', WebkitAppearance: 'none' };
  const compactLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 2, whiteSpace: 'nowrap' };

  return (
    <div>
      <h1 className="field-page-title" style={{ marginBottom: 2 }}>
        {isEdit ? 'Edit Fitting Order' : 'Duct Work Fitting Order'}
      </h1>

      {/* Compact Header - matching paper form layout */}
      <div className="field-form-section" style={{ padding: '10px 12px', marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px 8px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={compactLabel}>Title *</label>
            <input style={compactInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description" />
          </div>
          <div>
            <label style={compactLabel}>Requested By</label>
            <input style={compactInput} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Name" />
          </div>
          <div>
            <label style={compactLabel}>Date Required</label>
            <input style={compactInput} type="date" value={dateRequired} onChange={(e) => setDateRequired(e.target.value)} />
          </div>
          <div>
            <label style={compactLabel}>Material</label>
            <input style={compactInput} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Galv, Alum, SS" />
          </div>
          <div>
            <label style={compactLabel}>Static Pressure Class</label>
            <input style={compactInput} value={staticPressureClass} onChange={(e) => setStaticPressureClass(e.target.value)} placeholder='e.g. 2"' />
          </div>
          <div>
            <label style={compactLabel}>Long. Seam</label>
            <input style={compactInput} value={longitudinalSeam} onChange={(e) => setLongitudinalSeam(e.target.value)} placeholder="Seam type" />
          </div>
          <div>
            <label style={compactLabel}>Prepared By</label>
            <input style={compactInput} value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Name" />
          </div>
          <div>
            <label style={compactLabel}>Labor Phase Code</label>
            <input style={compactInput} value={laborPhaseCode} onChange={(e) => setLaborPhaseCode(e.target.value)} placeholder="Phase code" />
          </div>
          <div>
            <label style={compactLabel}>Material Phase Code</label>
            <input style={compactInput} value={materialPhaseCode} onChange={(e) => setMaterialPhaseCode(e.target.value)} placeholder="Phase code" />
          </div>
          <div>
            <label style={compactLabel}>Priority</label>
            <select style={{ ...compactInput, background: '#fff' }} value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label style={compactLabel}>Notes</label>
            <input style={compactInput} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." />
          </div>
        </div>
      </div>

      {/* Fitting Type Reference - compact */}
      <div style={{ marginBottom: 6 }}>
        <FittingTypeReference />
      </div>

      {/* Fitting Line Items Table */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -12px', padding: '0 12px', scrollBehavior: 'smooth' }}>
          <table style={{ tableLayout: 'fixed', width: 960, borderCollapse: 'collapse', fontSize: 13, border: '1px solid #9ca3af' }}>
            <colgroup>
              <col style={{ width: 44 }} />  {/* #REQ */}
              <col style={{ width: 56 }} />  {/* TYPE */}
              <col style={{ width: 100 }} /> {/* A x B */}
              <col style={{ width: 100 }} /> {/* C x D */}
              <col style={{ width: 52 }} />  {/* E */}
              <col style={{ width: 52 }} />  {/* F */}
              <col style={{ width: 52 }} />  {/* L */}
              <col style={{ width: 52 }} />  {/* R */}
              <col style={{ width: 52 }} />  {/* X */}
              <col style={{ width: 48 }} />  {/* GA */}
              <col style={{ width: 56 }} />  {/* LINER */}
              <col style={{ width: 64 }} />  {/* CONN */}
              <col />                        {/* REMARKS - fills remaining */}
              <col style={{ width: 28 }} />  {/* delete */}
            </colgroup>
            <thead>
              <tr>
                {['#REQ', 'TYPE', 'A x B', 'C x D', 'E', 'F', 'L', 'R', 'X', 'GA', 'LINER', 'CONN', 'REMARKS', ''].map((h) => (
                  <th
                    key={h || '_del'}
                    style={{
                      padding: '5px 2px',
                      fontWeight: 700,
                      color: '#92400e',
                      textAlign: 'center',
                      background: '#dbeafe',
                      borderBottom: '2px solid #60a5fa',
                      borderRight: h ? '1px solid #93c5fd' : 'none',
                      whiteSpace: 'nowrap',
                      fontSize: 11,
                      letterSpacing: 0.3,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => {
                const cellStyle: React.CSSProperties = {
                  padding: '2px 1px',
                  borderBottom: '1px solid #d1d5db',
                  borderRight: '1px solid #e5e7eb',
                  verticalAlign: 'middle',
                };
                const inputStyle: React.CSSProperties = {
                  width: '100%',
                  padding: '5px 3px',
                  border: 'none',
                  background: 'transparent',
                  fontSize: 16,
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                };
                return (
                  <tr key={index} style={{ background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={cellStyle}>
                      <input type="number" value={item.quantity} onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))} min={1} style={inputStyle} />
                    </td>
                    <td style={cellStyle}>
                      <select value={item.fitting_type ?? ''} onChange={(e) => updateLineItem(index, 'fitting_type', e.target.value ? Number(e.target.value) : null)} style={{ ...inputStyle, padding: '5px 0' }}>
                        <option value="">--</option>
                        {FITTING_TYPES.map((ft) => (
                          <option key={ft.value} value={ft.value}>{ft.value}</option>
                        ))}
                      </select>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input value={item.dim_a} onChange={(e) => updateLineItem(index, 'dim_a', e.target.value)} style={{ ...inputStyle, borderRight: '1px solid #e5e7eb' }} />
                        <input value={item.dim_b} onChange={(e) => updateLineItem(index, 'dim_b', e.target.value)} style={inputStyle} />
                      </div>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input value={item.dim_c} onChange={(e) => updateLineItem(index, 'dim_c', e.target.value)} style={{ ...inputStyle, borderRight: '1px solid #e5e7eb' }} />
                        <input value={item.dim_d} onChange={(e) => updateLineItem(index, 'dim_d', e.target.value)} style={inputStyle} />
                      </div>
                    </td>
                    <td style={cellStyle}><input value={item.dim_e} onChange={(e) => updateLineItem(index, 'dim_e', e.target.value)} style={inputStyle} /></td>
                    <td style={cellStyle}><input value={item.dim_f} onChange={(e) => updateLineItem(index, 'dim_f', e.target.value)} style={inputStyle} /></td>
                    <td style={cellStyle}><input value={item.dim_l} onChange={(e) => updateLineItem(index, 'dim_l', e.target.value)} style={inputStyle} /></td>
                    <td style={cellStyle}><input value={item.dim_r} onChange={(e) => updateLineItem(index, 'dim_r', e.target.value)} style={inputStyle} /></td>
                    <td style={cellStyle}><input value={item.dim_x} onChange={(e) => updateLineItem(index, 'dim_x', e.target.value)} style={inputStyle} /></td>
                    <td style={cellStyle}><input value={item.gauge} onChange={(e) => updateLineItem(index, 'gauge', e.target.value)} style={inputStyle} /></td>
                    <td style={cellStyle}>
                      <select value={item.liner} onChange={(e) => updateLineItem(index, 'liner', e.target.value)} style={{ ...inputStyle, padding: '5px 0', fontSize: 11 }}>
                        {LINER_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt || '--'}</option>))}
                      </select>
                    </td>
                    <td style={cellStyle}>
                      <select value={item.connection} onChange={(e) => updateLineItem(index, 'connection', e.target.value)} style={{ ...inputStyle, padding: '5px 0', fontSize: 11 }}>
                        {CONNECTION_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt || '--'}</option>))}
                      </select>
                    </td>
                    <td style={{ ...cellStyle, borderRight: 'none' }}>
                      <input value={item.remarks} onChange={(e) => updateLineItem(index, 'remarks', e.target.value)} style={{ ...inputStyle, textAlign: 'left' }} />
                    </td>
                    <td style={{ ...cellStyle, borderRight: 'none', textAlign: 'center' }}>
                      {lineItems.length > 1 && (
                        <button type="button" onClick={() => removeLineItem(index)} aria-label={`Remove row ${index + 1}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, lineHeight: 1 }}>
                          <DeleteIcon style={{ fontSize: 14 }} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Row - standalone button with enough margin to clear sticky actions bar */}
      <button
        type="button"
        onClick={addLineItem}
        style={{
          width: '100%',
          padding: '14px 0',
          marginBottom: 70,
          background: '#eff6ff',
          border: '2px dashed #93c5fd',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <AddIcon style={{ fontSize: 20 }} />
        + Add Row
      </button>

      {/* Actions */}
      <div className="field-actions-bar">
        <button
          type="button"
          className="field-btn field-btn-secondary"
          onClick={() => navigate(`/field/projects/${projectId}/sm-fitting-orders`)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="field-btn field-btn-primary"
          onClick={handleSave}
          disabled={saving || !title.trim()}
        >
          <SaveIcon style={{ fontSize: 18, marginRight: 4 }} />
          {saving ? 'Saving...' : isEdit ? 'Update Order' : 'Save Draft'}
        </button>
      </div>
    </div>
  );
};

export default FieldSmFittingOrderForm;
