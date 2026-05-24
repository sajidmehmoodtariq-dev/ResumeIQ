const fmt = (v) => (v == null ? 'n/a' : `${v}%`);

export default function JobDescription({
  jdMode,
  setJdMode,
  jdText,
  setJdText,
  compareJds,
  setCompareJds,
  compareResult,
  loading,
  compareLoading,
  compareError,
  onScore,
  onCompare,
}) {
  return (
    <>
      <div className="ap-tabs">
        <button
          type="button"
          className={`ap-tab ${jdMode === 'single' ? 'ap--active' : ''}`}
          onClick={() => setJdMode('single')}
        >
          Analyze Single JD
        </button>
        <button
          type="button"
          className={`ap-tab ${jdMode === 'compare' ? 'ap--active' : ''}`}
          onClick={() => setJdMode('compare')}
        >
          Compare 3 JDs
        </button>
      </div>

      {jdMode === 'single' && (
        <form onSubmit={onScore}>
          <textarea
            className="ap-textarea"
            placeholder="Paste the job description here to compare…"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
          <button type="submit" className="ap-btn" disabled={loading}>
            {loading
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
            onClick={onCompare}
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
    </>
  );
}
