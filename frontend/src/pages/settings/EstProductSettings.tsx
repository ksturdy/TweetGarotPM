import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  estProductService,
  EstProductStats,
  EstImportBatch,
  EstProductImportResult,
  EstProductSearchResult,
  EstProductSearchFilters,
} from '../../services/estProducts';
import '../../styles/SalesPipeline.css';

const EstProductSettings: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadDetails, setUploadDetails] = useState<string[]>([]);

  // Browser state
  const [searchFilters, setSearchFilters] = useState<EstProductSearchFilters>({ page: 1, limit: 25 });
  const [searchText, setSearchText] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery<EstProductStats>({
    queryKey: ['est-product-stats'],
    queryFn: estProductService.getStats,
  });

  const { data: importHistory, isLoading: historyLoading } = useQuery<EstImportBatch[]>({
    queryKey: ['est-product-import-history'],
    queryFn: estProductService.getImportHistory,
  });

  const { data: groups } = useQuery<string[]>({
    queryKey: ['est-product-groups'],
    queryFn: estProductService.getGroups,
    enabled: showBrowser,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<EstProductSearchResult>({
    queryKey: ['est-product-search', searchFilters],
    queryFn: () => estProductService.search(searchFilters),
    enabled: showBrowser,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: estProductService.uploadEstProducts,
    onSuccess: (data: EstProductImportResult) => {
      queryClient.invalidateQueries({ queryKey: ['est-product-stats'] });
      queryClient.invalidateQueries({ queryKey: ['est-product-import-history'] });
      queryClient.invalidateQueries({ queryKey: ['est-product-search'] });
      queryClient.invalidateQueries({ queryKey: ['est-product-groups'] });

      const details: string[] = [];
      if (data.mapProd.total > 0) {
        details.push(`Products: ${data.mapProd.total.toLocaleString()} processed (${data.mapProd.new.toLocaleString()} new, ${data.mapProd.updated.toLocaleString()} updated)`);
      }
      if (data.cost.total > 0) {
        details.push(`Cost data: ${data.cost.total.toLocaleString()} processed (${data.cost.matched.toLocaleString()} matched, ${data.cost.unmatched.toLocaleString()} new)`);
      }
      if (data.labor.total > 0) {
        details.push(`Labor data: ${data.labor.total.toLocaleString()} processed (${data.labor.matched.toLocaleString()} matched, ${data.labor.unmatched.toLocaleString()} new)`);
      }
      details.push(`Sheets processed: ${data.sheetsProcessed.join(', ')}`);

      setUploadDetails(details);
      setUploadStatus('');
      showSuccess(`Import complete! ${data.message}`);
      setUploading(false);
    },
    onError: (error: any) => {
      let errorMsg = 'Failed to import EST product data';
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

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 8000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    // Don't auto-clear errors — user should dismiss or they'll see it
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      setUploadStatus(`Uploading ${file.name}...`);
      setUploadDetails([]);
      setSuccessMessage('');
      setErrorMessage('');

      setTimeout(() => {
        setUploadStatus('Processing Excel file... This may take several minutes for large files.');
      }, 3000);

      uploadMutation.mutate(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFilters(prev => ({ ...prev, search: searchText || undefined, page: 1 }));
  };

  const handleGroupFilter = (group: string) => {
    setSearchFilters(prev => ({
      ...prev,
      group: group || undefined,
      page: 1,
    }));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatNumber = (num: number | string | null | undefined): string => {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString();
  };

  const formatCurrency = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    return `$${Number(num).toFixed(2)}`;
  };

  if (!isAdmin) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Admin privileges required to access EST Product settings.</p>
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

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/administration" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Administration
            </Link>
            <h1>EST Product Catalog</h1>
            <div className="sales-subtitle">Manage estimating product database with cost and labor data</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className={showBrowser ? 'sales-btn-primary' : 'sales-btn'}
            onClick={() => setShowBrowser(!showBrowser)}
          >
            {showBrowser ? 'Hide Browser' : 'Browse Products'}
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
          <div className="sales-kpi-label">Total Products</div>
          <div className="sales-kpi-value">{formatNumber(stats?.total_products)}</div>
          <div className="sales-kpi-sublabel">Unique catalog items</div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-label">With Cost Data</div>
          <div className="sales-kpi-value">{formatNumber(stats?.products_with_cost)}</div>
          <div className="sales-kpi-sublabel">Material pricing available</div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-label">With Labor Data</div>
          <div className="sales-kpi-value">{formatNumber(stats?.products_with_labor)}</div>
          <div className="sales-kpi-sublabel">Installation hours available</div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-label">Last Import</div>
          <div className="sales-kpi-value" style={{ fontSize: '1rem' }}>{formatDate(stats?.last_import || null)}</div>
          <div className="sales-kpi-sublabel">{formatNumber(stats?.products_with_both)} items with both</div>
        </div>
      </div>

      {/* Group Breakdown */}
      {stats?.groups && stats.groups.length > 0 && (
        <div className="sales-chart-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Product Groups</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {stats.groups.map((g) => (
              <div key={g.group_name} style={{
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 500 }}>{g.group_name}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatNumber(g.count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="sales-chart-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Import EST Product Data</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.875rem' }}>
          Upload the EST Map Prod Database Excel file. The system will process all 3 sheets:
          MapProd (product catalog), Cost (pricing), and Labor (installation hours).
          Existing records will be updated; new records will be created.
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
          {uploading ? 'Processing...' : 'Upload EST Product Excel File'}
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

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Product Browser */}
      {showBrowser && (
        <div className="sales-chart-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Product Browser</h3>

          {/* Search and Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '250px' }}>
              <input
                type="text"
                placeholder="Search products..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
              <button type="submit" className="sales-btn">Search</button>
            </form>
            <select
              value={searchFilters.group || ''}
              onChange={(e) => handleGroupFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">All Groups</option>
              {groups?.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Results */}
          {searchLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading...</div>
          ) : searchResults && searchResults.items.length > 0 ? (
            <>
              <div style={{ marginBottom: '12px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Showing {((searchResults.page - 1) * searchResults.limit) + 1}-{Math.min(searchResults.page * searchResults.limit, searchResults.total)} of {searchResults.total.toLocaleString()} results
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Group</th>
                      <th>Description</th>
                      <th>Size</th>
                      <th>Material</th>
                      <th>Install Type</th>
                      <th>Manufacturer</th>
                      <th>Cost</th>
                      <th>Labor (hrs)</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.product_id}</td>
                        <td>{item.group_name || '-'}</td>
                        <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.description || item.product || '-'}
                        </td>
                        <td>{item.size || '-'}</td>
                        <td>{item.material || '-'}</td>
                        <td>{item.install_type || '-'}</td>
                        <td>{item.manufacturer || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.cost)}</td>
                        <td style={{ textAlign: 'right' }}>{item.labor_time != null ? item.labor_time.toFixed(3) : '-'}</td>
                        <td>{item.unit_type === 'per_ft' ? '/ft' : 'ea'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {searchResults.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                  <button
                    className="sales-btn"
                    disabled={searchResults.page <= 1}
                    onClick={() => setSearchFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                    Page {searchResults.page} of {searchResults.pages}
                  </span>
                  <button
                    className="sales-btn"
                    disabled={searchResults.page >= searchResults.pages}
                    onClick={() => setSearchFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              {stats?.total_products ? 'No products match your filters.' : 'No products imported yet. Upload an EST Product Excel file above.'}
            </div>
          )}
        </div>
      )}

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
          <div style={{ color: 'var(--text-secondary)', padding: '16px 0' }}>
            No imports yet. Upload your first EST Product Excel file above.
          </div>
        )}
      </div>
    </div>
  );
};

export default EstProductSettings;
