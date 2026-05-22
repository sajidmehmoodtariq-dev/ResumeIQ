import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [health, setHealth] = useState(null);

  const [mode, setMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [resumeText, setResumeText] = useState(null);

  const [jdText, setJdText] = useState('');
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

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
      if (!file) {
        setError('Select a PDF first');
        setLoading(false);
        return;
      }
      body.append('file', file);
    } else {
      if (!pasteText.trim()) {
        setError('Paste some text first');
        setLoading(false);
        return;
      }
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

    if (!jdText.trim()) {
      setError('Paste a job description first');
      return;
    }
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

  return (
    <div className="layout-container">
      <header className="app-header">
        <h1 className="app-title">Resume Matcher</h1>
        <span className={`status-badge ${health?.status === 'ok' ? 'ok' : 'error'}`}>
          Backend {health ? 'Online' : 'Offline'}
        </span>
      </header>

      <main>
        {/* ── Step 1 ── */}
        <section className="card">
          <h2 className="card-title">
            <span className="step-indicator">1</span>
            Provide Your Resume
          </h2>
          
          <div className="tabs">
            <button
              type="button"
              className={`tab-btn ${mode === 'upload' ? 'active' : ''}`}
              onClick={() => {
                setMode('upload');
                setResumeText(null);
                setResult(null);
                setError(null);
              }}
            >
              Upload PDF
            </button>
            <button
              type="button"
              className={`tab-btn ${mode === 'paste' ? 'active' : ''}`}
              onClick={() => {
                setMode('paste');
                setResumeText(null);
                setResult(null);
                setError(null);
              }}
            >
              Paste Text
            </button>
          </div>

          <form onSubmit={handleResumeSubmit}>
            {mode === 'upload' ? (
              <div className="file-input-wrapper">
                <input
                  className="file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files[0] ?? null)}
                />
              </div>
            ) : (
              <textarea
                className="text-area"
                placeholder="Paste your resume text here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
            )}
            
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading && !resumeText ? 'Extracting Text...' : 'Process Resume'}
            </button>
          </form>

          {resumeText && (
            <div className="extracted-text-preview">
              {resumeText}
            </div>
          )}
        </section>

        {/* ── Step 2 ── */}
        {resumeText && (
          <section className="card">
            <h2 className="card-title">
              <span className="step-indicator">2</span>
              Target Job Description
            </h2>
            <form onSubmit={handleScore}>
              <textarea
                className="text-area"
                placeholder="Paste the job description here to compare..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading && resumeText && !result ? 'Calculating Match...' : 'Analyze Match'}
              </button>
            </form>
          </section>
        )}

        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* ── Results ── */}
        {result && (
          <section className="card">
            <div className="results-header">
              <div className="composite-score">
                <span className="score-value">{result.score}%</span>
                <span className="score-label">Overall Match Score</span>
              </div>

              <table className="score-details-table">
                <tbody>
                  <tr>
                    <td className="label">Semantic Similarity</td>
                    <td className="value">{fmt(result.semantic_score)}</td>
                    <td className="weight">60% wgt</td>
                  </tr>
                  <tr>
                    <td className="label">Skill Coverage</td>
                    <td className="value">{fmt(result.skill_coverage)}</td>
                    <td className="weight">40% wgt</td>
                  </tr>
                  <tr>
                    <td className="label">Skills Section Match</td>
                    <td className="value">{fmt(result.section_scores?.skills)}</td>
                    <td className="weight">Info</td>
                  </tr>
                  <tr>
                    <td className="label">Experience Section Match</td>
                    <td className="value">{fmt(result.section_scores?.experience)}</td>
                    <td className="weight">Info</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="skills-grid">
              <div className="skills-list-block matched">
                <h3>
                  Matched Skills
                  <span className="badge-count">{result.matched_skills.length}</span>
                </h3>
                {result.matched_skills.length === 0 ? (
                  <p className="empty-state">No direct skill matches found.</p>
                ) : (
                  <ul className="skills-list">
                    {result.matched_skills.map((s) => (
                      <li key={s} className="skill-tag">{s}</li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="skills-list-block missing">
                <h3>
                  Missing Skills
                  <span className="badge-count">{result.missing_skills.length}</span>
                </h3>
                {result.missing_skills.length === 0 ? (
                  <p className="empty-state">Excellent! No missing skills spotted.</p>
                ) : (
                  <ul className="skills-list">
                    {result.missing_skills.map((s) => (
                      <li key={s} className="skill-tag">{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── Feedback ── */}
            <div className="feedback-section">
              <div className="feedback-section-header">
                <div className="feedback-title-group">
                  <h3>AI Resume Enhancement</h3>
                  <p>Optimize your experience bullet points using Gemini to better align with the job description.</p>
                </div>
                <button
                  type="button"
                  className="feedback-button"
                  onClick={handleImproveResume}
                  disabled={loading || feedbackLoading}
                >
                  {feedbackLoading ? 'Generating ✨' : 'Enhance Resume'}
                </button>
              </div>

              {feedbackError && <div className="error-msg">⚠️ {feedbackError}</div>}

              {feedback?.suggestions?.length > 0 && (
                <div className="suggestions-grid">
                  {feedback.suggestions.map((item, index) => (
                    <article key={`${item.original_bullet}-${index}`} className="suggestion-card">
                      <div className="suggestion-comparison">
                        <div className="suggestion-col">
                          <span className="suggestion-label">Current Bullet</span>
                          <p className="suggestion-original">{item.original_bullet}</p>
                        </div>
                        <div className="suggestion-col">
                          <span className="suggestion-label">Suggested Update</span>
                          <p className="suggestion-rewrite">{item.rewritten_bullet}</p>
                        </div>
                      </div>
                      <div className="suggestion-reasoning">
                        {item.target_skill && (
                          <div className="reason-row">
                            <span className="reason-tag" style={{ background: '#f5f3ff', color: '#4f46e5' }}>Skill Targeted</span>
                            <p className="reason-text"><strong>{item.target_skill}</strong></p>
                          </div>
                        )}
                        <div className="reason-row">
                          <span className="reason-tag">Alignment</span>
                          <p className="reason-text">{item.jd_alignment}</p>
                        </div>
                        <div className="reason-row">
                          <span className="reason-tag">Why</span>
                          <p className="reason-text">{item.reason}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {feedback && feedback.suggestions?.length === 0 && (
                <p className="empty-state" style={{ marginTop: '1rem' }}>
                  No solid rewrite suggestions were generated from the available evidence.
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
