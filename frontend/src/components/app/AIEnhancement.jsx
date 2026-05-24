import { Link } from 'react-router-dom';
import { PROVIDER_DEFS, TEMPLATE_DEFS, getBYOK } from '../../constants.js';

export default function AIEnhancement({
  result,
  resumeText,
  jdText,
  feedback,
  feedbackLoading,
  feedbackError,
  acceptedSubs,
  generating,
  generateError,
  aiProvider,
  setAiProvider,
  selectedTemplate,
  setSelectedTemplate,
  onImprove,
  onToggleSub,
  onGeneratePDF,
}) {
  const keys = getBYOK();
  const configured = PROVIDER_DEFS.filter((p) => keys[p.id]?.key);

  return (
    <div className="ap-enhance">
      <div className="ap-enhance-hd">
        <div>
          <h3 className="ap-enhance-title">AI Resume Enhancement</h3>
          <p className="ap-enhance-sub">Rewrite experience bullets to better align with this JD.</p>
        </div>
      </div>

      {/* Provider picker */}
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
            onClick={onImprove}
            disabled={!aiProvider || feedbackLoading}
          >
            {feedbackLoading
              ? <><span className="ap-spinner" /> Generating…</>
              : 'Enhance Resume ✦'}
          </button>
        </div>
      )}

      {feedbackError && (
        <div className="ap-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>
          {feedbackError}
        </div>
      )}

      {feedback?.suggestions?.length > 0 && (
        <>
          <div className="ap-suggestions">
            {feedback.suggestions.map((item, index) => {
              const checked = acceptedSubs.has(index);
              return (
                <article
                  key={`${item.original_bullet}-${index}`}
                  className={`ap-sug ${checked ? 'ap-sug--checked' : ''}`}
                  onClick={() => onToggleSub(index)}
                >
                  <div className="ap-sug-check">
                    <span className={`ap-checkbox ${checked ? 'ap-checkbox--on' : ''}`}>
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <polyline points="1.5,5 4,7.5 8.5,2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                  </div>
                  <div className="ap-sug-body">
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
                  </div>
                </article>
              );
            })}
          </div>

          {/* Template selector */}
          <div className="ap-tmpl-section">
            <p className="ap-tmpl-heading">Choose a template</p>
            <div className="ap-tmpl-grid">
              {TEMPLATE_DEFS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ap-tmpl-card ${selectedTemplate === t.id ? 'ap-tmpl-card--active' : ''}`}
                  onClick={() => setSelectedTemplate(t.id)}
                >
                  <div className={`ap-tmpl-preview ap-tmpl-preview--${t.id}`}>
                    {t.id === 'classic' && (
                      <>
                        <div className="ap-tp-name" />
                        <div className="ap-tp-contact" />
                        <div className="ap-tp-divider" />
                        <div className="ap-tp-line" /><div className="ap-tp-line ap-tp-line--short" />
                        <div className="ap-tp-line" /><div className="ap-tp-line ap-tp-line--short" />
                        <div className="ap-tp-divider" />
                        <div className="ap-tp-line" /><div className="ap-tp-line" /><div className="ap-tp-line ap-tp-line--short" />
                      </>
                    )}
                    {t.id === 'modern' && (
                      <>
                        <div className="ap-tp-header-band">
                          <div className="ap-tp-name ap-tp-name--white" />
                          <div className="ap-tp-contact ap-tp-contact--light" />
                        </div>
                        <div className="ap-tp-body">
                          <div className="ap-tp-divider ap-tp-divider--accent" />
                          <div className="ap-tp-line" /><div className="ap-tp-line ap-tp-line--short" />
                          <div className="ap-tp-divider ap-tp-divider--accent" />
                          <div className="ap-tp-line" /><div className="ap-tp-line" /><div className="ap-tp-line ap-tp-line--short" />
                        </div>
                      </>
                    )}
                    {t.id === 'creative' && (
                      <div className="ap-tp-two-col">
                        <div className="ap-tp-sidebar">
                          <div className="ap-tp-name ap-tp-name--white" />
                          <div className="ap-tp-contact ap-tp-contact--light" />
                          <div className="ap-tp-contact ap-tp-contact--light" />
                          <div className="ap-tp-divider ap-tp-divider--light" style={{ marginTop: '4px' }} />
                          <div className="ap-tp-line ap-tp-line--light" />
                          <div className="ap-tp-line ap-tp-line--light ap-tp-line--short" />
                        </div>
                        <div className="ap-tp-main">
                          <div className="ap-tp-divider" />
                          <div className="ap-tp-line" /><div className="ap-tp-line ap-tp-line--short" />
                          <div className="ap-tp-divider" />
                          <div className="ap-tp-line" /><div className="ap-tp-line" /><div className="ap-tp-line ap-tp-line--short" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ap-tmpl-info">
                    <div className="ap-tmpl-info-top">
                      <span className="ap-tmpl-name">{t.name}</span>
                      <span className={`ap-tmpl-badge ${t.ats ? 'ap-tmpl-badge--safe' : 'ap-tmpl-badge--design'}`}>
                        {t.badge}
                      </span>
                    </div>
                    <p className="ap-tmpl-desc">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Download bar */}
          <div className="ap-dl-bar">
            <span className="ap-dl-count">
              {acceptedSubs.size} of {feedback.suggestions.length} selected
            </span>
            {generateError && <span className="ap-dl-err">{generateError}</span>}
            <button
              type="button"
              className="ap-btn ap-btn--glow"
              onClick={onGeneratePDF}
              disabled={acceptedSubs.size === 0 || generating}
            >
              {generating
                ? <><span className="ap-spinner" /> Building PDF…</>
                : '↓ Download Updated Resume'}
            </button>
          </div>
        </>
      )}

      {feedback && feedback.suggestions?.length === 0 && (
        <p className="ap-empty" style={{ marginTop: '1rem' }}>
          No rewrite suggestions generated from the available evidence.
        </p>
      )}
    </div>
  );
}
