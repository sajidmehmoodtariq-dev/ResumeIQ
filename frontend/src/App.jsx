import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { PROVIDER_DEFS, getBYOK } from './constants.js';
import ResumeInput from './components/app/ResumeInput.jsx';
import JobDescription from './components/app/JobDescription.jsx';
import ScoreResults from './components/app/ScoreResults.jsx';
import AIEnhancement from './components/app/AIEnhancement.jsx';
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

  const [acceptedSubs, setAcceptedSubs] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('classic');

  const [aiProvider, setAiProvider] = useState(() => {
    const keys = getBYOK();
    return PROVIDER_DEFS.find((p) => keys[p.id]?.key)?.id || null;
  });

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  function handleModeChange(newMode) {
    setMode(newMode);
    setResumeText(null);
    setResult(null);
    setError(null);
    setSelectedResumeId(null);
  }

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

  function handleJdModeChange(newJdMode) {
    if (newJdMode === 'single') {
      setError(null);
      setResult(null);
      setFeedback(null);
    } else {
      setCompareError(null);
      setCompareResult(null);
    }
    setJdMode(newJdMode);
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

    const keys = getBYOK();
    const providerCfg = aiProvider ? keys[aiProvider] : null;
    if (!providerCfg?.key) {
      setFeedbackError('No API key configured — add one in your Profile under "API Keys".');
      return;
    }

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
          provider: aiProvider,
          model: providerCfg.model,
          api_key: providerCfg.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Feedback generation failed');
      setFeedback(data);
      setAcceptedSubs(new Set());
      setGenerateError(null);
    } catch (err) {
      setFeedbackError(err.message);
    } finally {
      setFeedbackLoading(false);
    }
  }

  function toggleSub(index) {
    setAcceptedSubs((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  async function handleGeneratePDF() {
    if (!resumeText || acceptedSubs.size === 0) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const accepted = feedback.suggestions
        .filter((_, i) => acceptedSubs.has(i))
        .map((s) => ({ original_bullet: s.original_bullet, rewritten_bullet: s.rewritten_bullet }));

      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: resumeText, accepted_substitutions: accepted, template: selectedTemplate }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.detail || 'PDF generation failed');
      }

      const binary = atob(data.pdf_b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      console.log('[PDF] blob size:', blob.size);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'updated_resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  }

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

      {/* NAV */}
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

      {/* MAIN */}
      <main className="ap-main">

        {/* Step indicator */}
        <div className="ap-steps">
          {[
            { n: 1, label: 'Resume' },
            { n: 2, label: 'Job Match' },
            { n: 3, label: 'Results' },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="ap-step-group">
              <div className={`ap-step-node ${step >= n ? 'ap--done' : ''} ${step === n ? 'ap--active' : ''}`}>
                <div className="ap-step-dot">
                  {step > n
                    ? <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <span>{n}</span>}
                </div>
                <span className="ap-step-label">{label}</span>
              </div>
              {i < arr.length - 1 && <div className={`ap-step-line ${step > n ? 'ap--done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        <section className="ap-card">
          <h2 className="ap-card-title">
            <span className="ap-step-badge">01</span>
            Provide Your Resume
          </h2>
          <ResumeInput
            token={token}
            mode={mode}
            setMode={handleModeChange}
            file={file}
            setFile={setFile}
            pasteText={pasteText}
            setPasteText={setPasteText}
            resumeText={resumeText}
            loading={loading}
            error={error}
            savedResumes={savedResumes}
            savedLoading={savedLoading}
            savedError={savedError}
            selectedResumeId={selectedResumeId}
            onSubmit={handleResumeSubmit}
            onSelectResume={handleSelectResume}
            onFetchSaved={fetchSavedResumes}
          />
        </section>

        {/* Step 2 */}
        {resumeText && (
          <section className="ap-card ap-card--enter">
            <h2 className="ap-card-title">
              <span className="ap-step-badge">02</span>
              Job Description
            </h2>
            <JobDescription
              jdMode={jdMode}
              setJdMode={handleJdModeChange}
              jdText={jdText}
              setJdText={setJdText}
              compareJds={compareJds}
              setCompareJds={setCompareJds}
              compareResult={compareResult}
              loading={loading}
              compareLoading={compareLoading}
              compareError={compareError}
              onScore={handleScore}
              onCompare={handleCompareJobs}
            />
          </section>
        )}

        {error && (
          <div className="ap-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <section className="ap-card ap-card--results ap-card--enter">
            <ScoreResults result={result} />
            <AIEnhancement
              result={result}
              resumeText={resumeText}
              jdText={jdText}
              feedback={feedback}
              feedbackLoading={feedbackLoading}
              feedbackError={feedbackError}
              acceptedSubs={acceptedSubs}
              generating={generating}
              generateError={generateError}
              aiProvider={aiProvider}
              setAiProvider={setAiProvider}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              onImprove={handleImproveResume}
              onToggleSub={toggleSub}
              onGeneratePDF={handleGeneratePDF}
            />
          </section>
        )}

      </main>
    </div>
  );
}

export default App;
