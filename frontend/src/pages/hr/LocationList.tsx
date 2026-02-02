import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { officeLocationsApi, OfficeLocation, OfficeLocationInput } from '../../services/officeLocations';
import '../../styles/SalesPipeline.css';

const LocationList: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<OfficeLocationInput>({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
  });

  const { data: locations, isLoading } = useQuery({
    queryKey: ['office-locations'],
    queryFn: () => officeLocationsApi.getAll().then((res) => res.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: OfficeLocationInput) => officeLocationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-locations'] });
      setIsAdding(false);
      setFormData({ name: '', address: '', city: '', state: '', zipCode: '', phone: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: OfficeLocationInput }) => officeLocationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-locations'] });
      setEditingId(null);
      setFormData({ name: '', address: '', city: '', state: '', zipCode: '', phone: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => officeLocationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-locations'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to delete location';
      alert(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (location: OfficeLocation) => {
    setEditingId(location.id);
    setFormData({
      name: location.name,
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      zipCode: location.zip_code || '',
      phone: location.phone || '',
    });
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', address: '', city: '', state: '', zipCode: '', phone: '' });
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/hr" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
              &larr; Back to HR Dashboard
            </Link>
            <h1>Office Locations</h1>
            <div className="sales-subtitle">Manage company office locations</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="sales-btn sales-btn-primary"
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              setFormData({ name: '', address: '', city: '', state: '', zipCode: '', phone: '' });
            }}
          >
            + Add Location
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Locations</div>
          <div className="sales-kpi-value">{locations?.length || 0}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">States Covered</div>
          <div className="sales-kpi-value">{new Set(locations?.map(l => l.state).filter(Boolean)).size || 0}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Total Employees</div>
          <div className="sales-kpi-value">{locations?.reduce((sum, l) => sum + (l.employee_count || 0), 0) || 0}</div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="sales-chart-card" style={{ marginBottom: '20px' }}>
          <div className="sales-chart-header">
            <div className="sales-chart-title">{editingId ? 'Edit Office Location' : 'New Office Location'}</div>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} required style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>City</label>
                <input type="text" value={formData.city} onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>State</label>
                <input type="text" value={formData.state} onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>ZIP Code</label>
                <input type="text" value={formData.zipCode} onChange={(e) => setFormData((prev) => ({ ...prev, zipCode: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="sales-btn sales-btn-secondary" onClick={handleCancel}>Cancel</button>
              <button type="submit" className="sales-btn sales-btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}</button>
            </div>
            {(createMutation.isError || updateMutation.isError) && (<div style={{ color: 'var(--accent-rose)', marginTop: '16px', fontSize: '14px' }}>Error saving location. Please try again.</div>)}
          </form>
        </div>
      )}

      {/* Table */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Locations</div>
        </div>
        {locations?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📍</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No locations found</div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Click "Add Location" to create one</p>
          </div>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>City</th>
                <th>State</th>
                <th>ZIP</th>
                <th>Phone</th>
                <th>Employees</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations?.map((location) => (
                <tr key={location.id}>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: 'var(--gradient-2)', fontSize: '14px', color: 'white' }}>
                        {location.name?.[0]}
                      </div>
                      <div className="sales-project-info">
                        <h4>{location.name}</h4>
                      </div>
                    </div>
                  </td>
                  <td>{location.address || '-'}</td>
                  <td>{location.city || '-'}</td>
                  <td>{location.state || '-'}</td>
                  <td>{location.zip_code || '-'}</td>
                  <td>{location.phone || '-'}</td>
                  <td>
                    <span className="sales-stage-badge quoted">{location.employee_count || 0}</span>
                  </td>
                  <td>
                    <div className="sales-actions-cell">
                      <button className="sales-action-btn" onClick={() => handleEdit(location)} title="Edit">✏️</button>
                      <button className="sales-action-btn" onClick={() => handleDelete(location.id, location.name)} disabled={deleteMutation.isPending} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LocationList;
