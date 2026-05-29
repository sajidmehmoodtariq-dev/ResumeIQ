import { newId } from '../../utils/resumeJson.js';

function emptyEntry() {
  return { id: newId(), company: '', role: '', location: '', startDate: '', endDate: 'Present', bullets: [''] };
}

export default function StepExperience({ data, onChange }) {
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
        <p className="br-empty-hint">No positions yet. Add your most recent role first.</p>
      )}

      {data.map((exp, ei) => (
        <div key={exp.id} className="br-entry-card">
          <div className="br-entry-hd">
            <span className="br-entry-num">Position {ei + 1}</span>
            <button type="button" className="br-remove-btn" onClick={() => removeEntry(ei)}>✕ Remove</button>
          </div>

          <div className="br-field-row br-field-row--2">
            <div className="br-field">
              <label className="br-label">Job Title <span className="br-req">*</span></label>
              <input
                className="br-input"
                value={exp.role}
                onChange={(e) => updateEntry(ei, 'role', e.target.value)}
                placeholder="Senior Software Engineer"
              />
            </div>
            <div className="br-field">
              <label className="br-label">Company</label>
              <input
                className="br-input"
                value={exp.company}
                onChange={(e) => updateEntry(ei, 'company', e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          </div>

          <div className="br-field-row br-field-row--3">
            <div className="br-field">
              <label className="br-label">Start Date</label>
              <input
                className="br-input"
                value={exp.startDate}
                onChange={(e) => updateEntry(ei, 'startDate', e.target.value)}
                placeholder="Jan 2022"
              />
            </div>
            <div className="br-field">
              <label className="br-label">End Date</label>
              <input
                className="br-input"
                value={exp.endDate}
                onChange={(e) => updateEntry(ei, 'endDate', e.target.value)}
                placeholder="Present"
              />
            </div>
            <div className="br-field">
              <label className="br-label">Location</label>
              <input
                className="br-input"
                value={exp.location}
                onChange={(e) => updateEntry(ei, 'location', e.target.value)}
                placeholder="New York, NY"
              />
            </div>
          </div>

          <div className="br-field">
            <div className="br-label-row">
              <label className="br-label">Key Achievements &amp; Responsibilities</label>
              <span className={`br-bullet-meta ${exp.bullets.filter(b=>b.trim()).length >= 3 && exp.bullets.filter(b=>b.trim()).length <= 6 ? 'br-bullet-meta--ok' : 'br-bullet-meta--warn'}`}>
                {exp.bullets.filter(b=>b.trim()).length} bullets · aim 3–6
              </span>
            </div>
            <p className="br-hint">Use action verbs. Quantify impact where possible (e.g. "reduced latency by 40%").</p>
            {exp.bullets.map((bullet, bi) => (
              <div key={bi} className="br-bullet-row">
                <span className="br-bullet-dot">•</span>
                <input
                  className="br-input br-input--bullet"
                  value={bullet}
                  onChange={(e) => updateBullet(ei, bi, e.target.value)}
                  placeholder="Built X that reduced Y by 30%…"
                />
                {exp.bullets.length > 1 && (
                  <button type="button" className="br-remove-bullet" onClick={() => removeBullet(ei, bi)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="br-add-bullet" onClick={() => addBullet(ei)}>+ Add bullet</button>
          </div>
        </div>
      ))}

      <button type="button" className="br-add-entry-btn" onClick={addEntry}>
        + Add Position
      </button>
    </div>
  );
}
