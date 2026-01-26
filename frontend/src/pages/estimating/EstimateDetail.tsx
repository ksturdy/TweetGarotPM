import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { estimatesApi, Estimate, EstimateSection, EstimateLineItem } from '../../services/estimates';
import { customersApi } from '../../services/customers';
import EstimateProposalPreviewModal from '../../components/estimates/EstimateProposalPreviewModal';
import BidFormUpload from '../../components/estimates/BidFormUpload';
import './EstimateNew.css';

const EstimateDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: estimate, isLoading, error } = useQuery({
    queryKey: ['estimate', id],
    queryFn: () => estimatesApi.getById(Number(id)).then((res) => res.data),
    enabled: !!id,
  });

  // Fetch customers for dropdown
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  const [formData, setFormData] = useState<Estimate>({
    estimate_number: '',
    project_name: '',
    customer_id: null,
    customer_name: '',
    building_type: 'Commercial',
    square_footage: undefined,
    location: '',
    bid_date: '',
    project_start_date: '',
    project_duration: undefined,
    status: 'in progress',
    overhead_percentage: 10,
    profit_percentage: 10,
    contingency_percentage: 5,
    bond_percentage: 0,
    scope_of_work: '',
    exclusions: '',
    assumptions: '',
    notes: '',
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [sections, setSections] = useState<EstimateSection[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showBidFormSection, setShowBidFormSection] = useState(false);

  useEffect(() => {
    if (estimate) {
      setFormData({
        estimate_number: estimate.estimate_number || '',
        project_name: estimate.project_name || '',
        customer_id: estimate.customer_id || null,
        customer_name: estimate.customer_name || '',
        building_type: estimate.building_type || 'Commercial',
        square_footage: estimate.square_footage || undefined,
        location: estimate.location || '',
        bid_date: estimate.bid_date ? estimate.bid_date.split('T')[0] : '',
        project_start_date: estimate.project_start_date ? estimate.project_start_date.split('T')[0] : '',
        project_duration: estimate.project_duration || undefined,
        status: estimate.status || 'in progress',
        overhead_percentage: estimate.overhead_percentage || 10,
        profit_percentage: estimate.profit_percentage || 10,
        contingency_percentage: estimate.contingency_percentage || 5,
        bond_percentage: estimate.bond_percentage || 0,
        scope_of_work: estimate.scope_of_work || '',
        exclusions: estimate.exclusions || '',
        assumptions: estimate.assumptions || '',
        notes: estimate.notes || '',
      });

      if (estimate.customer_name) {
        setCustomerSearch(estimate.customer_name);
      }

      if (estimate.sections) {
        // Round all monetary values when loading from database
        const roundedSections = estimate.sections.map((section: EstimateSection) => ({
          ...section,
          items: section.items?.map((item: EstimateLineItem) => ({
            ...item,
            quantity: Math.round(item.quantity || 0),
            labor_hours: Math.round(item.labor_hours || 0),
            labor_rate: Math.round(item.labor_rate || 0),
            material_unit_cost: Math.round(item.material_unit_cost || 0),
            equipment_unit_cost: Math.round(item.equipment_unit_cost || 0),
            subcontractor_cost: Math.round(item.subcontractor_cost || 0),
            total_cost: Math.round(item.total_cost || 0),
          })) || []
        }));
        setSections(roundedSections);
      }
    }
  }, [estimate]);

  const updateMutation = useMutation({
    mutationFn: (data: Estimate) => estimatesApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      alert('Estimate updated successfully!');
    },
    onError: (error: any) => {
      console.error('Failed to update estimate:', error);
      alert(`Failed to update estimate: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => estimatesApi.updateStatus(Number(id), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
    onError: (error: any) => {
      console.error('Failed to update status:', error);
      alert(`Failed to update status: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCustomerSelect = (customer: any) => {
    setFormData((prev) => ({
      ...prev,
      customer_id: customer.id,
      customer_name: customer.customer_facility,
    }));
    setCustomerSearch(`${customer.customer_facility} (${customer.customer_owner})`);
    setShowCustomerDropdown(false);
  };

  const filteredCustomers = customers?.filter((c: any) =>
    customerSearch
      ? c.customer_facility?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.customer_owner?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.city?.toLowerCase().includes(customerSearch.toLowerCase())
      : true
  ).slice(0, 10);

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        section_name: 'New Section',
        section_order: prev.length,
        description: '',
        items: [],
      },
    ]);
  };

  const updateSection = (sectionIndex: number, field: keyof EstimateSection, value: any) => {
    setSections((prev) =>
      prev.map((section, i) => (i === sectionIndex ? { ...section, [field]: value } : section))
    );
  };

  const deleteSection = (sectionIndex: number) => {
    if (window.confirm('Are you sure you want to remove this section?')) {
      setSections((prev) => prev.filter((_, i) => i !== sectionIndex));
    }
  };

  const addLineItem = (sectionIndex: number, itemType: string = 'labor') => {
    setSections((prev) =>
      prev.map((section, i) => {
        if (i === sectionIndex) {
          const newItem: EstimateLineItem = {
            item_order: (section.items?.length || 0) + 1,
            item_type: itemType,
            description: '',
            quantity: 1,
            unit: '',
            labor_hours: 0,
            labor_rate: 0,
            labor_cost: 0,
            labor_burden_percentage: 35,
            labor_burden_amount: 0,
            material_unit_cost: 0,
            material_cost: 0,
            material_waste_percentage: 10,
            material_waste_amount: 0,
            equipment_unit_cost: 0,
            equipment_cost: 0,
            subcontractor_cost: 0,
            rental_duration: 0,
            rental_rate: 0,
            rental_cost: 0,
            total_cost: 0,
          };
          return { ...section, items: [...(section.items || []), newItem] };
        }
        return section;
      })
    );
  };

  const updateLineItem = (sectionIndex: number, itemIndex: number, field: string, value: any) => {
    setSections((prev) =>
      prev.map((section, i) => {
        if (i === sectionIndex) {
          const newItems = [...(section.items || [])];
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            [field]: value,
          };

          // Recalculate costs
          const item = newItems[itemIndex];
          const quantity = Number(item.quantity) || 0;
          const laborHours = Number(item.labor_hours) || 0;
          const laborRate = Number(item.labor_rate) || 0;
          const laborBurdenPct = Number(item.labor_burden_percentage) || 35;
          const materialUnitCost = Number(item.material_unit_cost) || 0;
          const materialWastePct = Number(item.material_waste_percentage) || 10;
          const equipmentUnitCost = Number(item.equipment_unit_cost) || 0;
          const subcontractorCost = Number(item.subcontractor_cost) || 0;
          const rentalDuration = Number(item.rental_duration) || 0;
          const rentalRate = Number(item.rental_rate) || 0;

          const laborCost = laborHours * laborRate;
          const laborBurdenAmount = laborCost * (laborBurdenPct / 100);
          const materialCost = materialUnitCost * quantity;
          const materialWasteAmount = materialCost * (materialWastePct / 100);
          const equipmentCost = equipmentUnitCost * quantity;
          const rentalCost = rentalDuration * rentalRate;

          newItems[itemIndex] = {
            ...newItems[itemIndex],
            labor_cost: laborCost,
            labor_burden_amount: laborBurdenAmount,
            material_cost: materialCost,
            material_waste_amount: materialWasteAmount,
            equipment_cost: equipmentCost,
            rental_cost: rentalCost,
            total_cost: Math.round(
              laborCost +
              laborBurdenAmount +
              materialCost +
              materialWasteAmount +
              equipmentCost +
              subcontractorCost +
              rentalCost
            ),
          };

          return { ...section, items: newItems };
        }
        return section;
      })
    );
  };

  const deleteLineItem = (sectionIndex: number, itemIndex: number) => {
    setSections((prev) =>
      prev.map((section, i) => {
        if (i === sectionIndex) {
          const newItems = section.items?.filter((_, idx) => idx !== itemIndex) || [];
          return { ...section, items: newItems };
        }
        return section;
      })
    );
  };

  // Calculate totals
  const calculateTotals = () => {
    let labor = 0;
    let material = 0;
    let equipment = 0;
    let subcontractor = 0;
    let rental = 0;

    sections.forEach((section) => {
      section.items?.forEach((item) => {
        labor += Number(item.labor_cost || 0) + Number(item.labor_burden_amount || 0);
        material += Number(item.material_cost || 0) + Number(item.material_waste_amount || 0);
        equipment += Number(item.equipment_cost || 0);
        subcontractor += Number(item.subcontractor_cost || 0);
        rental += Number(item.rental_cost || 0);
      });
    });

    const subtotal = labor + material + equipment + subcontractor + rental;
    const overhead = subtotal * ((formData.overhead_percentage || 0) / 100);
    const profit = (subtotal + overhead) * ((formData.profit_percentage || 0) / 100);
    const contingency = (subtotal + overhead + profit) * ((formData.contingency_percentage || 0) / 100);
    const bond = (subtotal + overhead + profit + contingency) * ((formData.bond_percentage || 0) / 100);
    const total = subtotal + overhead + profit + contingency + bond;

    return { labor, material, equipment, subcontractor, rental, subtotal, overhead, profit, contingency, bond, total };
  };

  const totals = calculateTotals();

  const handleSaveChanges = () => {
    const estimateData = {
      ...formData,
      bid_date: formData.bid_date || undefined,
      project_start_date: formData.project_start_date || undefined,
      status: formData.status || 'in progress',
      sections: sections.map((section) => ({
        ...section,
        items: section.items || [],
      })),
    };
    updateMutation.mutate(estimateData as Estimate);
  };

  const handleStatusChange = (newStatus: string) => {
    if (window.confirm(`Are you sure you want to change status to "${newStatus}"?`)) {
      updateStatusMutation.mutate(newStatus);
    }
  };

  const handleSubmit = (e: React.FormEvent, status: string) => {
    e.preventDefault();
    // This function is kept for form compatibility but not used
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      'in progress': 'badge-info',
      'submitted': 'badge-warning',
      'awarded': 'badge-success',
      'lost': 'badge-danger',
      'cancelled': 'badge-secondary',
    };
    return `badge ${classes[status.toLowerCase()] || 'badge-info'}`;
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Loading estimate...</p>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--danger)' }}>Error loading estimate</p>
        <Link to="/estimating/estimates" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          &larr; Back to Estimates
        </Link>
      </div>
    );
  }

  return (
    <div className="estimate-new">
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link to="/estimating/estimates">&larr; All Estimates</Link>
        {estimate.customer_id && (
          <>
            <span style={{ color: '#6b7280' }}>|</span>
            <Link to={`/customers/${estimate.customer_id}/estimates`}>
              &larr; {estimate.customer_name} Estimates
            </Link>
            <span style={{ color: '#6b7280' }}>|</span>
            <Link to={`/customers/${estimate.customer_id}`}>
              &larr; {estimate.customer_name} Details
            </Link>
          </>
        )}
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Edit Estimate: {estimate.estimate_number}
          </h1>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className={getStatusBadge(estimate.status || 'in progress')} style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>
              {estimate.status}
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)' }}>
              ${Math.round(totals.total || 0).toLocaleString('en-US')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => setIsPreviewOpen(true)}
          >
            View Proposal
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500 }}>Change Status:</label>
            <select
              value={estimate.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.875rem', padding: '0.5rem' }}
              disabled={updateStatusMutation.isPending}
            >
              <option value="in progress">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="awarded">Awarded</option>
              <option value="lost">Lost</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'draft')}>
        {/* Estimate Header */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Estimate Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Estimate Number</label>
              <input
                type="text"
                name="estimate_number"
                className="form-input"
                value={formData.estimate_number}
                disabled
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                name="project_name"
                className="form-input"
                value={formData.project_name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Customer</label>
              <input
                type="text"
                className="form-input"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder="Search by facility, owner, or city..."
              />
              {showCustomerDropdown && filteredCustomers && filteredCustomers.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '0.375rem',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    marginTop: '0.25rem',
                  }}
                >
                  {filteredCustomers.map((customer: any) => (
                    <div
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer)}
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--background)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{customer.customer_facility}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                        {customer.customer_owner}
                        {customer.city && ` • ${customer.city}, ${customer.state}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showCustomerDropdown && (
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999,
                  }}
                  onClick={() => setShowCustomerDropdown(false)}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Building Type</label>
              <select name="building_type" className="form-input" value={formData.building_type} onChange={handleChange}>
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
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                type="text"
                name="location"
                className="form-input"
                value={formData.location}
                onChange={handleChange}
                placeholder="City, State"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Square Footage</label>
              <input
                type="number"
                name="square_footage"
                className="form-input"
                value={formData.square_footage || ''}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Bid Date</label>
              <input
                type="date"
                name="bid_date"
                className="form-input"
                value={formData.bid_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project Start Date</label>
              <input
                type="date"
                name="project_start_date"
                className="form-input"
                value={formData.project_start_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Duration (days)</label>
              <input
                type="number"
                name="project_duration"
                className="form-input"
                value={formData.project_duration || ''}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Excel Bid Form Section */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setShowBidFormSection(!showBidFormSection)}
          >
            <div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📊</span> Excel Bid Form
                {estimate.bid_form_filename && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      backgroundColor: 'var(--success)',
                      color: 'white',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontWeight: 'normal',
                    }}
                  >
                    Attached
                  </span>
                )}
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--secondary)' }}>
                {estimate.bid_form_filename
                  ? `Using: ${estimate.bid_form_filename}`
                  : 'Upload an Excel bid form to auto-populate estimate data'}
              </p>
            </div>
            <span style={{ fontSize: '1.25rem', color: 'var(--secondary)' }}>
              {showBidFormSection ? '▼' : '▶'}
            </span>
          </div>

          {showBidFormSection && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <BidFormUpload
                estimateId={Number(id)}
                onUploadComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ['estimate', id] });
                }}
              />
            </div>
          )}
        </div>

        {/* Estimate Sections and Line Items */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Estimate Breakdown</h2>
            <button type="button" className="btn btn-secondary" onClick={addSection}>
              + Add Section
            </button>
          </div>

          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="estimate-section" style={{ marginBottom: '2rem' }}>
              <div className="section-header-row">
                <input
                  type="text"
                  className="form-input section-name-input"
                  value={section.section_name}
                  onChange={(e) => updateSection(sectionIndex, 'section_name', e.target.value)}
                  placeholder="Section Name"
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteSection(sectionIndex)}
                >
                  Delete Section
                </button>
              </div>

              <textarea
                className="form-input"
                value={section.description || ''}
                onChange={(e) => updateSection(sectionIndex, 'description', e.target.value)}
                placeholder="Section description (optional)"
                rows={2}
                style={{ marginBottom: '1rem' }}
              />

              {/* Line Items Table */}
              <div className="line-items-table">
                <table className="table" style={{ fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '220px' }}>Description</th>
                      <th style={{ width: '130px' }}>Type</th>
                      <th style={{ width: '90px' }}>Qty</th>
                      <th style={{ width: '70px' }}>Unit</th>
                      <th style={{ width: '100px' }}>Labor Hrs</th>
                      <th style={{ width: '100px' }}>Labor Rate</th>
                      <th style={{ width: '90px' }}>Material $/Unit</th>
                      <th style={{ width: '90px' }}>Equipment $</th>
                      <th style={{ width: '100px' }}>Subcontractor $</th>
                      <th style={{ width: '100px' }}>Total</th>
                      <th style={{ width: '60px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items?.map((item, itemIndex) => (
                      <tr key={itemIndex}>
                        <td>
                          <input
                            type="text"
                            className="form-input-sm"
                            value={item.description}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'description', e.target.value)}
                            placeholder="Item description"
                          />
                        </td>
                        <td>
                          <select
                            className="form-input-sm"
                            value={item.item_type}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'item_type', e.target.value)}
                          >
                            <option value="labor">Labor</option>
                            <option value="material">Material</option>
                            <option value="equipment">Equipment</option>
                            <option value="subcontractor">Sub</option>
                            <option value="rental">Rental</option>
                            <option value="other">Other</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input-sm"
                            value={Math.round(item.quantity).toLocaleString('en-US')}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'quantity', parseInt(e.target.value.replace(/,/g, '')) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input-sm"
                            value={item.unit || ''}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'unit', e.target.value)}
                            placeholder="EA"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input-sm"
                            value={item.labor_hours.toLocaleString('en-US')}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'labor_hours', parseInt(e.target.value.replace(/,/g, '')) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input-sm"
                            value={Math.round(item.labor_rate).toLocaleString('en-US')}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'labor_rate', parseInt(e.target.value.replace(/,/g, '')) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input-sm"
                            value={Math.round(item.material_unit_cost).toLocaleString('en-US')}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'material_unit_cost', parseInt(e.target.value.replace(/,/g, '')) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input-sm"
                            value={Math.round(item.equipment_unit_cost).toLocaleString('en-US')}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'equipment_unit_cost', parseInt(e.target.value.replace(/,/g, '')) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input-sm"
                            value={Math.round(item.subcontractor_cost).toLocaleString('en-US')}
                            onChange={(e) => updateLineItem(sectionIndex, itemIndex, 'subcontractor_cost', parseInt(e.target.value.replace(/,/g, '')) || 0)}
                          />
                        </td>
                        <td>
                          <strong>${item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-icon-danger"
                            onClick={() => deleteLineItem(sectionIndex, itemIndex)}
                            title="Delete item"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Line Item Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => addLineItem(sectionIndex, 'labor')}
                >
                  + Labor
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => addLineItem(sectionIndex, 'material')}
                >
                  + Material
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => addLineItem(sectionIndex, 'equipment')}
                >
                  + Equipment
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => addLineItem(sectionIndex, 'subcontractor')}
                >
                  + Subcontractor
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => addLineItem(sectionIndex, 'rental')}
                >
                  + Rental
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Cost Summary */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Cost Summary</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginBottom: '1rem' }}>
            Preview totals below update in real-time. Final totals are calculated after saving.
          </p>

          <table className="summary-table">
            <tbody>
              <tr>
                <td>Labor Cost (incl. burden)</td>
                <td className="amount">${totals.labor.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td>Material Cost (incl. waste)</td>
                <td className="amount">${totals.material.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td>Equipment Cost</td>
                <td className="amount">${totals.equipment.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td>Subcontractor Cost</td>
                <td className="amount">${totals.subcontractor.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td>Rental Cost</td>
                <td className="amount">${totals.rental.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr className="subtotal-row">
                <td><strong>Subtotal</strong></td>
                <td className="amount"><strong>${totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></td>
              </tr>
              <tr>
                <td>
                  Overhead (
                  <input
                    type="number"
                    name="overhead_percentage"
                    value={formData.overhead_percentage}
                    onChange={handleChange}
                    step="0.1"
                    style={{ width: '60px', display: 'inline' }}
                    className="form-input-sm"
                  />
                  %)
                </td>
                <td className="amount">${totals.overhead.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td>
                  Profit (
                  <input
                    type="number"
                    name="profit_percentage"
                    value={formData.profit_percentage}
                    onChange={handleChange}
                    step="0.1"
                    style={{ width: '60px', display: 'inline' }}
                    className="form-input-sm"
                  />
                  %)
                </td>
                <td className="amount">${totals.profit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td>
                  Contingency (
                  <input
                    type="number"
                    name="contingency_percentage"
                    value={formData.contingency_percentage}
                    onChange={handleChange}
                    step="0.1"
                    style={{ width: '60px', display: 'inline' }}
                    className="form-input-sm"
                  />
                  %)
                </td>
                <td className="amount">${totals.contingency.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td>
                  Bond (
                  <input
                    type="number"
                    name="bond_percentage"
                    value={formData.bond_percentage}
                    onChange={handleChange}
                    step="0.1"
                    style={{ width: '60px', display: 'inline' }}
                    className="form-input-sm"
                  />
                  %)
                </td>
                <td className="amount">${totals.bond.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr className="total-row">
                <td><strong>TOTAL ESTIMATE (Preview)</strong></td>
                <td className="amount"><strong>${totals.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Additional Details */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Additional Details</h2>

          <div className="form-group">
            <label className="form-label">Scope of Work</label>
            <textarea
              name="scope_of_work"
              className="form-input"
              value={formData.scope_of_work}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the scope of work..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Exclusions</label>
            <textarea
              name="exclusions"
              className="form-input"
              value={formData.exclusions}
              onChange={handleChange}
              rows={4}
              placeholder="List any exclusions..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assumptions</label>
            <textarea
              name="assumptions"
              className="form-input"
              value={formData.assumptions}
              onChange={handleChange}
              rows={4}
              placeholder="List any assumptions..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              className="form-input"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="form-actions">
          <Link to="/estimating/estimates" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveChanges}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Preview Modal */}
      <EstimateProposalPreviewModal
        estimate={estimate}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
};

export default EstimateDetail;
