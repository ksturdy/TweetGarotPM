import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import AirIcon from '@mui/icons-material/Air';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { smFittingOrdersApi, SmFittingOrder } from '../../../services/smFittingOrders';
import { useTitanFeedback } from '../../../context/TitanFeedbackContext';

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

const formatDate = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? '' : dateStr.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const str = String(dateStr);
  const date = new Date(str.includes('T') ? str : str + 'T00:00:00');
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const SWIPE_THRESHOLD = 80;
const DELETE_ZONE_WIDTH = 80;

interface SwipeState {
  orderId: number | null;
  startX: number;
  currentX: number;
  isSwiping: boolean;
}

const FieldSmFittingOrderList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();
  const [statusFilter, setStatusFilter] = useState('all');
  const [swipedOpenId, setSwipedOpenId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SmFittingOrder | null>(null);
  const swipeRef = useRef<SwipeState>({ orderId: null, startX: 0, currentX: 0, isSwiping: false });
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['field-sm-fitting-orders', projectId, statusFilter],
    queryFn: async () => {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const res = await smFittingOrdersApi.getByProject(Number(projectId), filters);
      return res.data;
    },
    enabled: !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => smFittingOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-sm-fitting-orders'] });
      setConfirmDelete(null);
      setSwipedOpenId(null);
    },
    onError: () => {
      toast.error('Failed to delete. Only draft orders can be deleted.');
      setConfirmDelete(null);
    },
  });

  const resetSwipe = useCallback((orderId: number) => {
    const el = cardRefs.current.get(orderId);
    if (el) {
      el.style.transition = 'transform 0.25s ease';
      el.style.transform = 'translateX(0)';
    }
    if (swipedOpenId === orderId) setSwipedOpenId(null);
  }, [swipedOpenId]);

  const handleTouchStart = useCallback((e: React.TouchEvent, orderId: number) => {
    // Close any other open swipe
    if (swipedOpenId && swipedOpenId !== orderId) {
      resetSwipe(swipedOpenId);
    }
    swipeRef.current = {
      orderId,
      startX: e.touches[0].clientX,
      currentX: e.touches[0].clientX,
      isSwiping: false,
    };
    const el = cardRefs.current.get(orderId);
    if (el) el.style.transition = 'none';
  }, [swipedOpenId, resetSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const s = swipeRef.current;
    if (!s.orderId) return;

    const touchX = e.touches[0].clientX;
    const diffX = touchX - s.startX;

    // Only swipe left (negative direction)
    if (diffX > 10) {
      // Swiping right - if card was open, close it
      if (swipedOpenId === s.orderId) {
        const el = cardRefs.current.get(s.orderId);
        if (el) {
          const offset = Math.min(0, -DELETE_ZONE_WIDTH + (touchX - s.startX));
          el.style.transform = `translateX(${offset}px)`;
        }
        s.isSwiping = true;
      }
      return;
    }

    if (diffX < -10) {
      s.isSwiping = true;
    }

    if (!s.isSwiping) return;

    e.preventDefault();
    s.currentX = touchX;

    const el = cardRefs.current.get(s.orderId);
    if (el) {
      const baseOffset = swipedOpenId === s.orderId ? -DELETE_ZONE_WIDTH : 0;
      const offset = Math.max(-DELETE_ZONE_WIDTH - 20, Math.min(0, baseOffset + diffX));
      el.style.transform = `translateX(${offset}px)`;
    }
  }, [swipedOpenId]);

  const handleTouchEnd = useCallback(() => {
    const s = swipeRef.current;
    if (!s.orderId) return;

    const diffX = s.currentX - s.startX;
    const el = cardRefs.current.get(s.orderId);

    if (s.isSwiping && el) {
      el.style.transition = 'transform 0.25s ease';

      if (swipedOpenId === s.orderId) {
        // Card was open - close if swiped right enough
        if (diffX > 30) {
          el.style.transform = 'translateX(0)';
          setSwipedOpenId(null);
        } else {
          el.style.transform = `translateX(-${DELETE_ZONE_WIDTH}px)`;
        }
      } else {
        // Card was closed - open if swiped left enough
        if (diffX < -SWIPE_THRESHOLD) {
          el.style.transform = `translateX(-${DELETE_ZONE_WIDTH}px)`;
          setSwipedOpenId(s.orderId);
        } else {
          el.style.transform = 'translateX(0)';
        }
      }
    }

    swipeRef.current = { orderId: null, startX: 0, currentX: 0, isSwiping: false };
  }, [swipedOpenId]);

  const handleCardClick = useCallback((order: SmFittingOrder) => {
    // If swiping, don't navigate
    if (swipeRef.current.isSwiping) return;
    // If this card is swiped open, close it instead of navigating
    if (swipedOpenId === order.id) {
      resetSwipe(order.id);
      return;
    }
    navigate(`/field/projects/${projectId}/sm-fitting-orders/${order.id}`);
  }, [swipedOpenId, resetSwipe, navigate, projectId]);

  if (isLoading) {
    return <div className="field-loading">Loading fitting orders...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Duct Work Fitting Orders</h1>
      <p className="field-page-subtitle">Sheet metal fabrication orders</p>

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
          <AirIcon />
          <div className="field-empty-title">No fitting orders yet</div>
          <div className="field-empty-text">
            Tap the + button to create your first duct work fitting order
          </div>
        </div>
      ) : (
        orders.map((order: SmFittingOrder) => (
          <div
            key={order.id}
            style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, marginBottom: 10 }}
          >
            {/* Delete zone behind card */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: DELETE_ZONE_WIDTH,
                background: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
                borderRadius: '0 12px 12px 0',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(order);
              }}
            >
              <DeleteIcon style={{ color: '#fff', fontSize: 22 }} />
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>Delete</span>
            </div>

            {/* Swipeable card */}
            <div
              ref={(el) => { if (el) cardRefs.current.set(order.id, el); }}
              className="field-card"
              style={{ position: 'relative', zIndex: 1, marginBottom: 0, touchAction: 'pan-y' }}
              onTouchStart={(e) => handleTouchStart(e, order.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => handleCardClick(order)}
            >
              <div className="field-card-header">
                <div>
                  <div className="field-card-number">FO-SM-{order.number}</div>
                  <div className="field-card-title">
                    {order.requested_by ? `Req: ${order.requested_by}` : order.material || 'Fitting Order'}
                  </div>
                </div>
                <span className={`field-status field-status-${order.status}`}>
                  {order.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="field-card-subtitle">
                {[order.material, order.static_pressure_class]
                  .filter(Boolean)
                  .join(' - ') || '-'}
              </div>
              <div className="field-card-meta">
                <span>
                  <span className={`field-priority field-priority-${order.priority}`}>
                    {order.priority}
                  </span>
                </span>
                <span>
                  {order.date_required ? `Due ${formatDate(order.date_required)}` : ''}
                </span>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              maxWidth: 340,
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <WarningAmberIcon style={{ color: '#dc2626', fontSize: 22 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Delete Order?</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>FO-SM-{confirmDelete.number}</div>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, margin: '0 0 8px' }}>
              This will permanently delete this fitting order and all its line items. This action cannot be undone.
            </p>

            {confirmDelete.status !== 'draft' && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                fontSize: 13,
                color: '#92400e',
                marginBottom: 8,
              }}>
                Warning: This order has status "{confirmDelete.status?.replace(/_/g, ' ')}".
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: 'none',
                  background: '#dc2626',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                  opacity: deleteMutation.isPending ? 0.6 : 1,
                }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="field-fab"
        onClick={() =>
          navigate(`/field/projects/${projectId}/sm-fitting-orders/new`)
        }
        aria-label="Create fitting order"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldSmFittingOrderList;
