import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { employeeResumesApi, Certification } from '../../services/employeeResumes';
import '../../styles/SalesPipeline.css';
import './EmployeeResumeForm.css';

const EmployeeResumeForm: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    employee_name: '',
    job_title: '',
    years_experience: '',
    summary: '',
    education: '',
    is_active: true,
  });

  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [newCert, setNewCert] = useState({ name: '', issuer: '', year: '' });
  const [newSkill, setNewSkill] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  // Fetch existing resume if editing
  const { data: existingResume, isLoading } = useQuery({
    queryKey: ['employeeResume', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await employeeResumesApi.getById(parseInt(id));
      return response.data;
    },
    enabled: isEditing,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingResume) {
      setFormData({
        employee_name: existingResume.employee_name || '',
        job_title: existingResume.job_title || '',
        years_experience: existingResume.years_experience?.toString() || '',
        summary: existingResume.summary || '',
        education: existingResume.education || '',
        is_active: existingResume.is_active,
      });
      setCertifications(existingResume.certifications || []);
      setSkills(existingResume.skills || []);
      setCurrentFileName(existingResume.resume_file_name || null);
    }
  }, [existingResume]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formData: FormData) => employeeResumesApi.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeResumes'] });
      navigate('/employee-resumes');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: number; formData: FormData }) =>
      employeeResumesApi.update(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeResumes'] });
      queryClient.invalidateQueries({ queryKey: ['employeeResume', id] });
      navigate('/employee-resumes');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = new FormData();
    data.append('employee_name', formData.employee_name);
    data.append('job_title', formData.job_title);
    if (formData.years_experience) {
      data.append('years_experience', formData.years_experience);
    }
    data.append('summary', formData.summary);
    if (formData.education) {
      data.append('education', formData.education);
    }
    data.append('certifications', JSON.stringify(certifications));
    data.append('skills', JSON.stringify(skills));
    data.append('is_active', formData.is_active.toString());

    if (resumeFile) {
      data.append('resume', resumeFile);
    }

    if (isEditing && id) {
      updateMutation.mutate({ id: parseInt(id), formData: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addCertification = () => {
    if (newCert.name) {
      setCertifications([
        ...certifications,
        {
          name: newCert.name,
          issuer: newCert.issuer || undefined,
          year: newCert.year ? parseInt(newCert.year) : undefined,
        },
      ]);
      setNewCert({ name: '', issuer: '', year: '' });
    }
  };

  const removeCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="employee-resume-form">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/hr/resumes" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Employee Resumes
            </Link>
            <h1>📄 {isEditing ? 'Edit' : 'Create'} Employee Resume</h1>
            <div className="sales-subtitle">Build a resume profile for proposals</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btnSecondary" onClick={() => navigate('/employee-resumes')}>
            Cancel
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        <div className="card">
          <h2 className="section-title">Basic Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>
                Employee Name <span className="required">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={formData.employee_name}
                onChange={(e) =>
                  setFormData({ ...formData, employee_name: e.target.value })
                }
                required
              />
            </div>

            <div className="form-group">
              <label>
                Job Title <span className="required">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Years of Experience</label>
              <input
                type="number"
                className="input"
                value={formData.years_experience}
                onChange={(e) =>
                  setFormData({ ...formData, years_experience: e.target.value })
                }
                min="0"
                max="99"
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              Professional Summary <span className="required">*</span>
            </label>
            <textarea
              className="input"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={4}
              placeholder="Brief overview of experience and expertise..."
              required
            />
          </div>

          <div className="form-group">
            <label>Education</label>
            <textarea
              className="input"
              value={formData.education}
              onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              rows={3}
              placeholder="Degrees, schools, graduation years..."
            />
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Certifications</h2>

          {certifications.length > 0 && (
            <div className="cert-list">
              {certifications.map((cert, index) => (
                <div key={index} className="cert-item">
                  <div>
                    <strong>{cert.name}</strong>
                    {cert.issuer && <span> - {cert.issuer}</span>}
                    {cert.year && <span> ({cert.year})</span>}
                  </div>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeCertification(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="add-cert-form">
            <input
              type="text"
              className="input"
              placeholder="Certification name (e.g., PE License)"
              value={newCert.name}
              onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
            />
            <input
              type="text"
              className="input"
              placeholder="Issuing organization (optional)"
              value={newCert.issuer}
              onChange={(e) => setNewCert({ ...newCert, issuer: e.target.value })}
            />
            <input
              type="number"
              className="input"
              placeholder="Year"
              value={newCert.year}
              onChange={(e) => setNewCert({ ...newCert, year: e.target.value })}
              min="1900"
              max={new Date().getFullYear()}
            />
            <button type="button" className="btnSecondary" onClick={addCertification}>
              + Add
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Skills & Specializations</h2>

          {skills.length > 0 && (
            <div className="skills-list">
              {skills.map((skill, index) => (
                <span key={index} className="skill-tag">
                  {skill}
                  <button
                    type="button"
                    className="skill-remove"
                    onClick={() => removeSkill(skill)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="add-skill-form">
            <input
              type="text"
              className="input"
              placeholder="Enter a skill or specialization..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <button type="button" className="btnSecondary" onClick={addSkill}>
              + Add Skill
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Resume File</h2>

          {currentFileName && !resumeFile && (
            <div className="current-file">
              <span>📄 Current file: {currentFileName}</span>
            </div>
          )}

          <div className="form-group">
            <label>Upload Resume (PDF or Word)</label>
            <input
              type="file"
              className="input"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
            />
            {resumeFile && (
              <p className="file-info">Selected: {resumeFile.name}</p>
            )}
            <p className="help-text">Maximum file size: 20MB</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span>Active (visible for proposal inclusion)</span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btnSecondary" onClick={() => navigate('/employee-resumes')}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {isEditing ? 'Update Resume' : 'Create Resume'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeResumeForm;
