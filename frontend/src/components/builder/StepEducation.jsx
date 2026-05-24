import { newId } from '../../utils/resumeJson.js';

function emptyEntry() {
  return { id: newId(), institution: '', degree: '', location: '', graduationDate: '', gpa: '', honors: '' };
}

export default function StepEducation({ data, onChange }) {
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

  return (
    <div className="br-form">
      {data.length === 0 && (
        <p className="br-empty-hint">Add your highest degree first. Multiple degrees are supported.</p>
      )}

      {data.map((edu, ei) => (
        <div key={edu.id} className="br-entry-card">
          <div className="br-entry-hd">
            <span className="br-entry-num">Degree {ei + 1}</span>
            <button type="button" className="br-remove-btn" onClick={() => removeEntry(ei)}>✕ Remove</button>
          </div>

          <div className="br-field-row br-field-row--2">
            <div className="br-field">
              <label className="br-label">Institution <span className="br-req">*</span></label>
              <input
                className="br-input"
                value={edu.institution}
                onChange={(e) => updateEntry(ei, 'institution', e.target.value)}
                placeholder="Massachusetts Institute of Technology"
              />
            </div>
            <div className="br-field">
              <label className="br-label">Degree</label>
              <input
                className="br-input"
                value={edu.degree}
                onChange={(e) => updateEntry(ei, 'degree', e.target.value)}
                placeholder="B.S. Computer Science"
              />
            </div>
          </div>

          <div className="br-field-row br-field-row--3">
            <div className="br-field">
              <label className="br-label">Graduation Date</label>
              <input
                className="br-input"
                value={edu.graduationDate}
                onChange={(e) => updateEntry(ei, 'graduationDate', e.target.value)}
                placeholder="May 2020"
              />
            </div>
            <div className="br-field">
              <label className="br-label">GPA (optional)</label>
              <input
                className="br-input"
                value={edu.gpa}
                onChange={(e) => updateEntry(ei, 'gpa', e.target.value)}
                placeholder="3.8"
              />
            </div>
            <div className="br-field">
              <label className="br-label">Location</label>
              <input
                className="br-input"
                value={edu.location}
                onChange={(e) => updateEntry(ei, 'location', e.target.value)}
                placeholder="Cambridge, MA"
              />
            </div>
          </div>

          <div className="br-field">
            <label className="br-label">Honors / Awards (optional)</label>
            <input
              className="br-input"
              value={edu.honors}
              onChange={(e) => updateEntry(ei, 'honors', e.target.value)}
              placeholder="Magna Cum Laude, Dean's List"
            />
          </div>
        </div>
      ))}

      <button type="button" className="br-add-entry-btn" onClick={addEntry}>
        + Add Education
      </button>
    </div>
  );
}
