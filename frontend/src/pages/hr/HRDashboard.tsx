import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeesApi } from '../../services/employees';
import { departmentsApi } from '../../services/departments';
import { officeLocationsApi } from '../../services/officeLocations';
import { useAuth } from '../../context/AuthContext';

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

  const activeEmployees = employees?.filter((emp) => emp.employment_status === 'active') || [];
  const inactiveEmployees = employees?.filter((emp) => emp.employment_status === 'inactive') || [];
  const terminatedEmployees = employees?.filter((emp) => emp.employment_status === 'terminated') || [];

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Human Resources</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>
            Total Employees
          </h3>
          <div style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {employees?.length || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
            {activeEmployees.length} active • {inactiveEmployees.length} inactive • {terminatedEmployees.length} terminated
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>
            Departments
          </h3>
          <div style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {departments?.length || 0}
          </div>
          <Link to="/hr/departments" style={{ fontSize: '0.875rem' }}>
            Manage Departments →
          </Link>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>
            Office Locations
          </h3>
          <div style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {locations?.length || 0}
          </div>
          <Link to="/hr/locations" style={{ fontSize: '0.875rem' }}>
            Manage Locations →
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Quick Actions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {hasWriteAccess && (
              <Link to="/hr/employees/new" className="btn btn-primary" style={{ textAlign: 'center' }}>
                Add New Employee
              </Link>
            )}
            <Link to="/hr/employees" className="btn btn-secondary" style={{ textAlign: 'center' }}>
              View All Employees
            </Link>
            <Link to="/hr/departments" className="btn btn-secondary" style={{ textAlign: 'center' }}>
              {hasWriteAccess ? 'Manage' : 'View'} Departments
            </Link>
            <Link to="/hr/locations" className="btn btn-secondary" style={{ textAlign: 'center' }}>
              {hasWriteAccess ? 'Manage' : 'View'} Locations
            </Link>
            {user?.role === 'admin' && (
              <Link to="/users" className="btn btn-secondary" style={{ textAlign: 'center' }}>
                User Management
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Departments</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {departments?.map((dept) => (
              <div key={dept.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{dept.name}</div>
                  {dept.department_number && (
                    <div style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>
                      {dept.department_number}
                    </div>
                  )}
                </div>
                <span style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>
                  {dept.employee_count || 0} employees
                </span>
              </div>
            ))}
            {departments && departments.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--secondary)', padding: '1rem' }}>
                No departments found
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Office Locations</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {locations?.map((location) => (
              <div key={location.id} style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 500 }}>{location.name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                  {location.city && location.state ? `${location.city}, ${location.state}` : '-'}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                  {location.employee_count || 0} employees
                </div>
              </div>
            ))}
            {locations && locations.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--secondary)', padding: '1rem' }}>
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
