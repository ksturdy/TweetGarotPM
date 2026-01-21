import api from './api';

export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  manualEntry: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  backupCodesRemaining: number;
}

export interface BackupCodesResponse {
  message: string;
  backupCodes: string[];
}

export interface SecurityAuditLog {
  id: number;
  user_id: number;
  action: string;
  performed_by: number | null;
  performed_by_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: any;
  created_at: string;
}

const securityApi = {
  // 2FA endpoints
  setup2FA: () => api.post<TwoFactorSetupResponse>('/security/2fa/setup'),

  enable2FA: (token: string, secret: string) =>
    api.post<BackupCodesResponse>('/security/2fa/enable', { token, secret }),

  disable2FA: (password: string) =>
    api.post('/security/2fa/disable', { password }),

  verify2FA: (userId: number, token: string) =>
    api.post<{ verified: boolean; method: string }>('/security/2fa/verify', { userId, token }),

  get2FAStatus: () =>
    api.get<TwoFactorStatusResponse>('/security/2fa/status'),

  regenerateBackupCodes: () =>
    api.post<BackupCodesResponse>('/security/2fa/regenerate-backup-codes'),

  // Password management
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/security/password/change', { currentPassword, newPassword }),

  // HR Admin endpoints
  resetUserPassword: (userId: number, forceChange: boolean = true) =>
    api.post<{ message: string; temporaryPassword: string; email: string; forceChange: boolean }>(
      `/security/password/reset/${userId}`,
      { forceChange }
    ),

  forcePasswordChange: (userId: number) =>
    api.post(`/security/password/force-change/${userId}`),

  disable2FAForUser: (userId: number) =>
    api.post(`/security/2fa/disable/${userId}`),

  // Security audit log
  getAuditLog: (userId?: number) =>
    api.get<SecurityAuditLog[]>(`/security/audit-log${userId ? `/${userId}` : ''}`),
};

export default securityApi;
