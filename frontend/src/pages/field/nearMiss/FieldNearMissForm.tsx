import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import { nearMissReportsApi } from '../../../services/nearMissReports';

const REPORT_TYPES = [
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'hazard_identification', label: 'Hazard Identification' },
  { value: 'incentive', label: 'Incentive' },
];

const FieldNearMissForm: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [reportType, setReportType] = useState('near_miss');
  const [dateOfIncident, setDateOfIncident] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [locationOnSite, setLocationOnSite] = useState('');
  const [description, setDescription] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [dateCorrected, setDateCorrected] = useState('');
  const [reportedBy, setReportedBy] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await nearMissReportsApi.create({
        project_id: Number(projectId),
        report_type: reportType as any,
        date_of_incident: dateOfIncident,
        location_on_site: locationOnSite,
        description,
        corrective_action: correctiveAction,
        date_corrected: dateCorrected || (null as any),
        reported_by: reportedBy,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-near-miss-reports', projectId] });
      navigate(`/field/projects/${projectId}/safety-near-miss`);
    },
  });

  const handleSave = async () => {
    if (!description.trim() || !dateOfIncident) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="field-page-title">New Report</h1>
      <p className="field-page-subtitle">Near Miss / Hazard Identification / Incentive</p>

      <div className="field-form-section">
        <div className="field-form-section-title">Report Type</div>
        <div className="field-ppe-grid">
          {REPORT_TYPES.map((type) => (
            <div
              key={type.value}
              className={`field-ppe-item ${reportType === type.value ? 'selected' : ''}`}
              onClick={() => setReportType(type.value)}
            >
              {type.label}
            </div>
          ))}
        </div>
      </div>

      <div className="field-form-section">
        <div className="field-form-section-title">Details</div>

        <div className="field-form-group">
          <label className="field-form-label">Date *</label>
          <input
            type="date"
            className="field-form-input"
            value={dateOfIncident}
            onChange={(e) => setDateOfIncident(e.target.value)}
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Reported By</label>
          <input
            type="text"
            className="field-form-input"
            value={reportedBy}
            onChange={(e) => setReportedBy(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Location on Site</label>
          <input
            type="text"
            className="field-form-input"
            value={locationOnSite}
            onChange={(e) => setLocationOnSite(e.target.value)}
            placeholder="e.g., 2nd Floor Mechanical Room"
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Description of Near Miss / Hazard / Incentive *</label>
          <textarea
            className="field-form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened..."
            rows={5}
            style={{ minHeight: 120 }}
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Corrective Action Taken</label>
          <textarea
            className="field-form-textarea"
            value={correctiveAction}
            onChange={(e) => setCorrectiveAction(e.target.value)}
            placeholder="Describe the corrective action taken..."
            rows={4}
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="field-form-group">
          <label className="field-form-label">Date Corrected</label>
          <input
            type="date"
            className="field-form-input"
            value={dateCorrected}
            onChange={(e) => setDateCorrected(e.target.value)}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="field-actions-bar">
        <button
          className="field-btn field-btn-success"
          onClick={handleSave}
          disabled={saving || !description.trim() || !dateOfIncident}
          type="button"
          style={{ opacity: saving || !description.trim() ? 0.5 : 1 }}
        >
          <SaveIcon style={{ fontSize: 18 }} />
          {saving ? 'Saving...' : 'Save Report'}
        </button>
      </div>
    </div>
  );
};

export default FieldNearMissForm;
