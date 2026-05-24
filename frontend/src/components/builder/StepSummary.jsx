export default function StepSummary({ data, onChange }) {
  return (
    <div className="br-form">
      <div className="br-field">
        <label className="br-label">Professional Summary</label>
        <p className="br-hint">
          2–4 sentences highlighting your expertise, experience level, and what you bring to a role.
          Skip if you prefer to lead with experience.
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
