import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
import './Auth.css';

export default function Signup() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      localStorage.setItem('rm_token', data.access_token);
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
    if (!res.ok) throw new Error(data.detail || 'Google signup failed');
    localStorage.setItem('rm_token', data.access_token);
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

        <h1 className="auth-title">Create an account</h1>
        <p className="auth-sub">
          Already have one?{' '}
          <Link to="/login">Sign in</Link>
        </p>

        {error && <div className="auth-error">{error}</div>}

        <GoogleAuthButton onCredential={handleGoogleCredential} label="Sign up with Google" />

        <div className="auth-divider">or</div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-name-row">
            <div className="auth-field">
              <label className="auth-label" htmlFor="first-name">First Name</label>
              <input
                id="first-name"
                className="auth-input"
                type="text"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="last-name">Last Name</label>
              <input
                id="last-name"
                className="auth-input"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>
          </div>

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
            <label className="auth-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="auth-input"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Get Started →'}
          </button>
        </form>

        <p className="auth-footer-note">
          By signing up you agree to our{' '}
          <a href="#">Terms of Service</a> and{' '}
          <a href="#">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
