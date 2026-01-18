import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { estimatesApi, Estimate, EstimateSection, EstimateLineItem } from '../../services/estimates';
import { customersApi } from '../../services/customers';
import './EstimateNew.css';

const EstimateNew: React.FC = () => {
  const navigate = useNavigate();

  // Fetch next estimate number
  const { data: nextNumberData } = useQuery({
    queryKey: ['estimates', 'next-number'],
    queryFn: () => estimatesApi.getNextNumber().then((res) => res.data),
  });

  // Fetch customers for dropdown
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  // Load from localStorage on mount
  const loadFromStorage = () => {
    const saved = localStorage.getItem('estimateInProgress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved estimate', e);
      }
    }
    return null;
  };

  const savedData = loadFromStorage();

  const [formData, setFormData] = useState<Estimate>(savedData?.formData || {
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
    overhead_percentage: 10.00,
    profit_percentage: 10.00,
    contingency_percentage: 5.00,
    bond_percentage: 0,
    scope_of_work: '',
    exclusions: '',
    assumptions: '',
    notes: '',
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [sections, setSections] = useState<EstimateSection[]>(savedData?.sections || [
    {
      section_name: 'HVAC Equipment',
      section_order: 0,
      description: '',
      items: [],
    },
    {
      section_name: 'Ductwork',
      section_order: 1,
      description: '',
      items: [],
    },
    {
      section_name: 'Piping',
      section_order: 2,
      description: '',
      items: [],
    },
    {
      section_name: 'Controls & Electrical',
      section_order: 3,
      description: '',
      items: [],
    },
    {
      section_name: 'Labor',
      section_order: 4,
      description: '',
      items: [],
    },
    {
      section_name: 'Subcontractors',
      section_order: 5,
      description: '',
      items: [],
    },
  ]);

  // Auto-save to localStorage whenever form data or sections change
  useEffect(() => {
    const dataToSave = {
      formData,
      sections,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem('estimateInProgress', JSON.stringify(dataToSave));
  }, [formData, sections]);

  useEffect(() => {
    if (nextNumberData?.estimate_number) {
      setFormData((prev) => ({ ...prev, estimate_number: nextNumberData.estimate_number }));
    }
  }, [nextNumberData]);

  const createMutation = useMutation({
    mutationFn: (data: Estimate) => estimatesApi.create(data),
    onSuccess: (response) => {
      // Clear localStorage on successful save
      localStorage.removeItem('estimateInProgress');
      // Navigate back to estimates list
      navigate('/estimating/estimates');
    },
    onError: (error: any) => {
      console.error('Failed to create estimate:', error);
      alert(`Failed to save estimate: ${error.response?.data?.error || error.message || 'Unknown error'}. Your work has been auto-saved and you can try again.`);
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
  ).slice(0, 10); // Limit to 10 results

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

  const updateSection = (index: number, field: keyof EstimateSection, value: any) => {
    setSections((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const deleteSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const addLineItem = (sectionIndex: number, itemType: string) => {
    const newItem: EstimateLineItem = {
      item_order: sections[sectionIndex].items?.length || 0,
      item_type: itemType,
      description: '',
      quantity: 1,
      unit: itemType === 'labor' ? 'HR' : 'EA',
      labor_hours: 0,
      labor_rate: 0,
      labor_cost: 0,
      labor_burden_percentage: 35.00, // Default burden rate
      labor_burden_amount: 0,
      material_unit_cost: 0,
      material_cost: 0,
      material_waste_percentage: 10.00, // Default waste factor
      material_waste_amount: 0,
      equipment_unit_cost: 0,
      equipment_cost: 0,
      subcontractor_cost: 0,
      rental_duration: 0,
      rental_rate: 0,
      rental_cost: 0,
      total_cost: 0,
    };

    setSections((prev) => {
      const updated = [...prev];
      updated[sectionIndex].items = [...(updated[sectionIndex].items || []), newItem];
      return updated;
    });
  };

  const updateLineItem = (
    sectionIndex: number,
    itemIndex: number,
    field: keyof EstimateLineItem,
    value: any
  ) => {
    setSections((prev) => {
      const updated = [...prev];
      const item = { ...updated[sectionIndex].items![itemIndex], [field]: value };

      // Auto-calculate costs based on item type
      if (field === 'quantity' || field === 'labor_hours' || field === 'labor_rate') {
        item.labor_cost = (item.labor_hours || 0) * (item.labor_rate || 0) * (item.quantity || 1);
        item.labor_burden_amount = item.labor_cost * ((item.labor_burden_percentage || 0) / 100);
      }

      if (field === 'quantity' || field === 'material_unit_cost') {
        item.material_cost = (item.material_unit_cost || 0) * (item.quantity || 1);
        item.material_waste_amount = item.material_cost * ((item.material_waste_percentage || 0) / 100);
      }

      if (field === 'quantity' || field === 'equipment_unit_cost') {
        item.equipment_cost = (item.equipment_unit_cost || 0) * (item.quantity || 1);
      }

      if (field === 'rental_duration' || field === 'rental_rate') {
        item.rental_cost = (item.rental_duration || 0) * (item.rental_rate || 0);
      }

      // Calculate line item total
      item.total_cost =
        item.labor_cost +
        item.labor_burden_amount +
        item.material_cost +
        item.material_waste_amount +
        item.equipment_cost +
        item.subcontractor_cost +
        item.rental_cost;

      updated[sectionIndex].items![itemIndex] = item;
      return updated;
    });
  };

  const deleteLineItem = (sectionIndex: number, itemIndex: number) => {
    setSections((prev) => {
      const updated = [...prev];
      updated[sectionIndex].items = updated[sectionIndex].items!.filter((_, i) => i !== itemIndex);
      return updated;
    });
  };

  const calculateTotals = () => {
    let labor = 0;
    let material = 0;
    let equipment = 0;
    let subcontractor = 0;
    let rental = 0;

    sections.forEach((section) => {
      section.items?.forEach((item) => {
        labor += (item.labor_cost || 0) + (item.labor_burden_amount || 0);
        material += (item.material_cost || 0) + (item.material_waste_amount || 0);
        equipment += item.equipment_cost || 0;
        subcontractor += item.subcontractor_cost || 0;
        rental += item.rental_cost || 0;
      });
    });

    const subtotal = labor + material + equipment + subcontractor + rental;
    const overhead = subtotal * (formData.overhead_percentage / 100);
    const profit = (subtotal + overhead) * (formData.profit_percentage / 100);
    const contingency = subtotal * (formData.contingency_percentage / 100);
    const bond = subtotal * (formData.bond_percentage / 100);
    const total = subtotal + overhead + profit + contingency + bond;

    return {
      labor,
      material,
      equipment,
      subcontractor,
      rental,
      subtotal,
      overhead,
      profit,
      contingency,
      bond,
      total,
    };
  };

  const totals = calculateTotals();

  const handleSubmit = (e: React.FormEvent, submitStatus: string = 'draft') => {
    e.preventDefault();

    const estimateData: Estimate = {
      ...formData,
      status: submitStatus,
      sections: sections.map((section) => ({
        ...section,
        items: section.items || [],
      })),
    };

    createMutation.mutate(estimateData);
  };

  const handleSaveDraft = () => {
    const estimateData: Estimate = {
      ...formData,
      // Convert empty strings to undefined for date fields
      bid_date: formData.bid_date || undefined,
      project_start_date: formData.project_start_date || undefined,
      status: 'in progress',
      sections: sections.map((section) => ({
        ...section,
        items: section.items || [],
      })),
    };

    createMutation.mutate(estimateData);
  };

  const handleSubmitEstimate = () => {
    const estimateData: Estimate = {
      ...formData,
      // Convert empty strings to undefined for date fields
      bid_date: formData.bid_date || undefined,
      project_start_date: formData.project_start_date || undefined,
      status: 'pending',
      sections: sections.map((section) => ({
        ...section,
        items: section.items || [],
      })),
    };

    createMutation.mutate(estimateData);
  };

  return (
    <div className="estimate-new">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/estimating/estimates">&larr; Back to Estimates</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Create New Estimate</h1>
          {savedData && (
            <p style={{ fontSize: '0.875rem', color: 'var(--success)', marginTop: '0.5rem' }}>
              📝 Draft restored from {new Date(savedData.lastSaved).toLocaleString()}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to clear the saved draft?')) {
                    localStorage.removeItem('estimateInProgress');
                    window.location.reload();
                  }
                }}
                style={{ marginLeft: '1rem', fontSize: '0.75rem' }}
                className="btn btn-sm btn-secondary"
              >
                Clear Draft
              </button>
            </p>
          )}
          <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginTop: '0.25rem' }}>
            ✓ Auto-saving as you work
          </p>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'draft')}>
        {/* Estimate Header */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Estimate Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Estimate Number *</label>
              <input
                type="text"
                name="estimate_number"
                className="form-input"
                value={formData.estimate_number}
                onChange={handleChange}
                required
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
              {/* Click outside to close */}
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
                      <th style={{ width: '200px' }}>Description</th>
                      <th style={{ width: '80px' }}>Type</th>
                      <th style={{ width: '60px' }}>Qty</th>
                      <th style={{ width: '50px' }}>Unit</th>
                      <th style={{ width: '80px' }}>Labor Hrs</th>
                      <th style={{ width: '80px' }}>Labor Rate</th>
                      <th style={{ width: '90px' }}>Material $/Unit</th>
                      <th style={{ width: '90px' }}>Equipment $</th>
                      <th style={{ width: '100px' }}>Subcontractor $</th>
                      <th style={{ width: '90px' }}>Total</th>
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
                            onChange={(e) =>
                              updateLineItem(sectionIndex, itemIndex, 'description', e.target.value)
                            }
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
                            type="number"
                            className="form-input-sm"
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(sectionIndex, itemIndex, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            step="0.01"
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
                            type="number"
                            className="form-input-sm"
                            value={item.labor_hours}
                            onChange={(e) =>
                              updateLineItem(sectionIndex, itemIndex, 'labor_hours', parseFloat(e.target.value) || 0)
                            }
                            step="0.25"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input-sm"
                            value={item.labor_rate}
                            onChange={(e) =>
                              updateLineItem(sectionIndex, itemIndex, 'labor_rate', parseFloat(e.target.value) || 0)
                            }
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input-sm"
                            value={item.material_unit_cost}
                            onChange={(e) =>
                              updateLineItem(
                                sectionIndex,
                                itemIndex,
                                'material_unit_cost',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input-sm"
                            value={item.equipment_unit_cost}
                            onChange={(e) =>
                              updateLineItem(
                                sectionIndex,
                                itemIndex,
                                'equipment_unit_cost',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input-sm"
                            value={item.subcontractor_cost}
                            onChange={(e) =>
                              updateLineItem(
                                sectionIndex,
                                itemIndex,
                                'subcontractor_cost',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            step="0.01"
                          />
                        </td>
                        <td>
                          <strong>${item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
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

          <table className="summary-table">
            <tbody>
              <tr>
                <td>Labor Cost (incl. burden)</td>
                <td className="amount">${totals.labor.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>Material Cost (incl. waste)</td>
                <td className="amount">${totals.material.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>Equipment Cost</td>
                <td className="amount">${totals.equipment.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>Subcontractor Cost</td>
                <td className="amount">${totals.subcontractor.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>Rental Cost</td>
                <td className="amount">${totals.rental.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="subtotal-row">
                <td><strong>Subtotal</strong></td>
                <td className="amount"><strong>${totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
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
                <td className="amount">${totals.overhead.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
                <td className="amount">${totals.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
                <td className="amount">${totals.contingency.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
                <td className="amount">${totals.bond.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="total-row">
                <td><strong>Total Estimate</strong></td>
                <td className="amount"><strong>${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Additional Information */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Additional Information</h2>

          <div className="form-group">
            <label className="form-label">Scope of Work</label>
            <textarea
              name="scope_of_work"
              className="form-input"
              value={formData.scope_of_work}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the scope of work included in this estimate..."
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
              placeholder="List items excluded from this estimate..."
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
              placeholder="List assumptions made for this estimate..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              className="form-input"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
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
            className="btn btn-secondary"
            onClick={handleSaveDraft}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmitEstimate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Submitting...' : 'Submit Estimate'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EstimateNew;
