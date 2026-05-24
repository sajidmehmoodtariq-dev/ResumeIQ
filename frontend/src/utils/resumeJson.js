const DRAFT_KEY = 'rm_resume_draft';

export function emptyResume() {
  return {
    meta: { sectionOrder: ['experience', 'education', 'skills', 'projects', 'certifications'] },
    personal: { name: '', email: '', phone: '', location: '', linkedin: '', website: '' },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  };
}

export function newId() {
  return crypto.randomUUID();
}

export function saveDraft(json) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(json)); } catch {}
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function jsonToText(resume) {
  const lines = [];
  const p = resume.personal;

  if (p.name) lines.push(p.name);
  const contact = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean);
  if (contact.length) lines.push(contact.join(' | '));
  lines.push('');

  if (resume.summary?.trim()) {
    lines.push('SUMMARY');
    lines.push(resume.summary.trim());
    lines.push('');
  }

  for (const sid of resume.meta.sectionOrder) {
    const data = resume[sid];
    if (!data || (Array.isArray(data) && data.length === 0)) continue;

    if (sid === 'skills') {
      lines.push('SKILLS');
      lines.push(data.join(', '));
      lines.push('');
    } else if (sid === 'experience') {
      lines.push('EXPERIENCE');
      for (const exp of data) {
        if (exp.role) lines.push(exp.role);
        const meta = [
          exp.company, exp.location,
          [exp.startDate, exp.endDate].filter(Boolean).join(' – '),
        ].filter(Boolean).join(' | ');
        if (meta) lines.push(meta);
        for (const b of exp.bullets ?? []) {
          if (b.trim()) lines.push(`• ${b.trim()}`);
        }
        lines.push('');
      }
    } else if (sid === 'education') {
      lines.push('EDUCATION');
      for (const edu of data) {
        if (edu.institution) lines.push(edu.institution);
        const meta = [
          edu.degree,
          edu.graduationDate,
          edu.gpa ? `GPA: ${edu.gpa}` : '',
        ].filter(Boolean).join(' | ');
        if (meta) lines.push(meta);
        if (edu.honors) lines.push(edu.honors);
        lines.push('');
      }
    } else if (sid === 'projects') {
      lines.push('PROJECTS');
      for (const proj of data) {
        if (proj.name) lines.push(proj.name);
        const meta = [proj.dates, proj.url].filter(Boolean).join(' | ');
        if (meta) lines.push(meta);
        for (const b of proj.bullets ?? []) {
          if (b.trim()) lines.push(`• ${b.trim()}`);
        }
        lines.push('');
      }
    } else if (sid === 'certifications') {
      lines.push('CERTIFICATIONS');
      for (const cert of data) {
        const parts = [cert.name, cert.issuer, cert.date].filter(Boolean).join(' | ');
        if (parts) lines.push(`• ${parts}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

export function findBulletLocation(resume, bulletText) {
  const norm = (s) => s.trim().toLowerCase();
  const target = norm(bulletText);
  for (const sid of ['experience', 'projects']) {
    const entries = resume[sid] ?? [];
    for (let ei = 0; ei < entries.length; ei++) {
      const bullets = entries[ei].bullets ?? [];
      for (let bi = 0; bi < bullets.length; bi++) {
        if (norm(bullets[bi]) === target) return { sectionId: sid, entryIdx: ei, bulletIdx: bi };
      }
    }
  }
  return null;
}
