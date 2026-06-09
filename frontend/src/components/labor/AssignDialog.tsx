import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  laborApi,
  ASSIGNMENT_ROLES,
  ASSIGNMENT_TRADES,
  ASSIGNMENT_STATUSES,
  SHIFT_PATTERNS,
  AssignmentRecord,
  AssignmentStatus,
} from '../../services/labor';
import { projectsApi, Project } from '../../services/projects';
import api from '../../services/api';
import '../modals/Modal.css';

interface EmployeeSearchResult {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  job_title?: string;
  title?: string | null;
  trade?: string | null;
}

interface AssignDialogProps {
  open: boolean;
  onClose: () => void;
  lockedProjectId?: number;
  lockedProjectName?: string;
  lockedEmployeeId?: number;
  lockedEmployeeName?: string;
  editing?: AssignmentRecord | null;
  invalidateKeys?: (string | number)[][];
}

const AssignDialog: React.FC<AssignDialogProps> = ({
  open,
  onClose,
  lockedProjectId,
  lockedProjectName,
  lockedEmployeeId,
  lockedEmployeeName,
  editing,
  invalidateKeys,
}) => {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState<number | undefined>(lockedProjectId || editing?.project_id);
  const [employeeId, setEmployeeId] = useState<number | undefined>(lockedEmployeeId || editing?.employee_id);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [pickedEmployeeLabel, setPickedEmployeeLabel] = useState(lockedEmployeeName || '');
  const [pickedProjectLabel, setPickedProjectLabel] = useState(lockedProjectName || '');
  const [role, setRole] = useState<string>(editing?.role || '');
  const [trade, setTrade] = useState<string>(editing?.trade || '');
  const [startDate, setStartDate] = useState(editing?.start_date?.slice(0, 10) || '');
  const [endDate, setEndDate] = useState(editing?.end_date?.slice(0, 10) || '');
  const [startOverridden, setStartOverridden] = useState<boolean>(!!editing?.start_date_overridden);
  const [endOverridden, setEndOverridden] = useState<boolean>(!!editing?.end_date_overridden);
  const [shiftPattern, setShiftPattern] = useState(editing?.shift_pattern || 'M-F');
  const [shiftStart, setShiftStart] = useState(editing?.shift_start_time || '07:00');
  const [shiftEnd, setShiftEnd] = useState(editing?.shift_end_time || '15:30');
  const [status, setStatus] = useState<AssignmentStatus>((editing?.status as AssignmentStatus) || 'planned');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [tagsText, setTagsText] = useState((editing?.tags || []).join(', '));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && editing) {
      setProjectId(editing.project_id);
      setEmployeeId(editing.employee_id);
      setRole(editing.role || '');
      setTrade(editing.trade || '');
      setStartDate(editing.start_date?.slice(0, 10) || '');
      setEndDate(editing.end_date?.slice(0, 10) || '');
      setStartOverridden(!!editing.start_date_overridden);
      setEndOverridden(!!editing.end_date_overridden);
      setShiftPattern(editing.shift_pattern || 'M-F');
      setShiftStart(editing.shift_start_time || '07:00');
      setShiftEnd(editing.shift_end_time || '15:30');
      setStatus((editing.status as AssignmentStatus) || 'planned');
      setNotes(editing.notes || '');
      setTagsText((editing.tags || []).join(', '));
    }
  }, [open, editing]);

  // Pre-fill start/end from project defaults whenever projectId changes
  // (skip when editing — those dates already came from the row).
  const { data: projectDefaults } = useQuery({
    queryKey: ['project-default-dates', projectId],
    queryFn: () => laborApi.getProjectDefaultDates(projectId!),
    enabled: !!projectId && open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!projectDefaults || editing) return;
    if (!startDate && projectDefaults.start_date) {
      setStartDate(projectDefaults.start_date.slice(0, 10));
      setStartOverridden(false);
    }
    if (!endDate && projectDefaults.end_date) {
      setEndDate(projectDefaults.end_date.slice(0, 10));
      setEndOverridden(false);
    }
  }, [projectDefaults, editing, startDate, endDate]);

  // Employee search (only if not locked)
  const { data: employeeResults } = useQuery({
    queryKey: ['assign-employee-search', employeeSearch],
    queryFn: () =>
      api
        .get<EmployeeSearchResult[]>(`/project-assignments/search-employees?q=${encodeURIComponent(employeeSearch)}`)
        .then((r) => r.data),
    enabled: !lockedEmployeeId && employeeSearch.length >= 2,
  });

  const { data: projects } = useQuery({
    queryKey: ['assign-projects-all'],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
    enabled: !lockedProjectId && open,
  });

  const filteredProjects = useMemo(() => {
    if (!projects) return [] as Project[];
    if (!projectSearch) return projects.slice(0, 25);
    const q = projectSearch.toLowerCase();
    return projects
      .filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.number || '').toLowerCase().includes(q) ||
          (p.customer_name || '').toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [projects, projectSearch]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return laborApi.updateAssignment(editing.id, {
          role: role || null,
          trade: trade || null,
          start_date: startDate || null,
          end_date: endDate || null,
          start_date_overridden: startOverridden,
          end_date_overridden: endOverridden,
          shift_pattern: shiftPattern || null,
          shift_start_time: shiftStart || null,
          shift_end_time: shiftEnd || null,
          status,
          notes: notes || null,
          tags: tagsText ? tagsText.split(',').map((t) => t.trim()).filter(Boolean) : null,
        });
      }
      if (!projectId || !employeeId) throw new Error('Project and employee are required.');
      return laborApi.assign({
        projectId,
        employeeId,
        role: role || undefined,
        trade: trade || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        startDateOverridden: startOverridden,
        endDateOverridden: endOverridden,
        shiftPattern: shiftPattern || undefined,
        shiftStartTime: shiftStart || undefined,
        shiftEndTime: shiftEnd || undefined,
        status,
        notes: notes || undefined,
        tags: tagsText ? tagsText.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
    },
    onSuccess: () => {
      (invalidateKeys || [['labor-board'], ['labor-summary'], ['employee-assignments'], ['project-assignments']]).forEach(
        (key) => qc.invalidateQueries({ queryKey: key })
      );
      onClose();
    },
    onError: (e: any) => {
      setError(e?.response?.data?.error || e?.message || 'Failed to save assignment');
    },
  });

  if (!open) return null;

  const dateInputStyle = (overridden: boolean): React.CSSProperties => ({
    ...inputStyle,
    border: `1px solid ${overridden ? '#16a34a' : '#e2e8f0'}`,
    background: overridden ? '#dcfce7' : 'white',
    color: overridden ? '#15803d' : '#475569',
    fontStyle: overridden ? 'normal' : 'italic',
    fontWeight: overridden ? 600 : 400,
  });

  const dateHint = (overridden: boolean, source?: string) =>
    overridden ? 'User override' : (source === 'user_override' ? 'From project user override' : source === 'computed' ? 'From contract size + % complete' : source === 'project_table' ? 'From project end date' : 'Project default');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit Assignment' : 'Assign Crew Member'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '1.5rem 2rem', overflowY: 'auto' }}>
          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: 12, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Employee */}
            <div>
              <label style={lblStyle}>Employee</label>
              {lockedEmployeeId ? (
                <div style={lockedStyle}>{pickedEmployeeLabel || `#${lockedEmployeeId}`}</div>
              ) : employeeId ? (
                <div style={lockedStyle}>
                  {pickedEmployeeLabel}{' '}
                  <button
                    onClick={() => {
                      setEmployeeId(undefined);
                      setPickedEmployeeLabel('');
                    }}
                    style={chipClearStyle}
                  >×</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    style={inputStyle}
                  />
                  {employeeResults && employeeResults.length > 0 && (
                    <div style={dropdownStyle}>
                      {employeeResults.map((e) => (
                        <div
                          key={e.id}
                          onClick={() => {
                            setEmployeeId(e.id);
                            setPickedEmployeeLabel(`${e.first_name} ${e.last_name}`);
                            if (!role && e.title) setRole(e.title);
                            if (!trade && e.trade) setTrade(e.trade);
                          }}
                          style={dropdownItemStyle}
                        >
                          <span style={{ fontWeight: 500 }}>{e.first_name} {e.last_name}</span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {e.title || e.job_title || e.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Project */}
            <div>
              <label style={lblStyle}>Project</label>
              {lockedProjectId ? (
                <div style={lockedStyle}>{pickedProjectLabel || `#${lockedProjectId}`}</div>
              ) : projectId ? (
                <div style={lockedStyle}>
                  {pickedProjectLabel}{' '}
                  <button
                    onClick={() => {
                      setProjectId(undefined);
                      setPickedProjectLabel('');
                      setStartDate('');
                      setEndDate('');
                      setStartOverridden(false);
                      setEndOverridden(false);
                    }}
                    style={chipClearStyle}
                  >×</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    style={inputStyle}
                  />
                  {filteredProjects.length > 0 && (
                    <div style={dropdownStyle}>
                      {filteredProjects.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setProjectId(p.id);
                            setPickedProjectLabel(`${p.number ? p.number + ' — ' : ''}${p.name}`);
                          }}
                          style={dropdownItemStyle}
                        >
                          <span style={{ fontWeight: 500 }}>{p.number} {p.name}</span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{p.customer_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Role */}
            <div>
              <label style={lblStyle}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {ASSIGNMENT_ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>

            {/* Trade */}
            <div>
              <label style={lblStyle}>Trade</label>
              <select value={trade} onChange={(e) => setTrade(e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {ASSIGNMENT_TRADES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label style={lblStyle}>
                Start Date
                {startOverridden && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartOverridden(false);
                      if (projectDefaults?.start_date) setStartDate(projectDefaults.start_date.slice(0, 10));
                    }}
                    style={resetBtnStyle}
                    title="Revert to project default"
                  >
                    revert
                  </button>
                )}
              </label>
              <input
                type="date"
                value={startDate || ''}
                onChange={(e) => { setStartDate(e.target.value); setStartOverridden(true); }}
                style={dateInputStyle(startOverridden)}
              />
              <div style={hintStyle}>{dateHint(startOverridden)}</div>
            </div>

            {/* End Date */}
            <div>
              <label style={lblStyle}>
                End Date
                {endOverridden && (
                  <button
                    type="button"
                    onClick={() => {
                      setEndOverridden(false);
                      if (projectDefaults?.end_date) setEndDate(projectDefaults.end_date.slice(0, 10));
                    }}
                    style={resetBtnStyle}
                    title="Revert to project default"
                  >
                    revert
                  </button>
                )}
              </label>
              <input
                type="date"
                value={endDate || ''}
                onChange={(e) => { setEndDate(e.target.value); setEndOverridden(true); }}
                style={dateInputStyle(endOverridden)}
              />
              <div style={hintStyle}>{dateHint(endOverridden, projectDefaults?.end_source)}</div>
            </div>

            {/* Shift */}
            <div>
              <label style={lblStyle}>Shift Pattern</label>
              <select value={shiftPattern} onChange={(e) => setShiftPattern(e.target.value)} style={inputStyle}>
                {SHIFT_PATTERNS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={lblStyle}>Shift Start</label>
                <input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={lblStyle}>Shift End</label>
                <input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Status */}
            <div>
              <label style={lblStyle}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus)} style={inputStyle}>
                {ASSIGNMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label style={lblStyle}>Tags (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Sheet Metal, Safety Training"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Notes */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lblStyle}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                placeholder="Internal notes about this assignment..."
              />
            </div>
          </div>
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
            style={btnPrimary}
          >
            {assignMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
};

const lblStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  fontSize: '0.75rem', fontWeight: 600,
  color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.6rem', fontSize: '0.85rem',
  border: '1px solid #e2e8f0', borderRadius: 6, background: 'white',
  boxSizing: 'border-box',
};
const lockedStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem', fontSize: '0.85rem',
  background: '#f1f5f9', borderRadius: 6, color: '#1e293b',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const chipClearStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#64748b',
  fontSize: '1rem', cursor: 'pointer',
};
const dropdownStyle: React.CSSProperties = {
  marginTop: 4, background: 'white', border: '1px solid #e2e8f0',
  borderRadius: 6, maxHeight: 200, overflowY: 'auto',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};
const dropdownItemStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem', cursor: 'pointer',
  borderBottom: '1px solid #f1f5f9', display: 'flex',
  justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem',
};
const footerStyle: React.CSSProperties = {
  borderTop: '1px solid #f3f4f6', padding: '1rem 2rem',
  display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
};
const btnPrimary: React.CSSProperties = {
  background: '#002356', color: 'white', border: 'none',
  padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  background: 'white', color: '#475569', border: '1px solid #cbd5e1',
  padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
};
const hintStyle: React.CSSProperties = {
  fontSize: '0.65rem', color: '#94a3b8', marginTop: 2, fontStyle: 'italic',
};
const resetBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#16a34a',
  fontSize: '0.65rem', cursor: 'pointer', padding: 0, textTransform: 'lowercase',
  textDecoration: 'underline', fontWeight: 600,
};

export default AssignDialog;
