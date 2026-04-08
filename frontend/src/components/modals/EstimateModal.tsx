import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, Customer } from '../../services/customers';
import CompanyPicker from '../CompanyPicker';
import LocationPicker from '../LocationPicker';
import { MARKETS } from '../../constants/markets';
import './Modal.css';

interface EstimateModalProps {
  customerId?: number;
  customerName?: string;
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
    owner: '',
    customer_id: customerId?.toString() || '',
    general_contractor: '',
    gc_customer_id: '',
    facility_name: '',
    facility_location_id: '',
    send_estimate_to: '',
  });


  const queryClient = useQueryClient();

  // Clear facility/location when company changes
  const prevCustomerId = useRef(formData.customer_id);
  useEffect(() => {
    if (prevCustomerId.current !== formData.customer_id) {
      prevCustomerId.current = formData.customer_id;
      setFormData(prev => ({ ...prev, facility_location_id: '', facility_name: '' }));
    }
  }, [formData.customer_id]);

  // Fetch customers for linking
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll()
  });

  // Get unique companies from customers list
  const uniqueCompanies = useMemo(() => {
    const companyMap = new Map<string, Customer>();
    customers.forEach((customer: Customer) => {
      const companyName = customer.name;
      if (companyName && !companyMap.has(companyName)) {
        companyMap.set(companyName, customer);
      }
    });
    return Array.from(companyMap.values());
  }, [customers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Get the customer name based on whether a company is linked or manually entered
    let effectiveCustomerId = customerId;
    let effectiveCustomerName = customerName;

    if (formData.customer_id) {
      effectiveCustomerId = Number(formData.customer_id);
      const selectedCustomer = customers.find((c: Customer) => c.id === effectiveCustomerId);
      effectiveCustomerName = selectedCustomer?.name || formData.owner;
    } else if (formData.owner) {
      effectiveCustomerName = formData.owner;
      effectiveCustomerId = undefined;
    }

    // Navigate to estimating page with pre-filled data
    navigate('/estimating', {
      state: {
        customerId: effectiveCustomerId,
        customerName: effectiveCustomerName,
        projectName: formData.project_name,
        buildingType: formData.building_type,
        squareFootage: formData.square_footage,
        estimatedValue: formData.estimated_value,
        notes: formData.notes,
        owner: formData.owner,
        customer_id: formData.customer_id || null,
        general_contractor: formData.general_contractor,
        gc_customer_id: formData.gc_customer_id || null,
        facility_name: formData.facility_name,
        facility_location_id: formData.facility_location_id || null,
        send_estimate_to: formData.send_estimate_to,
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
                  {MARKETS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
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

            {/* Project Participants */}
            <div className="form-section" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <h4 style={{ marginBottom: '1rem', color: '#374151' }}>Project Participants</h4>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="owner">Company</label>
                  <CompanyPicker
                    companies={uniqueCompanies.map((c: Customer) => ({ id: c.id, name: c.name, customer_type: c.customer_type }))}
                    selectedId={formData.customer_id}
                    textValue={formData.owner}
                    onSelectCompany={(id, name) => setFormData(prev => ({ ...prev, customer_id: id, owner: name }))}
                    onManualEntry={(name) => setFormData(prev => ({ ...prev, customer_id: '', owner: name }))}
                    onClear={() => setFormData(prev => ({ ...prev, customer_id: '', owner: '' }))}
                    placeholder="Search companies..."
                    onProspectCreated={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="general_contractor">General Contractor</label>
                  <CompanyPicker
                    companies={uniqueCompanies.map((c: Customer) => ({ id: c.id, name: c.name, customer_type: c.customer_type }))}
                    selectedId={formData.gc_customer_id}
                    textValue={formData.general_contractor}
                    onSelectCompany={(id, name) => setFormData(prev => ({ ...prev, gc_customer_id: id, general_contractor: name }))}
                    onManualEntry={(name) => setFormData(prev => ({ ...prev, gc_customer_id: '', general_contractor: name }))}
                    onClear={() => setFormData(prev => ({ ...prev, gc_customer_id: '', general_contractor: '' }))}
                    placeholder="Search companies..."
                    onProspectCreated={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="facility_name">Facility/Location</label>
                <LocationPicker
                  customerId={formData.customer_id || null}
                  selectedLocationId={formData.facility_location_id}
                  textValue={formData.facility_name}
                  onSelectLocation={(id, name) => setFormData(prev => ({ ...prev, facility_location_id: id, facility_name: name }))}
                  onManualEntry={(name) => setFormData(prev => ({ ...prev, facility_location_id: '', facility_name: name }))}
                  onClear={() => setFormData(prev => ({ ...prev, facility_location_id: '', facility_name: '' }))}
                />
              </div>
            </div>

            {/* Send Estimate To */}
            <div className="form-section" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <div className="form-group">
                <label htmlFor="send_estimate_to">Send Estimate To:</label>
                <select
                  id="send_estimate_to"
                  name="send_estimate_to"
                  value={formData.send_estimate_to}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                >
                  <option value="">Select company...</option>
                  {uniqueCompanies.map((customer: Customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
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
