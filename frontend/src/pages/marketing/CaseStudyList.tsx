import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { caseStudiesApi, CaseStudy } from '../../services/caseStudies';
import { MARKETS } from '../../constants/markets';
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
  const [sliderMin, setSliderMin] = useState<number>(0);
  const [sliderMax, setSliderMax] = useState<number>(0);

  const { data: caseStudies, isLoading, error } = useQuery({
    queryKey: ['caseStudies', statusFilter, marketFilter],
    queryFn: () => {
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      if (marketFilter) filters.market = marketFilter;
      return caseStudiesApi.getAll(filters).then(res => res.data);
    },
  });

  // Value range slider
  const { dataMin, dataMax, step } = useMemo(() => {
    if (!caseStudies || caseStudies.length === 0) return { dataMin: 0, dataMax: 0, step: 500000 };
    const values = caseStudies
      .map(cs => Number(cs.override_contract_value ?? cs.project_value ?? 0))
      .filter(v => v > 0);
    if (values.length === 0) return { dataMin: 0, dataMax: 0, step: 500000 };
    const max = Math.max(...values);
    const roundedMax = Math.ceil(max / 1000000) * 1000000 || 1000000;
    const s = roundedMax > 50000000 ? 1000000 : roundedMax > 10000000 ? 500000 : 100000;
    return { dataMin: 0, dataMax: roundedMax, step: s };
  }, [caseStudies]);

  useEffect(() => {
    if (dataMax > 0 && sliderMax === 0) {
      setSliderMax(dataMax);
    }
  }, [dataMax, sliderMax]);

  const valueFilterActive = dataMax > 0 && sliderMax > 0 && (sliderMin > dataMin || sliderMax < dataMax);

  const filteredCaseStudies = useMemo(() => {
    if (!caseStudies) return [];
    if (!valueFilterActive) return caseStudies;
    return caseStudies.filter(cs => {
      const val = Number(cs.override_contract_value ?? cs.project_value ?? 0);
      if (val === 0) return true;
      return val >= sliderMin && val <= sliderMax;
    });
  }, [caseStudies, sliderMin, sliderMax, valueFilterActive]);

  const formatSliderValue = (val: number) => {
    if (val === 0) return '$0';
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (val >= 1000) return '$' + Math.round(val / 1000) + 'K';
    return '$' + val.toLocaleString();
  };

  const minPercent = dataMax > 0 ? (sliderMin / dataMax) * 100 : 0;
  const maxPercent = dataMax > 0 ? (sliderMax / dataMax) * 100 : 100;

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
            <div className="sales-subtitle">{filteredCaseStudies.length} case studies</div>
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
              {MARKETS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {(statusFilter || marketFilter || valueFilterActive) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStatusFilter('');
                  setMarketFilter('');
                  setSliderMin(dataMin);
                  setSliderMax(dataMax);
                }}
                style={{ width: '100%' }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Value Range Slider */}
        {dataMax > 0 && sliderMax > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <style>{`
              .value-range-slider input[type="range"] {
                -webkit-appearance: none;
                appearance: none;
                pointer-events: none;
                background: transparent;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
              }
              .value-range-slider input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--primary, #3b82f6);
                border: 2px solid white;
                box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                cursor: pointer;
                pointer-events: all;
              }
              .value-range-slider input[type="range"]::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--primary, #3b82f6);
                border: 2px solid white;
                box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                cursor: pointer;
                pointer-events: all;
              }
            `}</style>
            <label className="form-label" style={{ marginBottom: '0.5rem' }}>
              Contract Value: {formatSliderValue(sliderMin)} — {formatSliderValue(sliderMax)}
            </label>
            <div
              className="value-range-slider"
              style={{ position: 'relative', height: '36px' }}
            >
              {/* Track background */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '6px',
                transform: 'translateY(-50%)',
                backgroundColor: '#e2e8f0',
                borderRadius: '3px',
              }} />
              {/* Active range highlight */}
              <div style={{
                position: 'absolute',
                top: '50%',
                height: '6px',
                transform: 'translateY(-50%)',
                backgroundColor: 'var(--primary, #3b82f6)',
                borderRadius: '3px',
                left: `${minPercent}%`,
                width: `${maxPercent - minPercent}%`,
              }} />
              <input
                type="range"
                min={dataMin}
                max={dataMax}
                step={step}
                value={sliderMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val <= sliderMax - step) setSliderMin(val);
                }}
                style={{ zIndex: sliderMin > dataMax * 0.5 ? 5 : 3 }}
              />
              <input
                type="range"
                min={dataMin}
                max={dataMax}
                step={step}
                value={sliderMax}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= sliderMin + step) setSliderMax(val);
                }}
                style={{ zIndex: 4 }}
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--secondary)',
              marginTop: '-4px',
            }}>
              <span>{formatSliderValue(dataMin)}</span>
              <span>{formatSliderValue(dataMax)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Case Studies Grid */}
      {filteredCaseStudies.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {filteredCaseStudies.map((caseStudy: CaseStudy) => (
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
                {(() => {
                  const effectiveValue = caseStudy.override_contract_value ?? caseStudy.project_value;
                  const effectiveSqft = caseStudy.override_square_footage ?? caseStudy.project_square_footage;
                  const effectiveStart = caseStudy.override_start_date || caseStudy.project_start_date;
                  const metricCount = [effectiveValue, effectiveSqft, effectiveStart].filter(Boolean).length;
                  if (metricCount === 0) return null;
                  return (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${metricCount}, 1fr)`,
                      gap: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      marginBottom: '1rem',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {effectiveValue && (
                      <div style={{ textAlign: 'center', padding: '0.25rem 0' }}>
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--success)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ${Number(effectiveValue) >= 1000000
                            ? (Number(effectiveValue) / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
                            : Math.round(Number(effectiveValue)).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--secondary)', marginTop: '2px' }}>
                          Value
                        </div>
                      </div>
                    )}
                    {effectiveSqft && (
                      <div style={{ textAlign: 'center', padding: '0.25rem 0', borderLeft: effectiveValue ? '1px solid #e2e8f0' : 'none' }}>
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {Number(effectiveSqft) >= 1000
                            ? Math.round(Number(effectiveSqft) / 1000).toLocaleString() + 'K'
                            : Number(effectiveSqft).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--secondary)', marginTop: '2px' }}>
                          Sq Ft
                        </div>
                      </div>
                    )}
                    {effectiveStart && (
                      <div style={{ textAlign: 'center', padding: '0.25rem 0', borderLeft: (effectiveValue || effectiveSqft) ? '1px solid #e2e8f0' : 'none' }}>
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--warning)',
                          }}
                        >
                          {new Date(effectiveStart + 'T00:00:00').getFullYear()}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--secondary)', marginTop: '2px' }}>
                          Year
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })()}

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
