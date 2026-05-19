import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { sellSheetTemplatesApi, SellSheetTemplate } from '../../services/sellSheetTemplates';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';

const SellSheetTemplateList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm } = useTitanFeedback();
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['sellSheetTemplates', categoryFilter],
    queryFn: async () => {
      const filters: any = {};
      if (categoryFilter) filters.category = categoryFilter;
      const response = await sellSheetTemplatesApi.getAll(filters);
      return response.data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['sellSheetTemplateCategories'],
    queryFn: async () => {
      const response = await sellSheetTemplatesApi.getCategories();
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sellSheetTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheetTemplates'] });
    },
  });

  const handleDelete = async (template: SellSheetTemplate) => {
    const ok = await confirm({ message: `Delete template "${template.name}"?`, danger: true });
    if (ok) {
      deleteMutation.mutate(template.id);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading templates...</div>;
  }

  return (
    <div className="container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing/templates" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Templates
            </Link>
            <h1>📰 Service Offering Templates</h1>
            <div className="sales-subtitle">{templates?.length || 0} templates · Service offering sell sheet layouts</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate('/sell-sheet-templates/create')}
          >
            + Create Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          {categoryFilter && (
            <button
              className="btn btn-secondary"
              onClick={() => setCategoryFilter('')}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Template Cards */}
      {templates && templates.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {templates.map((template: SellSheetTemplate) => {
            const visibleCount = template.layout_config?.sections?.filter(s => s.visible).length || 0;
            const totalCount = template.layout_config?.sections?.length || 0;
            const layoutLabel = template.layout_config?.layout_style === 'two_column' ? 'Two Column' : 'Full Width';

            return (
              <div
                key={template.id}
                className="card"
                style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => navigate(`/sell-sheet-templates/${template.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {/* Badges */}
                <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {template.is_default && (
                    <span className="badge badge-success">Default</span>
                  )}
                  {template.category && (
                    <span className="badge badge-info">{template.category}</span>
                  )}
                  <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                    {layoutLabel}
                  </span>
                  {!template.is_active && (
                    <span className="badge">Inactive</span>
                  )}
                </div>

                {/* Name */}
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
                  {template.name}
                </h3>

                {/* Description */}
                {template.description && (
                  <p style={{ margin: '0 0 1rem 0', color: 'var(--secondary)', fontSize: '0.875rem' }}>
                    {template.description}
                  </p>
                )}

                {/* Section count */}
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                }}>
                  <strong>{visibleCount}</strong> of {totalCount} sections visible
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {template.layout_config?.sections
                      ?.filter(s => s.visible)
                      .sort((a, b) => a.order - b.order)
                      .map(s => (
                        <span
                          key={s.key}
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            borderRadius: '10px',
                          }}
                        >
                          {s.label}
                        </span>
                      ))
                    }
                  </div>
                </div>

                {/* Display options */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--secondary)' }}>
                  <span>{template.show_logo ? 'Logo' : 'No Logo'}</span>
                  <span>{template.show_hero_image ? 'Hero' : 'No Hero'}</span>
                  <span>{template.show_images ? 'Images' : 'No Images'}</span>
                  <span>{template.show_footer ? 'Footer' : 'No Footer'}</span>
                </div>

                {/* Actions */}
                <div
                  style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.875rem' }}
                    onClick={() => navigate(`/sell-sheet-templates/${template.id}`)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem' }}
                    onClick={() => handleDelete(template)}
                    disabled={template.is_default}
                    title={template.is_default ? 'Cannot delete default template' : 'Delete template'}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--secondary)' }}>
          <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>No templates found</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/sell-sheet-templates/create')}
          >
            Create Your First Template
          </button>
        </div>
      )}
    </div>
  );
};

export default SellSheetTemplateList;
