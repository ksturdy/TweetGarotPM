import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  caseStudiesApi,
  ImportResult,
  ImportProjectMatch,
  ImportCustomerMatch,
} from '../../services/caseStudies';
import { projectsApi, Project } from '../../services/projects';
import { customersApi } from '../../services/customers';
import '../../styles/SalesPipeline.css';

type Phase = 'upload' | 'review' | 'confirm';

interface ReviewItem {
  filename: string;
  included: boolean;
  parsed: ImportResult['parsed'];
  project_matches: ImportProjectMatch[];
  customer_matches: ImportCustomerMatch[];
  selectedProjectId: number | null;
  selectedCustomerId: number | null;
  editedTitle: string;
  showContent: boolean;
  manualProjectSearch: boolean;
  manualCustomerSearch: boolean;
}

const CaseStudyImport: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase state
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

  // Projects + customers for manual search
  const { data: allProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
    enabled: phase === 'review',
  });

  const { data: allCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
    enabled: phase === 'review',
  });

  // --- Upload handlers ---

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith('.docx')
    );
    if (droppedFiles.length === 0) {
      setImportError('Only .docx files are accepted');
      return;
    }
    setImportError(null);
    setFiles((prev) => [...prev, ...droppedFiles]);
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
      const response = await caseStudiesApi.importDocx(files);
      const results = response.data.results;

      const reviews: ReviewItem[] = [];
      const errors: { filename: string; error: string }[] = [];

      for (const r of results) {
        if (r.status === 'success' && r.parsed) {
          const topProject = r.project_matches && r.project_matches.length > 0 && r.project_matches[0].confidence >= 60
            ? r.project_matches[0].project_id
            : null;
          const topCustomer = r.customer_matches && r.customer_matches.length > 0 && r.customer_matches[0].confidence >= 60
            ? r.customer_matches[0].customer_id
            : null;

          reviews.push({
            filename: r.filename,
            included: true,
            parsed: r.parsed,
            project_matches: r.project_matches || [],
            customer_matches: r.customer_matches || [],
            selectedProjectId: topProject,
            selectedCustomerId: topCustomer,
            editedTitle: r.parsed.title || '',
            showContent: false,
            manualProjectSearch: false,
            manualCustomerSearch: false,
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
    setReviewItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  // --- Confirm handler ---

  const handleConfirm = async () => {
    const included = reviewItems.filter((r) => r.included);
    if (included.length === 0) return;

    setConfirming(true);
    try {
      const caseStudies = included.map((r) => ({
        _source_filename: r.filename,
        title: r.editedTitle,
        subtitle: r.parsed?.subtitle || null,
        project_ids: r.selectedProjectId ? [r.selectedProjectId] : [],
        customer_id: r.selectedCustomerId || null,
        challenge: r.parsed?.challenge || null,
        solution: r.parsed?.solution || null,
        results: r.parsed?.results || null,
        executive_summary: r.parsed?.executive_summary || null,
        market: r.parsed?.market || null,
        construction_type: r.parsed?.construction_type || [],
        services_provided: r.parsed?.services_provided || [],
        contract_value: r.parsed?.contract_value || null,
        square_footage: r.parsed?.square_footage || null,
        extracted_images: r.parsed?.extracted_images || [],
      }));

      const response = await caseStudiesApi.confirmImport(caseStudies);
      setConfirmResults(response.data);
      setPhase('confirm');
    } catch (err: any) {
      setImportError(err.response?.data?.error || err.message || 'Confirm failed');
    } finally {
      setConfirming(false);
    }
  };

  // --- Render ---

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const includedCount = reviewItems.filter((r) => r.included).length;

  return (
    <div className="sales-pipeline-container">
      {/* Header */}
      <div className="sales-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link to="/case-studies" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
              Case Studies
            </Link>
            <span style={{ color: '#9ca3af' }}>/</span>
          </div>
          <h1>Import Case Studies from Word</h1>
          <div className="sales-subtitle">
            {phase === 'upload' && 'Upload .docx case study files to parse and import'}
            {phase === 'review' && `${reviewItems.length} document(s) parsed - review and confirm`}
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
              {(phase === 'review' && p === 'upload') || (phase === 'confirm' && p !== 'confirm') ? '\u2713' : i + 1}
            </span>
            <span style={{ textTransform: 'capitalize' }}>{p}</span>
            {i < 2 && <span style={{ color: '#d1d5db', marginLeft: '0.5rem' }}>&mdash;</span>}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {importError && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
          }}
        >
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
          {/* Drop zone */}
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
              {isDragging ? '\uD83D\uDCE5' : '\uD83D\uDCC4'}
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

          {/* File list */}
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
                    <span style={{ color: '#2563eb' }}>{'\uD83D\uDCC4'}</span>
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

          {/* Upload button */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleUploadAndParse}
              disabled={files.length === 0 || importing}
              style={{ minWidth: '200px' }}
            >
              {importing ? 'Processing with AI...' : `Upload & Parse ${files.length > 0 ? `(${files.length} file${files.length !== 1 ? 's' : ''})` : ''}`}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/case-studies')}>
              Cancel
            </button>
          </div>

          {/* Processing indicator */}
          {importing && (
            <div
              className="card"
              style={{
                marginTop: '1.5rem',
                padding: '1.5rem',
                textAlign: 'center',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
              }}
            >
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                Processing {files.length} document{files.length !== 1 ? 's' : ''} with AI...
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                Each document is being scanned, parsed, and matched to existing projects.
                This may take a few minutes for larger batches.
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================== REVIEW PHASE ======================== */}
      {phase === 'review' && (
        <>
          {/* Error files */}
          {errorItems.length > 0 && (
            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
              }}
            >
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

          {/* Review cards */}
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
              {/* Header row */}
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
                </div>
              </div>

              {/* Editable title */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                  Title
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={item.editedTitle}
                  onChange={(e) => updateReviewItem(index, { editedTitle: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Metadata chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {item.parsed?.market && (
                  <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 500 }}>
                    {item.parsed.market}
                  </span>
                )}
                {item.parsed?.construction_type?.map((ct) => (
                  <span key={ct} style={{ padding: '0.25rem 0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 500 }}>
                    {ct}
                  </span>
                ))}
                {item.parsed?.services_provided?.map((s) => (
                  <span key={s} style={{ padding: '0.25rem 0.75rem', backgroundColor: '#fefce8', color: '#ca8a04', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 500 }}>
                    {s}
                  </span>
                ))}
                {item.parsed?.square_footage && (
                  <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '9999px', fontSize: '0.8rem' }}>
                    {item.parsed.square_footage.toLocaleString()} sq ft
                  </span>
                )}
                {item.parsed?.contract_value && (
                  <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '9999px', fontSize: '0.8rem' }}>
                    {formatCurrency(item.parsed.contract_value)}
                  </span>
                )}
                {item.parsed?.project_duration && (
                  <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '9999px', fontSize: '0.8rem' }}>
                    {item.parsed.project_duration}
                  </span>
                )}
              </div>

              {/* Extracted images */}
              {item.parsed?.extracted_images && item.parsed.extracted_images.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>{'\uD83D\uDDBC\uFE0F'}</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>
                    {item.parsed.extracted_images.length} image{item.parsed.extracted_images.length !== 1 ? 's' : ''} extracted
                  </span>
                  <span style={{ color: '#6b7280' }}>
                    ({item.parsed.extracted_images.map(img => (img.file_size / 1024).toFixed(0) + ' KB').join(', ')})
                  </span>
                  <span style={{ color: '#6b7280' }}>
                    &mdash; will be attached on import
                  </span>
                </div>
              )}

              {/* Two-column: Project match + Customer match */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                {/* Project match */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                    Project Match
                  </label>
                  {item.project_matches.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {item.project_matches.map((pm) => (
                        <label
                          key={pm.project_id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            backgroundColor: item.selectedProjectId === pm.project_id ? '#eff6ff' : '#fafafa',
                            border: item.selectedProjectId === pm.project_id ? '1px solid #bfdbfe' : '1px solid #f3f4f6',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          <input
                            type="radio"
                            name={`project-${index}`}
                            checked={item.selectedProjectId === pm.project_id}
                            onChange={() => updateReviewItem(index, { selectedProjectId: pm.project_id, manualProjectSearch: false })}
                            style={{ marginTop: '2px' }}
                          />
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {pm.project_name}
                              <span style={{ color: '#6b7280', fontWeight: 400 }}> #{pm.project_number}</span>
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                              {pm.client} {pm.contract_value ? `| ${formatCurrency(pm.contract_value)}` : ''}
                            </div>
                            <div style={{
                              display: 'inline-block',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              marginTop: '0.15rem',
                              backgroundColor: pm.confidence >= 70 ? '#dcfce7' : pm.confidence >= 40 ? '#fefce8' : '#fef2f2',
                              color: pm.confidence >= 70 ? '#16a34a' : pm.confidence >= 40 ? '#ca8a04' : '#dc2626',
                            }}>
                              {pm.confidence}% match
                            </div>
                            {pm.match_reasons.length > 0 && (
                              <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                {pm.match_reasons.join(' | ')}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: '#6b7280',
                        }}
                      >
                        <input
                          type="radio"
                          name={`project-${index}`}
                          checked={item.selectedProjectId === null && !item.manualProjectSearch}
                          onChange={() => updateReviewItem(index, { selectedProjectId: null, manualProjectSearch: false })}
                        />
                        No project match
                      </label>
                    </div>
                  ) : (
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      No automatic matches found
                    </div>
                  )}
                  {/* Manual search toggle */}
                  {!item.manualProjectSearch ? (
                    <button
                      onClick={() => updateReviewItem(index, { manualProjectSearch: true })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        padding: '0.25rem 0',
                        marginTop: '0.25rem',
                      }}
                    >
                      Search for a different project...
                    </button>
                  ) : (
                    <div style={{ marginTop: '0.5rem' }}>
                      <select
                        className="form-input"
                        value={item.selectedProjectId || ''}
                        onChange={(e) => updateReviewItem(index, {
                          selectedProjectId: e.target.value ? Number(e.target.value) : null,
                        })}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Select project --</option>
                        {(allProjects || []).map((p: Project) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (#{p.number}) - {p.client}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Customer match */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                    Customer Match
                    {item.parsed?.owner && (
                      <span style={{ fontWeight: 400, color: '#9ca3af' }}> (Doc: {item.parsed.owner})</span>
                    )}
                  </label>
                  {item.customer_matches.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {item.customer_matches.map((cm) => (
                        <label
                          key={cm.customer_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            backgroundColor: item.selectedCustomerId === cm.customer_id ? '#eff6ff' : '#fafafa',
                            border: item.selectedCustomerId === cm.customer_id ? '1px solid #bfdbfe' : '1px solid #f3f4f6',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          <input
                            type="radio"
                            name={`customer-${index}`}
                            checked={item.selectedCustomerId === cm.customer_id}
                            onChange={() => updateReviewItem(index, { selectedCustomerId: cm.customer_id, manualCustomerSearch: false })}
                          />
                          <span style={{ fontWeight: 500 }}>{cm.customer_name}</span>
                          <span
                            style={{
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: cm.confidence >= 70 ? '#dcfce7' : '#fefce8',
                              color: cm.confidence >= 70 ? '#16a34a' : '#ca8a04',
                            }}
                          >
                            {cm.confidence}%
                          </span>
                        </label>
                      ))}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: '#6b7280',
                        }}
                      >
                        <input
                          type="radio"
                          name={`customer-${index}`}
                          checked={item.selectedCustomerId === null && !item.manualCustomerSearch}
                          onChange={() => updateReviewItem(index, { selectedCustomerId: null, manualCustomerSearch: false })}
                        />
                        No customer match
                      </label>
                    </div>
                  ) : (
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      No automatic matches found
                    </div>
                  )}
                  {!item.manualCustomerSearch ? (
                    <button
                      onClick={() => updateReviewItem(index, { manualCustomerSearch: true })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        padding: '0.25rem 0',
                        marginTop: '0.25rem',
                      }}
                    >
                      Search for a different customer...
                    </button>
                  ) : (
                    <div style={{ marginTop: '0.5rem' }}>
                      <select
                        className="form-input"
                        value={item.selectedCustomerId || ''}
                        onChange={(e) => updateReviewItem(index, {
                          selectedCustomerId: e.target.value ? Number(e.target.value) : null,
                        })}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Select customer --</option>
                        {(allCustomers || []).map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.customer_owner}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra metadata from doc */}
              {(item.parsed?.general_contractor || item.parsed?.architect || item.parsed?.engineer) && (
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
                  {item.parsed?.general_contractor && <span><strong>GC:</strong> {item.parsed.general_contractor}</span>}
                  {item.parsed?.architect && <span><strong>Architect:</strong> {item.parsed.architect}</span>}
                  {item.parsed?.engineer && <span><strong>Engineer:</strong> {item.parsed.engineer}</span>}
                </div>
              )}

              {/* Content preview toggle */}
              <button
                onClick={() => updateReviewItem(index, { showContent: !item.showContent })}
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
                }}
              >
                {item.showContent ? '\u25BC' : '\u25B6'} {item.showContent ? 'Hide' : 'Show'} Content Preview
              </button>
              {item.showContent && (
                <div style={{ marginTop: '0.75rem', padding: '1rem', backgroundColor: '#fafafa', borderRadius: '6px', fontSize: '0.85rem', lineHeight: '1.6' }}>
                  {item.parsed?.challenge && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <strong style={{ color: '#374151' }}>Challenge:</strong>
                      <div style={{ color: '#4b5563', marginTop: '0.25rem' }} dangerouslySetInnerHTML={{ __html: item.parsed.challenge }} />
                    </div>
                  )}
                  {item.parsed?.solution && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <strong style={{ color: '#374151' }}>Solution:</strong>
                      <div style={{ color: '#4b5563', marginTop: '0.25rem' }} dangerouslySetInnerHTML={{ __html: item.parsed.solution }} />
                    </div>
                  )}
                  {item.parsed?.results && (
                    <div>
                      <strong style={{ color: '#374151' }}>Results:</strong>
                      <div style={{ color: '#4b5563', marginTop: '0.25rem' }} dangerouslySetInnerHTML={{ __html: item.parsed.results }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={includedCount === 0 || confirming}
            >
              {confirming ? 'Creating...' : `Create ${includedCount} Case Stud${includedCount === 1 ? 'y' : 'ies'}`}
            </button>
            <button className="btn btn-secondary" onClick={() => { setPhase('upload'); setFiles([]); }}>
              Start Over
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/case-studies')}>
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ======================== CONFIRM PHASE ======================== */}
      {phase === 'confirm' && confirmResults && (
        <>
          {/* Success */}
          {confirmResults.created.length > 0 && (
            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
                padding: '1.5rem',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem 0', color: '#16a34a' }}>
                {confirmResults.created.length} Case Stud{confirmResults.created.length === 1 ? 'y' : 'ies'} Created
              </h3>
              <p style={{ color: '#374151', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>
                All imported case studies have been saved as <strong>drafts</strong>. You can edit them
                to add images, adjust content, and publish when ready.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {confirmResults.created.map((c: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{'\u2713'}</span>
                    <Link
                      to={`/case-studies/${c.case_study.id}`}
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                    >
                      {c.case_study.title}
                    </Link>
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>from {c.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {confirmResults.errors.length > 0 && (
            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
                padding: '1.5rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626' }}>
                {confirmResults.errors.length} Failed
              </h3>
              {confirmResults.errors.map((e: any, i: number) => (
                <div key={i} style={{ padding: '0.25rem 0', fontSize: '0.9rem' }}>
                  <strong>{e.title || e.filename}</strong>: {e.error}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/case-studies')}>
              View All Case Studies
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

export default CaseStudyImport;
