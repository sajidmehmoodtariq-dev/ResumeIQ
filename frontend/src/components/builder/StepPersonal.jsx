export default function StepPersonal({ data, onChange }) {
  const set = (key) => (e) => onChange({ ...data, [key]: e.target.value });

  return (
    <div className="br-form">
      <div className="br-field-row">
        <div className="br-field">
          <label className="br-label">Full Name <span className="br-req">*</span></label>
          <input className="br-input" value={data.name} onChange={set('name')} placeholder="Jane Smith" />
        </div>
      </div>

      <div className="br-field-row br-field-row--2">
        <div className="br-field">
          <label className="br-label">Email</label>
          <input className="br-input" type="email" value={data.email} onChange={set('email')} placeholder="jane@example.com" />
        </div>
        <div className="br-field">
          <label className="br-label">Phone</label>
          <input className="br-input" type="tel" value={data.phone} onChange={set('phone')} placeholder="+1 (555) 123-4567" />
        </div>
      </div>

      <div className="br-field-row br-field-row--2">
        <div className="br-field">
          <label className="br-label">Location</label>
          <input className="br-input" value={data.location} onChange={set('location')} placeholder="New York, NY" />
        </div>
        <div className="br-field">
          <label className="br-label">LinkedIn</label>
          <input className="br-input" value={data.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/janesmith" />
        </div>
      </div>

      <div className="br-field-row">
        <div className="br-field">
          <label className="br-label">Website / Portfolio</label>
          <input className="br-input" value={data.website} onChange={set('website')} placeholder="janesmith.dev" />
        </div>
      </div>
    </div>
  );
}
