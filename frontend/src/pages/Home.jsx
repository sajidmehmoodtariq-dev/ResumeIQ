import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate('/');
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.08, rootMargin: '0px 0px -48px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const nav = document.querySelector('.hm-nav');
    const onScroll = () => nav?.classList.toggle('hm-nav--stuck', window.scrollY > 48);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <div className="hm-root">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="hm-nav">
        <div className="hm-nav-inner">
          <span className="hm-logo">Resume<em>Matcher</em></span>
          <div className="hm-nav-actions">
            {isLoggedIn ? (
              <>
                <span style={{ color: '#b8ff3d', fontSize: '0.9rem' }}>
                  {user?.first_name} {user?.last_name}
                </span>
                <button
                  onClick={handleLogout}
                  className="hm-nav-link"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '10px 14px', borderRadius: '999px' }}
                >
                  Logout
                </button>
                <Link to="/app" className="hm-nav-cta">My Dashboard →</Link>
              </>
            ) : (
              <>
                <Link to="/login" className="hm-nav-link">Sign In</Link>
                <Link to="/signup" className="hm-nav-link">Sign Up</Link>
                <Link to="/app" className="hm-nav-cta">Launch App →</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="hm-hero">
        <div className="hm-hero-bg" aria-hidden="true">
          <div className="hm-grid" />
          <div className="hm-blob hm-blob-1" />
          <div className="hm-blob hm-blob-2" />
          <div className="hm-blob hm-blob-3" />
        </div>

        <div className="hm-hero-inner">
          <div className="hm-hero-text">
            <p className="hm-eyebrow reveal">
              <span className="hm-eyebrow-pip" />
              AI-Powered Resume Analysis
            </p>
            <h1 className="hm-headline reveal">
              Know exactly<br /><em>where you stand.</em>
            </h1>
            <p className="hm-sub reveal">
              Match your resume against any job description using semantic
              AI scoring, skill gap analysis, and section-by-section
              feedback — in seconds.
            </p>
            <div className="hm-actions reveal">
              <Link to="/app" className="hm-btn-primary">Launch App →</Link>
              <Link to="/login" className="hm-btn-ghost">Sign In</Link>
              <Link to="/signup" className="hm-btn-ghost">Sign Up</Link>
            </div>

            <div className="hm-hero-stats reveal">
              <div className="hm-stat">
                <span className="hm-stat-num">300<span className="hm-stat-plus">+</span></span>
                <span className="hm-stat-lbl">Tech skills indexed</span>
              </div>
              <div className="hm-stat-divider" />
              <div className="hm-stat">
                <span className="hm-stat-num">3</span>
                <span className="hm-stat-lbl">Score dimensions</span>
              </div>
              <div className="hm-stat-divider" />
              <div className="hm-stat">
                <span className="hm-stat-num">&lt;2s</span>
                <span className="hm-stat-lbl">Analysis time</span>
              </div>
            </div>
          </div>

          {/* ── HERO VISUAL ── */}
          <div className="hm-hero-visual reveal">
            <div className="hm-visual-scene">
              <div className="hm-glow hm-glow-lime" aria-hidden="true" />
              <div className="hm-glow hm-glow-indigo" aria-hidden="true" />

              {/* Score dial */}
              <div className="hm-dial" aria-label="87% match score">
                <div className="hm-dial-face">
                  <span className="hm-dial-number">87</span>
                  <span className="hm-dial-pct">%</span>
                  <span className="hm-dial-caption">match score</span>
                </div>
              </div>

              {/* Orbit ring (decorative) */}
              <div className="hm-orbit" aria-hidden="true" />

              {/* Floating skill tags */}
              <div className="hm-tag hm-tag-match s1">React</div>
              <div className="hm-tag hm-tag-match s2">TypeScript</div>
              <div className="hm-tag hm-tag-match s3">Node.js</div>
              <div className="hm-tag hm-tag-match s4">GraphQL</div>
              <div className="hm-tag hm-tag-miss  s5">Docker</div>
              <div className="hm-tag hm-tag-miss  s6">Kubernetes</div>
              <div className="hm-tag hm-tag-match s7">PostgreSQL</div>
              <div className="hm-tag hm-tag-miss  s8">Terraform</div>

              {/* Mini legend */}
              <div className="hm-legend" aria-hidden="true">
                <span className="hm-legend-item hm-legend-match">matched</span>
                <span className="hm-legend-item hm-legend-miss">missing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section className="hm-how" id="how">
        <div className="hm-section-wrap">
          <header className="hm-section-hd reveal">
            <span className="hm-overline">Process</span>
            <h2 className="hm-section-title">How it works</h2>
            <p className="hm-section-sub">Three steps from resume to actionable insights.</p>
          </header>

          <div className="hm-steps">
            <div className="hm-step reveal" style={{ transitionDelay: '0s' }}>
              <div className="hm-step-icon hm-step-icon-1" aria-hidden="true" />
              <span className="hm-step-n">01</span>
              <h3 className="hm-step-title">Upload Your Resume</h3>
              <p className="hm-step-desc">
                Drop a PDF or paste your resume text. Our parser extracts
                clean, structured text from any layout instantly.
              </p>
            </div>

            <div className="hm-step-connector" aria-hidden="true">
              <div className="hm-connector-line" />
              <div className="hm-connector-arrow" />
            </div>

            <div className="hm-step reveal" style={{ transitionDelay: '0.1s' }}>
              <div className="hm-step-icon hm-step-icon-2" aria-hidden="true" />
              <span className="hm-step-n">02</span>
              <h3 className="hm-step-title">Analyze Against JD</h3>
              <p className="hm-step-desc">
                The AI embeds both documents, extracts technical skills,
                and computes semantic similarity with weighted composite scoring.
              </p>
            </div>

            <div className="hm-step-connector" aria-hidden="true">
              <div className="hm-connector-line" />
              <div className="hm-connector-arrow" />
            </div>

            <div className="hm-step reveal" style={{ transitionDelay: '0.2s' }}>
              <div className="hm-step-icon hm-step-icon-3" aria-hidden="true" />
              <span className="hm-step-n">03</span>
              <h3 className="hm-step-title">Get Your Gap Report</h3>
              <p className="hm-step-desc">
                See your composite score, matched and missing skills, and
                section-by-section breakdown — all in one view.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section className="hm-features">
        <div className="hm-section-wrap">
          <header className="hm-section-hd reveal">
            <span className="hm-overline">Capabilities</span>
            <h2 className="hm-section-title">
              Everything you need to<br />optimize your application.
            </h2>
          </header>

          <div className="hm-feature-grid">
            <div className="hm-fcard reveal" style={{ transitionDelay: '0s' }}>
              <div className="hm-fcard-icon hm-icon-semantic" aria-hidden="true" />
              <h3 className="hm-fcard-title">Semantic Similarity</h3>
              <p className="hm-fcard-desc">
                Goes beyond keywords. Understands context and meaning using
                all-MiniLM-L6-v2 sentence transformer embeddings — the same
                technology that powers modern search engines.
              </p>
            </div>

            <div className="hm-fcard reveal" style={{ transitionDelay: '0.06s' }}>
              <div className="hm-fcard-icon hm-icon-gap" aria-hidden="true" />
              <h3 className="hm-fcard-title">Skill Gap Analysis</h3>
              <p className="hm-fcard-desc">
                Precisely identifies which skills are missing from your resume,
                matched against a curated database of 300+ technical skills with
                synonym normalization (Node → Node.js, Postgres → PostgreSQL).
              </p>
            </div>

            <div className="hm-fcard reveal" style={{ transitionDelay: '0.12s' }}>
              <div className="hm-fcard-icon hm-icon-section" aria-hidden="true" />
              <h3 className="hm-fcard-title">Section-Level Scoring</h3>
              <p className="hm-fcard-desc">
                Diagnoses whether your skills section is strong but your
                experience bullets are vague. Scores the Skills and Experience
                sections against the JD independently to pinpoint weak spots.
              </p>
            </div>

            <div className="hm-fcard reveal" style={{ transitionDelay: '0.18s' }}>
              <div className="hm-fcard-icon hm-icon-compare" aria-hidden="true" />
              <h3 className="hm-fcard-title">Multi-JD Comparison</h3>
              <p className="hm-fcard-desc">
                Compare up to 3 job descriptions at once and see which role
                is your strongest fit before you invest time applying.
                Ranked output with full score breakdown per JD.
              </p>
            </div>

            <div className="hm-fcard reveal" style={{ transitionDelay: '0.24s' }}>
              <div className="hm-fcard-icon hm-icon-pdf" aria-hidden="true" />
              <h3 className="hm-fcard-title">Instant PDF Parsing</h3>
              <p className="hm-fcard-desc">
                Upload any PDF resume and get clean, structured text extracted
                instantly via pdfplumber. Also accepts plain-text paste for
                quick testing — both paths produce identical analysis.
              </p>
            </div>

            <div className="hm-fcard reveal" style={{ transitionDelay: '0.30s' }}>
              <div className="hm-fcard-icon hm-icon-db" aria-hidden="true" />
              <h3 className="hm-fcard-title">Tech Skills Database</h3>
              <p className="hm-fcard-desc">
                300+ curated technical skills spanning languages, frameworks,
                databases, cloud platforms, DevOps, and ML tools. Continuously
                expandable without model retraining.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROADMAP ─────────────────────────────────────────────────────── */}
      <section className="hm-roadmap">
        <div className="hm-section-wrap">
          <header className="hm-section-hd reveal">
            <span className="hm-overline">Product Direction</span>
            <h2 className="hm-section-title">
              Built for separate accounts,
              <br />BYOK, PDF editing, and memory.
            </h2>
            <p className="hm-section-sub">
              A focused launch today, with account isolation and power-user
              controls planned for the next release cycle.
            </p>
          </header>

          <div className="hm-feature-grid hm-roadmap-grid">
            <div className="hm-fcard reveal" style={{ transitionDelay: '0s' }}>
              <div className="hm-fcard-icon hm-icon-db" aria-hidden="true" />
              <h3 className="hm-fcard-title">Separate Accounts</h3>
              <p className="hm-fcard-desc">
                Each user gets an isolated workspace, history, and saved data
                so personal resumes, notes, and settings stay private.
              </p>
            </div>

            <div className="hm-fcard reveal" style={{ transitionDelay: '0.06s' }}>
              <div className="hm-fcard-icon hm-icon-compare" aria-hidden="true" />
              <h3 className="hm-fcard-title">BYOK for Multiple LLMs</h3>
              <p className="hm-fcard-desc">
                Bring your own key and choose from multiple providers, so teams
                can keep using the model stack they already prefer.
              </p>
            </div>

            <div className="hm-fcard reveal" style={{ transitionDelay: '0.12s' }}>
              <div className="hm-fcard-icon hm-icon-section" aria-hidden="true" />
              <h3 className="hm-fcard-title">Edit PDFs</h3>
              <p className="hm-fcard-desc">
                Mark up and revise PDFs before analysis so the same workspace
                can support editing, cleanup, and optimization.
              </p>
            </div>

            <div className="hm-fcard reveal" style={{ transitionDelay: '0.18s' }}>
              <div className="hm-fcard-icon hm-icon-pdf" aria-hidden="true" />
              <h3 className="hm-fcard-title">Save up to 5 PDFs</h3>
              <p className="hm-fcard-desc">
                Keep up to five PDFs in memory for quick retrieval,
                comparison, and iterative editing without re-uploading.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPOSITE SCORE EXPLAINER ────────────────────────────────────── */}
      <section className="hm-formula">
        <div className="hm-section-wrap">
          <div className="hm-formula-card reveal">
            <div className="hm-formula-text">
              <span className="hm-overline">Scoring Model</span>
              <h2 className="hm-formula-title">A composite score that<br />actually means something.</h2>
              <p className="hm-formula-desc">
                Raw cosine similarity alone misses keyword coverage.
                Pure keyword matching misses semantic meaning.
                ResumeMatcher blends both into a single, weighted composite score
                you can trust and tune.
              </p>
            </div>
            <div className="hm-formula-visual" aria-hidden="true">
              <div className="hm-formula-row">
                <div className="hm-formula-bar">
                  <div className="hm-formula-fill" style={{ width: '60%', '--fc': 'var(--accent)' }} />
                  <span className="hm-formula-bar-lbl">Semantic similarity</span>
                  <span className="hm-formula-bar-wt">60%</span>
                </div>
              </div>
              <div className="hm-formula-row">
                <div className="hm-formula-bar">
                  <div className="hm-formula-fill" style={{ width: '40%', '--fc': 'var(--indigo)' }} />
                  <span className="hm-formula-bar-lbl">Skill keyword coverage</span>
                  <span className="hm-formula-bar-wt">40%</span>
                </div>
              </div>
              <div className="hm-formula-eq">= Composite Match Score</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TECH STACK ──────────────────────────────────────────────────── */}
      <section className="hm-stack">
        <div className="hm-section-wrap">
          <p className="hm-stack-label reveal">Built with</p>
          <div className="hm-stack-pills reveal">
            {[
              { name: 'FastAPI',                   color: '#009688' },
              { name: 'React 19',                  color: '#61dafb' },
              { name: 'all-MiniLM-L6-v2',          color: '#b8ff3d' },
              { name: 'fastembed',                 color: '#6461f5' },
              { name: 'pdfplumber',                color: '#ff8c42' },
              { name: 'sentence-transformers',     color: '#e879f9' },
              { name: 'Python 3.13',               color: '#ffd43b' },
            ].map(({ name, color }) => (
              <span key={name} className="hm-pill" style={{ '--pc': color }}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="hm-footer">
        <div className="hm-footer-inner">
          <span className="hm-footer-logo">Resume<em>Matcher</em><span className="hm-footer-dot">.</span></span>
          <span className="hm-footer-copy">FastAPI · React · all-MiniLM-L6-v2</span>
        </div>
      </footer>

    </div>
  );
}
