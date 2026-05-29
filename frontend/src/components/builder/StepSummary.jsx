export default function StepSummary({ data, onChange }) {
  const sentences = data.trim()
    ? (data.trim().match(/[.!?]+(\s|$)/g) || []).length
    : 0;

  const sentenceStatus = sentences === 0 ? '' : sentences >= 2 && sentences <= 3 ? 'ok' : 'warn';

  return (
    <div className="br-form">
      <div className="br-field">
        <div className="br-label-row">
          <label className="br-label">Professional Summary</label>
          {sentences > 0 && (
            <span className={`br-bullet-meta ${sentenceStatus === 'ok' ? 'br-bullet-meta--ok' : 'br-bullet-meta--warn'}`}>
              {sentences} sentence{sentences !== 1 ? 's' : ''} · max 3
            </span>
          )}
        </div>
        <p className="br-hint">
          2–3 sentences: who you are, your key expertise, and what you bring to the role.
          Skip buzzwords like "passionate self-starter." Keep it specific and factual.
        </p>
        <textarea
          className="br-textarea br-textarea--tall"
          value={data}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Experienced software engineer with 5+ years building scalable web applications. Specialising in Python and React, with a track record of shipping user-facing features at high-growth startups."
          rows={5}
        />
        <span className="br-char-count">{data.length} chars</span>
      </div>
    </div>
  );
}
