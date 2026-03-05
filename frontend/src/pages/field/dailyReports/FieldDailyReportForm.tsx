import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import { dailyReportsApi, DailyReport } from '../../../services/dailyReports';

interface CrewEntry {
  id?: number;
  trade: string;
  foreman: string;
  crew_size: number;
  hours_worked: number;
  work_description: string;
}

interface FormData {
  report_date: string;
  weather: string;
  temperature: string;
  work_performed: string;
  materials: string;
  equipment: string;
  delay_hours: number;
  delay_reason: string;
  safety_incidents: number;
  safety_notes: string;
  visitors: string;
  issues: string;
  notes: string;
}

const defaultFormData: FormData = {
  report_date: new Date().toISOString().split('T')[0],
  weather: 'Sunny',
  temperature: '',
  work_performed: '',
  materials: '',
  equipment: '',
  delay_hours: 0,
  delay_reason: '',
  safety_incidents: 0,
  safety_notes: '',
  visitors: '',
  issues: '',
  notes: '',
};

const defaultCrew: CrewEntry = {
  trade: 'plumbing',
  foreman: '',
  crew_size: 0,
  hours_worked: 0,
  work_description: '',
};

const weatherOptions = [
  'Sunny',
  'Cloudy',
  'Partly Cloudy',
  'Rainy',
  'Windy',
  'Snowy',
  'Stormy',
  'Foggy',
  'Other',
];

// Map WMO weather codes to our dropdown values
const wmoToWeather = (code: number): string => {
  if (code <= 1) return 'Sunny';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Rainy';
  if (code >= 71 && code <= 86) return 'Snowy';
  if (code >= 95) return 'Stormy';
  return 'Cloudy';
};

const tradeOptions = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'piping', label: 'Piping' },
  { value: 'sheet_metal', label: 'Sheet Metal' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
];

const FieldDailyReportForm: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [crews, setCrews] = useState<CrewEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);

  const { data: existingReport } = useQuery({
    queryKey: ['field-daily-report', id],
    queryFn: async () => {
      const res = await dailyReportsApi.getById(Number(id));
      return res.data;
    },
    enabled: isEditMode,
  });

  // Check if a report already exists for the selected date (new mode only)
  useEffect(() => {
    if (isEditMode || !projectId || !formData.report_date) return;
    let cancelled = false;
    dailyReportsApi.getByDate(Number(projectId), formData.report_date)
      .then((res) => {
        if (!cancelled && res.data?.id) {
          navigate(`/field/projects/${projectId}/daily-reports/${res.data.id}/edit`, { replace: true });
        }
      })
      .catch(() => {
        // 404 means no report exists for this date - that's expected
      });
    return () => { cancelled = true; };
  }, [isEditMode, projectId, formData.report_date, navigate]);

  useEffect(() => {
    if (existingReport) {
      setFormData({
        report_date: existingReport.report_date?.split('T')[0] || '',
        weather: existingReport.weather || 'Sunny',
        temperature: existingReport.temperature || '',
        work_performed: existingReport.work_performed || '',
        materials: existingReport.materials || '',
        equipment: existingReport.equipment || '',
        delay_hours: existingReport.delay_hours || 0,
        delay_reason: existingReport.delay_reason || '',
        safety_incidents: existingReport.safety_incidents || 0,
        safety_notes: existingReport.safety_notes || '',
        visitors: existingReport.visitors || '',
        issues: existingReport.issues || '',
        notes: '',
      });
      if (existingReport.crews && existingReport.crews.length > 0) {
        setCrews(
          existingReport.crews.map((c) => ({
            id: c.id,
            trade: c.trade,
            foreman: c.foreman,
            crew_size: c.crew_size,
            hours_worked: c.hours_worked,
            work_description: c.work_description,
          }))
        );
      }
    }
  }, [existingReport]);

  // Auto-fetch weather from Open-Meteo for new reports
  useEffect(() => {
    if (isEditMode || !navigator.geolocation) return;
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
          );
          if (res.ok) {
            const data = await res.json();
            const code = data.current.weather_code as number;
            const temp = Math.round(data.current.temperature_2m);
            setFormData((prev) => ({
              ...prev,
              weather: wmoToWeather(code),
              temperature: `${temp}°F`,
            }));
          }
        } catch {
          // Weather is non-critical
        } finally {
          setWeatherLoading(false);
        }
      },
      () => setWeatherLoading(false),
      { timeout: 5000 }
    );
  }, [isEditMode]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<DailyReport>) => dailyReportsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-daily-reports', projectId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ reportId, data }: { reportId: number; data: Partial<DailyReport> }) =>
      dailyReportsApi.update(reportId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-daily-reports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['field-daily-report', id] });
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof FormData
  ) => {
    const value = e.target.value === '' ? 0 : Number(e.target.value);
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCrewChange = (
    index: number,
    field: keyof CrewEntry,
    value: string | number
  ) => {
    setCrews((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addCrew = () => {
    setCrews((prev) => [...prev, { ...defaultCrew }]);
  };

  const removeCrew = (index: number) => {
    setCrews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.work_performed.trim()) return;

    setSaving(true);
    setError('');
    try {
      const reportData: Partial<DailyReport> = {
        project_id: Number(projectId),
        report_date: formData.report_date,
        weather: formData.weather,
        temperature: formData.temperature,
        work_performed: formData.work_performed,
        materials: formData.materials,
        equipment: formData.equipment,
        delay_hours: Number(formData.delay_hours),
        delay_reason: formData.delay_reason,
        safety_incidents: Number(formData.safety_incidents),
        safety_notes: formData.safety_notes,
        visitors: formData.visitors,
        issues: formData.issues,
        status: 'draft',
      };

      let reportId: number;

      if (isEditMode) {
        await updateMutation.mutateAsync({ reportId: Number(id), data: reportData });
        reportId = Number(id);

        // Delete existing crews and re-add (simpler than diff tracking)
        if (existingReport?.crews) {
          for (const crew of existingReport.crews) {
            await dailyReportsApi.deleteCrew(reportId, crew.id);
          }
        }
      } else {
        const res = await createMutation.mutateAsync(reportData);
        reportId = res.data.id;
      }

      // Add all crew entries
      for (const crew of crews) {
        await dailyReportsApi.addCrew(reportId, {
          trade: crew.trade,
          foreman: crew.foreman,
          crew_size: Number(crew.crew_size),
          hours_worked: Number(crew.hours_worked),
          work_description: crew.work_description,
        });
      }

      navigate(`/field/projects/${projectId}/daily-reports`);
    } catch (err: any) {
      console.error('Failed to save daily report:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || 'Failed to save report. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="field-page-title">
        {isEditMode ? 'Edit Daily Report' : 'New Daily Report'}
      </h1>
      <p className="field-page-subtitle">
        {isEditMode
          ? 'Update the daily report details'
          : 'Fill out the daily field report'}
      </p>

      <form onSubmit={handleSubmit}>
        {/* Date & Weather */}
        <div className="field-form-section">
          <div className="field-form-section-title">
            Date &amp; Weather
            {weatherLoading && <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400, marginLeft: 8 }}>Fetching weather...</span>}
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Report Date</label>
            <input
              type="date"
              name="report_date"
              className="field-form-input"
              value={formData.report_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="field-form-row">
            <div className="field-form-group">
              <label className="field-form-label">Weather</label>
              <select
                name="weather"
                className="field-form-select"
                value={formData.weather}
                onChange={handleChange}
              >
                {weatherOptions.map((w) => (
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
                name="temperature"
                className="field-form-input"
                placeholder="e.g., 75°F"
                value={formData.temperature}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Work Performed */}
        <div className="field-form-section">
          <div className="field-form-section-title">Work Performed</div>
          <div className="field-form-group">
            <label className="field-form-label">Description of Work *</label>
            <textarea
              name="work_performed"
              className="field-form-textarea"
              rows={4}
              placeholder="Describe work performed today..."
              value={formData.work_performed}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Crews */}
        <div className="field-form-section">
          <div className="field-form-section-title">Crews</div>
          {crews.map((crew, index) => (
            <div
              key={index}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                position: 'relative',
              }}
            >
              <button
                type="button"
                onClick={() => removeCrew(index)}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#ef4444',
                  padding: 4,
                }}
                aria-label="Remove crew"
              >
                <DeleteOutlineIcon style={{ fontSize: 20 }} />
              </button>

              <div className="field-form-row">
                <div className="field-form-group">
                  <label className="field-form-label">Trade</label>
                  <select
                    className="field-form-select"
                    value={crew.trade}
                    onChange={(e) =>
                      handleCrewChange(index, 'trade', e.target.value)
                    }
                  >
                    {tradeOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-form-group">
                  <label className="field-form-label">Foreman</label>
                  <input
                    type="text"
                    className="field-form-input"
                    placeholder="Foreman name"
                    value={crew.foreman}
                    onChange={(e) =>
                      handleCrewChange(index, 'foreman', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="field-form-row">
                <div className="field-form-group">
                  <label className="field-form-label">Crew Size</label>
                  <input
                    type="number"
                    className="field-form-input"
                    min={0}
                    value={crew.crew_size}
                    onChange={(e) =>
                      handleCrewChange(
                        index,
                        'crew_size',
                        e.target.value === '' ? 0 : Number(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="field-form-group">
                  <label className="field-form-label">Hours Worked</label>
                  <input
                    type="number"
                    className="field-form-input"
                    min={0}
                    step={0.5}
                    value={crew.hours_worked}
                    onChange={(e) =>
                      handleCrewChange(
                        index,
                        'hours_worked',
                        e.target.value === '' ? 0 : Number(e.target.value)
                      )
                    }
                  />
                </div>
              </div>

              <div className="field-form-group">
                <label className="field-form-label">Work Description</label>
                <textarea
                  className="field-form-textarea"
                  rows={2}
                  placeholder="Describe crew work..."
                  value={crew.work_description}
                  onChange={(e) =>
                    handleCrewChange(index, 'work_description', e.target.value)
                  }
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            className="field-btn field-btn-secondary field-btn-sm"
            onClick={addCrew}
          >
            <AddCircleOutlineIcon style={{ fontSize: 18, marginRight: 4 }} />
            Add Crew
          </button>
        </div>

        {/* Materials & Equipment */}
        <div className="field-form-section">
          <div className="field-form-section-title">Materials &amp; Equipment</div>
          <div className="field-form-group">
            <label className="field-form-label">Materials</label>
            <textarea
              name="materials"
              className="field-form-textarea"
              rows={3}
              placeholder="Materials received or used..."
              value={formData.materials}
              onChange={handleChange}
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Equipment</label>
            <textarea
              name="equipment"
              className="field-form-textarea"
              rows={3}
              placeholder="Equipment on site..."
              value={formData.equipment}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Delays */}
        <div className="field-form-section">
          <div className="field-form-section-title">Delays</div>
          <div className="field-form-group">
            <label className="field-form-label">Delay Hours</label>
            <input
              type="number"
              name="delay_hours"
              className="field-form-input"
              min={0}
              step={0.5}
              value={formData.delay_hours}
              onChange={(e) => handleNumberChange(e, 'delay_hours')}
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Delay Reason</label>
            <textarea
              name="delay_reason"
              className="field-form-textarea"
              rows={2}
              placeholder="Reason for delay..."
              value={formData.delay_reason}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Safety */}
        <div className="field-form-section">
          <div className="field-form-section-title">Safety</div>
          <div className="field-form-group">
            <label className="field-form-label">Safety Incidents</label>
            <input
              type="number"
              name="safety_incidents"
              className="field-form-input"
              min={0}
              value={formData.safety_incidents}
              onChange={(e) => handleNumberChange(e, 'safety_incidents')}
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Safety Notes</label>
            <textarea
              name="safety_notes"
              className="field-form-textarea"
              rows={2}
              placeholder="Safety observations or notes..."
              value={formData.safety_notes}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Other */}
        <div className="field-form-section">
          <div className="field-form-section-title">Other</div>
          <div className="field-form-group">
            <label className="field-form-label">Visitors</label>
            <textarea
              name="visitors"
              className="field-form-textarea"
              rows={2}
              placeholder="Visitors on site..."
              value={formData.visitors}
              onChange={handleChange}
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Issues</label>
            <textarea
              name="issues"
              className="field-form-textarea"
              rows={2}
              placeholder="Issues encountered..."
              value={formData.issues}
              onChange={handleChange}
            />
          </div>
          <div className="field-form-group">
            <label className="field-form-label">Notes</label>
            <textarea
              name="notes"
              className="field-form-textarea"
              rows={2}
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            color: '#dc2626',
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="field-actions-bar">
          <button
            type="button"
            className="field-btn field-btn-secondary"
            onClick={() =>
              navigate(`/field/projects/${projectId}/daily-reports`)
            }
          >
            Cancel
          </button>
          <button
            type="submit"
            className="field-btn field-btn-primary"
            disabled={saving || !formData.work_performed.trim()}
          >
            <SaveIcon style={{ fontSize: 18, marginRight: 4 }} />
            {saving ? 'Saving...' : 'Save Report'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FieldDailyReportForm;
