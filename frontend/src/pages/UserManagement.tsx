import React, { useState, useMemo, useDeferredValue, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, User, UpdateUserData } from '../services/users';
import securityApi from '../services/security';
import { useAuth } from '../context/AuthContext';
import { useTitanFeedback } from '../context/TitanFeedbackContext';
import '../styles/SalesPipeline.css';

const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { toast, confirm } = useTitanFeedback();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchName, setSearchName] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sortField, setSortField] = useState<'name' | 'last_active' | 'created'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState<UpdateUserData>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'user',
    hr_access: 'none',
    is_active: true,
  });

  // Check if current user has HR write access
  const hasHRWriteAccess = currentUser?.role === 'admin' || currentUser?.hrAccess === 'write';

  // Resizable column widths
  const STORAGE_KEY = 'userManagement_columnWidths';
  const DEFAULT_WIDTHS: Record<string, number> = {
    name: 0, // 0 = flexible, takes remaining space
    email: 220,
    role: 110,
    hrAccess: 130,
    twoFa: 110,
    status: 100,
    lastActive: 120,
    created: 110,
    actions: 200,
  };
  const COLUMN_KEYS = Object.keys(DEFAULT_WIDTHS);
  const MIN_COL_WIDTH = 40;

  const loadSavedWidths = (): Record<string, number> => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_WIDTHS };
  };

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(loadSavedWidths);
  const resizingCol = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleResizeStart = useCallback((colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colKey;
    resizeStartX.current = e.clientX;
    if (columnWidths[colKey] === 0 && tableRef.current) {
      const colIndex = COLUMN_KEYS.indexOf(colKey);
      const th = tableRef.current.querySelector(`thead th:nth-child(${colIndex + 1})`) as HTMLElement;
      resizeStartWidth.current = th ? th.offsetWidth : 200;
    } else {
      resizeStartWidth.current = columnWidths[colKey];
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths, COLUMN_KEYS]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCol.current) return;
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth.current + diff);
      setColumnWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
    };

    const handleMouseUp = () => {
      if (!resizingCol.current) return;
      setColumnWidths(prev => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
      resizingCol.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const getColStyle = (key: string): React.CSSProperties => {
    const w = columnWidths[key];
    if (w === 0) return {};
    return { width: `${w}px` };
  };

  const { data: usersRaw, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((res) => res.data),
    retry: false,
  });
  const users: User[] = Array.isArray(usersRaw) ? usersRaw : [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      usersApi.updateStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: number) => securityApi.resetUserPassword(userId, true),
    onSuccess: (response) => {
      const { temporaryPassword, email } = response.data;
      toast.success(
        `Password reset successful!\n\nEmail: ${email}\nTemporary Password: ${temporaryPassword}\n\nThe user will be required to change their password on next login.\n\nPlease share this temporary password securely with the user.`
      );
    },
    onError: (err: any) => {
      toast.error(`Failed to reset password: ${err.response?.data?.error || 'Unknown error'}`);
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: (userId: number) => securityApi.disable2FAForUser(userId),
    onSuccess: () => {
      toast.success('2FA has been disabled for this user');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(`Failed to disable 2FA: ${err.response?.data?.error || 'Unknown error'}`);
    },
  });

  const forcePasswordChangeMutation = useMutation({
    mutationFn: (userId: number) => securityApi.forcePasswordChange(userId),
    onSuccess: () => {
      toast.success('User will be required to change password on next login');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      hr_access: user.hr_access || 'none',
      is_active: user.is_active,
    });
  };

  const handleSave = () => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData });
    }
  };

  const handleCancel = () => {
    setEditingUser(null);
  };

  const handleToggleStatus = async (user: User) => {
    const ok = await confirm({ message: `Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} ${user.first_name} ${user.last_name}?`, danger: true });
    if (ok) {
      updateStatusMutation.mutate({ id: user.id, is_active: !user.is_active });
    }
  };

  const handleDelete = async (user: User) => {
    const ok = await confirm({ message: `Are you sure you want to delete ${user.first_name} ${user.last_name}? This action cannot be undone.`, danger: true });
    if (ok) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleResetPassword = async (user: User) => {
    const ok = await confirm(`Reset password for ${user.first_name} ${user.last_name}?\n\nA temporary password will be generated and the user will be required to change it on next login.`);
    if (ok) {
      resetPasswordMutation.mutate(user.id);
    }
  };

  const handleDisable2FA = async (user: User) => {
    const ok = await confirm({ message: `Disable 2FA for ${user.first_name} ${user.last_name}?\n\nThis will remove their two-factor authentication protection.`, danger: true });
    if (ok) {
      disable2FAMutation.mutate(user.id);
    }
  };

  const handleForcePasswordChange = async (user: User) => {
    const ok = await confirm(`Force password change for ${user.first_name} ${user.last_name}?\n\nThey will be required to change their password on next login.`);
    if (ok) {
      forcePasswordChangeMutation.mutate(user.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatLastActive = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins <= 0 ? 'Just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'lost';
      case 'manager': return 'quoted';
      case 'foreman': return 'negotiation';
      default: return 'lead';
    }
  };

  const getHRAccessBadgeClass = (hrAccess: string | undefined) => {
    if (!hrAccess || hrAccess === 'none') return 'closed';
    if (hrAccess === 'read') return 'lead';
    return 'awarded';
  };

  // Defer search value so typing stays responsive while filtering catches up
  const deferredSearch = useDeferredValue(searchName);

  // Filter users based on search and status
  const filteredUsers = useMemo(() => {
    const search = deferredSearch.toLowerCase();
    return users.filter((user: User) => {
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
      const nameMatch = !search || fullName.includes(search);

      let statusMatch = true;
      if (statusFilter === 'active') {
        statusMatch = user.is_active === true || user.is_active === undefined;
      } else if (statusFilter === 'inactive') {
        statusMatch = user.is_active === false;
      }

      return nameMatch && statusMatch;
    });
  }, [users, deferredSearch, statusFilter]);

  const handleSort = (field: 'name' | 'last_active' | 'created') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'last_active' ? 'desc' : 'asc');
    }
  };

  const sortedUsers = useMemo(() => [...filteredUsers].sort((a: User, b: User) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name': {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB) * dir;
      }
      case 'last_active': {
        const dateA = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const dateB = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
        return (dateA - dateB) * dir;
      }
      case 'created': {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return (dateA - dateB) * dir;
      }
      default:
        return 0;
    }
  }), [filteredUsers, sortField, sortDirection]);

  const getSortIndicator = (field: 'name' | 'last_active' | 'created') => {
    if (sortField !== field) return ' ↕';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const { activeUsers, adminUsers, twoFAEnabled } = useMemo(() => ({
    activeUsers: users.filter((u: User) => u.is_active === true || u.is_active === undefined),
    adminUsers: users.filter((u: User) => u.role === 'admin'),
    twoFAEnabled: users.filter((u: User) => (u as any).two_factor_enabled),
  }), [users]);

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sales-container">
        <div className="sales-page-header">
          <div className="sales-page-title">
            <div>
              <h1>User Management</h1>
              <div className="sales-subtitle">Error loading users: {(error as Error).message}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/administration" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Administration
            </Link>
            <h1>👤 User Management</h1>
            <div className="sales-subtitle">Manage user accounts and permissions</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <Link to="/roles" className="sales-filter-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            🔐 Roles & Permissions
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid">
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Users</div>
          <div className="sales-kpi-value">{users.length}</div>
          <div className="sales-kpi-trend" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {activeUsers.length} active
          </div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Active Users</div>
          <div className="sales-kpi-value">{activeUsers.length}</div>
        </div>
        <div className="sales-kpi-card amber">
          <div className="sales-kpi-label">Admins</div>
          <div className="sales-kpi-value">{adminUsers.length}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">2FA Enabled</div>
          <div className="sales-kpi-value">{twoFAEnabled.length}</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">System Users ({filteredUsers.length})</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            <select
              className="sales-filter-btn"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              style={{ cursor: 'pointer' }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {JSON.stringify(columnWidths) !== JSON.stringify(DEFAULT_WIDTHS) && (
              <button
                onClick={() => {
                  setColumnWidths({ ...DEFAULT_WIDTHS });
                  localStorage.removeItem(STORAGE_KEY);
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  background: 'transparent',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Reset Columns
              </button>
            )}
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👥</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No users found</div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Try adjusting your filters</p>
          </div>
        ) : (
          <table className="sales-table" ref={tableRef}>
            <colgroup>
              {COLUMN_KEYS.map(key => (
                <col key={key} style={getColStyle(key)} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Name{getSortIndicator('name')}
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('name', e)} />
                </th>
                <th>
                  Email
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('email', e)} />
                </th>
                <th>
                  Role
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('role', e)} />
                </th>
                <th>
                  HR Access
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('hrAccess', e)} />
                </th>
                <th>
                  2FA
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('twoFa', e)} />
                </th>
                <th>
                  Status
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('status', e)} />
                </th>
                <th onClick={() => handleSort('last_active')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Last Active{getSortIndicator('last_active')}
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('lastActive', e)} />
                </th>
                <th onClick={() => handleSort('created')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Created{getSortIndicator('created')}
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('created', e)} />
                </th>
                <th>
                  Actions
                  <div className="col-resize-handle" onMouseDown={(e) => handleResizeStart('actions', e)} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user: User) => (
                <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.6 }}>
                  {editingUser?.id === user.id ? (
                    <>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                            style={{ flex: 1, padding: '6px 10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-dark)' }}
                            placeholder="First name"
                          />
                          <input
                            type="text"
                            value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                            style={{ flex: 1, padding: '6px 10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-dark)' }}
                            placeholder="Last name"
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-dark)' }}
                        />
                      </td>
                      <td>
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-dark)', cursor: 'pointer' }}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="user">User</option>
                          <option value="foreman">Foreman</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={formData.hr_access || 'none'}
                          onChange={(e) => setFormData({ ...formData, hr_access: e.target.value })}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-dark)', cursor: 'pointer' }}
                        >
                          <option value="none">No Access</option>
                          <option value="read">Read Only</option>
                          <option value="write">Full Access</option>
                        </select>
                      </td>
                      <td>
                        <span className={`sales-stage-badge ${(user as any).two_factor_enabled ? 'awarded' : 'closed'}`}>
                          <span className="sales-stage-dot"></span>
                          {(user as any).two_factor_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <select
                          value={formData.is_active ? 'active' : 'inactive'}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-dark)', cursor: 'pointer' }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td>{formatLastActive(user.last_seen_at)}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div className="sales-actions-cell">
                          <button className="sales-action-btn" onClick={handleSave} title="Save changes">
                            💾
                          </button>
                          <button className="sales-action-btn" onClick={handleCancel} title="Cancel editing">
                            ❌
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <div className="sales-project-cell">
                          <div className="sales-project-icon" style={{ background: 'var(--gradient-1)', fontSize: '14px', color: 'white' }}>
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </div>
                          <div className="sales-project-info">
                            <h4>{user.first_name} {user.last_name}</h4>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`sales-stage-badge ${getRoleBadgeClass(user.role)}`}>
                          <span className="sales-stage-dot"></span>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`sales-stage-badge ${getHRAccessBadgeClass(user.hr_access)}`}>
                          <span className="sales-stage-dot"></span>
                          {!user.hr_access || user.hr_access === 'none' ? 'No Access' : user.hr_access === 'read' ? 'Read Only' : 'Full Access'}
                        </span>
                      </td>
                      <td>
                        <span className={`sales-stage-badge ${(user as any).two_factor_enabled ? 'awarded' : 'closed'}`}>
                          <span className="sales-stage-dot"></span>
                          {(user as any).two_factor_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <span className={`sales-stage-badge ${user.is_active ? 'awarded' : 'closed'}`}>
                          <span className="sales-stage-dot"></span>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{formatLastActive(user.last_seen_at)}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div className="sales-actions-cell">
                          <button className="sales-action-btn" onClick={() => handleEdit(user)} title="Edit user">
                            ✏️
                          </button>
                          {hasHRWriteAccess && (
                            <>
                              <button className="sales-action-btn" onClick={() => handleResetPassword(user)} title="Reset password (generates temporary password)">
                                🔐
                              </button>
                              {(user as any).two_factor_enabled && (
                                <button className="sales-action-btn" onClick={() => handleDisable2FA(user)} title="Disable two-factor authentication">
                                  📱
                                </button>
                              )}
                              <button className="sales-action-btn" onClick={() => handleForcePasswordChange(user)} title="Require password change on next login">
                                🔁
                              </button>
                            </>
                          )}
                          <button className="sales-action-btn" onClick={() => handleToggleStatus(user)} title={user.is_active ? 'Deactivate user' : 'Activate user'}>
                            {user.is_active ? '🚫' : '✅'}
                          </button>
                          <button className="sales-action-btn" onClick={() => handleDelete(user)} title="Delete user permanently">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
