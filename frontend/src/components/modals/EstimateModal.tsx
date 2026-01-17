import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Modal.css';

interface EstimateModalProps {
  customerId: number;
  customerName: string;
  onClose: () => void;
}

const EstimateModal: React.FC<EstimateModalProps> = ({ customerId, customerName, onClose }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    project_name: '',
    building_type: 'Commercial',
    square_footage: '',
    estimated_value: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Navigate to estimating page with pre-filled data
    navigate('/estimating/estimates', {
      state: {
        customerId,
        customerName,
        projectName: formData.project_name,
        buildingType: formData.building_type,
        squareFootage: formData.square_footage,
        estimatedValue: formData.estimated_value,
        notes: formData.notes,
      }
    });
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
          <h2>Create New Estimate</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-subtitle">
          Creating estimate for <strong>{customerName}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="project_name">Project Name *</label>
              <input
                type="text"
                id="project_name"
                name="project_name"
                value={formData.project_name}
                onChange={handleChange}
                placeholder="e.g., Main Building HVAC Retrofit"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="building_type">Building Type</label>
                <select
                  id="building_type"
                  name="building_type"
                  value={formData.building_type}
                  onChange={handleChange}
                >
                  <option value="Commercial">Commercial</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Education">Education</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="Retail">Retail</option>
                  <option value="Multi-Family">Multi-Family</option>
                  <option value="Government">Government</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="square_footage">Square Footage</label>
                <input
                  type="number"
                  id="square_footage"
                  name="square_footage"
                  value={formData.square_footage}
                  onChange={handleChange}
                  placeholder="50000"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="estimated_value">Estimated Value ($)</label>
              <input
                type="number"
                id="estimated_value"
                name="estimated_value"
                value={formData.estimated_value}
                onChange={handleChange}
                placeholder="500000"
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Project Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Special requirements, scope details, or other notes..."
                rows={4}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Continue to Estimating
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EstimateModal;
