import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { laborApi, AssignmentRecord } from '../../services/labor';
import '../../styles/SalesPipeline.css';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const startOfWeek = (d: Date) => addDays(d, -d.getDay());

const LaborCalendar: React.FC = () => {
  const [anchor, setAnchor] = useState<Date>(startOfWeek(new Date()));
  const [weeks, setWeeks] = useState<number>(2);

  const from = isoDate(anchor);
  const to = isoDate(addDays(anchor, weeks * 7 - 1));

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['labor-calendar', from, to],
    queryFn: () => laborApi.getCalendar(from, to),
  });

  const days = useMemo(() => {
    const total = weeks * 7;
    return Array.from({ length: total }, (_, i) => addDays(anchor, i));
  }, [anchor, weeks]);

  const byEmployee = useMemo(() => {
    const map = new Map<number, { name: string; rows: AssignmentRecord[] }>();
    for (const a of rows) {
      const key = a.employee_id;
      if (!map.has(key)) {
        map.set(key, { name: `${a.first_name || ''} ${a.last_name || ''}`.trim(), rows: [] });
      }
      map.get(key)!.rows.push(a);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

  const isInRange = (a: AssignmentRecord, day: Date) => {
    const start = a.start_date ? new Date(a.start_date) : null;
    const end = a.end_date ? new Date(a.end_date) : null;
    const target = new Date(isoDate(day));
    if (start && target < start) return false;
    if (end && target > end) return false;
    return true;
  };

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/labor" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>← Back to Labor Board</Link>
            <h1>📅 Labor Calendar</h1>
            <div className="sales-subtitle">Multi-week crew coverage at a glance.</div>
          </div>
        </div>
        <div className="sales-header-actions" style={{ gap: '0.5rem', display: 'flex' }}>
          <button className="sales-filter-btn" onClick={() => setAnchor(addDays(anchor, -7 * weeks))}>← Prev</button>
          <button className="sales-filter-btn" onClick={() => setAnchor(startOfWeek(new Date()))}>Today</button>
          <button className="sales-filter-btn" onClick={() => setAnchor(addDays(anchor, 7 * weeks))}>Next →</button>
          <select className="sales-filter-btn" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            <option value={1}>1 week</option>
            <option value={2}>2 weeks</option>
            <option value={4}>4 weeks</option>
          </select>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...th, position: 'sticky', left: 0, background: '#f8fafc', minWidth: 160, textAlign: 'left' }}>Employee</th>
                {days.map((d) => (
                  <th key={d.toISOString()} style={{ ...th, minWidth: 86 }}>
                    <div>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div style={{ color: '#64748b', fontWeight: 500 }}>{d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byEmployee.length === 0 && (
                <tr><td colSpan={days.length + 1} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No assignments in this range.</td></tr>
              )}
              {byEmployee.map(([empId, { name, rows: rs }]) => (
                <tr key={empId} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ ...td, position: 'sticky', left: 0, background: 'white', fontWeight: 500 }}>
                    <Link to={`/labor/employee/${empId}`} style={{ color: '#002356', textDecoration: 'none' }}>{name}</Link>
                  </td>
                  {days.map((d) => {
                    const hit = rs.find((a) => isInRange(a, d));
                    return (
                      <td key={d.toISOString()} style={{ ...td, textAlign: 'center', padding: 2 }}>
                        {hit ? (
                          <Link
                            to={`/projects/${hit.project_id}`}
                            title={`${hit.project_name} (${hit.role || ''})`}
                            style={{
                              display: 'block', background: '#dbeafe', color: '#1d4ed8',
                              padding: '0.2rem 0.3rem', borderRadius: 4, fontSize: '0.7rem',
                              textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                          >
                            {hit.project_number || hit.project_name?.slice(0, 8)}
                          </Link>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const th: React.CSSProperties = {
  padding: '0.5rem 0.4rem', textAlign: 'center', fontSize: '0.7rem',
  textTransform: 'uppercase', color: '#475569', fontWeight: 700, letterSpacing: 0.4,
  borderBottom: '2px solid #e2e8f0',
};
const td: React.CSSProperties = { padding: '0.5rem 0.5rem', verticalAlign: 'middle' };

export default LaborCalendar;
