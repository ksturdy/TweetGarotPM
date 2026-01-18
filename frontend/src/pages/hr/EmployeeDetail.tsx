import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../services/employees';
import { departmentsApi } from '../../services/departments';
import { officeLocationsApi } from '../../services/officeLocations';
import { usersApi } from '../../services/users';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

const EmployeeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const hasWriteAccess = user?.role === 'admin' || user?.hrAccess === 'write';
  const [isEditing, setIsEditing] = useState(false);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getById(Number(id)).then((res) => res.data.data),
  });

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

  React.useEffect(() => {
    if (employee) {
      setFormData({
        userId: employee.user_id?.toString() || '',
        firstName: employee.first_name,
        lastName: employee.last_name,
        email: employee.email,
        phone: employee.phone || '',
        mobilePhone: employee.mobile_phone || '',
        departmentId: employee.department_id?.toString() || '',
        officeLocationId: employee.office_location_id?.toString() || '',
        jobTitle: employee.job_title || '',
        hireDate: employee.hire_date || '',
        employmentStatus: employee.employment_status,
        role: employee.role || 'user',
        notes: employee.notes || '',
      });
    }
  }, [employee]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => employeesApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => employeesApi.delete(Number(id)),
    onSuccess: () => {
      navigate('/hr/employees');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
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
    } as any);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!employee) {
    return <div className="card">Employee not found</div>;
  }

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      inactive: 'badge-warning',
      terminated: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/hr/employees">&larr; Back to Employees</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {employee.first_name} {employee.last_name}
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isEditing && hasWriteAccess && (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                Edit
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {isEditing ? (
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
              {!formData.userId && (
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
              )}

              {createUserAccount && !formData.userId ? (
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
                    Optional: Link this employee to a system user account
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
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditing(false);
                  if (employee) {
                    setFormData({
                      userId: employee.user_id?.toString() || '',
                      firstName: employee.first_name,
                      lastName: employee.last_name,
                      email: employee.email,
                      phone: employee.phone || '',
                      mobilePhone: employee.mobile_phone || '',
                      departmentId: employee.department_id?.toString() || '',
                      officeLocationId: employee.office_location_id?.toString() || '',
                      jobTitle: employee.job_title || '',
                      hireDate: employee.hire_date || '',
                      employmentStatus: employee.employment_status,
                      role: employee.role || 'user',
                      notes: employee.notes || '',
                    });
                  }
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {updateMutation.isError && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                Error updating employee. Please try again.
              </div>
            )}
          </form>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <span className={getStatusBadge(employee.employment_status)}>{employee.employment_status}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Email
                </div>
                <div>{employee.email}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Phone
                </div>
                <div>{employee.phone || '-'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Mobile Phone
                </div>
                <div>{employee.mobile_phone || '-'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Job Title
                </div>
                <div>{employee.job_title || '-'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Department
                </div>
                <div>{employee.department_name || '-'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Office Location
                </div>
                <div>{employee.office_location_name || '-'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Hire Date
                </div>
                <div>{employee.hire_date ? format(new Date(employee.hire_date), 'MMM d, yyyy') : '-'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  HR Role
                </div>
                <div>
                  <span className={employee.role === 'admin' ? 'badge badge-primary' : 'badge badge-info'}>
                    {employee.role === 'admin' ? 'Admin (Full Access)' : 'User (Read-Only)'}
                  </span>
                </div>
              </div>
            </div>

            {employee.notes && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Notes
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{employee.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetail;
