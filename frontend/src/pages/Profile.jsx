import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './Profile.css';

const MAX_RESUMES = 5;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [resumes, setResumes] = useState([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [resumesError, setResumesError] = useState(null);

  const [uploadMode, setUploadMode] = useState('pdf');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadText, setUploadText] = useState('');
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    fetchResumes();
  }, []);

  async function fetchResumes() {
    setResumesLoading(true);
    setResumesError(null);
    try {
      const res = await fetch('/api/profile/resumes', { headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load resumes');
      setResumes(data);
    } catch (err) {
      setResumesError(err.message);
    } finally {
      setResumesLoading(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      if (uploadMode === 'pdf') {
        if (!uploadFile) { setUploadError('Select a PDF first'); setUploading(false); return; }
        body.append('file', uploadFile);
      } else {
        if (!uploadText.trim()) { setUploadError('Paste some text first'); setUploading(false); return; }
        body.append('text', uploadText);
      }
      if (uploadLabel.trim()) body.append('label', uploadLabel.trim());

      const res = await fetch('/api/profile/resumes', {
        method: 'POST',
        headers: authHeaders(token),
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');

      setResumes((prev) => [data, ...prev]);
      setUploadFile(null);
      setUploadText('');
      setUploadLabel('');
      setShowUpload(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/profile/resumes/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Delete failed');
      }
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  const slotsFull = resumes.length >= MAX_RESUMES;

  return (
    <div className="pf-root">

      {/* ── NAV ── */}
      <nav className="pf-nav">
        <div className="pf-nav-inner">
          <Link to="/" className="pf-logo">Resume<em>Matcher</em></Link>
          <div className="pf-nav-right">
            <Link to="/app" className="pf-nav-link">Dashboard</Link>
            <button className="pf-nav-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </nav>

      <main className="pf-main">

        {/* ── USER CARD ── */}
        <section className="pf-user-card">
          <div className="pf-avatar-lg">{initials}</div>
          <div className="pf-user-info">
            <h1 className="pf-user-name">{user?.first_name} {user?.last_name}</h1>
            <p className="pf-user-email">{user?.email}</p>
            <div className="pf-providers">
              {(user?.auth_providers ?? []).map((p) => (
                <span key={p} className={`pf-provider-badge pf-provider-${p}`}>
                  {p === 'google' ? '⬡ Google' : '⬡ Password'}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── RESUME VAULT ── */}
        <section className="pf-vault">
          <div className="pf-vault-hd">
            <div>
              <h2 className="pf-vault-title">Resume Vault</h2>
              <p className="pf-vault-sub">Save up to {MAX_RESUMES} resumes and select them directly in the app.</p>
            </div>
            <div className="pf-vault-hd-right">
              <span className={`pf-slot-badge ${slotsFull ? 'pf-slot-full' : ''}`}>
                {resumes.length} / {MAX_RESUMES}
              </span>
              {!slotsFull && (
                <button
                  className="pf-btn"
                  onClick={() => setShowUpload((v) => !v)}
                >
                  {showUpload ? 'Cancel' : '+ Save Resume'}
                </button>
              )}
            </div>
          </div>

          {/* Upload panel */}
          {showUpload && (
            <div className="pf-upload-panel">
              <div className="pf-tabs">
                <button
                  type="button"
                  className={`pf-tab ${uploadMode === 'pdf' ? 'pf--active' : ''}`}
                  onClick={() => { setUploadMode('pdf'); setUploadError(null); }}
                >
                  Upload PDF
                </button>
                <button
                  type="button"
                  className={`pf-tab ${uploadMode === 'paste' ? 'pf--active' : ''}`}
                  onClick={() => { setUploadMode('paste'); setUploadError(null); }}
                >
                  Paste Text
                </button>
              </div>

              <form className="pf-upload-form" onSubmit={handleUpload}>
                <div className="pf-field">
                  <label className="pf-label">Label (optional)</label>
                  <input
                    className="pf-input"
                    type="text"
                    placeholder="e.g. Senior Dev Resume, 2025"
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                    maxLength={60}
                  />
                </div>

                {uploadMode === 'pdf' ? (
                  <div className="pf-dropzone">
                    <input
                      ref={fileRef}
                      className="pf-file-input"
                      id="pf-pdf"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setUploadFile(e.target.files[0] ?? null)}
                    />
                    <label htmlFor="pf-pdf" className="pf-dropzone-label">
                      <span className="pf-dropzone-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                      </span>
                      <span className="pf-dropzone-main">
                        {uploadFile ? uploadFile.name : 'Drop PDF here or click to browse'}
                      </span>
                      <span className="pf-dropzone-hint">PDF only · max 10 MB</span>
                    </label>
                  </div>
                ) : (
                  <textarea
                    className="pf-textarea"
                    placeholder="Paste your resume text here…"
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                  />
                )}

                {uploadError && <div className="pf-error">{uploadError}</div>}

                <button type="submit" className="pf-btn" disabled={uploading}>
                  {uploading ? 'Saving…' : 'Save Resume →'}
                </button>
              </form>
            </div>
          )}

          {slotsFull && !showUpload && (
            <div className="pf-slots-full">
              Vault is full — delete a resume to add a new one.
            </div>
          )}

          {/* Resume list */}
          {resumesLoading ? (
            <div className="pf-resume-grid">
              {[1, 2].map((i) => <div key={i} className="pf-resume-card pf-shimmer" />)}
            </div>
          ) : resumesError ? (
            <div className="pf-error">{resumesError}</div>
          ) : resumes.length === 0 ? (
            <div className="pf-empty">
              <span className="pf-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </span>
              <p>No resumes saved yet.</p>
              <button className="pf-btn" onClick={() => setShowUpload(true)}>Save your first resume</button>
            </div>
          ) : (
            <div className="pf-resume-grid">
              {resumes.map((r) => (
                <article key={r.id} className="pf-resume-card">
                  <div className="pf-resume-card-top">
                    <div className="pf-resume-icon">
                      {r.source === 'pdf'
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                      }
                    </div>
                    <div className="pf-resume-meta">
                      <span className="pf-resume-label">{r.label}</span>
                      <div className="pf-resume-badges">
                        <span className={`pf-source-badge pf-source-${r.source}`}>
                          {r.source === 'pdf' ? 'PDF' : 'Text'}
                        </span>
                        <span className="pf-resume-date">
                          {new Date(r.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <button
                      className="pf-delete-btn"
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      title="Delete resume"
                    >
                      {deletingId === r.id
                        ? <span className="pf-spinner" />
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      }
                    </button>
                  </div>
                  {r.text_preview && (
                    <p className="pf-resume-preview">{r.text_preview}…</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
