import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
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
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadDetails, setUploadDetails] = useState<string[]>([]);
  const [notFoundCustomers, setNotFoundCustomers] = useState<string[]>([]);

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
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      const details: string[] = [];
      if (data.contracts.total > 0) {
        details.push(`✓ ${data.contracts.total} contracts (${data.contracts.new} new, ${data.contracts.updated} updated)`);
      }
      if (data.workOrders.total > 0) {
        details.push(`✓ ${data.workOrders.total} work orders (${data.workOrders.new} new, ${data.workOrders.updated} updated)`);
      }
      if (data.employees.total > 0) {
        details.push(`✓ ${data.employees.total} employees (${data.employees.new} new, ${data.employees.updated} updated)`);
      }
      if (data.customers.total > 0) {
        details.push(`✓ ${data.customers.total} customers (${data.customers.new} new, ${data.customers.updated} updated)`);
      }
      if (data.vendors.total > 0) {
        details.push(`✓ ${data.vendors.total} vendors (${data.vendors.new} new, ${data.vendors.updated} updated)`);
      }
      if (data.facilities && data.facilities.total > 0) {
        details.push(`✓ ${data.facilities.total} facilities (${data.facilities.created} created, ${data.facilities.updated} updated, ${data.facilities.not_found} not found)`);
        // Store not-found customer names for display
        if (data.facilities.not_found_names && data.facilities.not_found_names.length > 0) {
          setNotFoundCustomers(data.facilities.not_found_names);
        } else {
          setNotFoundCustomers([]);
        }
      } else {
        setNotFoundCustomers([]);
      }

      setUploadDetails(details);
      setUploadStatus('');
      showSuccess(`Import complete! Processed ${data.sheetsProcessed?.length || 0} sheets.`);
      setUploading(false);
    },
    onError: (error: any) => {
      let errorMsg = 'Failed to import Vista data';
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMsg = 'Upload timed out. Try a smaller file or check your connection.';
      } else if (error.code === 'ERR_NETWORK') {
        errorMsg = 'Network error. Check your connection and try again.';
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      showError(errorMsg);
      setUploading(false);
      setUploadStatus('');
      setUploadDetails([]);
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
      setUploadStatus(`Uploading ${file.name}...`);
      setUploadDetails([]);
      setSuccessMessage('');
      setErrorMessage('');

      // Show processing status after a brief delay
      setTimeout(() => {
        if (uploading) {
          setUploadStatus('Processing Excel file... This may take a moment for large files.');
        }
      }, 2000);

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
            <Link to="/administration" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Administration
            </Link>
            <h1>🔗 Vista Data Settings</h1>
            <div className="sales-subtitle">Configure Vista ERP integration</div>
          </div>
        </div>
        <div className="sales-header-actions">
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
          Contracts, Work Orders, Employees, Customers, Vendors, and Customer Facilities. Existing records will be updated; links will be preserved.
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
          style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {uploading && (
            <span style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          )}
          {uploading ? 'Processing...' : 'Upload Vista Excel File'}
        </button>

        {/* Upload Status */}
        {uploading && uploadStatus && (
          <div style={{
            marginTop: '12px',
            padding: '12px 16px',
            background: 'rgba(99, 102, 241, 0.1)',
            borderRadius: '8px',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{
              width: '20px',
              height: '20px',
              border: '3px solid rgba(99, 102, 241, 0.3)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span>{uploadStatus}</span>
          </div>
        )}

        {/* Upload Results */}
        {!uploading && uploadDetails.length > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}>
            <div style={{ fontWeight: 600, color: '#10b981', marginBottom: '8px' }}>
              Import Results
            </div>
            {uploadDetails.map((detail, idx) => (
              <div key={idx} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '4px' }}>
                {detail}
              </div>
            ))}
          </div>
        )}

        {/* Not Found Customers Warning */}
        {!uploading && notFoundCustomers.length > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '16px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}>
            <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>
              Facilities Not Matched ({notFoundCustomers.length}{notFoundCustomers.length >= 50 ? '+' : ''})
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '8px' }}>
              These Customer_Owner values from the facilities file didn't match any customer in the database:
            </div>
            <div style={{
              maxHeight: '150px',
              overflowY: 'auto',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              background: 'rgba(0,0,0,0.1)',
              padding: '8px',
              borderRadius: '4px'
            }}>
              {notFoundCustomers.map((name, idx) => (
                <div key={idx} style={{ marginBottom: '2px' }}>
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
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
