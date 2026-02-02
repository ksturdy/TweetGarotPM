import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeesApi } from '../../services/employees';
import { departmentsApi } from '../../services/departments';
import { officeLocationsApi } from '../../services/officeLocations';
import { useAuth } from '../../context/AuthContext';
import '../../styles/SalesPipeline.css';

const HRDashboard: React.FC = () => {
  const { user } = useAuth();
  const hasWriteAccess = user?.role === 'admin' || user?.hrAccess === 'write';
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.getAll().then((res) => res.data.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll().then((res) => res.data.data),
  });

  const { data: locations } = useQuery({
    queryKey: ['office-locations'],
    queryFn: () => officeLocationsApi.getAll().then((res) => res.data.data),
  });

  const employeesList = Array.isArray(employees) ? employees : [];
  const activeEmployees = employeesList.filter((emp) => emp.employment_status === 'active');
  const inactiveEmployees = employeesList.filter((emp) => emp.employment_status === 'inactive');
  const terminatedEmployees = employeesList.filter((emp) => emp.employment_status === 'terminated');

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>Human Resources</h1>
            <div className="sales-subtitle">Manage employees, departments, and locations</div>
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
          <div className="sales-kpi-label">Total Employees</div>
          <div className="sales-kpi-value">{employeesList.length}</div>
          <div className="sales-kpi-trend" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {activeEmployees.length} active
          </div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Active Employees</div>
          <div className="sales-kpi-value">{activeEmployees.length}</div>
          <div className="sales-kpi-trend" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {inactiveEmployees.length} inactive • {terminatedEmployees.length} terminated
          </div>
        </div>
        <div className="sales-kpi-card amber">
          <div className="sales-kpi-label">Departments</div>
          <div className="sales-kpi-value">{departments?.length || 0}</div>
          <Link to="/hr/departments" style={{ fontSize: '13px', color: 'var(--accent-amber)' }}>
            Manage Departments →
          </Link>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Office Locations</div>
          <div className="sales-kpi-value">{locations?.length || 0}</div>
          <Link to="/hr/locations" style={{ fontSize: '13px', color: 'var(--accent-purple)' }}>
            Manage Locations →
          </Link>
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {/* Quick Actions */}
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Quick Actions</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {hasWriteAccess && (
              <Link to="/hr/employees/new" className="sales-btn sales-btn-primary" style={{ justifyContent: 'center' }}>
                Add New Employee
              </Link>
            )}
            <Link to="/hr/employees" className="sales-btn sales-btn-secondary" style={{ justifyContent: 'center' }}>
              View All Employees
            </Link>
            <Link to="/hr/departments" className="sales-btn sales-btn-secondary" style={{ justifyContent: 'center' }}>
              {hasWriteAccess ? 'Manage' : 'View'} Departments
            </Link>
            <Link to="/hr/locations" className="sales-btn sales-btn-secondary" style={{ justifyContent: 'center' }}>
              {hasWriteAccess ? 'Manage' : 'View'} Locations
            </Link>
            {user?.role === 'admin' && (
              <Link to="/users" className="sales-btn sales-btn-secondary" style={{ justifyContent: 'center' }}>
                User Management
              </Link>
            )}
          </div>
        </div>

        {/* Departments List */}
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Departments</div>
              <div className="sales-chart-subtitle">{departments?.length || 0} total</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {departments?.map((dept) => (
              <div key={dept.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{dept.name}</div>
                  {dept.department_number && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                      {dept.department_number}
                    </div>
                  )}
                </div>
                <span className="sales-stage-badge opportunity-received">
                  {dept.employee_count || 0}
                </span>
              </div>
            ))}
            {departments && departments.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No departments found
              </div>
            )}
          </div>
        </div>

        {/* Locations List */}
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Office Locations</div>
              <div className="sales-chart-subtitle">{locations?.length || 0} total</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {locations?.map((location) => (
              <div key={location.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{location.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {location.city && location.state ? `${location.city}, ${location.state}` : '-'}
                  </div>
                </div>
                <span className="sales-stage-badge quoted">
                  {location.employee_count || 0}
                </span>
              </div>
            ))}
            {locations && locations.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No locations found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
