import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, Customer } from '../../services/customers';
import './Modal.css';

interface CustomerFormModalProps {
  customer?: Customer | null;
  onClose: () => void;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ customer, onClose }) => {
  const queryClient = useQueryClient();
  const isEditing = !!customer;

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

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customer_facility">Customer Facility *</label>
                  <input
                    type="text"
                    id="customer_facility"
                    name="customer_facility"
                    value={formData.customer_facility}
                    onChange={handleChange}
                    required
                    placeholder="Company facility name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="customer_owner">Customer Owner *</label>
                  <input
                    type="text"
                    id="customer_owner"
                    name="customer_owner"
                    value={formData.customer_owner}
                    onChange={handleChange}
                    required
                    placeholder="Owner name"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="account_manager">Account Manager</label>
                  <input
                    type="text"
                    id="account_manager"
                    name="account_manager"
                    value={formData.account_manager}
                    onChange={handleChange}
                    placeholder="Account manager name"
                  />
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

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : isEditing ? 'Update Customer' : 'Create Customer'}
            </button>
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
