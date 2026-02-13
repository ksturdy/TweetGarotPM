import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { proposalTemplatesApi, ProposalTemplate } from '../../services/proposalTemplates';
import './ProposalTemplateList.css';
import '../../styles/SalesPipeline.css';

const ProposalTemplateList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Fetch proposal templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['proposalTemplates', categoryFilter, activeFilter],
    queryFn: async () => {
      const filters: any = {};
      if (categoryFilter !== 'all') {
        filters.category = categoryFilter;
      }
      if (activeFilter !== 'all') {
        filters.is_active = activeFilter === 'active';
      }
      const response = await proposalTemplatesApi.getAll(filters);
      return response.data;
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['proposalTemplateCategories'],
    queryFn: async () => {
      const response = await proposalTemplatesApi.getCategories();
      return response.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => proposalTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalTemplates'] });
    },
  });

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete the template "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading proposal templates...</div>;
  }

  return (
    <div className="proposal-template-list">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>📄 Proposal Templates</h1>
            <div className="sales-subtitle">Manage reusable proposal templates with variable placeholders</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn" onClick={() => navigate('/proposal-templates/create')}>
            + New Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <select
          className="input"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((category: string) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Template Table */}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Template Name</th>
              <th>Category</th>
              <th>Description</th>
              <th>Sections</th>
              <th>Default</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No proposal templates found. Create one to get started.
                </td>
              </tr>
            ) : (
              templates.map((template: ProposalTemplate) => (
                <tr key={template.id}>
                  <td>
                    <strong>{template.name}</strong>
                  </td>
                  <td>{template.category || '—'}</td>
                  <td>{template.description || '—'}</td>
                  <td>{template.section_count || 0} sections</td>
                  <td>
                    {template.is_default && (
                      <span className="default-badge">Default</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${template.is_active ? 'active' : 'inactive'}`}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => navigate(`/proposal-templates/${template.id}`)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(template.id, template.name)}
                        title="Delete"
                        disabled={template.is_default}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProposalTemplateList;
