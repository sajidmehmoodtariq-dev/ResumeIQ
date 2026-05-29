import { useState, useEffect } from 'react';

const DEFAULT_CATEGORIES = [
  'Languages',
  'Frameworks & Libraries',
  'Tools & Platforms',
  'Soft Skills',
];

function emptyGroup(category) {
  return { category, items: [] };
}

function ensureGroups(data) {
  if (!data || data.length === 0) return DEFAULT_CATEGORIES.map(emptyGroup);
  if (typeof data[0] === 'string') return [{ category: 'Skills', items: data }];
  return data;
}

export default function StepSkills({ data, onChange, geminiKey, geminiModel }) {
  const groups = ensureGroups(data);
  const [inputs, setInputs] = useState({});
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    if (!data || data.length === 0) {
      onChange(DEFAULT_CATEGORIES.map(emptyGroup));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalItems = groups.reduce((sum, g) => sum + (g.items?.length || 0), 0);

  function setGroups(next) {
    onChange(next);
  }

  function getInput(gi) { return inputs[gi] ?? ''; }
  function setInput(gi, val) { setInputs((p) => ({ ...p, [gi]: val })); }

  function commitInput(gi) {
    const val = getInput(gi);
    if (!val.trim()) return;
    const current = groups[gi]?.items ?? [];
    const parts = val.split(',').map((s) => s.trim()).filter((s) => s && !current.includes(s));
    if (!parts.length) { setInput(gi, ''); return; }
    const next = [...groups];
    next[gi] = { ...next[gi], items: [...current, ...parts] };
    setGroups(next);
    setInput(gi, '');
  }

  function removeItem(gi, ii) {
    const next = [...groups];
    next[gi] = { ...next[gi], items: next[gi].items.filter((_, j) => j !== ii) };
    setGroups(next);
  }

  function removeGroup(gi) {
    setGroups(groups.filter((_, i) => i !== gi));
  }

  function updateCategoryName(gi, name) {
    const next = [...groups];
    next[gi] = { ...next[gi], category: name };
    setGroups(next);
  }

  function addGroup() {
    if (!newCatName.trim()) return;
    setGroups([...groups, { category: newCatName.trim(), items: [] }]);
    setNewCatName('');
    setShowNewCat(false);
  }

  async function handleAutoCategorize() {
    if (!geminiKey) return;
    const allSkills = groups.flatMap((g) => g.items ?? []).filter(Boolean);
    if (allSkills.length === 0) {
      setAiError('Add some skills first, then auto-categorize.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/rewrite-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'skills',
          current_data: { skills: groups },
          full_context: `Skills to categorize: ${allSkills.join(', ')}`,
          instruction:
            'Auto-categorize all skills into logical groups. Use categories like: ' +
            'Languages, Frameworks & Libraries, Tools & Platforms, Soft Skills, ' +
            'and any other relevant categories that fit the skill set. ' +
            'Keep all skills — just reorganize them. Do not remove any.',
          api_key: geminiKey,
          model: geminiModel || 'gemini-2.0-flash',
        }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result) throw new Error(result?.detail || 'Auto-categorize failed');
      if (Array.isArray(result.skills)) {
        onChange(result.skills);
      }
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  const gaugeColor = totalItems >= 10 && totalItems <= 15
    ? 'var(--accent)'
    : totalItems > 15 ? 'var(--orange)' : 'var(--indigo)';

  return (
    <div className="br-form">

      {/* ── Count gauge + AI button ────────────────────────── */}
      <div className="sk-top-row">
        <div className="sk-gauge">
          <span className="sk-gauge-label">Total</span>
          <span className={`sk-gauge-num ${totalItems >= 10 && totalItems <= 15 ? 'sk-gauge-num--ok' : totalItems > 0 ? 'sk-gauge-num--over' : ''}`}>
            {totalItems} / 10–15
          </span>
          <div className="sk-gauge-track">
            <div
              className="sk-gauge-fill"
              style={{ width: `${Math.min(100, (totalItems / 15) * 100)}%`, background: gaugeColor }}
            />
          </div>
        </div>

        <button
          type="button"
          className="sk-ai-btn"
          onClick={handleAutoCategorize}
          disabled={aiLoading || !geminiKey || totalItems === 0}
          title={!geminiKey ? 'Add a Gemini API key in Profile → API Keys' : 'Let AI organize your skills into categories'}
        >
          {aiLoading ? (
            <><span className="br-spinner br-spinner--dark" />Organizing…</>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1L7.9 4.6L11.5 5L8.9 7.5L9.6 11.1L6.5 9.3L3.4 11.1L4.1 7.5L1.5 5L5.1 4.6L6.5 1Z"
                  stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              Auto-categorize
            </>
          )}
        </button>
      </div>

      {aiError && <p className="sk-ai-error">{aiError}</p>}

      {/* ── Category groups ────────────────────────────────── */}
      {groups.map((group, gi) => {
        const isSoftCat = group.category.toLowerCase().includes('soft');
        const overSoft  = isSoftCat && group.items.length > 3;

        return (
          <div key={gi} className="sk-group">
            <div className="sk-group-hd">
              <input
                className="sk-group-name"
                value={group.category}
                onChange={(e) => updateCategoryName(gi, e.target.value)}
                placeholder="Category name"
              />
              <span className="sk-group-count">{group.items.length}</span>
              {overSoft && <span className="sk-soft-badge">max 3</span>}
              <button type="button" className="sk-remove-group" onClick={() => removeGroup(gi)} title="Remove category">✕</button>
            </div>

            <div className="br-tag-input">
              {(group.items ?? []).map((item, ii) => (
                <span key={ii} className="br-tag">
                  {item}
                  <button type="button" className="br-tag-remove" onClick={() => removeItem(gi, ii)}>×</button>
                </span>
              ))}
              <input
                className="br-tag-field"
                value={getInput(gi)}
                onChange={(e) => setInput(gi, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitInput(gi); }
                  if (e.key === 'Backspace' && !getInput(gi) && group.items.length) {
                    removeItem(gi, group.items.length - 1);
                  }
                }}
                onBlur={() => commitInput(gi)}
                placeholder={group.items.length === 0 ? `Add ${group.category}…` : 'Add more…'}
              />
            </div>
          </div>
        );
      })}

      {/* ── Add category ───────────────────────────────────── */}
      {showNewCat ? (
        <div className="sk-new-cat">
          <input
            className="br-input sk-new-cat-input"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addGroup();
              if (e.key === 'Escape') { setShowNewCat(false); setNewCatName(''); }
            }}
            placeholder="e.g. Databases, Cloud, Design Tools"
            autoFocus
          />
          <div className="sk-new-cat-btns">
            <button type="button" className="br-btn br-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
              onClick={() => { setShowNewCat(false); setNewCatName(''); }}>Cancel</button>
            <button type="button" className="br-btn br-btn--primary" style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
              disabled={!newCatName.trim()} onClick={addGroup}>Add</button>
          </div>
        </div>
      ) : (
        <button type="button" className="br-add-entry-btn" onClick={() => setShowNewCat(true)}>
          + Add Category
        </button>
      )}

      <p className="br-hint">
        Press <kbd className="br-kbd">Enter</kbd> or <kbd className="br-kbd">,</kbd> to add a skill.
        80% hard skills — only list what you can discuss in an interview.
      </p>
    </div>
  );
}
