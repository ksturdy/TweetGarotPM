import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './Modal.css';

interface TouchpointModalProps {
  customerId: number;
  customerName: string;
  onClose: () => void;
}

const TouchpointModal: React.FC<TouchpointModalProps> = ({ customerId, customerName, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    touchpoint_date: new Date().toISOString().split('T')[0],
    touchpoint_type: 'Phone Call',
    contact_person: '',
    notes: '',
  });

  const createTouchpoint = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/customers/${customerId}/touchpoints`, {
        ...data,
        created_by: user?.id,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-touchpoints', customerId.toString()] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTouchpoint.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log Touchpoint</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-subtitle">
          Recording interaction for <strong>{customerName}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="touchpoint_date">Date *</label>
                <input
                  type="date"
                  id="touchpoint_date"
                  name="touchpoint_date"
                  value={formData.touchpoint_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="touchpoint_type">Type *</label>
                <select
                  id="touchpoint_type"
                  name="touchpoint_type"
                  value={formData.touchpoint_type}
                  onChange={handleChange}
                  required
                >
                  <option value="Phone Call">Phone Call</option>
                  <option value="Email">Email</option>
                  <option value="In-Person Meeting">In-Person Meeting</option>
                  <option value="Site Visit">Site Visit</option>
                  <option value="Video Call">Video Call</option>
                  <option value="Text Message">Text Message</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_person">Contact Person</label>
              <input
                type="text"
                id="contact_person"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                placeholder="Who did you speak with?"
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes *</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="What was discussed? Any action items or follow-ups needed?"
                rows={6}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createTouchpoint.isPending}
            >
              {createTouchpoint.isPending ? 'Saving...' : 'Log Touchpoint'}
            </button>
          </div>

          {createTouchpoint.isError && (
            <div className="error-message">
              Failed to log touchpoint. Please try again.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default TouchpointModal;
