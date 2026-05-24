import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import './App.css';

function App() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [health, setHealth] = useState(null);

  const [savedResumes, setSavedResumes] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState(null);
  const [selectedResumeId, setSelectedResumeId] = useState(null);

  const [mode, setMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [resumeText, setResumeText] = useState(null);

  const [jdMode, setJdMode] = useState('single');
  const [jdText, setJdText] = useState('');
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [compareJds, setCompareJds] = useState(['', '', '']);
  const [compareResult, setCompareResult] = useState(null);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  async function handleResumeSubmit(e) {
    e.preventDefault();
    setError(null);
    setResumeText(null);
    setResult(null);
    setFeedback(null);
    setFeedbackError(null);
    setLoading(true);

    const body = new FormData();
    if (mode === 'upload') {
      if (!file) { setError('Select a PDF first'); setLoading(false); return; }
      body.append('file', file);
    } else {
      if (!pasteText.trim()) { setError('Paste some text first'); setLoading(false); return; }
      body.append('text', pasteText);
    }
    try {
      const res = await fetch('/api/resume/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setResumeText(data.text);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleScore(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setFeedback(null);
    setFeedbackError(null);
    if (!jdText.trim()) { setError('Paste a job description first'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: resumeText, jd_text: jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Scoring failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompareJobs(e) {
    e.preventDefault();
    setCompareError(null);
    setCompareResult(null);
    const cleanedJds = compareJds.map((jd) => jd.trim());
    if (cleanedJds.some((jd) => !jd)) { setCompareError('Paste all three job descriptions first'); return; }
    if (!resumeText) { setCompareError('Process your resume first'); return; }
    setCompareLoading(true);
    try {
      const res = await fetch('/api/compare-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          job_descriptions: cleanedJds.map((jd, index) => ({ label: `Role ${index + 1}`, jd_text: jd })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Comparison failed');
      setCompareResult(data);
    } catch (err) {
      setCompareError(err.message);
    } finally {
      setCompareLoading(false);
    }
  }

  async function handleImproveResume() {
    if (!resumeText || !result) return;
    setFeedbackError(null);
    setFeedback(null);
    setFeedbackLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          jd_text: jdText,
          skill_gap: {
            resume_skills: result.resume_skills,
            matched_skills: result.matched_skills,
            missing_skills: result.missing_skills,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Feedback generation failed');
      setFeedback(data);
    } catch (err) {
      setFeedbackError(err.message);
    } finally {
      setFeedbackLoading(false);
    }
  }

  const fmt = (v) => (v == null ? 'n/a' : `${v}%`);

  function handleLogout() {
    logout();
    navigate('/');
  }

  async function fetchSavedResumes() {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch('/api/profile/resumes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load saved resumes');
      setSavedResumes(data);
    } catch (err) {
      setSavedError(err.message);
    } finally {
      setSavedLoading(false);
    }
  }

  async function handleSelectResume(id) {
    setSelectedResumeId(id);
    setResumeText(null);
    setResult(null);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch(`/api/profile/resumes/${id}/text`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load resume');
      setResumeText(data.text);
    } catch (err) {
      setError(err.message);
      setSelectedResumeId(null);
    }
  }

  const step = result ? 3 : resumeText ? 2 : 1;
  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  return (
    <div className="ap-root">

      {/* ── NAV ── */}
      <nav className="ap-nav">
        <div className="ap-nav-inner">
          <Link to="/" className="ap-logo">Resume<em>Matcher</em></Link>

          <div className="ap-nav-right">
            <span
              className={`ap-health-dot ${health?.status === 'ok' ? 'ap-health-ok' : 'ap-health-err'}`}
              title={`Backend ${health?.status ?? 'checking…'}`}
            />
            {user && (
              <Link to="/profile" className="ap-user ap-user-link">
                <div className="ap-avatar">{initials}</div>
                <span className="ap-username">{user.first_name} {user.last_name}</span>
              </Link>
            )}

            <button className="ap-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main className="ap-main">

        {/* Step progress */}
        <div className="ap-steps">
          {[
            { n: 1, label: 'Resume' },
            { n: 2, label: 'Job Match' },
            { n: 3, label: 'Results' },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="ap-step-group">
              <div className={`ap-step-node ${step >= n ? 'ap--done' : ''} ${step === n ? 'ap--active' : ''}`}>
                <div className="ap-step-dot">
                  {step > n ? <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg> : <span>{n}</span>}
                </div>
                <span className="ap-step-label">{label}</span>
              </div>
              {i < arr.length - 1 && <div className={`ap-step-line ${step > n ? 'ap--done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Resume ── */}
        <section className="ap-card">
          <h2 className="ap-card-title">
            <span className="ap-step-badge">01</span>
            Provide Your Resume
          </h2>

          <div className="ap-tabs">
            <button
              type="button"
              className={`ap-tab ${mode === 'upload' ? 'ap--active' : ''}`}
              onClick={() => { setMode('upload'); setResumeText(null); setResult(null); setError(null); setSelectedResumeId(null); }}
            >
              Upload PDF
            </button>
            <button
              type="button"
              className={`ap-tab ${mode === 'paste' ? 'ap--active' : ''}`}
              onClick={() => { setMode('paste'); setResumeText(null); setResult(null); setError(null); setSelectedResumeId(null); }}
            >
              Paste Text
            </button>
            <button
              type="button"
              className={`ap-tab ${mode === 'select' ? 'ap--active' : ''}`}
              onClick={() => { setMode('select'); setResumeText(null); setResult(null); setError(null); setSelectedResumeId(null); fetchSavedResumes(); }}
            >
              Select from Profile
            </button>
          </div>

          {(mode === 'upload' || mode === 'paste') && (
            <form onSubmit={handleResumeSubmit}>
              {mode === 'upload' ? (
                <div className="ap-dropzone">
                  <input
                    className="ap-file-input"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files[0] ?? null)}
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="ap-dropzone-label">
                    <span className="ap-dropzone-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <line x1="9" y1="15" x2="15" y2="15"/>
                      </svg>
                    </span>
                    <span className="ap-dropzone-main">
                      {file ? file.name : 'Drop PDF here or click to browse'}
                    </span>
                    <span className="ap-dropzone-hint">PDF files only · max 10 MB</span>
                  </label>
                </div>
              ) : (
                <textarea
                  className="ap-textarea"
                  placeholder="Paste your resume text here…"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              )}
              <button type="submit" className="ap-btn" disabled={loading}>
                {loading && !resumeText
                  ? <><span className="ap-spinner" /> Extracting…</>
                  : 'Process Resume →'}
              </button>
            </form>
          )}

          {mode === 'select' && (
            <div className="ap-saved-list">
              {savedLoading && (
                <div className="ap-saved-loading">
                  <span className="ap-spinner ap-spinner--dark" /> Loading saved resumes…
                </div>
              )}
              {savedError && (
                <div className="ap-error">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>
                  {savedError}
                </div>
              )}
              {!savedLoading && !savedError && savedResumes.length === 0 && (
                <div className="ap-saved-empty">
                  No resumes saved yet.{' '}
                  <Link to="/profile" className="ap-saved-link">Go to Profile →</Link>
                </div>
              )}
              {!savedLoading && savedResumes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`ap-saved-card ${selectedResumeId === r.id ? 'ap-saved-card--active' : ''}`}
                  onClick={() => handleSelectResume(r.id)}
                  disabled={loading}
                >
                  <div className="ap-saved-card-left">
                    <span className={`ap-saved-source ap-saved-source--${r.source}`}>
                      {r.source === 'pdf' ? 'PDF' : 'Text'}
                    </span>
                    <div className="ap-saved-card-info">
                      <span className="ap-saved-name">{r.label}</span>
                      <span className="ap-saved-date">
                        {new Date(r.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  {selectedResumeId === r.id && loading
                    ? <span className="ap-spinner ap-spinner--dark" />
                    : selectedResumeId === r.id && resumeText
                      ? <span className="ap-saved-check">✓ Selected</span>
                      : <span className="ap-saved-use">Use this →</span>
                  }
                </button>
              ))}
            </div>
          )}

          {resumeText && (
            <div className="ap-preview">
              <div className="ap-preview-hd">
                <span className="ap-preview-tag">Extracted Text</span>
                <span className="ap-preview-ok">✓ Ready</span>
              </div>
              <pre className="ap-preview-body">{resumeText}</pre>
            </div>
          )}
        </section>

        {/* ── STEP 2: JD (single or compare) ── */}
        {resumeText && (
          <section className="ap-card ap-card--enter">
            <h2 className="ap-card-title">
              <span className="ap-step-badge">02</span>
              Job Description
            </h2>

            <div className="ap-tabs">
              <button
                type="button"
                className={`ap-tab ${jdMode === 'single' ? 'ap--active' : ''}`}
                onClick={() => { setJdMode('single'); setError(null); setResult(null); setFeedback(null); }}
              >
                Analyze Single JD
              </button>
              <button
                type="button"
                className={`ap-tab ${jdMode === 'compare' ? 'ap--active' : ''}`}
                onClick={() => { setJdMode('compare'); setCompareError(null); setCompareResult(null); }}
              >
                Compare 3 JDs
              </button>
            </div>

            {jdMode === 'single' && (
              <form onSubmit={handleScore}>
                <textarea
                  className="ap-textarea"
                  placeholder="Paste the job description here to compare…"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
                <button type="submit" className="ap-btn" disabled={loading}>
                  {loading && resumeText && !result
                    ? <><span className="ap-spinner" /> Analyzing…</>
                    : 'Analyze Match →'}
                </button>
              </form>
            )}

            {jdMode === 'compare' && (
              <>
                <p className="ap-card-sub" style={{ marginBottom: '1rem' }}>
                  Rank up to 3 roles and find your strongest fit.
                </p>
                <div className="ap-compare-grid">
                  {compareJds.map((jd, i) => (
                    <div className="ap-compare-col" key={i}>
                      <label className="ap-compare-label" htmlFor={`cjd-${i}`}>Role {i + 1}</label>
                      <textarea
                        id={`cjd-${i}`}
                        className="ap-textarea ap-textarea--sm"
                        placeholder={`Paste job description ${i + 1}…`}
                        value={jd}
                        onChange={(e) => {
                          const next = [...compareJds];
                          next[i] = e.target.value;
                          setCompareJds(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="ap-btn"
                  onClick={handleCompareJobs}
                  disabled={loading || compareLoading}
                >
                  {compareLoading ? <><span className="ap-spinner" /> Ranking…</> : 'Compare 3 JDs →'}
                </button>

                {compareError && (
                  <div className="ap-error" style={{ marginTop: '1rem' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>
                    {compareError}
                  </div>
                )}

                {compareResult?.ranked_jobs?.length > 0 && (
                  <div className="ap-compare-results">
                    <div className="ap-winner">
                      <span className="ap-winner-eyebrow">Best Match</span>
                      <strong className="ap-winner-name">{compareResult.best_match?.label}</strong>
                      <span className="ap-winner-score">{compareResult.best_match?.score}%</span>
                    </div>
                    <div className="ap-rank-list">
                      {compareResult.ranked_jobs.map((job) => (
                        <article key={`${job.label}-${job.rank}`} className={`ap-rank-card ${job.rank === 1 ? 'ap-rank-card--top' : ''}`}>
                          <div className="ap-rank-top">
                            <div className="ap-rank-meta">
                              <span className="ap-rank-badge">#{job.rank}</span>
                              <h4 className="ap-rank-name">{job.label}</h4>
                            </div>
                            <span className="ap-rank-score">{job.score}%</span>
                          </div>
                          <div className="ap-rank-track">
                            <div className="ap-rank-fill" style={{ width: `${job.score}%` }} />
                          </div>
                          <div className="ap-rank-metrics">
                            <span>Semantic {fmt(job.semantic_score)}</span>
                            <span>Coverage {fmt(job.skill_coverage)}</span>
                          </div>
                          <div className="ap-rank-skills">
                            <div>
                              <strong>Matched</strong>
                              <p>{job.matched_skills?.length ? job.matched_skills.join(', ') : 'None'}</p>
                            </div>
                            <div>
                              <strong>Missing</strong>
                              <p>{job.missing_skills?.length ? job.missing_skills.join(', ') : 'None'}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {error && (
          <div className="ap-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>
            {error}
          </div>
        )}

        {/* ── RESULTS ── */}
        {result && (
          <section className="ap-card ap-card--results ap-card--enter">

            {/* Score ring + metrics */}
            <div className="ap-results-top">
              <div className="ap-ring-wrap">
                <div
                  className="ap-ring"
                  style={{
                    background: `conic-gradient(from -90deg, #b8ff3d ${result.score / 100 * 360}deg, #181c28 0deg)`,
                  }}
                >
                  <div className="ap-ring-face">
                    <span className="ap-ring-num">{result.score}</span>
                    <span className="ap-ring-pct">%</span>
                    <span className="ap-ring-lbl">match score</span>
                  </div>
                </div>
              </div>

              <div className="ap-metrics">
                {[
                  { label: 'Semantic Similarity', val: result.semantic_score, weight: '60% weight', cls: 'ap-fill--lime' },
                  { label: 'Skill Coverage',       val: result.skill_coverage, weight: '40% weight', cls: 'ap-fill--indigo' },
                  { label: 'Skills Section',        val: result.section_scores?.skills,     weight: 'info', cls: 'ap-fill--orange' },
                  { label: 'Experience Section',    val: result.section_scores?.experience,  weight: 'info', cls: 'ap-fill--orange' },
                ].map(({ label, val, weight, cls }) => (
                  <div key={label} className="ap-metric">
                    <div className="ap-metric-hd">
                      <span className="ap-metric-label">{label}</span>
                      <span className="ap-metric-val">{fmt(val)}</span>
                    </div>
                    <div className="ap-metric-track">
                      <div className={`ap-metric-fill ${cls}`} style={{ width: `${val ?? 0}%` }} />
                    </div>
                    <span className="ap-metric-weight">{weight}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="ap-skills-cols">
              <div className="ap-skills-block">
                <h3 className="ap-skills-title ap-skills-title--match">
                  Matched Skills
                  <span className="ap-skills-count ap-skills-count--match">{result.matched_skills.length}</span>
                </h3>
                {result.matched_skills.length === 0
                  ? <p className="ap-empty">No direct skill matches found.</p>
                  : (
                    <div className="ap-pills">
                      {result.matched_skills.map((s) => (
                        <span key={s} className="ap-pill ap-pill--match">{s}</span>
                      ))}
                    </div>
                  )}
              </div>

              <div className="ap-skills-block">
                <h3 className="ap-skills-title ap-skills-title--miss">
                  Missing Skills
                  <span className="ap-skills-count ap-skills-count--miss">{result.missing_skills.length}</span>
                </h3>
                {result.missing_skills.length === 0
                  ? <p className="ap-empty">No missing skills — excellent coverage.</p>
                  : (
                    <div className="ap-pills">
                      {result.missing_skills.map((s) => (
                        <span key={s} className="ap-pill ap-pill--miss">{s}</span>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* AI Enhancement */}
            <div className="ap-enhance">
              <div className="ap-enhance-hd">
                <div>
                  <h3 className="ap-enhance-title">AI Resume Enhancement</h3>
                  <p className="ap-enhance-sub">Rewrite experience bullets to better align with this JD using Gemini.</p>
                </div>
                <button
                  type="button"
                  className="ap-btn ap-btn--glow"
                  onClick={handleImproveResume}
                  disabled={loading || feedbackLoading}
                >
                  {feedbackLoading
                    ? <><span className="ap-spinner" /> Generating…</>
                    : 'Enhance Resume ✦'}
                </button>
              </div>

              {feedbackError && (
                <div className="ap-error">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>
                  {feedbackError}
                </div>
              )}

              {feedback?.suggestions?.length > 0 && (
                <div className="ap-suggestions">
                  {feedback.suggestions.map((item, index) => (
                    <article key={`${item.original_bullet}-${index}`} className="ap-sug">
                      <div className="ap-sug-pair">
                        <div className="ap-sug-col ap-sug-col--before">
                          <span className="ap-sug-label">Before</span>
                          <p className="ap-sug-text">{item.original_bullet}</p>
                        </div>
                        <div className="ap-sug-arrow" aria-hidden="true">→</div>
                        <div className="ap-sug-col ap-sug-col--after">
                          <span className="ap-sug-label">After</span>
                          <p className="ap-sug-text">{item.rewritten_bullet}</p>
                        </div>
                      </div>
                      <div className="ap-sug-reasons">
                        {item.target_skill && (
                          <div className="ap-reason-row">
                            <span className="ap-reason-tag ap-reason-tag--skill">Skill</span>
                            <span className="ap-reason-txt">{item.target_skill}</span>
                          </div>
                        )}
                        <div className="ap-reason-row">
                          <span className="ap-reason-tag ap-reason-tag--align">Alignment</span>
                          <span className="ap-reason-txt">{item.jd_alignment}</span>
                        </div>
                        <div className="ap-reason-row">
                          <span className="ap-reason-tag ap-reason-tag--why">Why</span>
                          <span className="ap-reason-txt">{item.reason}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {feedback && feedback.suggestions?.length === 0 && (
                <p className="ap-empty" style={{ marginTop: '1rem' }}>
                  No rewrite suggestions generated from the available evidence.
                </p>
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

export default App;
