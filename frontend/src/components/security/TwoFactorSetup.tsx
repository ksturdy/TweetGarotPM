import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import securityApi from '../../services/security';

const TwoFactorSetup: React.FC = () => {
  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'backup-codes'>('status');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState('');

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: async () => {
      const response = await securityApi.get2FAStatus();
      return response.data;
    },
  });

  const setupMutation = useMutation({
    mutationFn: securityApi.setup2FA,
    onSuccess: (response) => {
      setSecret(response.data.secret);
      setQrCode(response.data.qrCode);
      setStep('verify');
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to setup 2FA');
    },
  });

  const enableMutation = useMutation({
    mutationFn: () => securityApi.enable2FA(verificationCode, secret),
    onSuccess: (response) => {
      setBackupCodes(response.data.backupCodes);
      setStep('backup-codes');
      setError('');
      refetchStatus();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Invalid verification code');
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => securityApi.disable2FA(disablePassword),
    onSuccess: () => {
      alert('2FA has been disabled');
      setStep('status');
      setDisablePassword('');
      setError('');
      refetchStatus();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to disable 2FA');
    },
  });

  const regenerateBackupCodesMutation = useMutation({
    mutationFn: securityApi.regenerateBackupCodes,
    onSuccess: (response) => {
      setBackupCodes(response.data.backupCodes);
      setStep('backup-codes');
      alert('Backup codes regenerated successfully');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to regenerate backup codes');
    },
  });

  const handleSetup = () => {
    setupMutation.mutate();
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    enableMutation.mutate();
  };

  const handleDisable = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    disableMutation.mutate();
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tweetgarot-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    alert('Backup codes copied to clipboard');
  };

  if (step === 'status') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication</h2>

        {status?.enabled ? (
          <div>
            <div className="flex items-center mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="font-medium">2FA is enabled</span>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Your account is protected with two-factor authentication.
            </p>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                Backup codes remaining: <strong>{status.backupCodesRemaining}</strong>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => regenerateBackupCodesMutation.mutate()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Regenerate Backup Codes
              </button>
              <button
                onClick={() => setStep('setup')}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Disable 2FA
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center mb-4">
              <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
              <span className="font-medium">2FA is not enabled</span>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Add an extra layer of security to your account by enabling two-factor authentication.
            </p>

            <button
              onClick={handleSetup}
              disabled={setupMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {setupMutation.isPending ? 'Setting up...' : 'Enable 2FA'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Set Up 2FA</h2>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
          <div className="flex justify-center mb-4">
            <img src={qrCode} alt="2FA QR Code" className="border p-2" />
          </div>
          <p className="text-xs text-gray-500 text-center mb-2">
            Or enter this code manually:
          </p>
          <div className="bg-gray-100 p-2 rounded text-center font-mono text-sm">
            {secret}
          </div>
        </div>

        <form onSubmit={handleVerify}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              placeholder="000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono text-lg"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep('status');
                setError('');
              }}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enableMutation.isPending || verificationCode.length !== 6}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {enableMutation.isPending ? 'Verifying...' : 'Verify and Enable'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 'backup-codes') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Backup Codes</h2>

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> Save these backup codes in a safe place. Each code can only be used once.
          </p>
        </div>

        <div className="bg-gray-100 p-4 rounded mb-4 font-mono text-sm">
          {backupCodes.map((code, index) => (
            <div key={index} className="py-1">
              {code}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={copyBackupCodes}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Copy Codes
          </button>
          <button
            onClick={downloadBackupCodes}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Download Codes
          </button>
        </div>

        <button
          onClick={() => setStep('status')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    );
  }

  if (step === 'setup' && status?.enabled) {
    // Disable 2FA confirmation
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Disable Two-Factor Authentication</h2>

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            Disabling 2FA will make your account less secure. Enter your password to confirm.
          </p>
        </div>

        <form onSubmit={handleDisable}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep('status');
                setDisablePassword('');
                setError('');
              }}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disableMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
            >
              {disableMutation.isPending ? 'Disabling...' : 'Disable 2FA'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
};

export default TwoFactorSetup;
