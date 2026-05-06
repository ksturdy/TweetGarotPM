import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { employeeResumesApi, Certification, Language, Reference, ResumeProject, EmployeeResume } from '../../services/employeeResumes';
import { resumeTemplatesApi, ResumeTemplate } from '../../services/resumeTemplates';
import ResumeProjectManager from '../../components/resumes/ResumeProjectManager';
import ResumePreviewModal from '../../components/resumes/ResumePreviewModal';
import ResumePreview from '../../components/resumes/ResumePreview';
import RankableSectionList from '../../components/resumes/RankableSectionList';
import ImageCropper from '../../components/common/ImageCropper';
import '../../components/common/ImageCropper.css';
import '../../styles/SalesPipeline.css';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import './EmployeeResumeForm.css';

const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;

const zoomBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  backgroundColor: 'white',
  color: '#374151',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: 0,
  lineHeight: 1,
};

/**
 * Format a US phone number as the user types: (XXX) XXX-XXXX.
 * Strips all non-digits, keeps the leading "1" if present, and progressively
 * adds parens / space / dash as more digits are entered.
 */
function formatPhoneNumber(input: string): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  // Drop leading country-code "1" so (XXX) XXX-XXXX is the canonical form
  if (digits.length > 10 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const limitChipStyle: React.CSSProperties = {
  padding: '0.1rem 0.45rem',
  backgroundColor: '#f3f4f6',
  color: '#6b7280',
  borderRadius: '9999px',
  fontSize: '0.7rem',
  fontWeight: 600,
};

const EmployeeResumeForm: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast, confirm } = useTitanFeedback();
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
  const [editingRefIndex, setEditingRefIndex] = useState<number | null>(null);
  const [editingRefDraft, setEditingRefDraft] = useState<Reference>({ name: '', title: '', company: '', phone: '' });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [templateId, setTemplateId] = useState<number | null>(null);

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

  // Fetch resume templates (always - needed for both create and edit)
  const { data: resumeTemplates = [] } = useQuery({
    queryKey: ['resumeTemplates', 'active'],
    queryFn: async () => {
      const response = await resumeTemplatesApi.getAll({ is_active: true });
      return response.data;
    },
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
        phone: formatPhoneNumber(existingResume.phone || ''),
        email: existingResume.email || '',
        is_active: existingResume.is_active,
      });
      setCertifications(existingResume.certifications || []);
      setSkills(existingResume.skills || []);
      setLanguages(existingResume.languages || []);
      setHobbies(existingResume.hobbies || []);
      setReferences((existingResume.references || []).map((ref: Reference) => ({
        ...ref,
        phone: ref.phone ? formatPhoneNumber(ref.phone) : ref.phone,
      })));

      // Set photo preview if exists, clear if not.
      // Prefer the backend-resolved URL (presigned R2 / public URL); fall back
      // to the relative path only when running against local storage.
      const photoUrl = existingResume.employee_photo_url
        || (existingResume.employee_photo_path ? `/${existingResume.employee_photo_path}` : null);
      setPhotoPreview(photoUrl);

      if (existingResume.template_id) {
        setTemplateId(existingResume.template_id);
      }
    }
  }, [existingResume]);

  // For new resumes, default to the tenant's default template once templates load.
  useEffect(() => {
    if (!isEditing && templateId === null && resumeTemplates.length > 0) {
      const def = resumeTemplates.find((t: ResumeTemplate) => t.is_default) || resumeTemplates[0];
      if (def) setTemplateId(def.id);
    }
  }, [isEditing, templateId, resumeTemplates]);

  // Populate projects when editing (only on initial load)
  useEffect(() => {
    if (existingProjects && projects.length === 0) {
      console.log('Initializing projects from query:', existingProjects.length);
      setProjects(existingProjects);
    }
  }, [existingProjects]); // Don't include projects.length to avoid infinite loop

  const selectedTemplate = useMemo<ResumeTemplate | null>(
    () => resumeTemplates.find((t: ResumeTemplate) => t.id === templateId) || null,
    [resumeTemplates, templateId]
  );

  // Auto-scale the full-size letter page to fit the preview pane's width AND height
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [autoZoom, setAutoZoom] = useState(0.6);
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const zoomScale = manualZoom != null ? manualZoom : autoZoom;

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        const widthScale = Math.min(1, w / PAGE_WIDTH_PX);
        const heightScale = Math.min(1, h / PAGE_HEIGHT_PX);
        setAutoZoom(Math.min(widthScale, heightScale));
      }
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const adjustZoom = (delta: number) => {
    const next = Math.max(0.25, Math.min(2, zoomScale + delta));
    setManualZoom(Number(next.toFixed(2)));
  };
  const resetZoomToFit = () => setManualZoom(null);

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
      employee_photo_path: photoPath,
      phone: formData.phone,
      email: formData.email,
      languages,
      hobbies,
      references,
      is_active: formData.is_active,
      version_number: existingResume?.version_number || 1,
      last_updated_by: existingResume?.last_updated_by,
      created_at: existingResume?.created_at || new Date().toISOString(),
      updated_at: existingResume?.updated_at || new Date().toISOString(),
    };
  }, [formData, certifications, skills, languages, hobbies, references, existingResume, id, photoPreview]);

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
      toast.error(`Failed to create resume: ${error?.response?.data?.message || error.message || 'Unknown error'}`);
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
      toast.error(`Failed to update resume: ${error?.response?.data?.message || error?.response?.data?.error || error.message || 'Unknown error'}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (resumeId: number) => employeeResumesApi.delete(resumeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeResumes'] });
      navigate('/employee-resumes');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete resume: ${error?.response?.data?.error || error.message || 'Unknown error'}`);
    },
  });

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      message: `Are you sure you want to delete the resume for "${formData.employee_name || 'this employee'}"? This action cannot be undone.`,
      danger: true,
    });
    if (ok) {
      deleteMutation.mutate(parseInt(id));
    }
  };

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
      // Address is intentionally never sent — the field was retired from the form.
      // Send an empty string so any legacy address on existing rows gets cleared on next save.
      data.append('address', '');
      data.append('certifications', JSON.stringify(certifications));
      data.append('skills', JSON.stringify(skills));
      data.append('languages', JSON.stringify(languages));
      data.append('hobbies', JSON.stringify(hobbies));
      data.append('references', JSON.stringify(references));
      data.append('is_active', formData.is_active.toString());
      if (templateId) {
        data.append('template_id', templateId.toString());
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
      toast.error(`Error preparing form data: ${error}`);
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
    if (editingRefIndex === index) {
      setEditingRefIndex(null);
    }
  };

  const startEditReference = (index: number) => {
    const ref = references[index];
    if (!ref) return;
    setEditingRefIndex(index);
    setEditingRefDraft({
      name: ref.name || '',
      title: ref.title || '',
      company: ref.company || '',
      phone: ref.phone || '',
    });
  };

  const saveEditReference = () => {
    if (editingRefIndex == null) return;
    const trimmedName = editingRefDraft.name.trim();
    if (!trimmedName) return;
    setReferences(prev => prev.map((r, i) => (i === editingRefIndex ? { ...editingRefDraft, name: trimmedName } : r)));
    setEditingRefIndex(null);
  };

  const cancelEditReference = () => {
    setEditingRefIndex(null);
  };

  function moveItem<T>(arr: T[], from: number, to: number): T[] {
    if (to < 0 || to >= arr.length) return arr;
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  // Section limits from selected template
  const limits = selectedTemplate?.section_limits || {};

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Don't commit yet — open the cropper with the raw image
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Reset the input so picking the same file again still triggers change
      e.target.value = '';
    }
  };

  const openCropperForExisting = async () => {
    if (!photoPreview) return;
    if (photoPreview.startsWith('data:')) {
      // Newly uploaded — already a data URL
      setCropImageSrc(photoPreview);
      return;
    }
    // Existing server-hosted photo. Going through the API streams the bytes
    // same-origin (works for both local and R2-backed deployments) and avoids
    // R2's cross-origin CORS rules that block fetch().blob() on presigned URLs.
    try {
      let blob: Blob;
      if (isEditing && id) {
        const response = await employeeResumesApi.getPhoto(parseInt(id));
        blob = response.data as Blob;
      } else {
        const res = await fetch(photoPreview);
        blob = await res.blob();
      }
      const reader = new FileReader();
      reader.onloadend = () => setCropImageSrc(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to load existing photo for cropping', err);
      toast.error('Could not load the existing photo for cropping. Try re-uploading.');
    }
  };

  const handleCropComplete = (blob: Blob) => {
    const file = new File([blob], 'employee-photo.jpg', { type: blob.type || 'image/jpeg' });
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
      setCropImageSrc(null);
    };
    reader.readAsDataURL(blob);
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
        toast.error('Failed to delete photo. Please try again.');
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
    <div
      className="employee-resume-form"
      style={{
        maxWidth: 'none',
        margin: 0,
        padding: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @media (max-width: 1200px) {
          .employee-resume-grid { grid-template-columns: 1fr !important; }
          .employee-resume-preview-pane { position: static !important; max-height: none !important; }
        }
      `}</style>

      <div className="sales-page-header" style={{ flexShrink: 0, padding: '1rem 1.5rem 0', margin: 0 }}>
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
            👁️ Full Preview
          </button>
          <button className="btnSecondary" onClick={() => navigate('/employee-resumes')}>
            Cancel
          </button>
        </div>
      </div>

      <div
        className="employee-resume-grid"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '1.5rem',
          padding: '1rem 1.5rem',
        }}
      >
      <form
        onSubmit={handleSubmit}
        className="form-container"
        style={{ overflowY: 'auto', overflowX: 'hidden', paddingRight: '0.5rem', minHeight: 0 }}
      >
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

        {/* Resume Template */}
        <div className="card">
          <h2 className="section-title">Resume Template</h2>
          <p className="help-text" style={{ marginBottom: '1rem' }}>
            Choose the layout for the generated PDF. All templates are constrained to a single 8.5&times;11
            portrait page — content beyond each section's limit is omitted from the PDF (full data is preserved
            in the database).
          </p>

          {resumeTemplates.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
              No active templates available.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {resumeTemplates.map((tpl: ResumeTemplate) => {
                const isSelected = templateId === tpl.id;
                const limits = tpl.section_limits || {};
                return (
                  <label
                    key={tpl.id}
                    style={{
                      cursor: 'pointer',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                      backgroundColor: isSelected ? '#eff6ff' : '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="radio"
                        name="template_id"
                        checked={isSelected}
                        onChange={() => setTemplateId(tpl.id)}
                      />
                      <span style={{ fontWeight: 600, color: '#1f2937', flex: 1 }}>{tpl.name}</span>
                      {tpl.is_default && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: '#2563eb',
                            backgroundColor: '#dbeafe',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Default
                        </span>
                      )}
                      <Link
                        to={`/resume-templates/${tpl.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Edit this template in a new tab"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: '#2563eb',
                          textDecoration: 'none',
                          padding: '0.15rem 0.45rem',
                          border: '1px solid #bfdbfe',
                          borderRadius: '4px',
                          backgroundColor: '#eff6ff',
                        }}
                      >
                        ✎ Edit
                      </Link>
                    </div>
                    {tpl.description && (
                      <div style={{ color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.4 }}>
                        {tpl.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.15rem' }}>
                      {limits.projects != null && (
                        <span style={limitChipStyle}>{limits.projects} projects</span>
                      )}
                      {limits.certifications != null && (
                        <span style={limitChipStyle}>{limits.certifications} certs</span>
                      )}
                      {limits.skills != null && (
                        <span style={limitChipStyle}>{limits.skills} skills</span>
                      )}
                      {limits.references != null && (
                        <span style={limitChipStyle}>{limits.references} refs</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Certifications</h2>

          <RankableSectionList
            items={certifications}
            limit={limits.certifications}
            onMove={(from, to) => setCertifications(prev => moveItem(prev, from, to))}
            onRemove={removeCertification}
            renderContent={cert => (
              <span>
                <span style={{ fontWeight: 600 }}>{cert.name}</span>
                {cert.issuer && <span style={{ color: '#6b7280' }}> — {cert.issuer}</span>}
                {cert.year && <span style={{ color: '#6b7280' }}> ({cert.year})</span>}
              </span>
            )}
            emptyMessage="No certifications added yet."
          />

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

          <RankableSectionList
            items={skills}
            limit={limits.skills}
            onMove={(from, to) => setSkills(prev => moveItem(prev, from, to))}
            onRemove={index => setSkills(prev => prev.filter((_, i) => i !== index))}
            renderContent={skill => <span>{skill}</span>}
            emptyMessage="No skills added yet."
          />

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
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={openCropperForExisting}
                >
                  ✂️ Crop / Edit
                </button>
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={removePhoto}
                >
                  Remove Photo
                </button>
              </div>
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
                onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
                placeholder="(555) 123-4567"
                maxLength={14}
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

        </div>

        <div className="card">
          <h2 className="section-title">Languages</h2>

          <RankableSectionList
            items={languages}
            limit={limits.languages}
            onMove={(from, to) => setLanguages(prev => moveItem(prev, from, to))}
            onRemove={removeLanguage}
            renderContent={lang => (
              <span>
                <span style={{ fontWeight: 600 }}>{lang.language}</span>
                <span style={{ color: '#6b7280' }}> — {lang.proficiency}</span>
              </span>
            )}
            emptyMessage="No languages added yet."
          />

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

          <RankableSectionList
            items={hobbies}
            limit={limits.hobbies}
            onMove={(from, to) => setHobbies(prev => moveItem(prev, from, to))}
            onRemove={index => setHobbies(prev => prev.filter((_, i) => i !== index))}
            renderContent={hobby => <span>{hobby}</span>}
            emptyMessage="No hobbies added yet."
          />

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

          <RankableSectionList
            items={references}
            limit={limits.references}
            onMove={(from, to) => setReferences(prev => moveItem(prev, from, to))}
            onRemove={removeReference}
            onEdit={startEditReference}
            renderContent={ref => (
              <div>
                <span style={{ fontWeight: 600 }}>{ref.name}</span>
                {ref.title && <span style={{ color: '#6b7280' }}> — {ref.title}</span>}
                {(ref.company || ref.phone) && (
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.1rem' }}>
                    {ref.company}
                    {ref.company && ref.phone ? ' • ' : ''}
                    {ref.phone}
                  </div>
                )}
              </div>
            )}
            emptyMessage="No references added yet."
          />

          {editingRefIndex != null && (
            <div
              style={{
                marginTop: '0.75rem',
                marginBottom: '0.75rem',
                padding: '1rem',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                backgroundColor: '#eff6ff',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>
                Editing reference #{editingRefIndex + 1}
              </div>
              <div className="add-cert-form" style={{ marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Reference name"
                  value={editingRefDraft.name}
                  onChange={(e) => setEditingRefDraft({ ...editingRefDraft, name: e.target.value })}
                />
                <input
                  type="text"
                  className="input"
                  placeholder="Title (optional)"
                  value={editingRefDraft.title || ''}
                  onChange={(e) => setEditingRefDraft({ ...editingRefDraft, title: e.target.value })}
                />
                <input
                  type="text"
                  className="input"
                  placeholder="Company (optional)"
                  value={editingRefDraft.company || ''}
                  onChange={(e) => setEditingRefDraft({ ...editingRefDraft, company: e.target.value })}
                />
                <input
                  type="tel"
                  className="input"
                  placeholder="Phone (optional)"
                  value={editingRefDraft.phone || ''}
                  onChange={(e) => setEditingRefDraft({ ...editingRefDraft, phone: formatPhoneNumber(e.target.value) })}
                  maxLength={14}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btnSecondary" onClick={cancelEditReference}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={saveEditReference}
                  disabled={!editingRefDraft.name.trim()}
                >
                  Save Changes
                </button>
              </div>
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
              onChange={(e) => setNewReference({ ...newReference, phone: formatPhoneNumber(e.target.value) })}
              maxLength={14}
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
            limit={limits.projects}
          />
        </div>

        <div className="card">
          <h2 className="section-title">Status</h2>

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

        <div className="form-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              style={{
                background: 'none',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fef2f2';
                e.currentTarget.style.borderColor = '#fca5a5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
            >
              🗑️ Delete Resume
            </button>
          )}
          <div style={{ flex: 1 }} />
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

      <aside
        className="employee-resume-preview-pane"
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          backgroundColor: '#f3f4f6',
          padding: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            padding: '0 0.25rem',
            gap: '0.5rem',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Live Preview
          </span>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500, flex: 1, textAlign: 'center' }}>
            {selectedTemplate ? selectedTemplate.name : 'No template selected'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button type="button" onClick={() => adjustZoom(-0.1)} style={zoomBtnStyle} title="Zoom out">−</button>
            <button
              type="button"
              onClick={resetZoomToFit}
              style={{ ...zoomBtnStyle, width: 'auto', padding: '0 0.45rem', fontWeight: manualZoom == null ? 700 : 400, color: manualZoom == null ? '#2563eb' : '#374151' }}
              title="Fit to pane"
            >
              Fit
            </button>
            <button type="button" onClick={() => adjustZoom(0.1)} style={zoomBtnStyle} title="Zoom in">+</button>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
              {Math.round(zoomScale * 100)}%
            </span>
          </div>
        </div>
        <div
          ref={previewContainerRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: manualZoom != null ? 'auto' : 'hidden',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: `${PAGE_WIDTH_PX}px`,
              height: `${PAGE_HEIGHT_PX}px`,
              zoom: zoomScale,
              backgroundColor: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              border: '1px solid #d1d5db',
              overflow: 'hidden',
              flexShrink: 0,
            } as React.CSSProperties}
          >
            <ResumePreview
              resume={previewResume}
              projects={projects}
              photoPreviewUrl={photoPreview || undefined}
              template={selectedTemplate}
            />
          </div>
        </div>
      </aside>
      </div>

      {/* Full-screen Preview Modal */}
      <ResumePreviewModal
        resume={previewResume}
        projects={projects}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        photoPreviewUrl={photoPreview || undefined}
        template={selectedTemplate}
      />

      {/* Photo Crop Modal */}
      {cropImageSrc && (
        <ImageCropper
          imageSrc={cropImageSrc}
          aspectRatio={1}
          circularCrop
          title="Crop Employee Photo"
          description="Drag the corners to resize, drag inside to reposition. The photo is shown as a circle on the resume."
          outputType="image/jpeg"
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
};

export default EmployeeResumeForm;
