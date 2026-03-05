import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { fieldPurchaseOrdersApi, FieldPurchaseOrder, formatFpoNumber } from '../../../services/fieldPurchaseOrders';

const STATUS_FILTERS = ['All', 'Draft', 'Submitted'];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const FieldPOList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['field-purchase-orders', projectId, statusFilter],
    queryFn: async () => {
      const filters = statusFilter !== 'All' ? { status: statusFilter.toLowerCase() } : undefined;
      const res = await fieldPurchaseOrdersApi.getByProject(Number(projectId), filters);
      return res.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="field-loading">Loading purchase orders...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Field Purchase Orders</h1>
      <p className="field-page-subtitle">Field purchase orders for this project</p>

      <div className="field-filters">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            className={`field-filter-chip ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {purchaseOrders.length === 0 ? (
        <div className="field-empty">
          <ShoppingCartIcon />
          <div className="field-empty-title">No purchase orders yet</div>
          <div className="field-empty-text">
            Tap the + button to create your first purchase order
          </div>
        </div>
      ) : (
        purchaseOrders.map((po: FieldPurchaseOrder) => (
          <div
            key={po.id}
            className="field-card"
            onClick={() =>
              navigate(`/field/projects/${projectId}/purchase-orders/${po.id}`)
            }
          >
            <div className="field-card-header">
              <div>
                <div className="field-card-number">{formatFpoNumber(po)}</div>
                <div className="field-card-title">{po.vendor_name || 'No Vendor'}</div>
              </div>
              <span className={`field-status field-status-${po.status}`}>
                {po.status}
              </span>
            </div>
            {po.description && (
              <div className="field-card-subtitle">{po.description}</div>
            )}
            <div className="field-card-meta">
              {formatCurrency(po.total)} {'\u00B7'} {formatDate(po.created_at)}
              {po.created_by_name && ` \u00B7 ${po.created_by_name}`}
            </div>
          </div>
        ))
      )}

      <button
        className="field-fab"
        onClick={() =>
          navigate(`/field/projects/${projectId}/purchase-orders/new`)
        }
        aria-label="Create purchase order"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldPOList;
