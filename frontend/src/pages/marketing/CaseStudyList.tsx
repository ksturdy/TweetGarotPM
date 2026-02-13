import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { caseStudiesApi, CaseStudy } from '../../services/caseStudies';
import '../../styles/SalesPipeline.css';

const getImageUrl = (filePath: string) => {
  if (!filePath) return '';
  // If already a full URL (R2 or presigned), use as-is
  if (filePath.startsWith('http')) return filePath;
  // Handle absolute paths stored by multer (e.g. C:\...\uploads\case-studies\file.jpg)
  const idx = filePath.replace(/\\/g, '/').indexOf('uploads/');
  if (idx !== -1) {
    return '/' + filePath.replace(/\\/g, '/').substring(idx);
  }
  return `/uploads/${filePath}`;
};

const CaseStudyList: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [marketFilter, setMarketFilter] = useState<string>('');

  const { data: caseStudies, isLoading, error } = useQuery({
    queryKey: ['caseStudies', statusFilter, marketFilter],
    queryFn: () => {
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      if (marketFilter) filters.market = marketFilter;
      return caseStudiesApi.getAll(filters).then(res => res.data);
    },
  });

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'badge badge-info',
      published: 'badge badge-success',
      archived: 'badge',
    };
    return classes[status] || 'badge';
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (isLoading) {
    return <div className="loading">Loading case studies...</div>;
  }

  if (error) {
    return <div className="error-message">Error loading case studies</div>;
  }

  return (
    <div className="container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>📊 Case Studies</h1>
            <div className="sales-subtitle">{caseStudies?.length || 0} case studies</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate('/case-studies/create')}
          >
            + Create Case Study
          </button>
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
            <label className="form-label">Market</label>
            <select
              className="form-input"
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
            >
              <option value="">All Markets</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Industrial">Industrial</option>
              <option value="Commercial">Commercial</option>
              <option value="Education">Education</option>
              <option value="Government">Government</option>
            </select>
          </div>

          {(statusFilter || marketFilter) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStatusFilter('');
                  setMarketFilter('');
                }}
                style={{ width: '100%' }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Case Studies Grid */}
      {caseStudies && caseStudies.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {caseStudies.map((caseStudy: CaseStudy) => (
            <div
              key={caseStudy.id}
              className="card"
              style={{
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                padding: 0,
                overflow: 'hidden',
              }}
              onClick={() => navigate(`/case-studies/${caseStudy.id}`)}
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
              {(caseStudy.hero_image_url || caseStudy.hero_image_path) && (
                <div
                  style={{
                    width: '100%',
                    height: '200px',
                    backgroundColor: '#f3f4f6',
                    backgroundImage: `url(${caseStudy.hero_image_url || getImageUrl(caseStudy.hero_image_path!)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              )}

              <div style={{ padding: '1.5rem' }}>
                {/* Status Badge */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <span className={getStatusBadge(caseStudy.status)}>
                    {formatStatus(caseStudy.status)}
                  </span>
                  {caseStudy.featured && (
                    <span
                      className="badge"
                      style={{
                        marginLeft: '0.5rem',
                        backgroundColor: '#fbbf24',
                        color: '#78350f',
                      }}
                    >
                      Featured
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
                  {caseStudy.title}
                </h3>

                {/* Subtitle */}
                {caseStudy.subtitle && (
                  <p
                    style={{
                      margin: '0 0 1rem 0',
                      color: 'var(--secondary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {caseStudy.subtitle}
                  </p>
                )}

                {/* Customer & Project */}
                <div style={{ marginBottom: '1rem' }}>
                  {caseStudy.customer_name && (
                    <div
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--secondary)',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <strong>Customer:</strong> {caseStudy.customer_name}
                    </div>
                  )}
                  {caseStudy.project_name && (
                    <div
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--secondary)',
                      }}
                    >
                      <strong>Project:</strong> {caseStudy.project_name}
                    </div>
                  )}
                </div>

                {/* Project Metrics */}
                {(caseStudy.project_value ||
                  caseStudy.project_square_footage ||
                  caseStudy.project_start_date) && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                      gap: '0.75rem',
                      padding: '1rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      marginBottom: '1rem',
                    }}
                  >
                    {caseStudy.project_value && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: 'var(--success)',
                          }}
                        >
                          ${Math.round(Number(caseStudy.project_value)).toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--secondary)',
                          }}
                        >
                          Value
                        </div>
                      </div>
                    )}
                    {caseStudy.project_square_footage && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: 'var(--primary)',
                          }}
                        >
                          {Number(caseStudy.project_square_footage).toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--secondary)',
                          }}
                        >
                          SF
                        </div>
                      </div>
                    )}
                    {caseStudy.project_start_date && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: 'var(--warning)',
                          }}
                        >
                          {new Date(caseStudy.project_start_date).getFullYear()}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--secondary)',
                          }}
                        >
                          Year
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Market */}
                {caseStudy.market && (
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--secondary)',
                      marginBottom: caseStudy.images?.length ? '0.75rem' : 0,
                    }}
                  >
                    {caseStudy.market}
                  </div>
                )}

                {/* Image Thumbnails */}
                {caseStudy.images && caseStudy.images.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {caseStudy.images.slice(0, 5).map((img) => (
                      <div
                        key={img.id}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          backgroundColor: '#f3f4f6',
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={img.image_url || getImageUrl(img.file_path)}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    ))}
                    {caseStudy.images.length > 5 && (
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '6px',
                          backgroundColor: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--secondary)',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        +{caseStudy.images.length - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
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
            No case studies found
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/case-studies/create')}
          >
            Create Your First Case Study
          </button>
        </div>
      )}
    </div>
  );
};

export default CaseStudyList;
