import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveIcon from '@mui/icons-material/Remove';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VerifiedIcon from '@mui/icons-material/Verified';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  safetyObservationsApi,
  AUDIT_AREAS,
  SafetyObservation,
  ObservationAnswer,
} from '../../services/safetyObservations';
import { safetyJsaApi } from '../../services/safetyJsa';
import { projectsApi } from '../../services/projects';
import { attachmentsApi, Attachment } from '../../services/attachments';
import { SectionPhotoStrip } from '../field/safetyObservations/FieldSafetyObservationDetail';
import '../../styles/SalesPipeline.css';

type Tab = 'observations' | 'jsas';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  submitted: { bg: '#dbeafe', color: '#1d4ed8' },
  reviewed:  { bg: '#d1fae5', color: '#065f46' },
  draft:     { bg: '#f3f4f6', color: '#6b7280' },
  active:    { bg: '#d1fae5', color: '#065f46' },
  completed: { bg: '#d1fae5', color: '#065f46' },
};

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateLong(d: string) {
  if (!d) return '—';
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function countNos(obs: SafetyObservation) {
  return (obs.sections ?? []).reduce(
    (acc, s) => acc + s.items.filter(i => i.answer === 'no').length, 0
  );
}

function getAreaLabels(obs: SafetyObservation) {
  return (obs.sections ?? []).map(s => AUDIT_AREAS.find(a => a.key === s.area)?.label ?? s.area);
}

const AnswerPill: React.FC<{ answer: ObservationAnswer }> = ({ answer }) => {
  const styles: Record<string, React.CSSProperties> = {
    yes: { background: '#d1fae5', color: '#065f46' },
    no:  { background: '#fee2e2', color: '#991b1b' },
    na:  { background: '#f3f4f6', color: '#6b7280' },
  };
  const icons: Record<string, React.ReactNode> = {
    yes: <CheckIcon style={{ fontSize: 13 }} />,
    no:  <CloseRoundedIcon style={{ fontSize: 13 }} />,
    na:  <RemoveIcon style={{ fontSize: 13 }} />,
  };
  if (!answer) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
      ...styles[answer],
    }}>
      {icons[answer]}{answer.toUpperCase()}
    </span>
  );
};

// ── Observation Detail Drawer ─────────────────────────────────────────────────

const ObsDrawer: React.FC<{
  obsId: number;
  projectId: string;
  onClose: () => void;
}> = ({ obsId, projectId, onClose }) => {
  const queryClient = useQueryClient();
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: obs, isLoading } = useQuery({
    queryKey: ['safety-observation', obsId],
    queryFn: () => safetyObservationsApi.getById(obsId).then(r => r.data),
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['safety-observation-photos', obsId],
    queryFn: () => attachmentsApi.getByEntity('safety_observation', obsId).then(r => r.data),
  });

  const photosBySection = React.useMemo(() => {
    const map: Record<string, Attachment[]> = {};
    for (const att of attachments) {
      if (att.section_area) {
        map[att.section_area] = [...(map[att.section_area] || []), att];
      }
    }
    return map;
  }, [attachments]);

  const reviewMutation = useMutation({
    mutationFn: () => safetyObservationsApi.review(obsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-observation', obsId] });
      queryClient.invalidateQueries({ queryKey: ['safety-observations-project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['safety-obs-stats'] });
    },
  });

  const handleDownloadPdf = async () => {
    if (!obs) return;
    setPdfLoading(true);
    try {
      const blob = await safetyObservationsApi.downloadPdf(obs.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Safety-Observation-${obs.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  const totalYes   = obs?.sections?.reduce((a, s) => a + s.items.filter(i => i.answer === 'yes').length, 0) ?? 0;
  const totalNo    = obs?.sections?.reduce((a, s) => a + s.items.filter(i => i.answer === 'no').length, 0) ?? 0;
  const totalNa    = obs?.sections?.reduce((a, s) => a + s.items.filter(i => i.answer === 'na').length, 0) ?? 0;
  const totalItems = obs?.sections?.reduce((a, s) => a + s.items.length, 0) ?? 0;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 1000, backdropFilter: 'blur(1px)',
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 620,
        background: 'white', zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
        overflowY: 'auto',
      }}>
        {/* Drawer header */}
        <div style={{
          padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #002356, #004080)', color: 'white', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>Safety Observation</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>OBS-{obs?.number ?? '…'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {obs && (
              <span style={{
                padding: '3px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                textTransform: 'capitalize', background: 'rgba(255,255,255,0.15)', color: 'white',
              }}>
                {obs.status}
              </span>
            )}
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <CloseIcon style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
        ) : !obs ? null : (
          <div style={{ padding: '20px', flex: 1 }}>

            {/* Meta row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0,
              border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 16,
            }}>
              {[
                { label: 'Observer', value: obs.observer_name },
                { label: 'Date', value: formatDateLong(obs.date_of_observation) },
                { label: 'Stretch & Flex', value: obs.stretch_and_flex === true ? 'Yes ✓' : obs.stretch_and_flex === false ? 'No ✗' : '—', color: obs.stretch_and_flex === true ? '#065f46' : obs.stretch_and_flex === false ? '#991b1b' : '#9ca3af' },
              ].map((m, i) => (
                <div key={m.label} style={{ padding: '10px 14px', borderRight: i < 2 ? '1px solid #e5e7eb' : 'none', background: '#f9fafb' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: (m as any).color ?? '#111827' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Score summary */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0,
              border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 20,
            }}>
              {[
                { label: 'Total', val: totalItems, bg: '#f9fafb', color: '#374151' },
                { label: 'Yes', val: totalYes, bg: '#f0fdf4', color: '#065f46' },
                { label: 'No', val: totalNo, bg: '#fff5f5', color: '#991b1b' },
                { label: 'N/A', val: totalNa, bg: '#f9fafb', color: '#6b7280' },
              ].map((s, i) => (
                <div key={s.label} style={{ textAlign: 'center', padding: '12px 6px', background: s.bg, borderRight: i < 3 ? '1px solid #e5e7eb' : 'none' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: s.color, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Sections */}
            {(obs.sections ?? []).map(section => {
              const areaDef = AUDIT_AREAS.find(a => a.key === section.area);
              if (!areaDef) return null;
              const nos = section.items.filter(i => i.answer === 'no').length;
              const sectionPhotos = photosBySection[section.area] || [];
              return (
                <div key={section.area} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 14px', background: '#002356', color: 'white',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{areaDef.label}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {sectionPhotos.length > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.4)', fontWeight: 700 }}>
                          {sectionPhotos.length} 📷
                        </span>
                      )}
                      {nos > 0
                        ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.3)', fontWeight: 700 }}>{nos} issue{nos > 1 ? 's' : ''}</span>
                        : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.3)', fontWeight: 700 }}>✓ Clean</span>}
                    </div>
                  </div>
                  {section.items.map((item, idx) => (
                    <div key={item.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px',
                      borderBottom: idx < section.items.length - 1 ? '1px solid #f3f4f6' : 'none',
                      background: item.answer === 'no' ? '#fff5f5' : 'white',
                    }}>
                      <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, width: 18, flexShrink: 0 }}>{idx + 1}.</span>
                      <span style={{ flex: 1, fontSize: 12, color: item.answer === 'no' ? '#991b1b' : '#374151', fontWeight: item.answer === 'no' ? 600 : 400, lineHeight: 1.4 }}>{item.label}</span>
                      <AnswerPill answer={item.answer} />
                    </div>
                  ))}
                  {sectionPhotos.length > 0 && (
                    <div style={{ padding: '8px 14px', borderTop: '1px solid #f3f4f6', background: 'white' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Photos</div>
                      <SectionPhotoStrip photos={sectionPhotos} />
                    </div>
                  )}
                  {section.comments && (
                    <div style={{ padding: '8px 14px', background: '#f9fafb', fontSize: 12, color: '#374151', borderTop: '1px solid #e5e7eb' }}>
                      <span style={{ fontWeight: 700, color: '#6b7280' }}>Comments: </span>{section.comments}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Feedback notes */}
            {obs.feedback_notes && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ padding: '9px 14px', background: '#374151', color: 'white', fontSize: 12, fontWeight: 700 }}>Feedback &amp; Notes</div>
                <div style={{ padding: '12px 14px', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{obs.feedback_notes}</div>
              </div>
            )}

            {/* Reviewed info */}
            {obs.status === 'reviewed' && obs.reviewed_by_name && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#065f46', marginBottom: 14 }}>
                <VerifiedIcon style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 6 }} />
                Reviewed by <strong>{obs.reviewed_by_name}</strong>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                  borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
                  opacity: pdfLoading ? 0.6 : 1,
                }}
              >
                <PictureAsPdfIcon style={{ fontSize: 16 }} />
                {pdfLoading ? 'Generating…' : 'Download PDF'}
              </button>

              {obs.status === 'submitted' && (
                <button
                  onClick={() => reviewMutation.mutate()}
                  disabled={reviewMutation.isPending}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                    borderRadius: 8, border: 'none', background: '#10b981',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'white',
                    opacity: reviewMutation.isPending ? 0.6 : 1,
                  }}
                >
                  <VerifiedIcon style={{ fontSize: 16 }} />
                  {reviewMutation.isPending ? 'Marking…' : 'Mark as Reviewed'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const ProjectSafety: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('observations');
  const [obsStatusFilter, setObsStatusFilter] = useState('');
  const [jsaStatusFilter, setJsaStatusFilter] = useState('');
  const [selectedObsId, setSelectedObsId] = useState<number | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
  });

  const { data: observations = [], isLoading: obsLoading } = useQuery({
    queryKey: ['safety-observations-project', projectId],
    queryFn: () => safetyObservationsApi.getByProject(Number(projectId)).then(r => r.data),
  });

  const { data: jsas = [], isLoading: jsaLoading } = useQuery({
    queryKey: ['safety-jsas-project', projectId],
    queryFn: () => safetyJsaApi.getByProject(Number(projectId)).then(r => r.data),
  });

  const totalObs    = observations.length;
  const openObs     = observations.filter(o => o.status === 'submitted').length;
  const totalIssues = observations.reduce((acc, o) => acc + countNos(o), 0);
  const sfYes       = observations.filter(o => o.stretch_and_flex === true).length;
  const sfRate      = totalObs > 0 ? Math.round((sfYes / totalObs) * 100) : 0;

  const filteredObs  = obsStatusFilter ? observations.filter(o => o.status === obsStatusFilter) : observations;
  const filteredJsas = jsaStatusFilter ? jsas.filter(j => j.status === jsaStatusFilter) : jsas;

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>

      {/* Observation detail drawer */}
      {selectedObsId !== null && (
        <ObsDrawer
          obsId={selectedObsId}
          projectId={projectId!}
          onClose={() => setSelectedObsId(null)}
        />
      )}

      {/* Page header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link
              to={`/projects/${projectId}/info`}
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}
            >
              &larr; {project?.name || 'Project'}
            </Link>
            <h1>🦺 Safety</h1>
            <div className="sales-subtitle">Safety observations and job safety analyses</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/field/projects/${projectId}/safety-jsa/new`)}
          >
            + New JSA
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/field/projects/${projectId}/safety-observations/new`)}
          >
            + New Observation
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Observations', value: totalObs,       accent: '#1a56db', bg: '#eff6ff', icon: '📋' },
          { label: 'Awaiting Review',    value: openObs,        accent: '#f59e0b', bg: '#fffbeb', icon: '⏳' },
          { label: 'Issues Found (No)',  value: totalIssues,    accent: totalIssues > 0 ? '#dc2626' : '#10b981', bg: totalIssues > 0 ? '#fff5f5' : '#f0fdf4', icon: totalIssues > 0 ? '⚠️' : '✅' },
          { label: 'Stretch & Flex Rate', value: `${sfRate}%`, accent: sfRate >= 80 ? '#10b981' : '#f59e0b', bg: sfRate >= 80 ? '#f0fdf4' : '#fffbeb', icon: '🏃' },
        ].map(stat => (
          <div key={stat.label} style={{ background: stat.bg, borderRadius: 12, padding: '1.25rem 1.5rem', border: `1px solid ${stat.accent}22` }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.accent, lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
        {(['observations', 'jsas'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', background: 'none',
            fontSize: '0.9rem', fontWeight: 600,
            color: tab === t ? '#002356' : '#6b7280',
            borderBottom: tab === t ? '3px solid #002356' : '3px solid transparent',
            marginBottom: -2, transition: 'all 0.15s',
          }}>
            {t === 'observations' ? `Safety Observations (${observations.length})` : `JSAs (${jsas.length})`}
          </button>
        ))}
      </div>

      {/* ── Observations tab ──────────────────────────────────────────────────── */}
      {tab === 'observations' && (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
            {['', 'submitted', 'reviewed'].map(s => (
              <button key={s} onClick={() => setObsStatusFilter(s)} style={{
                padding: '5px 16px', borderRadius: 20, border: '1.5px solid',
                borderColor: obsStatusFilter === s ? '#002356' : '#e5e7eb',
                background: obsStatusFilter === s ? '#002356' : 'white',
                color: obsStatusFilter === s ? 'white' : '#6b7280',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              }}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="sales-table-section">
            {obsLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Observer</th>
                    <th>Areas Audited</th>
                    <th>Issues</th>
                    <th>S&amp;F</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredObs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
                        No observations yet —{' '}
                        <button style={{ color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                          onClick={() => navigate(`/field/projects/${projectId}/safety-observations/new`)}>
                          submit one now
                        </button>
                      </td>
                    </tr>
                  ) : filteredObs.map(obs => {
                    const nos = countNos(obs);
                    const areaLabels = getAreaLabels(obs);
                    const sc = STATUS_COLORS[obs.status] ?? { bg: '#f3f4f6', color: '#6b7280' };
                    return (
                      <tr key={obs.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedObsId(obs.id)}>
                        <td><span style={{ color: '#1a56db', fontWeight: 700 }}>OBS-{obs.number}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(obs.date_of_observation)}</td>
                        <td>{obs.observer_name}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {areaLabels.slice(0, 3).map(label => (
                              <span key={label} style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 10, background: '#eff6ff', color: '#1a56db', fontWeight: 600 }}>
                                {label}
                              </span>
                            ))}
                            {areaLabels.length > 3 && <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 500 }}>+{areaLabels.length - 3} more</span>}
                          </div>
                        </td>
                        <td>
                          {nos > 0
                            ? <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>⚠ {nos}</span>
                            : <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>✓ Clean</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {obs.stretch_and_flex === true  && <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>}
                          {obs.stretch_and_flex === false && <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>}
                          {obs.stretch_and_flex === null  && <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                        <td>
                          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
                            {obs.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── JSAs tab ──────────────────────────────────────────────────────────── */}
      {tab === 'jsas' && (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
            {['', 'draft', 'active', 'completed'].map(s => (
              <button key={s} onClick={() => setJsaStatusFilter(s)} style={{
                padding: '5px 16px', borderRadius: 20, border: '1.5px solid',
                borderColor: jsaStatusFilter === s ? '#002356' : '#e5e7eb',
                background: jsaStatusFilter === s ? '#002356' : 'white',
                color: jsaStatusFilter === s ? 'white' : '#6b7280',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              }}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="sales-table-section">
            {jsaLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Task Description</th>
                    <th>Location</th>
                    <th>Filled Out By</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJsas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
                        No JSAs yet —{' '}
                        <button style={{ color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                          onClick={() => navigate(`/field/projects/${projectId}/safety-jsa/new`)}>
                          create one now
                        </button>
                      </td>
                    </tr>
                  ) : filteredJsas.map(jsa => {
                    const sc = STATUS_COLORS[jsa.status] ?? { bg: '#f3f4f6', color: '#6b7280' };
                    return (
                      <tr key={jsa.id}>
                        <td><span style={{ color: '#1a56db', fontWeight: 700 }}>JSA-{jsa.number}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(jsa.date_of_work)}</td>
                        <td style={{ fontWeight: 500, maxWidth: 300 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {jsa.task_description}
                          </span>
                        </td>
                        <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{jsa.work_location || '—'}</td>
                        <td style={{ fontSize: '0.875rem' }}>{jsa.filled_out_by || jsa.created_by_name}</td>
                        <td>
                          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
                            {jsa.status}
                          </span>
                        </td>
                        <td>
                          <button
                            title="Open in Field module"
                            onClick={() => navigate(`/field/projects/${projectId}/safety-jsa/${jsa.id}`)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, display: 'flex', alignItems: 'center' }}
                          >
                            <OpenInNewIcon style={{ fontSize: 16 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectSafety;
