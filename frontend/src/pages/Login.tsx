import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, login2FA } = useAuth();
  const navigate = useNavigate();

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
      setError(err.response?.data?.error || 'Login failed');
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

        {error && <div className="alert alert-error">{error}</div>}

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
              <input
                type="password"
                id="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
