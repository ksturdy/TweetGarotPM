import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import opportunitiesService, { Opportunity } from '../../services/opportunities';
import { usersApi, User } from '../../services/users';
import { getCampaigns } from '../../services/campaigns';
import VoiceNoteButton from './VoiceNoteButton';
import ActivityTimeline from './ActivityTimeline';
import QuickActions from './QuickActions';
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
    campaign_id: opportunity?.campaign_id || defaultCampaignId || ''
  });

  const [activeTab, setActiveTab] = useState<'details' | 'activities'>('details');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch users for assignment
  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll()
  });

  const users: User[] = usersResponse?.data || [];

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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => opportunitiesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
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

  const handleVoiceNote = (transcript: string) => {
    setFormData(prev => ({
      ...prev,
      description: prev.description
        ? `${prev.description}\n\n${transcript}`
        : transcript
    }));
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

        {/* Quick Actions (for existing opportunities) */}
        {isEditMode && opportunity && (
          <QuickActions opportunity={opportunity} onUpdate={onSave} />
        )}

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
              {/* Basic Info */}
              <div className="form-section">
                <h3>Basic Information</h3>

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

                <div className="form-row">
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
                </div>

                <div className="form-row">
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
                    {/* Empty div to maintain grid layout */}
                  </div>
                </div>

                {isEditMode && (
                  <div className="form-row">
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
                    <div className="form-group">
                      {/* Empty div to maintain grid layout */}
                    </div>
                  </div>
                )}
              </div>

              {/* Project Participants */}
              <div className="form-section">
                <h3>Project Participants</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="owner">Owner</label>
                    <input
                      type="text"
                      id="owner"
                      name="owner"
                      value={formData.owner}
                      onChange={handleChange}
                      placeholder="Project owner"
                    />
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
                  </div>
                </div>

                <div className="form-row">
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
              </div>

              {/* Project Details */}
              <div className="form-section">
                <h3>Project Details</h3>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <div className="textarea-with-voice">
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={6}
                      placeholder="Describe the project scope, requirements, etc."
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                    <VoiceNoteButton onTranscript={handleVoiceNote} />
                  </div>
                </div>

                <div className="form-row">
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
                      <option value="Healthcare">🏥 Healthcare</option>
                      <option value="Education">🏫 Education</option>
                      <option value="Commercial">🏢 Commercial</option>
                      <option value="Industrial">🏭 Industrial</option>
                      <option value="Retail">🏬 Retail</option>
                      <option value="Government">🏛️ Government</option>
                      <option value="Hospitality">🏨 Hospitality</option>
                      <option value="Data Center">💾 Data Center</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
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
                    {/* Empty div to maintain grid layout */}
                  </div>
                </div>

                <div className="form-row">
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
                    <label htmlFor="estimated_duration_days">Est. Duration (months)</label>
                    <input
                      type="number"
                      id="estimated_duration_days"
                      name="estimated_duration_days"
                      value={formData.estimated_duration_days}
                      onChange={handleChange}
                      placeholder="3"
                    />
                  </div>
                </div>
              </div>

              {/* Assignment & Source */}
              <div className="form-section">
                <h3>Assignment & Source</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="assigned_to">Assign To</label>
                    <select
                      id="assigned_to"
                      name="assigned_to"
                      value={formData.assigned_to}
                      onChange={handleChange}
                    >
                      <option value="">Unassigned</option>
                      {users.map((user: User) => (
                        <option key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                    </select>
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
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="campaign_id">Sales Campaign</label>
                    <select
                      id="campaign_id"
                      name="campaign_id"
                      value={formData.campaign_id}
                      onChange={handleChange}
                    >
                      <option value="">None (not from a campaign)</option>
                      {campaigns.map((campaign: any) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    {/* Empty div to maintain grid layout */}
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
