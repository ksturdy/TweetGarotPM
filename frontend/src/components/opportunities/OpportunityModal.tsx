import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import opportunitiesService, { Opportunity } from '../../services/opportunities';
import { employeesApi, Employee } from '../../services/employees';
import { getCampaigns } from '../../services/campaigns';
import { customersApi, Customer } from '../../services/customers';
import SearchableSelect from '../SearchableSelect';
import ActivityTimeline from './ActivityTimeline';
import '../../styles/OpportunityModal.css';

interface OpportunityModalProps {
  opportunity: Opportunity | null;
  onClose: () => void;
  onSave: () => void;
  defaultCampaignId?: number;
}

const OpportunityModal: React.FC<OpportunityModalProps> = ({
  opportunity,
  onClose,
  onSave,
  defaultCampaignId
}) => {
  const queryClient = useQueryClient();
  const isEditMode = !!opportunity;

  const [formData, setFormData] = useState({
    title: opportunity?.title || '',
    description: opportunity?.description || '',
    estimated_value: opportunity?.estimated_value || '',
    estimated_start_date: opportunity?.estimated_start_date || '',
    estimated_duration_days: opportunity?.estimated_duration_days || '',
    construction_type: opportunity?.construction_type || opportunity?.project_type || '',
    location: opportunity?.location || '',
    stage_id: opportunity?.stage_id || 1,
    priority: opportunity?.priority || 'medium',
    probability: opportunity?.probability || opportunity?.stage_probability || '',
    assigned_to: opportunity?.assigned_to || '',
    source: opportunity?.source || '',
    market: opportunity?.market || '',
    owner: opportunity?.owner || '',
    general_contractor: opportunity?.general_contractor || '',
    architect: opportunity?.architect || '',
    engineer: opportunity?.engineer || '',
    campaign_id: opportunity?.campaign_id || defaultCampaignId || '',
    customer_id: opportunity?.customer_id || '',
    gc_customer_id: opportunity?.gc_customer_id || '',
    facility_name: opportunity?.facility_name || '',
    facility_customer_id: opportunity?.facility_customer_id || ''
  });

  const [activeTab, setActiveTab] = useState<'details' | 'activities'>('details');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkToExistingOwner, setLinkToExistingOwner] = useState(!!opportunity?.customer_id);
  const [linkToExistingGC, setLinkToExistingGC] = useState(!!opportunity?.gc_customer_id);
  const [linkToExistingFacility, setLinkToExistingFacility] = useState(!!opportunity?.facility_customer_id);

  // Fetch active employees for assignment
  const { data: employeesResponse } = useQuery({
    queryKey: ['employees', 'active'],
    queryFn: () => employeesApi.getAll({ employmentStatus: 'active' })
  });

  const employees: Employee[] = (employeesResponse?.data as any)?.data || [];

  const employeeOptions = employees.map((emp: Employee) => ({
    value: emp.id,
    label: `${emp.first_name} ${emp.last_name}${emp.job_title ? ` - ${emp.job_title}` : ''}`
  }));

  // Fetch pipeline stages
  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => opportunitiesService.getStages()
  });

  // Fetch campaigns for linking
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns
  });

  // Fetch customers for linking owner and GC
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll()
  });

  // Get unique companies from customers list
  const uniqueCompanies = React.useMemo(() => {
    const companyMap = new Map<string, Customer>();
    customers.forEach((customer: Customer) => {
      const companyName = customer.customer_owner || customer.customer_facility;
      if (companyName && !companyMap.has(companyName)) {
        companyMap.set(companyName, customer);
      }
    });
    return Array.from(companyMap.values());
  }, [customers]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => opportunitiesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-opportunities'] });
      onSave();
    },
    onError: (error: any) => {
      console.error('Failed to create opportunity:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);

      // Build detailed error message
      let errorMessage = 'Failed to create opportunity';
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        errorMessage = error.response.data.errors.map((e: any) => `${e.param}: ${e.msg}`).join(', ');
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(`Error: ${errorMessage}`);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => opportunitiesService.update(opportunity!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-opportunities'] });
      onSave();
    },
    onError: (error: any) => {
      console.error('Failed to update opportunity:', error);
      alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to update opportunity');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => opportunitiesService.delete(opportunity!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-opportunities'] });
      onSave();
    },
    onError: (error: any) => {
      console.error('Failed to delete opportunity:', error);
      alert(error.response?.data?.error || 'Failed to delete opportunity');
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Special handling for estimated_value to format with commas
    if (name === 'estimated_value') {
      // Remove all non-digit characters
      const numericValue = value.replace(/[^\d]/g, '');
      setFormData(prev => ({ ...prev, [name]: numericValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Format number with commas
  const formatNumberWithCommas = (value: string | number): string => {
    if (!value) return '';
    const numStr = value.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clean up form data: only include fields that have values
    const cleanedData: any = {
      title: formData.title,
      stage_id: formData.stage_id,
      priority: formData.priority
    };

    // Add optional string fields if they have values
    if (formData.description) cleanedData.description = formData.description;
    if (formData.construction_type) cleanedData.construction_type = formData.construction_type;
    if (formData.location) cleanedData.location = formData.location;
    if (formData.estimated_start_date) cleanedData.estimated_start_date = formData.estimated_start_date;
    if (formData.source) cleanedData.source = formData.source;
    if (formData.market) cleanedData.market = formData.market;
    if (formData.owner) cleanedData.owner = formData.owner;
    if (formData.general_contractor) cleanedData.general_contractor = formData.general_contractor;
    if (formData.architect) cleanedData.architect = formData.architect;
    if (formData.engineer) cleanedData.engineer = formData.engineer;

    // Handle customer linking
    if (linkToExistingOwner && formData.customer_id) {
      cleanedData.customer_id = Number(formData.customer_id);
    } else {
      cleanedData.customer_id = null;
    }
    if (linkToExistingGC && formData.gc_customer_id) {
      cleanedData.gc_customer_id = Number(formData.gc_customer_id);
    } else {
      cleanedData.gc_customer_id = null;
    }
    // Handle facility linking
    if (formData.facility_name) cleanedData.facility_name = formData.facility_name;
    if (linkToExistingFacility && formData.facility_customer_id) {
      cleanedData.facility_customer_id = Number(formData.facility_customer_id);
    } else {
      cleanedData.facility_customer_id = null;
    }

    // Add optional number fields if they have values
    if (formData.estimated_value) cleanedData.estimated_value = Number(formData.estimated_value);
    if (formData.estimated_duration_days) cleanedData.estimated_duration_days = Number(formData.estimated_duration_days);
    if (formData.assigned_to) cleanedData.assigned_to = Number(formData.assigned_to);
    if (formData.probability) cleanedData.probability = formData.probability;
    // Always include campaign_id (even if empty string, convert to null for clearing)
    if (formData.campaign_id && formData.campaign_id !== '') {
      cleanedData.campaign_id = Number(formData.campaign_id);
    } else if (isEditMode) {
      // In edit mode, explicitly set to null to clear the campaign
      cleanedData.campaign_id = null;
    }

    console.log('Submitting opportunity data:', cleanedData);

    if (isEditMode) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };


  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this opportunity? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="opportunity-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Opportunity' : 'New Opportunity'}</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          {isEditMode && (
            <button
              className={`tab ${activeTab === 'activities' ? 'active' : ''}`}
              onClick={() => setActiveTab('activities')}
            >
              Activities
              {opportunity?.activity_count && opportunity.activity_count > 0 && (
                <span className="tab-badge">{opportunity.activity_count}</span>
              )}
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="modal-content">
          {activeTab === 'details' ? (
            <form onSubmit={handleSubmit} className="opportunity-form">
              <div className="opportunity-form-columns">
                {/* Left column: form fields */}
                <div className="opportunity-form-left">
                  {/* Row 1: Title */}
                  <div className="form-group">
                    <label htmlFor="title">Opportunity Title *</label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      placeholder="e.g., HVAC Installation - Downtown Office"
                    />
                  </div>

                  {/* Row 2: Value, Priority, Stage, Probability */}
                  <div className="form-row-4">
                    <div className="form-group">
                      <label htmlFor="estimated_value">Estimated Value</label>
                      <input
                        type="text"
                        id="estimated_value"
                        name="estimated_value"
                        value={formatNumberWithCommas(formData.estimated_value)}
                        onChange={handleChange}
                        placeholder="$"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="priority">Priority</label>
                      <select
                        id="priority"
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="stage_id">Stage</label>
                      <select
                        id="stage_id"
                        name="stage_id"
                        value={formData.stage_id}
                        onChange={handleChange}
                      >
                        {stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="probability">Win Probability</label>
                      <select
                        id="probability"
                        name="probability"
                        value={formData.probability}
                        onChange={handleChange}
                      >
                        <option value="">Select probability</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Company + GC side by side */}
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
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px' }}>
                        <input
                          type="checkbox"
                          checked={linkToExistingOwner}
                          onChange={(e) => {
                            setLinkToExistingOwner(e.target.checked);
                            if (!e.target.checked) {
                              setFormData(prev => ({ ...prev, customer_id: '' }));
                            }
                          }}
                          style={{ width: '14px', height: '14px' }}
                        />
                        Link to Existing
                      </label>
                      {linkToExistingOwner && (
                        <SearchableSelect
                          options={uniqueCompanies.map((customer: Customer) => ({
                            value: customer.id,
                            label: customer.customer_owner || customer.customer_facility || ''
                          }))}
                          value={formData.customer_id?.toString() || ''}
                          onChange={(val) => setFormData(prev => ({ ...prev, customer_id: val }))}
                          placeholder="Select company..."
                        />
                      )}
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
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px' }}>
                        <input
                          type="checkbox"
                          checked={linkToExistingGC}
                          onChange={(e) => {
                            setLinkToExistingGC(e.target.checked);
                            if (!e.target.checked) {
                              setFormData(prev => ({ ...prev, gc_customer_id: '' }));
                            }
                          }}
                          style={{ width: '14px', height: '14px' }}
                        />
                        Link to Existing
                      </label>
                      {linkToExistingGC && (
                        <SearchableSelect
                          options={customers.map((customer: Customer) => ({
                            value: customer.id,
                            label: customer.customer_owner ? `${customer.customer_owner} - ${customer.customer_facility}` : customer.customer_facility || ''
                          }))}
                          value={formData.gc_customer_id?.toString() || ''}
                          onChange={(val) => setFormData(prev => ({ ...prev, gc_customer_id: val }))}
                          placeholder="Select customer..."
                        />
                      )}
                    </div>
                  </div>

                  {/* Row 4: Facility + Architect + Engineer */}
                  <div className="form-row-3">
                    <div className="form-group">
                      <label htmlFor="facility_name">Facility/Location</label>
                      <input
                        type="text"
                        id="facility_name"
                        name="facility_name"
                        value={formData.facility_name}
                        onChange={handleChange}
                        placeholder="Facility or location name"
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px' }}>
                        <input
                          type="checkbox"
                          checked={linkToExistingFacility}
                          onChange={(e) => {
                            setLinkToExistingFacility(e.target.checked);
                            if (!e.target.checked) {
                              setFormData(prev => ({ ...prev, facility_customer_id: '' }));
                            }
                          }}
                          style={{ width: '14px', height: '14px' }}
                        />
                        Link to Existing
                      </label>
                      {linkToExistingFacility && (
                        <SearchableSelect
                          options={customers.map((customer: Customer) => ({
                            value: customer.id,
                            label: customer.customer_owner ? `${customer.customer_owner} - ${customer.customer_facility}` : customer.customer_facility || ''
                          }))}
                          value={formData.facility_customer_id?.toString() || ''}
                          onChange={(val) => setFormData(prev => ({ ...prev, facility_customer_id: val }))}
                          placeholder="Select facility..."
                        />
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="architect">Architect</label>
                      <input
                        type="text"
                        id="architect"
                        name="architect"
                        value={formData.architect}
                        onChange={handleChange}
                        placeholder="Architect firm"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="engineer">Engineer</label>
                      <input
                        type="text"
                        id="engineer"
                        name="engineer"
                        value={formData.engineer}
                        onChange={handleChange}
                        placeholder="Engineering firm"
                      />
                    </div>
                  </div>

                  {/* Row 5: Construction Type, Market, Location, Source */}
                  <div className="form-row-4">
                    <div className="form-group">
                      <label htmlFor="construction_type">Construction Type</label>
                      <select
                        id="construction_type"
                        name="construction_type"
                        value={formData.construction_type}
                        onChange={handleChange}
                      >
                        <option value="">Select type</option>
                        <option value="New Construction">New Construction</option>
                        <option value="Addition">Addition</option>
                        <option value="Renovation">Renovation</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="market">Market</label>
                      <select
                        id="market"
                        name="market"
                        value={formData.market}
                        onChange={handleChange}
                      >
                        <option value="">Select market</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Education">Education</option>
                        <option value="Commercial">Commercial</option>
                        <option value="Industrial">Industrial</option>
                        <option value="Retail">Retail</option>
                        <option value="Government">Government</option>
                        <option value="Hospitality">Hospitality</option>
                        <option value="Data Center">Data Center</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="location">Location</label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="City, State"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="source">Lead Source</label>
                      <select
                        id="source"
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                      >
                        <option value="">Select source</option>
                        <option value="referral">Referral</option>
                        <option value="website">Website</option>
                        <option value="cold_call">Cold Call</option>
                        <option value="trade_show">Trade Show</option>
                        <option value="email">Email Campaign</option>
                        <option value="social_media">Social Media</option>
                        <option value="repeat_customer">Repeat Customer</option>
                        <option value="ai_search">AI Opportunity Search</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 6: Start Date, Duration, Assign To, Campaign */}
                  <div className="form-row-4">
                    <div className="form-group">
                      <label htmlFor="estimated_start_date">Est. Start Date</label>
                      <input
                        type="date"
                        id="estimated_start_date"
                        name="estimated_start_date"
                        value={formData.estimated_start_date}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="estimated_duration_days">Duration (months)</label>
                      <input
                        type="number"
                        id="estimated_duration_days"
                        name="estimated_duration_days"
                        value={formData.estimated_duration_days}
                        onChange={handleChange}
                        placeholder="3"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="assigned_to">Assign To</label>
                      <SearchableSelect
                        options={employeeOptions}
                        value={formData.assigned_to?.toString() || ''}
                        onChange={(val) => setFormData(prev => ({ ...prev, assigned_to: val }))}
                        placeholder="Unassigned"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="campaign_id">Sales Campaign</label>
                      <select
                        id="campaign_id"
                        name="campaign_id"
                        value={formData.campaign_id}
                        onChange={handleChange}
                      >
                        <option value="">None</option>
                        {campaigns.map((campaign: any) => (
                          <option key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right column: Description */}
                <div className="opportunity-form-right">
                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label htmlFor="description">Description / Details</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe the project scope, requirements, etc."
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <div className="form-actions-left">
                  {isEditMode && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
                <div className="form-actions-right">
                  <button type="button" className="btn-secondary" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving...'
                      : isEditMode
                      ? 'Update'
                      : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <ActivityTimeline opportunityId={opportunity!.id} />
          )}
        </div>
      </div>
    </div>
  );
};

export default OpportunityModal;
