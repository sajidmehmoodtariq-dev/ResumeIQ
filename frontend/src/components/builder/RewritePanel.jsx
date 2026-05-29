import { useState } from 'react';

const PLACEHOLDERS = {
  summary:    'e.g. Make it more concise and impactful for a senior engineering role',
  experience: 'e.g. Quantify achievements, use stronger action verbs, highlight leadership',
  skills:     'e.g. Add more cloud and DevOps skills relevant to a backend engineer',
  projects:   'e.g. Emphasise technical depth and measurable outcomes',
  full:       'e.g. Rewrite for a product manager role, focusing on cross-functional leadership',
};

export default function RewritePanel({ target, resumeJson, onApply, geminiKey, geminiModel }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState(false);

  async function handleApply() {
    if (!instruction.trim()) return;
    if (!geminiKey) {
      setError('No Gemini API key found. Add it in Profile → API Keys.');
      return;
    }

    // Build current section data to send
    const sectionMap = {
      summary:    { summary: resumeJson.summary },
      experience: { experience: resumeJson.experience },
      skills:     { skills: resumeJson.skills },
      projects:   { projects: resumeJson.projects },
      full:       resumeJson,
    };
    const currentData = sectionMap[target] ?? {};

    // Serialize full resume as plain text for context
    const fullContext = buildContext(resumeJson);

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rewrite-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          current_data: currentData,
          full_context: fullContext,
          instruction: instruction.trim(),
          api_key: geminiKey,
          model: geminiModel || 'gemini-2.0-flash',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.detail || 'Rewrite failed');
      onApply(target, data);
      setApplied(true);
      setOpen(false);
      setInstruction('');
      setTimeout(() => setApplied(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rw-wrap">
      {!open ? (
        <button
          type="button"
          className={`rw-trigger${applied ? ' rw-trigger--applied' : ''}`}
          onClick={() => { setOpen(true); setApplied(false); }}
        >
          {applied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <polyline points="2,6.5 5,9.5 11,3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Applied
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1L7.9 4.6L11.5 5L8.9 7.5L9.6 11.1L6.5 9.3L3.4 11.1L4.1 7.5L1.5 5L5.1 4.6L6.5 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              Rewrite with Gemini
            </>
          )}
        </button>
      ) : (
        <div className="rw-panel">
          <div className="rw-panel-hd">
            <span className="rw-panel-title">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1L7.9 4.6L11.5 5L8.9 7.5L9.6 11.1L6.5 9.3L3.4 11.1L4.1 7.5L1.5 5L5.1 4.6L6.5 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              Rewrite with Gemini
            </span>
            <button type="button" className="rw-close" onClick={() => { setOpen(false); setError(null); }}>✕</button>
          </div>

          <textarea
            className="rw-textarea"
            rows={3}
            placeholder={PLACEHOLDERS[target] || 'Describe how to rewrite this section…'}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleApply(); }}
          />

          {error && <p className="rw-error">{error}</p>}

          <div className="rw-actions">
            <span className="rw-hint">⌘↵ to apply</span>
            <button type="button" className="br-btn br-btn--ghost rw-cancel" onClick={() => { setOpen(false); setError(null); }}>
              Cancel
            </button>
            <button
              type="button"
              className="br-btn br-btn--primary rw-apply"
              disabled={!instruction.trim() || loading}
              onClick={handleApply}
            >
              {loading ? <><span className="br-spinner" />Rewriting…</> : 'Apply →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildContext(resume) {
  const lines = [];
  const p = resume.personal || {};
  if (p.name) lines.push(p.name);
  const contact = [p.email, p.phone, p.location].filter(Boolean);
  if (contact.length) lines.push(contact.join(' | '));
  if (resume.summary?.trim()) { lines.push(''); lines.push('SUMMARY'); lines.push(resume.summary); }
  if (resume.experience?.length) {
    lines.push(''); lines.push('EXPERIENCE');
    for (const e of resume.experience) {
      lines.push(`${e.role || ''} at ${e.company || ''}`);
      for (const b of e.bullets || []) lines.push(`• ${b}`);
    }
  }
  if (resume.skills?.length) {
    lines.push(''); lines.push('SKILLS');
    if (typeof resume.skills[0] === 'object') {
      for (const grp of resume.skills) {
        if (grp.category) lines.push(grp.category);
        for (const s of grp.items || []) lines.push(`• ${s}`);
      }
    } else {
      lines.push(resume.skills.join(', '));
    }
  }
  if (resume.projects?.length) {
    lines.push(''); lines.push('PROJECTS');
    for (const pr of resume.projects) {
      lines.push(pr.name || '');
      for (const b of pr.bullets || []) lines.push(`• ${b}`);
    }
  }
  return lines.join('\n').trim();
}
