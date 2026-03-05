import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/SalesPipeline.css';

interface PermissionRow {
  capability: string;
  isCategory?: boolean;
  admin?: boolean;
  manager?: boolean;
  user?: boolean;
  foreman?: boolean;
  note?: string;
}

interface HRPermissionRow {
  capability: string;
  isCategory?: boolean;
  none?: boolean;
  read?: boolean;
  write?: boolean;
}

const rolePermissions: PermissionRow[] = [
  { capability: 'Projects', isCategory: true },
  { capability: 'View projects', admin: true, manager: true, user: true, foreman: false, note: 'Foremen see assigned projects via Field module' },
  { capability: 'Create projects', admin: true, manager: true, user: false, foreman: false },
  { capability: 'Edit projects', admin: true, manager: true, user: false, foreman: false },
  { capability: 'Delete projects', admin: true, manager: false, user: false, foreman: false },
  { capability: 'RFIs / Submittals / Change Orders', isCategory: true },
  { capability: 'View', admin: true, manager: true, user: true, foreman: false },
  { capability: 'Create / Edit', admin: true, manager: true, user: true, foreman: false },
  { capability: 'Daily Reports', isCategory: true },
  { capability: 'View daily reports', admin: true, manager: true, user: true, foreman: false },
  { capability: 'Create / Edit daily reports', admin: true, manager: true, user: true, foreman: false },
  { capability: 'Schedule', isCategory: true },
  { capability: 'View schedule items', admin: true, manager: true, user: true, foreman: false },
  { capability: 'Create / Edit schedule items', admin: true, manager: true, user: true, foreman: false },
  { capability: 'Field Module', isCategory: true },
  { capability: 'Access Field dashboard', admin: true, manager: true, user: true, foreman: true },
  { capability: 'Field daily reports', admin: true, manager: true, user: true, foreman: true, note: 'Foremen: assigned projects only' },
  { capability: 'Field purchase orders', admin: true, manager: true, user: true, foreman: true, note: 'Foremen: assigned projects only' },
  { capability: 'Field fitting orders', admin: true, manager: true, user: true, foreman: true, note: 'Foremen: assigned projects only' },
  { capability: 'Field safety JSA', admin: true, manager: true, user: true, foreman: true, note: 'Foremen: assigned projects only' },
  { capability: 'Administration', isCategory: true },
  { capability: 'Access admin dashboard', admin: true, manager: false, user: false, foreman: false },
  { capability: 'Manage users', admin: true, manager: false, user: false, foreman: false },
  { capability: 'Security settings', admin: true, manager: false, user: false, foreman: false },
  { capability: 'Tenant settings', admin: true, manager: false, user: false, foreman: false },
  { capability: 'Security Actions', isCategory: true },
  { capability: 'Reset user passwords', admin: true, manager: false, user: false, foreman: false, note: 'Also available with HR Full Access' },
  { capability: 'Disable user 2FA', admin: true, manager: false, user: false, foreman: false, note: 'Also available with HR Full Access' },
  { capability: 'Force password change', admin: true, manager: false, user: false, foreman: false, note: 'Also available with HR Full Access' },
];

const hrPermissions: HRPermissionRow[] = [
  { capability: 'HR Dashboard', isCategory: true },
  { capability: 'View HR dashboard', none: false, read: true, write: true },
  { capability: 'Employee Records', isCategory: true },
  { capability: 'View employee records', none: false, read: true, write: true },
  { capability: 'Create / Edit employees', none: false, read: false, write: true },
  { capability: 'Departments & Locations', isCategory: true },
  { capability: 'View departments', none: false, read: true, write: true },
  { capability: 'Manage departments', none: false, read: false, write: true },
  { capability: 'View locations', none: false, read: true, write: true },
  { capability: 'Manage locations', none: false, read: false, write: true },
  { capability: 'User Security Actions', isCategory: true },
  { capability: 'Reset user passwords', none: false, read: false, write: true },
  { capability: 'Disable user 2FA', none: false, read: false, write: true },
  { capability: 'Force password change', none: false, read: false, write: true },
];

const PermissionCell: React.FC<{ allowed?: boolean }> = ({ allowed }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: allowed ? '#dcfce7' : '#fee2e2',
    color: allowed ? '#16a34a' : '#dc2626',
    fontSize: '14px',
    fontWeight: 600,
  }}>
    {allowed ? '✓' : '✕'}
  </span>
);

const RolesPermissions: React.FC = () => {
  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/users" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to User Management
            </Link>
            <h1>🔐 Roles & Permissions</h1>
            <div className="sales-subtitle">Reference guide for system roles and access levels</div>
          </div>
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="sales-kpi-grid">
        <div className="sales-kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="sales-kpi-label">Admin</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '0.5rem' }}>
            Full system access including user management, security settings, and administration
          </div>
        </div>
        <div className="sales-kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="sales-kpi-label">Manager</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '0.5rem' }}>
            Can create and manage projects, RFIs, submittals, and change orders
          </div>
        </div>
        <div className="sales-kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="sales-kpi-label">User</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '0.5rem' }}>
            Can view projects and create RFIs, submittals, daily reports, and schedule items
          </div>
        </div>
        <div className="sales-kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="sales-kpi-label">Foreman</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '0.5rem' }}>
            Field-only access to assigned projects. Can submit daily reports, POs, fitting orders, and JSAs
          </div>
        </div>
      </div>

      {/* System Roles Table */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">System Role Permissions</div>
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Capability</th>
              <th style={{ textAlign: 'center' }}>
                <span className="sales-stage-badge lost"><span className="sales-stage-dot"></span>Admin</span>
              </th>
              <th style={{ textAlign: 'center' }}>
                <span className="sales-stage-badge quoted"><span className="sales-stage-dot"></span>Manager</span>
              </th>
              <th style={{ textAlign: 'center' }}>
                <span className="sales-stage-badge lead"><span className="sales-stage-dot"></span>User</span>
              </th>
              <th style={{ textAlign: 'center' }}>
                <span className="sales-stage-badge negotiation"><span className="sales-stage-dot"></span>Foreman</span>
              </th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rolePermissions.map((row, idx) =>
              row.isCategory ? (
                <tr key={idx} style={{ background: 'var(--bg-dark, #f8fafc)' }}>
                  <td colSpan={6} style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', padding: '10px 16px' }}>
                    {row.capability}
                  </td>
                </tr>
              ) : (
                <tr key={idx}>
                  <td style={{ paddingLeft: '2rem', color: 'var(--text-secondary)' }}>{row.capability}</td>
                  <td style={{ textAlign: 'center' }}><PermissionCell allowed={row.admin} /></td>
                  <td style={{ textAlign: 'center' }}><PermissionCell allowed={row.manager} /></td>
                  <td style={{ textAlign: 'center' }}><PermissionCell allowed={row.user} /></td>
                  <td style={{ textAlign: 'center' }}><PermissionCell allowed={row.foreman} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>{row.note || ''}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* HR Access Levels */}
      <div className="sales-table-section" style={{ marginTop: '1.5rem' }}>
        <div className="sales-table-header">
          <div className="sales-table-title">HR Access Level Permissions</div>
        </div>
        <div style={{ padding: '0.75rem 1.25rem', background: 'var(--bg-dark, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          HR Access is an additional permission layer assigned per user, independent of their system role. Any role (Admin, Manager, or User) can be granted HR access.
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Capability</th>
              <th style={{ textAlign: 'center' }}>
                <span className="sales-stage-badge closed"><span className="sales-stage-dot"></span>No Access</span>
              </th>
              <th style={{ textAlign: 'center' }}>
                <span className="sales-stage-badge lead"><span className="sales-stage-dot"></span>Read Only</span>
              </th>
              <th style={{ textAlign: 'center' }}>
                <span className="sales-stage-badge awarded"><span className="sales-stage-dot"></span>Full Access</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {hrPermissions.map((row, idx) =>
              row.isCategory ? (
                <tr key={idx} style={{ background: 'var(--bg-dark, #f8fafc)' }}>
                  <td colSpan={4} style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', padding: '10px 16px' }}>
                    {row.capability}
                  </td>
                </tr>
              ) : (
                <tr key={idx}>
                  <td style={{ paddingLeft: '2rem', color: 'var(--text-secondary)' }}>{row.capability}</td>
                  <td style={{ textAlign: 'center' }}><PermissionCell allowed={row.none} /></td>
                  <td style={{ textAlign: 'center' }}><PermissionCell allowed={row.read} /></td>
                  <td style={{ textAlign: 'center' }}><PermissionCell allowed={row.write} /></td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RolesPermissions;
