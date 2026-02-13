import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../services/employees';
import { departmentsApi } from '../../services/departments';
import { officeLocationsApi } from '../../services/officeLocations';
import { usersApi } from '../../services/users';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import '../../styles/SalesPipeline.css';

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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': return 'awarded';
      case 'inactive': return 'open';
      case 'terminated': return 'lost';
      default: return 'lead';
    }
  };

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="sales-container">
        <div className="sales-chart-card" style={{ textAlign: 'center', padding: '3rem' }}>
          Employee not found
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
            <Link to="/hr/employees" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Employees
            </Link>
            <h1>👤 {employee.first_name} {employee.last_name}</h1>
            <div className="sales-subtitle">{employee.job_title || 'No job title'}</div>
          </div>
        </div>
        <div className="sales-header-actions">
          {!isEditing && hasWriteAccess && (
            <button className="sales-btn sales-btn-secondary" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="sales-chart-card">
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>First Name *</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Last Name *</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email *</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Mobile Phone</label>
                <input type="tel" name="mobilePhone" value={formData.mobilePhone} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Department</label>
                <select name="departmentId" value={formData.departmentId} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
                  <option value="">Select Department</option>
                  {departments?.map((dept) => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Office Location</label>
                <select name="officeLocationId" value={formData.officeLocationId} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
                  <option value="">Select Location</option>
                  {locations?.map((loc) => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Job Title</label>
                <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Hire Date</label>
                <input type="date" name="hireDate" value={formData.hireDate} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Employment Status</label>
                <select name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>HR Role *</label>
                <select name="role" value={formData.role} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
                  <option value="user">User (Read-Only)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
                <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Admin can create, edit, and delete HR data</small>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {!formData.userId && (
                  <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={createUserAccount} onChange={(e) => setCreateUserAccount(e.target.checked)} style={{ marginRight: '8px' }} />
                      <strong>Create Titan User Account</strong>
                    </label>
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Check this to create a login account for this employee</small>
                  </div>
                )}
                {createUserAccount && !formData.userId ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Password *</label>
                      <input type="text" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} required={createUserAccount} minLength={8} placeholder="Minimum 8 characters" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>System Role *</label>
                      <select value={userRole} onChange={(e) => setUserRole(e.target.value)} required={createUserAccount} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
                        <option value="user">User</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Link to Existing User Account</label>
                    <select name="userId" value={formData.userId} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
                      <option value="">No user account</option>
                      {users?.map((user) => (<option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email})</option>))}
                    </select>
                    <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Optional: Link this employee to a system user account</small>
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Notes</label>
                <textarea name="notes" rows={4} value={formData.notes} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="sales-btn sales-btn-secondary" onClick={() => { setIsEditing(false); if (employee) { setFormData({ userId: employee.user_id?.toString() || '', firstName: employee.first_name, lastName: employee.last_name, email: employee.email, phone: employee.phone || '', mobilePhone: employee.mobile_phone || '', departmentId: employee.department_id?.toString() || '', officeLocationId: employee.office_location_id?.toString() || '', jobTitle: employee.job_title || '', hireDate: employee.hire_date || '', employmentStatus: employee.employment_status, role: employee.role || 'user', notes: employee.notes || '' }); } }}>Cancel</button>
              <button type="submit" className="sales-btn sales-btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</button>
            </div>
            {updateMutation.isError && (<div style={{ color: 'var(--accent-rose)', marginTop: '16px', fontSize: '14px' }}>Error updating employee. Please try again.</div>)}
          </form>
        ) : (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <span className={`sales-stage-badge ${getStatusBadgeClass(employee.employment_status)}`}>
                <span className="sales-stage-dot"></span>
                {employee.employment_status}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Email</div>
                <div style={{ fontSize: '14px' }}>{employee.email}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Phone</div>
                <div style={{ fontSize: '14px' }}>{employee.phone || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Mobile Phone</div>
                <div style={{ fontSize: '14px' }}>{employee.mobile_phone || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Job Title</div>
                <div style={{ fontSize: '14px' }}>{employee.job_title || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Department</div>
                <div style={{ fontSize: '14px' }}>{employee.department_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Office Location</div>
                <div style={{ fontSize: '14px' }}>{employee.office_location_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Hire Date</div>
                <div style={{ fontSize: '14px' }}>{employee.hire_date ? format(new Date(employee.hire_date), 'MMM d, yyyy') : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>HR Role</div>
                <div><span className={`sales-stage-badge ${employee.role === 'admin' ? 'quoted' : 'lead'}`}>{employee.role === 'admin' ? 'Admin (Full Access)' : 'User (Read-Only)'}</span></div>
              </div>
            </div>
            {employee.notes && (
              <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Notes</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{employee.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetail;
