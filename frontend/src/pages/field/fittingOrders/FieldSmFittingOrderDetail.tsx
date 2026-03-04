import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { smFittingOrdersApi, SmFittingOrderItem } from '../../../services/smFittingOrders';
import { FittingTypeReference } from './FittingTypeDiagrams';
import { generateFittingOrderPdf } from '../../../utils/fittingOrderPdfClient';

const FITTING_TYPES: Record<number, string> = {
  1: 'St. Joint',
  2: 'Reducer',
  3: 'Offset',
  4: 'Elbow',
  5: 'Tee',
  6: 'Wye',
  7: 'Dbl Branch',
  8: 'Tap',
  9: 'Transition',
  10: 'End Cap',
};

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

  const [isDownloading, setIsDownloading] = useState(false);

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
    onError: () => {
      window.alert('Failed to submit order. Please try again.');
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

  const handleEmailToShop = async () => {
    if (!order) return;
    setIsDownloading(true);
    try {
      const blob = await generateFittingOrderPdf(order as any);
      const filename = `FO-SM-${order.number}.pdf`;
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      // Use native share on mobile (works on iOS/Android) to attach file directly
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `FO-SM-${order.number}`,
        });
      } else {
        // Desktop fallback: download file then open mailto
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        const subject = encodeURIComponent(
          `Fitting Order FO-SM-${order.number} - ${order.title || 'Duct Work Fitting Order'}`
        );
        const itemCount = (order.items || []).length;
        const body = encodeURIComponent(
          `Please find the attached fitting order FO-SM-${order.number}.\n\n` +
          `Title: ${order.title || 'Duct Work Fitting Order'}\n` +
          `Material: ${order.material || '-'}\n` +
          `Priority: ${order.priority || 'normal'}\n` +
          `Fittings: ${itemCount} item${itemCount !== 1 ? 's' : ''}\n\n` +
          `The PDF is attached to this email.\n\n` +
          `Thank you,\nTweet Garot Mechanical`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      window.alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!order) return;
    setIsDownloading(true);
    try {
      const blob = await generateFittingOrderPdf(order as any);
      const filename = `FO-SM-${order.number}.pdf`;

      // On iOS, use native share sheet (lets user save to Files, AirDrop, etc.)
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIos) {
        try {
          const pdfFile = new File([blob], filename, { type: 'application/pdf' });
          if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
            await navigator.share({ files: [pdfFile], title: filename });
            return;
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
        }
        // Fallback: open blob URL in new tab
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
      }
    } catch {
      window.alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading || !order) {
    return <div className="field-loading">Loading order details...</div>;
  }

  const isDraft = order.status === 'draft';
  const items: SmFittingOrderItem[] = order.items || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="field-page-title">FO-SM-{order.number}</h1>
          <p className="field-page-subtitle" style={{ marginBottom: 0 }}>
            Duct Work Fitting Order
          </p>
        </div>
        <span className={`field-status field-status-${order.status}`}>
          {order.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Order Header */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Order Info</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Requested By</span>
          <span className="field-detail-value">{order.requested_by || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Date Required</span>
          <span className="field-detail-value">{formatDate(order.date_required)}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Prepared By</span>
          <span className="field-detail-value">{order.prepared_by || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Priority</span>
          <span className={`field-priority field-priority-${order.priority}`}>
            {order.priority}
          </span>
        </div>
      </div>

      {/* Material Specs */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Specifications</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Material</span>
          <span className="field-detail-value">{order.material || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Static Pressure Class</span>
          <span className="field-detail-value">{order.static_pressure_class || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Longitudinal Seam</span>
          <span className="field-detail-value">{order.longitudinal_seam || '-'}</span>
        </div>
      </div>

      {/* Phase Codes */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Phase Codes</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Labor Phase Code</span>
          <span className="field-detail-value">{order.labor_phase_code || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Material Phase Code</span>
          <span className="field-detail-value">{order.material_phase_code || '-'}</span>
        </div>
      </div>

      {/* Fitting Type Reference */}
      {items.length > 0 && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Fitting Type Reference</div>
          <FittingTypeReference />
        </div>
      )}

      {/* Fitting Items Table */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">
          Fittings ({items.length} item{items.length !== 1 ? 's' : ''})
        </div>
        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>No fittings added</div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -12px', padding: '0 12px' }}>
            <table style={{ tableLayout: 'fixed', width: 930, borderCollapse: 'collapse', fontSize: 12, border: '1px solid #9ca3af' }}>
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 64 }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  {['#REQ', 'TYPE', 'A x B', 'C x D', 'E', 'F', 'L', 'R', 'X', 'GA', 'LINER', 'CONN', 'REMARKS'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '5px 2px',
                        fontWeight: 700,
                        color: '#92400e',
                        textAlign: 'center',
                        background: '#dbeafe',
                        borderBottom: '2px solid #60a5fa',
                        borderRight: h !== 'REMARKS' ? '1px solid #93c5fd' : 'none',
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
                {items.map((item, idx) => {
                  const cellStyle: React.CSSProperties = {
                    padding: '6px 4px',
                    borderBottom: '1px solid #d1d5db',
                    borderRight: '1px solid #e5e7eb',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                  };
                  return (
                    <tr key={item.id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ ...cellStyle, fontWeight: 500 }}>{item.quantity}</td>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        {item.fitting_type || '-'}
                      </td>
                      <td style={cellStyle}>
                        {(item.dim_a || item.dim_b) ? `${item.dim_a || ''} x ${item.dim_b || ''}` : ''}
                      </td>
                      <td style={cellStyle}>
                        {(item.dim_c || item.dim_d) ? `${item.dim_c || ''} x ${item.dim_d || ''}` : ''}
                      </td>
                      <td style={cellStyle}>{item.dim_e || ''}</td>
                      <td style={cellStyle}>{item.dim_f || ''}</td>
                      <td style={cellStyle}>{item.dim_l || ''}</td>
                      <td style={cellStyle}>{item.dim_r || ''}</td>
                      <td style={cellStyle}>{item.dim_x || ''}</td>
                      <td style={cellStyle}>{item.gauge || ''}</td>
                      <td style={cellStyle}>{item.liner || ''}</td>
                      <td style={cellStyle}>{item.connection || ''}</td>
                      <td style={{ ...cellStyle, borderRight: 'none', textAlign: 'left', fontStyle: item.remarks ? 'italic' : 'normal' }}>{item.remarks || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shop Info */}
      {(order.shop_assigned_to || order.fabrication_start_date) && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Shop Info</div>
          {order.shop_assigned_to && (
            <div className="field-detail-row">
              <span className="field-detail-label">Assigned To</span>
              <span className="field-detail-value">{order.shop_assigned_to}</span>
            </div>
          )}
          {order.shop_received_date && (
            <div className="field-detail-row">
              <span className="field-detail-label">Received</span>
              <span className="field-detail-value">{formatDate(order.shop_received_date)}</span>
            </div>
          )}
          {order.fabrication_start_date && (
            <div className="field-detail-row">
              <span className="field-detail-label">Fab Started</span>
              <span className="field-detail-value">{formatDate(order.fabrication_start_date)}</span>
            </div>
          )}
          {order.fabrication_complete_date && (
            <div className="field-detail-row">
              <span className="field-detail-label">Fab Complete</span>
              <span className="field-detail-value">{formatDate(order.fabrication_complete_date)}</span>
            </div>
          )}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, marginBottom: 24 }}>
        {isDraft && (
          <>
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
          </>
        )}
        <button
          className="field-btn field-btn-primary"
          onClick={handleEmailToShop}
          disabled={isDownloading}
          style={{ background: '#2563eb' }}
        >
          <EmailIcon style={{ fontSize: 18 }} />
          {isDownloading ? 'Preparing PDF...' : 'Email to Shop'}
        </button>
        <button
          className="field-btn field-btn-secondary"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
        >
          <PictureAsPdfIcon style={{ fontSize: 18 }} />
          {isDownloading ? 'Downloading...' : 'Download PDF'}
        </button>
        {isDraft && (
          <button
            className="field-btn field-btn-danger"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <DeleteIcon style={{ fontSize: 18 }} />
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Order'}
          </button>
        )}
      </div>
    </div>
  );
};

export default FieldSmFittingOrderDetail;
