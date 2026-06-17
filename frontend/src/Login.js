import React, { useState } from 'react';
import './Auth.css';

const API_URL = '/api/auth';
const BACKEND_URL = 'http://localhost:5000';

function Login({ onLoginSuccess, onSwitchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // required: sends/receives the session cookie
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        onLoginSuccess(data.user);
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('Could not reach the server. Is it running?');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const backgroundStyle = {
    background: `url('/assets/background1.jpg') center/cover no-repeat`,
  };

  return (
    <div className="auth-container" style={backgroundStyle}>
      <div className="auth-card auth-card--modal">
        <div className="auth-card-header">
          <img
            src="/assets/logo/logo.png"
            alt="Willow logo"
            className="login-logo-img"
          />
          <span className="deco-title">Willow</span>
        </div>

        <div className="form-wrapper">
          <div className="form-header">
            <h2>Welcome back</h2>
            <p>Log in to continue your journey</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" />
                  Logging in…
                </span>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          <div className="form-footer">
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={onSwitchToSignup}
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
