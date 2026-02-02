import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TwoFactorSetup from '../components/security/TwoFactorSetup';
import ChangePasswordModal from '../components/security/ChangePasswordModal';
import securityApi from '../services/security';
import '../styles/SalesPipeline.css';

const SecuritySettings: React.FC = () => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const { data: auditLog } = useQuery({
    queryKey: ['security-audit-log'],
    queryFn: async () => {
      const response = await securityApi.getAuditLog();
      return response.data;
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      password_changed: 'Password Changed',
      password_reset: 'Password Reset',
      '2fa_enabled': '2FA Enabled',
      '2fa_disabled': '2FA Disabled',
      '2fa_used': '2FA Login',
      backup_code_used: 'Backup Code Used',
    };
    return labels[action] || action;
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('2fa_enabled') || action.includes('password_changed')) {
      return 'awarded';
    }
    if (action.includes('disabled') || action.includes('reset')) {
      return 'quoted';
    }
    return 'lead';
  };

  const passwordChanges = auditLog?.filter((log: any) => log.action.includes('password')) || [];
  const twoFAEvents = auditLog?.filter((log: any) => log.action.includes('2fa')) || [];

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>Security Settings</h1>
            <div className="sales-subtitle">Manage your account security and authentication</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Security Events</div>
          <div className="sales-kpi-value">{auditLog?.length || 0}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Password Changes</div>
          <div className="sales-kpi-value">{passwordChanges.length}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">2FA Events</div>
          <div className="sales-kpi-value">{twoFAEvents.length}</div>
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
        {/* Password Section */}
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Password</div>
              <div className="sales-chart-subtitle">Change your password to keep your account secure</div>
            </div>
          </div>
          <div style={{ padding: '0' }}>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="sales-btn sales-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Change Password
            </button>
          </div>
        </div>

        {/* 2FA Section */}
        <div className="sales-chart-card" style={{ padding: 0 }}>
          <TwoFactorSetup />
        </div>
      </div>

      {/* Security Activity Log */}
      <div className="sales-table-section" style={{ marginTop: '20px' }}>
        <div className="sales-table-header">
          <div className="sales-table-title">Security Activity</div>
        </div>

        {auditLog && auditLog.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
            {auditLog.slice(0, 10).map((log: any) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--bg-dark)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`sales-stage-badge ${getActionBadgeClass(log.action)}`}>
                    <span className="sales-stage-dot"></span>
                    {getActionLabel(log.action)}
                  </span>
                  {(log.metadata?.disabled_by_admin || log.metadata?.reset_by_admin) && (
                    <span className="sales-stage-badge quoted">
                      <span className="sales-stage-dot"></span>
                      By Admin
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {formatDate(log.created_at)}
                    {log.ip_address && ` • ${log.ip_address}`}
                  </div>
                  {log.performed_by_name && log.performed_by !== log.user_id && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Performed by: {log.performed_by_name}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🔒</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No security activity recorded yet</div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Activity will appear here as security events occur</p>
          </div>
        )}
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default SecuritySettings;
