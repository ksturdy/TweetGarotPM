import React, { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { weeklySalesReportApi, LocationData } from '../../services/weeklySalesReport';
import { LOCATION_GROUPS } from '../../constants/locationGroups';
import { useAuth } from '../../context/AuthContext';
import { parseLocalDate } from '../../utils/dateUtils';
import '../../styles/SalesPipeline.css';

// ── Helpers ──────────────────────────────────────────────

const fmtCurrency = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '$0';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000).toLocaleString()}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '-';
  const dt = parseLocalDate(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function formatWeekRange(weekStart: string): string {
  const start = parseLocalDate(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = parseLocalDate(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().split('T')[0];
}

// ── Preferences ──────────────────────────────────────────

interface WeeklySalesPreferences {
  visibleSections: { kpis: boolean; newOpps: boolean; activities: boolean; wonLost: boolean };
  visibleLocations: string[];
  locationOrder: string[];
}

const DEFAULT_PREFS: WeeklySalesPreferences = {
  visibleSections: { kpis: true, newOpps: true, activities: true, wonLost: true },
  visibleLocations: ['NEW', 'CW', 'WW', 'AZ'],
  locationOrder: ['NEW', 'CW', 'WW', 'AZ'],
};

const PREFS_KEY = 'weeklySalesReportPrefs';

function loadPrefs(): WeeklySalesPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS };
}

function savePrefs(p: WeeklySalesPreferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

// ── KPI cards ────────────────────────────────────────────

const KPI_STYLES = {
  blue:   { gradient: 'linear-gradient(135deg, #002356 0%, #004080 100%)', text: '#3b82f6' },
  purple: { gradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', text: '#8b5cf6' },
  amber:  { gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', text: '#f59e0b' },
  green:  { gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', text: '#10b981' },
  rose:   { gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', text: '#f43f5e' },
};

interface KpiCardData {
  label: string;
  value: string;
  subValue?: string;
  style: { gradient: string; text: string };
  icon: React.ReactNode;
}

const KpiCard: React.FC<{ card: KpiCardData }> = ({ card }) => (
  <div style={{
    background: '#ffffff', borderRadius: '12px', padding: '1rem 1.25rem',
    display: 'flex', alignItems: 'center', gap: '0.875rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb', transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default', position: 'relative', overflow: 'hidden',
  }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)'; }}
  >
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: card.style.gradient }} />
    <div style={{
      width: '44px', height: '44px', borderRadius: '0.5rem', background: card.style.gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {card.icon}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.025em', marginBottom: '2px' }}>{card.label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#002356', lineHeight: 1.2 }}>
        {card.value}
        {card.subValue && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: card.style.text, marginLeft: '6px' }}>({card.subValue})</span>}
      </div>
    </div>
  </div>
);

const Delta: React.FC<{ current: number; previous: number; isCurrency?: boolean }> = ({ current, previous, isCurrency }) => {
  const diff = current - previous;
  if (previous === 0 && current === 0) return null;
  const color = diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#64748b';
  const arrow = diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : '';
  const label = isCurrency ? fmtCurrency(Math.abs(diff)) : Math.abs(diff).toString();
  return <span style={{ color, fontSize: '0.7rem', fontWeight: 600 }}>{arrow} {label} vs prev week</span>;
};

// ── Activity type badge ──────────────────────────────────

const ACTIVITY_COLORS: Record<string, string> = {
  call: '#3b82f6', meeting: '#8b5cf6', email: '#f59e0b',
  note: '#64748b', task: '#10b981', voice_note: '#06b6d4',
};

const ActivityBadge: React.FC<{ type: string }> = ({ type }) => {
  const color = ACTIVITY_COLORS[type] || '#64748b';
  return (
    <span style={{
      background: color + '18', color, fontSize: '0.7rem', fontWeight: 600,
      padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize',
    }}>
      {type.replace('_', ' ')}
    </span>
  );
};

// ── Location section ─────────────────────────────────────

const LocationSection: React.FC<{
  code: string;
  data: LocationData;
  prefs: WeeklySalesPreferences;
  onOppClick: (id: number) => void;
}> = ({ code, data, prefs, onOppClick }) => {
  const [collapsed, setCollapsed] = useState(false);
  const loc = LOCATION_GROUPS.find(g => g.value === code);
  const label = loc ? loc.longLabel : code === 'NONE' ? 'Unassigned' : code;
  const color = loc?.color || '#64748b';
  const s = data.summary;

  return (
    <div className="sales-table-section" style={{ position: 'relative', overflow: 'hidden', marginBottom: '1rem' }}>
      {/* Gradient accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color }} />

      {/* Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', cursor: 'pointer', paddingTop: '0.875rem',
        }}
      >
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#002356', flex: 1 }}>{label}</span>
        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
          <span><strong style={{ color: '#002356' }}>{s.new_opp_count}</strong> new opps</span>
          <span><strong style={{ color: '#002356' }}>{fmtCurrency(s.new_opp_value)}</strong> value</span>
          <span><strong style={{ color: '#002356' }}>{s.activity_count}</strong> activities</span>
          {s.won_count > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}>{s.won_count} won ({fmtCurrency(s.won_value)})</span>}
          {s.lost_count > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{s.lost_count} lost</span>}
        </div>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
      </div>

      {!collapsed && (
        <div>
          {/* New Opportunities */}
          {prefs.visibleSections.newOpps && data.new_opportunities.length > 0 && (
            <>
              <div className="sales-table-header">
                <div className="sales-table-title">New Opportunities <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.375rem' }}>({data.new_opportunities.length})</span></div>
              </div>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Customer</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                    <th>Stage</th>
                    <th>Owner</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.new_opportunities.map(opp => (
                    <tr key={opp.id} style={{ cursor: 'pointer' }} onClick={() => onOppClick(opp.id)}>
                      <td style={{ color: '#3b82f6', fontWeight: 500 }}>{opp.title}</td>
                      <td>{opp.customer_name || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(opp.estimated_value)}</td>
                      <td>
                        <span style={{
                          background: (opp.stage_color || '#64748b') + '18',
                          color: opp.stage_color || '#64748b',
                          fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                        }}>
                          {opp.stage_name}
                        </span>
                      </td>
                      <td>{opp.assigned_to_name || '-'}</td>
                      <td>{fmtDate(opp.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Activities */}
          {prefs.visibleSections.activities && data.activities.length > 0 && (
            <>
              <div className="sales-table-header">
                <div className="sales-table-title">Activities <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.375rem' }}>({data.activities.length})</span></div>
              </div>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Subject</th>
                    <th>Opportunity</th>
                    <th>By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activities.map(act => (
                    <tr key={act.id}>
                      <td><ActivityBadge type={act.activity_type} /></td>
                      <td>{act.subject || '-'}</td>
                      <td>
                        <span style={{ color: '#3b82f6', fontWeight: 500, cursor: 'pointer' }} onClick={() => onOppClick(act.opportunity_id)}>{act.opportunity_title}</span>
                      </td>
                      <td>{act.created_by_name || '-'}</td>
                      <td>{fmtDate(act.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Won/Lost */}
          {prefs.visibleSections.wonLost && data.won_lost.length > 0 && (
            <>
              <div className="sales-table-header">
                <div className="sales-table-title">Won / Lost <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.375rem' }}>({data.won_lost.length})</span></div>
              </div>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Customer</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                    <th>Result</th>
                    <th>Owner</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.won_lost.map(row => {
                    const isWon = /won|awarded/i.test(row.stage_name);
                    return (
                      <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => onOppClick(row.id)}>
                        <td style={{ color: '#3b82f6', fontWeight: 500 }}>{row.title}</td>
                        <td>{row.customer_name || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(row.estimated_value)}</td>
                        <td>
                          <span style={{
                            background: isWon ? '#10b98118' : '#ef444418',
                            color: isWon ? '#10b981' : '#ef4444',
                            fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                          }}>
                            {row.stage_name}
                          </span>
                        </td>
                        <td>{row.assigned_to_name || '-'}</td>
                        <td>{fmtDate(row.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* Empty state */}
          {data.new_opportunities.length === 0 && data.activities.length === 0 && data.won_lost.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8125rem' }}>
              No activity this week
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Settings panel ───────────────────────────────────────

const SettingsPanel: React.FC<{
  prefs: WeeklySalesPreferences;
  onChange: (p: WeeklySalesPreferences) => void;
}> = ({ prefs, onChange }) => {
  const toggleSection = (key: keyof WeeklySalesPreferences['visibleSections']) => {
    onChange({ ...prefs, visibleSections: { ...prefs.visibleSections, [key]: !prefs.visibleSections[key] } });
  };

  const toggleLocation = (loc: string) => {
    const vis = prefs.visibleLocations.includes(loc)
      ? prefs.visibleLocations.filter(l => l !== loc)
      : [...prefs.visibleLocations, loc];
    onChange({ ...prefs, visibleLocations: vis });
  };

  const moveLocation = (loc: string, dir: -1 | 1) => {
    const order = [...prefs.locationOrder];
    const idx = order.indexOf(loc);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    onChange({ ...prefs, locationOrder: order });
  };

  const checkboxStyle: React.CSSProperties = { marginRight: '0.5rem', accentColor: '#3b82f6' };

  return (
    <div style={{
      background: '#fff', border: '1px solid #e0e2e7', borderRadius: '10px',
      padding: '1.25rem', marginBottom: '1rem',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Sections</div>
          {([['kpis', 'KPI Cards'], ['newOpps', 'New Opportunities'], ['activities', 'Activities'], ['wonLost', 'Won / Lost']] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.375rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={prefs.visibleSections[key]} onChange={() => toggleSection(key)} style={checkboxStyle} />
              {label}
            </label>
          ))}
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Locations</div>
          {prefs.locationOrder.map((loc, i) => {
            const group = LOCATION_GROUPS.find(g => g.value === loc);
            return (
              <div key={loc} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <input type="checkbox" checked={prefs.visibleLocations.includes(loc)} onChange={() => toggleLocation(loc)} style={checkboxStyle} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: group?.color || '#64748b', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', minWidth: '100px' }}>{group?.longLabel || loc}</span>
                <button onClick={() => moveLocation(loc, -1)} disabled={i === 0}
                  style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: '0.75rem', padding: '2px 4px' }}>&#9650;</button>
                <button onClick={() => moveLocation(loc, 1)} disabled={i === prefs.locationOrder.length - 1}
                  style={{ background: 'none', border: 'none', cursor: i === prefs.locationOrder.length - 1 ? 'default' : 'pointer', opacity: i === prefs.locationOrder.length - 1 ? 0.3 : 1, fontSize: '0.75rem', padding: '2px 4px' }}>&#9660;</button>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={() => onChange({ ...DEFAULT_PREFS })} className="sales-filter-btn" style={{ padding: '0.375rem 0.75rem' }}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────

const WeeklySalesReport: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<WeeklySalesPreferences>(loadPrefs);
  const [pdfLoading, setPdfLoading] = useState(false);

  const logoUrl = tenant?.settings?.branding?.logo_url ? '/api/tenant/logo' : undefined;

  const updatePrefs = useCallback((p: WeeklySalesPreferences) => {
    setPrefs(p);
    savePrefs(p);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['weeklySalesReport', weekStart],
    queryFn: () => weeklySalesReportApi.getData(weekStart),
  });

  const onOppClick = useCallback((id: number) => {
    navigate(`/sales-pipeline?id=${id}`);
  }, [navigate]);

  const orderedLocations = useMemo(() => {
    if (!data) return [];
    const result: string[] = [];
    for (const loc of prefs.locationOrder) {
      if (prefs.visibleLocations.includes(loc) && data.by_location[loc]) {
        result.push(loc);
      }
    }
    for (const loc of Object.keys(data.by_location)) {
      if (!result.includes(loc) && (prefs.visibleLocations.includes(loc) || !LOCATION_GROUPS.find(g => g.value === loc))) {
        result.push(loc);
      }
    }
    return result;
  }, [data, prefs.locationOrder, prefs.visibleLocations]);

  // Loading
  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 16px',
            borderRadius: '50%', border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading weekly sales data...</div>
        </div>
      </div>
    );
  }

  const t = data?.totals;

  const kpiCards: KpiCardData[] = t ? [
    {
      label: 'New Opportunities', value: String(t.new_opp_count),
      subValue: t.prev_new_opp_count > 0 ? `${t.new_opp_count > t.prev_new_opp_count ? '+' : ''}${t.new_opp_count - t.prev_new_opp_count} vs prev` : undefined,
      style: KPI_STYLES.blue,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    },
    {
      label: 'Pipeline Added', value: fmtCurrency(t.new_opp_value),
      subValue: t.prev_new_opp_value > 0 ? `${t.new_opp_value >= t.prev_new_opp_value ? '+' : ''}${fmtCurrency(t.new_opp_value - t.prev_new_opp_value)} vs prev` : undefined,
      style: KPI_STYLES.purple,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
      label: 'Activities', value: String(t.activity_count),
      subValue: t.prev_activity_count > 0 ? `${t.activity_count >= t.prev_activity_count ? '+' : ''}${t.activity_count - t.prev_activity_count} vs prev` : undefined,
      style: KPI_STYLES.amber,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    },
    {
      label: 'Won', value: `${t.won_count}`,
      subValue: t.won_value > 0 ? fmtCurrency(t.won_value) : undefined,
      style: KPI_STYLES.green,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    },
    {
      label: 'Lost', value: String(t.lost_count),
      style: KPI_STYLES.rose,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
    },
  ] : [];

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header" style={{ position: 'relative' }}>
        <div className="sales-page-title">
          <div>
            <Link to="/reports" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Reports
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {logoUrl && (
                <img src={logoUrl} alt="" style={{ height: '36px', objectFit: 'contain' }} />
              )}
              <h1 style={{
                background: 'linear-gradient(135deg, #002356, #004080)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Weekly Sales Report</h1>
            </div>
            <div className="sales-subtitle">Opportunity activity and pipeline changes by location</div>
          </div>
        </div>
        <div className="sales-header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="sales-btn sales-btn-secondary"
            onClick={async () => {
              try {
                setPdfLoading(true);
                await weeklySalesReportApi.downloadPdf(weekStart);
              } catch (err) {
                console.error('PDF download failed:', err);
              } finally {
                setPdfLoading(false);
              }
            }}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
            {pdfLoading ? 'Generating...' : 'Export PDF'}
          </button>
          <button
            className={`sales-btn ${settingsOpen ? '' : 'sales-btn-secondary'}`}
            onClick={() => setSettingsOpen(!settingsOpen)}
            style={settingsOpen ? { background: '#3b82f6', color: '#fff' } : {}}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Customize
          </button>
        </div>
      </div>

      {/* Week picker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 1rem', background: '#fff', borderRadius: '10px',
        border: '1px solid #e0e2e7', marginBottom: '1rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }}>
        <button className="sales-btn sales-btn-secondary" onClick={() => setWeekStart(shiftWeek(weekStart, -1))} style={{ padding: '4px 10px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#002356', minWidth: '220px', textAlign: 'center' }}>
          {formatWeekRange(weekStart)}
        </span>
        <button className="sales-btn sales-btn-secondary" onClick={() => setWeekStart(shiftWeek(weekStart, 1))} style={{ padding: '4px 10px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button className="sales-filter-btn" onClick={() => setWeekStart(getMonday(new Date()))} style={{ marginLeft: '0.5rem', padding: '4px 12px', fontSize: '0.8rem' }}>
          This Week
        </button>
      </div>

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel prefs={prefs} onChange={updatePrefs} />}

      {/* KPI cards */}
      {prefs.visibleSections.kpis && kpiCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          {kpiCards.map(card => <KpiCard key={card.label} card={card} />)}
        </div>
      )}

      {/* Company Snapshot — backlog KPIs */}
      {data?.company_snapshot && (
        <div style={{
          background: '#fff', borderRadius: '12px', border: '1px solid #e0e2e7',
          padding: '1rem 1.25rem', marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(135deg, #002356, #0369a1)' }} />
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>Company Snapshot</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            {/* Total Backlog + GM% */}
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Total Backlog</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#002356' }}>{fmtCurrency(data.company_snapshot.total_backlog)}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '8px', marginBottom: '2px' }}>GM% in Backlog</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: data.company_snapshot.weighted_gm_pct != null && data.company_snapshot.weighted_gm_pct >= 15 ? '#059669' : '#dc2626' }}>
                {data.company_snapshot.weighted_gm_pct != null ? `${data.company_snapshot.weighted_gm_pct.toFixed(1)}%` : '-'}
              </div>
            </div>
            {/* 6 Mo Out + GM% */}
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Backlog (6 Mo Out)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0369a1' }}>{fmtCurrency(data.company_snapshot.backlog_6mo)}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '8px', marginBottom: '2px' }}>GM% in Backlog</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: data.company_snapshot.backlog_6mo_gm_pct != null && data.company_snapshot.backlog_6mo_gm_pct >= 15 ? '#059669' : '#dc2626' }}>
                {data.company_snapshot.backlog_6mo_gm_pct != null ? `${data.company_snapshot.backlog_6mo_gm_pct.toFixed(1)}%` : '-'}
              </div>
            </div>
            {/* 12 Mo Out + GM% */}
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Backlog (12 Mo Out)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#6366f1' }}>{fmtCurrency(data.company_snapshot.backlog_12mo)}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '8px', marginBottom: '2px' }}>GM% in Backlog</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: data.company_snapshot.backlog_12mo_gm_pct != null && data.company_snapshot.backlog_12mo_gm_pct >= 15 ? '#059669' : '#dc2626' }}>
                {data.company_snapshot.backlog_12mo_gm_pct != null ? `${data.company_snapshot.backlog_12mo_gm_pct.toFixed(1)}%` : '-'}
              </div>
            </div>
            {/* Average Project GM% */}
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Average Project GM%</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: data.company_snapshot.avg_project_gm_pct != null && data.company_snapshot.avg_project_gm_pct >= 15 ? '#059669' : '#dc2626' }}>
                {data.company_snapshot.avg_project_gm_pct != null ? `${data.company_snapshot.avg_project_gm_pct.toFixed(1)}%` : '-'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Newly Created Jobs */}
      {data?.new_jobs && data.new_jobs.length > 0 && (
        <div className="sales-table-section" style={{ position: 'relative', overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(135deg, #059669, #10b981)' }} />
          <div className="sales-table-header" style={{ paddingTop: '0.875rem' }}>
            <div className="sales-table-title">
              Newly Created Jobs <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.375rem' }}>({data.new_jobs.length})</span>
            </div>
          </div>
          <table className="sales-table">
            <thead>
              <tr>
                <th>Job #</th>
                <th>Name</th>
                <th>Customer</th>
                <th style={{ textAlign: 'right' }}>Contract Value</th>
                <th style={{ textAlign: 'right' }}>GM%</th>
                <th>Manager</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.new_jobs.map(job => (
                <tr key={job.id}>
                  <td style={{ fontWeight: 600, color: '#002356' }}>{job.number || '-'}</td>
                  <td style={{ color: '#3b82f6', fontWeight: 500 }}>{job.name}</td>
                  <td>{job.customer_name || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(job.contract_value)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: job.gross_margin_percent != null && job.gross_margin_percent >= 15 ? '#059669' : job.gross_margin_percent != null ? '#dc2626' : '#64748b' }}>
                    {job.gross_margin_percent != null ? `${Number(job.gross_margin_percent).toFixed(1)}%` : '-'}
                  </td>
                  <td>{job.manager_name || '-'}</td>
                  <td>{fmtDate(job.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Location sections */}
      {orderedLocations.map(loc => (
        <LocationSection key={loc} code={loc} data={data!.by_location[loc]} prefs={prefs} onOppClick={onOppClick} />
      ))}

      {/* Empty state */}
      {orderedLocations.length === 0 && !isLoading && (
        <div className="sales-table-section" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: '0.75rem' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <div style={{ fontWeight: 600, color: '#002356', marginBottom: '0.25rem' }}>No sales activity this week</div>
          <div style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Try selecting a different week or adjusting your location filters</div>
        </div>
      )}
    </div>
  );
};

export default WeeklySalesReport;
