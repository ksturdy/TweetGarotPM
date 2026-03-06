import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { sheetMetalFittingOrdersApi, SheetMetalFittingOrder, SheetMetalFittingOrderItem } from '../../../services/sheetMetalFittingOrders';
import { fieldPurchaseOrdersApi, FieldPurchaseOrder, formatFpoNumber } from '../../../services/fieldPurchaseOrders';
import { fieldFavoriteVendorsApi, FieldFavoriteVendor } from '../../../services/fieldFavoriteVendors';
import { generateSheetMetalFittingOrderPdf } from '../../../utils/sheetMetalFittingOrderPdfClient';

const FITTING_LABELS: Record<string, string> = {
  '90': '90\u00B0 Elbow',
  '45': '45\u00B0 Elbow',
  tee: 'Tee',
  wye: 'Wye',
  reducer: 'Reducer',
  offset: 'Offset',
  transition: 'Transition',
  end_cap: 'End Cap',
  takeoff: 'Takeoff/Tap',
  start_collar: 'Start Collar',
  flex_connector: 'Flex Connector',
  volume_damper: 'Volume Damper',
  fire_damper: 'Fire Damper',
  turning_vanes: 'Turning Vanes',
  duct: 'Duct (Straight)',
  other: 'Other',
  // Accessories
  register: 'Register',
  grille: 'Grille',
  diffuser: 'Diffuser',
  access_door: 'Access Door',
  smoke_detector: 'Smoke Det. Housing',
  filter_box: 'Filter Box',
  vav_box: 'VAV Box',
  mixing_box: 'Mixing Box',
  // Hardware
  drive_cleat: 'Drive Cleat',
  s_cleat: 'S-Cleat',
  hanger_strap: 'Hanger Strap',
  threaded_rod: 'Threaded Rod',
  nut: 'Nut',
  bolt: 'Bolt',
  washer: 'Washer',
  screw: 'Screw',
  all_thread: 'All-Thread',
  other_hardware: 'Other',
};

const JOIN_LABELS: Record<string, string> = {
  s_drive: 'S & Drive',
  tdc: 'TDC',
  flanged: 'Flanged',
  raw_crimped: 'Raw/Crimped',
  welded: 'Welded',
  slip_joint: 'Slip Joint',
  standing_seam: 'Standing Seam',
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const str = String(dateStr);
  const date = new Date(str.includes('T') ? str : str + 'T00:00:00');
  return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function buildItemDescription(item: SheetMetalFittingOrderItem): string {
  const fitting = FITTING_LABELS[item.fitting_type] || item.fitting_type || '';
  const size = item.size || '';
  const join = item.join_type ? (JOIN_LABELS[item.join_type] || item.join_type) : '';
  return [size, fitting, join].filter(Boolean).join(' ');
}

const FieldSheetMetalFittingOrderDetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isDownloading, setIsDownloading] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);
  const [creatingPo, setCreatingPo] = useState(false);
  const [showQuoteVendorPicker, setShowQuoteVendorPicker] = useState(false);

  const { data: quoteVendors = [] } = useQuery({
    queryKey: ['field-favorite-vendors'],
    queryFn: async () => {
      const res = await fieldFavoriteVendorsApi.getAll();
      return res.data;
    },
    enabled: showQuoteVendorPicker,
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ['field-sheet-metal-fitting-order', id],
    queryFn: async () => {
      const res = await sheetMetalFittingOrdersApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  const { data: draftPos } = useQuery({
    queryKey: ['field-purchase-orders-draft', projectId],
    queryFn: async () => {
      const res = await fieldPurchaseOrdersApi.getByProject(Number(projectId), { status: 'draft' });
      return res.data;
    },
    enabled: showPoModal && !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => sheetMetalFittingOrdersApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-sheet-metal-fitting-orders'] });
      navigate(`/field/projects/${projectId}/sheet-metal-fitting-orders`);
    },
  });

  const handleDelete = () => {
    const msg = order && order.status !== 'draft'
      ? `\u26A0\uFE0F This fitting order has status "${order.status.replace(/_/g, ' ')}". Are you sure you want to permanently delete it?`
      : 'Delete this fitting order? This cannot be undone.';
    if (window.confirm(msg)) {
      deleteMutation.mutate();
    }
  };

  const handleEmailQuote = async (vendorEmail?: string) => {
    if (!order) return;
    setShowQuoteVendorPicker(false);
    setIsDownloading(true);
    try {
      const blob = await generateSheetMetalFittingOrderPdf(order as any);
      const filename = `FO-SM-${order.number}.pdf`;
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `FO-SM-${order.number}${vendorEmail ? ` - ${vendorEmail}` : ''}`,
        });
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        const itemCount = (order.items || []).length;
        const subject = encodeURIComponent(
          `Quote Request - Sheet Metal Fittings FO-SM-${order.number} - ${order.title || ''}`
        );
        const body = encodeURIComponent(
          `Please provide a quote for the attached sheet metal fitting order FO-SM-${order.number}.\n\n` +
          `Title: ${order.title || ''}\n` +
          `Material: ${order.material_type || '-'}\n` +
          `Priority: ${order.priority || 'normal'}\n` +
          `Items: ${itemCount} item${itemCount !== 1 ? 's' : ''}\n\n` +
          `The PDF is attached to this email.\n\n` +
          `Thank you,\nTweet Garot Mechanical`
        );
        const to = vendorEmail ? encodeURIComponent(vendorEmail) : '';
        window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
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
      const blob = await generateSheetMetalFittingOrderPdf(order as any);
      const filename = `FO-SM-${order.number}.pdf`;

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

  const createNewPo = async () => {
    if (!order) return;
    setCreatingPo(true);
    try {
      const items = order.items || [];
      const poData: Partial<FieldPurchaseOrder> = {
        project_id: Number(projectId),
        description: `Sheet metal fittings from FO-SM-${order.number}${order.title ? ` - ${order.title}` : ''}`,
        notes: `Created from sheet metal fitting order FO-SM-${order.number}`,
        cost_code: order.cost_code || '',
        phase_code: order.phase_code || '',
      };

      const res = await fieldPurchaseOrdersApi.create(poData);
      const newPoId = res.data.id;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await fieldPurchaseOrdersApi.addItem(newPoId, {
          sort_order: i + 1,
          description: buildItemDescription(item),
          quantity: item.quantity || 1,
          unit: 'EA',
          unit_cost: 0,
          total_cost: 0,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['field-purchase-orders'] });
      setShowPoModal(false);
      navigate(`/field/projects/${projectId}/purchase-orders/${newPoId}/edit`);
    } catch (err) {
      console.error('Failed to create PO:', err);
      window.alert('Failed to create purchase order. Please try again.');
    } finally {
      setCreatingPo(false);
    }
  };

  const addToExistingPo = async (poId: number) => {
    if (!order) return;
    setCreatingPo(true);
    try {
      const items = order.items || [];
      const existingRes = await fieldPurchaseOrdersApi.getById(poId);
      const existingItems = existingRes.data.items || [];
      const startOrder = existingItems.length + 1;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await fieldPurchaseOrdersApi.addItem(poId, {
          sort_order: startOrder + i,
          description: buildItemDescription(item),
          quantity: item.quantity || 1,
          unit: 'EA',
          unit_cost: 0,
          total_cost: 0,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['field-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['field-purchase-order', String(poId)] });
      setShowPoModal(false);
      navigate(`/field/projects/${projectId}/purchase-orders/${poId}/edit`);
    } catch (err) {
      console.error('Failed to add items to PO:', err);
      window.alert('Failed to add items to purchase order. Please try again.');
    } finally {
      setCreatingPo(false);
    }
  };

  if (isLoading || !order) {
    return <div className="field-loading">Loading order details...</div>;
  }

  const isDraft = order.status === 'draft';
  const items: SheetMetalFittingOrderItem[] = order.items || [];
  const isBusy = deleteMutation.isPending || isDownloading || creatingPo;

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
        {order.material_type && (
          <div className="field-detail-row">
            <span className="field-detail-label">Material</span>
            <span className="field-detail-value">{order.material_type}</span>
          </div>
        )}
        {order.location_on_site && (
          <div className="field-detail-row">
            <span className="field-detail-label">Location</span>
            <span className="field-detail-value">{order.location_on_site}</span>
          </div>
        )}
        {order.drawing_number && (
          <div className="field-detail-row">
            <span className="field-detail-label">Drawing</span>
            <span className="field-detail-value">
              {order.drawing_number}{order.drawing_revision ? ` Rev ${order.drawing_revision}` : ''}
            </span>
          </div>
        )}
        {order.description && (
          <div className="field-detail-row">
            <span className="field-detail-label">Description</span>
            <span className="field-detail-value">{order.description}</span>
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="field-detail-section" style={{ padding: 0 }}>
        <div className="field-detail-section-title" style={{ padding: '10px 12px', margin: 0 }}>
          Items ({items.length})
        </div>
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                padding: '10px 12px',
                borderBottom: index < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                background: index % 2 === 0 ? '#fff' : '#f9fafb',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', minWidth: 32 }}>
                {item.quantity}x
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#92400e' }}>
                {item.size}
              </span>
              <span style={{ fontSize: 14, color: '#374151' }}>
                {FITTING_LABELS[item.fitting_type] || item.fitting_type}
              </span>
              {item.join_type && (
                <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
                  {JOIN_LABELS[item.join_type] || item.join_type}
                </span>
              )}
              {item.remarks && (
                <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', width: '100%', paddingLeft: 32 }}>
                  {item.remarks}
                </span>
              )}
            </div>
          ))
        ) : (
          <div style={{ padding: '16px 12px', color: '#9ca3af', fontSize: 14 }}>
            No items added
          </div>
        )}
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
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, padding: '0 12px 8px' }}>
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
        <button
          className="field-btn field-btn-primary"
          onClick={() => setShowQuoteVendorPicker(true)}
          disabled={isBusy}
          style={{ background: '#b45309' }}
        >
          <EmailIcon style={{ fontSize: 18 }} />
          {isDownloading ? 'Preparing PDF...' : 'Submit for Quote'}
        </button>

        <button
          className="field-btn field-btn-success"
          onClick={() => setShowPoModal(true)}
          disabled={isBusy || items.length === 0}
        >
          <ShoppingCartIcon style={{ fontSize: 18 }} />
          Create Purchase Order
        </button>

        <button
          className="field-btn field-btn-secondary"
          onClick={handleDownloadPdf}
          disabled={isBusy}
        >
          <PictureAsPdfIcon style={{ fontSize: 18 }} />
          {isDownloading ? 'Downloading...' : 'Download PDF'}
        </button>

        {isDraft && (
          <button
            className="field-btn field-btn-secondary"
            onClick={() =>
              navigate(`/field/projects/${projectId}/sheet-metal-fitting-orders/${id}/edit`)
            }
          >
            <EditIcon style={{ fontSize: 18 }} />
            Edit Order
          </button>
        )}

        <button
          className="field-btn field-btn-danger"
          onClick={handleDelete}
          disabled={isBusy}
        >
          <DeleteIcon style={{ fontSize: 18 }} />
          {deleteMutation.isPending ? 'Deleting...' : 'Delete Order'}
        </button>
      </div>

      {/* Create PO Modal */}
      {showPoModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => !creatingPo && setShowPoModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px 16px 0 0',
              width: '100%',
              maxWidth: 500,
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '16px 16px 24px',
              WebkitOverflowScrolling: 'touch',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                Create Purchase Order
              </h2>
              <button
                type="button"
                onClick={() => !creatingPo && setShowPoModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}
              >
                <CloseIcon style={{ fontSize: 22 }} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
              {items.length} item{items.length !== 1 ? 's' : ''} will be added as line items to the purchase order.
            </p>

            <button
              type="button"
              onClick={createNewPo}
              disabled={creatingPo}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #d97706',
                borderRadius: 10,
                background: '#fef3c7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <AddIcon style={{ fontSize: 22, color: '#b45309' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>
                  {creatingPo ? 'Creating...' : 'Create New PO'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Start a new purchase order with these items
                </div>
              </div>
            </button>

            {draftPos && draftPos.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Or add to existing draft PO
                </div>
                {draftPos.map((po: FieldPurchaseOrder) => (
                  <button
                    key={po.id}
                    type="button"
                    onClick={() => addToExistingPo(po.id)}
                    disabled={creatingPo}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <ShoppingCartIcon style={{ fontSize: 20, color: '#6b7280' }} />
                    <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                        {formatFpoNumber(po)}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {po.vendor_name || 'No vendor'}{po.items ? ` \u2022 ${po.items.length} items` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Quote Vendor Picker Modal */}
      {showQuoteVendorPicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowQuoteVendorPicker(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px 16px 0 0',
              width: '100%',
              maxWidth: 500,
              maxHeight: '70vh',
              overflow: 'auto',
              padding: '16px 16px 24px',
              WebkitOverflowScrolling: 'touch',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                Send Quote To
              </h2>
              <button
                type="button"
                onClick={() => setShowQuoteVendorPicker(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}
              >
                <CloseIcon style={{ fontSize: 22 }} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
              Select a vendor to pre-fill the email, or skip to send without.
            </p>

            <button
              type="button"
              onClick={() => handleEmailQuote()}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                background: '#f9fafb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <SkipNextIcon style={{ fontSize: 20, color: '#6b7280' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Skip - No Vendor</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Send quote without a pre-filled recipient</div>
              </div>
            </button>

            {quoteVendors.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Favorite Vendors
                </div>
                {quoteVendors.map((vendor: FieldFavoriteVendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => handleEmailQuote(vendor.email)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{vendor.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {[vendor.contact_name, vendor.email, vendor.phone].filter(Boolean).join(' \u2022 ')}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldSheetMetalFittingOrderDetail;
