import React, { useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { submittalsApi } from '../../services/submittals';
import { projectsApi } from '../../services/projects';
import { attachmentsApi, Attachment } from '../../services/attachments';
import { format, isValid } from 'date-fns';
import '../../styles/SalesPipeline.css';

const fmtDate = (v: string | null | undefined): string => {
  if (!v) return '-';
  const d = new Date(v.includes('T') ? v : v + 'T00:00:00');
  return isValid(d) ? format(d, 'MMM d, yyyy') : '-';
};

const STATUS_OPTIONS = [
  { value: 'requested_from_vendor', label: 'Requested from Vendor' },
  { value: 'submitted_for_approval', label: 'Submitted for Approval' },
  { value: 'revise_resubmit', label: 'Revise and Resubmit' },
  { value: 'approved', label: 'Approved' },
];

const STATUS_BADGE: Record<string, string> = {
  requested_from_vendor: 'badge-warning',
  submitted_for_approval: 'badge-info',
  revise_resubmit: 'badge-warning',
  approved: 'badge-success',
};

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status.replace(/_/g, ' ');

const SubmittalDetail: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: submittal, isLoading } = useQuery({
    queryKey: ['submittal', id],
    queryFn: () => submittalsApi.getById(Number(id)).then((res) => res.data),
  });

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ['attachments', 'submittal', id],
    queryFn: () => attachmentsApi.getByEntity('submittal', Number(id)).then((res) => res.data),
    enabled: !!id,
  });

  const [formData, setFormData] = useState({
    name: '',
    spec_section: '',
    description: '',
    subcontractor: '',
    due_date: '',
    status: 'requested_from_vendor',
  });

  React.useEffect(() => {
    if (submittal) {
      setFormData({
        name: submittal.name || '',
        spec_section: submittal.spec_section,
        description: submittal.description,
        subcontractor: submittal.subcontractor || '',
        due_date: submittal.due_date || '',
        status: submittal.status,
      });
    }
  }, [submittal]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => submittalsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submittal', id] });
      queryClient.invalidateQueries({ queryKey: ['submittals', projectId] });
      setIsEditing(false);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload('submittal', Number(id), file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'submittal', id] });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attId: number) => attachmentsApi.delete(attId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'submittal', id] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      name: formData.name || undefined,
      specSection: formData.spec_section,
      description: formData.description,
      subcontractor: formData.subcontractor || undefined,
      dueDate: formData.due_date || undefined,
      status: formData.status,
    };
    updateMutation.mutate(submitData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadMutation.mutateAsync(files[i]);
      }
    } catch {
      // error visible in uploadMutation.isError
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) return <div className="loading">Loading...</div>;
  if (!submittal) return <div className="card">Submittal not found</div>;

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}/submittals`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Submittals
            </Link>
            <h1>📎 Submittal #{submittal.number}</h1>
            <div className="sales-subtitle">{submittal.name || submittal.description}</div>
          </div>
        </div>
        <div className="sales-header-actions">
          {!isEditing && (
            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Submittal Name</label>
              <input
                type="text"
                name="name"
                className="form-input"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., HVAC Equipment Submittal"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Spec Section *</label>
              <input
                type="text"
                name="spec_section"
                className="form-input"
                value={formData.spec_section}
                onChange={handleChange}
                placeholder="e.g., 23 05 13"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                name="description"
                className="form-input"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Vendor/Supplier</label>
                <input
                  type="text"
                  name="subcontractor"
                  className="form-input"
                  value={formData.subcontractor}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  className="form-input"
                  value={formData.status}
                  onChange={handleChange}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
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

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditing(false);
                  if (submittal) {
                    setFormData({
                      name: submittal.name || '',
                      spec_section: submittal.spec_section,
                      description: submittal.description,
                      subcontractor: submittal.subcontractor || '',
                      due_date: submittal.due_date || '',
                      status: submittal.status,
                    });
                  }
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {updateMutation.isError && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                Error updating submittal. Please try again.
              </div>
            )}
          </form>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <span className={`badge ${STATUS_BADGE[submittal.status] || 'badge-info'}`} style={{ marginBottom: '1rem', display: 'inline-block' }}>
                {statusLabel(submittal.status)}
              </span>
              {submittal.name && (
                <h2 style={{ margin: '0 0 0.25rem 0' }}>{submittal.name}</h2>
              )}
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{submittal.spec_section}</div>
              <div style={{ color: 'var(--secondary)' }}>{submittal.description}</div>
            </div>

            {submittal.review_notes && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Review Notes
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{submittal.review_notes}</div>
                {submittal.reviewed_at && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '0.5rem' }}>
                    Reviewed on {fmtDate(submittal.reviewed_at)}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Vendor/Supplier</div>
                <div>{submittal.subcontractor || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Due Date</div>
                <div>{fmtDate(submittal.due_date)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Created By</div>
                <div>{submittal.created_by_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Created</div>
                <div>{fmtDate(submittal.created_at)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Attachments</h3>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading...' : '+ Upload File'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {uploadMutation.isError && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            Upload failed. Please try again.
          </div>
        )}

        {attachments.length === 0 ? (
          <div style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>No attachments yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {attachments.map((att) => (
              <div
                key={att.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}
                >
                  {att.original_name}
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                    {(att.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.875rem', padding: 0 }}
                    onClick={() => deleteAttachmentMutation.mutate(att.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmittalDetail;
