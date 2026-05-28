import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PROVIDER_DEFS, getBYOK } from '../../constants.js';

export default function CoverLetter({
  resumeText,
  jdText,
  coverLetter,
  setCoverLetter,
  loading,
  error,
  aiProvider,
  setAiProvider,
  onGenerate,
  onDownloadPdf,
  downloading,
}) {
  const [copied, setCopied] = useState(false);
  const keys = getBYOK();
  const configured = PROVIDER_DEFS.filter((p) => keys[p.id]?.key);

  const wordCount = coverLetter
    ? coverLetter.trim().split(/\s+/).filter(Boolean).length
    : 0;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function handleDownloadTxt() {
    const blob = new Blob([coverLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cover_letter.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div className="ap-cl">
      <div className="ap-cl-hd">
        <h3 className="ap-cl-title">Cover Letter Generator</h3>
        <p className="ap-cl-sub">
          AI-crafted cover letter tailored to this specific job description.
          Edit freely after generation.
        </p>
      </div>

      {configured.length === 0 ? (
        <div className="ap-byok-empty">
          <span>No API key configured.</span>
          <Link to="/profile" className="ap-byok-link">Add one in Profile →</Link>
        </div>
      ) : (
        <div className="ap-byok-row">
          <div className="ap-byok-chips">
            {configured.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`ap-byok-chip ${aiProvider === p.id ? 'ap-byok-chip--active' : ''}`}
                onClick={() => setAiProvider(p.id)}
              >
                {p.name}
                {aiProvider === p.id && keys[p.id]?.model && (
                  <span className="ap-byok-model">{keys[p.id].model}</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ap-btn ap-btn--glow"
            onClick={onGenerate}
            disabled={!aiProvider || loading}
          >
            {loading
              ? <><span className="ap-spinner" /> Generating…</>
              : coverLetter ? 'Regenerate ✦' : 'Generate Cover Letter ✦'}
          </button>
        </div>
      )}

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

      {coverLetter && (
        <div className="ap-cl-body">
          <textarea
            className="ap-cl-editor"
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={20}
            spellCheck
          />
          <div className="ap-cl-footer">
            <span className="ap-cl-wordcount">{wordCount} words</span>
            <div className="ap-cl-actions">
              <button
                type="button"
                className="ap-btn ap-btn--ghost"
                onClick={handleCopy}
              >
                {copied ? '✓ Copied!' : 'Copy text'}
              </button>
              <button
                type="button"
                className="ap-btn ap-btn--ghost"
                onClick={handleDownloadTxt}
              >
                Download .txt
              </button>
              <button
                type="button"
                className="ap-btn ap-btn--glow"
                onClick={onDownloadPdf}
                disabled={downloading}
              >
                {downloading
                  ? <><span className="ap-spinner" /> Building PDF…</>
                  : '↓ Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
