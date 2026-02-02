import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../services/employees';
import { departmentsApi } from '../../services/departments';
import { officeLocationsApi } from '../../services/officeLocations';
import { usersApi } from '../../services/users';
import '../../styles/SalesPipeline.css';

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
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/hr/employees" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
              &larr; Back to Employees
            </Link>
            <h1>Add New Employee</h1>
            <div className="sales-subtitle">Create a new employee record</div>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="sales-chart-card">
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
              <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={createUserAccount} onChange={(e) => setCreateUserAccount(e.target.checked)} style={{ marginRight: '8px' }} />
                  <strong>Create Titan User Account</strong>
                </label>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Check this to create a login account for this employee</small>
              </div>
              {createUserAccount ? (
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
                    <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>System role controls access to Titan features</small>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Link to Existing User Account</label>
                  <select name="userId" value={formData.userId} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
                    <option value="">No user account</option>
                    {users?.map((user) => (<option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email})</option>))}
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Optional: Link this employee to an existing system user account</small>
                </div>
              )}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Notes</label>
              <textarea name="notes" rows={4} value={formData.notes} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <Link to="/hr/employees" className="sales-btn sales-btn-secondary">Cancel</Link>
            <button type="submit" className="sales-btn sales-btn-primary" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Employee'}</button>
          </div>
          {createMutation.isError && (<div style={{ color: 'var(--accent-rose)', marginTop: '16px', fontSize: '14px' }}>Error creating employee. Please try again.</div>)}
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;
