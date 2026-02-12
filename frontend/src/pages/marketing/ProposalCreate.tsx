import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { proposalsApi } from '../../services/proposals';
import { proposalTemplatesApi } from '../../services/proposalTemplates';
import { customersApi } from '../../services/customers';
import './ProposalCreate.css';

const ProposalCreate: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    template_id: '',
    customer_id: '',
    title: '',
    project_name: '',
    project_location: '',
    executive_summary: '',
    company_overview: '',
    scope_of_work: '',
    approach_and_methodology: '',
    total_amount: '',
    payment_terms: '',
    terms_and_conditions: '',
    valid_until: '',
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['proposalTemplates'],
    queryFn: async () => {
      const response = await proposalTemplatesApi.getAll({ is_active: true });
      return response.data;
    },
  });

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await customersApi.getAll();
      return response;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.template_id) {
        return proposalsApi.createFromTemplate(parseInt(data.template_id), data);
      }
      return proposalsApi.create(data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      navigate(`/proposals/${response.data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      ...formData,
      customer_id: formData.customer_id ? parseInt(formData.customer_id) : undefined,
      template_id: formData.template_id ? parseInt(formData.template_id) : undefined,
      total_amount: formData.total_amount ? parseFloat(formData.total_amount) : undefined,
    };

    // Remove empty strings
    Object.keys(data).forEach((key) => {
      if (data[key] === '') {
        delete data[key];
      }
    });

    createMutation.mutate(data);
  };

  return (
    <div className="proposal-create">
      <div className="form-header">
        <div>
          <button className="breadcrumb-link" onClick={() => navigate('/proposals')}>
            ← Back to Proposals
          </button>
          <h1 className="page-title">Create New Proposal</h1>
          <p className="page-subtitle">Fill in the details to create a draft proposal</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        {/* Template Selection */}
        <div className="card">
          <h2 className="section-title">Start from Template (Optional)</h2>
          <div className="form-group">
            <label>Proposal Template</label>
            <select
              className="input"
              value={formData.template_id}
              onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
            >
              <option value="">Blank Proposal</option>
              {templates.map((template: any) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <p className="help-text">
              Selecting a template will pre-fill sections with default content
            </p>
          </div>
        </div>

        {/* Basic Information */}
        <div className="card">
          <h2 className="section-title">Basic Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>
                Customer <span className="required">*</span>
              </label>
              <select
                className="input"
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                required
              >
                <option value="">Select Customer</option>
                {customers.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_facility}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                Proposal Title <span className="required">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., HVAC System Upgrade Proposal"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                className="input"
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                placeholder="e.g., Main Building HVAC Retrofit"
              />
            </div>

            <div className="form-group">
              <label>Project Location</label>
              <input
                type="text"
                className="input"
                value={formData.project_location}
                onChange={(e) =>
                  setFormData({ ...formData, project_location: e.target.value })
                }
                placeholder="e.g., 123 Main St, Phoenix, AZ"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Total Amount</label>
              <input
                type="number"
                className="input"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Valid Until</label>
              <input
                type="date"
                className="input"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Content Sections */}
        {!formData.template_id && (
          <>
            <div className="card">
              <h2 className="section-title">Executive Summary</h2>
              <div className="form-group">
                <textarea
                  className="input"
                  value={formData.executive_summary}
                  onChange={(e) =>
                    setFormData({ ...formData, executive_summary: e.target.value })
                  }
                  rows={4}
                  placeholder="Brief overview of the proposal..."
                />
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Company Overview</h2>
              <div className="form-group">
                <textarea
                  className="input"
                  value={formData.company_overview}
                  onChange={(e) =>
                    setFormData({ ...formData, company_overview: e.target.value })
                  }
                  rows={4}
                  placeholder="Information about your company..."
                />
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Scope of Work</h2>
              <div className="form-group">
                <textarea
                  className="input"
                  value={formData.scope_of_work}
                  onChange={(e) => setFormData({ ...formData, scope_of_work: e.target.value })}
                  rows={6}
                  placeholder="Detailed description of work to be performed..."
                />
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Terms & Conditions</h2>
              <div className="form-group">
                <textarea
                  className="input"
                  value={formData.terms_and_conditions}
                  onChange={(e) =>
                    setFormData({ ...formData, terms_and_conditions: e.target.value })
                  }
                  rows={4}
                  placeholder="Payment terms, warranties, exclusions..."
                />
              </div>
            </div>
          </>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" className="btnSecondary" onClick={() => navigate('/proposals')}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Proposal'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProposalCreate;
