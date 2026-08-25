import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, login, login2FA } = useAuth();
  const navigate = useNavigate();

  // If the user lands here already authenticated (typo, stale bookmark, etc.),
  // send them home instead of sitting on the form. Do NOT wipe localStorage
  // here — that was the previous behavior and it killed valid tokens for
  // logged-in users who happened to visit /login.
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);

      // Check if 2FA is required
      if (result.requires2FA) {
        setRequires2FA(true);
        setUserId(result.userId);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      if (err.response?.status === 423) {
        setLockedMinutes(err.response.data.lockedMinutes || 15);
        setError(err.response.data.error);
      } else {
        setLockedMinutes(null);
        setError(err.response?.data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!userId) {
        throw new Error('User ID not found');
      }
      await login2FA(userId, twoFactorCode);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-logo">
          <div className="login-shield">🛡️</div>
        </div>
        <h1 className="login-title">TITAN</h1>

        {error && (
          <div className="alert alert-error">
            {error}
            {lockedMinutes && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.9 }}>
                Please wait {lockedMinutes} minute(s) or contact an administrator to unlock your account.
              </div>
            )}
          </div>
        )}

        {!requires2FA ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.625rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '16px' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Forgot Password?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FASubmit}>
            <div className="form-group">
              <p className="text-sm text-gray-600 mb-3">
                Enter the 6-digit code from your authenticator app or a backup code.
              </p>
              <label className="form-label" htmlFor="twoFactorCode">
                Two-Factor Code
              </label>
              <input
                type="text"
                id="twoFactorCode"
                className="form-input text-center"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                maxLength={8}
                placeholder="000000"
                style={{ fontSize: '1.2rem', letterSpacing: '0.2em' }}
                required
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setUserId(null);
                setTwoFactorCode('');
                setError('');
              }}
              className="btn btn-secondary btn-block mt-2"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
