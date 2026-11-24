import React, { useState } from 'react';
import { parseISO, format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import type { RecurrenceRule } from '../../services/safetyVisits';

interface Props {
  isOpen: boolean;
  anchorDate: string;
  durationDays: number;
  initial?: RecurrenceRule | null;
  onConfirm: (rule: RecurrenceRule) => void;
  onCancel: () => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ORDINALS = [{ value: 1, label: 'First' }, { value: 2, label: 'Second' }, { value: 3, label: 'Third' }, { value: 4, label: 'Fourth' }, { value: -1, label: 'Last' }];

function anchorDow(anchor: string): number {
  const d = parseISO(anchor);
  const jsDay = d.getDay();
  return jsDay === 0 ? 6 : jsDay - 1; // 0=Mon…6=Sun
}

function anchorDom(anchor: string): number {
  return parseISO(anchor).getDate();
}

function anchorMonth(anchor: string): number {
  return parseISO(anchor).getMonth() + 1; // 1-12
}

// Preview: compute first N occurrence dates from the rule
function previewDates(rule: RecurrenceRule, anchorDate: string, max = 5): string[] {
  if (!anchorDate) return [];
  try {
    const start = parseISO(anchorDate);
    const results: Date[] = [];
    const maxCount = rule.endType === 'occurrences' ? Math.min(rule.occurrences || 10, 52) : 52;
    const maxDate = rule.endType === 'by_date' && rule.endByDate
      ? parseISO(rule.endByDate)
      : addYears(start, 2);

    if (rule.type === 'daily') {
      const interval = rule.dailyInterval || 1;
      let cur = start;
      while (results.length < Math.min(maxCount, max) && cur <= maxDate) {
        const jsDay = cur.getDay();
        if (!rule.dailyWeekdaysOnly || (jsDay >= 1 && jsDay <= 5)) results.push(cur);
        cur = addDays(cur, rule.dailyWeekdaysOnly ? 1 : interval);
      }
    } else if (rule.type === 'weekly') {
      const interval = rule.weeklyInterval || 1;
      const days = (rule.weeklyDays || [anchorDow(anchorDate)]).slice().sort((a, b) => a - b);
      const dow = anchorDow(anchorDate);
      let mon = addDays(start, -dow);
      while (results.length < Math.min(maxCount, max) && mon <= maxDate) {
        for (const d of days) {
          const day = addDays(mon, d);
          if (day >= start && day <= maxDate && results.length < Math.min(maxCount, max)) results.push(day);
        }
        mon = addWeeks(mon, interval);
      }
    } else if (rule.type === 'monthly') {
      const interval = rule.monthlyInterval || 1;
      let cur = start;
      let count = 0;
      while (results.length < Math.min(maxCount, max) && cur <= maxDate && count < 100) {
        count++;
        let d: Date | null = null;
        if ((rule.monthlyType || 'day_of_month') === 'day_of_month') {
          d = new Date(cur.getFullYear(), cur.getMonth(), rule.monthlyDay || anchorDom(anchorDate));
        } else {
          d = nthWd(cur.getFullYear(), cur.getMonth(), rule.monthlyWeek || 1, rule.monthlyWeekday ?? anchorDow(anchorDate));
        }
        if (d && d >= start && d <= maxDate) results.push(d);
        cur = addMonths(cur, interval);
      }
    } else if (rule.type === 'yearly') {
      const interval = rule.yearlyInterval || 1;
      const mo = (rule.yearlyMonth || anchorMonth(anchorDate)) - 1;
      let yr = start.getFullYear();
      let count = 0;
      while (results.length < Math.min(maxCount, max) && count < 20) {
        count++;
        let d: Date | null = null;
        if ((rule.yearlyType || 'day_of_month') === 'day_of_month') {
          d = new Date(yr, mo, rule.yearlyDay || anchorDom(anchorDate));
        } else {
          d = nthWd(yr, mo, rule.yearlyWeek || 1, rule.yearlyWeekday ?? anchorDow(anchorDate));
        }
        if (d && d >= start && d <= maxDate) results.push(d);
        yr += interval;
      }
    }

    return results.map(d => format(d, 'EEE, MMM d, yyyy'));
  } catch { return []; }
}

function nthWd(year: number, month: number, week: number, ourWeekday: number): Date | null {
  const jsWd = ourWeekday === 6 ? 0 : ourWeekday + 1;
  if (week === -1) {
    let d = new Date(year, month + 1, 0);
    while (d.getDay() !== jsWd) d = addDays(d, -1);
    return d;
  }
  let d = new Date(year, month, 1);
  while (d.getDay() !== jsWd) d = addDays(d, 1);
  d = addDays(d, (week - 1) * 7);
  return d.getMonth() === month ? d : null;
}

function defaultRule(anchor: string): RecurrenceRule {
  return {
    type: 'weekly',
    weeklyInterval: 1,
    weeklyDays: [anchorDow(anchor)],
    endType: 'occurrences',
    occurrences: 10,
  };
}

const inp: React.CSSProperties = {
  padding: '5px 8px', borderRadius: '5px', border: '1px solid #d1d5db',
  fontSize: '13px', background: '#fff',
};
const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#374151' };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' };

export const RecurrenceModal: React.FC<Props> = ({ isOpen, anchorDate, durationDays, initial, onConfirm, onCancel }) => {
  const [rule, setRule] = useState<RecurrenceRule>(() => initial || defaultRule(anchorDate));

  if (!isOpen) return null;

  const set = (patch: Partial<RecurrenceRule>) => setRule(r => ({ ...r, ...patch }));

  const preview = previewDates(rule, anchorDate);
  const totalCount = rule.endType === 'occurrences' ? (rule.occurrences || 10) : '?';

  const TAB_TYPES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200 }} onClick={onCancel} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1201, background: '#fff', borderRadius: '12px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        width: '480px', maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #002356 0%, #004080 100%)',
          borderBottom: '3px solid #f97316', padding: '16px 20px', color: '#fff', flexShrink: 0,
        }}>
          <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
            Safety Visit
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>↻ Set Recurrence</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>

          {/* ── Recurrence pattern tabs ── */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Recurrence Pattern
            </div>
            <div style={{ display: 'flex', gap: '0', border: '1px solid #d1d5db', borderRadius: '7px', overflow: 'hidden' }}>
              {TAB_TYPES.map(t => (
                <button key={t} onClick={() => set({ type: t })} style={{
                  flex: 1, padding: '7px 4px', border: 'none', fontSize: '12px', fontWeight: 700,
                  background: rule.type === t ? '#002356' : '#fff',
                  color: rule.type === t ? '#fff' : '#6b7280',
                  cursor: 'pointer', textTransform: 'capitalize',
                  borderRight: t !== 'yearly' ? '1px solid #d1d5db' : 'none',
                }}>
                  {t === 'daily' ? 'Daily' : t === 'weekly' ? 'Weekly' : t === 'monthly' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Daily ── */}
          {rule.type === 'daily' && (
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={!rule.dailyWeekdaysOnly} onChange={() => set({ dailyWeekdaysOnly: false })} />
                <span style={lbl}>Every</span>
                <input type="number" min={1} max={365} value={rule.dailyInterval || 1}
                  onChange={e => set({ dailyInterval: Math.max(1, Number(e.target.value)) })}
                  disabled={!!rule.dailyWeekdaysOnly}
                  style={{ ...inp, width: '60px' }} />
                <span style={lbl}>day(s)</span>
              </label>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={!!rule.dailyWeekdaysOnly} onChange={() => set({ dailyWeekdaysOnly: true })} />
                <span style={lbl}>Every weekday (Mon–Fri)</span>
              </label>
            </div>
          )}

          {/* ── Weekly ── */}
          {rule.type === 'weekly' && (
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={row}>
                <span style={lbl}>Recur every</span>
                <input type="number" min={1} max={52} value={rule.weeklyInterval || 1}
                  onChange={e => set({ weeklyInterval: Math.max(1, Number(e.target.value)) })}
                  style={{ ...inp, width: '60px' }} />
                <span style={lbl}>week(s) on:</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DAYS.map((day, i) => {
                  const selected = (rule.weeklyDays || []).includes(i);
                  return (
                    <button key={i} onClick={() => {
                      const days = rule.weeklyDays || [];
                      set({ weeklyDays: selected ? days.filter(d => d !== i) : [...days, i] });
                    }} style={{
                      padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                      border: `1.5px solid ${selected ? '#002356' : '#d1d5db'}`,
                      background: selected ? '#002356' : '#fff',
                      color: selected ? '#fff' : '#374151',
                      cursor: 'pointer',
                    }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Monthly ── */}
          {rule.type === 'monthly' && (
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={(rule.monthlyType || 'day_of_month') === 'day_of_month'}
                  onChange={() => set({ monthlyType: 'day_of_month' })} />
                <span style={lbl}>Day</span>
                <input type="number" min={1} max={31} value={rule.monthlyDay || anchorDom(anchorDate)}
                  onChange={e => set({ monthlyDay: Math.min(31, Math.max(1, Number(e.target.value))) })}
                  disabled={rule.monthlyType === 'day_of_week'}
                  style={{ ...inp, width: '55px' }} />
                <span style={lbl}>of every</span>
                <input type="number" min={1} max={12} value={rule.monthlyInterval || 1}
                  onChange={e => set({ monthlyInterval: Math.max(1, Number(e.target.value)) })}
                  style={{ ...inp, width: '55px' }} />
                <span style={lbl}>month(s)</span>
              </label>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={rule.monthlyType === 'day_of_week'}
                  onChange={() => set({ monthlyType: 'day_of_week' })} />
                <span style={lbl}>The</span>
                <select value={rule.monthlyWeek || 1}
                  onChange={e => set({ monthlyWeek: Number(e.target.value) })}
                  disabled={rule.monthlyType !== 'day_of_week'} style={inp}>
                  {ORDINALS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={rule.monthlyWeekday ?? anchorDow(anchorDate)}
                  onChange={e => set({ monthlyWeekday: Number(e.target.value) })}
                  disabled={rule.monthlyType !== 'day_of_week'} style={inp}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <span style={lbl}>of every</span>
                <input type="number" min={1} max={12} value={rule.monthlyInterval || 1}
                  onChange={e => set({ monthlyInterval: Math.max(1, Number(e.target.value)) })}
                  disabled={rule.monthlyType !== 'day_of_week'}
                  style={{ ...inp, width: '55px' }} />
                <span style={lbl}>month(s)</span>
              </label>
            </div>
          )}

          {/* ── Yearly ── */}
          {rule.type === 'yearly' && (
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={(rule.yearlyType || 'day_of_month') === 'day_of_month'}
                  onChange={() => set({ yearlyType: 'day_of_month' })} />
                <span style={lbl}>Every</span>
                <select value={rule.yearlyMonth || anchorMonth(anchorDate)}
                  onChange={e => set({ yearlyMonth: Number(e.target.value) })}
                  disabled={rule.yearlyType === 'day_of_week'} style={inp}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <input type="number" min={1} max={31} value={rule.yearlyDay || anchorDom(anchorDate)}
                  onChange={e => set({ yearlyDay: Math.min(31, Math.max(1, Number(e.target.value))) })}
                  disabled={rule.yearlyType === 'day_of_week'}
                  style={{ ...inp, width: '55px' }} />
              </label>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={rule.yearlyType === 'day_of_week'}
                  onChange={() => set({ yearlyType: 'day_of_week' })} />
                <span style={lbl}>The</span>
                <select value={rule.yearlyWeek || 1}
                  onChange={e => set({ yearlyWeek: Number(e.target.value) })}
                  disabled={rule.yearlyType !== 'day_of_week'} style={inp}>
                  {ORDINALS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={rule.yearlyWeekday ?? anchorDow(anchorDate)}
                  onChange={e => set({ yearlyWeekday: Number(e.target.value) })}
                  disabled={rule.yearlyType !== 'day_of_week'} style={inp}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <span style={lbl}>of</span>
                <select value={rule.yearlyMonth || anchorMonth(anchorDate)}
                  onChange={e => set({ yearlyMonth: Number(e.target.value) })}
                  disabled={rule.yearlyType !== 'day_of_week'} style={inp}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </label>
              <div style={row}>
                <span style={lbl}>Every</span>
                <input type="number" min={1} max={10} value={rule.yearlyInterval || 1}
                  onChange={e => set({ yearlyInterval: Math.max(1, Number(e.target.value)) })}
                  style={{ ...inp, width: '55px' }} />
                <span style={lbl}>year(s)</span>
              </div>
            </div>
          )}

          {/* ── Range of recurrence ── */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Range of Recurrence
            </div>
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={rule.endType === 'no_end'} onChange={() => set({ endType: 'no_end' })} />
                <span style={lbl}>No end date</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>(up to 52 visits or 2 years)</span>
              </label>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={rule.endType === 'occurrences'} onChange={() => set({ endType: 'occurrences' })} />
                <span style={lbl}>End after</span>
                <input type="number" min={2} max={52}
                  value={rule.occurrences || 10}
                  onChange={e => set({ occurrences: Math.min(52, Math.max(2, Number(e.target.value))) })}
                  disabled={rule.endType !== 'occurrences'}
                  style={{ ...inp, width: '60px' }} />
                <span style={lbl}>occurrences</span>
              </label>
              <label style={{ ...row, cursor: 'pointer' }}>
                <input type="radio" checked={rule.endType === 'by_date'} onChange={() => set({ endType: 'by_date' })} />
                <span style={lbl}>End by</span>
                <input type="date"
                  value={rule.endByDate || ''}
                  min={anchorDate}
                  onChange={e => set({ endByDate: e.target.value })}
                  disabled={rule.endType !== 'by_date'}
                  style={inp} />
              </label>
            </div>
          </div>

          {/* ── Preview ── */}
          {preview.length > 0 && (
            <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#1d4ed8' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                Preview — first {preview.length} of {totalCount} occurrence{totalCount !== 1 ? 's' : ''}:
              </div>
              {preview.map((d, i) => (
                <div key={i} style={{ padding: '1px 0', opacity: i > 2 ? 0.6 : 1 }}>
                  {i + 1}. {d}
                </div>
              ))}
              {rule.endType !== 'occurrences' && <div style={{ marginTop: '4px', opacity: 0.6 }}>…</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
          background: '#f9fafb', flexShrink: 0,
        }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: '7px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(rule)} style={{ padding: '8px 20px', borderRadius: '7px', border: 'none', background: '#002356', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            OK
          </button>
        </div>
      </div>
    </>
  );
};
