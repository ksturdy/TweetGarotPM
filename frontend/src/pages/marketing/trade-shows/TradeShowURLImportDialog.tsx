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

const TradeShowURLImportDialog: React.FC<Props> = ({ onClose }) => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleExtract = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setExtracted(null);
    try {
      const res = await tradeShowsApi.extractFromUrl(trimmed);
      setExtracted(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to extract data from that URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleUse = () => {
    if (!extracted) return;
    const prefill: Record<string, string> = {};
    if (extracted.name) prefill.name = extracted.name;
    if (extracted.description) prefill.description = extracted.description;
    if (extracted.website_url) prefill.website_url = extracted.website_url;
    if (extracted.event_start_date) prefill.event_start_date = extracted.event_start_date;
    if (extracted.event_end_date) prefill.event_end_date = extracted.event_end_date;
    if (extracted.event_start_time) prefill.event_start_time = extracted.event_start_time;
    if (extracted.event_end_time) prefill.event_end_time = extracted.event_end_time;
    if (extracted.registration_deadline) prefill.registration_deadline = extracted.registration_deadline;
    if (extracted.venue) prefill.venue = extracted.venue;
    if (extracted.address) prefill.address = extracted.address;
    if (extracted.city) prefill.city = extracted.city;
    if (extracted.state) prefill.state = extracted.state;
    if (extracted.country) prefill.country = extracted.country;
    if (extracted.registration_cost != null) prefill.registration_cost = String(extracted.registration_cost);
    navigate('/marketing/trade-shows/create', { state: { prefill } });
    onClose();
  };

  const hasData = extracted && Object.values(extracted).some(v => v != null && v !== '');

  const locationParts = [extracted?.venue, extracted?.city, extracted?.state, extracted?.country].filter(Boolean);
  const locationStr = locationParts.length ? locationParts.join(', ') : null;

  const dateStr = (() => {
    const s = formatDate(extracted?.event_start_date);
    const e = formatDate(extracted?.event_end_date);
    if (s && e && s !== e) return `${s} – ${e}`;
    return s || e || null;
  })();

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Import Event from URL</div>
            <div style={{ color: '#93c5fd', fontSize: '0.8rem', marginTop: '2px' }}>
              Reads Schema.org &amp; OpenGraph data from the event page
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* URL input */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              ref={inputRef}
              className="form-input"
              type="url"
              placeholder="https://ahr-expo.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleExtract(); }}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <button
              className="btn btn-primary"
              onClick={handleExtract}
              disabled={loading || !url.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading ? 'Fetching…' : 'Extract'}
            </button>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.75rem', color: '#991b1b', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {extracted && (
            <div style={{ borderLeft: '3px solid #f97316', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', marginBottom: '0.5rem' }}>
                Extracted Data {!hasData && <span style={{ color: '#9ca3af', fontWeight: 400 }}>— nothing found</span>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>
                  <PreviewRow label="Name" value={extracted.name || null} />
                  <PreviewRow label="Dates" value={dateStr} />
                  <PreviewRow label="Reg. Deadline" value={formatDate(extracted.registration_deadline)} />
                  <PreviewRow label="Location" value={locationStr} />
                  <PreviewRow label="Reg. Cost" value={fmtMoney(extracted.registration_cost)} />
                  <PreviewRow label="Website" value={extracted.website_url || null} />
                  <PreviewRow
                    label="Description"
                    value={extracted.description ? extracted.description.substring(0, 120) + (extracted.description.length > 120 ? '…' : '') : null}
                  />
                </tbody>
              </table>
            </div>
          )}

          {!hasData && !error && !loading && (
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1rem' }}>
              Works best with event pages on sites like Eventbrite, Cvent, or conference websites that embed structured data.
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
