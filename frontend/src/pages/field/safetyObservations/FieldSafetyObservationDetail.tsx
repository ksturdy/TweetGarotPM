import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import VerifiedIcon from '@mui/icons-material/Verified';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { safetyObservationsApi, AUDIT_AREAS, ObservationAnswer } from '../../../services/safetyObservations';
import { attachmentsApi, Attachment } from '../../../services/attachments';

const AnswerBadge: React.FC<{ answer: ObservationAnswer }> = ({ answer }) => {
  if (answer === 'yes') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 8,
      background: '#d1fae5', color: '#065f46', flexShrink: 0,
    }}>
      <CheckIcon style={{ fontSize: 16 }} />
    </span>
  );
  if (answer === 'no') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 8,
      background: '#fee2e2', color: '#991b1b', flexShrink: 0,
    }}>
      <CloseIcon style={{ fontSize: 16 }} />
    </span>
  );
  if (answer === 'na') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 8,
      background: '#f3f4f6', color: '#6b7280', flexShrink: 0,
    }}>
      <RemoveIcon style={{ fontSize: 16 }} />
    </span>
  );
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 8,
      background: '#fef9c3', color: '#854d0e', fontSize: 10, fontWeight: 700, flexShrink: 0,
    }}>
      ?
    </span>
  );
};

// ── Inline photo strip shown below each section ───────────────────────────────
export const SectionPhotoStrip: React.FC<{ photos: Attachment[] }> = ({ photos }) => {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <div style={{ padding: '8px 0 4px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {photos.map(photo => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightbox(photo.url)}
            style={{
              padding: 0, border: '1.5px solid #e5e7eb', borderRadius: 10,
              cursor: 'pointer', background: 'none', overflow: 'hidden', flexShrink: 0,
            }}
          >
            <img
              src={photo.url}
              alt={photo.original_name}
              style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }}
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <>
          <div
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, cursor: 'pointer' }}
          />
          <div style={{
            position: 'fixed', inset: 0, zIndex: 2001,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, pointerEvents: 'none',
          }}>
            <img
              src={lightbox}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', pointerEvents: 'none' }}
            />
          </div>
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', top: 16, right: 16, zIndex: 2002,
              width: 40, height: 40, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.15)', color: 'white',
              fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </>
      )}
    </>
  );
};

const FieldSafetyObservationDetail: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: obs, isLoading } = useQuery({
    queryKey: ['safety-observation', id],
    queryFn: () => safetyObservationsApi.getById(Number(id)).then(r => r.data),
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['safety-observation-photos', id],
    queryFn: () => attachmentsApi.getByEntity('safety_observation', Number(id)).then(r => r.data),
    enabled: !!id,
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

  const reviewMutation = useMutation({
    mutationFn: () => safetyObservationsApi.review(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-observation', id] });
      queryClient.invalidateQueries({ queryKey: ['field-safety-observations', projectId] });
      queryClient.invalidateQueries({ queryKey: ['safety-obs-stats'] });
    },
  });

  if (isLoading) return <div className="field-loading">Loading...</div>;
  if (!obs) return <div className="field-loading">Observation not found.</div>;

  const formatDate = (d: string) =>
    new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const totalYes = obs.sections?.reduce((acc, s) => acc + s.items.filter(i => i.answer === 'yes').length, 0) ?? 0;
  const totalNo  = obs.sections?.reduce((acc, s) => acc + s.items.filter(i => i.answer === 'no').length, 0) ?? 0;
  const totalNa  = obs.sections?.reduce((acc, s) => acc + s.items.filter(i => i.answer === 'na').length, 0) ?? 0;
  const totalItems = obs.sections?.reduce((acc, s) => acc + s.items.length, 0) ?? 0;

  return (
    <div>
      <h1 className="field-page-title">OBS-{obs.number}</h1>

      {/* Header card */}
      <div style={{
        padding: '16px', borderRadius: 14, marginBottom: 14,
        background: 'linear-gradient(135deg, #002356, #004080)',
        color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
              Safety Observation
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {(obs.sections ?? [])
                .map(s => AUDIT_AREAS.find(a => a.key === s.area)?.label)
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.5px',
            background: obs.status === 'reviewed' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)',
            color: 'white',
          }}>
            {obs.status}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 13, opacity: 0.9 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <CalendarTodayIcon style={{ fontSize: 14 }} />
            {formatDate(obs.date_of_observation)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PersonIcon style={{ fontSize: 14 }} />
            {obs.observer_name}
          </span>
        </div>
      </div>

      {/* Score summary */}
      <div className="field-form-section">
        <div className="field-form-section-title">Score Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { label: 'Total', val: totalItems, bg: '#f3f4f6', color: '#374151' },
            { label: 'Yes', val: totalYes, bg: '#d1fae5', color: '#065f46' },
            { label: 'No', val: totalNo, bg: '#fee2e2', color: '#991b1b' },
            { label: 'N/A', val: totalNa, bg: '#f3f4f6', color: '#6b7280' },
          ].map(s => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '12px 8px', borderRadius: 10,
              background: s.bg,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: s.color, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-section audit results */}
      {(obs.sections ?? []).map(section => {
        const areaDef = AUDIT_AREAS.find(a => a.key === section.area);
        if (!areaDef) return null;
        const nos = section.items.filter(i => i.answer === 'no').length;
        const sectionPhotos = photosBySection[section.area] || [];

        return (
          <div key={section.area} className="field-form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="field-form-section-title" style={{ margin: 0 }}>{areaDef.label}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {sectionPhotos.length > 0 && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#ede9fe', color: '#6d28d9', fontWeight: 700 }}>
                    {sectionPhotos.length} 📷
                  </span>
                )}
                {nos > 0 && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
                    {nos} issue{nos > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {section.items.map((item, idx) => (
                <div key={item.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0',
                  borderBottom: idx < section.items.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: item.answer === 'no' ? '#fff5f5' : 'transparent',
                  borderRadius: item.answer === 'no' ? 8 : 0,
                  paddingLeft: item.answer === 'no' ? 8 : 0,
                  marginLeft: item.answer === 'no' ? -8 : 0,
                  marginRight: item.answer === 'no' ? -8 : 0,
                }}>
                  <AnswerBadge answer={item.answer} />
                  <span style={{ flex: 1, fontSize: 13, color: item.answer === 'no' ? '#991b1b' : '#374151', lineHeight: 1.4, fontWeight: item.answer === 'no' ? 600 : 400 }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Section photos */}
            {sectionPhotos.length > 0 && (
              <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                  Photos
                </div>
                <SectionPhotoStrip photos={sectionPhotos} />
              </div>
            )}

            {section.comments && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: '#f9fafb', border: '1px solid #e5e7eb',
                fontSize: 13, color: '#374151', lineHeight: 1.5,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                  Comments
                </div>
                {section.comments}
              </div>
            )}
          </div>
        );
      })}

      {/* Global questions */}
      <div className="field-form-section">
        <div className="field-form-section-title">Global Questions</div>

        <div className="field-detail-row">
          <span className="field-detail-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <DirectionsRunIcon style={{ fontSize: 16 }} />
            Stretch &amp; Flex Today
          </span>
          <span className="field-detail-value" style={{
            color: obs.stretch_and_flex === true ? '#065f46' : obs.stretch_and_flex === false ? '#991b1b' : '#9ca3af',
            fontWeight: 700,
          }}>
            {obs.stretch_and_flex === true ? 'Yes' : obs.stretch_and_flex === false ? 'No' : '—'}
          </span>
        </div>

        {obs.feedback_notes && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChatBubbleOutlineIcon style={{ fontSize: 14 }} />
              Feedback / Notes
            </div>
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: '#f9fafb', border: '1px solid #e5e7eb',
              fontSize: 13, color: '#374151', lineHeight: 1.5,
            }}>
              {obs.feedback_notes}
            </div>
          </div>
        )}
      </div>

      {/* Review metadata */}
      {obs.status === 'reviewed' && (
        <div className="field-form-section" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="field-form-section-title">Reviewed</div>
          <div className="field-detail-row">
            <span className="field-detail-label">Reviewed By</span>
            <span className="field-detail-value">{obs.reviewed_by_name}</span>
          </div>
          {obs.reviewed_at && (
            <div className="field-detail-row">
              <span className="field-detail-label">Reviewed At</span>
              <span className="field-detail-value">
                {new Date(obs.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mark as reviewed button */}
      <div className="field-actions-bar">
        <button
          className="field-btn field-btn-secondary"
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          style={{ opacity: pdfLoading ? 0.6 : 1 }}
        >
          <PictureAsPdfIcon style={{ fontSize: 18 }} />
          {pdfLoading ? 'Generating...' : 'Download PDF'}
        </button>

        {obs.status === 'submitted' && (
          <button
            className="field-btn field-btn-success"
            type="button"
            onClick={() => reviewMutation.mutate()}
            disabled={reviewMutation.isPending}
            style={{ opacity: reviewMutation.isPending ? 0.6 : 1 }}
          >
            <VerifiedIcon style={{ fontSize: 18 }} />
            {reviewMutation.isPending ? 'Marking...' : 'Mark as Reviewed'}
          </button>
        )}
      </div>
    </div>
  );
};

export default FieldSafetyObservationDetail;
