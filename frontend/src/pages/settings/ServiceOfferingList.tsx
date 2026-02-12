import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceOfferingsApi, ServiceOffering } from '../../services/serviceOfferings';
import './ServiceOfferingList.css';

const ServiceOfferingList: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<ServiceOffering | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    pricing_model: '',
    typical_duration_days: '',
    icon_name: '',
    is_active: true,
  });

  // Fetch service offerings
  const { data: offerings = [], isLoading } = useQuery({
    queryKey: ['serviceOfferings', categoryFilter],
    queryFn: async () => {
      const filters = categoryFilter ? { category: categoryFilter } : {};
      const response = await serviceOfferingsApi.getAll(filters);
      return response.data;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Force refetch when component mounts
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['serviceOfferingCategories'],
    queryFn: async () => {
      const response = await serviceOfferingsApi.getCategories();
      return response.data;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Force refetch when component mounts
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<ServiceOffering>) => serviceOfferingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceOfferings'] });
      queryClient.invalidateQueries({ queryKey: ['serviceOfferingCategories'] });
      closeModal();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServiceOffering> }) =>
      serviceOfferingsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceOfferings'] });
      closeModal();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => serviceOfferingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceOfferings'] });
    },
  });

  const openModal = (offering?: ServiceOffering) => {
    if (offering) {
      setEditingOffering(offering);
      setFormData({
        name: offering.name,
        description: offering.description || '',
        category: offering.category || '',
        pricing_model: offering.pricing_model || '',
        typical_duration_days: offering.typical_duration_days?.toString() || '',
        icon_name: offering.icon_name || '',
        is_active: offering.is_active,
      });
    } else {
      setEditingOffering(null);
      setFormData({
        name: '',
        description: '',
        category: '',
        pricing_model: '',
        typical_duration_days: '',
        icon_name: '',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOffering(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      typical_duration_days: formData.typical_duration_days
        ? parseInt(formData.typical_duration_days)
        : undefined,
    };

    if (editingOffering) {
      updateMutation.mutate({ id: editingOffering.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const toggleActive = (offering: ServiceOffering) => {
    updateMutation.mutate({
      id: offering.id,
      data: { is_active: !offering.is_active },
    });
  };

  if (isLoading) {
    return <div className="loading">Loading service offerings...</div>;
  }

  return (
    <div className="service-offering-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Offerings</h1>
          <p className="page-subtitle">Manage your service catalog</p>
        </div>
        <button className="btn" onClick={() => openModal()}>
          + New Service
        </button>
      </div>

      {/* Filters */}
      <div className="filters">
        <select
          className="input"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Service Offerings Table */}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Description</th>
              <th>Pricing Model</th>
              <th>Duration (Days)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {offerings.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No service offerings found. Create one to get started.
                </td>
              </tr>
            ) : (
              offerings.map((offering) => (
                <tr key={offering.id}>
                  <td>
                    <strong>{offering.name}</strong>
                  </td>
                  <td>{offering.category || '—'}</td>
                  <td style={{ maxWidth: '300px' }}>
                    {offering.description
                      ? offering.description.length > 100
                        ? `${offering.description.substring(0, 100)}...`
                        : offering.description
                      : '—'}
                  </td>
                  <td>{offering.pricing_model || '—'}</td>
                  <td>{offering.typical_duration_days || '—'}</td>
                  <td>
                    <button
                      className={`status-badge ${offering.is_active ? 'active' : 'inactive'}`}
                      onClick={() => toggleActive(offering)}
                      title="Click to toggle"
                    >
                      {offering.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => openModal(offering)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(offering.id, offering.name)}
                        title="Delete"
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

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingOffering ? 'Edit Service' : 'New Service'}</h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  className="input"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., HVAC, Plumbing, Sheet Metal"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  <option value="HVAC" />
                  <option value="Plumbing" />
                  <option value="Sheet Metal" />
                  <option value="Controls" />
                  <option value="Mechanical" />
                </datalist>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Describe this service offering..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Pricing Model</label>
                  <select
                    className="input"
                    value={formData.pricing_model}
                    onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value })}
                  >
                    <option value="">Select...</option>
                    <option value="fixed">Fixed Price</option>
                    <option value="hourly">Hourly Rate</option>
                    <option value="per_unit">Per Unit</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Typical Duration (Days)</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.typical_duration_days}
                    onChange={(e) =>
                      setFormData({ ...formData, typical_duration_days: e.target.value })
                    }
                    min="1"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Icon Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.icon_name}
                  onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                  placeholder="Optional emoji or icon name"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btnSecondary" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingOffering ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOfferingList;
