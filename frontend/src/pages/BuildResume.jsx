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
import RewritePanel from '../components/builder/RewritePanel.jsx';
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
  const [resumeJson, setResumeJson] = useState(() => {
    const draft = loadDraft();
    if (!draft) return emptyResume();
    // Migrate flat skills string[] → categorized [{category, items}]
    if (draft.skills && draft.skills.length > 0 && typeof draft.skills[0] === 'string') {
      draft.skills = [{ category: 'Skills', items: draft.skills }];
    }
    return draft;
  });
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

  // ── PDF import state ───────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
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
  function skillsTotal() {
    return (resumeJson.skills || []).reduce((s, g) => {
      if (typeof g === 'object') return s + (g.items?.length || 0);
      return s + 1;
    }, 0);
  }

  function summarySentences() {
    const s = (resumeJson.summary || '').trim();
    return s ? (s.match(/[.!?]+(\s|$)/g) || []).length : 0;
  }

  function canProceed() {
    if (currentStep === 1) { // Summary
      const n = summarySentences();
      return n === 0 || (n >= 2 && n <= 3);
    }
    if (currentStep === 4) { // Skills
      const n = skillsTotal();
      return n >= 10 && n <= 15;
    }
    if (currentStep === 5) { // Projects
      return (resumeJson.projects || []).length <= 4;
    }
    return true;
  }

  function blockMessage() {
    if (currentStep === 1) {
      const n = summarySentences();
      if (n === 1) return 'Summary is too short — write at least 2 sentences.';
      if (n > 3)   return `Trim your summary to 3 sentences (currently ${n}).`;
    }
    if (currentStep === 4) {
      const n = skillsTotal();
      if (n < 10) return `Add ${10 - n} more skill${10 - n !== 1 ? 's' : ''} to reach the minimum of 10.`;
      if (n > 15) return `Remove ${n - 15} skill${n - 15 !== 1 ? 's' : ''} — maximum is 15.`;
    }
    if (currentStep === 5 && (resumeJson.projects || []).length > 4) {
      return `Remove ${resumeJson.projects.length - 4} project${resumeJson.projects.length - 4 !== 1 ? 's' : ''} — maximum is 4.`;
    }
    return null;
  }

  function handleNext() {
    if (!canProceed()) return;
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

  // ── Import existing resume PDF ─────────────────────────────────
  async function handleParsePdf() {
    if (!importFile) return;
    const keys = getBYOK();
    const providerCfg = aiProvider ? keys[aiProvider] : null;
    if (!providerCfg?.key) {
      setImportError('Select a provider and add its API key in Profile → API Keys first.');
      return;
    }
    setImportLoading(true);
    setImportError(null);
    const form = new FormData();
    form.append('file', importFile);
    form.append('provider', aiProvider);
    form.append('model', providerCfg.model);
    form.append('api_key', providerCfg.key);
    try {
      const res = await fetch('/api/parse-resume', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.detail || 'Parsing failed');
      const base = emptyResume();
      const merged = {
        ...base,
        personal: { ...base.personal, ...(data.personal || {}) },
        summary: data.summary || '',
        experience: (data.experience || []).map((e) => ({ id: newId(), ...e })),
        education:  (data.education  || []).map((e) => ({ id: newId(), ...e })),
        skills: Array.isArray(data.skills)
          ? (data.skills.length > 0 && typeof data.skills[0] === 'object'
              ? data.skills
              : [{ category: 'Skills', items: data.skills }])
          : [],
        projects: (data.projects || []).map((e) => ({ id: newId(), ...e })),
        certifications: (data.certifications || []).map((e) => ({ id: newId(), ...e })),
      };
      setResumeJson(merged);
      setCurrentStep(0);
      setShowImport(false);
      setImportFile(null);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImportLoading(false);
    }
  }

  // ── Gemini rewrite ────────────────────────────────────────────
  const geminiCfg = getBYOK()['google'] || getBYOK()['gemini'] || null;
  const geminiKey = geminiCfg?.key || null;
  const geminiModel = geminiCfg?.model || 'gemini-2.0-flash';

  function handleRewrite(target, data) {
    if (target === 'full') {
      const base = emptyResume();
      setResumeJson({
        ...base,
        personal:       { ...base.personal,       ...(data.personal       || {}) },
        summary:        data.summary        ?? resumeJson.summary,
        experience:     (data.experience    || resumeJson.experience).map((e) => ({ id: e.id || newId(), ...e })),
        education:      (data.education     || resumeJson.education ).map((e) => ({ id: e.id || newId(), ...e })),
        skills:         data.skills         ?? resumeJson.skills,
        projects:       (data.projects      || resumeJson.projects  ).map((e) => ({ id: e.id || newId(), ...e })),
        certifications: (data.certifications|| resumeJson.certifications).map((e) => ({ id: e.id || newId(), ...e })),
        meta: resumeJson.meta,
      });
    } else if (target === 'summary' && data.summary !== undefined) {
      updateSlice('summary', data.summary);
    } else if (target === 'experience' && Array.isArray(data.experience)) {
      const incoming = data.experience;
      const existing = resumeJson.experience;
      const merged = incoming.map((e, i) => ({ id: existing[i]?.id || newId(), ...e }));
      updateSlice('experience', merged);
    } else if (target === 'skills' && Array.isArray(data.skills)) {
      updateSlice('skills', data.skills);
    } else if (target === 'projects' && Array.isArray(data.projects)) {
      const incoming = data.projects;
      const existing = resumeJson.projects;
      const merged = incoming.map((e, i) => ({ id: existing[i]?.id || newId(), ...e }));
      updateSlice('projects', merged);
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
            {/* PDF import panel */}
            {!showImport ? (
              <button type="button" className="br-import-trigger" onClick={() => setShowImport(true)}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M7.5 1v9M4 7l3.5 3.5L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1.5 11.5v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Import from existing resume PDF
              </button>
            ) : (
              <div className="br-import-panel">
                <div className="br-import-hd">
                  <span className="br-import-hd-title">Import from existing resume PDF</span>
                  <button type="button" className="br-import-close" onClick={() => { setShowImport(false); setImportFile(null); setImportError(null); }}>✕</button>
                </div>
                <p className="br-import-sub">
                  Upload your current resume and an AI model will pre-fill the form. You can edit every field before downloading.
                </p>

                <label className={`br-file-drop ${importFile ? 'br-file-drop--has-file' : ''}`}>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportError(null); }}
                  />
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="3" y="2" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 7h8M7 11h8M7 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>{importFile ? importFile.name : 'Click to choose PDF'}</span>
                  {importFile && <span className="br-file-size">{(importFile.size / 1024).toFixed(0)} KB</span>}
                </label>

                <div className="br-import-provider-row">
                  <span className="br-import-provider-label">AI provider</span>
                  <div className="br-import-chips">
                    {PROVIDER_DEFS.map((p) => {
                      const hasKey = !!getBYOK()[p.id]?.key;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`br-import-chip${aiProvider === p.id ? ' br-import-chip--active' : ''}${!hasKey ? ' br-import-chip--nokey' : ''}`}
                          onClick={() => setAiProvider(p.id)}
                          title={!hasKey ? 'No API key configured — add one in Profile' : ''}
                        >
                          {p.label}
                          {!hasKey && <span className="br-chip-nokey">no key</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {importError && <p className="br-import-error">{importError}</p>}

                <div className="br-import-actions">
                  <button type="button" className="br-btn br-btn--ghost" onClick={() => { setShowImport(false); setImportFile(null); setImportError(null); }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="br-btn br-btn--primary"
                    disabled={!importFile || importLoading || !aiProvider}
                    onClick={handleParsePdf}
                  >
                    {importLoading ? (
                      <><span className="br-spinner" />Parsing…</>
                    ) : 'Parse & Pre-fill →'}
                  </button>
                </div>
              </div>
            )}

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
                {[1, 2, 4, 5, 7].includes(currentStep) && (
                  <RewritePanel
                    target={['summary', 'experience', 'skills', 'projects', 'full'][
                      [1, 2, 4, 5, 7].indexOf(currentStep)
                    ]}
                    resumeJson={resumeJson}
                    onApply={handleRewrite}
                    geminiKey={geminiKey}
                    geminiModel={geminiModel}
                  />
                )}
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
                <StepSkills
                  data={resumeJson.skills}
                  onChange={(v) => updateSlice('skills', v)}
                  geminiKey={geminiKey}
                  geminiModel={geminiModel}
                />
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
              <>
                {blockMessage() && (
                  <div className="br-block-msg">{blockMessage()}</div>
                )}
                <div className="br-nav-btns">
                  {currentStep > 0 && (
                    <button type="button" className="br-btn br-btn--ghost" onClick={handleBack}>
                      ← Back
                    </button>
                  )}
                  <button
                    type="button"
                    className="br-btn br-btn--primary"
                    onClick={handleNext}
                    disabled={!canProceed()}
                  >
                    {currentStep === 6 ? 'Finalize →' : 'Next →'}
                  </button>
                </div>
              </>
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
