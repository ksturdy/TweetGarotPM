import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TwoFactorSetup from '../components/security/TwoFactorSetup';

const Force2FASetupPage: React.FC = () => {
  const { clearMustSetup2FA } = useAuth();
  const navigate = useNavigate();

  const handleComplete = () => {
    clearMustSetup2FA();
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-dark, #0f172a)',
      padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
          <h1 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Two-Factor Authentication Required
          </h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
            Your administrator requires you to set up 2FA before you can access the app.
            This only takes a minute.
          </p>
        </div>
        <TwoFactorSetup onComplete={handleComplete} />
      </div>
    </div>
  );
};

export default Force2FASetupPage;
