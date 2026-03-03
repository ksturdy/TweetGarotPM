import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { fieldPurchaseOrdersApi, FieldPurchaseOrder, FieldPurchaseOrderItem } from '../../../services/fieldPurchaseOrders';

const UNIT_OPTIONS = ['EA', 'LF', 'SF', 'CY', 'GAL', 'BOX', 'ROLL', 'SET', 'LOT'];
const SHIPPING_OPTIONS = ['Will Call', 'Deliver', 'Ship', 'Other'];

interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const FieldPOForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [shippingMethod, setShippingMethod] = useState('Will Call');
  const [costCode, setCostCode] = useState('');
  const [phaseCode, setPhaseCode] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit: 'EA', unit_cost: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['field-purchase-order', id],
    queryFn: async () => {
      const res = await fieldPurchaseOrdersApi.getById(Number(id));
      const po = res.data;
      setVendorName(po.vendor_name || '');
      setVendorContact(po.vendor_contact || '');
      setVendorPhone(po.vendor_phone || '');
      setVendorEmail(po.vendor_email || '');
      setDeliveryDate(po.delivery_date || '');
      setDeliveryLocation(po.delivery_location || '');
      setShippingMethod(po.shipping_method || 'Will Call');
      setCostCode(po.cost_code || '');
      setPhaseCode(po.phase_code || '');
      setNotes(po.notes || '');
      if (po.items && po.items.length > 0) {
        setLineItems(
          po.items.map((item: FieldPurchaseOrderItem) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_cost: item.unit_cost,
          }))
        );
      }
      return po;
    },
    enabled: isEdit,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<FieldPurchaseOrder>) => fieldPurchaseOrdersApi.create(data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ poId, data }: { poId: number; data: Partial<FieldPurchaseOrder> }) =>
      fieldPurchaseOrdersApi.update(poId, data),
  });

  const addItemMutation = useMutation({
    mutationFn: ({ poId, data }: { poId: number; data: Partial<FieldPurchaseOrderItem> }) =>
      fieldPurchaseOrdersApi.addItem(poId, data),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ poId, itemId, data }: { poId: number; itemId: number; data: Partial<FieldPurchaseOrderItem> }) =>
      fieldPurchaseOrdersApi.updateItem(poId, itemId, data),
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ poId, itemId }: { poId: number; itemId: number }) =>
      fieldPurchaseOrdersApi.deleteItem(poId, itemId),
  });

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_cost,
    0
  );

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit: 'EA', unit_cost: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const poData: Partial<FieldPurchaseOrder> = {
        project_id: Number(projectId),
        vendor_name: vendorName,
        vendor_contact: vendorContact,
        vendor_phone: vendorPhone,
        vendor_email: vendorEmail,
        delivery_date: deliveryDate || null,
        delivery_location: deliveryLocation,
        shipping_method: shippingMethod,
        cost_code: costCode,
        phase_code: phaseCode,
        notes,
        subtotal,
      };

      if (isEdit) {
        const poId = Number(id);
        await updateMutation.mutateAsync({ poId, data: poData });

        // Get existing items to compare
        const existingRes = await fieldPurchaseOrdersApi.getById(poId);
        const existingItems = existingRes.data.items || [];
        const existingIds = existingItems.map((item: FieldPurchaseOrderItem) => item.id);
        const currentIds = lineItems.filter((item) => item.id).map((item) => item.id as number);

        // Delete removed items
        const deletedIds = existingIds.filter((eid: number) => !currentIds.includes(eid));
        for (const itemId of deletedIds) {
          await deleteItemMutation.mutateAsync({ poId, itemId });
        }

        // Update existing and add new items
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          const itemData: Partial<FieldPurchaseOrderItem> = {
            sort_order: i + 1,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_cost: item.unit_cost,
            total_cost: item.quantity * item.unit_cost,
          };
          if (item.id) {
            await updateItemMutation.mutateAsync({ poId, itemId: item.id, data: itemData });
          } else {
            await addItemMutation.mutateAsync({ poId, data: itemData });
          }
        }
      } else {
        const res = await createMutation.mutateAsync(poData);
        const newPoId = res.data.id;

        // Add line items
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          if (!item.description) continue;
          await addItemMutation.mutateAsync({
            poId: newPoId,
            data: {
              sort_order: i + 1,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unit_cost: item.unit_cost,
              total_cost: item.quantity * item.unit_cost,
            },
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['field-purchase-orders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['field-purchase-order', id] });
      navigate(`/field/projects/${projectId}/purchase-orders`);
    } catch (err) {
      console.error('Failed to save purchase order:', err);
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && isLoading) {
    return <div className="field-loading">Loading purchase order...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
      <p className="field-page-subtitle">
        {isEdit ? 'Update purchase order details' : 'Create a new field purchase order'}
      </p>

      {/* Vendor Section */}
      <div className="field-form-section">
        <div className="field-form-section-title">Vendor</div>
        <div className="field-form-group">
          <label className="field-form-label">Vendor Name</label>
          <input
            type="text"
            className="field-form-input"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="Enter vendor name"
          />
        </div>
        <div className="field-form-group">
          <label className="field-form-label">Contact Name</label>
          <input
            type="text"
            className="field-form-input"
            value={vendorContact}
            onChange={(e) => setVendorContact(e.target.value)}
            placeholder="Contact person"
          />
        </div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Phone</label>
            <input
              type="tel"
              className="field-form-input"
              value={vendorPhone}
              onChange={(e) => setVendorPhone(e.target.value)}
              placeholder="(555) 555-5555"
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Email</label>
            <input
              type="email"
              className="field-form-input"
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
              placeholder="vendor@email.com"
            />
          </div>
        </div>
      </div>

      {/* Line Items Section */}
      <div className="field-form-section">
        <div className="field-form-section-title">Line Items</div>
        {lineItems.map((item, index) => (
          <div key={index} className="field-line-item">
            <div className="field-line-item-header">
              <span className="field-line-item-number">Item {index + 1}</span>
              {lineItems.length > 1 && (
                <button
                  type="button"
                  className="field-line-item-remove"
                  onClick={() => removeLineItem(index)}
                  aria-label={`Remove item ${index + 1}`}
                >
                  <DeleteIcon style={{ fontSize: 18 }} />
                </button>
              )}
            </div>
            <div className="field-form-group">
              <label className="field-form-label">Description *</label>
              <input
                type="text"
                className="field-form-input"
                value={item.description}
                onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                placeholder="Item description"
                required
              />
            </div>
            <div className="field-form-row">
              <div className="field-form-group">
                <label className="field-form-label">Qty</label>
                <input
                  type="number"
                  className="field-form-input"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                  min={0}
                  step="any"
                />
              </div>
              <div className="field-form-group">
                <label className="field-form-label">Unit</label>
                <select
                  className="field-form-select"
                  value={item.unit}
                  onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-form-group">
                <label className="field-form-label">Unit Cost</label>
                <input
                  type="number"
                  className="field-form-input"
                  value={item.unit_cost}
                  onChange={(e) => updateLineItem(index, 'unit_cost', Number(e.target.value))}
                  min={0}
                  step="0.01"
                />
              </div>
            </div>
            <div className="field-card-meta" style={{ textAlign: 'right', marginTop: 4 }}>
              Line Total: {formatCurrency(item.quantity * item.unit_cost)}
            </div>
          </div>
        ))}

        <button type="button" className="field-btn field-btn-secondary" onClick={addLineItem}>
          <AddIcon style={{ fontSize: 18, marginRight: 4 }} />
          Add Item
        </button>

        <div style={{ marginTop: 12, fontWeight: 600, textAlign: 'right', fontSize: 16 }}>
          Subtotal: {formatCurrency(subtotal)}
        </div>
      </div>

      {/* Delivery Section */}
      <div className="field-form-section">
        <div className="field-form-section-title">Delivery</div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Delivery Date</label>
            <input
              type="date"
              className="field-form-input"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Shipping Method</label>
            <select
              className="field-form-select"
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value)}
            >
              {SHIPPING_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-form-group">
          <label className="field-form-label">Delivery Location</label>
          <input
            type="text"
            className="field-form-input"
            value={deliveryLocation}
            onChange={(e) => setDeliveryLocation(e.target.value)}
            placeholder="Job site or address"
          />
        </div>
      </div>

      {/* Coding Section */}
      <div className="field-form-section">
        <div className="field-form-section-title">Coding</div>
        <div className="field-form-row">
          <div className="field-form-group">
            <label className="field-form-label">Cost Code</label>
            <input
              type="text"
              className="field-form-input"
              value={costCode}
              onChange={(e) => setCostCode(e.target.value)}
              placeholder="e.g. 15-100"
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Phase Code</label>
            <input
              type="text"
              className="field-form-input"
              value={phaseCode}
              onChange={(e) => setPhaseCode(e.target.value)}
              placeholder="e.g. 01"
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="field-form-section">
        <div className="field-form-section-title">Notes</div>
        <div className="field-form-group">
          <textarea
            className="field-form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes or special instructions"
            rows={4}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="field-actions-bar">
        <button
          type="button"
          className="field-btn field-btn-secondary"
          onClick={() => navigate(`/field/projects/${projectId}/purchase-orders`)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="field-btn field-btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : isEdit ? 'Update PO' : 'Create PO'}
        </button>
      </div>
    </div>
  );
};

export default FieldPOForm;
