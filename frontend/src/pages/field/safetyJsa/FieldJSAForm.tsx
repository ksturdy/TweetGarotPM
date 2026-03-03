import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { safetyJsaApi } from '../../../services/safetyJsa';

const PPE_OPTIONS = [
  'Safety Glasses',
  'Gloves',
  'Ear Plugs',
  'Hard Hat',
  'Face Shield',
  'Respirator',
  'Fall Protection',
  'FR Clothing',
];

const PERMIT_OPTIONS = [
  'Lockout/Tagout',
  'Confined Space',
  'Hot Work',
  'Critical Lift',
  'Excavation',
  'Customer Work Permit',
];

const EQUIPMENT_OPTIONS = [
  'Scissor/Boom Lift',
  'Scaffold',
  'Forklift',
  'All Terrain Forklift',
  'Crane/Carry Deck',
  'Excavation',
];

const STEP_LABELS = ['Details', 'PPE / Permits / Equipment', 'Hazard Analysis', 'Worker Sign-In'];

const HAZARD_CATEGORIES = 'Gravity / Mechanical / Electrical / Motion / Temperature / Chemical / Sound / Pressure / Radiation / Biological';

interface HazardEntry {
  step_description: string;
  hazard: string;
  control_measure: string;
}

const FieldJSAForm: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 - Details
  const [dateOfWork, setDateOfWork] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [customerName, setCustomerName] = useState('');
  const [departmentTrade, setDepartmentTrade] = useState('');
  const [filledOutBy, setFilledOutBy] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [workLocation, setWorkLocation] = useState('');

  // Step 1 - PPE + Permits + Equipment
  const [ppeRequired, setPpeRequired] = useState<string[]>([]);
  const [ppeOther, setPpeOther] = useState('');
  const [permitsRequired, setPermitsRequired] = useState<string[]>([]);
  const [permitsOther, setPermitsOther] = useState('');
  const [equipmentRequired, setEquipmentRequired] = useState<string[]>([]);
  const [equipmentOther, setEquipmentOther] = useState('');

  // Step 2 - Hazard Analysis
  const [hazards, setHazards] = useState<HazardEntry[]>([
    { step_description: '', hazard: '', control_measure: '' },
  ]);

  // Step 3 - Worker Sign-In + Comments
  const [workerNames, setWorkerNames] = useState<string[]>([]);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      // Build final PPE list including "Other" entries
      const finalPpe = [...ppeRequired];
      if (ppeOther.trim()) {
        ppeOther.split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed) finalPpe.push(trimmed);
        });
      }

      // Build final permits list
      const finalPermits = [...permitsRequired];
      if (permitsOther.trim()) {
        permitsOther.split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed) finalPermits.push(trimmed);
        });
      }

      // Build final equipment list
      const finalEquipment = [...equipmentRequired];
      if (equipmentOther.trim()) {
        equipmentOther.split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed) finalEquipment.push(trimmed);
        });
      }

      const jsaRes = await safetyJsaApi.create({
        project_id: Number(projectId),
        task_description: taskDescription,
        work_location: workLocation,
        date_of_work: dateOfWork,
        customer_name: customerName,
        department_trade: departmentTrade,
        filled_out_by: filledOutBy,
        ppe_required: finalPpe,
        permits_required: finalPermits,
        equipment_required: finalEquipment,
        additional_comments: additionalComments,
        worker_names: workerNames,
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
      { step_description: '', hazard: '', control_measure: '' },
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

  const toggleItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setList((prev) =>
      prev.includes(item) ? prev.filter((p) => p !== item) : [...prev, item]
    );
  };

  const handleAddWorker = () => {
    if (!newWorkerName.trim()) return;
    setWorkerNames([...workerNames, newWorkerName.trim()]);
    setNewWorkerName('');
  };

  const handleRemoveWorker = (index: number) => {
    setWorkerNames(workerNames.filter((_, i) => i !== index));
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
            <label className="field-form-label">Date *</label>
            <input
              type="date"
              className="field-form-input"
              value={dateOfWork}
              onChange={(e) => setDateOfWork(e.target.value)}
            />
          </div>

          <div className="field-form-group">
            <label className="field-form-label">Customer / GC Name</label>
            <input
              type="text"
              className="field-form-input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g., Turner Construction"
            />
          </div>

          <div className="field-form-group">
            <label className="field-form-label">Department / Trade</label>
            <input
              type="text"
              className="field-form-input"
              value={departmentTrade}
              onChange={(e) => setDepartmentTrade(e.target.value)}
              placeholder="e.g., Plumbing, HVAC, Piping"
            />
          </div>

          <div className="field-form-group">
            <label className="field-form-label">Filled Out By</label>
            <input
              type="text"
              className="field-form-input"
              value={filledOutBy}
              onChange={(e) => setFilledOutBy(e.target.value)}
              placeholder="Your name"
            />
          </div>

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
        </div>
      )}

      {/* Step 1: PPE + Permits + Equipment */}
      {currentStep === 1 && (
        <div>
          {/* PPE Section */}
          <div className="field-form-section">
            <div className="field-form-section-title">PPE Required</div>
            <div className="field-ppe-grid">
              {PPE_OPTIONS.map((item) => (
                <div
                  key={item}
                  className={`field-ppe-item ${ppeRequired.includes(item) ? 'selected' : ''}`}
                  onClick={() => toggleItem(ppeRequired, setPpeRequired, item)}
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="field-form-group" style={{ marginTop: 8 }}>
              <label className="field-form-label">Other PPE</label>
              <input
                type="text"
                className="field-form-input"
                value={ppeOther}
                onChange={(e) => setPpeOther(e.target.value)}
                placeholder="Comma separated (e.g., Welding Hood, Steel Toe Boots)"
              />
            </div>
          </div>

          {/* Permits Section */}
          <div className="field-form-section">
            <div className="field-form-section-title">Permits Required</div>
            <div className="field-ppe-grid">
              {PERMIT_OPTIONS.map((item) => (
                <div
                  key={item}
                  className={`field-ppe-item ${permitsRequired.includes(item) ? 'selected' : ''}`}
                  onClick={() => toggleItem(permitsRequired, setPermitsRequired, item)}
                  style={
                    permitsRequired.includes(item)
                      ? { background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }
                      : {}
                  }
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="field-form-group" style={{ marginTop: 8 }}>
              <label className="field-form-label">Other Permits</label>
              <input
                type="text"
                className="field-form-input"
                value={permitsOther}
                onChange={(e) => setPermitsOther(e.target.value)}
                placeholder="Comma separated"
              />
            </div>
          </div>

          {/* Equipment Section */}
          <div className="field-form-section">
            <div className="field-form-section-title">Equipment</div>
            <div className="field-ppe-grid">
              {EQUIPMENT_OPTIONS.map((item) => (
                <div
                  key={item}
                  className={`field-ppe-item ${equipmentRequired.includes(item) ? 'selected' : ''}`}
                  onClick={() => toggleItem(equipmentRequired, setEquipmentRequired, item)}
                  style={
                    equipmentRequired.includes(item)
                      ? { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
                      : {}
                  }
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="field-form-group" style={{ marginTop: 8 }}>
              <label className="field-form-label">Other Equipment</label>
              <input
                type="text"
                className="field-form-input"
                value={equipmentOther}
                onChange={(e) => setEquipmentOther(e.target.value)}
                placeholder="Comma separated"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Hazard Analysis */}
      {currentStep === 2 && (
        <div className="field-form-section">
          <div className="field-form-section-title">Hazard Analysis</div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: '#fefce8',
              border: '1px solid #fde68a',
              fontSize: 12,
              color: '#92400e',
              marginBottom: 12,
              lineHeight: 1.4,
            }}
          >
            <strong>Hazard Categories:</strong> {HAZARD_CATEGORIES}
          </div>

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
                <div className="field-hazard-step">Row {index + 1}</div>
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
                <label className="field-form-label">Major Task</label>
                <input
                  type="text"
                  className="field-form-input"
                  value={hazard.step_description}
                  onChange={(e) =>
                    handleHazardChange(index, 'step_description', e.target.value)
                  }
                  placeholder="Describe the major task"
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
                <label className="field-form-label">Control Action</label>
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
            </div>
          ))}

          <button
            className="field-btn field-btn-secondary"
            onClick={handleAddHazard}
            type="button"
            style={{ marginTop: 4 }}
          >
            <AddIcon style={{ fontSize: 18 }} />
            Add Row
          </button>
        </div>
      )}

      {/* Step 3: Worker Sign-In + Additional Comments */}
      {currentStep === 3 && (
        <div>
          <div className="field-form-section">
            <div className="field-form-section-title">Worker Sign-In</div>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: 12,
                color: '#1e40af',
                marginBottom: 12,
                lineHeight: 1.4,
                fontStyle: 'italic',
              }}
            >
              By printing my name, I acknowledge my participation in the JSA and commit to work safely
            </div>

            {workerNames.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {workerNames.map((name, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#f9fafb',
                      borderRadius: 8,
                      marginBottom: 4,
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <span style={{ fontSize: 14, color: '#374151' }}>
                      {index + 1}. {name}
                    </span>
                    <button
                      className="field-line-item-remove"
                      onClick={() => handleRemoveWorker(index)}
                      type="button"
                    >
                      <DeleteIcon style={{ fontSize: 16 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="field-form-input"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                placeholder="Print worker name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddWorker();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button
                className="field-btn field-btn-primary field-btn-sm"
                onClick={handleAddWorker}
                disabled={!newWorkerName.trim()}
                type="button"
                style={{ opacity: !newWorkerName.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
              >
                <PersonAddIcon style={{ fontSize: 16 }} />
                Add
              </button>
            </div>
          </div>

          <div className="field-form-section">
            <div className="field-form-section-title">Additional Comments</div>
            <div className="field-form-group">
              <textarea
                className="field-form-textarea"
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                placeholder="Any additional comments, instructions, or safety reminders..."
                rows={6}
                style={{ minHeight: 120 }}
              />
            </div>
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
