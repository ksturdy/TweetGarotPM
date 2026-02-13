import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { rfisApi } from '../../services/rfis';
import { usersApi } from '../../services/users';
import { companiesApi } from '../../services/companies';
import { contactsApi } from '../../services/contacts';
import '../../styles/SalesPipeline.css';

const RFIForm: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((res) => res.data),
  });

  const { data: projectCompanies } = useQuery({
    queryKey: ['companies', 'project', projectId],
    queryFn: () => companiesApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  const { data: projectContacts } = useQuery({
    queryKey: ['contacts', 'project', projectId],
    queryFn: () => contactsApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  const [formData, setFormData] = useState({
    projectId: Number(projectId),
    subject: '',
    question: '',
    priority: 'normal',
    due_date: '',
    assigned_to: '',
    ball_in_court: '',
    recipient_company_id: '',
    recipient_contact_id: '',
    // Reference Information
    spec_section: '',
    drawing_sheet: '',
    detail_grid_ref: '',
    discipline: '',
    discipline_other: '',
    // Suggested Solution
    suggested_solution: '',
    // Impact Information
    schedule_impact: false,
    schedule_impact_days: '',
    cost_impact: false,
    cost_impact_amount: '',
    affects_other_trades: false,
    affected_trades: '',
    // Attachments
    has_sketches: false,
    has_photos: false,
    has_spec_pages: false,
    has_shop_drawings: false,
    attachment_notes: '',
  });

  const createMutation = useMutation({
    mutationFn: rfisApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
      navigate(`/projects/${projectId}/rfis`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      projectId: formData.projectId,
      subject: formData.subject,
      question: formData.question,
      priority: formData.priority,
      assignedTo: formData.assigned_to ? Number(formData.assigned_to) : undefined,
      ballInCourt: formData.ball_in_court ? Number(formData.ball_in_court) : undefined,
      dueDate: formData.due_date || undefined,
      recipientCompanyId: formData.recipient_company_id ? Number(formData.recipient_company_id) : undefined,
      recipientContactId: formData.recipient_contact_id ? Number(formData.recipient_contact_id) : undefined,
      // Reference Information
      specSection: formData.spec_section || undefined,
      drawingSheet: formData.drawing_sheet || undefined,
      detailGridRef: formData.detail_grid_ref || undefined,
      discipline: (formData.discipline as 'plumbing' | 'hvac' | 'piping' | 'equipment' | 'controls' | 'other' | '') || undefined,
      disciplineOther: formData.discipline_other || undefined,
      // Suggested Solution
      suggestedSolution: formData.suggested_solution || undefined,
      // Impact Information
      scheduleImpact: formData.schedule_impact,
      scheduleImpactDays: formData.schedule_impact_days ? Number(formData.schedule_impact_days) : undefined,
      costImpact: formData.cost_impact,
      costImpactAmount: formData.cost_impact_amount ? Number(formData.cost_impact_amount) : undefined,
      affectsOtherTrades: formData.affects_other_trades,
      affectedTrades: formData.affected_trades || undefined,
      // Attachments
      hasSketches: formData.has_sketches,
      hasPhotos: formData.has_photos,
      hasSpecPages: formData.has_spec_pages,
      hasShopDrawings: formData.has_shop_drawings,
      attachmentNotes: formData.attachment_notes || undefined,
    };
    createMutation.mutate(submitData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}/rfis`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to RFIs
            </Link>
            <h1>📬 New RFI</h1>
            <div className="sales-subtitle">Create a new request for information</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Subject *</label>
            <input
              type="text"
              name="subject"
              className="form-input"
              value={formData.subject}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Question *</label>
            <textarea
              name="question"
              className="form-input"
              rows={6}
              value={formData.question}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                name="priority"
                className="form-input"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                type="date"
                name="due_date"
                className="form-input"
                value={formData.due_date}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Assigned To (Internal)</label>
              <select
                name="assigned_to"
                className="form-input"
                value={formData.assigned_to}
                onChange={handleChange}
              >
                <option value="">Select User</option>
                {users?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ball in Court (Company)</label>
              <select
                name="ball_in_court"
                className="form-input"
                value={formData.ball_in_court}
                onChange={handleChange}
              >
                <option value="">Select Company</option>
                {projectCompanies?.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.role.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Reference Information</h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Spec Section(s)</label>
                <input
                  type="text"
                  name="spec_section"
                  className="form-input"
                  value={formData.spec_section}
                  onChange={handleChange}
                  placeholder="e.g., 23 05 00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Drawing Sheet(s)</label>
                <input
                  type="text"
                  name="drawing_sheet"
                  className="form-input"
                  value={formData.drawing_sheet}
                  onChange={handleChange}
                  placeholder="e.g., M-101, M-102"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Detail/Grid Reference</label>
                <input
                  type="text"
                  name="detail_grid_ref"
                  className="form-input"
                  value={formData.detail_grid_ref}
                  onChange={handleChange}
                  placeholder="e.g., 3/A-4"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Discipline</label>
                <select
                  name="discipline"
                  className="form-input"
                  value={formData.discipline}
                  onChange={handleChange}
                >
                  <option value="">Select Discipline</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                  <option value="piping">Piping</option>
                  <option value="equipment">Equipment</option>
                  <option value="controls">Controls</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {formData.discipline === 'other' && (
              <div className="form-group">
                <label className="form-label">Other Discipline (Please Specify)</label>
                <input
                  type="text"
                  name="discipline_other"
                  className="form-input"
                  value={formData.discipline_other}
                  onChange={handleChange}
                  placeholder="Specify discipline"
                />
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Suggested Solution (If Applicable)</h3>

            <div className="form-group">
              <textarea
                name="suggested_solution"
                className="form-input"
                rows={4}
                value={formData.suggested_solution}
                onChange={handleChange}
                placeholder="Describe any suggested solution or approach to resolve this issue..."
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Impact If Not Resolved</h3>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="schedule_impact"
                  checked={formData.schedule_impact}
                  onChange={handleChange}
                />
                <span>Schedule Impact</span>
              </label>
              {formData.schedule_impact && (
                <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                  <label className="form-label">Estimated Days of Delay</label>
                  <input
                    type="number"
                    name="schedule_impact_days"
                    className="form-input"
                    value={formData.schedule_impact_days}
                    onChange={handleChange}
                    placeholder="Number of days"
                    min="0"
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="cost_impact"
                  checked={formData.cost_impact}
                  onChange={handleChange}
                />
                <span>Cost Impact</span>
              </label>
              {formData.cost_impact && (
                <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                  <label className="form-label">Estimated Cost Impact ($)</label>
                  <input
                    type="number"
                    name="cost_impact_amount"
                    className="form-input"
                    value={formData.cost_impact_amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="affects_other_trades"
                  checked={formData.affects_other_trades}
                  onChange={handleChange}
                />
                <span>Affects Other Trades</span>
              </label>
              {formData.affects_other_trades && (
                <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                  <label className="form-label">List Affected Trades</label>
                  <input
                    type="text"
                    name="affected_trades"
                    className="form-input"
                    value={formData.affected_trades}
                    onChange={handleChange}
                    placeholder="e.g., Electrical, Plumbing, Drywall"
                  />
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Attachments</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="has_sketches"
                  checked={formData.has_sketches}
                  onChange={handleChange}
                />
                <span>Sketches/Markups</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="has_photos"
                  checked={formData.has_photos}
                  onChange={handleChange}
                />
                <span>Photos</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="has_spec_pages"
                  checked={formData.has_spec_pages}
                  onChange={handleChange}
                />
                <span>Spec Pages</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="has_shop_drawings"
                  checked={formData.has_shop_drawings}
                  onChange={handleChange}
                />
                <span>Shop Drawings</span>
              </label>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Attachment Notes</label>
              <input
                type="text"
                name="attachment_notes"
                className="form-input"
                value={formData.attachment_notes}
                onChange={handleChange}
                placeholder="Additional notes about attachments"
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Recipient Information</h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Send To (Company)</label>
                <select
                  name="recipient_company_id"
                  className="form-input"
                  value={formData.recipient_company_id}
                  onChange={(e) => {
                    handleChange(e);
                    // Clear contact when company changes
                    setFormData((prev) => ({ ...prev, recipient_contact_id: '' }));
                  }}
                >
                  <option value="">Select Company</option>
                  {projectCompanies?.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} ({company.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <select
                  name="recipient_contact_id"
                  className="form-input"
                  value={formData.recipient_contact_id}
                  onChange={handleChange}
                  disabled={!formData.recipient_company_id}
                >
                  <option value="">Select Contact</option>
                  {projectContacts
                    ?.filter((contact) => contact.company_id === Number(formData.recipient_company_id))
                    .map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name}
                        {contact.title && ` - ${contact.title}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {!projectCompanies || projectCompanies.length === 0 ? (
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginTop: '0.5rem' }}>
                No companies added to this project yet.{' '}
                <Link to={`/projects/${projectId}/companies`}>Add companies</Link> to enable recipient selection.
              </div>
            ) : null}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(`/projects/${projectId}/rfis`)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create RFI'}
            </button>
          </div>

          {createMutation.isError && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              Error creating RFI. Please try again.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default RFIForm;
