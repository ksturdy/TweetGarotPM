import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import PlumbingIcon from '@mui/icons-material/Plumbing';
import { pipingFittingOrdersApi, PipingFittingOrder } from '../../../services/pipingFittingOrders';

const statusOptions = ['all', 'draft', 'submitted', 'in_fabrication', 'ready', 'delivered', 'installed'];

const statusLabel = (status: string): string => {
  switch (status) {
    case 'all': return 'All';
    case 'draft': return 'Draft';
    case 'submitted': return 'Submitted';
    case 'in_fabrication': return 'In Fab';
    case 'ready': return 'Ready';
    case 'delivered': return 'Delivered';
    case 'installed': return 'Installed';
    default: return status;
  }
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const FieldPipingFittingOrderList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['field-piping-fitting-orders', projectId, statusFilter],
    queryFn: async () => {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const res = await pipingFittingOrdersApi.getByProject(Number(projectId), filters);
      return res.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="field-loading">Loading fitting orders...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Piping Fitting Orders</h1>
      <p className="field-page-subtitle">Piping fabrication orders</p>

      <div className="field-filters">
        {statusOptions.map((status) => (
          <button
            key={status}
            className={`field-filter-chip ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {statusLabel(status)}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="field-empty">
          <PlumbingIcon />
          <div className="field-empty-title">No fitting orders yet</div>
          <div className="field-empty-text">
            Tap the + button to create your first piping fitting order
          </div>
        </div>
      ) : (
        orders.map((order: PipingFittingOrder) => (
          <div
            key={order.id}
            className="field-card"
            onClick={() =>
              navigate(`/field/projects/${projectId}/piping-fitting-orders/${order.id}`)
            }
          >
            <div className="field-card-header">
              <div>
                <div className="field-card-number">FO-PIP-{order.number}</div>
                <div className="field-card-title">{order.title}</div>
              </div>
              <span className={`field-status field-status-${order.status}`}>
                {order.status?.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="field-card-subtitle">
              {[order.material_type, order.pipe_size, order.fitting_type]
                .filter(Boolean)
                .join(' - ')}
            </div>
            <div className="field-card-meta">
              <span>
                <span className={`field-priority field-priority-${order.priority}`}>
                  {order.priority}
                </span>
              </span>
              <span>
                {order.required_by_date ? `Due ${formatDate(order.required_by_date)}` : ''}
              </span>
            </div>
          </div>
        ))
      )}

      <button
        className="field-fab"
        onClick={() =>
          navigate(`/field/projects/${projectId}/piping-fitting-orders/new`)
        }
        aria-label="Create fitting order"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldPipingFittingOrderList;
