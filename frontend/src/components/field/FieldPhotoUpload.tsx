import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import DeleteIcon from '@mui/icons-material/Delete';
import { attachmentsApi, Attachment } from '../../services/attachments';

interface FieldPhotoUploadProps {
  entityType: string;
  entityId: number;
}

const FieldPhotoUpload: React.FC<FieldPhotoUploadProps> = ({ entityType, entityId }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: async () => {
      const res = await attachmentsApi.getByEntity(entityType, entityId);
      return res.data;
    },
    enabled: !!entityId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(entityType, entityId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => attachmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadMutation.mutateAsync(files[i]);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = (att: Attachment) => {
    if (window.confirm('Delete this photo?')) {
      deleteMutation.mutate(att.id);
    }
  };

  const isImage = (mimeType: string) =>
    mimeType?.startsWith('image/');

  return (
    <div className="field-detail-section">
      <div className="field-detail-section-title">Photos & Attachments</div>

      {/* Photo Grid */}
      {attachments.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 12,
        }}>
          {attachments.map((att) => (
            <div
              key={att.id}
              style={{
                position: 'relative',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
              }}
            >
              {isImage(att.mime_type) ? (
                <img
                  src={att.url}
                  alt={att.original_name}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    display: 'block',
                    cursor: 'pointer',
                  }}
                  onClick={() => window.open(att.url, '_blank')}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: '#6b7280',
                    padding: 8,
                    textAlign: 'center',
                    cursor: 'pointer',
                    wordBreak: 'break-word',
                  }}
                  onClick={() => window.open(att.url, '_blank')}
                >
                  {att.original_name}
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(att); }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                type="button"
              >
                <DeleteIcon style={{ fontSize: 14 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button
        className="field-btn field-btn-secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        type="button"
        style={{ width: '100%', opacity: uploading ? 0.6 : 1 }}
      >
        <AddAPhotoIcon style={{ fontSize: 18 }} />
        {uploading ? 'Uploading...' : 'Add Photos'}
      </button>
    </div>
  );
};

export default FieldPhotoUpload;
