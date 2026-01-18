import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../services/employees';
import { departmentsApi } from '../../services/departments';
import { officeLocationsApi } from '../../services/officeLocations';
import { usersApi } from '../../services/users';

const EmployeeForm: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll().then((res) => res.data.data),
  });

  const { data: locations } = useQuery({
    queryKey: ['office-locations'],
    queryFn: () => officeLocationsApi.getAll().then((res) => res.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((res) => res.data),
  });

  const [formData, setFormData] = useState({
    userId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobilePhone: '',
    departmentId: '',
    officeLocationId: '',
    jobTitle: '',
    hireDate: '',
    employmentStatus: 'active',
    role: 'user',
    notes: '',
  });

  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('user');

  const createMutation = useMutation({
    mutationFn: (data: any) => employeesApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate(`/hr/employees/${response.data.data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      userId: formData.userId ? Number(formData.userId) : undefined,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone || undefined,
      mobilePhone: formData.mobilePhone || undefined,
      departmentId: formData.departmentId ? Number(formData.departmentId) : undefined,
      officeLocationId: formData.officeLocationId ? Number(formData.officeLocationId) : undefined,
      jobTitle: formData.jobTitle || undefined,
      hireDate: formData.hireDate || undefined,
      employmentStatus: formData.employmentStatus,
      role: formData.role,
      notes: formData.notes || undefined,
      createUserAccount: createUserAccount,
      userPassword: createUserAccount ? userPassword : undefined,
      userRole: createUserAccount ? userRole : undefined,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/hr/employees">&larr; Back to Employees</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Add New Employee</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                name="firstName"
                className="form-input"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                name="lastName"
                className="form-input"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email *</label>
            <input
              type="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                name="phone"
                className="form-input"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mobile Phone</label>
              <input
                type="tel"
                name="mobilePhone"
                className="form-input"
                value={formData.mobilePhone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department</label>
              <select
                name="departmentId"
                className="form-input"
                value={formData.departmentId}
                onChange={handleChange}
              >
                <option value="">Select Department</option>
                {departments?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Office Location</label>
              <select
                name="officeLocationId"
                className="form-input"
                value={formData.officeLocationId}
                onChange={handleChange}
              >
                <option value="">Select Location</option>
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Job Title</label>
              <input
                type="text"
                name="jobTitle"
                className="form-input"
                value={formData.jobTitle}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hire Date</label>
              <input
                type="date"
                name="hireDate"
                className="form-input"
                value={formData.hireDate}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Employment Status</label>
              <select
                name="employmentStatus"
                className="form-input"
                value={formData.employmentStatus}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">HR Role *</label>
              <select
                name="role"
                className="form-input"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="user">User (Read-Only)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
              <small style={{ color: 'var(--secondary)' }}>
                Admin can create, edit, and delete HR data. User has read-only access.
              </small>
            </div>
          </div>

          <div className="form-group">
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={createUserAccount}
                  onChange={(e) => setCreateUserAccount(e.target.checked)}
                  style={{ marginRight: '0.5rem' }}
                />
                <strong>Create Titan User Account</strong>
              </label>
              <small style={{ color: 'var(--secondary)', display: 'block', marginTop: '0.5rem' }}>
                Check this to create a login account for this employee
              </small>
            </div>

            {createUserAccount ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Password *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    required={createUserAccount}
                    minLength={8}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">System Role *</label>
                  <select
                    className="form-input"
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    required={createUserAccount}
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <small style={{ color: 'var(--secondary)' }}>
                    System role controls access to Titan features (different from HR role)
                  </small>
                </div>
              </div>
            ) : (
              <div>
                <label className="form-label">Link to Existing User Account</label>
                <select
                  name="userId"
                  className="form-input"
                  value={formData.userId}
                  onChange={handleChange}
                >
                  <option value="">No user account</option>
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.email})
                    </option>
                  ))}
                </select>
                <small style={{ color: 'var(--secondary)' }}>
                  Optional: Link this employee to an existing system user account
                </small>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              className="form-input"
              rows={4}
              value={formData.notes}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions">
            <Link to="/hr/employees" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Employee'}
            </button>
          </div>

          {createMutation.isError && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              Error creating employee. Please try again.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;
