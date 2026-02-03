import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, EmployeeFilters } from '../../services/employees';
import { departmentsApi } from '../../services/departments';
import { officeLocationsApi } from '../../services/officeLocations';
import { useAuth } from '../../context/AuthContext';
import '../../styles/SalesPipeline.css';

const EmployeeList: React.FC = () => {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<EmployeeFilters>({
    employmentStatus: 'active',
  });

  // Debounce search input to avoid refetching on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: searchInput || undefined,
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': return 'awarded';
      case 'inactive': return 'open';
      case 'terminated': return 'lost';
      default: return 'lead';
    }
  };

  const hasWriteAccess = user?.role === 'admin' || user?.hrAccess === 'write';

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
          Loading...
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
            <Link to="/hr" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
              &larr; Back to HR Dashboard
            </Link>
            <h1>Employees</h1>
            <div className="sales-subtitle">Manage employee records</div>
          </div>
        </div>
        <div className="sales-header-actions">
          {hasWriteAccess && (
            <Link to="/hr/employees/new" className="sales-btn sales-btn-primary">
              + Add Employee
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid">
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Showing</div>
          <div className="sales-kpi-value">{employees?.length || 0}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Active Filter</div>
          <div className="sales-kpi-value">{filters.employmentStatus || 'All'}</div>
        </div>
        <div className="sales-kpi-card amber">
          <div className="sales-kpi-label">Departments</div>
          <div className="sales-kpi-value">{departments?.length || 0}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Locations</div>
          <div className="sales-kpi-value">{locations?.length || 0}</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Employees</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search employees..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select
              className="sales-filter-btn"
              value={filters.departmentId || ''}
              onChange={(e) => handleFilterChange('departmentId', e.target.value ? Number(e.target.value) : undefined)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">All Departments</option>
              {departments?.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <select
              className="sales-filter-btn"
              value={filters.officeLocationId || ''}
              onChange={(e) => handleFilterChange('officeLocationId', e.target.value ? Number(e.target.value) : undefined)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">All Locations</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <select
              className="sales-filter-btn"
              value={filters.employmentStatus || ''}
              onChange={(e) => handleFilterChange('employmentStatus', e.target.value || undefined)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>

        {employees?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👥</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No employees found</div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Try adjusting your filters</p>
          </div>
        ) : (
          <table className="sales-table">
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
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: 'var(--gradient-1)', fontSize: '14px', color: 'white' }}>
                        {employee.first_name?.[0]}{employee.last_name?.[0]}
                      </div>
                      <div className="sales-project-info">
                        <h4>
                          <Link to={`/hr/employees/${employee.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {employee.first_name} {employee.last_name}
                          </Link>
                        </h4>
                      </div>
                    </div>
                  </td>
                  <td>{employee.email}</td>
                  <td>{employee.job_title || '-'}</td>
                  <td>{employee.department_name || '-'}</td>
                  <td>{employee.office_location_name || '-'}</td>
                  <td>
                    <span className={`sales-stage-badge ${employee.role === 'admin' ? 'quoted' : 'lead'}`}>
                      <span className="sales-stage-dot"></span>
                      {employee.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span className={`sales-stage-badge ${getStatusBadgeClass(employee.employment_status)}`}>
                      <span className="sales-stage-dot"></span>
                      {employee.employment_status}
                    </span>
                  </td>
                  <td>
                    <div className="sales-actions-cell">
                      {hasWriteAccess ? (
                        <Link to={`/hr/employees/${employee.id}/edit`} className="sales-action-btn" title="Edit">
                          ✏️
                        </Link>
                      ) : (
                        <Link to={`/hr/employees/${employee.id}`} className="sales-action-btn" title="View">
                          👁️
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EmployeeList;
