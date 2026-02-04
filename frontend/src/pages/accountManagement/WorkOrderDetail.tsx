import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vistaDataService, VPWorkOrder } from '../../services/vistaData';
import '../../styles/SalesPipeline.css';

const WorkOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: workOrder, isLoading, error } = useQuery({
    queryKey: ['vista-work-order', id],
    queryFn: () => vistaDataService.getWorkOrderById(Number(id)),
    enabled: !!id,
  });

  // Helper function to get status color
  const getStatusColor = (status: string | null): string => {
    const colors: { [key: string]: string } = {
      'Open': '#10b981',
      'Soft-Closed': '#f59e0b',
      'Hard-Closed': '#6b7280',
    };
    return colors[status || ''] || '#6b7280';
  };

  // Helper function to get link status color
  const getLinkStatusColor = (status: string): string => {
    const colors: { [key: string]: string } = {
      'unmatched': '#ef4444',
      'auto_matched': '#10b981',
      'manual_matched': '#3b82f6',
      'ignored': '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  // Helper function to format currency
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Helper function to format percentage
  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return `${(Number(value) * 100).toFixed(1)}%`;
  };

  // Helper function to format date
  const formatDate = (value: string | null | undefined): string => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper function to format hours
  const formatHours = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} hrs`;
  };

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading work order...</div>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h3>Work order not found</h3>
          <button
            className="sales-btn sales-btn-primary"
            onClick={() => navigate('/account-management/work-orders')}
            style={{ marginTop: '1rem' }}
          >
            Back to Work Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => navigate('/account-management/work-orders')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                className="sales-btn-secondary"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1>🔧 {workOrder.work_order_number}</h1>
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: `${getStatusColor(workOrder.status)}20`,
                  color: getStatusColor(workOrder.status),
                }}
              >
                {workOrder.status || 'Unknown'}
              </span>
            </div>
            <div className="sales-subtitle">{workOrder.description || 'No description'}</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 500,
              background: `${getLinkStatusColor(workOrder.link_status)}20`,
              color: getLinkStatusColor(workOrder.link_status),
              textTransform: 'capitalize',
            }}
          >
            {workOrder.link_status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Contract Amount</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#3b82f6' }}>{formatCurrency(workOrder.contract_amount)}</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Actual Cost</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>{formatCurrency(workOrder.actual_cost)}</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Backlog</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#8b5cf6' }}>{formatCurrency(workOrder.backlog)}</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Gross Profit</div>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: workOrder.gross_profit_percent && workOrder.gross_profit_percent > 0 ? '#10b981' : '#ef4444'
          }}>
            {formatPercent(workOrder.gross_profit_percent)}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Billed Amount</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f59e0b' }}>{formatCurrency(workOrder.billed_amount)}</div>
        </div>
      </div>

      {/* Detail Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

        {/* General Information */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            General Information
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailRow label="Work Order Number" value={workOrder.work_order_number} />
            <DetailRow label="Description" value={workOrder.description} />
            <DetailRow label="Status" value={workOrder.status} />
            <DetailRow label="Primary Market" value={workOrder.primary_market} />
            <DetailRow label="Department Code" value={workOrder.department_code} />
            <DetailRow label="Negotiated Work" value={workOrder.negotiated_work} />
          </div>
        </div>

        {/* Customer & Location */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            Customer & Location
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailRow label="Customer Name" value={workOrder.customer_name} />
            <DetailRow label="City" value={workOrder.city} />
            <DetailRow label="State" value={workOrder.state} />
            <DetailRow label="ZIP" value={workOrder.zip} />
            <DetailRow
              label="Full Address"
              value={[workOrder.city, workOrder.state, workOrder.zip].filter(Boolean).join(', ') || null}
            />
          </div>
        </div>

        {/* Project Manager */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            Project Manager
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailRow label="Employee Number" value={workOrder.employee_number} />
            <DetailRow label="Project Manager Name" value={workOrder.project_manager_name} />
          </div>
        </div>

        {/* Dates */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            Dates
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailRow label="Entered Date" value={formatDate(workOrder.entered_date)} />
            <DetailRow label="Requested Date" value={formatDate(workOrder.requested_date)} />
            <DetailRow label="Imported At" value={formatDate(workOrder.imported_at)} />
            <DetailRow label="Last Updated" value={formatDate(workOrder.updated_at)} />
          </div>
        </div>

        {/* Financial Summary */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            Financial Summary
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailRow label="Contract Amount" value={formatCurrency(workOrder.contract_amount)} />
            <DetailRow label="Actual Cost" value={formatCurrency(workOrder.actual_cost)} />
            <DetailRow label="Billed Amount" value={formatCurrency(workOrder.billed_amount)} />
            <DetailRow label="Received Amount" value={formatCurrency(workOrder.received_amount)} />
            <DetailRow label="Backlog" value={formatCurrency(workOrder.backlog)} />
            <DetailRow label="Gross Profit %" value={formatPercent(workOrder.gross_profit_percent)} highlight={workOrder.gross_profit_percent !== null} highlightColor={workOrder.gross_profit_percent && workOrder.gross_profit_percent > 0 ? '#10b981' : '#ef4444'} />
          </div>
        </div>

        {/* Labor Hours */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            Labor Hours (Job to Date)
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailRow label="PF Hours JTD" value={formatHours(workOrder.pf_hours_jtd)} />
            <DetailRow label="SM Hours JTD" value={formatHours(workOrder.sm_hours_jtd)} />
            <DetailRow
              label="Total Hours JTD"
              value={formatHours((workOrder.pf_hours_jtd || 0) + (workOrder.sm_hours_jtd || 0))}
              highlight
              highlightColor="#3b82f6"
            />
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            Cost Breakdown (Job to Date)
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailRow label="MEP JTD" value={formatCurrency(workOrder.mep_jtd)} />
            <DetailRow label="Material JTD" value={formatCurrency(workOrder.material_jtd)} />
            <DetailRow label="Subcontracts JTD" value={formatCurrency(workOrder.subcontracts_jtd)} />
            <DetailRow label="Rentals JTD" value={formatCurrency(workOrder.rentals_jtd)} />
          </div>
        </div>

        {/* Linked Titan Records */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            Linked Titan Records
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailRow label="Link Status" value={workOrder.link_status.replace('_', ' ')} />
            <DetailRow label="Link Confidence" value={workOrder.link_confidence ? `${(workOrder.link_confidence * 100).toFixed(0)}%` : null} />
            <DetailRow label="Linked At" value={formatDate(workOrder.linked_at)} />
            <DetailRow label="Linked Employee" value={workOrder.linked_employee_name || (workOrder.linked_employee_id ? `ID: ${workOrder.linked_employee_id}` : null)} />
            <DetailRow label="Linked Customer" value={workOrder.linked_customer_facility || workOrder.linked_customer_owner || (workOrder.linked_customer_id ? `ID: ${workOrder.linked_customer_id}` : null)} />
            <DetailRow label="Linked Department" value={workOrder.linked_department_name || (workOrder.linked_department_id ? `ID: ${workOrder.linked_department_id}` : null)} />
          </div>
        </div>
      </div>

      {/* Raw Data Section */}
      {workOrder.raw_data && Object.keys(workOrder.raw_data).length > 0 && (
        <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            Raw Vista Data
          </h3>
          <pre style={{
            background: '#f8fafc',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            overflow: 'auto',
            maxHeight: '400px',
            color: '#334155'
          }}>
            {JSON.stringify(workOrder.raw_data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

// Helper component for detail rows
interface DetailRowProps {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
  highlightColor?: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, highlight, highlightColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{label}</span>
    <span style={{
      fontSize: '0.875rem',
      fontWeight: highlight ? 600 : 500,
      color: highlight && highlightColor ? highlightColor : (value && value !== '-' ? '#1e293b' : '#94a3b8')
    }}>
      {value || '-'}
    </span>
  </div>
);

export default WorkOrderDetail;
