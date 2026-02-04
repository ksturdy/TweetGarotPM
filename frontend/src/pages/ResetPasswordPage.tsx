import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const validatePassword = (): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-logo">
          <div className="login-shield">🛡️</div>
        </div>
        <h1 className="login-title">TITAN</h1>

        {error && <div className="alert alert-error">{error}</div>}

        {success ? (
          <div>
            <div className="alert" style={{ backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>
              Your password has been reset successfully!
            </div>
            <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: '16px' }}>
              Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-gray-600" style={{ marginBottom: '16px' }}>
              Enter your new password below.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                New Password
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              <small style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                At least 8 characters with uppercase, lowercase, and number
              </small>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <Link to="/login" className="btn btn-secondary btn-block" style={{ marginTop: '8px' }}>
              Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
