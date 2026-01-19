import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import opportunitiesService, { Opportunity } from '../../services/opportunities';
import { usersApi, User } from '../../services/users';
import VoiceNoteButton from './VoiceNoteButton';
import ActivityTimeline from './ActivityTimeline';
import QuickActions from './QuickActions';
import '../../styles/OpportunityModal.css';

interface OpportunityModalProps {
  opportunity: Opportunity | null;
  onClose: () => void;
  onSave: () => void;
}

const OpportunityModal: React.FC<OpportunityModalProps> = ({
  opportunity,
  onClose,
  onSave
}) => {
  const queryClient = useQueryClient();
  const isEditMode = !!opportunity;

  const [formData, setFormData] = useState({
    title: opportunity?.title || '',
    client_name: opportunity?.client_name || '',
    client_email: opportunity?.client_email || '',
    client_phone: opportunity?.client_phone || '',
    client_company: opportunity?.client_company || '',
    description: opportunity?.description || '',
    estimated_value: opportunity?.estimated_value || '',
    estimated_start_date: opportunity?.estimated_start_date || '',
    estimated_duration_days: opportunity?.estimated_duration_days || '',
    project_type: opportunity?.project_type || '',
    location: opportunity?.location || '',
    stage_id: opportunity?.stage_id || 1,
    priority: opportunity?.priority || 'medium',
    assigned_to: opportunity?.assigned_to || '',
    source: opportunity?.source || ''
  });

  const [activeTab, setActiveTab] = useState<'details' | 'activities'>('details');

  // Fetch users for assignment
  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll()
  });

  const users: User[] = usersResponse?.data || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => opportunitiesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      onSave();
    },
    onError: (error: any) => {
      console.error('Failed to create opportunity:', error);
      alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create opportunity');
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clean up form data: convert empty strings to null/undefined for optional fields
    const cleanedData = {
      ...formData,
      client_email: formData.client_email || undefined,
      client_phone: formData.client_phone || undefined,
      client_company: formData.client_company || undefined,
      description: formData.description || undefined,
      estimated_value: formData.estimated_value ? Number(formData.estimated_value) : undefined,
      estimated_start_date: formData.estimated_start_date || undefined,
      estimated_duration_days: formData.estimated_duration_days ? Number(formData.estimated_duration_days) : undefined,
      project_type: formData.project_type || undefined,
      location: formData.location || undefined,
      assigned_to: formData.assigned_to ? Number(formData.assigned_to) : undefined,
      source: formData.source || undefined
    };

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
                      type="number"
                      id="estimated_value"
                      name="estimated_value"
                      value={formData.estimated_value}
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
              </div>

              {/* Client Info */}
              <div className="form-section">
                <h3>Client Information</h3>

                <div className="form-group">
                  <label htmlFor="client_name">Client Name *</label>
                  <input
                    type="text"
                    id="client_name"
                    name="client_name"
                    value={formData.client_name}
                    onChange={handleChange}
                    required
                    placeholder="Contact person name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="client_company">Company</label>
                  <input
                    type="text"
                    id="client_company"
                    name="client_company"
                    value={formData.client_company}
                    onChange={handleChange}
                    placeholder="Company name"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="client_email">Email</label>
                    <input
                      type="email"
                      id="client_email"
                      name="client_email"
                      value={formData.client_email}
                      onChange={handleChange}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="client_phone">Phone</label>
                    <input
                      type="tel"
                      id="client_phone"
                      name="client_phone"
                      value={formData.client_phone}
                      onChange={handleChange}
                      placeholder="(555) 123-4567"
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
                      rows={4}
                      placeholder="Describe the project scope, requirements, etc."
                    />
                    <VoiceNoteButton onTranscript={handleVoiceNote} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="project_type">Project Type</label>
                    <select
                      id="project_type"
                      name="project_type"
                      value={formData.project_type}
                      onChange={handleChange}
                    >
                      <option value="">Select type</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="residential">Residential</option>
                      <option value="retrofit">Retrofit</option>
                      <option value="maintenance">Maintenance</option>
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
                    <label htmlFor="estimated_duration_days">Est. Duration (days)</label>
                    <input
                      type="number"
                      id="estimated_duration_days"
                      name="estimated_duration_days"
                      value={formData.estimated_duration_days}
                      onChange={handleChange}
                      placeholder="90"
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
              </div>

              {/* Form Actions */}
              <div className="form-actions">
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
