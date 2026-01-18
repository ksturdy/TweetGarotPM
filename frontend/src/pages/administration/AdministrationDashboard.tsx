import React from 'react';
import { Link } from 'react-router-dom';
import './AdministrationDashboard.css';

const AdministrationDashboard: React.FC = () => {
  const submodules = [
    {
      name: 'User Management',
      icon: '👥',
      path: '/users',
      desc: 'Manage system users, roles, and permissions',
      ready: true
    },
    {
      name: 'Accounting',
      icon: '💵',
      path: '/administration/accounting',
      desc: 'General Ledger, Chart of Accounts, Financial Reports',
      ready: false
    },
    {
      name: 'Accounts Payable',
      icon: '💳',
      path: '/administration/accounts-payable',
      desc: 'Vendor Payments, Bills, Purchase Orders',
      ready: false
    },
    {
      name: 'Accounts Receivable',
      icon: '💰',
      path: '/administration/accounts-receivable',
      desc: 'Invoicing, Collections, Customer Payments',
      ready: false
    }
  ];

  return (
    <div className="administration-dashboard">
      <div className="administration-header">
        <h1>Administration</h1>
        <p className="administration-subtitle">
          Manage accounting, financial operations, risk management, and payment processing
        </p>
      </div>

      <div className="administration-modules">
        {submodules.map((submodule) => (
          <Link
            key={submodule.name}
            to={submodule.ready ? submodule.path : '#'}
            className={`admin-module-card ${submodule.ready ? 'ready' : 'disabled'}`}
            onClick={(e) => !submodule.ready && e.preventDefault()}
          >
            {!submodule.ready && <span className="coming-soon-badge">Coming Soon</span>}
            <div className="admin-module-icon">{submodule.icon}</div>
            <div className="admin-module-content">
              <h3 className="admin-module-name">{submodule.name}</h3>
              <p className="admin-module-desc">{submodule.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="administration-info">
        <div className="info-card">
          <h3>📊 Financial Overview</h3>
          <p>
            The Administration module provides comprehensive tools for managing all financial
            aspects of Tweet Garot Mechanical's operations.
          </p>
        </div>

        <div className="info-card">
          <h3>🔒 Security & Compliance</h3>
          <p>
            All financial data is encrypted and access-controlled. The system maintains
            detailed audit trails for compliance and reporting purposes.
          </p>
        </div>

        <div className="info-card">
          <h3>📈 Integration</h3>
          <p>
            The Administration module integrates seamlessly with Project Management,
            Estimating, and other Titan modules for end-to-end business management.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdministrationDashboard;
