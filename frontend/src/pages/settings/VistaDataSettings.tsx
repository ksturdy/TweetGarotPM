import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { vistaDataService, VPStats, VPImportBatch } from '../../services/vistaData';
import '../../styles/SalesPipeline.css';

const VistaDataSettings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery<VPStats>({
    queryKey: ['vista-stats'],
    queryFn: vistaDataService.getStats,
  });

  const { data: importHistory, isLoading: historyLoading } = useQuery<VPImportBatch[]>({
    queryKey: ['vista-import-history'],
    queryFn: vistaDataService.getImportHistory,
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: vistaDataService.uploadVistaData,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vista-import-history'] });
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });

      const messages: string[] = [];
      if (data.contracts.total > 0) {
        messages.push(`${data.contracts.total} contracts`);
      }
      if (data.workOrders.total > 0) {
        messages.push(`${data.workOrders.total} work orders`);
      }
      if (data.employees.total > 0) {
        messages.push(`${data.employees.total} employees`);
      }
      if (data.customers.total > 0) {
        messages.push(`${data.customers.total} customers`);
      }
      if (data.vendors.total > 0) {
        messages.push(`${data.vendors.total} vendors`);
      }
      showSuccess(`Imported: ${messages.join(', ')}`);
      setUploading(false);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to import Vista data');
      setUploading(false);
    },
  });

  const autoMatchMutation = useMutation({
    mutationFn: vistaDataService.triggerAutoMatch,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      showSuccess(`Auto-matched ${data.contracts.matched} contracts and ${data.workOrders.matched} work orders`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Auto-matching failed');
    },
  });

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadMutation.mutate(file);
    }
    if (e.target) e.target.value = '';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatNumber = (num: number | string | null | undefined): string => {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString();
  };

  if (!isAdmin) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Admin privileges required to access Vista Data settings.</p>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
      </div>
    );
  }

  const totalLinkableRecords = (stats?.total_contracts || 0) + (stats?.total_work_orders || 0);
  const totalMatched = (stats?.matched_contracts || 0) + (stats?.matched_work_orders || 0);
  const totalUnmatched = (stats?.unmatched_contracts || 0) + (stats?.unmatched_work_orders || 0);
  const matchRate = totalLinkableRecords > 0 ? Math.round((totalMatched / totalLinkableRecords) * 100) : 0;
  const totalReferenceRecords = (stats?.total_employees || 0) + (stats?.total_customers || 0) + (stats?.total_vendors || 0);

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>Vista Data Integration</h1>
            <div className="sales-subtitle">Import and link data from Vista ERP (Viewpoint)</div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="sales-btn"
              onClick={() => navigate('/settings/vista-data/linking')}
            >
              Manage Links
            </button>
            <button
              className="sales-btn-primary"
              onClick={() => autoMatchMutation.mutate()}
              disabled={autoMatchMutation.isPending}
            >
              {autoMatchMutation.isPending ? 'Matching...' : 'Run Auto-Match'}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid var(--accent-green)',
          color: 'var(--accent-green)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#ef4444',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {errorMessage}
        </div>
      )}

      {/* Stats Cards */}
      <div className="sales-kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="sales-kpi-card">
          <div className="sales-kpi-label">Contracts & Work Orders</div>
          <div className="sales-kpi-value">{formatNumber(totalLinkableRecords)}</div>
          <div className="sales-kpi-sublabel">
            {formatNumber(stats?.total_contracts)} contracts, {formatNumber(stats?.total_work_orders)} work orders
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-label">Match Rate</div>
          <div className="sales-kpi-value">{matchRate}%</div>
          <div className="sales-kpi-sublabel">
            {formatNumber(totalMatched)} matched, {formatNumber(totalUnmatched)} unmatched
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-label">Reference Data</div>
          <div className="sales-kpi-value">{formatNumber(totalReferenceRecords)}</div>
          <div className="sales-kpi-sublabel">
            {formatNumber(stats?.total_employees)} employees, {formatNumber(stats?.total_customers)} customers, {formatNumber(stats?.total_vendors)} vendors
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-label">Last Import</div>
          <div className="sales-kpi-value" style={{ fontSize: '1rem' }}>{formatDate(stats?.last_contracts_import || null)}</div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="sales-chart-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Import Vista Data</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.875rem' }}>
          Upload the Vista Power Queries Excel file. The system will process all available sheets:
          Contracts, Work Orders, Employees, Customers, and Vendors. Existing records will be updated; links will be preserved.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          className="sales-btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ padding: '12px 24px' }}
        >
          {uploading ? 'Uploading...' : 'Upload Vista Excel File'}
        </button>
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Contracts:</strong> {formatNumber(stats?.total_contracts)} ({formatNumber(stats?.unmatched_contracts)} unmatched)
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Work Orders:</strong> {formatNumber(stats?.total_work_orders)} ({formatNumber(stats?.unmatched_work_orders)} unmatched)
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Employees:</strong> {formatNumber(stats?.total_employees)} ({formatNumber(stats?.active_employees)} active)
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Customers:</strong> {formatNumber(stats?.total_customers)} ({formatNumber(stats?.active_customers)} active)
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Vendors:</strong> {formatNumber(stats?.total_vendors)} ({formatNumber(stats?.active_vendors)} active)
          </div>
        </div>
      </div>

      {/* Import History */}
      <div className="sales-chart-card">
        <h3 style={{ marginBottom: '16px' }}>Import History</h3>
        {historyLoading ? (
          <div>Loading...</div>
        ) : importHistory && importHistory.length > 0 ? (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>File</th>
                <th>Records</th>
                <th>New</th>
                <th>Updated</th>
                <th>Imported By</th>
              </tr>
            </thead>
            <tbody>
              {importHistory.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDate(batch.imported_at)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{batch.file_type.replace('_', ' ')}</td>
                  <td>{batch.file_name}</td>
                  <td>{formatNumber(batch.records_total)}</td>
                  <td>{formatNumber(batch.records_new)}</td>
                  <td>{formatNumber(batch.records_updated)}</td>
                  <td>{batch.imported_by_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>No import history yet.</p>
        )}
      </div>

      {/* Quick Links */}
      <div className="sales-chart-card" style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="sales-btn"
            onClick={() => navigate('/settings/vista-data/linking?tab=contracts&filter=unmatched')}
          >
            Review Unmatched Contracts ({formatNumber(stats?.unmatched_contracts)})
          </button>
          <button
            className="sales-btn"
            onClick={() => navigate('/settings/vista-data/linking?tab=work-orders&filter=unmatched')}
          >
            Review Unmatched Work Orders ({formatNumber(stats?.unmatched_work_orders)})
          </button>
        </div>
      </div>
    </div>
  );
};

export default VistaDataSettings;
