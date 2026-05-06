import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  employeeResumesApi,
  ResumeImportResult,
  ResumeImportParsedData,
  ResumeImportProject,
  Certification,
} from '../../services/employeeResumes';
import { projectsApi, Project } from '../../services/projects';
import { employeesApi, Employee } from '../../services/employees';
import SearchableSelect from '../../components/SearchableSelect';
import '../../styles/SalesPipeline.css';

type Phase = 'upload' | 'review' | 'confirm';

interface ReviewProject extends ResumeImportProject {
  included: boolean;
  selected_project_id: number | null;
  manualSearch: boolean;
}

interface ReviewItem {
  filename: string;
  included: boolean;
  parsed: ResumeImportParsedData;
  // Editable resume fields
  employee_name: string;
  job_title: string;
  years_experience: string;
  summary: string;
  education: string;
  phone: string;
  email: string;
  address: string;
  certifications: Certification[];
  skills: string[];
  projects: ReviewProject[];
  selected_employee_id: number | null;
  manualEmployeeSearch: boolean;
  showSummary: boolean;
}

const EmployeeResumeImport: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');

  // Upload phase
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Review phase
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [errorItems, setErrorItems] = useState<{ filename: string; error: string }[]>([]);

  // Confirm phase
  const [confirming, setConfirming] = useState(false);
  const [confirmResults, setConfirmResults] = useState<{
    created: any[];
    errors: any[];
  } | null>(null);

  const { data: allProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
    enabled: phase === 'review',
  });

  const { data: allEmployees } = useQuery({
    queryKey: ['employees', 'all-active'],
    queryFn: () =>
      employeesApi.getAll({ employmentStatus: 'active' }).then((res) => res.data.data),
    enabled: phase === 'review',
  });

  // --- Upload handlers ---

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith('.docx')
    );
    if (dropped.length === 0) {
      setImportError('Only .docx files are accepted');
      return;
    }
    setImportError(null);
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter((f) =>
        f.name.toLowerCase().endsWith('.docx')
      );
      setImportError(null);
      setFiles((prev) => [...prev, ...selected]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndParse = async () => {
    if (files.length === 0) return;
    setImporting(true);
    setImportError(null);

    try {
      const response = await employeeResumesApi.importDocx(files);
      const results = response.data.results;

      const reviews: ReviewItem[] = [];
      const errors: { filename: string; error: string }[] = [];

      for (const r of results) {
        if (r.status === 'success' && r.parsed) {
          const parsed = r.parsed;
          const projects: ReviewProject[] = (parsed.projects || []).map((p) => {
            const top = p.matches && p.matches.length > 0 && p.matches[0].confidence >= 60
              ? p.matches[0].project_id
              : null;
            return {
              ...p,
              included: true,
              selected_project_id: top,
              manualSearch: false,
            };
          });

          const topEmployee =
            parsed.employee_matches && parsed.employee_matches.length > 0 && parsed.employee_matches[0].confidence >= 60
              ? parsed.employee_matches[0].employee_id
              : null;

          reviews.push({
            filename: r.filename,
            included: true,
            parsed,
            employee_name: parsed.employee_name || '',
            job_title: parsed.job_title || '',
            years_experience: parsed.years_experience != null ? String(parsed.years_experience) : '',
            summary: parsed.summary || '',
            education: parsed.education || '',
            phone: parsed.phone || '',
            email: parsed.email || '',
            address: parsed.address || '',
            certifications: parsed.certifications || [],
            skills: parsed.skills || [],
            projects,
            selected_employee_id: topEmployee,
            manualEmployeeSearch: false,
            showSummary: false,
          });
        } else {
          errors.push({ filename: r.filename, error: r.error || 'Unknown error' });
        }
      }

      setReviewItems(reviews);
      setErrorItems(errors);
      setPhase('review');
    } catch (err: any) {
      setImportError(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // --- Review handlers ---

  const updateReviewItem = (index: number, updates: Partial<ReviewItem>) => {
    setReviewItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const updateProject = (resumeIdx: number, projectIdx: number, updates: Partial<ReviewProject>) => {
    setReviewItems((prev) =>
      prev.map((item, i) => {
        if (i !== resumeIdx) return item;
        return {
          ...item,
          projects: item.projects.map((p, pi) => (pi === projectIdx ? { ...p, ...updates } : p)),
        };
      })
    );
  };

  const removeCertification = (resumeIdx: number, certIdx: number) => {
    setReviewItems((prev) =>
      prev.map((item, i) =>
        i === resumeIdx
          ? { ...item, certifications: item.certifications.filter((_, ci) => ci !== certIdx) }
          : item
      )
    );
  };

  const removeSkill = (resumeIdx: number, skillIdx: number) => {
    setReviewItems((prev) =>
      prev.map((item, i) =>
        i === resumeIdx
          ? { ...item, skills: item.skills.filter((_, si) => si !== skillIdx) }
          : item
      )
    );
  };

  const handleConfirm = async () => {
    const included = reviewItems.filter((r) => r.included);
    if (included.length === 0) return;

    setConfirming(true);
    try {
      const payload = included.map((r) => ({
        _source_filename: r.filename,
        selected_employee_id: r.selected_employee_id,
        employee_name: r.employee_name,
        job_title: r.job_title,
        years_experience: r.years_experience ? parseInt(r.years_experience) : null,
        summary: r.summary,
        education: r.education || null,
        phone: r.phone || null,
        email: r.email || null,
        address: r.address || null,
        certifications: r.certifications,
        skills: r.skills,
        languages: r.parsed.languages || [],
        hobbies: r.parsed.hobbies || [],
        references: r.parsed.references || [],
        extracted_photo: r.parsed.extracted_photo || null,
        source_file: r.parsed.source_file || null,
        projects: r.projects.map((p) => ({
          included: p.included,
          project_name: p.project_name,
          location: p.location,
          customer_name: p.customer_name,
          project_role: p.project_role,
          description: p.description,
          selected_project_id: p.selected_project_id,
        })),
      }));

      const response = await employeeResumesApi.confirmImport(payload);
      setConfirmResults(response.data);
      setPhase('confirm');
    } catch (err: any) {
      setImportError(err.response?.data?.error || err.message || 'Confirm failed');
    } finally {
      setConfirming(false);
    }
  };

  const includedCount = reviewItems.filter((r) => r.included).length;

  return (
    <div className="sales-pipeline-container">
      <div className="sales-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link to="/employee-resumes" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
              Employee Resumes
            </Link>
            <span style={{ color: '#9ca3af' }}>/</span>
          </div>
          <h1>Import Resumes from Word</h1>
          <div className="sales-subtitle">
            {phase === 'upload' && 'Upload .docx resume files to parse and import'}
            {phase === 'review' && `${reviewItems.length} resume(s) parsed - review and confirm`}
            {phase === 'confirm' && 'Import complete'}
          </div>
        </div>
      </div>

      {/* Phase indicator */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
        {(['upload', 'review', 'confirm'] as Phase[]).map((p, i) => (
          <div
            key={p}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: phase === p ? '#2563eb' : p === 'confirm' && phase !== 'confirm' ? '#9ca3af' : '#6b7280',
              fontWeight: phase === p ? 600 : 400,
            }}
          >
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: phase === p ? '#2563eb' : (phase === 'review' && p === 'upload') || (phase === 'confirm') ? '#10b981' : '#e5e7eb',
                color: phase === p || (phase === 'review' && p === 'upload') || phase === 'confirm' ? '#fff' : '#6b7280',
              }}
            >
              {(phase === 'review' && p === 'upload') || (phase === 'confirm' && p !== 'confirm') ? '✓' : i + 1}
            </span>
            <span style={{ textTransform: 'capitalize' }}>{p}</span>
            {i < 2 && <span style={{ color: '#d1d5db', marginLeft: '0.5rem' }}>&mdash;</span>}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {importError && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
          {importError}
          <button
            onClick={() => setImportError(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ======================== UPLOAD PHASE ======================== */}
      {phase === 'upload' && (
        <>
          <div
            className="card"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              border: isDragging ? '2px dashed #2563eb' : '2px dashed #d1d5db',
              backgroundColor: isDragging ? '#eff6ff' : '#fafafa',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
              {isDragging ? '📥' : '📄'}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              {isDragging ? 'Drop files here' : 'Drag & drop .docx files here'}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              or click to browse - accepts Word documents (.docx)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {files.length > 0 && (
            <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </h3>
              {files.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: i < files.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#2563eb' }}>{'📄'}</span>
                    <span>{f.name}</span>
                    <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                      ({(f.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ef4444',
                      fontSize: '1.1rem',
                      padding: '0.25rem 0.5rem',
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleUploadAndParse}
              disabled={files.length === 0 || importing}
              style={{ minWidth: '200px' }}
            >
              {importing ? 'Processing with AI...' : `Upload & Parse ${files.length > 0 ? `(${files.length} file${files.length !== 1 ? 's' : ''})` : ''}`}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/employee-resumes')}>
              Cancel
            </button>
          </div>

          {importing && (
            <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem', textAlign: 'center', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                Processing {files.length} resume{files.length !== 1 ? 's' : ''} with AI...
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                Each document is being scanned for employee details, certifications, and project history.
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================== REVIEW PHASE ======================== */}
      {phase === 'review' && (
        <>
          {errorItems.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626', fontSize: '1rem' }}>
                {errorItems.length} file{errorItems.length !== 1 ? 's' : ''} failed to parse
              </h3>
              {errorItems.map((e, i) => (
                <div key={i} style={{ padding: '0.25rem 0', fontSize: '0.9rem' }}>
                  <strong>{e.filename}</strong>: {e.error}
                </div>
              ))}
            </div>
          )}

          {reviewItems.map((item, index) => (
            <div
              key={index}
              className="card"
              style={{
                marginBottom: '1.5rem',
                padding: '1.25rem',
                opacity: item.included ? 1 : 0.5,
                border: item.included ? '1px solid #e5e7eb' : '1px solid #f3f4f6',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(e) => updateReviewItem(index, { included: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{item.filename}</span>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#dcfce7',
                      color: '#16a34a',
                    }}
                  >
                    Parsed
                  </span>
                  {item.parsed.extracted_photo && (
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: '#fefce8',
                        color: '#ca8a04',
                      }}
                    >
                      Headshot included
                    </span>
                  )}
                </div>
              </div>

              {/* Basic info row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                    Employee Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.employee_name}
                    onChange={(e) => updateReviewItem(index, { employee_name: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                    Job Title
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.job_title}
                    onChange={(e) => updateReviewItem(index, { job_title: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                    Years Experience
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={item.years_experience}
                    onChange={(e) => updateReviewItem(index, { years_experience: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Vista Employee Match */}
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#fafafa',
                  borderRadius: '6px',
                  border: '1px solid #f3f4f6',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                    Match to Vista Employee
                  </label>
                  {item.selected_employee_id == null && !item.manualEmployeeSearch && (
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                      No employee linked
                    </span>
                  )}
                </div>

                {!item.manualEmployeeSearch ? (
                  <>
                    {item.parsed.employee_matches && item.parsed.employee_matches.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {item.parsed.employee_matches.map((em) => (
                          <label
                            key={em.employee_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              backgroundColor: item.selected_employee_id === em.employee_id ? '#eff6ff' : '#fff',
                              border: item.selected_employee_id === em.employee_id ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                            }}
                          >
                            <input
                              type="radio"
                              name={`employee-${index}`}
                              checked={item.selected_employee_id === em.employee_id}
                              onChange={() => updateReviewItem(index, { selected_employee_id: em.employee_id, manualEmployeeSearch: false })}
                            />
                            <span style={{ fontWeight: 500 }}>{em.full_name}</span>
                            {em.job_title && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>· {em.job_title}</span>}
                            {em.department_name && <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>· {em.department_name}</span>}
                            <span
                              style={{
                                marginLeft: 'auto',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: em.confidence >= 70 ? '#dcfce7' : em.confidence >= 40 ? '#fefce8' : '#fef2f2',
                                color: em.confidence >= 70 ? '#16a34a' : em.confidence >= 40 ? '#ca8a04' : '#dc2626',
                              }}
                            >
                              {em.confidence}%
                            </span>
                          </label>
                        ))}
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: '#6b7280',
                          }}
                        >
                          <input
                            type="radio"
                            name={`employee-${index}`}
                            checked={item.selected_employee_id === null}
                            onChange={() => updateReviewItem(index, { selected_employee_id: null, manualEmployeeSearch: false })}
                          />
                          No employee link
                        </label>
                      </div>
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                        No automatic matches found
                      </div>
                    )}
                    <button
                      onClick={() => updateReviewItem(index, { manualEmployeeSearch: true })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        padding: '0.35rem 0 0',
                      }}
                    >
                      Search for a different employee...
                    </button>
                  </>
                ) : (
                  <div>
                    <SearchableSelect
                      options={(allEmployees || []).map((emp: Employee) => ({
                        value: emp.id,
                        label: `${emp.first_name} ${emp.last_name}${emp.job_title ? ` · ${emp.job_title}` : ''}`,
                        searchText: `${emp.first_name} ${emp.last_name} ${emp.email || ''} ${emp.job_title || ''} ${emp.department_name || ''}`,
                      }))}
                      value={item.selected_employee_id ? String(item.selected_employee_id) : ''}
                      onChange={(val) =>
                        updateReviewItem(index, {
                          selected_employee_id: val ? Number(val) : null,
                        })
                      }
                      placeholder="-- No employee link --"
                      style={{ width: '100%' }}
                    />
                    <button
                      onClick={() => updateReviewItem(index, { manualEmployeeSearch: false })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        padding: '0.35rem 0 0',
                      }}
                    >
                      ← Back to suggestions
                    </button>
                  </div>
                )}
              </div>

              {/* Contact row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.phone}
                    onChange={(e) => updateReviewItem(index, { phone: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Email</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.email}
                    onChange={(e) => updateReviewItem(index, { email: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.address}
                    onChange={(e) => updateReviewItem(index, { address: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Summary toggle */}
              <button
                onClick={() => updateReviewItem(index, { showSummary: !item.showSummary })}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#2563eb',
                  fontSize: '0.85rem',
                  padding: '0.25rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  marginBottom: '0.5rem',
                }}
              >
                {item.showSummary ? '▼' : '▶'} {item.showSummary ? 'Hide' : 'Edit'} Summary &amp; Education
              </button>
              {item.showSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Professional Summary</label>
                    <textarea
                      className="form-input"
                      value={item.summary}
                      onChange={(e) => updateReviewItem(index, { summary: e.target.value })}
                      rows={6}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Education</label>
                    <textarea
                      className="form-input"
                      value={item.education}
                      onChange={(e) => updateReviewItem(index, { education: e.target.value })}
                      rows={6}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* Certifications */}
              {item.certifications.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                    Certifications ({item.certifications.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {item.certifications.map((c, ci) => (
                      <span
                        key={ci}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.25rem 0.6rem',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        {c.name}
                        {c.issuer ? ` - ${c.issuer}` : ''}
                        {c.year ? ` (${c.year})` : ''}
                        <button
                          onClick={() => removeCertification(index, ci)}
                          style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}
                          title="Remove"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {item.skills.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                    Skills ({item.skills.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {item.skills.map((s, si) => (
                      <span
                        key={si}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.25rem 0.6rem',
                          backgroundColor: '#f0fdf4',
                          color: '#16a34a',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        {s}
                        <button
                          onClick={() => removeSkill(index, si)}
                          style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}
                          title="Remove"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {item.projects.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                    Project Experience ({item.projects.filter((p) => p.included).length} of {item.projects.length} selected)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {item.projects.map((p, pi) => {
                      const topMatch = p.matches && p.matches.length > 0 ? p.matches[0] : null;
                      return (
                        <div
                          key={pi}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 2fr 1.5fr 2fr',
                            gap: '0.75rem',
                            alignItems: 'center',
                            padding: '0.6rem',
                            backgroundColor: p.included ? '#fafafa' : '#f9fafb',
                            borderRadius: '6px',
                            border: '1px solid #f3f4f6',
                            opacity: p.included ? 1 : 0.55,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={p.included}
                            onChange={(e) => updateProject(index, pi, { included: e.target.checked })}
                            style={{ width: '16px', height: '16px' }}
                          />
                          <div style={{ fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 500 }}>{p.project_name}</div>
                            {p.location && <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{p.location}</div>}
                            {p.category && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  marginTop: '0.15rem',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                }}
                              >
                                {p.category}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            {p.customer_name || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No customer</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem' }}>
                            {!p.manualSearch ? (
                              <>
                                {topMatch ? (
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={p.selected_project_id === topMatch.project_id}
                                      onChange={(e) =>
                                        updateProject(index, pi, {
                                          selected_project_id: e.target.checked ? topMatch.project_id : null,
                                        })
                                      }
                                    />
                                    <span style={{ fontWeight: 500 }}>{topMatch.project_name}</span>
                                    <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>#{topMatch.project_number}</span>
                                    <span
                                      style={{
                                        padding: '0.1rem 0.35rem',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        backgroundColor: topMatch.confidence >= 70 ? '#dcfce7' : topMatch.confidence >= 40 ? '#fefce8' : '#fef2f2',
                                        color: topMatch.confidence >= 70 ? '#16a34a' : topMatch.confidence >= 40 ? '#ca8a04' : '#dc2626',
                                      }}
                                    >
                                      {topMatch.confidence}%
                                    </span>
                                  </label>
                                ) : (
                                  <span style={{ color: '#9ca3af' }}>No DB match</span>
                                )}
                                <button
                                  onClick={() => updateProject(index, pi, { manualSearch: true })}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#2563eb',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    padding: '0.15rem 0',
                                    display: 'block',
                                  }}
                                >
                                  Pick different project...
                                </button>
                              </>
                            ) : (
                              <SearchableSelect
                                options={(allProjects || []).map((proj: Project) => ({
                                  value: proj.id,
                                  label: `${proj.name} (#${proj.number})${proj.client ? ` - ${proj.client}` : ''}`,
                                  searchText: `${proj.name} ${proj.number} ${proj.client || ''} ${proj.address || ''}`,
                                }))}
                                value={p.selected_project_id ? String(p.selected_project_id) : ''}
                                onChange={(val) =>
                                  updateProject(index, pi, {
                                    selected_project_id: val ? Number(val) : null,
                                  })
                                }
                                placeholder="-- No DB project link --"
                                style={{ width: '100%' }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={includedCount === 0 || confirming}
            >
              {confirming ? 'Creating...' : `Create ${includedCount} Resume${includedCount === 1 ? '' : 's'}`}
            </button>
            <button className="btn btn-secondary" onClick={() => { setPhase('upload'); setFiles([]); }}>
              Start Over
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/employee-resumes')}>
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ======================== CONFIRM PHASE ======================== */}
      {phase === 'confirm' && confirmResults && (
        <>
          {confirmResults.created.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', color: '#16a34a' }}>
                {confirmResults.created.length} Resume{confirmResults.created.length === 1 ? '' : 's'} Created
              </h3>
              <p style={{ color: '#374151', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>
                Imported resumes have been saved. You can edit them to fine-tune content, add a photo, and review project details.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {confirmResults.created.map((c: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{'✓'}</span>
                    <Link to={`/employee-resumes/${c.resume.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                      {c.resume.employee_name}
                    </Link>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      {c.project_count} project{c.project_count === 1 ? '' : 's'}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>from {c.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {confirmResults.errors.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626' }}>
                {confirmResults.errors.length} Failed
              </h3>
              {confirmResults.errors.map((e: any, i: number) => (
                <div key={i} style={{ padding: '0.25rem 0', fontSize: '0.9rem' }}>
                  <strong>{e.employee_name || e.filename}</strong>: {e.error}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/employee-resumes')}>
              View All Resumes
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setPhase('upload');
                setFiles([]);
                setReviewItems([]);
                setErrorItems([]);
                setConfirmResults(null);
              }}
            >
              Import More
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeeResumeImport;
