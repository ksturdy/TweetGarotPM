import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, EmployeeFilters } from '../../services/employees';
import { departmentsApi } from '../../services/departments';
import { officeLocationsApi } from '../../services/officeLocations';
import { useAuth } from '../../context/AuthContext';

const EmployeeList: React.FC = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<EmployeeFilters>({
    employmentStatus: 'active',
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', filters],
    queryFn: () => employeesApi.getAll(filters).then((res) => res.data.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll().then((res) => res.data.data),
  });

  const { data: locations } = useQuery({
    queryKey: ['office-locations'],
    queryFn: () => officeLocationsApi.getAll().then((res) => res.data.data),
  });

  const handleFilterChange = (key: keyof EmployeeFilters, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      inactive: 'badge-warning',
      terminated: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  // Check if user has write access
  const hasWriteAccess = user?.role === 'admin' || user?.hrAccess === 'write';

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/hr">&larr; Back to HR Dashboard</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Employees</h1>
        {hasWriteAccess && (
          <Link to="/hr/employees/new" className="btn btn-primary">Add Employee</Link>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Name or email..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Department</label>
            <select
              className="form-input"
              value={filters.departmentId || ''}
              onChange={(e) => handleFilterChange('departmentId', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All Departments</option>
              {departments?.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Office Location</label>
            <select
              className="form-input"
              value={filters.officeLocationId || ''}
              onChange={(e) => handleFilterChange('officeLocationId', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All Locations</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Employment Status</label>
            <select
              className="form-input"
              value={filters.employmentStatus || ''}
              onChange={(e) => handleFilterChange('employmentStatus', e.target.value || undefined)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Job Title</th>
              <th>Department</th>
              <th>Office Location</th>
              <th>HR Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees?.map((employee) => (
              <tr key={employee.id}>
                <td>
                  <Link to={`/hr/employees/${employee.id}`}>
                    {employee.first_name} {employee.last_name}
                  </Link>
                </td>
                <td>{employee.email}</td>
                <td>{employee.job_title || '-'}</td>
                <td>{employee.department_name || '-'}</td>
                <td>{employee.office_location_name || '-'}</td>
                <td>
                  <span className={employee.role === 'admin' ? 'badge badge-primary' : 'badge badge-info'}>
                    {employee.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </td>
                <td>
                  <span className={getStatusBadge(employee.employment_status)}>
                    {employee.employment_status}
                  </span>
                </td>
                <td>
                  {hasWriteAccess ? (
                    <Link to={`/hr/employees/${employee.id}/edit`} className="btn btn-secondary btn-sm">
                      Edit
                    </Link>
                  ) : (
                    <Link to={`/hr/employees/${employee.id}`} className="btn btn-secondary btn-sm">
                      View
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {employees?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeList;
