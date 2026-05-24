import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      login(data.access_token, data.user);
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(idToken) {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Google login failed');
    login(data.access_token, data.user);
    navigate('/app');
  }

  return (
    <div className="auth-root">
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-grid" />
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
      </div>

      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Resume<em>Matcher</em>
        </Link>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">
          Don't have an account?{' '}
          <Link to="/signup">Create one free</Link>
        </p>

        {error && <div className="auth-error">{error}</div>}

        <GoogleAuthButton onCredential={handleGoogleCredential} label="Sign in with Google" />

        <div className="auth-divider">or</div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <div className="auth-field-row">
              <label className="auth-label" htmlFor="password">Password</label>
              <a href="#" className="auth-forgot">Forgot password?</a>
            </div>
            <input
              id="password"
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p className="auth-footer-note">
          By signing in you agree to our{' '}
          <a href="#">Terms of Service</a> and{' '}
          <a href="#">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
