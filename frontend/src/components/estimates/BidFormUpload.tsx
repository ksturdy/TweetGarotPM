import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { estimatesApi, BidFormInfo, BidFormPreview } from '../../services/estimates';

interface BidFormUploadProps {
  estimateId: number;
  onUploadComplete?: () => void;
}

const BidFormUpload: React.FC<BidFormUploadProps> = ({ estimateId, onUploadComplete }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<BidFormPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch current bid form info
  const { data: bidFormInfo, isLoading: loadingInfo } = useQuery({
    queryKey: ['estimate-bid-form', estimateId],
    queryFn: () => estimatesApi.getBidFormInfo(estimateId).then(res => res.data),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => estimatesApi.uploadBidForm(estimateId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['estimate-bid-form', estimateId] });
      setSelectedFile(null);
      setPreviewData(null);
      onUploadComplete?.();
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (file: File) => estimatesApi.previewBidForm(estimateId, file),
    onSuccess: (response) => {
      setPreviewData(response.data);
    },
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: () => estimatesApi.refreshBidForm(estimateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => estimatesApi.deleteBidForm(estimateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['estimate-bid-form', estimateId] });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const validExtensions = ['.xlsm', '.xlsx', '.xls'];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      alert('Please select an Excel file (.xlsm, .xlsx, or .xls)');
      return;
    }

    setSelectedFile(file);
    // Auto-preview the file
    previewMutation.mutate(file);
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await estimatesApi.downloadBidForm(estimateId);
      const { downloadUrl, filename } = response.data;

      // Open the presigned URL in a new tab or trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download bid form');
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to remove the bid form? This will not delete the estimate data.')) {
      deleteMutation.mutate();
    }
  };

  if (loadingInfo) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bid-form-upload">
      {/* Current bid form info */}
      {bidFormInfo?.hasBidForm && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--background)',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <div>
              <div style={{ fontWeight: 600 }}>{bidFormInfo.filename}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                Version {bidFormInfo.version} - Uploaded{' '}
                {bidFormInfo.uploadedAt
                  ? new Date(bidFormInfo.uploadedAt).toLocaleString()
                  : 'Unknown'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownload}
            >
              Download
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Values'}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      )}

      {/* Upload area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '2rem',
          border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: '0.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragActive ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsm,.xlsx,.xls"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
          {bidFormInfo?.hasBidForm ? 'Upload New Version' : 'Upload Excel Bid Form'}
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
          Drag and drop your .xlsm file here, or click to browse
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '0.5rem' }}>
          Supports: .xlsm, .xlsx, .xls (max 50MB)
        </div>
      </div>

      {/* Preview section */}
      {previewMutation.isPending && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--secondary)' }}>
          Analyzing file...
        </div>
      )}

      {previewData && selectedFile && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'var(--background)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border)',
          }}
        >
          <h4 style={{ margin: '0 0 1rem 0' }}>Preview: {previewData.filename}</h4>

          {previewData.warnings.length > 0 && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '0.375rem',
                marginBottom: '1rem',
              }}
            >
              <strong>Warnings:</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                {previewData.warnings.map((w, i) => (
                  <li key={i} style={{ fontSize: '0.875rem' }}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>
                Sections
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{previewData.sectionCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>
                Line Items
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{previewData.lineItemCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>
                Total Sell
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                ${previewData.summary.totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Sections to Import:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {previewData.sections.map((section, i) => (
                <span
                  key={i}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                  }}
                >
                  {section.name} ({section.itemCount} items)
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Importing...' : 'Import Bid Form'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSelectedFile(null);
                setPreviewData(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadMutation.isError && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.375rem',
            color: 'var(--danger)',
          }}
        >
          Failed to upload bid form. Please try again.
        </div>
      )}
    </div>
  );
};

export default BidFormUpload;
