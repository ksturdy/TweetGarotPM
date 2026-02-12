import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { caseStudiesApi, CaseStudy } from '../../services/caseStudies';

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
      under_review: 'badge badge-warning',
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
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Case Studies</h1>
          <p style={{ color: 'var(--secondary)', marginTop: '0.5rem' }}>
            {caseStudies?.length || 0} case studies
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/case-studies/create')}
        >
          + Create Case Study
        </button>
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
              <option value="under_review">Under Review</option>
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
              {caseStudy.hero_image_path && (
                <div
                  style={{
                    width: '100%',
                    height: '200px',
                    backgroundColor: '#f3f4f6',
                    backgroundImage: `url(/uploads/${caseStudy.hero_image_path})`,
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

                {/* Metrics */}
                {(caseStudy.cost_savings ||
                  caseStudy.timeline_improvement_days ||
                  caseStudy.quality_score) && (
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
                    {caseStudy.cost_savings && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: 'var(--success)',
                          }}
                        >
                          ${(caseStudy.cost_savings / 1000).toFixed(0)}K
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--secondary)',
                          }}
                        >
                          Savings
                        </div>
                      </div>
                    )}
                    {caseStudy.timeline_improvement_days && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: 'var(--primary)',
                          }}
                        >
                          {caseStudy.timeline_improvement_days}d
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--secondary)',
                          }}
                        >
                          Faster
                        </div>
                      </div>
                    )}
                    {caseStudy.quality_score && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: 'var(--warning)',
                          }}
                        >
                          {caseStudy.quality_score}%
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--secondary)',
                          }}
                        >
                          Quality
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Market & Images count */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.875rem',
                    color: 'var(--secondary)',
                  }}
                >
                  {caseStudy.market && <span>{caseStudy.market}</span>}
                  {caseStudy.image_count !== undefined && (
                    <span>{caseStudy.image_count} images</span>
                  )}
                </div>
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
