import React, { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  estimatesApi,
  CostTabImportPreview,
  CostTabImportSection,
  Estimate,
} from '../../services/estimates';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

interface EstimateImportModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (estimate: Estimate) => void;
}

const COST_TYPE_COLORS: Record<number, string> = {
  1: '#2563eb', // Labor
  2: '#10b981', // Material
  3: '#f59e0b', // Subcontracts
  4: '#8b5cf6', // Rentals
  5: '#06b6d4', // MEP Equipment
  6: '#ec4899', // General Conditions
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value || 0);

const EstimateImportModal: React.FC<EstimateImportModalProps> = ({ open, onClose, onCreated }) => {
  const { toast } = useTitanFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CostTabImportPreview | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const previewMutation = useMutation({
    mutationFn: (file: File) => estimatesApi.previewImport(file),
    onSuccess: (res) => setPreview(res.data),
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to read file';
      toast.error(msg);
      setSelectedFile(null);
      setPreview(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (file: File) => estimatesApi.createFromImport(file),
    onSuccess: (res) => {
      toast.success(`Estimate created: ${res.data.estimate_number}`);
      onCreated(res.data);
      reset();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to create estimate';
      toast.error(msg);
    },
  });

  const reset = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (createMutation.isPending || previewMutation.isPending) return;
    reset();
    onClose();
  };

  const handleFile = (file: File) => {
    const validExt = ['.xlsm', '.xlsx', '.xls'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExt.includes(ext)) {
      toast.warning('Please select an Excel file (.xlsm, .xlsx, or .xls)');
      return;
    }
    setSelectedFile(file);
    setPreview(null);
    previewMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleCreate = () => {
    if (selectedFile) createMutation.mutate(selectedFile);
  };

  if (!open) return null;

  const isBusy = previewMutation.isPending || createMutation.isPending;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, padding: '24px 28px',
          maxWidth: 880, width: '92%', maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Import Estimate</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              Upload a Master Cost Tabulation spreadsheet (.xlsm). Titan will pull the project name, estimator, and costs grouped by Vista cost type.
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isBusy}
            style={{ background: 'none', border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer', color: '#9ca3af', padding: 4 }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Upload zone — shown when no preview yet */}
        {!preview && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? '#2563eb' : '#d1d5db'}`,
              borderRadius: 12, padding: '40px 20px', textAlign: 'center',
              cursor: isBusy ? 'wait' : 'pointer',
              background: dragActive ? '#eff6ff' : '#f9fafb',
              transition: 'all 0.15s',
            }}
          >
            <UploadFileIcon style={{ fontSize: 48, color: '#9ca3af', marginBottom: 8 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
              {previewMutation.isPending
                ? `Reading ${selectedFile?.name || 'file'}...`
                : 'Drop the spreadsheet here, or click to browse'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Accepts .xlsm, .xlsx, or .xls — must contain a "Cost Tab" sheet
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsm,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div>
            <PreviewBody preview={preview} filename={selectedFile?.name || preview.filename} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={reset}
                disabled={isBusy}
                style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  background: '#fff', color: '#374151', border: '1px solid #d1d5db',
                  borderRadius: 6, cursor: isBusy ? 'not-allowed' : 'pointer',
                }}
              >
                Choose Different File
              </button>
              <button
                onClick={handleCreate}
                disabled={isBusy}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600,
                  background: '#1a56db', color: '#fff', border: 'none',
                  borderRadius: 6, cursor: isBusy ? 'not-allowed' : 'pointer',
                  opacity: isBusy ? 0.6 : 1,
                }}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Estimate'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PreviewBody: React.FC<{ preview: CostTabImportPreview; filename: string }> = ({ preview, filename }) => {
  return (
    <>
      {/* Project info card */}
      <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>
          {filename}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
          <Field label="Project" value={preview.projectInfo.projectName || '—'} />
          <Field label="Estimator(s)" value={preview.projectInfo.estimatorNames || '—'} />
          <Field label="Bid Date" value={preview.projectInfo.bidDate || '—'} />
          <Field label="Hub #" value={preview.projectInfo.hubNumber || '—'} />
          <Field label="Square Footage" value={preview.projectInfo.squareFootage ? formatNumber(preview.projectInfo.squareFootage) : '—'} />
          <Field label="Start Date" value={preview.projectInfo.startDate || '—'} />
        </div>
      </div>

      {/* Summary by cost type */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Costs by Type</div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {preview.sections.map((section) => (
            <CostTypeRow key={section.costType} section={section} />
          ))}
          <TotalsRow summary={preview.summary} />
        </div>
      </div>
    </>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{value}</div>
  </div>
);

const CostTypeRow: React.FC<{ section: CostTabImportSection }> = ({ section }) => {
  const [expanded, setExpanded] = useState(false);
  const color = COST_TYPE_COLORS[section.costType] || '#6b7280';

  return (
    <>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'grid', gridTemplateColumns: '24px 1fr 110px 110px 130px', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderBottom: expanded ? '1px solid #f3f4f6' : '1px solid #e5e7eb',
          background: expanded ? '#f9fafb' : '#fff', cursor: 'pointer', fontSize: 13,
        }}
      >
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color }} />
        <div style={{ fontWeight: 600, color: '#111827' }}>
          {section.name}
          <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginLeft: 8 }}>
            (cost type {section.costType})
          </span>
        </div>
        <div style={{ textAlign: 'right', color: '#6b7280' }}>
          {section.totalHours > 0 ? `${formatNumber(section.totalHours)} hrs` : '—'}
        </div>
        <div style={{ textAlign: 'right', color: '#6b7280' }}>
          {section.itemCount} item{section.itemCount === 1 ? '' : 's'}
        </div>
        <div style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
          {formatCurrency(section.totalCost)}
        </div>
      </div>
      {expanded && (
        <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '8px 14px 12px 44px' }}>
          {section.items.map((item, idx) => (
            <div
              key={`${section.costType}-${idx}`}
              style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 110px 130px', gap: 12,
                padding: '4px 0', fontSize: 12, color: '#374151',
              }}
            >
              <div style={{ color: '#6b7280', fontFamily: 'monospace' }}>{item.phaseCode || ''}</div>
              <div>{item.description}</div>
              <div style={{ textAlign: 'right', color: '#6b7280' }}>
                {item.hours > 0 ? `${formatNumber(item.hours)} hrs` : ''}
              </div>
              <div style={{ textAlign: 'right' }}>{formatCurrency(item.cost)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const TotalsRow: React.FC<{ summary: CostTabImportPreview['summary'] }> = ({ summary }) => (
  <div style={{ background: '#f3f4f6', padding: '12px 14px', fontSize: 13 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
      <span style={{ color: '#374151' }}>Subtotal</span>
      <span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(summary.subtotal)}</span>
      <span style={{ color: '#374151' }}>Markup ({summary.markupPercentage.toFixed(2)}%)</span>
      <span style={{ textAlign: 'right' }}>{formatCurrency(summary.markupAmount)}</span>
      <span style={{ color: '#374151' }}>Bond ({summary.bondPercentage.toFixed(2)}%)</span>
      <span style={{ textAlign: 'right' }}>{formatCurrency(summary.bondAmount)}</span>
      <span style={{ color: '#111827', fontWeight: 700, fontSize: 14, paddingTop: 6, borderTop: '1px solid #d1d5db' }}>Total Project Cost</span>
      <span style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, paddingTop: 6, borderTop: '1px solid #d1d5db' }}>
        {formatCurrency(summary.totalCost)}
      </span>
    </div>
  </div>
);

export default EstimateImportModal;
