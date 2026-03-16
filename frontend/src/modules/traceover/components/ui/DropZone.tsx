import { useState, useRef, useCallback } from 'react';

interface DropZoneProps {
  onFileDrop: (files: File[]) => void;
  accept?: string;
  label?: string;
  sublabel?: string;
}

export default function DropZone({
  onFileDrop,
  accept = '.pdf',
  label = 'Drop files here',
  sublabel = 'or click to browse',
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFileDrop(files);
    },
    [onFileDrop],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onFileDrop(files);
      e.target.value = '';
    },
    [onFileDrop],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        border: `2px dashed ${isDragging ? '#3b82f6' : '#1f3450'}`,
        borderRadius: 8,
        padding: '32px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: isDragging ? 'rgba(59,130,246,0.05)' : 'transparent',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div style={{ fontSize: 14, fontWeight: 500, color: '#d4e3f3' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#4a6a88', marginTop: 4 }}>{sublabel}</div>
    </div>
  );
}
