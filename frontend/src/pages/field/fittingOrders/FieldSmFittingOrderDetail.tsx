import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import { smFittingOrdersApi, SmFittingOrder } from '../../../services/smFittingOrders';

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const FieldSmFittingOrderDetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['field-sm-fitting-order', id],
    queryFn: async () => {
      const res = await smFittingOrdersApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: () => smFittingOrdersApi.submit(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-order', id] });
      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-orders'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => smFittingOrdersApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-orders'] });
      navigate(`/field/projects/${projectId}/sm-fitting-orders`);
    },
  });

  const handleSubmit = () => {
    if (window.confirm('Submit this fitting order to the shop?')) {
      submitMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this fitting order? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading || !order) {
    return <div className="field-loading">Loading order details...</div>;
  }

  const isDraft = order.status === 'draft';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="field-page-title">FO-SM-{order.number}</h1>
          <p className="field-page-subtitle" style={{ marginBottom: 0 }}>{order.title}</p>
        </div>
        <span className={`field-status field-status-${order.status}`}>
          {order.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Order Details */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Order Details</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Priority</span>
          <span className={`field-priority field-priority-${order.priority}`}>
            {order.priority}
          </span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Required By</span>
          <span className="field-detail-value">{formatDate(order.required_by_date)}</span>
        </div>
        {order.description && (
          <div className="field-detail-row">
            <span className="field-detail-label">Description</span>
            <span className="field-detail-value">{order.description}</span>
          </div>
        )}
      </div>

      {/* Drawing Reference */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Drawing Reference</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Drawing Number</span>
          <span className="field-detail-value">{order.drawing_number || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Revision</span>
          <span className="field-detail-value">{order.drawing_revision || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Spec Section</span>
          <span className="field-detail-value">{order.spec_section || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Location on Site</span>
          <span className="field-detail-value">{order.location_on_site || '-'}</span>
        </div>
      </div>

      {/* Material Specs */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Material Specs</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Material Type</span>
          <span className="field-detail-value">{order.material_type || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Material Gauge</span>
          <span className="field-detail-value">{order.material_gauge || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Duct Type</span>
          <span className="field-detail-value">{order.duct_type || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Dimensions</span>
          <span className="field-detail-value">{order.dimensions || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Insulation Required</span>
          <span className="field-detail-value">{order.insulation_required ? 'Yes' : 'No'}</span>
        </div>
        {order.insulation_required && (
          <div className="field-detail-row">
            <span className="field-detail-label">Insulation Spec</span>
            <span className="field-detail-value">{order.insulation_spec || '-'}</span>
          </div>
        )}
        <div className="field-detail-row">
          <span className="field-detail-label">Liner Required</span>
          <span className="field-detail-value">{order.liner_required ? 'Yes' : 'No'}</span>
        </div>
      </div>

      {/* Quantities */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Quantities</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Quantity</span>
          <span className="field-detail-value">{order.quantity} {order.unit}</span>
        </div>
      </div>

      {/* Coding */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Coding</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Cost Code</span>
          <span className="field-detail-value">{order.cost_code || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Phase Code</span>
          <span className="field-detail-value">{order.phase_code || '-'}</span>
        </div>
      </div>

      {/* Shop Info */}
      {order.shop_assigned_to && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Shop Info</div>
          <div className="field-detail-row">
            <span className="field-detail-label">Assigned To</span>
            <span className="field-detail-value">{order.shop_assigned_to}</span>
          </div>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Notes</div>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
            {order.notes}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Info</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Created By</span>
          <span className="field-detail-value">{order.created_by_name || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Created</span>
          <span className="field-detail-value">{formatDateTime(order.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      {isDraft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, marginBottom: 24 }}>
          <button
            className="field-btn field-btn-primary"
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
          >
            <SendIcon style={{ fontSize: 18 }} />
            {submitMutation.isPending ? 'Submitting...' : 'Submit to Shop'}
          </button>
          <button
            className="field-btn field-btn-secondary"
            onClick={() =>
              navigate(`/field/projects/${projectId}/sm-fitting-orders/${id}/edit`)
            }
          >
            <EditIcon style={{ fontSize: 18 }} />
            Edit Order
          </button>
          <button
            className="field-btn field-btn-danger"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <DeleteIcon style={{ fontSize: 18 }} />
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Order'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FieldSmFittingOrderDetail;
