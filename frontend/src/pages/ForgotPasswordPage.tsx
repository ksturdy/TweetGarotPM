import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
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

        {submitted ? (
          <div>
            <div className="alert" style={{ backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>
              If an account exists with that email, you will receive a password reset link shortly.
            </div>
            <p className="text-sm text-gray-600" style={{ marginTop: '12px' }}>
              Check your email and follow the instructions to reset your password.
            </p>
            <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: '16px' }}>
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-gray-600" style={{ marginBottom: '16px' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

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
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPasswordPage;
