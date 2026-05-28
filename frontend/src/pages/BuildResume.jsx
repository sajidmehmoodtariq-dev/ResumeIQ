import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PROVIDER_DEFS, TEMPLATE_DEFS, getBYOK } from '../constants.js';
import {
  emptyResume, saveDraft, loadDraft, clearDraft, jsonToText, newId,
} from '../utils/resumeJson.js';

import StepPersonal from '../components/builder/StepPersonal.jsx';
import StepSummary from '../components/builder/StepSummary.jsx';
import StepExperience from '../components/builder/StepExperience.jsx';
import StepEducation from '../components/builder/StepEducation.jsx';
import StepSkills from '../components/builder/StepSkills.jsx';
import StepProjects from '../components/builder/StepProjects.jsx';
import StepCertifications from '../components/builder/StepCertifications.jsx';
import SectionOrder from '../components/builder/SectionOrder.jsx';
import JobDescription from '../components/app/JobDescription.jsx';
import ScoreResults from '../components/app/ScoreResults.jsx';
import AIEnhancement from '../components/app/AIEnhancement.jsx';
import CoverLetter from '../components/app/CoverLetter.jsx';

import '../App.css';
import './BuildResume.css';

const FORM_STEPS = [
  { id: 'personal',       label: 'Personal',    title: 'Personal Details' },
  { id: 'summary',        label: 'Summary',     title: 'Professional Summary' },
  { id: 'experience',     label: 'Experience',  title: 'Work Experience' },
  { id: 'education',      label: 'Education',   title: 'Education' },
  { id: 'skills',         label: 'Skills',      title: 'Skills' },
  { id: 'projects',       label: 'Projects',    title: 'Projects' },
  { id: 'certifications', label: 'Certs',       title: 'Certifications' },
  { id: 'order',          label: 'Finalize',    title: 'Order & Download' },
];

function downloadBlob(b64, filename) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function BuildResume() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // ── Form state ─────────────────────────────────────────────────
  const [resumeJson, setResumeJson] = useState(() => loadDraft() || emptyResume());
  const [currentStep, setCurrentStep] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);

  // ── Analysis state ─────────────────────────────────────────────
  const [analysisMode, setAnalysisMode] = useState(false);
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
  const [downloading, setDownloading] = useState(false);
  const [coverLetter, setCoverLetter] = useState(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterError, setCoverLetterError] = useState(null);
  const [coverLetterDownloading, setCoverLetterDownloading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('classic');
  const [aiProvider, setAiProvider] = useState(() => {
    const keys = getBYOK();
    return PROVIDER_DEFS.find((p) => keys[p.id]?.key)?.id || null;
  });

  // Auto-save to localStorage
  useEffect(() => {
    saveDraft(resumeJson);
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 1800);
    return () => clearTimeout(t);
  }, [resumeJson]);

  function updateSlice(key, value) {
    setResumeJson((prev) => ({ ...prev, [key]: value }));
  }

  // ── Form navigation ────────────────────────────────────────────
  function handleNext() {
    if (currentStep < FORM_STEPS.length - 1) setCurrentStep((s) => s + 1);
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  // ── Enter analysis mode ────────────────────────────────────────
  function handleFinishForm() {
    setResumeText(jsonToText(resumeJson));
    setAnalysisMode(true);
    setResult(null);
    setFeedback(null);
    setAcceptedSubs(new Set());
    setError(null);
    setCoverLetter(null);
  }

  // ── Direct PDF download (no AI) ────────────────────────────────
  async function handleDirectDownload() {
    const text = jsonToText(resumeJson);
    if (!text.trim()) { alert('Fill in some details first.'); return; }
    setDownloading(true);
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: text, accepted_substitutions: [], template: selectedTemplate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.detail || 'PDF generation failed');
      downloadBlob(data.pdf_b64, 'resume_draft.pdf');
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  }

  // ── Analysis handlers ──────────────────────────────────────────
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
      setError(null); setResult(null); setFeedback(null);
    } else {
      setCompareError(null); setCompareResult(null);
    }
    setJdMode(newJdMode);
  }

  async function handleCompareJobs(e) {
    e.preventDefault();
    setCompareError(null);
    setCompareResult(null);
    const cleaned = compareJds.map((jd) => jd.trim());
    if (cleaned.some((jd) => !jd)) { setCompareError('Paste all three job descriptions first'); return; }
    setCompareLoading(true);
    try {
      const res = await fetch('/api/compare-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          job_descriptions: cleaned.map((jd, i) => ({ label: `Role ${i + 1}`, jd_text: jd })),
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
      if (!res.ok || !data) throw new Error(data?.detail || 'PDF generation failed');
      downloadBlob(data.pdf_b64, 'enhanced_resume.pdf');
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

  async function handleGenerateCoverLetter() {
    if (!resumeText || !jdText) return;
    const keys = getBYOK();
    const providerCfg = aiProvider ? keys[aiProvider] : null;
    if (!providerCfg?.key) {
      setCoverLetterError('No API key configured — add one in your Profile under "API Keys".');
      return;
    }
    setCoverLetterLoading(true);
    setCoverLetterError(null);
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          jd_text: jdText,
          provider: aiProvider,
          model: providerCfg.model,
          api_key: providerCfg.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Cover letter generation failed');
      setCoverLetter(data.cover_letter);
    } catch (err) {
      setCoverLetterError(err.message);
    } finally {
      setCoverLetterLoading(false);
    }
  }

  async function handleDownloadCoverLetterPdf() {
    if (!coverLetter) return;
    setCoverLetterDownloading(true);
    try {
      const res = await fetch('/api/cover-letter-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_letter: coverLetter }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.detail || 'PDF generation failed');
      downloadBlob(data.pdf_b64, 'cover_letter.pdf');
    } catch (err) {
      setCoverLetterError(err.message);
    } finally {
      setCoverLetterDownloading(false);
    }
  }

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  const step = FORM_STEPS[currentStep];

  return (
    <div className="br-root">

      {/* NAV */}
      <nav className="br-nav">
        <div className="br-nav-inner">
          <Link to="/" className="br-logo">Resume<em>Matcher</em></Link>

          <div className="br-nav-links">
            <Link to="/app" className="br-nav-link">Analyzer</Link>
            <span className="br-nav-sep">·</span>
            <span className="br-nav-current">Build Resume</span>
          </div>

          <div className="br-nav-right">
            {user && (
              <Link to="/profile" className="br-nav-user">
                <div className="br-avatar">{initials}</div>
                <span className="br-nav-name">{user.first_name} {user.last_name}</span>
              </Link>
            )}
            <button className="br-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </nav>

      <main className="br-main">

        {/* ── FORM PHASE ─────────────────────────────────────────── */}
        {!analysisMode && (
          <>
            {/* Step indicator */}
            <div className="br-steps-bar">
              {FORM_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  className={`br-step-pill ${currentStep === idx ? 'br-step-pill--active' : ''} ${currentStep > idx ? 'br-step-pill--done' : ''}`}
                  onClick={() => setCurrentStep(idx)}
                >
                  <span className="br-pill-num">
                    {currentStep > idx
                      ? <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : idx + 1}
                  </span>
                  <span className="br-pill-label">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Auto-save flash */}
            <div className={`br-saved-toast ${savedFlash ? 'br-saved-toast--show' : ''}`}>
              ✓ Draft saved
            </div>

            {/* Step card */}
            <div className="br-card">
              <div className="br-card-hd">
                <h2 className="br-card-title">
                  <span className="br-step-badge">0{currentStep + 1}</span>
                  {step.title}
                </h2>
              </div>

              {currentStep === 0 && (
                <StepPersonal data={resumeJson.personal} onChange={(v) => updateSlice('personal', v)} />
              )}
              {currentStep === 1 && (
                <StepSummary data={resumeJson.summary} onChange={(v) => updateSlice('summary', v)} />
              )}
              {currentStep === 2 && (
                <StepExperience data={resumeJson.experience} onChange={(v) => updateSlice('experience', v)} />
              )}
              {currentStep === 3 && (
                <StepEducation data={resumeJson.education} onChange={(v) => updateSlice('education', v)} />
              )}
              {currentStep === 4 && (
                <StepSkills data={resumeJson.skills} onChange={(v) => updateSlice('skills', v)} />
              )}
              {currentStep === 5 && (
                <StepProjects data={resumeJson.projects} onChange={(v) => updateSlice('projects', v)} />
              )}
              {currentStep === 6 && (
                <StepCertifications data={resumeJson.certifications} onChange={(v) => updateSlice('certifications', v)} />
              )}
              {currentStep === 7 && (
                <SectionOrder
                  order={resumeJson.meta.sectionOrder}
                  onChange={(v) => setResumeJson((prev) => ({ ...prev, meta: { ...prev.meta, sectionOrder: v } }))}
                  resumeJson={resumeJson}
                  onFinish={handleFinishForm}
                  onDirectDownload={handleDirectDownload}
                  downloading={downloading}
                  selectedTemplate={selectedTemplate}
                  setSelectedTemplate={setSelectedTemplate}
                />
              )}
            </div>

            {/* Nav buttons (hidden on finalize step — SectionOrder has its own) */}
            {currentStep < 7 && (
              <div className="br-nav-btns">
                {currentStep > 0 && (
                  <button type="button" className="br-btn br-btn--ghost" onClick={handleBack}>
                    ← Back
                  </button>
                )}
                <button type="button" className="br-btn br-btn--primary" onClick={handleNext}>
                  {currentStep === 6 ? 'Finalize →' : 'Next →'}
                </button>
              </div>
            )}

            {/* Clear draft */}
            <div className="br-draft-row">
              <button
                type="button"
                className="br-clear-btn"
                onClick={() => { if (window.confirm('Start over? Your draft will be cleared.')) { clearDraft(); setResumeJson(emptyResume()); setCurrentStep(0); } }}
              >
                Clear draft &amp; start over
              </button>
            </div>
          </>
        )}

        {/* ── ANALYSIS PHASE ────────────────────────────────────── */}
        {analysisMode && (
          <>
            <div className="br-analysis-bar">
              <button type="button" className="br-btn br-btn--ghost" onClick={() => setAnalysisMode(false)}>
                ← Back to Form
              </button>
              <h2 className="br-analysis-title">Analyze Your Resume</h2>
            </div>

            <section className="ap-card ap-card--enter">
              <h2 className="ap-card-title">
                <span className="ap-step-badge">JD</span>
                Target Job Description
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

            {error && (
              <div className="ap-error">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
                </svg>
                {error}
              </div>
            )}

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

            {result && (
              <section className="ap-card ap-card--enter">
                <h2 className="ap-card-title">
                  <span className="ap-step-badge">CL</span>
                  Cover Letter
                </h2>
                <CoverLetter
                  resumeText={resumeText}
                  jdText={jdText}
                  coverLetter={coverLetter}
                  setCoverLetter={setCoverLetter}
                  loading={coverLetterLoading}
                  error={coverLetterError}
                  aiProvider={aiProvider}
                  setAiProvider={setAiProvider}
                  onGenerate={handleGenerateCoverLetter}
                  onDownloadPdf={handleDownloadCoverLetterPdf}
                  downloading={coverLetterDownloading}
                />
              </section>
            )}

          </>
        )}

      </main>
    </div>
  );
}
