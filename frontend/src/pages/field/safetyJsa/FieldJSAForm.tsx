import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { safetyJsaApi } from '../../../services/safetyJsa';

const PPE_OPTIONS = [
  'Hard Hat',
  'Safety Glasses',
  'Gloves',
  'Steel Toe Boots',
  'Hi-Vis Vest',
  'Fall Harness',
  'Respirator',
  'Ear Protection',
  'Face Shield',
  'Welding Hood',
];

const WEATHER_OPTIONS = [
  'Sunny',
  'Partly Cloudy',
  'Cloudy',
  'Rainy',
  'Snowy',
  'Windy',
  'Hot',
  'Cold',
];

const STEP_LABELS = ['Details', 'Hazards', 'PPE', 'Notes'];

interface HazardEntry {
  step_description: string;
  hazard: string;
  control_measure: string;
  responsible_person: string;
}

const FieldJSAForm: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 - Details
  const [taskDescription, setTaskDescription] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [dateOfWork, setDateOfWork] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [weather, setWeather] = useState('');
  const [temperature, setTemperature] = useState('');

  // Step 1 - Hazards
  const [hazards, setHazards] = useState<HazardEntry[]>([
    { step_description: '', hazard: '', control_measure: '', responsible_person: '' },
  ]);

  // Step 2 - PPE
  const [ppeRequired, setPpeRequired] = useState<string[]>([]);

  // Step 3 - Notes
  const [notes, setNotes] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const jsaRes = await safetyJsaApi.create({
        project_id: Number(projectId),
        task_description: taskDescription,
        work_location: workLocation,
        date_of_work: dateOfWork,
        weather,
        temperature,
        ppe_required: ppeRequired,
        notes,
      });
      const jsa = jsaRes.data;

      // Add hazards sequentially
      const validHazards = hazards.filter(
        (h) => h.step_description.trim() || h.hazard.trim()
      );
      for (let i = 0; i < validHazards.length; i++) {
        await safetyJsaApi.addHazard(jsa.id, {
          sort_order: i + 1,
          step_description: validHazards[i].step_description,
          hazard: validHazards[i].hazard,
          control_measure: validHazards[i].control_measure,
          responsible_person: validHazards[i].responsible_person,
        });
      }

      return jsa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsas', projectId] });
      navigate(`/field/projects/${projectId}/safety-jsa`);
    },
  });

  const handleAddHazard = () => {
    setHazards([
      ...hazards,
      { step_description: '', hazard: '', control_measure: '', responsible_person: '' },
    ]);
  };

  const handleRemoveHazard = (index: number) => {
    if (hazards.length <= 1) return;
    setHazards(hazards.filter((_, i) => i !== index));
  };

  const handleHazardChange = (
    index: number,
    field: keyof HazardEntry,
    value: string
  ) => {
    const updated = [...hazards];
    updated[index] = { ...updated[index], [field]: value };
    setHazards(updated);
  };

  const togglePpe = (item: string) => {
    setPpeRequired((prev) =>
      prev.includes(item) ? prev.filter((p) => p !== item) : [...prev, item]
    );
  };

  const handleNext = () => {
    if (currentStep < STEP_LABELS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!taskDescription.trim() || !dateOfWork) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  const isLastStep = currentStep === STEP_LABELS.length - 1;
  const canProceed =
    currentStep !== 0 || (taskDescription.trim() !== '' && dateOfWork !== '');

  return (
    <div>
      <h1 className="field-page-title">New JSA</h1>
      <p className="field-page-subtitle">
        Step {currentStep + 1} of {STEP_LABELS.length}: {STEP_LABELS[currentStep]}
      </p>

      {/* Step 0: Details */}
      {currentStep === 0 && (
        <div className="field-form-section">
          <div className="field-form-section-title">Job Details</div>

          <div className="field-form-group">
            <label className="field-form-label">Task Description *</label>
            <textarea
              className="field-form-textarea"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Describe the task or activity..."
              rows={3}
            />
          </div>

          <div className="field-form-group">
            <label className="field-form-label">Work Location</label>
            <input
              type="text"
              className="field-form-input"
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              placeholder="e.g., 2nd Floor Mechanical Room"
            />
          </div>

          <div className="field-form-group">
            <label className="field-form-label">Date of Work *</label>
            <input
              type="date"
              className="field-form-input"
              value={dateOfWork}
              onChange={(e) => setDateOfWork(e.target.value)}
            />
          </div>

          <div className="field-form-row">
            <div className="field-form-group">
              <label className="field-form-label">Weather</label>
              <select
                className="field-form-select"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
              >
                <option value="">Select...</option>
                {WEATHER_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-form-group">
              <label className="field-form-label">Temperature</label>
              <input
                type="text"
                className="field-form-input"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="e.g., 75°F"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Hazards */}
      {currentStep === 1 && (
        <div className="field-form-section">
          <div className="field-form-section-title">Hazard Analysis</div>

          {hazards.map((hazard, index) => (
            <div key={index} className="field-hazard-row">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div className="field-hazard-step">Step {index + 1}</div>
                {hazards.length > 1 && (
                  <button
                    className="field-line-item-remove"
                    onClick={() => handleRemoveHazard(index)}
                    type="button"
                  >
                    <DeleteIcon style={{ fontSize: 16 }} />
                  </button>
                )}
              </div>

              <div className="field-form-group">
                <label className="field-form-label">Work Step</label>
                <input
                  type="text"
                  className="field-form-input"
                  value={hazard.step_description}
                  onChange={(e) =>
                    handleHazardChange(index, 'step_description', e.target.value)
                  }
                  placeholder="Describe the work step"
                />
              </div>

              <div className="field-form-group">
                <label className="field-form-label">Potential Hazard</label>
                <input
                  type="text"
                  className="field-form-input"
                  value={hazard.hazard}
                  onChange={(e) =>
                    handleHazardChange(index, 'hazard', e.target.value)
                  }
                  placeholder="What could go wrong?"
                />
              </div>

              <div className="field-form-group">
                <label className="field-form-label">Control Measure</label>
                <input
                  type="text"
                  className="field-form-input"
                  value={hazard.control_measure}
                  onChange={(e) =>
                    handleHazardChange(index, 'control_measure', e.target.value)
                  }
                  placeholder="How to prevent or mitigate"
                />
              </div>

              <div className="field-form-group">
                <label className="field-form-label">Responsible Person</label>
                <input
                  type="text"
                  className="field-form-input"
                  value={hazard.responsible_person}
                  onChange={(e) =>
                    handleHazardChange(index, 'responsible_person', e.target.value)
                  }
                  placeholder="Who is responsible?"
                />
              </div>
            </div>
          ))}

          <button
            className="field-btn field-btn-secondary"
            onClick={handleAddHazard}
            type="button"
            style={{ marginTop: 4 }}
          >
            <AddIcon style={{ fontSize: 18 }} />
            Add Hazard
          </button>
        </div>
      )}

      {/* Step 2: PPE */}
      {currentStep === 2 && (
        <div className="field-form-section">
          <div className="field-form-section-title">Required PPE</div>
          <div className="field-ppe-grid">
            {PPE_OPTIONS.map((item) => (
              <div
                key={item}
                className={`field-ppe-item ${ppeRequired.includes(item) ? 'selected' : ''}`}
                onClick={() => togglePpe(item)}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Notes */}
      {currentStep === 3 && (
        <div className="field-form-section">
          <div className="field-form-section-title">Additional Notes</div>
          <div className="field-form-group">
            <label className="field-form-label">Notes</label>
            <textarea
              className="field-form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes, instructions, or safety reminders..."
              rows={6}
              style={{ minHeight: 140 }}
            />
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="field-actions-bar">
        {currentStep > 0 && (
          <button
            className="field-btn field-btn-secondary"
            onClick={handleBack}
            type="button"
          >
            <ArrowBackIcon style={{ fontSize: 18 }} />
            Back
          </button>
        )}

        {!isLastStep ? (
          <button
            className="field-btn field-btn-primary"
            onClick={handleNext}
            disabled={!canProceed}
            type="button"
            style={{ opacity: canProceed ? 1 : 0.5 }}
          >
            Next
            <ArrowForwardIcon style={{ fontSize: 18 }} />
          </button>
        ) : (
          <button
            className="field-btn field-btn-success"
            onClick={handleSave}
            disabled={saving || !taskDescription.trim()}
            type="button"
            style={{ opacity: saving || !taskDescription.trim() ? 0.5 : 1 }}
          >
            <SaveIcon style={{ fontSize: 18 }} />
            {saving ? 'Saving...' : 'Save JSA'}
          </button>
        )}
      </div>
    </div>
  );
};

export default FieldJSAForm;
