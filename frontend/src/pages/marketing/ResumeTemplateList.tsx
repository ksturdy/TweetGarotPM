import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { resumeTemplatesApi, ResumeTemplate } from '../../services/resumeTemplates';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';

const ResumeTemplateList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast, confirm } = useTitanFeedback();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['resumeTemplates'],
    queryFn: () => resumeTemplatesApi.getAll().then(res => res.data),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => resumeTemplatesApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumeTemplates'] });
      toast.success('Default template updated');
    },
    onError: (err: any) => {
      toast.error(`Failed to update default: ${err?.response?.data?.error || err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => resumeTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumeTemplates'] });
      toast.success('Template deleted');
    },
    onError: (err: any) => {
      toast.error(`Failed to delete: ${err?.response?.data?.error || err.message}`);
    },
  });

  const handleDelete = async (tpl: ResumeTemplate) => {
    const ok = await confirm({ message: `Delete template "${tpl.name}"?`, danger: true });
    if (ok) {
      deleteMutation.mutate(tpl.id);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading resume templates...</div>;
  }

  return (
    <div className="container" style={{ maxWidth: 'min(100%, 1400px)', padding: '0 1.5rem' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link
              to="/marketing/templates"
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}
            >
              &larr; Back to Templates
            </Link>
            <h1>📑 Resume Templates</h1>
            <div className="sales-subtitle">
              {templates.length} template{templates.length === 1 ? '' : 's'} · all are 8.5&times;11 portrait, single page
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/resume-templates/create')}>
            + Create Template
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📑</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
            No resume templates yet
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Create your first template to control which sections appear on employee resumes.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/resume-templates/create')}>
            + Create Your First Template
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {templates.map(tpl => {
            const accent = tpl.layout_config?.sidebar_color || '#1e3a5f';
            return (
              <div
                key={tpl.id}
                className="card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  border: tpl.is_default ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onClick={() => navigate(`/resume-templates/${tpl.id}`)}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {/* Preview thumbnail */}
                <div
                  style={{
                    background: `linear-gradient(135deg, ${accent} 0%, ${accent} 30%, #ffffff 30%, #ffffff 100%)`,
                    height: '180px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: '6px',
                      padding: '0.5rem 0.9rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: accent,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    Two-column · 8.5&times;11
                  </div>
                  {tpl.is_default && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '0.6rem',
                        right: '0.6rem',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Default
                    </span>
                  )}
                  {!tpl.is_active && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '0.6rem',
                        left: '0.6rem',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Inactive
                    </span>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '1rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                    {tpl.name}
                  </h3>
                  {tpl.description && (
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, flex: 1 }}>
                      {tpl.description}
                    </p>
                  )}

                  {tpl.layout_config?.sections && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.3rem' }}>
                        Visible Sections
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {Object.entries(tpl.layout_config.sections)
                          .filter(([, visible]) => visible !== false)
                          .map(([key]) => (
                            <span key={key} style={chipStyle}>
                              {key}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  <div
                    style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate(`/resume-templates/${tpl.id}`)}
                      style={{ flex: 1, fontSize: '0.85rem' }}
                    >
                      Edit
                    </button>
                    {!tpl.is_default && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setDefaultMutation.mutate(tpl.id)}
                        disabled={setDefaultMutation.isPending}
                        style={{ fontSize: '0.85rem' }}
                        title="Set as default"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDelete(tpl)}
                      disabled={tpl.is_default || deleteMutation.isPending}
                      style={{ fontSize: '0.85rem' }}
                      title={tpl.is_default ? 'Cannot delete default template' : 'Delete template'}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const chipStyle: React.CSSProperties = {
  padding: '0.2rem 0.55rem',
  backgroundColor: '#f3f4f6',
  color: '#374151',
  borderRadius: '9999px',
  fontSize: '0.7rem',
  fontWeight: 600,
};

export default ResumeTemplateList;
