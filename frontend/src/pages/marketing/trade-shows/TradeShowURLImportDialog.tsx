import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tradeShowsApi } from '../../../services/tradeShows';

interface ExtractedData {
  name?: string | null;
  description?: string | null;
  website_url?: string | null;
  event_start_date?: string | null;
  event_end_date?: string | null;
  event_start_time?: string | null;
  event_end_time?: string | null;
  registration_deadline?: string | null;
  venue?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  registration_cost?: number | null;
  _ai_enriched?: boolean;
}

interface Props {
  onClose: () => void;
}

const formatDate = (d?: string | null) => {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtMoney = (v?: number | null) => {
  if (v === null || v === undefined) return null;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const PreviewRow: React.FC<{ label: string; value: string | null }> = ({ label, value }) => (
  <tr>
    <td style={{ padding: '5px 8px', color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap', width: 1 }}>{label}</td>
    <td style={{ padding: '5px 8px', color: value ? '#111827' : '#9ca3af' }}>
      {value || '—'}
    </td>
  </tr>
);

type Mode = 'url' | 'text';

const TradeShowURLImportDialog: React.FC<Props> = ({ onClose }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === 'url') urlInputRef.current?.focus();
    else textAreaRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleExtract = async () => {
    setLoading(true);
    setError(null);
    setExtracted(null);
    try {
      let res;
      if (mode === 'url') {
        res = await tradeShowsApi.extractFromUrl(url.trim());
      } else {
        res = await tradeShowsApi.extractFromText(pastedText.trim());
      }
      setExtracted(res.data as ExtractedData);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Extraction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canExtract = mode === 'url' ? url.trim().length > 0 : pastedText.trim().length > 10;

  const handleUse = () => {
    if (!extracted) return;
    const prefill: Record<string, string> = {};
    if (extracted.name)                   prefill.name                  = extracted.name;
    if (extracted.description)            prefill.description           = extracted.description;
    if (extracted.website_url)            prefill.website_url           = extracted.website_url;
    if (extracted.event_start_date)       prefill.event_start_date      = extracted.event_start_date;
    if (extracted.event_end_date)         prefill.event_end_date        = extracted.event_end_date;
    if (extracted.event_start_time)       prefill.event_start_time      = extracted.event_start_time;
    if (extracted.event_end_time)         prefill.event_end_time        = extracted.event_end_time;
    if (extracted.registration_deadline)  prefill.registration_deadline = extracted.registration_deadline;
    if (extracted.venue)                  prefill.venue                 = extracted.venue;
    if (extracted.address)                prefill.address               = extracted.address;
    if (extracted.city)                   prefill.city                  = extracted.city;
    if (extracted.state)                  prefill.state                 = extracted.state;
    if (extracted.country)                prefill.country               = extracted.country;
    if (extracted.registration_cost != null) prefill.registration_cost  = String(extracted.registration_cost);
    navigate('/marketing/trade-shows/create', { state: { prefill } });
    onClose();
  };

  const hasData = extracted && Object.entries(extracted).some(([k, v]) => k !== '_ai_enriched' && v != null && v !== '');

  const locationParts = [extracted?.venue, extracted?.city, extracted?.state, extracted?.country].filter(Boolean);
  const locationStr = locationParts.length ? locationParts.join(', ') : null;

  const dateStr = (() => {
    const s = formatDate(extracted?.event_start_date);
    const e = formatDate(extracted?.event_end_date);
    if (s && e && s !== e) return `${s} – ${e}`;
    return s || e || null;
  })();

  const tabBtn = (m: Mode, label: string) => ({
    padding: '0.4rem 1rem',
    border: 'none',
    borderBottom: `2px solid ${mode === m ? '#f97316' : 'transparent'}`,
    background: 'transparent',
    color: mode === m ? '#f97316' : '#93c5fd',
    fontWeight: mode === m ? 700 : 500,
    fontSize: '0.85rem',
    cursor: 'pointer',
  } as React.CSSProperties);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '540px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Import Event</div>
              <div style={{ color: '#93c5fd', fontSize: '0.8rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>✨</span>
                <span>AI-powered — extracts name, dates, location &amp; cost automatically</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '4px 8px' }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', marginTop: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <button style={tabBtn('url', 'URL')} onClick={() => { setMode('url'); setExtracted(null); setError(null); }}>
              🔗 Paste a URL
            </button>
            <button style={tabBtn('text', 'Text')} onClick={() => { setMode('text'); setExtracted(null); setError(null); }}>
              📋 Paste Text
            </button>
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {mode === 'url' ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                ref={urlInputRef}
                className="form-input"
                type="url"
                placeholder="https://ahr-expo.com/register"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canExtract) handleExtract(); }}
                style={{ flex: 1 }}
                disabled={loading}
              />
              <button className="btn btn-primary" onClick={handleExtract} disabled={loading || !canExtract} style={{ whiteSpace: 'nowrap' }}>
                {loading ? 'Extracting…' : 'Extract'}
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              <textarea
                ref={textAreaRef}
                className="form-input"
                placeholder="Paste event details here — email body, registration page text, PDF contents, flyer copy…"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={6}
                disabled={loading}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleExtract} disabled={loading || !canExtract} style={{ whiteSpace: 'nowrap' }}>
                  {loading ? 'Extracting…' : 'Extract with AI'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.75rem', color: '#991b1b', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {extracted && (
            <div style={{ borderLeft: '3px solid #f97316', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>
                  Extracted Data {!hasData && <span style={{ color: '#9ca3af', fontWeight: 400 }}>— nothing found</span>}
                </div>
                {extracted._ai_enriched && (
                  <span style={{ fontSize: '0.7rem', background: '#ede9fe', color: '#7c3aed', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>
                    ✨ AI-assisted
                  </span>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>
                  <PreviewRow label="Name"         value={extracted.name || null} />
                  <PreviewRow label="Dates"        value={dateStr} />
                  <PreviewRow label="Reg. Deadline" value={formatDate(extracted.registration_deadline)} />
                  <PreviewRow label="Location"     value={locationStr} />
                  <PreviewRow label="Reg. Cost"    value={fmtMoney(extracted.registration_cost)} />
                  <PreviewRow label="Website"      value={extracted.website_url || null} />
                  <PreviewRow
                    label="Description"
                    value={extracted.description ? extracted.description.substring(0, 140) + (extracted.description.length > 140 ? '…' : '') : null}
                  />
                </tbody>
              </table>
            </div>
          )}

          {!extracted && !error && !loading && (
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1rem' }}>
              {mode === 'url'
                ? 'Paste any event page URL. AI will read the page and extract dates, location, and cost even when the site has no structured metadata.'
                : 'Paste text from an email, PDF, or event flyer. AI will identify and extract all event details automatically.'}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUse} disabled={!hasData}>
              Use This Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeShowURLImportDialog;
