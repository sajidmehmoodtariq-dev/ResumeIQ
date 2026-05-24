const SECTION_META = {
  experience:     { label: 'Work Experience',    icon: '▸' },
  education:      { label: 'Education',          icon: '▸' },
  skills:         { label: 'Skills',             icon: '▸' },
  projects:       { label: 'Projects',           icon: '▸' },
  certifications: { label: 'Certifications',     icon: '▸' },
};

function hasData(resume, sid) {
  const d = resume[sid];
  if (!d) return false;
  if (Array.isArray(d)) return d.length > 0;
  if (typeof d === 'string') return d.trim().length > 0;
  return false;
}

export default function SectionOrder({
  order, onChange, resumeJson,
  onFinish, onDirectDownload, downloading,
  selectedTemplate, setSelectedTemplate,
}) {
  function moveUp(idx) {
    if (idx === 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function moveDown(idx) {
    if (idx >= order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  return (
    <div className="br-form">
      <p className="br-hint">
        Drag sections up or down to control the order they appear in your PDF.
        Sections marked <span className="br-empty-label">empty</span> will be skipped automatically.
      </p>

      <div className="br-section-list">
        {order.map((sid, idx) => {
          const meta = SECTION_META[sid] || { label: sid, icon: '▸' };
          const populated = hasData(resumeJson, sid);
          return (
            <div key={sid} className={`br-section-row ${!populated ? 'br-section-row--empty' : ''}`}>
              <span className="br-section-icon">{meta.icon}</span>
              <span className="br-section-label">{meta.label}</span>
              {!populated && <span className="br-empty-label">empty</span>}
              <div className="br-order-controls">
                <button
                  type="button"
                  className="br-order-btn"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  aria-label="Move up"
                >↑</button>
                <button
                  type="button"
                  className="br-order-btn"
                  onClick={() => moveDown(idx)}
                  disabled={idx >= order.length - 1}
                  aria-label="Move down"
                >↓</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="br-tmpl-row">
        <span className="br-label">Template for download</span>
        <div className="br-tmpl-mini-btns">
          {['classic', 'modern', 'creative'].map((t) => (
            <button
              key={t}
              type="button"
              className={`br-tmpl-mini-btn ${selectedTemplate === t ? 'br-tmpl-mini-btn--active' : ''}`}
              onClick={() => setSelectedTemplate(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="br-finalize-actions">
        <button
          type="button"
          className="br-btn br-btn--ghost"
          onClick={onDirectDownload}
          disabled={downloading}
        >
          {downloading ? 'Generating…' : '↓ Download Draft PDF'}
        </button>
        <button
          type="button"
          className="br-btn br-btn--primary"
          onClick={onFinish}
        >
          Analyze Against a Job Description →
        </button>
      </div>
    </div>
  );
}
