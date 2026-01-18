import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, User, UpdateUserData } from '../services/users';
import './CustomerDetail.css';

const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchName, setSearchName] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formData, setFormData] = useState<UpdateUserData>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'user',
    hr_access: 'none',
    is_active: true,
  });

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const res = await usersApi.getAll();
        console.log('Users API full response:', res);
        console.log('Users API response data:', res.data);
        return res.data;
      } catch (err) {
        console.error('Users API error:', err);
        throw err;
      }
    },
  });

  if (error) {
    console.error('Query error:', error);
  }

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

  const handleToggleStatus = (user: User) => {
    if (window.confirm(`Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} ${user.first_name} ${user.last_name}?`)) {
      updateStatusMutation.mutate({ id: user.id, is_active: !user.is_active });
    }
  };

  const handleDelete = (user: User) => {
    if (window.confirm(`Are you sure you want to delete ${user.first_name} ${user.last_name}? This action cannot be undone.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Filter users based on search and status
  const filteredUsers = users.filter((user: User) => {
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    const nameMatch = fullName.includes(searchName.toLowerCase());

    let statusMatch = true;
    if (statusFilter === 'active') {
      // Handle both boolean true and undefined (default should be active)
      statusMatch = user.is_active === true || user.is_active === undefined;
    } else if (statusFilter === 'inactive') {
      statusMatch = user.is_active === false;
    }

    return nameMatch && statusMatch;
  });

  // Debug logging
  console.log('Total users:', users.length);
  console.log('Filtered users:', filteredUsers.length);
  console.log('Status filter:', statusFilter);
  if (users.length > 0) {
    console.log('Sample user:', users[0]);
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="customer-detail-page">
      <div className="customer-header" style={{ marginBottom: '2rem' }}>
        <div className="customer-header-content">
          <div className="customer-info">
            <h1>User Management</h1>
            <div className="customer-subtitle">Manage system users, roles, and permissions</div>
          </div>
        </div>
      </div>

      <div className="data-section">
        <div className="section-header">
          <h2 className="section-title">
            👥 System Users <span className="tab-count">{filteredUsers.length}</span>
          </h2>
        </div>
        <div className="data-content">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  Name
                  <div style={{ marginTop: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.375rem 0.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </th>
                <th>Email</th>
                <th>Role</th>
                <th>HR Access</th>
                <th>
                  Status
                  <div style={{ marginTop: '0.5rem' }}>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                      style={{
                        width: '100%',
                        padding: '0.375rem 0.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                      }}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user: User) => (
                <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.6 }}>
                  {editingUser?.id === user.id ? (
                    <>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                            style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}
                            placeholder="First name"
                          />
                          <input
                            type="text"
                            value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                            style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}
                            placeholder="Last name"
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          style={{ width: '100%', padding: '0.25rem', fontSize: '0.875rem' }}
                        />
                      </td>
                      <td>
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          style={{ width: '100%', padding: '0.25rem', fontSize: '0.875rem' }}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="user">User</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={formData.hr_access || 'none'}
                          onChange={(e) => setFormData({ ...formData, hr_access: e.target.value })}
                          style={{ width: '100%', padding: '0.25rem', fontSize: '0.875rem' }}
                        >
                          <option value="none">No Access</option>
                          <option value="read">Read Only</option>
                          <option value="write">Full Access</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={formData.is_active ? 'active' : 'inactive'}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                          style={{ width: '100%', padding: '0.25rem', fontSize: '0.875rem' }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={handleSave}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancel}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <strong>{user.first_name} {user.last_name}</strong>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge ${user.role === 'admin' ? 'badge-danger' : user.role === 'manager' ? 'badge-warning' : 'badge-info'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${!user.hr_access || user.hr_access === 'none' ? 'badge-secondary' : user.hr_access === 'read' ? 'badge-info' : 'badge-success'}`}>
                          {!user.hr_access || user.hr_access === 'none' ? 'No Access' : user.hr_access === 'read' ? 'Read Only' : 'Full Access'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${user.is_active ? 'badge-success' : 'badge-secondary'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleEdit(user)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: user.is_active ? '#f59e0b' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
