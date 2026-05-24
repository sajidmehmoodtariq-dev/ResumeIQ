import { Link } from 'react-router-dom';

export default function ResumeInput({
  token,
  mode,
  setMode,
  file,
  setFile,
  pasteText,
  setPasteText,
  resumeText,
  loading,
  error,
  savedResumes,
  savedLoading,
  savedError,
  selectedResumeId,
  onSubmit,
  onSelectResume,
  onFetchSaved,
}) {
  return (
    <>
      <div className="ap-tabs">
        <button
          type="button"
          className={`ap-tab ${mode === 'upload' ? 'ap--active' : ''}`}
          onClick={() => setMode('upload')}
        >
          Upload PDF
        </button>
        <button
          type="button"
          className={`ap-tab ${mode === 'paste' ? 'ap--active' : ''}`}
          onClick={() => setMode('paste')}
        >
          Paste Text
        </button>
        <button
          type="button"
          className={`ap-tab ${mode === 'select' ? 'ap--active' : ''}`}
          onClick={() => { setMode('select'); onFetchSaved(); }}
        >
          Select from Profile
        </button>
      </div>

      {(mode === 'upload' || mode === 'paste') && (
        <form onSubmit={onSubmit}>
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
              onClick={() => onSelectResume(r.id)}
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
    </>
  );
}
