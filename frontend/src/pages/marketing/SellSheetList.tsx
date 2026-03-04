import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { sellSheetsApi, SellSheet } from '../../services/sellSheets';
import '../../styles/SalesPipeline.css';

const getImageUrl = (filePath: string) => {
  if (!filePath) return '';
  // If already a full URL (R2 or presigned), use as-is
  if (filePath.startsWith('http')) return filePath;
  // Handle absolute paths stored by multer (e.g. C:\...\uploads\sell-sheets\file.jpg)
  const idx = filePath.replace(/\\/g, '/').indexOf('uploads/');
  if (idx !== -1) {
    return '/' + filePath.replace(/\\/g, '/').substring(idx);
  }
  return `/uploads/${filePath}`;
};

const SellSheetList: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: sellSheets, isLoading, error } = useQuery({
    queryKey: ['sellSheets', statusFilter],
    queryFn: () => {
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      return sellSheetsApi.getAll(filters).then(res => res.data);
    },
  });

  const filteredSellSheets = useMemo(() => {
    if (!sellSheets) return [];
    if (!searchQuery.trim()) return sellSheets;
    const query = searchQuery.toLowerCase();
    return sellSheets.filter((ss: SellSheet) =>
      ss.service_name.toLowerCase().includes(query) ||
      (ss.title && ss.title.toLowerCase().includes(query))
    );
  }, [sellSheets, searchQuery]);

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'badge badge-info',
      published: 'badge badge-success',
      archived: 'badge',
    };
    return classes[status] || 'badge';
  };

  const getStatusStyle = (status: string): React.CSSProperties => {
    if (status === 'archived') {
      return { backgroundColor: '#fee2e2', color: '#991b1b' };
    }
    return {};
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatLayoutStyle = (layout: string) => {
    return layout === 'two_column' ? 'Two Column' : 'Full Width';
  };

  if (isLoading) {
    return <div className="loading">Loading sell sheets...</div>;
  }

  if (error) {
    return <div className="error-message">Error loading sell sheets</div>;
  }

  return (
    <div className="container sell-sheet-list-page">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>Sell Sheets</h1>
            <div className="sales-subtitle">{filteredSellSheets.length} sell sheets</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <Link to="/sell-sheets/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            + Create Sell Sheet
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div
        className="card"
        style={{ marginBottom: '1.5rem', padding: '1rem' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Service Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="Search by service name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {(statusFilter || searchQuery) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStatusFilter('');
                  setSearchQuery('');
                }}
                style={{ width: '100%' }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sell Sheets Grid */}
      {filteredSellSheets.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {filteredSellSheets.map((sellSheet: SellSheet) => {
            const heroImage = sellSheet.images?.find(img => img.is_hero_image);
            const heroUrl = heroImage
              ? (heroImage.image_url || getImageUrl(heroImage.file_path))
              : null;

            return (
              <Link
                key={sellSheet.id}
                to={`/sell-sheets/${sellSheet.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="card"
                  style={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    padding: 0,
                    overflow: 'hidden',
                    height: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  {/* Hero Image */}
                  {heroUrl && (
                    <div
                      style={{
                        width: '100%',
                        height: '200px',
                        backgroundColor: '#f3f4f6',
                        backgroundImage: `url(${heroUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                  )}

                  <div style={{ padding: '1.5rem' }}>
                    {/* Status Badge & Layout */}
                    <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={getStatusBadge(sellSheet.status)} style={getStatusStyle(sellSheet.status)}>
                        {formatStatus(sellSheet.status)}
                      </span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#e0e7ff',
                          color: '#3730a3',
                        }}
                      >
                        {formatLayoutStyle(sellSheet.layout_style)}
                      </span>
                    </div>

                    {/* Service Name */}
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700 }}>
                      {sellSheet.service_name}
                    </h3>

                    {/* Title (if different from service name) */}
                    {sellSheet.title && sellSheet.title !== sellSheet.service_name && (
                      <p
                        style={{
                          margin: '0 0 0.75rem 0',
                          color: 'var(--secondary)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {sellSheet.title}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                        color: 'var(--secondary)',
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #e2e8f0',
                      }}
                    >
                      <span>
                        Created {new Date(sellSheet.created_at).toLocaleDateString()}
                      </span>
                      {(sellSheet.image_count !== undefined && sellSheet.image_count !== null) && (
                        <span>
                          {sellSheet.image_count} {sellSheet.image_count === 1 ? 'image' : 'images'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--secondary)',
          }}
        >
          <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
            No sell sheets found
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/sell-sheets/create')}
          >
            Create Your First Sell Sheet
          </button>
        </div>
      )}
    </div>
  );
};

export default SellSheetList;
