import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import opportunitiesService, { Opportunity, OpportunityScoreInput } from '../../services/opportunities';
import { employeesApi } from '../../services/employees';
import { getCampaigns } from '../../services/campaigns';
import { customersApi, Customer } from '../../services/customers';
import SearchableSelect from '../SearchableSelect';
import CompanyPicker from '../CompanyPicker';
import LocationPicker from '../LocationPicker';
import ActivityTimeline from './ActivityTimeline';
import CommentThread from './CommentThread';
import TitanEstimate from './TitanEstimate';
import OpportunityScore from './OpportunityScore';
import FollowButton from './FollowButton';
import { MARKETS } from '../../constants/markets';
import { LOCATION_GROUPS } from '../../constants/locationGroups';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
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
  const { toast, confirm } = useTitanFeedback();
  const isEditMode = !!opportunity;

  const [formData, setFormData] = useState({
    title: opportunity?.title || '',
    description: opportunity?.description || '',
    estimated_value: opportunity?.estimated_value
      ? Math.round(Number(opportunity.estimated_value)).toString()
      : '',
    estimated_start_date: opportunity?.estimated_start_date
      ? String(opportunity.estimated_start_date).substring(0, 10)
      : '',
    estimated_duration_months: opportunity?.estimated_duration_days
      ? Math.round(Number(opportunity.estimated_duration_days) / 30).toString()
      : '',
    estimated_end_date: opportunity?.estimated_end_date
      ? String(opportunity.estimated_end_date).substring(0, 10)
      : '',
    construction_type: opportunity?.construction_type || opportunity?.project_type || '',
    location: opportunity?.location || '',
    location_group: opportunity?.location_group || '',
    stage_id: opportunity?.stage_id || '',
    priority: opportunity?.priority || '',
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
    facility_location_id: opportunity?.facility_location_id || '',
    awarded_status: opportunity?.awarded_status || ''
  });

  const [activeTab, setActiveTab] = useState<'details' | 'activity_comments' | 'estimate'>('details');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingScoreData, setPendingScoreData] = useState<OpportunityScoreInput | null>(null);

  // Fetch active employees for assignment (lightweight endpoint, no HR access needed)
  const { data: assignableResponse } = useQuery({
    queryKey: ['employees', 'assignable'],
    queryFn: () => employeesApi.getAssignable()
  });

  const employees = (assignableResponse?.data as any)?.data || [];

  const employeeOptions = employees.map((emp: any) => ({
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
      const companyName = customer.name || customer.customer_owner || customer.customer_facility;
      if (companyName && !companyMap.has(companyName)) {
        companyMap.set(companyName, customer);
      }
    });
    return Array.from(companyMap.values());
  }, [customers]);

  // Clear facility/location when company changes (locations are scoped to company)
  const prevCustomerId = useRef(formData.customer_id);
  useEffect(() => {
    if (prevCustomerId.current !== formData.customer_id) {
      prevCustomerId.current = formData.customer_id;
      setFormData(prev => ({ ...prev, facility_location_id: '', facility_name: '' }));
    }
  }, [formData.customer_id]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => opportunitiesService.create(data),
    onSuccess: async (newOpportunity: any) => {
      // Save the Go/No-Go score if one was filled out
      if (pendingScoreData) {
        try {
          await opportunitiesService.createScore(newOpportunity.id, pendingScoreData);
        } catch (err) {
          console.error('Failed to save score for new opportunity:', err);
        }
      }
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

      toast.error(`Error: ${errorMessage}`);
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
      toast.error(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to update opportunity');
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
      toast.error(error.response?.data?.error || 'Failed to delete opportunity');
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

  // Validate required fields, returns true if valid
  const validateForm = (): boolean => {
    if (!formData.owner) { toast.error('Company is required'); return false; }
    if (!formData.estimated_value) { toast.error('Estimated Value is required'); return false; }
    if (!formData.priority) { toast.error('Priority is required'); return false; }
    if (!formData.stage_id) { toast.error('Stage is required'); return false; }
    if (!formData.construction_type) { toast.error('Construction Type is required'); return false; }
    if (!formData.market) { toast.error('Market is required'); return false; }
    if (!formData.location_group) { toast.error('Location Group is required'); return false; }
    if (!formData.location) { toast.error('Location is required'); return false; }
    if (!formData.source) { toast.error('Lead Source is required'); return false; }
    if (!formData.estimated_duration_months) { toast.error('Duration is required'); return false; }
    if (!formData.assigned_to) { toast.error('Assign To is required'); return false; }
    if (!formData.probability) { toast.error('Win Probability is required'); return false; }
    return true;
  };

  // Build cleaned data payload from form state
  const buildPayload = () => {
    const cleanedData: any = {
      title: formData.title,
      stage_id: Number(formData.stage_id),
      priority: formData.priority
    };

    if (formData.description) cleanedData.description = formData.description;
    if (formData.construction_type) cleanedData.construction_type = formData.construction_type;
    if (formData.location) cleanedData.location = formData.location;
    cleanedData.location_group = formData.location_group || null;
    if (formData.estimated_start_date) cleanedData.estimated_start_date = formData.estimated_start_date;
    if (formData.estimated_end_date) cleanedData.estimated_end_date = formData.estimated_end_date;
    if (formData.source) cleanedData.source = formData.source;
    if (formData.market) cleanedData.market = formData.market;
    if (formData.owner) cleanedData.owner = formData.owner;
    cleanedData.general_contractor = formData.general_contractor || null;
    cleanedData.architect = formData.architect || null;
    cleanedData.engineer = formData.engineer || null;

    cleanedData.customer_id = formData.customer_id ? Number(formData.customer_id) : null;
    cleanedData.gc_customer_id = formData.gc_customer_id ? Number(formData.gc_customer_id) : null;
    cleanedData.facility_name = formData.facility_name || null;
    cleanedData.facility_location_id = formData.facility_location_id ? Number(formData.facility_location_id) : null;

    if (formData.estimated_value) cleanedData.estimated_value = Number(formData.estimated_value);
    if (formData.estimated_duration_months) cleanedData.estimated_duration_days = Math.round(Number(formData.estimated_duration_months) * 30);
    cleanedData.assigned_to = formData.assigned_to ? Number(formData.assigned_to) : null;
    if (formData.probability) cleanedData.probability = formData.probability;
    cleanedData.awarded_status = formData.awarded_status || null;
    if (formData.campaign_id && formData.campaign_id !== '') {
      cleanedData.campaign_id = Number(formData.campaign_id);
    } else if (isEditMode) {
      cleanedData.campaign_id = null;
    }

    return cleanedData;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!isEditMode) {
      // Go to estimate tab; Create button lives there
      setActiveTab('estimate');
      return;
    }

    const cleanedData = buildPayload();
    updateMutation.mutate(cleanedData);
  };

  // Called from the score tab "Create" button in new mode
  const handleCreateFromScore = () => {
    if (!validateForm()) {
      setActiveTab('details');
      return;
    }
    const cleanedData = buildPayload();
    console.log('Creating opportunity with score:', cleanedData);
    createMutation.mutate(cleanedData);
  };


  const handleDelete = async () => {
    const ok = await confirm({ message: 'Are you sure you want to delete this opportunity? This action cannot be undone.', danger: true });
    if (ok) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="opportunity-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Opportunity' : 'New Opportunity'}</h2>
          <div className="modal-header-actions">
            {isEditMode && <FollowButton opportunityId={opportunity!.id} />}
            <button className="btn-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`tab ${activeTab === 'estimate' ? 'active' : ''}`}
            onClick={() => setActiveTab('estimate')}
          >
            Estimate
          </button>
          {isEditMode && (
            <button
              className={`tab ${activeTab === 'activity_comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity_comments')}
            >
              Activity & Comments
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
                  {/* Required fields note */}
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    fontSize: '0.8rem',
                    color: '#166534'
                  }}>
                    <span style={{ display: 'inline-block', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '3px', padding: '0 4px', marginRight: '4px', fontSize: '0.7rem' }}>Green</span>
                    <strong>= Required field</strong>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#16a34a' }}>
                      Optional: Facility/Location, Architect, Engineer, General Contractor, Sales Campaign
                    </div>
                  </div>

                  {/* Row 1: Title */}
                  <div className="form-group required">
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
                    <div className="form-group required">
                      <label htmlFor="estimated_value">Estimated Value *</label>
                      <input
                        type="text"
                        id="estimated_value"
                        name="estimated_value"
                        value={formatNumberWithCommas(formData.estimated_value)}
                        onChange={handleChange}
                        placeholder="$"
                        required
                      />
                    </div>
                    <div className="form-group required">
                      <label htmlFor="priority">Priority *</label>
                      <select
                        id="priority"
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select priority</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="form-group required">
                      <label htmlFor="stage_id">Stage *</label>
                      <select
                        id="stage_id"
                        name="stage_id"
                        value={formData.stage_id}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select stage</option>
                        {stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {stages.find((s: any) => String(s.id) === String(formData.stage_id))?.name === 'Awarded' && (
                      <div className="form-group">
                        <label htmlFor="awarded_status">Awarded Status</label>
                        <select
                          id="awarded_status"
                          name="awarded_status"
                          value={formData.awarded_status}
                          onChange={handleChange}
                          style={{
                            borderColor: formData.awarded_status === 'Completed' ? '#16a34a' : formData.awarded_status === 'In Progress' ? '#f59e0b' : '#ef4444',
                          }}
                        >
                          <option value="">Not in Vista</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    )}
                    <div className="form-group required">
                      <label htmlFor="probability">Win Probability *</label>
                      <select
                        id="probability"
                        name="probability"
                        value={formData.probability}
                        onChange={handleChange}
                        required
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
                    <div className="form-group required">
                      <label htmlFor="owner">Company *</label>
                      <CompanyPicker
                        companies={uniqueCompanies.map((c: Customer) => ({
                          id: c.id,
                          name: c.name || c.customer_owner || c.customer_facility || '',
                          customer_type: c.customer_type
                        }))}
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
                        companies={uniqueCompanies.map((c: Customer) => ({
                          id: c.id,
                          name: c.name || c.customer_owner || c.customer_facility || '',
                          customer_type: c.customer_type
                        }))}
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

                  {/* Row 4: Facility + Architect + Engineer */}
                  <div className="form-row-3">
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

                  {/* Row 5: Construction Type, Market, Location Group, Location, Source */}
                  <div className="form-row-5">
                    <div className="form-group required">
                      <label htmlFor="construction_type">Construction Type *</label>
                      <select
                        id="construction_type"
                        name="construction_type"
                        value={formData.construction_type}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select type</option>
                        <option value="New Construction">New Construction</option>
                        <option value="Addition">Addition</option>
                        <option value="Renovation">Renovation</option>
                      </select>
                    </div>

                    <div className="form-group required">
                      <label htmlFor="market">Market *</label>
                      <select
                        id="market"
                        name="market"
                        value={formData.market}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select market</option>
                        {MARKETS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group required">
                      <label htmlFor="location_group">Location Group *</label>
                      <select
                        id="location_group"
                        name="location_group"
                        value={formData.location_group}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select group</option>
                        {LOCATION_GROUPS.map(g => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group required">
                      <label htmlFor="location">Location *</label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="City, State"
                        required
                      />
                    </div>

                    <div className="form-group required">
                      <label htmlFor="source">Lead Source *</label>
                      <select
                        id="source"
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                        required
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

                  {/* Row 6: Start Date, End Date, Duration, Assign To, Campaign */}
                  <div className="form-row-5">
                    <div className="form-group required">
                      <label htmlFor="estimated_start_date">Est. Start Date *</label>
                      <input
                        type="date"
                        id="estimated_start_date"
                        name="estimated_start_date"
                        value={formData.estimated_start_date}
                        onChange={(e) => {
                          handleChange(e);
                          // Auto-calculate end date if duration is set
                          if (formData.estimated_duration_months && e.target.value) {
                            const start = new Date(e.target.value + 'T00:00:00');
                            const months = Number(formData.estimated_duration_months);
                            if (months > 0) {
                              const end = new Date(start);
                              end.setMonth(end.getMonth() + months);
                              setFormData(prev => ({ ...prev, estimated_start_date: e.target.value, estimated_end_date: end.toISOString().split('T')[0] }));
                            }
                          }
                        }}
                        required
                      />
                    </div>

                    <div className="form-group required">
                      <label htmlFor="estimated_end_date">Est. End Date *</label>
                      <input
                        type="date"
                        id="estimated_end_date"
                        name="estimated_end_date"
                        value={formData.estimated_end_date}
                        onChange={(e) => {
                          handleChange(e);
                          // Auto-calculate duration from start and end dates
                          if (formData.estimated_start_date && e.target.value) {
                            const start = new Date(formData.estimated_start_date + 'T00:00:00');
                            const end = new Date(e.target.value + 'T00:00:00');
                            const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            const diffMonths = Math.round(diffDays / 30);
                            if (diffMonths > 0) {
                              setFormData(prev => ({ ...prev, estimated_end_date: e.target.value, estimated_duration_months: diffMonths.toString() as any }));
                            }
                          }
                        }}
                        min={formData.estimated_start_date || undefined}
                        required
                      />
                    </div>

                    <div className="form-group required">
                      <label htmlFor="estimated_duration_months">Duration (months) *</label>
                      <input
                        type="number"
                        id="estimated_duration_months"
                        name="estimated_duration_months"
                        value={formData.estimated_duration_months}
                        onChange={(e) => {
                          handleChange(e);
                          // Auto-calculate end date from start + duration
                          if (formData.estimated_start_date && e.target.value) {
                            const start = new Date(formData.estimated_start_date + 'T00:00:00');
                            const months = Number(e.target.value);
                            if (months > 0) {
                              const end = new Date(start);
                              end.setMonth(end.getMonth() + months);
                              setFormData(prev => ({ ...prev, estimated_duration_months: e.target.value as any, estimated_end_date: end.toISOString().split('T')[0] }));
                            }
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="3"
                        min="1"
                        step="0.5"
                        required
                      />
                    </div>

                    <div className="form-group required">
                      <label htmlFor="assigned_to">Assign To *</label>
                      <SearchableSelect
                        options={employeeOptions}
                        value={formData.assigned_to?.toString() || ''}
                        onChange={(val) => setFormData(prev => ({ ...prev, assigned_to: val }))}
                        placeholder="Select assignee"
                        style={{ minWidth: 0 }}
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

                  {/* Description / Details - full width below form fields */}
                  <div className="form-group">
                    <label htmlFor="description">Description / Details</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe the project scope, requirements, etc."
                      className="description-textarea"
                    />
                  </div>
                </div>

                {/* Right column: Score + Estimate */}
                <div className="opportunity-form-right">
                  <OpportunityScore
                    opportunityId={isEditMode ? opportunity!.id : undefined}
                    stageName={stages.find((s: any) => String(s.id) === String(formData.stage_id))?.name || ''}
                    localMode={!isEditMode}
                    onScoreChange={!isEditMode ? (data: OpportunityScoreInput) => setPendingScoreData(data) : undefined}
                    compact
                  />
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
                    disabled={updateMutation.isPending || createMutation.isPending}
                  >
                    {updateMutation.isPending
                      ? 'Saving...'
                      : isEditMode
                      ? 'Update'
                      : 'Next: Estimate \u2192'}
                  </button>
                </div>
              </div>
            </form>
          ) : activeTab === 'activity_comments' ? (
            <div className="activity-comments-split">
              <div className="split-activities">
                <ActivityTimeline opportunityId={opportunity!.id} />
              </div>
              <div className="split-divider" />
              <div className="split-comments">
                <CommentThread opportunityId={opportunity!.id} employees={employees} />
              </div>
            </div>
          ) : activeTab === 'estimate' ? (
            <div className="estimate-tab-wrapper">
              <div className="estimate-tab-content">
                <div className="estimate-main">
                  <TitanEstimate
                    opportunityId={isEditMode ? opportunity!.id : undefined}
                    estimatedValue={Number(formData.estimated_value) || 0}
                  />
                </div>
                <div className="estimate-divider" />
                <div className="estimate-instructions">
                  <h4 className="estimate-instructions-title">How to Use This Estimate</h4>

                  <div className="estimate-legend">
                    <div className="estimate-legend-item">
                      <span className="estimate-legend-swatch estimate-legend-green" />
                      <span><strong>Required</strong> — Select your trades and set shop fab % for each</span>
                    </div>
                    <div className="estimate-legend-item">
                      <span className="estimate-legend-swatch estimate-legend-yellow" />
                      <span><strong>Suggested</strong> — Pre-filled from historical data. Adjust to match this project</span>
                    </div>
                  </div>

                  <div className="estimate-steps">
                    <div className="estimate-step">
                      <span className="estimate-step-num">1</span>
                      <div>
                        <strong>Select trades</strong>
                        <p>Check the trades that apply to this project (Pipefitting, Sheet Metal, Plumbing). At least one trade is required.</p>
                      </div>
                    </div>
                    <div className="estimate-step">
                      <span className="estimate-step-num">2</span>
                      <div>
                        <strong>Set shop fab hours %</strong>
                        <p>For each selected trade, enter the percentage of labor hours performed in the shop vs. field.</p>
                      </div>
                    </div>
                    <div className="estimate-step">
                      <span className="estimate-step-num">3</span>
                      <div>
                        <strong>Review cost breakdown</strong>
                        <p>The yellow-highlighted percentages are derived from historical project data. Adjust them to better reflect this specific project's scope.</p>
                      </div>
                    </div>
                    <div className="estimate-step">
                      <span className="estimate-step-num">4</span>
                      <div>
                        <strong>Verify labor rates</strong>
                        <p>Confirm the $/hr rates at the bottom match current rates for each trade.</p>
                      </div>
                    </div>
                  </div>

                  <div className="estimate-why">
                    <strong>Why this matters</strong>
                    <p>This estimate overlays projected field and shop hours onto your existing backlog to forecast labor workforce needs by trade and shop/field. Accurate inputs here drive reliable capacity planning across the pipeline.</p>
                  </div>

                  <div className="estimate-note">
                    All changes auto-save. Use the <strong>Reset</strong> button to restore default values.
                  </div>
                </div>
              </div>

              {!isEditMode && (
                <div className="form-actions">
                  <div className="form-actions-left" />
                  <div className="form-actions-right">
                    <button type="button" className="btn-secondary" onClick={() => setActiveTab('details')}>
                      &#8592; Back
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleCreateFromScore}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default OpportunityModal;
