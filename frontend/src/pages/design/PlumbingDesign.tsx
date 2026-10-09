import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plumbingDesignService, PlumbingDesign } from '../../services/plumbingDesigns';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';

const PlumbingDesignViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [design, setDesign] = useState<PlumbingDesign | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [error, setError] = useState('');

  // Load design from backend
  useEffect(() => {
    if (!id) return;
    plumbingDesignService.get(Number(id))
      .then(setDesign)
      .catch(() => setError('Failed to load design'));
  }, [id]);

  // Once iframe signals ready and design is loaded, restore state
  useEffect(() => {
    if (!iframeReady || !design || !iframeRef.current?.contentWindow) return;
    const hasData = design.design_data && Object.keys(design.design_data).length > 0;
    if (hasData) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'TG_RESTORE_STATE', data: design.design_data },
        '*'
      );
    }
  }, [iframeReady, design]);

  // Listen for messages from the iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.data?.type) return;

    if (event.data.type === 'TG_READY') {
      setIframeReady(true);
    }

    if (event.data.type === 'TG_STATE') {
      const state = event.data.data;
      if (!id || !design) return;
      const name = state?.projectInfo?.name || design.name;
      const hubNumber = state?.projectInfo?.hub || design.hub_number;
      plumbingDesignService.update(Number(id), { name, hubNumber, designData: state })
        .then(updated => {
          setDesign(updated);
          setSaving(false);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        })
        .catch(() => {
          setSaving(false);
          setError('Save failed');
        });
    }
  }, [id, design]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const handleSave = () => {
    if (!iframeRef.current?.contentWindow) return;
    setSaving(true);
    iframeRef.current.contentWindow.postMessage({ type: 'TG_REQUEST_STATE' }, '*');
  };

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#b91c1c' }}>{error}</div>
    );
  }

  return (
    <div style={{ margin: '-1.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0 1rem', height: '44px', flexShrink: 0,
        background: '#0a3370', borderBottom: '2px solid #F37B03',
      }}>
        <button
          onClick={() => navigate('/design')}
          style={{ background: 'none', border: 'none', color: '#9ab3d0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px' }}
        >
          <ArrowBackIcon style={{ fontSize: '0.9rem' }} /> Designs
        </button>

        <div style={{ width: '1px', height: '20px', background: '#1e4d8a' }} />

        <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', flex: 1 }}>
          {design?.name || 'Loading…'}
          {design?.hub_number && (
            <span style={{ color: '#9ab3d0', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.8rem' }}>
              HUB: {design.hub_number}
            </span>
          )}
        </span>

        <span style={{ color: '#9ab3d0', fontSize: '0.75rem' }}>
          {design && `Saved ${new Date(design.updated_at).toLocaleString()}`}
        </span>

        <button
          onClick={handleSave}
          disabled={saving || !iframeReady}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: saved ? '#16a34a' : '#F37B03',
            color: '#fff', border: 'none', borderRadius: '5px',
            padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700,
            cursor: saving || !iframeReady ? 'not-allowed' : 'pointer',
            opacity: saving || !iframeReady ? 0.7 : 1,
            transition: 'background 0.2s',
          }}
        >
          {saved ? <CheckIcon style={{ fontSize: '0.9rem' }} /> : <SaveIcon style={{ fontSize: '0.9rem' }} />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* iframe */}
      <iframe
        ref={iframeRef}
        src="/plumbing-design.html"
        title="Plumbing Design Tool"
        style={{ flex: 1, border: 'none', display: 'block', width: '100%' }}
        onLoad={() => {
          // Signal ready after a brief delay to ensure script has run
          setTimeout(() => setIframeReady(true), 300);
        }}
      />
    </div>
  );
};

export default PlumbingDesignViewer;
