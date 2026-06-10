import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laborApi, AssignmentRecord, ASSIGNMENT_TRADES } from '../../services/labor';
import { employeesApi } from '../../services/employees';
import AssignDialog from '../../components/labor/AssignDialog';
import NotifyDialog from '../../components/labor/NotifyDialog';
import '../../styles/SalesPipeline.css';

type Tab = 'assignments' | 'experience' | 'details';

interface DetailForm {
  phone: string;
  mobile_phone: string;
  trade: string;
  title: string;
  employee_group: string;
  profile_type: string;
  hire_date: string;
  employment_status: string;
}

const avatarColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const LaborEmployeeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const employeeId = Number(id);
  const [tab, setTab] = useState<Tab>('assignments');
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRecord | null>(null);
  const [notifyAssignment, setNotifyAssignment] = useState<AssignmentRecord | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailForm, setDetailForm] = useState<DetailForm>({
    phone: '', mobile_phone: '', trade: '', title: '',
    employee_group: '', profile_type: '', hire_date: '', employment_status: '',
  });
  const qc = useQueryClient();

  const { data: employee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => employeesApi.getById(employeeId).then((r) => r.data.data),
  });

  const { data: current = [] } = useQuery({
    queryKey: ['employee-assignments', employeeId, 'current'],
    queryFn: () => laborApi.getEmployeeAssignments(employeeId, 'current'),
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['employee-assignments', employeeId, 'upcoming'],
    queryFn: () => laborApi.getEmployeeAssignments(employeeId, 'upcoming'),
  });

  const { data: past = [] } = useQuery({
    queryKey: ['employee-assignments', employeeId, 'past'],
    queryFn: () => laborApi.getEmployeeAssignments(employeeId, 'past'),
  });

  const cancelMutation = useMutation({
    mutationFn: (assignmentId: number) => laborApi.cancelAssignment(assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-assignments', employeeId] });
      qc.invalidateQueries({ queryKey: ['labor-board'] });
    },
  });

  const saveDetailsMutation = useMutation({
    mutationFn: () =>
      employeesApi.patchLaborFields(employeeId, {
        phone: detailForm.phone || null,
        mobile_phone: detailForm.mobile_phone || null,
        trade: detailForm.trade || null,
        title: detailForm.title || null,
        employee_group: detailForm.employee_group || null,
        profile_type: detailForm.profile_type || null,
        hire_date: detailForm.hire_date || null,
        employment_status: detailForm.employment_status || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', employeeId] });
      qc.invalidateQueries({ queryKey: ['labor-board'] });
      setEditingDetails(false);
    },
  });

  const startEditingDetails = () => {
    if (!employee) return;
    setDetailForm({
      phone: employee.phone || '',
      mobile_phone: employee.mobile_phone || '',
      trade: (employee as any).trade || '',
      title: (employee as any).title || '',
      employee_group: (employee as any).employee_group || '',
      profile_type: (employee as any).profile_type || '',
      hire_date: employee.hire_date ? employee.hire_date.split('T')[0] : '',
      employment_status: employee.employment_status || 'active',
    });
    setEditingDetails(true);
  };

  if (!employee) {
    return <div className="sales-container"><div style={{ padding: 40 }}>Loading...</div></div>;
  }

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase();
  const yearsWithCompany = employee.hire_date
    ? Math.max(0, Math.floor((Date.now() - new Date(employee.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
    : null;
  const primary = current[0];

  return (
    <div className="sales-container">
      <div style={{ marginBottom: '0.75rem' }}>
        <Link to="/labor" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Back to Labor Board
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
        {/* Left card */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', height: 'fit-content' }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: avatarColors[employee.id % avatarColors.length],
            color: 'white', fontSize: '2.25rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.75rem',
          }}>
            {initials}
          </div>
          <div style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
            {employee.first_name} {employee.last_name}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#475569', marginTop: 2 }}>
            {(employee as any).title || employee.job_title || '—'}
          </div>
          {yearsWithCompany !== null && (
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
              {yearsWithCompany} year{yearsWithCompany === 1 ? '' : 's'} with Tweet/Garot Mechanical
            </div>
          )}
          {(employee as any).profile_type && (
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
              {(employee as any).profile_type} Profile
            </div>
          )}

          <button
            onClick={() => { setEditing(null); setAssignOpen(true); }}
            style={{
              width: '100%', marginTop: '0.85rem',
              background: '#16a34a', color: 'white', border: 'none',
              padding: '0.55rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Add to Project
          </button>

          {primary && (
            <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Current Project
              </div>
              <Link
                to={`/projects/${primary.project_id}`}
                style={{ color: '#002356', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', display: 'block', marginTop: 2 }}
              >
                {primary.project_name}
              </Link>
              {primary.end_date && (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                  Until {formatDate(primary.end_date)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: tabs */}
        <div>
          <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem' }}>
            <TabButton active={tab === 'assignments'} onClick={() => setTab('assignments')}>Assignments</TabButton>
            <TabButton active={tab === 'experience'} onClick={() => setTab('experience')}>Experience</TabButton>
            <TabButton active={tab === 'details'} onClick={() => setTab('details')}>Details</TabButton>
          </div>

          {tab === 'assignments' && (
            <>
              <AssignmentSection
                title="Current Assignments"
                rows={current}
                onEdit={(a) => { setEditing(a); setAssignOpen(true); }}
                onNotify={(a) => setNotifyAssignment(a)}
                onCancel={(a) => {
                  if (window.confirm(`Cancel ${a.first_name || ''} ${a.last_name || ''} on ${a.project_name}?`)) {
                    cancelMutation.mutate(a.id);
                  }
                }}
              />
              <AssignmentSection
                title="Upcoming Assignments"
                rows={upcoming}
                onEdit={(a) => { setEditing(a); setAssignOpen(true); }}
                onNotify={(a) => setNotifyAssignment(a)}
                onCancel={(a) => {
                  if (window.confirm(`Cancel ${a.first_name || ''} ${a.last_name || ''} on ${a.project_name}?`)) {
                    cancelMutation.mutate(a.id);
                  }
                }}
              />
              <AssignmentSection title="Past Assignments" rows={past} pastMode />
            </>
          )}

          {tab === 'experience' && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', color: '#64748b' }}>
              Past project experience derived from past assignments will appear here.
            </div>
          )}

          {tab === 'details' && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                {!editingDetails ? (
                  <button onClick={startEditingDetails} style={editDetailsBtnStyle}>Edit</button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => saveDetailsMutation.mutate()}
                      disabled={saveDetailsMutation.isPending}
                      style={saveDetailsBtnStyle}
                    >
                      {saveDetailsMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingDetails(false)} style={cancelDetailsBtnStyle}>Cancel</button>
                  </div>
                )}
              </div>

              <Detail label="Email" value={employee.email} />

              <DetailEditable
                label="Phone"
                value={formatPhone(employee.phone)}
                editing={editingDetails}
                inputValue={detailForm.phone}
                onChange={(v) => setDetailForm((f) => ({ ...f, phone: v }))}
              />
              <DetailEditable
                label="Mobile"
                value={formatPhone(employee.mobile_phone)}
                editing={editingDetails}
                inputValue={detailForm.mobile_phone}
                onChange={(v) => setDetailForm((f) => ({ ...f, mobile_phone: v }))}
              />
              <DetailEditable
                label="Trade"
                value={(employee as any).trade}
                editing={editingDetails}
                inputValue={detailForm.trade}
                onChange={(v) => setDetailForm((f) => ({ ...f, trade: v }))}
                type="select"
                options={['', ...ASSIGNMENT_TRADES]}
              />
              <DetailEditable
                label="Title"
                value={(employee as any).title}
                editing={editingDetails}
                inputValue={detailForm.title}
                onChange={(v) => setDetailForm((f) => ({ ...f, title: v }))}
              />
              <DetailEditable
                label="Group"
                value={(employee as any).employee_group}
                editing={editingDetails}
                inputValue={detailForm.employee_group}
                onChange={(v) => setDetailForm((f) => ({ ...f, employee_group: v }))}
              />
              <DetailEditable
                label="Profile Type"
                value={(employee as any).profile_type}
                editing={editingDetails}
                inputValue={detailForm.profile_type}
                onChange={(v) => setDetailForm((f) => ({ ...f, profile_type: v }))}
                type="select"
                options={['', 'Field', 'Office', 'Hybrid']}
              />

              <Detail label="Department" value={employee.department_name} />
              <Detail label="Office Location" value={employee.office_location_name} />

              <DetailEditable
                label="Hire Date"
                value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : null}
                editing={editingDetails}
                inputValue={detailForm.hire_date}
                onChange={(v) => setDetailForm((f) => ({ ...f, hire_date: v }))}
                type="date"
              />
              <DetailEditable
                label="Status"
                value={employee.employment_status}
                editing={editingDetails}
                inputValue={detailForm.employment_status}
                onChange={(v) => setDetailForm((f) => ({ ...f, employment_status: v }))}
                type="select"
                options={['active', 'inactive', 'on_leave', 'terminated']}
              />
            </div>
          )}
        </div>
      </div>

      <AssignDialog
        open={assignOpen}
        onClose={() => { setAssignOpen(false); setEditing(null); }}
        lockedEmployeeId={editing ? undefined : employeeId}
        lockedEmployeeName={`${employee.first_name} ${employee.last_name}`}
        editing={editing}
        invalidateKeys={[['employee-assignments', employeeId], ['labor-board'], ['labor-summary']]}
      />

      {notifyAssignment && (
        <NotifyDialog
          open={!!notifyAssignment}
          onClose={() => setNotifyAssignment(null)}
          assignment={notifyAssignment}
        />
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent', border: 'none',
      padding: '0.6rem 1rem', fontSize: '0.9rem', cursor: 'pointer',
      color: active ? '#002356' : '#64748b',
      fontWeight: active ? 700 : 500,
      borderBottom: active ? '2px solid #002356' : '2px solid transparent',
      marginBottom: '-2px',
    }}
  >
    {children}
  </button>
);

const formatPhone = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
};

const Detail: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
    <div style={{ color: '#64748b' }}>{label}</div>
    <div style={{ color: value ? '#1e293b' : '#cbd5e1' }}>{value || '—'}</div>
  </div>
);

const DetailEditable: React.FC<{
  label: string;
  value: any;
  editing: boolean;
  inputValue: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date' | 'select';
  options?: string[];
}> = ({ label, value, editing, inputValue, onChange, type = 'text', options }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', alignItems: 'center' }}>
    <div style={{ color: '#64748b' }}>{label}</div>
    {editing ? (
      type === 'select' ? (
        <select
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: 5, color: '#1e293b', background: 'white' }}
        >
          {options?.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: 5, color: '#1e293b', width: '100%', boxSizing: 'border-box' }}
        />
      )
    ) : (
      <div style={{ color: value ? '#1e293b' : '#cbd5e1' }}>{value || '—'}</div>
    )}
  </div>
);

const editDetailsBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #cbd5e1', color: '#475569',
  padding: '0.3rem 0.85rem', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
};
const saveDetailsBtnStyle: React.CSSProperties = {
  background: '#002356', color: 'white', border: 'none',
  padding: '0.3rem 0.85rem', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
};
const cancelDetailsBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b',
  padding: '0.3rem 0.85rem', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer',
};

const AssignmentSection: React.FC<{
  title: string;
  rows: AssignmentRecord[];
  onEdit?: (a: AssignmentRecord) => void;
  onNotify?: (a: AssignmentRecord) => void;
  onCancel?: (a: AssignmentRecord) => void;
  pastMode?: boolean;
}> = ({ title, rows, onEdit, onNotify, onCancel, pastMode }) => (
  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
    <div style={{ padding: '0.7rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
      {title} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({rows.length})</span>
    </div>
    {rows.length === 0 ? (
      <div style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#94a3b8' }}>None.</div>
    ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#fafbfc' }}>
            <th style={th}>Project</th>
            <th style={th}>Role</th>
            <th style={th}>Start</th>
            <th style={th}>End</th>
            <th style={th}>Shift</th>
            <th style={th}>Tags</th>
            {!pastMode && <th style={th} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={td}>
                <Link to={`/projects/${a.project_id}`} style={{ color: '#002356', textDecoration: 'none', fontWeight: 500 }}>
                  {a.project_name}
                </Link>
                {a.project_number && (
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>#{a.project_number}</div>
                )}
              </td>
              <td style={td}>{a.role || '—'}{a.trade ? <span style={{ color: '#94a3b8' }}> · {a.trade}</span> : null}</td>
              <td style={td}>{renderDateCell(a.start_date, a.start_date_overridden)}</td>
              <td style={td}>{renderDateCell(a.end_date, a.end_date_overridden)}</td>
              <td style={td}>{[a.shift_pattern, a.shift_start_time].filter(Boolean).join(' ')}</td>
              <td style={td}>
                {(a.tags || []).map((t) => (
                  <span key={t} style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', padding: '0.1rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', marginRight: 4 }}>{t}</span>
                ))}
              </td>
              {!pastMode && (
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {onNotify && (
                    <button onClick={() => onNotify(a)} style={iconBtn} title="Send notification">📤 Send</button>
                  )}
                  {onEdit && (
                    <button onClick={() => onEdit(a)} style={iconBtn} title="Edit">✏️</button>
                  )}
                  {onCancel && (
                    <button onClick={() => onCancel(a)} style={{ ...iconBtn, color: '#dc2626' }} title="Cancel">×</button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const renderDateCell = (d: string | null, overridden?: boolean) => {
  if (!d) return <span style={{ color: '#cbd5e1' }}>—</span>;
  if (overridden) {
    return (
      <span
        title="User override"
        style={{
          color: '#15803d', fontWeight: 600,
          background: '#dcfce7', padding: '1px 6px', borderRadius: 4,
        }}
      >
        {formatDate(d)}
      </span>
    );
  }
  return (
    <span title="Project default" style={{ color: '#64748b', fontStyle: 'italic' }}>
      {formatDate(d)}
    </span>
  );
};

const th: React.CSSProperties = {
  padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.7rem',
  textTransform: 'uppercase', color: '#475569', fontWeight: 600, letterSpacing: 0.4,
};
const td: React.CSSProperties = { padding: '0.5rem 0.75rem', verticalAlign: 'middle' };
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: '0.25rem 0.4rem', fontSize: '0.8rem', color: '#475569', marginLeft: 4,
};

export default LaborEmployeeDetail;
