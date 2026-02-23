import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { employeeResumesApi, Certification, Language, Reference, ResumeProject, EmployeeResume } from '../../services/employeeResumes';
import ResumeProjectManager from '../../components/resumes/ResumeProjectManager';
import ResumePreviewModal from '../../components/resumes/ResumePreviewModal';
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
    phone: '',
    email: '',
    address: '',
    is_active: true,
  });

  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [projects, setProjects] = useState<ResumeProject[]>([]);

  const [newCert, setNewCert] = useState({ name: '', issuer: '', year: '' });
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState({ language: '', proficiency: 'Conversational' });
  const [newHobby, setNewHobby] = useState('');
  const [newReference, setNewReference] = useState({ name: '', title: '', company: '', phone: '' });

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch existing resume if editing
  const { data: existingResume, isLoading, refetch } = useQuery({
    queryKey: ['employeeResume', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await employeeResumesApi.getById(parseInt(id));
      return response.data;
    },
    enabled: isEditing,
  });

  // Fetch projects if editing
  const { data: existingProjects } = useQuery({
    queryKey: ['resumeProjects', id],
    queryFn: async () => {
      if (!id) return [];
      const response = await employeeResumesApi.getProjects(parseInt(id));
      return response.data;
    },
    enabled: isEditing,
    refetchOnWindowFocus: false, // Don't refetch on window focus - would wipe out unsaved projects
    refetchOnMount: false, // Don't refetch on mount - only fetch once
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
        phone: existingResume.phone || '',
        email: existingResume.email || '',
        address: existingResume.address || '',
        is_active: existingResume.is_active,
      });
      setCertifications(existingResume.certifications || []);
      setSkills(existingResume.skills || []);
      setLanguages(existingResume.languages || []);
      setHobbies(existingResume.hobbies || []);
      setReferences(existingResume.references || []);
      setCurrentFileName(existingResume.resume_file_name || null);

      // Set photo preview if exists, clear if not
      if (existingResume.employee_photo_path) {
        setPhotoPreview(`/${existingResume.employee_photo_path}`);
      } else {
        setPhotoPreview(null);
      }
    }
  }, [existingResume]);

  // Populate projects when editing (only on initial load)
  useEffect(() => {
    if (existingProjects && projects.length === 0) {
      console.log('Initializing projects from query:', existingProjects.length);
      setProjects(existingProjects);
    }
  }, [existingProjects]); // Don't include projects.length to avoid infinite loop

  // Create preview resume object from current form data
  const previewResume: EmployeeResume = useMemo(() => {
    // Use photoPreview if available (for newly uploaded photos), otherwise use existing path
    // But we need to handle the photoPreview being a data URL vs server path
    let photoPath = existingResume?.employee_photo_path;
    if (photoPreview) {
      // If photoPreview is a data URL (starts with 'data:'), we'll handle it specially in the preview
      // If it's a server path (starts with '/'), strip the leading slash to get the relative path
      photoPath = photoPreview.startsWith('data:') ? undefined : photoPreview.replace(/^\//, '');
    }

    return {
      id: parseInt(id || '0'),
      tenant_id: existingResume?.tenant_id || 0,
      employee_id: existingResume?.employee_id,
      employee_name: formData.employee_name,
      job_title: formData.job_title,
      years_experience: formData.years_experience ? parseInt(formData.years_experience) : undefined,
      summary: formData.summary,
      certifications,
      skills,
      education: formData.education,
      resume_file_name: currentFileName || undefined,
      resume_file_path: existingResume?.resume_file_path,
      resume_file_size: existingResume?.resume_file_size,
      resume_file_type: existingResume?.resume_file_type,
      employee_photo_path: photoPath,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      languages,
      hobbies,
      references,
      is_active: formData.is_active,
      version_number: existingResume?.version_number || 1,
      last_updated_by: existingResume?.last_updated_by,
      created_at: existingResume?.created_at || new Date().toISOString(),
      updated_at: existingResume?.updated_at || new Date().toISOString(),
    };
  }, [formData, certifications, skills, languages, hobbies, references, currentFileName, existingResume, id, photoPreview]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      try {
        // Create resume
        const resumeResponse = await employeeResumesApi.create(formData);
        const resumeId = resumeResponse.data.id;

        // Upload photo if exists
        if (photoFile) {
          const photoFormData = new FormData();
          photoFormData.append('photo', photoFile);
          await employeeResumesApi.uploadPhoto(resumeId, photoFormData);
        }

        // Add projects and capture their IDs for reordering
        const projectIds: number[] = [];
        for (const project of projects) {
          const response = await employeeResumesApi.addProject(resumeId, project);
          projectIds.push(response.data.id);
        }

        // Reorder projects if any were added
        if (projectIds.length > 0) {
          await employeeResumesApi.reorderProjects(resumeId, projectIds);
        }

        return resumeResponse;
      } catch (error) {
        console.error('Error creating resume:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeResumes'] });
      navigate('/employee-resumes');
    },
    onError: (error: any) => {
      alert(`Failed to create resume: ${error?.response?.data?.message || error.message || 'Unknown error'}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
      try {
        // Step 1: Update resume
        const resumeResponse = await employeeResumesApi.update(id, formData);

        // Step 2: Upload photo if new file selected
        if (photoFile) {
          const photoFormData = new FormData();
          photoFormData.append('photo', photoFile);
          await employeeResumesApi.uploadPhoto(id, photoFormData);
        }

        // Step 3: Sync projects
        const existingProjectIds = (existingProjects || []).map((p: ResumeProject) => p.id).filter(Boolean);
        const currentProjects = projects || [];

        console.log('=== PROJECT SYNC DEBUG ===');
        console.log('Existing projects from DB:', existingProjectIds);
        console.log('Current projects in state:', currentProjects.length, currentProjects);

        // Delete removed projects
        for (const projectId of existingProjectIds) {
          const stillExists = currentProjects.some((p: ResumeProject) => p.id === projectId);
          if (!stillExists) {
            await employeeResumesApi.deleteProject(id, projectId);
          }
        }

        // Update existing projects and add new ones
        const finalProjectIds: number[] = [];
        console.log(`Processing ${currentProjects.length} projects...`);
        for (let i = 0; i < currentProjects.length; i++) {
          const project = currentProjects[i];
          try {
            if (project.id) {
              // Update existing project
              console.log(`Updating existing project ${project.id}: ${project.project_name}`);
              await employeeResumesApi.updateProject(id, project.id, project);
              finalProjectIds.push(project.id);
            } else {
              // Add new project from database
              console.log(`Adding new project: ${project.project_name} (project_id: ${project.project_id})`);
              const response = await employeeResumesApi.addProject(id, project);
              console.log(`Project added to resume with ID: ${response.data.id}`);
              finalProjectIds.push(response.data.id);
            }
          } catch (error) {
            console.error(`Error processing project ${i}:`, error);
            throw error;
          }
        }
        console.log(`Final project IDs for reorder:`, finalProjectIds);

        // Step 4: Reorder projects
        if (finalProjectIds.length > 0) {
          await employeeResumesApi.reorderProjects(id, finalProjectIds);
        }

        return resumeResponse;
      } catch (error) {
        console.error('Error updating resume:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeResumes'] });
      queryClient.invalidateQueries({ queryKey: ['employeeResume', id] });
      queryClient.invalidateQueries({ queryKey: ['resumeProjects', id] });
      navigate('/employee-resumes');
    },
    onError: (error: any) => {
      console.error('Update mutation error:', error);
      alert(`Failed to update resume: ${error?.response?.data?.message || error?.response?.data?.error || error.message || 'Unknown error'}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
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
      if (formData.phone) {
        data.append('phone', formData.phone);
      }
      if (formData.email) {
        data.append('email', formData.email);
      }
      if (formData.address) {
        data.append('address', formData.address);
      }
      data.append('certifications', JSON.stringify(certifications));
      data.append('skills', JSON.stringify(skills));
      data.append('languages', JSON.stringify(languages));
      data.append('hobbies', JSON.stringify(hobbies));
      data.append('references', JSON.stringify(references));
      data.append('is_active', formData.is_active.toString());

      if (resumeFile) {
        data.append('resume', resumeFile);
      }

      console.log('Form submission:', {
        isEditing,
        hasProjects: projects.length,
        hasPhoto: !!photoFile
      });

      if (isEditing && id) {
        updateMutation.mutate({ id: parseInt(id), formData: data });
      } else {
        createMutation.mutate(data);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      alert(`Error preparing form data: ${error}`);
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

  const addLanguage = () => {
    if (newLanguage.language.trim()) {
      setLanguages([...languages, { ...newLanguage }]);
      setNewLanguage({ language: '', proficiency: 'Conversational' });
    }
  };

  const removeLanguage = (index: number) => {
    setLanguages(languages.filter((_, i) => i !== index));
  };

  const addHobby = () => {
    if (newHobby.trim() && !hobbies.includes(newHobby.trim())) {
      setHobbies([...hobbies, newHobby.trim()]);
      setNewHobby('');
    }
  };

  const removeHobby = (hobby: string) => {
    setHobbies(hobbies.filter((h) => h !== hobby));
  };

  const addReference = () => {
    if (newReference.name.trim()) {
      setReferences([...references, { ...newReference }]);
      setNewReference({ name: '', title: '', company: '', phone: '' });
    }
  };

  const removeReference = (index: number) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = async () => {
    // If editing an existing resume with a photo, delete from server
    if (isEditing && id && existingResume?.employee_photo_path) {
      try {
        await employeeResumesApi.deletePhoto(parseInt(id));
        // Refetch to get updated data
        await refetch();
      } catch (error) {
        console.error('Failed to delete photo:', error);
        alert('Failed to delete photo. Please try again.');
        return;
      }
    }

    // Clear local state
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="employee-resume-form">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/employee-resumes" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Employee Resumes
            </Link>
            <h1>📄 {isEditing ? 'Edit' : 'Create'} Employee Resume</h1>
            <div className="sales-subtitle">Build a resume profile for proposals</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            type="button"
            className="btnSecondary"
            onClick={() => setShowPreview(true)}
            style={{ marginRight: '0.5rem' }}
          >
            👁️ Preview
          </button>
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
          <h2 className="section-title">Employee Photo</h2>
          <p className="help-text" style={{ marginBottom: '1rem' }}>Upload a professional photo for the resume</p>

          {photoPreview && (
            <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <img
                src={photoPreview}
                alt="Employee"
                style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #1e3a5f'
                }}
              />
              <br />
              <button
                type="button"
                className="btnSecondary"
                onClick={removePhoto}
                style={{ marginTop: '0.5rem' }}
              >
                Remove Photo
              </button>
            </div>
          )}

          <div className="form-group">
            <label>Upload Photo (JPEG, PNG, or WebP)</label>
            <input
              type="file"
              className="input"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
            />
            <p className="help-text">Maximum file size: 5MB</p>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Contact Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                className="input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Mailing Address</label>
            <textarea
              className="input"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              placeholder="Street address, city, state, zip code"
            />
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Languages</h2>

          {languages.length > 0 && (
            <div className="cert-list">
              {languages.map((lang, index) => (
                <div key={index} className="cert-item">
                  <div>
                    <strong>{lang.language}</strong>
                    <span> - {lang.proficiency}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeLanguage(index)}
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
              placeholder="Language (e.g., Spanish)"
              value={newLanguage.language}
              onChange={(e) => setNewLanguage({ ...newLanguage, language: e.target.value })}
            />
            <select
              className="input"
              value={newLanguage.proficiency}
              onChange={(e) => setNewLanguage({ ...newLanguage, proficiency: e.target.value })}
            >
              <option value="Native">Native</option>
              <option value="Fluent">Fluent</option>
              <option value="Conversational">Conversational</option>
              <option value="Basic">Basic</option>
            </select>
            <button type="button" className="btnSecondary" onClick={addLanguage}>
              + Add Language
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Hobbies & Interests</h2>

          {hobbies.length > 0 && (
            <div className="skills-list">
              {hobbies.map((hobby, index) => (
                <span key={index} className="skill-tag">
                  {hobby}
                  <button
                    type="button"
                    className="skill-remove"
                    onClick={() => removeHobby(hobby)}
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
              placeholder="Enter a hobby or interest..."
              value={newHobby}
              onChange={(e) => setNewHobby(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addHobby();
                }
              }}
            />
            <button type="button" className="btnSecondary" onClick={addHobby}>
              + Add Hobby
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Professional References</h2>

          {references.length > 0 && (
            <div className="cert-list">
              {references.map((ref, index) => (
                <div key={index} className="cert-item">
                  <div>
                    <strong>{ref.name}</strong>
                    {ref.title && <span> - {ref.title}</span>}
                    {ref.company && <div style={{ fontSize: '0.9em', color: '#666' }}>{ref.company}</div>}
                    {ref.phone && <div style={{ fontSize: '0.9em', color: '#666' }}>{ref.phone}</div>}
                  </div>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeReference(index)}
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
              placeholder="Reference name"
              value={newReference.name}
              onChange={(e) => setNewReference({ ...newReference, name: e.target.value })}
            />
            <input
              type="text"
              className="input"
              placeholder="Title (optional)"
              value={newReference.title}
              onChange={(e) => setNewReference({ ...newReference, title: e.target.value })}
            />
            <input
              type="text"
              className="input"
              placeholder="Company (optional)"
              value={newReference.company}
              onChange={(e) => setNewReference({ ...newReference, company: e.target.value })}
            />
            <input
              type="tel"
              className="input"
              placeholder="Phone (optional)"
              value={newReference.phone}
              onChange={(e) => setNewReference({ ...newReference, phone: e.target.value })}
            />
            <button type="button" className="btnSecondary" onClick={addReference}>
              + Add Reference
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Project Experience</h2>
          <p className="help-text" style={{ marginBottom: '1rem' }}>
            Add projects from the database or create custom entries to showcase project experience
          </p>

          <ResumeProjectManager
            resumeId={id ? parseInt(id) : undefined}
            employeeId={existingResume?.employee_id}
            value={projects}
            onChange={setProjects}
          />
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

      {/* Preview Modal */}
      <ResumePreviewModal
        resume={previewResume}
        projects={projects}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        photoPreviewUrl={photoPreview || undefined}
      />
    </div>
  );
};

export default EmployeeResumeForm;
