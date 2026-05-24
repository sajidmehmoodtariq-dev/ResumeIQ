const fmt = (v) => (v == null ? 'n/a' : `${v}%`);

export default function ScoreResults({ result }) {
  return (
    <>
      {/* Score ring + metrics */}
      <div className="ap-results-top">
        <div className="ap-ring-wrap">
          <div
            className="ap-ring"
            style={{
              background: `conic-gradient(from -90deg, #b8ff3d ${result.score / 100 * 360}deg, #181c28 0deg)`,
            }}
          >
            <div className="ap-ring-face">
              <span className="ap-ring-num">{result.score}</span>
              <span className="ap-ring-pct">%</span>
              <span className="ap-ring-lbl">match score</span>
            </div>
          </div>
        </div>

        <div className="ap-metrics">
          {[
            { label: 'Semantic Similarity', val: result.semantic_score,            weight: '60% weight', cls: 'ap-fill--lime' },
            { label: 'Skill Coverage',       val: result.skill_coverage,            weight: '40% weight', cls: 'ap-fill--indigo' },
            { label: 'Skills Section',        val: result.section_scores?.skills,    weight: 'info',       cls: 'ap-fill--orange' },
            { label: 'Experience Section',    val: result.section_scores?.experience, weight: 'info',      cls: 'ap-fill--orange' },
          ].map(({ label, val, weight, cls }) => (
            <div key={label} className="ap-metric">
              <div className="ap-metric-hd">
                <span className="ap-metric-label">{label}</span>
                <span className="ap-metric-val">{fmt(val)}</span>
              </div>
              <div className="ap-metric-track">
                <div className={`ap-metric-fill ${cls}`} style={{ width: `${val ?? 0}%` }} />
              </div>
              <span className="ap-metric-weight">{weight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="ap-skills-cols">
        <div className="ap-skills-block">
          <h3 className="ap-skills-title ap-skills-title--match">
            Matched Skills
            <span className="ap-skills-count ap-skills-count--match">{result.matched_skills.length}</span>
          </h3>
          {result.matched_skills.length === 0
            ? <p className="ap-empty">No direct skill matches found.</p>
            : (
              <div className="ap-pills">
                {result.matched_skills.map((s) => (
                  <span key={s} className="ap-pill ap-pill--match">{s}</span>
                ))}
              </div>
            )}
        </div>

        <div className="ap-skills-block">
          <h3 className="ap-skills-title ap-skills-title--miss">
            Missing Skills
            <span className="ap-skills-count ap-skills-count--miss">{result.missing_skills.length}</span>
          </h3>
          {result.missing_skills.length === 0
            ? <p className="ap-empty">No missing skills — excellent coverage.</p>
            : (
              <div className="ap-pills">
                {result.missing_skills.map((s) => (
                  <span key={s} className="ap-pill ap-pill--miss">{s}</span>
                ))}
              </div>
            )}
        </div>
      </div>
    </>
  );
}
