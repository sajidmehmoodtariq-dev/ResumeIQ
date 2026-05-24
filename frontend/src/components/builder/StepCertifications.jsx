import { newId } from '../../utils/resumeJson.js';

function emptyEntry() {
  return { id: newId(), name: '', issuer: '', date: '' };
}

export default function StepCertifications({ data, onChange }) {
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
        <p className="br-empty-hint">Add professional certifications, licenses, or credentials. Skip if not applicable.</p>
      )}

      {data.map((cert, ci) => (
        <div key={cert.id} className="br-entry-card">
          <div className="br-entry-hd">
            <span className="br-entry-num">Certification {ci + 1}</span>
            <button type="button" className="br-remove-btn" onClick={() => removeEntry(ci)}>✕ Remove</button>
          </div>

          <div className="br-field-row br-field-row--3">
            <div className="br-field">
              <label className="br-label">Certificate Name <span className="br-req">*</span></label>
              <input
                className="br-input"
                value={cert.name}
                onChange={(e) => updateEntry(ci, 'name', e.target.value)}
                placeholder="AWS Solutions Architect"
              />
            </div>
            <div className="br-field">
              <label className="br-label">Issuing Organization</label>
              <input
                className="br-input"
                value={cert.issuer}
                onChange={(e) => updateEntry(ci, 'issuer', e.target.value)}
                placeholder="Amazon Web Services"
              />
            </div>
            <div className="br-field">
              <label className="br-label">Date</label>
              <input
                className="br-input"
                value={cert.date}
                onChange={(e) => updateEntry(ci, 'date', e.target.value)}
                placeholder="2023"
              />
            </div>
          </div>
        </div>
      ))}

      <button type="button" className="br-add-entry-btn" onClick={addEntry}>
        + Add Certification
      </button>
    </div>
  );
}
