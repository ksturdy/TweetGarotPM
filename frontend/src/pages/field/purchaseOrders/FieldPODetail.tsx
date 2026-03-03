import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import { fieldPurchaseOrdersApi, FieldPurchaseOrder, FieldPurchaseOrderItem } from '../../../services/fieldPurchaseOrders';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const FieldPODetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: po, isLoading } = useQuery({
    queryKey: ['field-purchase-order', id],
    queryFn: async () => {
      const res = await fieldPurchaseOrdersApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: (poId: number) => fieldPurchaseOrdersApi.submit(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['field-purchase-orders', projectId] });
      setActionLoading(null);
    },
    onError: () => setActionLoading(null),
  });

  const approveMutation = useMutation({
    mutationFn: (poId: number) => fieldPurchaseOrdersApi.approve(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['field-purchase-orders', projectId] });
      setActionLoading(null);
    },
    onError: () => setActionLoading(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (poId: number) => fieldPurchaseOrdersApi.delete(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-purchase-orders', projectId] });
      navigate(`/field/projects/${projectId}/purchase-orders`);
    },
    onError: () => setActionLoading(null),
  });

  const handleSubmit = () => {
    if (!po) return;
    setActionLoading('submit');
    submitMutation.mutate(po.id);
  };

  const handleApprove = () => {
    if (!po) return;
    setActionLoading('approve');
    approveMutation.mutate(po.id);
  };

  const handleDelete = () => {
    if (!po) return;
    if (!window.confirm('Are you sure you want to delete this purchase order?')) return;
    setActionLoading('delete');
    deleteMutation.mutate(po.id);
  };

  if (isLoading) {
    return <div className="field-loading">Loading purchase order...</div>;
  }

  if (!po) {
    return <div className="field-empty">Purchase order not found.</div>;
  }

  const items = po.items || [];
  const isDraft = po.status === 'draft';
  const isSubmitted = po.status === 'submitted';

  return (
    <div>
      <h1 className="field-page-title">FPO-{po.number}</h1>
      <p className="field-page-subtitle">{po.vendor_name || 'No Vendor'}</p>

      {/* Status */}
      <div style={{ marginBottom: 16 }}>
        <span className={`field-status field-status-${po.status}`}>{po.status}</span>
      </div>

      {/* Header Info */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Purchase Order Details</div>
        <div className="field-detail-row">
          <span className="field-detail-label">PO Number</span>
          <span className="field-detail-value">FPO-{po.number}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Status</span>
          <span className="field-detail-value">{po.status}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Created By</span>
          <span className="field-detail-value">{po.created_by_name}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Created Date</span>
          <span className="field-detail-value">{formatDate(po.created_at)}</span>
        </div>
        {po.approved_by_name && (
          <div className="field-detail-row">
            <span className="field-detail-label">Approved By</span>
            <span className="field-detail-value">{po.approved_by_name}</span>
          </div>
        )}
        {po.description && (
          <div className="field-detail-row">
            <span className="field-detail-label">Description</span>
            <span className="field-detail-value">{po.description}</span>
          </div>
        )}
      </div>

      {/* Vendor Info */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Vendor Information</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Vendor</span>
          <span className="field-detail-value">{po.vendor_name || '--'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Contact</span>
          <span className="field-detail-value">{po.vendor_contact || '--'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Phone</span>
          <span className="field-detail-value">{po.vendor_phone || '--'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Email</span>
          <span className="field-detail-value">{po.vendor_email || '--'}</span>
        </div>
      </div>

      {/* Line Items */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Line Items ({items.length})</div>
        {items.length === 0 ? (
          <div style={{ color: '#6b7280', fontStyle: 'italic', padding: '8px 0' }}>
            No line items
          </div>
        ) : (
          items.map((item: FieldPurchaseOrderItem) => (
            <div key={item.id} className="field-line-item">
              <div className="field-line-item-header">
                <span className="field-line-item-number">Item {item.sort_order}</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(item.total_cost)}</span>
              </div>
              <div style={{ marginBottom: 4 }}>{item.description}</div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>
                {item.quantity} {item.unit} x {formatCurrency(item.unit_cost)}
                {item.quantity_received > 0 && (
                  <span style={{ marginLeft: 8, color: '#059669' }}>
                    ({item.quantity_received} received)
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delivery Info */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Delivery</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Delivery Date</span>
          <span className="field-detail-value">{formatDate(po.delivery_date)}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Location</span>
          <span className="field-detail-value">{po.delivery_location || '--'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Shipping Method</span>
          <span className="field-detail-value">{po.shipping_method || '--'}</span>
        </div>
      </div>

      {/* Coding */}
      {(po.cost_code || po.phase_code) && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Coding</div>
          <div className="field-detail-row">
            <span className="field-detail-label">Cost Code</span>
            <span className="field-detail-value">{po.cost_code || '--'}</span>
          </div>
          <div className="field-detail-row">
            <span className="field-detail-label">Phase Code</span>
            <span className="field-detail-value">{po.phase_code || '--'}</span>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Financial Summary</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Subtotal</span>
          <span className="field-detail-value">{formatCurrency(po.subtotal)}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Tax ({po.tax_rate}%)</span>
          <span className="field-detail-value">{formatCurrency(po.tax_amount)}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Shipping</span>
          <span className="field-detail-value">{formatCurrency(po.shipping_cost)}</span>
        </div>
        <div className="field-detail-row" style={{ fontWeight: 700, fontSize: 16 }}>
          <span className="field-detail-label">Total</span>
          <span className="field-detail-value">{formatCurrency(po.total)}</span>
        </div>
      </div>

      {/* Notes */}
      {po.notes && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Notes</div>
          <div style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>{po.notes}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="field-actions-bar">
        {isDraft && (
          <>
            <button
              className="field-btn field-btn-primary"
              onClick={() => navigate(`/field/projects/${projectId}/purchase-orders/${po.id}/edit`)}
            >
              <EditIcon style={{ fontSize: 18, marginRight: 4 }} />
              Edit
            </button>
            <button
              className="field-btn field-btn-success"
              onClick={handleSubmit}
              disabled={actionLoading === 'submit'}
            >
              <SendIcon style={{ fontSize: 18, marginRight: 4 }} />
              {actionLoading === 'submit' ? 'Submitting...' : 'Submit'}
            </button>
            <button
              className="field-btn field-btn-danger"
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
            >
              <DeleteIcon style={{ fontSize: 18, marginRight: 4 }} />
              {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
            </button>
          </>
        )}
        {isSubmitted && (
          <button
            className="field-btn field-btn-success"
            onClick={handleApprove}
            disabled={actionLoading === 'approve'}
          >
            <CheckCircleIcon style={{ fontSize: 18, marginRight: 4 }} />
            {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
          </button>
        )}
      </div>
    </div>
  );
};

export default FieldPODetail;
