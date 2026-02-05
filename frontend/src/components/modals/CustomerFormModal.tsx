import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, Customer } from '../../services/customers';
import { employeesApi } from '../../services/employees';
import { PlacesSearch } from '../PlacesSearch';
import { Place } from '../../services/places';
import './Modal.css';

const MARKET_OPTIONS = [
  { value: 'Healthcare', icon: '🏥', label: 'Healthcare' },
  { value: 'Education', icon: '🏫', label: 'Education' },
  { value: 'Commercial', icon: '🏢', label: 'Commercial' },
  { value: 'Industrial', icon: '🏭', label: 'Industrial' },
  { value: 'Retail', icon: '🏬', label: 'Retail' },
  { value: 'Government', icon: '🏛️', label: 'Government' },
  { value: 'Hospitality', icon: '🏨', label: 'Hospitality' },
  { value: 'Data Center', icon: '💾', label: 'Data Center' }
];

interface CustomerFormModalProps {
  customer?: Customer | null;
  onClose: () => void;
  onDelete?: () => void;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ customer, onClose, onDelete }) => {
  const queryClient = useQueryClient();
  const isEditing = !!customer;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch active employees for account manager dropdown
  const { data: employeesData } = useQuery({
    queryKey: ['employees', { employmentStatus: 'active' }],
    queryFn: () => employeesApi.getAll({ employmentStatus: 'active' }),
  });
  const employees = employeesData?.data?.data || [];

  // Check if current account_manager matches an employee
  const existingManagerMatchesEmployee = customer?.account_manager
    ? employees.some(emp => `${emp.first_name} ${emp.last_name}` === customer.account_manager)
    : true;

  const [formData, setFormData] = useState({
    customer_facility: customer?.customer_facility || '',
    customer_owner: customer?.customer_owner || '',
    account_manager: customer?.account_manager || '',
    field_leads: customer?.field_leads || '',
    customer_number: customer?.customer_number || '',
    address: customer?.address || '',
    city: customer?.city || '',
    state: customer?.state || '',
    zip_code: customer?.zip_code || '',
    controls: customer?.controls || '',
    department: customer?.department || '',
    market: customer?.market || '',
    customer_score: customer?.customer_score || '',
    active_customer: customer?.active_customer ?? true,
    notes: customer?.notes || '',
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Customer>) => {
      if (isEditing) {
        return customersApi.update(customer.id, data);
      } else {
        return customersApi.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customer?.id?.toString()] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'stats'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => customersApi.delete(customer!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'stats'] });
      onClose();
      onDelete?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Convert customer_score to number if it exists
    const submitData: Partial<Customer> = {
      ...formData,
      customer_score: formData.customer_score ? Number(formData.customer_score) : undefined,
    };

    mutation.mutate(submitData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle place selection from Foursquare search
  const handlePlaceSelect = (place: Place) => {
    setFormData(prev => ({
      ...prev,
      customer_facility: place.name,
      customer_owner: place.name,
      address: place.address,
      city: place.city,
      state: place.state,
      zip_code: place.zip_code,
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Customer' : 'New Customer'}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Basic Information */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                Basic Information
              </h3>

              {/* Places Search - only show for new customers */}
              {!isEditing && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Search Business</label>
                  <PlacesSearch
                    onSelect={handlePlaceSelect}
                    placeholder="Search: name + city (e.g., Banner Hospital Phoenix)"
                    near="USA"
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    Include business type and city for best results
                  </small>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customer_facility">Facility/Location Name *</label>
                  <input
                    type="text"
                    id="customer_facility"
                    name="customer_facility"
                    value={formData.customer_facility}
                    onChange={handleChange}
                    required
                    placeholder="Facility or location name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="customer_owner">Company *</label>
                  <input
                    type="text"
                    id="customer_owner"
                    name="customer_owner"
                    value={formData.customer_owner}
                    onChange={handleChange}
                    required
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="account_manager">Account Manager</label>
                  <select
                    id="account_manager"
                    name="account_manager"
                    value={formData.account_manager}
                    onChange={handleChange}
                  >
                    <option value="">Select an account manager...</option>
                    {/* Show existing value if it doesn't match any employee */}
                    {customer?.account_manager && !existingManagerMatchesEmployee && (
                      <option value={customer.account_manager}>
                        {customer.account_manager} (existing)
                      </option>
                    )}
                    {employees.map(emp => (
                      <option key={emp.id} value={`${emp.first_name} ${emp.last_name}`}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="field_leads">Field Leads</label>
                  <input
                    type="text"
                    id="field_leads"
                    name="field_leads"
                    value={formData.field_leads}
                    onChange={handleChange}
                    placeholder="Field lead names"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customer_number">Customer Number</label>
                  <input
                    type="text"
                    id="customer_number"
                    name="customer_number"
                    value={formData.customer_number}
                    onChange={handleChange}
                    placeholder="Customer ID/Number"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="department">Department</label>
                  <input
                    type="text"
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="Department"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="market">Market</label>
                  <select
                    id="market"
                    name="market"
                    value={formData.market}
                    onChange={handleChange}
                  >
                    <option value="">Select a market...</option>
                    {MARKET_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                Address Information
              </h3>

              <div className="form-group">
                <label htmlFor="address">Street Address</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="city">City</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="state">State</label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="State"
                    maxLength={2}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="zip_code">Zip Code</label>
                  <input
                    type="text"
                    id="zip_code"
                    name="zip_code"
                    value={formData.zip_code}
                    onChange={handleChange}
                    placeholder="Zip code"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                Additional Information
              </h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="controls">Controls</label>
                  <input
                    type="text"
                    id="controls"
                    name="controls"
                    value={formData.controls}
                    onChange={handleChange}
                    placeholder="Control systems"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="customer_score">Customer Score</label>
                  <input
                    type="number"
                    id="customer_score"
                    name="customer_score"
                    value={formData.customer_score}
                    onChange={handleChange}
                    placeholder="Score (1-100)"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
              </div>

              <div
                className="form-group"
                style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}
              >
                <input
                  type="checkbox"
                  id="active_customer"
                  name="active_customer"
                  checked={formData.active_customer}
                  onChange={handleChange}
                  style={{ width: 'auto', margin: 0 }}
                />
                <label htmlFor="active_customer" style={{ margin: 0, fontWeight: 'normal' }}>
                  Active Customer
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Additional notes about this customer..."
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEditing ? 'Update Customer' : 'Create Customer'}
              </button>
            </div>
          </div>

          {mutation.isError && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              Failed to {isEditing ? 'update' : 'create'} customer. Please try again.
            </div>
          )}

        </form>
      </div>
    </div>
  );
};

export default CustomerFormModal;
