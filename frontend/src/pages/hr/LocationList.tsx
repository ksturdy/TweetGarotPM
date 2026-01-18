import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { officeLocationsApi, OfficeLocation, OfficeLocationInput } from '../../services/officeLocations';

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
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/hr">&larr; Back to HR Dashboard</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Office Locations</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setFormData({ name: '', address: '', city: '', state: '', zipCode: '', phone: '' });
          }}
        >
          Add Location
        </button>
      </div>

      {(isAdding || editingId) && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Office Location' : 'New Office Location'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                className="form-input"
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">State</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.state}
                  onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">ZIP Code</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.zipCode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, zipCode: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                Error saving location. Please try again.
              </div>
            )}
          </form>
        </div>
      )}

      <div className="card">
        <table className="table">
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
                <td style={{ fontWeight: 500 }}>{location.name}</td>
                <td>{location.address || '-'}</td>
                <td>{location.city || '-'}</td>
                <td>{location.state || '-'}</td>
                <td>{location.zip_code || '-'}</td>
                <td>{location.phone || '-'}</td>
                <td>{location.employee_count || 0}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleEdit(location)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(location.id, location.name)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {locations?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No locations found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LocationList;
