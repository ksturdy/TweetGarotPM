import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { customersApi, Customer } from '../../services/customers';
import SearchableSelect from '../../components/SearchableSelect';
import '../../styles/SalesPipeline.css';

const ProjectForm: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    number: '',
    client: '',
    address: '',
    start_date: '',
    end_date: '',
    status: 'Open',
    description: '',
    customer_id: '',
    owner_customer_id: '',
  });

  // Fetch customers for dropdowns
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      // Convert empty strings to undefined for customer IDs
      const submitData = {
        ...data,
        customer_id: data.customer_id ? parseInt(data.customer_id) : undefined,
        owner_customer_id: data.owner_customer_id ? parseInt(data.owner_customer_id) : undefined,
      };
      return projectsApi.create(submitData);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${response.data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/projects" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Projects
            </Link>
            <h1>📁 New Project</h1>
            <div className="sales-subtitle">Create a new construction project</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Project Number *</label>
            <input
              type="text"
              name="number"
              className="form-input"
              value={formData.number}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input
              type="text"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Client *</label>
            <input
              type="text"
              name="client"
              className="form-input"
              value={formData.client}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Customer (GC)</label>
              <SearchableSelect
                options={customers.map((c: Customer) => ({ value: c.id, label: c.customer_owner }))}
                value={formData.customer_id}
                onChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}
                placeholder="-- Select Customer --"
              />
              <small style={{ color: '#64748b', fontSize: '0.75rem' }}>The General Contractor you have the contract with</small>
            </div>

            <div className="form-group">
              <label className="form-label">Owner</label>
              <SearchableSelect
                options={customers.map((c: Customer) => ({ value: c.id, label: c.customer_owner }))}
                value={formData.owner_customer_id}
                onChange={(value) => setFormData(prev => ({ ...prev, owner_customer_id: value }))}
                placeholder="-- Select Owner --"
              />
              <small style={{ color: '#64748b', fontSize: '0.75rem' }}>The building owner / end customer</small>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              type="text"
              name="address"
              className="form-input"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                name="start_date"
                className="form-input"
                value={formData.start_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                name="end_date"
                className="form-input"
                value={formData.end_date}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              name="status"
              className="form-input"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="Open">Open</option>
              <option value="Soft-Closed">Soft-Closed</option>
              <option value="Hard-Closed">Hard-Closed</option>
              <option value="active">Active (Legacy)</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="description"
              className="form-input"
              rows={4}
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/projects')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>

          {createMutation.isError && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              Error creating project. Please try again.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProjectForm;
