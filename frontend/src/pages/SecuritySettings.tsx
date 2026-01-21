import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TwoFactorSetup from '../components/security/TwoFactorSetup';
import ChangePasswordModal from '../components/security/ChangePasswordModal';
import securityApi from '../services/security';

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

  const getActionColor = (action: string) => {
    if (action.includes('2fa_enabled') || action.includes('password_changed')) {
      return 'text-green-600';
    }
    if (action.includes('disabled') || action.includes('reset')) {
      return 'text-orange-600';
    }
    return 'text-blue-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Security Settings</h1>

        {/* Password Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Password</h2>
          <p className="text-sm text-gray-600 mb-4">
            Change your password to keep your account secure.
          </p>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Change Password
          </button>
        </div>

        {/* 2FA Section */}
        <TwoFactorSetup />

        {/* Security Activity Log */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Security Activity</h2>

          {auditLog && auditLog.length > 0 ? (
            <div className="space-y-3">
              {auditLog.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-start border-b pb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                      {log.metadata?.disabled_by_admin && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          By Admin
                        </span>
                      )}
                      {log.metadata?.reset_by_admin && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          By Admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(log.created_at)}
                      {log.ip_address && ` • ${log.ip_address}`}
                    </div>
                    {log.performed_by_name && log.performed_by !== log.user_id && (
                      <div className="text-xs text-gray-600 mt-1">
                        Performed by: {log.performed_by_name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No security activity recorded yet.</p>
          )}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default SecuritySettings;
