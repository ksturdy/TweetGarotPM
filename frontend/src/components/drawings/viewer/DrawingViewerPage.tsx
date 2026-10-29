import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import type { Drawing, DrawingPage } from '../../../services/drawings';
import DrawingViewerShell from './DrawingViewerShell';

export default function DrawingViewerPage() {
  const { id: projectId, drawingId } = useParams<{ id: string; drawingId: string }>();
  const navigate = useNavigate();

  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [pages, setPages] = useState<DrawingPage[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!drawingId) return;
    let blobUrl: string | null = null;

    const load = async () => {
      try {
        setLoading(true);
        const [drawingRes, pdfRes] = await Promise.all([
          api.get<Drawing>(`/drawings/${drawingId}`),
          api.get(`/drawings/${drawingId}/download`, { responseType: 'blob' }),
        ]);

        setDrawing(drawingRes.data);

        blobUrl = URL.createObjectURL(pdfRes.data);
        setFileUrl(blobUrl);
      } catch (err: any) {
        setError(err.message || 'Failed to load drawing');
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [drawingId]);

  const handleBack = () => {
    navigate(`/projects/${projectId}/drawings`);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        background: '#0a1628', color: '#7a9ab5', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 24 }}>⟳</div>
        <div style={{ fontSize: 14 }}>Loading drawing…</div>
      </div>
    );
  }

  if (error || !drawing || !fileUrl) {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        background: '#0a1628', color: '#ef4444', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 14 }}>{error || 'Drawing could not be loaded'}</div>
        <button
          onClick={handleBack}
          style={{
            background: '#1e4a8a', border: 'none', color: '#fff',
            borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
          }}
        >
          ← Back to Drawings
        </button>
      </div>
    );
  }

  return (
    <DrawingViewerShell
      drawing={drawing}
      fileUrl={fileUrl}
      projectId={Number(projectId)}
      onBack={handleBack}
    />
  );
}
