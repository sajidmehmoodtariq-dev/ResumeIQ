import { useState } from 'react';

export default function StepSkills({ data, onChange }) {
  const [input, setInput] = useState('');

  function commit() {
    const parts = input.split(',').map((s) => s.trim()).filter((s) => s && !data.includes(s));
    if (parts.length) onChange([...data, ...parts]);
    setInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Backspace' && !input && data.length) {
      onChange(data.slice(0, -1));
    }
  }

  return (
    <div className="br-form">
      <div className="br-field">
        <label className="br-label">Skills</label>
        <p className="br-hint">
          Type a skill and press <kbd className="br-kbd">Enter</kbd> or <kbd className="br-kbd">,</kbd> to add it.
          Include languages, frameworks, tools, and soft skills.
        </p>
        <div className="br-tag-input">
          {data.map((skill, i) => (
            <span key={i} className="br-tag">
              {skill}
              <button
                type="button"
                className="br-tag-remove"
                onClick={() => onChange(data.filter((_, j) => j !== i))}
              >×</button>
            </span>
          ))}
          <input
            className="br-tag-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            placeholder={data.length === 0 ? 'Python, React, AWS, Docker…' : 'Add more…'}
          />
        </div>
        {data.length > 0 && (
          <p className="br-tag-count">{data.length} skill{data.length !== 1 ? 's' : ''} added</p>
        )}
      </div>
    </div>
  );
}
