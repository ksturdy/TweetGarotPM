import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customersApi, Customer } from '../../services/customers';
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
    facility_customer_id: '',
    send_estimate_to: '',
  });

  const [linkToExistingOwner, setLinkToExistingOwner] = useState(!!customerId);
  const [linkToExistingGC, setLinkToExistingGC] = useState(false);
  const [linkToExistingFacility, setLinkToExistingFacility] = useState(false);

  // Fetch customers for linking
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll()
  });

  // Get unique companies from customers list
  const uniqueCompanies = useMemo(() => {
    const companyMap = new Map<string, Customer>();
    customers.forEach((customer: Customer) => {
      const companyName = customer.customer_owner || customer.customer_facility;
      if (companyName && !companyMap.has(companyName)) {
        companyMap.set(companyName, customer);
      }
    });
    return Array.from(companyMap.values());
  }, [customers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Get the customer name based on whether we're linking or using text input
    let effectiveCustomerId = customerId;
    let effectiveCustomerName = customerName;

    if (linkToExistingOwner && formData.customer_id) {
      effectiveCustomerId = Number(formData.customer_id);
      const selectedCustomer = customers.find((c: Customer) => c.id === effectiveCustomerId);
      effectiveCustomerName = selectedCustomer?.customer_owner || selectedCustomer?.customer_facility || '';
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
        customer_id: linkToExistingOwner ? formData.customer_id : null,
        general_contractor: formData.general_contractor,
        gc_customer_id: linkToExistingGC ? formData.gc_customer_id : null,
        facility_name: formData.facility_name,
        facility_customer_id: linkToExistingFacility ? formData.facility_customer_id : null,
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

            {/* Project Participants */}
            <div className="form-section" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <h4 style={{ marginBottom: '1rem', color: '#374151' }}>Project Participants</h4>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="owner">Company</label>
                  <input
                    type="text"
                    id="owner"
                    name="owner"
                    value={formData.owner}
                    onChange={handleChange}
                    placeholder="Company name"
                  />
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={linkToExistingOwner}
                        onChange={(e) => {
                          setLinkToExistingOwner(e.target.checked);
                          if (!e.target.checked) {
                            setFormData(prev => ({ ...prev, customer_id: '' }));
                          }
                        }}
                        style={{ width: '16px', height: '16px' }}
                      />
                      Link to Existing Company
                    </label>
                    {linkToExistingOwner && (
                      <select
                        id="customer_id"
                        name="customer_id"
                        value={formData.customer_id}
                        onChange={handleChange}
                        style={{ marginTop: '0.5rem', width: '100%' }}
                      >
                        <option value="">Select company...</option>
                        {uniqueCompanies.map((customer: Customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.customer_owner || customer.customer_facility}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="general_contractor">General Contractor</label>
                  <input
                    type="text"
                    id="general_contractor"
                    name="general_contractor"
                    value={formData.general_contractor}
                    onChange={handleChange}
                    placeholder="GC company name"
                  />
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={linkToExistingGC}
                        onChange={(e) => {
                          setLinkToExistingGC(e.target.checked);
                          if (!e.target.checked) {
                            setFormData(prev => ({ ...prev, gc_customer_id: '' }));
                          }
                        }}
                        style={{ width: '16px', height: '16px' }}
                      />
                      Link to Existing General Contractor
                    </label>
                    {linkToExistingGC && (
                      <select
                        id="gc_customer_id"
                        name="gc_customer_id"
                        value={formData.gc_customer_id}
                        onChange={handleChange}
                        style={{ marginTop: '0.5rem', width: '100%' }}
                      >
                        <option value="">Select customer...</option>
                        {customers.map((customer: Customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.customer_owner ? `${customer.customer_owner} - ${customer.customer_facility}` : customer.customer_facility}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="facility_name">Facility/Location Name</label>
                <input
                  type="text"
                  id="facility_name"
                  name="facility_name"
                  value={formData.facility_name}
                  onChange={handleChange}
                  placeholder="Facility or location name"
                />
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={linkToExistingFacility}
                      onChange={(e) => {
                        setLinkToExistingFacility(e.target.checked);
                        if (!e.target.checked) {
                          setFormData(prev => ({ ...prev, facility_customer_id: '' }));
                        }
                      }}
                      style={{ width: '16px', height: '16px' }}
                    />
                    Link to Existing Facility/Location
                  </label>
                  {linkToExistingFacility && (
                    <select
                      id="facility_customer_id"
                      name="facility_customer_id"
                      value={formData.facility_customer_id}
                      onChange={handleChange}
                      style={{ marginTop: '0.5rem', width: '100%' }}
                    >
                      <option value="">Select facility...</option>
                      {customers.map((customer: Customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.customer_owner ? `${customer.customer_owner} - ${customer.customer_facility}` : customer.customer_facility}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
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
                      {customer.customer_owner || customer.customer_facility}
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
