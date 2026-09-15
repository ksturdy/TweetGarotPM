import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import { useAuth } from '../../../context/AuthContext';
import {
  safetyObservationsApi,
  AUDIT_AREAS,
  buildBlankSection,
  ObservationSection,
  ObservationAnswer,
} from '../../../services/safetyObservations';
import { attachmentsApi } from '../../../services/attachments';

// ── Wizard steps ──────────────────────────────────────────────────────────────
// Step 0: area selection
// Steps 1..N: one per selected audit area
// Last step: global questions + submit
// ─────────────────────────────────────────────────────────────────────────────

const FieldSafetyObservationWizard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Step 0 state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Section answers: keyed by area key
  const [sections, setSections] = useState<Record<string, ObservationSection>>({});

  // Section photos: keyed by area key → list of File objects
  const [sectionPhotos, setSectionPhotos] = useState<Record<string, File[]>>({});

  // Final page
  const [stretchAndFlex, setStretchAndFlex] = useState<boolean | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  // Wizard state
  const [step, setStep] = useState(0); // 0 = area select, 1..N = audit sections, last = final
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Derived step list: ['select', ...selectedAreas, 'final']
  const stepList = ['select', ...selectedAreas, 'final'];
  const totalSteps = stepList.length;
  const currentStepKey = stepList[step];
  const isFirstStep = step === 0;
  const isFinalStep = currentStepKey === 'final';
  const progressPct = Math.round((step / (totalSteps - 1)) * 100);

  // When an area is toggled, initialise its section if not already present
  const toggleArea = (areaKey: string) => {
    setSelectedAreas(prev => {
      if (prev.includes(areaKey)) {
        return prev.filter(k => k !== areaKey);
      }
      const next = [...prev, areaKey];
      setSections(s => ({ ...s, [areaKey]: s[areaKey] || buildBlankSection(areaKey) }));
      return next;
    });
  };

  const setAnswer = (areaKey: string, itemKey: string, answer: ObservationAnswer) => {
    setSections(prev => ({
      ...prev,
      [areaKey]: {
        ...prev[areaKey],
        items: prev[areaKey].items.map(it =>
          it.key === itemKey ? { ...it, answer } : it
        ),
      },
    }));
  };

  const setComments = (areaKey: string, val: string) => {
    setSections(prev => ({
      ...prev,
      [areaKey]: { ...prev[areaKey], comments: val },
    }));
  };

  const addPhotos = useCallback((areaKey: string, files: File[]) => {
    setSectionPhotos(prev => ({
      ...prev,
      [areaKey]: [...(prev[areaKey] || []), ...files],
    }));
  }, []);

  const removePhoto = useCallback((areaKey: string, index: number) => {
    setSectionPhotos(prev => {
      const updated = [...(prev[areaKey] || [])];
      updated.splice(index, 1);
      return { ...prev, [areaKey]: updated };
    });
  }, []);

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const canProceedFromSelect = selectedAreas.length > 0 && date !== '';

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data: obs } = await safetyObservationsApi.create({
        project_id: Number(projectId),
        date_of_observation: date,
        sections: selectedAreas.map(k => sections[k]),
        stretch_and_flex: stretchAndFlex,
        feedback_notes: feedbackNotes,
        status: 'submitted',
      });

      // Upload section photos in parallel
      const uploads = Object.entries(sectionPhotos).flatMap(([areaKey, files]) =>
        files.map(file => attachmentsApi.uploadWithSection('safety_observation', obs.id, file, areaKey))
      );
      await Promise.all(uploads);

      queryClient.invalidateQueries({ queryKey: ['field-safety-observations', projectId] });
      queryClient.invalidateQueries({ queryKey: ['safety-obs-stats'] });
      queryClient.invalidateQueries({ queryKey: ['safety-observations-project', projectId] });
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit observation', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 16, textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
        }}>
          <CheckCircleIcon style={{ fontSize: 48, color: 'white' }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', margin: 0 }}>Observation Submitted!</h2>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0, maxWidth: 320 }}>
          Your safety observation has been recorded. Great job keeping the site safe!
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="field-btn field-btn-primary"
            style={{ width: 'auto', minWidth: 180 }}
            onClick={() => {
              setSubmitted(false);
              setStep(0);
              setSelectedAreas([]);
              setSections({});
              setSectionPhotos({});
              setDate(new Date().toISOString().split('T')[0]);
              setStretchAndFlex(null);
              setFeedbackNotes('');
            }}
          >
            New Observation
          </button>
          <button
            className="field-btn field-btn-secondary"
            style={{ width: 'auto', minWidth: 180 }}
            onClick={() => navigate(`/field/projects/${projectId}/safety-observations`)}
          >
            View All
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress bar + step label */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="field-page-subtitle" style={{ margin: 0 }}>
            {isFinalStep
              ? 'Final Questions'
              : currentStepKey === 'select'
              ? 'Select Audit Areas'
              : AUDIT_AREAS.find(a => a.key === currentStepKey)?.label}
          </span>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
            {step + 1} / {totalSteps}
          </span>
        </div>
        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: isFinalStep
                ? 'linear-gradient(90deg, #10b981, #059669)'
                : 'linear-gradient(90deg, #1a56db, #3b82f6)',
              borderRadius: 10,
              transition: 'width 0.35s ease',
            }}
          />
        </div>
      </div>

      {/* ── Step 0: Area Selection ──────────────────────────────────────────── */}
      {currentStepKey === 'select' && (
        <div>
          {/* Auto-filled header info */}
          <div className="field-form-section" style={{ borderLeft: '4px solid #1a56db' }}>
            <div className="field-form-section-title">Observation Details</div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14,
              background: '#f0f4ff', borderRadius: 10, padding: '10px 14px',
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Foreman / Observer</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginTop: 2 }}>
                  {user?.firstName} {user?.lastName}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Role</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginTop: 2, textTransform: 'capitalize' }}>
                  {user?.role}
                </div>
              </div>
            </div>

            <div className="field-form-group">
              <label className="field-form-label">Date of Observation *</label>
              <input
                type="date"
                className="field-form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Audit area picker */}
          <div className="field-form-section">
            <div className="field-form-section-title">What are you auditing today?</div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, marginTop: -4 }}>
              Select one or more areas. You can add more during the audit.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AUDIT_AREAS.map(area => {
                const selected = selectedAreas.includes(area.key);
                return (
                  <button
                    key={area.key}
                    type="button"
                    onClick={() => toggleArea(area.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 16px', borderRadius: 12,
                      border: selected ? '2px solid #1a56db' : '2px solid #e5e7eb',
                      background: selected ? '#eff6ff' : 'white',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.18s ease',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: selected ? '#1a56db' : '#f3f4f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.18s ease',
                    }}>
                      {selected && <CheckIcon style={{ fontSize: 16, color: 'white' }} />}
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: selected ? 700 : 500,
                      color: selected ? '#1a56db' : '#374151',
                      transition: 'color 0.18s ease',
                    }}>
                      {area.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedAreas.length > 0 && (
              <div style={{
                marginTop: 14, padding: '8px 12px', borderRadius: 8,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                fontSize: 13, color: '#15803d', fontWeight: 500,
              }}>
                {selectedAreas.length} area{selectedAreas.length > 1 ? 's' : ''} selected — ready to audit
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Steps 1..N: Audit Sections ─────────────────────────────────────── */}
      {!isFinalStep && currentStepKey !== 'select' && (() => {
        const areaDef = AUDIT_AREAS.find(a => a.key === currentStepKey)!;
        const section = sections[currentStepKey];
        if (!section || !areaDef) return null;

        const answeredCount = section.items.filter(i => i.answer !== null).length;
        const photos = sectionPhotos[currentStepKey] || [];

        return (
          <div>
            {/* Section header */}
            <div style={{
              padding: '14px 16px', borderRadius: 12, marginBottom: 14,
              background: 'linear-gradient(135deg, #002356, #004080)',
              color: 'white',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', opacity: 0.75, textTransform: 'uppercase', marginBottom: 4 }}>
                Auditing
              </div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{areaDef.label}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 12, padding: '2px 10px', borderRadius: 20,
                  background: answeredCount === section.items.length ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.15)',
                  color: 'white',
                }}>
                  {answeredCount} / {section.items.length} answered
                </span>
                {photos.length > 0 && (
                  <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.3)', color: 'white' }}>
                    {photos.length} photo{photos.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Checklist items */}
            <div className="field-form-section">
              <div className="field-form-section-title">Audit Checklist</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map((item, idx) => (
                  <AuditItemRow
                    key={item.key}
                    label={item.label}
                    answer={item.answer}
                    index={idx}
                    onAnswer={ans => setAnswer(currentStepKey, item.key, ans)}
                  />
                ))}
              </div>
            </div>

            {/* Quick-answer all buttons */}
            <div className="field-form-section" style={{ padding: '12px 16px' }}>
              <div className="field-form-section-title" style={{ marginBottom: 8 }}>Quick Answer</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="field-btn field-btn-sm"
                  style={{ background: '#d1fae5', color: '#065f46', border: 'none', flex: 1 }}
                  onClick={() => {
                    setSections(prev => ({
                      ...prev,
                      [currentStepKey]: {
                        ...prev[currentStepKey],
                        items: prev[currentStepKey].items.map(it => ({ ...it, answer: 'yes' })),
                      },
                    }));
                  }}>
                  All Yes
                </button>
                <button type="button" className="field-btn field-btn-sm"
                  style={{ background: '#f3f4f6', color: '#374151', border: 'none', flex: 1 }}
                  onClick={() => {
                    setSections(prev => ({
                      ...prev,
                      [currentStepKey]: {
                        ...prev[currentStepKey],
                        items: prev[currentStepKey].items.map(it => ({ ...it, answer: 'na' })),
                      },
                    }));
                  }}>
                  All N/A
                </button>
                <button type="button" className="field-btn field-btn-sm"
                  style={{ background: '#fef3c7', color: '#92400e', border: 'none', flex: 1 }}
                  onClick={() => {
                    setSections(prev => ({
                      ...prev,
                      [currentStepKey]: {
                        ...prev[currentStepKey],
                        items: prev[currentStepKey].items.map(it => ({ ...it, answer: null })),
                      },
                    }));
                  }}>
                  Clear
                </button>
              </div>
            </div>

            {/* Photos */}
            <SectionPhotoUpload
              areaKey={currentStepKey}
              photos={photos}
              onAdd={addPhotos}
              onRemove={removePhoto}
            />

            {/* Comments */}
            <div className="field-form-section">
              <div className="field-form-section-title">{areaDef.commentsLabel}</div>
              <div className="field-form-group">
                <textarea
                  className="field-form-textarea"
                  value={section.comments}
                  onChange={e => setComments(currentStepKey, e.target.value)}
                  placeholder="Additional comments or observations..."
                  rows={3}
                />
              </div>
            </div>

            {/* Add more areas inline */}
            <div className="field-form-section">
              <div className="field-form-section-title">Add More Areas to Audit?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AUDIT_AREAS.filter(a => a.key !== currentStepKey).map(area => {
                  const alreadyAdded = selectedAreas.includes(area.key);
                  return (
                    <button
                      key={area.key}
                      type="button"
                      onClick={() => !alreadyAdded && toggleArea(area.key)}
                      style={{
                        padding: '7px 14px', borderRadius: 20,
                        border: alreadyAdded ? '1.5px solid #1a56db' : '1.5px solid #e5e7eb',
                        background: alreadyAdded ? '#eff6ff' : 'white',
                        fontSize: 12, fontWeight: 600,
                        color: alreadyAdded ? '#1a56db' : '#6b7280',
                        cursor: alreadyAdded ? 'default' : 'pointer',
                        opacity: alreadyAdded ? 1 : 0.85,
                      }}
                    >
                      {alreadyAdded ? '✓ ' : '+ '}{area.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Final Step ─────────────────────────────────────────────────────── */}
      {isFinalStep && (
        <div>
          {/* Summary of all audited areas */}
          <div className="field-form-section" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="field-form-section-title">Audit Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedAreas.map(areaKey => {
                const areaDef = AUDIT_AREAS.find(a => a.key === areaKey)!;
                const section = sections[areaKey];
                const yes = section.items.filter(i => i.answer === 'yes').length;
                const no = section.items.filter(i => i.answer === 'no').length;
                const na = section.items.filter(i => i.answer === 'na').length;
                const answered = yes + no + na;
                const photoCount = (sectionPhotos[areaKey] || []).length;
                return (
                  <div key={areaKey} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderRadius: 10, background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                      {areaDef.label}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {yes > 0 && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#065f46', fontWeight: 600 }}>{yes}Y</span>}
                      {no > 0  && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>{no}N</span>}
                      {na > 0  && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280', fontWeight: 600 }}>{na}N/A</span>}
                      {answered < section.items.length && (
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                          {section.items.length - answered} pending
                        </span>
                      )}
                      {photoCount > 0 && (
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}>
                          {photoCount} 📷
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stretch & Flex */}
          <div className="field-form-section">
            <div className="field-form-section-title">Did this jobsite participate in Stretch &amp; Flex today?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setStretchAndFlex(true)}
                style={{
                  flex: 1, height: 52, borderRadius: 12, fontWeight: 700, fontSize: 15,
                  border: stretchAndFlex === true ? '2px solid #10b981' : '2px solid #e5e7eb',
                  background: stretchAndFlex === true ? '#d1fae5' : 'white',
                  color: stretchAndFlex === true ? '#065f46' : '#374151',
                  cursor: 'pointer', transition: 'all 0.18s ease',
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setStretchAndFlex(false)}
                style={{
                  flex: 1, height: 52, borderRadius: 12, fontWeight: 700, fontSize: 15,
                  border: stretchAndFlex === false ? '2px solid #ef4444' : '2px solid #e5e7eb',
                  background: stretchAndFlex === false ? '#fee2e2' : 'white',
                  color: stretchAndFlex === false ? '#991b1b' : '#374151',
                  cursor: 'pointer', transition: 'all 0.18s ease',
                }}
              >
                No
              </button>
            </div>
          </div>

          {/* Feedback notes */}
          <div className="field-form-section">
            <div className="field-form-section-title">Feedback &amp; Notes for Safety Department</div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10, marginTop: -4 }}>
              Who did you speak to with positive reinforcement or improvement items? Any issues to share?
            </p>
            <div className="field-form-group">
              <textarea
                className="field-form-textarea"
                value={feedbackNotes}
                onChange={e => setFeedbackNotes(e.target.value)}
                placeholder="e.g. Spoke with John about proper harness fit. Crew showed great housekeeping practices..."
                rows={4}
                style={{ minHeight: 100 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation bar */}
      <div className="field-actions-bar">
        {!isFirstStep && (
          <button className="field-btn field-btn-secondary" onClick={handleBack} type="button">
            <ArrowBackIcon style={{ fontSize: 18 }} />
            Back
          </button>
        )}

        {!isFinalStep ? (
          <button
            className="field-btn field-btn-primary"
            onClick={handleNext}
            disabled={currentStepKey === 'select' ? !canProceedFromSelect : false}
            type="button"
            style={{ opacity: currentStepKey === 'select' && !canProceedFromSelect ? 0.5 : 1 }}
          >
            Next
            <ArrowForwardIcon style={{ fontSize: 18 }} />
          </button>
        ) : (
          <button
            className="field-btn field-btn-success"
            onClick={handleSubmit}
            disabled={saving || stretchAndFlex === null}
            type="button"
            style={{ opacity: saving || stretchAndFlex === null ? 0.5 : 1 }}
          >
            <HealthAndSafetyIcon style={{ fontSize: 18 }} />
            {saving ? 'Submitting...' : 'Submit Observation'}
          </button>
        )}
      </div>
    </div>
  );
};

// ── Section Photo Upload component ───────────────────────────────────────────

interface SectionPhotoUploadProps {
  areaKey: string;
  photos: File[];
  onAdd: (areaKey: string, files: File[]) => void;
  onRemove: (areaKey: string, index: number) => void;
}

const SectionPhotoUpload: React.FC<SectionPhotoUploadProps> = ({ areaKey, photos, onAdd, onRemove }) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAdd(areaKey, Array.from(e.target.files));
    }
    // Reset so same file can be re-selected if removed
    e.target.value = '';
  };

  return (
    <div className="field-form-section">
      <div className="field-form-section-title">Photos</div>

      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {photos.map((file, idx) => (
            <PhotoThumb key={idx} file={file} onRemove={() => onRemove(areaKey, idx)} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {/* Camera — opens native camera on mobile */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 10,
            border: '1.5px solid #e5e7eb', background: 'white',
            fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer',
          }}
        >
          <CameraAltIcon style={{ fontSize: 16, color: '#6b7280' }} />
          Take Photo
        </button>

        {/* Upload — file picker, multiple */}
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 10,
            border: '1.5px solid #e5e7eb', background: 'white',
            fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer',
          }}
        >
          <UploadFileIcon style={{ fontSize: 16, color: '#6b7280' }} />
          Upload
        </button>
      </div>

      {photos.length === 0 && (
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, marginBottom: 0 }}>
          Optional — attach photos for documentation
        </p>
      )}
    </div>
  );
};

// ── Photo thumbnail with cleanup ─────────────────────────────────────────────

const PhotoThumb: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const [url, setUrl] = React.useState('');

  React.useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <img
        src={url}
        alt=""
        style={{
          width: 80, height: 80, objectFit: 'cover',
          borderRadius: 10, border: '1.5px solid #e5e7eb',
          display: 'block',
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        style={{
          position: 'absolute', top: -6, right: -6,
          width: 22, height: 22, borderRadius: '50%',
          border: '2px solid white',
          background: '#ef4444', color: 'white',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, fontSize: 12, fontWeight: 700,
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        ×
      </button>
    </div>
  );
};

// ── Reusable audit item row ───────────────────────────────────────────────────

interface AuditItemRowProps {
  label: string;
  answer: ObservationAnswer;
  index: number;
  onAnswer: (ans: ObservationAnswer) => void;
}

const AuditItemRow: React.FC<AuditItemRowProps> = ({ label, answer, index, onAnswer }) => {
  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40, borderRadius: 10, border: '2px solid #e5e7eb',
    cursor: 'pointer', background: 'white', transition: 'all 0.15s ease',
    flexShrink: 0,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 0',
      borderBottom: '1px solid #f3f4f6',
    }}>
      {/* Item label */}
      <div style={{ flex: 1, fontSize: 14, color: '#1f2937', lineHeight: 1.4 }}>
        <span style={{ color: '#9ca3af', fontWeight: 600, marginRight: 6 }}>{index + 1}.</span>
        {label}
      </div>

      {/* Yes / No / N/A buttons */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          title="Yes"
          onClick={() => onAnswer(answer === 'yes' ? null : 'yes')}
          style={{
            ...btnBase,
            border: answer === 'yes' ? '2px solid #10b981' : '2px solid #e5e7eb',
            background: answer === 'yes' ? '#d1fae5' : 'white',
            color: answer === 'yes' ? '#065f46' : '#9ca3af',
          }}
        >
          <CheckIcon style={{ fontSize: 18 }} />
        </button>
        <button
          type="button"
          title="No"
          onClick={() => onAnswer(answer === 'no' ? null : 'no')}
          style={{
            ...btnBase,
            border: answer === 'no' ? '2px solid #ef4444' : '2px solid #e5e7eb',
            background: answer === 'no' ? '#fee2e2' : 'white',
            color: answer === 'no' ? '#991b1b' : '#9ca3af',
          }}
        >
          <CloseIcon style={{ fontSize: 18 }} />
        </button>
        <button
          type="button"
          title="N/A"
          onClick={() => onAnswer(answer === 'na' ? null : 'na')}
          style={{
            ...btnBase,
            border: answer === 'na' ? '2px solid #6b7280' : '2px solid #e5e7eb',
            background: answer === 'na' ? '#f3f4f6' : 'white',
            color: answer === 'na' ? '#374151' : '#9ca3af',
            fontSize: 10, fontWeight: 700,
          }}
        >
          <RemoveIcon style={{ fontSize: 18 }} />
        </button>
      </div>
    </div>
  );
};

export default FieldSafetyObservationWizard;
