import { newId } from '../../utils/resumeJson.js';

function emptyEntry() {
  return { id: newId(), name: '', url: '', dates: '', technologies: '', bullets: [''] };
}

export default function StepProjects({ data, onChange }) {
  function addEntry() {
    onChange([...data, emptyEntry()]);
  }

  function removeEntry(idx) {
    onChange(data.filter((_, i) => i !== idx));
  }

  function updateEntry(idx, key, val) {
    const next = [...data];
    next[idx] = { ...next[idx], [key]: val };
    onChange(next);
  }

  function addBullet(ei) {
    const next = [...data];
    next[ei] = { ...next[ei], bullets: [...next[ei].bullets, ''] };
    onChange(next);
  }

  function updateBullet(ei, bi, val) {
    const next = [...data];
    next[ei].bullets = [...next[ei].bullets];
    next[ei].bullets[bi] = val;
    onChange(next);
  }

  function removeBullet(ei, bi) {
    const next = [...data];
    next[ei].bullets = next[ei].bullets.filter((_, i) => i !== bi);
    onChange(next);
  }

  return (
    <div className="br-form">
      {data.length === 0 && (
        <p className="br-empty-hint">Showcase side projects, open source contributions, or portfolio pieces. 3–4 strong projects is ideal.</p>
      )}

      {data.map((proj, ei) => (
        <div key={proj.id} className="br-entry-card">
          <div className="br-entry-hd">
            <span className="br-entry-num">Project {ei + 1}</span>
            <button type="button" className="br-remove-btn" onClick={() => removeEntry(ei)}>✕ Remove</button>
          </div>

          <div className="br-field-row br-field-row--2">
            <div className="br-field">
              <label className="br-label">Project Name <span className="br-req">*</span></label>
              <input
                className="br-input"
                value={proj.name}
                onChange={(e) => updateEntry(ei, 'name', e.target.value)}
                placeholder="Resume Matcher"
              />
            </div>
            <div className="br-field">
              <label className="br-label">URL / GitHub</label>
              <input
                className="br-input"
                value={proj.url}
                onChange={(e) => updateEntry(ei, 'url', e.target.value)}
                placeholder="github.com/user/project"
              />
            </div>
          </div>

          <div className="br-field-row br-field-row--2">
            <div className="br-field">
              <label className="br-label">Dates</label>
              <input
                className="br-input"
                value={proj.dates}
                onChange={(e) => updateEntry(ei, 'dates', e.target.value)}
                placeholder="Jan 2024 – Present"
              />
            </div>
            <div className="br-field">
              <label className="br-label">Technologies Used</label>
              <input
                className="br-input"
                value={proj.technologies || ''}
                onChange={(e) => updateEntry(ei, 'technologies', e.target.value)}
                placeholder="React, FastAPI, PostgreSQL"
              />
            </div>
          </div>

          <div className="br-field">
            <div className="br-label-row">
              <label className="br-label">Description &amp; Key Points</label>
              <span className={`br-bullet-meta ${proj.bullets.filter(b=>b.trim()).length >= 2 && proj.bullets.filter(b=>b.trim()).length <= 3 ? 'br-bullet-meta--ok' : 'br-bullet-meta--warn'}`}>
                {proj.bullets.filter(b=>b.trim()).length} bullets · aim 2–3
              </span>
            </div>
            {proj.bullets.map((bullet, bi) => (
              <div key={bi} className="br-bullet-row">
                <span className="br-bullet-dot">•</span>
                <input
                  className="br-input br-input--bullet"
                  value={bullet}
                  onChange={(e) => updateBullet(ei, bi, e.target.value)}
                  placeholder="Built an AI-powered resume analysis tool using FastAPI and React…"
                />
                {proj.bullets.length > 1 && (
                  <button type="button" className="br-remove-bullet" onClick={() => removeBullet(ei, bi)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="br-add-bullet" onClick={() => addBullet(ei)}>+ Add bullet</button>
          </div>
        </div>
      ))}

      <button type="button" className="br-add-entry-btn" onClick={addEntry}>
        + Add Project
      </button>
    </div>
  );
}
