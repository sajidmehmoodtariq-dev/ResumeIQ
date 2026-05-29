# ResumeMatcher

An AI-powered career toolkit that scores your resume against job descriptions, builds polished resumes from scratch, imports existing PDFs to pre-fill the builder, rewrites any section in place with Gemini, generates tailored cover letters, and exports professional PDFs — all with your own LLM keys and zero server-side key storage.

---

## Table of Contents

- [What Is This?](#what-is-this)
- [Quick Start](#quick-start)
- [Features](#features)
  - [1. Resume Analyzer](#1-resume-analyzer)
  - [2. Resume Builder](#2-resume-builder)
  - [3. Import from Existing PDF](#3-import-from-existing-pdf)
  - [4. Rewrite with Gemini](#4-rewrite-with-gemini)
  - [5. AI Enhancement](#5-ai-enhancement)
  - [6. Cover Letter Generator](#6-cover-letter-generator)
  - [7. PDF Export](#7-pdf-export)
  - [8. Authentication and Profiles](#8-authentication-and-profiles)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Scoring Model](#scoring-model)
- [BYOK — Bring Your Own Key](#byok--bring-your-own-key)
- [PDF Templates](#pdf-templates)
- [Resume Builder Data Model](#resume-builder-data-model)
- [Deployment](#deployment)
- [Security Notes](#security-notes)
- [License](#license)

---

## What Is This?

**For job seekers (non-technical):** ResumeMatcher is a web app that acts like an AI career coach. You paste your resume and a job listing, and it tells you how well they match — with a score, a list of skills you're missing, and AI-written suggestions to improve your resume bullets. You can also build a brand new resume from scratch using a step-by-step form, write a cover letter for any job in seconds, and download a clean, formatted PDF.

**For developers:** A FastAPI + React SPA with a modular backend (`routers/` + `services/`), ONNX-based semantic embeddings via fastembed, multi-provider LLM routing to OpenAI / Anthropic / Gemini / Groq using only stdlib `urllib`, and a ReportLab PDF renderer. LLM keys are never stored server-side — they flow exclusively from browser `localStorage` → request body → LLM provider per call.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A MongoDB Atlas cluster (or local MongoDB)
- A Google Cloud project with OAuth 2.0 credentials (for Google sign-in)

### 1. Clone

```bash
git clone https://github.com/sajidmehmoodtariq-dev/resume-matcher.git
cd resume-matcher
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net
MONGO_DB_NAME=resumeIQ
JWT_SECRET_KEY=<generate-a-long-random-string>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
```

Start the API server:

```bash
uvicorn main:app --reload
# Interactive API docs: http://localhost:8000/docs
```

> **First run:** fastembed downloads the `all-MiniLM-L6-v2` ONNX model (~23 MB) to `.fastembed_cache/` on the first scoring request. Subsequent calls use the cache.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

The Vite dev server proxies all `/api/*` requests to the backend automatically.

### 4. Add your LLM key

Navigate to **Profile → API Keys**, add a key for any supported provider (OpenAI, Anthropic, Google Gemini, or Groq), and pick a model. This unlocks AI Enhancement and Cover Letter generation.

---

## Features

### 1. Resume Analyzer

The main tool, available at `/app`.

**How to use it:**

1. Provide your resume — upload a PDF, paste plain text, or load a previously saved resume from your profile.
2. Paste a job description and click **Analyze Match**.
3. Review your composite score, skill breakdown, and section scores.

**What you get:**

- Composite match score (0–100)
- Semantic similarity percentage — how closely the language of your resume matches the JD
- Skill coverage percentage — how many of the JD's required skills appear in your resume
- Per-section scores for Skills and Experience
- Full list of matched skills (green) and missing skills (red/orange)

**Multi-JD Comparison:** Switch to "Compare 3 Jobs" mode to rank up to three job descriptions against your resume simultaneously. Each role gets a score bar and a per-role skill diff.

---

### 2. Resume Builder

A guided multi-step form at `/build` for building a resume from scratch — no PDF needed.

**Steps:**

| Step | What you fill in |
| --- | --- |
| 1. Personal | Name, email, phone, location, LinkedIn, website |
| 2. Summary | 2–4 sentence professional summary |
| 3. Experience | Roles with company, dates, location, and bullet points |
| 4. Education | Degrees with institution, dates, GPA, honors |
| 5. Skills | Tag input — press Enter or comma to add; backspace to remove last |
| 6. Projects | Project name, URL, dates, and description bullets |
| 7. Certifications | Certificate name, issuer, date |
| 8. Finalize | Reorder sections with up/down arrows; download draft PDF or proceed to analysis |

**Key behaviors:**

- **Auto-save:** The form saves to `localStorage` continuously. Refresh the page — your data is still there.
- **Section ordering:** The order you set on the Finalize step is the order sections appear in your PDF.
- **Draft PDF:** Click "Download Draft PDF" on the Finalize step to get a PDF immediately without any AI step.
- **Analysis mode:** Click "Analyze Against a Job Description" to run the same scoring and AI enhancement pipeline as the upload path. The form data is serialized to plain text internally — the backend sees no difference.

---

### 3. Import from Existing PDF

Available inside the Resume Builder at `/build`.

**How it works:**

1. Click **Import from existing resume PDF** above the step indicator.
2. Choose your current resume PDF.
3. Select your AI provider (any BYOK key — OpenAI, Anthropic, Gemini, or Groq).
4. Click **Parse & Pre-fill**.
5. The backend extracts the PDF text via pdfplumber, sends it to your LLM with a structured schema prompt, and drops every extracted field into the corresponding form step.
6. Review and edit the pre-filled data, then continue normally.

**What you get:**

- All fields pre-filled — no manual re-typing of your existing resume
- Each section is fully editable after import
- Useful for refreshing an old resume: import → rewrite with Gemini → export new PDF

**Error handling:** If the PDF contains only scanned images (no selectable text), the endpoint returns a clear error message. Only text-layer PDFs work.

---

### 4. Rewrite with Gemini

Available at **Summary (step 2)**, **Experience (step 3)**, **Skills (step 5)**, **Projects (step 6)**, and **Finalize (step 8 — full resume)** inside the Resume Builder.

**How it works:**

1. Look for the **✦ Rewrite with Gemini** button in the top-right corner of the step card.
2. Click it to expand the rewrite panel.
3. Type your instruction — e.g. *"Make the bullets more quantified and impact-focused"* or *"Rewrite for a product manager role"*.
4. Press **Apply** (or **⌘↵**).
5. Gemini rewrites the section and updates the form in place.
6. All entries remain fully editable after the rewrite.

**Target mapping:**

| Step | What gets rewritten |
| --- | --- |
| Summary | The summary paragraph |
| Experience | All experience entries and their bullets |
| Skills | The skills list |
| Projects | All project entries and their bullets |
| Finalize | The entire resume JSON |

**Context sent to Gemini:** The full resume (serialized to plain text) is always included as context, even when rewriting a single section — so Gemini keeps tone, facts, and framing consistent.

**Key:** Uses your Google Gemini BYOK key. Add it in Profile → API Keys. Never stored server-side.

---

### 5. AI Enhancement

Available after scoring your resume against a JD (in both the Analyzer and Builder flows).

**How it works:**

1. Select your LLM provider (provider chips show which keys you have configured).
2. Click **Enhance Resume**.
3. The LLM receives your resume text, the job description, and your skill gap data. It returns up to 5 bullet rewrite suggestions.
4. Each suggestion shows: the original bullet, the AI-rewritten bullet, the target skill, the JD alignment reason, and the "why" explanation.
5. Check the suggestions you want to accept. Uncheck to keep the original.
6. Pick a PDF template.
7. Click **Download Updated Resume** to apply your selections and download the PDF.

No suggestion touches your document until you explicitly check it and download.

---

### 6. Cover Letter Generator

Appears as a separate card below AI Enhancement whenever a score result is present.

**How it works:**

1. Select your LLM provider (same BYOK keys).
2. Click **Generate Cover Letter**.
3. The LLM writes a ~350-word tailored letter using your resume as the source of facts and the job description as the target.
4. The letter appears in a full editable textarea — revise it freely (fix the date, add the hiring manager's name, tweak the tone).
5. Download as `.txt` for pasting into an application portal, or as a formatted `.pdf`.

**Letter structure the LLM is prompted to follow:**

- Today's date
- Salutation (Dear Hiring Manager, or the name if found in the JD)
- Opening paragraph — express interest and state your value proposition
- Two body paragraphs — specific experience from your resume connected to JD requirements
- Closing paragraph — call to action and sign-off
- Your name from the resume

---

### 7. PDF Export

Three templates with different aesthetic and ATS compatibility profiles:

| Template | ATS Rating | Layout |
| --- | --- | --- |
| **Classic** | ATS Safe | Single column, Georgia serif, horizontal section dividers |
| **Modern** | ATS Friendly | Single column, navy accent header band, arrow bullets |
| **Creative** | Design Forward | Two-column flexbox — sidebar for skills/summary, main column for experience |

The Classic and Modern templates use a single reading column, which ATS parsers can traverse top-to-bottom without column-order confusion. Use Creative when applying to roles where a human reads your resume before any ATS sees it.

**PDF pipeline (resume):**

1. Accepted bullet substitutions are fuzzy-matched back into the original text (rapidfuzz, 72% threshold) — this handles pdfplumber whitespace artifacts and unicode dash variants.
2. The mutated text is re-parsed into structured sections (header, contact info, section titles, subheadings, meta lines, and bullets).
3. ReportLab Platypus renders the document using the chosen template's styles and fonts.

**PDF pipeline (cover letter):** Plain paragraphs split on double newlines, rendered at 11pt Helvetica, 1.8 line height, 1" margins.

Both paths return `{ "pdf_b64": "<base64>" }` — the frontend decodes with `atob()` and triggers a browser download without touching a file server.

---

### 8. Authentication and Profiles

- Email / password registration (bcrypt hashed, never stored plaintext)
- Google OAuth one-tap sign-in
- Accounts created via Google can add a password later
- JWT sessions (7-day expiry by default; configurable via `JWT_EXPIRES_MINUTES`)
- **Saved resumes:** Upload or paste a resume once, save it to your profile, and load it in future sessions from a dropdown.
- **API key vault:** Profile → API Keys to add/update/remove keys per provider. Keys are stored only in your browser.

---

## Tech Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Frontend | React 18, Vite, React Router v6 | Zero component libraries; pure CSS |
| Styling | CSS custom properties | Dark theme; Fraunces + Outfit + DM Mono fonts |
| Backend | FastAPI, Python 3.11+ | Modular: `routers/` + `services/` |
| Database | MongoDB Atlas (pymongo) | Users + saved resumes |
| Embeddings | fastembed — all-MiniLM-L6-v2, ONNX | No PyTorch; ~23 MB model on first use |
| LLM routing | stdlib `urllib` only | No SDKs; raw HTTP to OpenAI / Anthropic / Gemini / Groq |
| PDF rendering | ReportLab Platypus | Pure Python; no Chromium or GTK |
| Fuzzy matching | rapidfuzz | Bullet substitution with whitespace tolerance |
| Auth | python-jose (JWT), passlib (bcrypt), google-auth | |
| Form state | React `useState` + `localStorage` | Resume Builder draft persistence |

---

## Architecture

``` bash
Browser (React SPA — Vite)
  │
  ├── /            Home.jsx          Landing page
  ├── /login       Login.jsx
  ├── /signup      Signup.jsx
  ├── /app         App.jsx           Resume Analyzer
  │                                    Upload / paste / load saved resume
  │                                    → score → AI enhancement → cover letter → PDF
  ├── /build       BuildResume.jsx   Resume Builder
  │                                    8-step form → draft PDF  -or-
  │                                    → score → AI enhancement → cover letter → PDF
  └── /profile     Profile.jsx       Saved resumes · BYOK key vault · password settings

  │  /api/*  (Vite proxy in dev · nginx / CDN rewrite in prod)

FastAPI (uvicorn)
  ├── routers/resume.py        POST /api/resume/upload
  │                            POST /api/score
  │                            POST /api/compare-jobs
  ├── routers/feedback.py      POST /api/feedback
  ├── routers/pdf.py           GET  /api/templates
  │                            POST /api/generate-pdf
  ├── routers/cover_letter.py  POST /api/cover-letter
  │                            POST /api/cover-letter-pdf
  ├── routers/builder.py       POST /api/parse-resume
  │                            POST /api/rewrite-section
  ├── auth.py                  POST /api/auth/*
  └── profile.py               GET · POST · DELETE /api/profile/*

  └── services/scorer.py       fastembed model singleton + cosine scoring
      llm_feedback.py          BYOK multi-provider LLM dispatch
                                 generate_resume_feedback() · generate_cover_letter()
                                 parse_resume_to_json()     · rewrite_with_gemini()
      pdf_generator.py         ReportLab renderer (3 resume templates + cover letter)
      extractor.py             Skill keyword extraction
      db.py                    MongoDB connection + indexes

BYOK key flow (keys never stored server-side):
  localStorage (rm_byok)  →  request body  →  backend  →  LLM provider  →  response
```

---

## Project Structure

``` bash
resume-matcher/
├── backend/
│   ├── main.py                # FastAPI app factory, middleware, router registration
│   ├── auth.py                # JWT auth, Google OAuth, password management
│   ├── profile.py             # Saved resume CRUD — /api/profile/*
│   ├── llm_feedback.py        # BYOK multi-provider LLM dispatch
│   │                          #   generate_resume_feedback() — bullet rewrites
│   │                          #   generate_cover_letter()    — cover letter
│   ├── pdf_generator.py       # ReportLab renderer
│   │                          #   generate_resume_pdf()        — 3 templates
│   │                          #   generate_cover_letter_pdf()  — plain-text layout
│   │                          #   apply_substitutions()        — fuzzy bullet replace
│   ├── extractor.py           # Skill keyword extraction (regex + alias map)
│   ├── sections.py            # Section header detection
│   ├── skills.py              # Canonical skill list
│   ├── config.py              # Scoring weights
│   ├── db.py                  # MongoDB connection + index setup
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── resume.py          # /api/resume/upload · /api/score · /api/compare-jobs
│   │   ├── feedback.py        # /api/feedback
│   │   ├── pdf.py             # /api/generate-pdf · /api/templates
│   │   ├── cover_letter.py    # /api/cover-letter · /api/cover-letter-pdf
│   │   └── builder.py         # /api/parse-resume · /api/rewrite-section
│   ├── services/
│   │   ├── __init__.py
│   │   └── scorer.py          # fastembed model singleton + scoring logic
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Resume Analyzer page (/app)
    │   ├── App.css              # Global design system (CSS custom properties)
    │   ├── main.jsx             # BrowserRouter · Routes · AuthProvider
    │   ├── constants.js         # PROVIDER_DEFS · TEMPLATE_DEFS · getBYOK()
    │   ├── context/
    │   │   └── AuthContext.jsx  # JWT + user state via useAuth() hook
    │   ├── utils/
    │   │   └── resumeJson.js    # JSON ↔ plain-text serialization
    │   │                        # emptyResume · saveDraft · loadDraft
    │   │                        # jsonToText · findBulletLocation
    │   ├── components/
    │   │   ├── app/
    │   │   │   ├── ResumeInput.jsx    # Upload / paste / saved resume tabs
    │   │   │   ├── JobDescription.jsx # Single JD · multi-JD comparison
    │   │   │   ├── ScoreResults.jsx   # Score ring · skill pills · section scores
    │   │   │   ├── AIEnhancement.jsx  # Suggestion cards · template picker · download
    │   │   │   └── CoverLetter.jsx    # Cover letter editor · copy · download
    │   │   ├── builder/
    │   │   │   ├── StepPersonal.jsx
    │   │   │   ├── StepSummary.jsx
    │   │   │   ├── StepExperience.jsx
    │   │   │   ├── StepEducation.jsx
    │   │   │   ├── StepSkills.jsx     # Tag input (Enter / comma to add)
    │   │   │   ├── StepProjects.jsx
    │   │   │   ├── StepCertifications.jsx
    │   │   │   ├── SectionOrder.jsx   # Up/down reorder · direct PDF download
    │   │   │   └── RewritePanel.jsx   # Gemini rewrite panel (Summary/Experience/Skills/Projects/Full)
    │   │   ├── GoogleAuthButton.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   └── ProtectedAuthRoute.jsx
    │   └── pages/
    │       ├── Home.jsx
    │       ├── Login.jsx
    │       ├── Signup.jsx
    │       ├── Profile.jsx
    │       ├── BuildResume.jsx    # Resume Builder page (/build)
    │       └── BuildResume.css
    ├── package.json
    └── vite.config.js
```

---

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string (Atlas or local `mongodb://localhost`) |
| `MONGO_DB_NAME` | Yes | Database name — e.g. `resumeIQ` |
| `JWT_SECRET_KEY` | Yes | Signs JWTs — use a long random string; rotate to invalidate all sessions |
| `JWT_EXPIRES_MINUTES` | No | Token lifetime in minutes (default: `10080` = 7 days) |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 client ID from Google Cloud Console |

LLM API keys (OpenAI, Anthropic, Gemini, Groq) are **not** environment variables. Users supply their own keys through the Profile page.

---

## API Reference

### Auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account with email + password |
| `POST` | `/api/auth/login` | Email / password login — returns JWT |
| `POST` | `/api/auth/google` | Verify Google ID token, return JWT |
| `GET` | `/api/auth/me` | Current user info (Bearer token required) |
| `POST` | `/api/auth/set-password` | Add a password to a Google-only account |
| `POST` | `/api/auth/change-password` | Update existing password (current password required) |

### Resume and Scoring

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/resume/upload` | Upload PDF (`multipart/form-data`, field `file`) or paste text (field `text`) |
| `POST` | `/api/score` | Score resume text against one JD |
| `POST` | `/api/compare-jobs` | Rank one resume against up to 3 JDs |
| `POST` | `/api/feedback` | Generate LLM bullet rewrites (BYOK — key sent in body, never stored) |

**`POST /api/score` body:**

```json
{
  "resume_text": "...",
  "jd_text": "..."
}
```

**`POST /api/feedback` body:**

```json
{
  "resume_text": "...",
  "jd_text": "...",
  "skill_gap": {
    "resume_skills": ["Python", "React"],
    "matched_skills": ["Python"],
    "missing_skills": ["Docker", "Kubernetes"]
  },
  "provider": "openai",
  "model": "gpt-4o-mini",
  "api_key": "sk-..."
}
```

### PDF

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/templates` | List available templates with metadata (name, ATS flag, badge, description) |
| `POST` | `/api/generate-pdf` | Apply accepted bullet substitutions and render a resume PDF |

**`POST /api/generate-pdf` body:**

```json
{
  "resume_text": "...",
  "accepted_substitutions": [
    { "original_bullet": "...", "rewritten_bullet": "..." }
  ],
  "template": "classic"
}
```

`accepted_substitutions` may be an empty array `[]` — the resume is then rendered as-is. This is how the Resume Builder's "Download Draft PDF" button works.

**Response:** `{ "pdf_b64": "<base64-encoded PDF bytes>" }`

### Builder

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/parse-resume` | Upload a PDF (`multipart/form-data`) + BYOK fields; returns structured resume JSON for pre-filling the builder form |
| `POST` | `/api/rewrite-section` | Rewrite a resume section in place using Gemini (BYOK) |

**`POST /api/parse-resume` form fields:** `file` (PDF), `provider`, `model`, `api_key`

**Response:** Resume JSON object matching the builder data model (see [Resume Builder Data Model](#resume-builder-data-model)).

**`POST /api/rewrite-section` body:**

```json
{
  "target": "summary",
  "current_data": { "summary": "..." },
  "full_context": "full resume as plain text",
  "instruction": "Make it more concise and impactful for a senior engineering role",
  "api_key": "AIza...",
  "model": "gemini-2.0-flash"
}
```

`target` must be one of: `summary` · `experience` · `skills` · `projects` · `full`

**Response:** JSON object containing only the rewritten section, e.g. `{ "summary": "..." }` or `{ "experience": [...] }`.

---

### Cover Letter

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/cover-letter` | Generate a cover letter from resume text + JD using BYOK LLM |
| `POST` | `/api/cover-letter-pdf` | Render a cover letter string as a downloadable PDF |

**`POST /api/cover-letter` body:**

```json
{
  "resume_text": "...",
  "jd_text": "...",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "api_key": "sk-ant-..."
}
```

**Response:** `{ "cover_letter": "..." }` — plain text ready for display in an editable field.

**`POST /api/cover-letter-pdf` body:**

```json
{ "cover_letter": "..." }
```

**Response:** `{ "pdf_b64": "<base64-encoded PDF bytes>" }`

### Profile

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/profile/resumes` | Required | List saved resumes |
| `POST` | `/api/profile/resumes` | Required | Save a new resume |
| `GET` | `/api/profile/resumes/{id}/text` | Required | Retrieve extracted text of a saved resume |
| `DELETE` | `/api/profile/resumes/{id}` | Required | Delete a saved resume |

---

## Scoring Model

The composite match score is a weighted sum of two independent signals:

``` bash
score = semantic_score × 0.60 + skill_coverage × 0.40
```

| Signal | How it is computed | Weight |
| --- | --- | --- |
| **Semantic similarity** | Cosine similarity between full-resume and full-JD ONNX embeddings | 60% |
| **Skill coverage** | `matched_skills / (matched_skills + missing_skills)` from regex keyword extraction | 40% |

Skills are extracted from both documents using a regex pattern built from a canonical skill list (`skills.py`) with alias matching. Word-boundary matching prevents false positives (e.g. "go" matching inside "Django").

Section-level scores for the Skills section and Experience section are computed as supplementary metrics (cosine similarity of the extracted section text against the full JD) and are shown as informational breakdown — they do not affect the headline composite score.

---

## BYOK — Bring Your Own Key

No LLM API keys are stored server-side. The data flow is:

``` bash
Profile page  →  localStorage (rm_byok)  →  request body  →  backend (used once, not stored)  →  LLM provider
```

Keys are stored in browser `localStorage` under `rm_byok`:

```json
{
  "openai":    { "key": "sk-...",      "model": "gpt-4o-mini" },
  "anthropic": { "key": "sk-ant-...", "model": "claude-sonnet-4-6" },
  "google":    { "key": "AIza...",    "model": "gemini-2.0-flash" },
  "groq":      { "key": "gsk_...",    "model": "llama-3.1-70b-versatile" }
}
```

The `getBYOK()` helper in `constants.js` reads this object. On any AI request, the frontend passes the key in the JSON body. The backend routes the request to the correct provider and discards the key after the response.

BYOK is used for **AI Resume Enhancement** (`/api/feedback`), **Cover Letter generation** (`/api/cover-letter`), **Import from PDF** (`/api/parse-resume`), and **Rewrite with Gemini** (`/api/rewrite-section`). The rewrite endpoint is Gemini-only; all other AI features support all four providers.

### Supported Providers and Models

| Provider | Available Models |
| --- | --- |
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` |
| Anthropic | `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| Google Gemini | `gemini-2.0-flash`, `gemini-flash-latest`, `gemini-1.5-pro`, `gemini-1.5-flash` |
| Groq | `llama-3.1-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768` |

---

## PDF Templates

Three templates are available, each with a different aesthetic and ATS compatibility profile:

| Template | ATS | Layout | Best for |
| --- | --- | --- | --- |
| **Classic** | Safe | Single column, Georgia serif, horizontal dividers | Any role — maximum ATS parser compatibility |
| **Modern** | Friendly | Single column, navy header band, directional bullets | Tech and product roles — contemporary look, ATS-clean |
| **Creative** | Design Forward | Two-column — sidebar for skills/summary, main column for experience | Design, marketing, creative roles |

"ATS Safe" and "ATS Friendly" templates use a linear single-column layout that ATS parsers read top-to-bottom without column-order errors. The Creative template sacrifices some ATS compatibility for visual impact — use it when a human reviews your resume first.

---

## Resume Builder Data Model

The Resume Builder maintains a structured JSON object in React state, auto-saved to `localStorage` on every keystroke:

```json
{
  "meta": {
    "sectionOrder": ["experience", "education", "skills", "projects", "certifications"]
  },
  "personal": {
    "name": "", "email": "", "phone": "",
    "location": "", "linkedin": "", "website": ""
  },
  "summary": "...",
  "experience": [
    {
      "id": "<uuid>",
      "company": "Acme Corp",
      "role": "Senior Software Engineer",
      "location": "New York, NY",
      "startDate": "Jan 2022",
      "endDate": "Present",
      "bullets": [
        "Reduced API latency by 40% by migrating to async processing",
        "Led a team of 5 engineers across 3 time zones"
      ]
    }
  ],
  "education": [
    { "id": "<uuid>", "institution": "MIT", "degree": "B.S. CS", "graduationDate": "May 2020", "gpa": "3.8", "honors": "" }
  ],
  "skills": ["Python", "React", "AWS", "PostgreSQL"],
  "projects": [
    { "id": "<uuid>", "name": "ResumeMatcher", "url": "github.com/...", "dates": "2024", "bullets": ["..."] }
  ],
  "certifications": [
    { "id": "<uuid>", "name": "AWS Solutions Architect", "issuer": "Amazon", "date": "2023" }
  ]
}
```

**`meta.sectionOrder`** controls the order sections appear in the PDF. Reordering via the up/down arrows on the Finalize step directly mutates this array.

**`jsonToText()`** (`frontend/src/utils/resumeJson.js`) serializes the JSON to a plain-text string identical in structure to what `pdfplumber` would extract from an uploaded PDF. This lets the form path reuse every existing backend endpoint without modification.

---

## Deployment

### Frontend — Vercel

```bash
cd frontend
npm run build
# Deploy the dist/ directory, or connect the repo via Vercel Git integration
```

Set `VITE_API_URL` if the backend is on a different domain, and update the proxy target in `vite.config.js`.

### Backend — Render / Railway / Fly.io

The backend has no PyTorch or Chromium dependencies, so it fits within free-tier RAM limits (fastembed is ONNX-only; ReportLab is pure Python).

```bash
# Start command
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Set the five environment variables from the table above. Mount a persistent disk at `.fastembed_cache/` to avoid re-downloading the embedding model on each deploy (or accept a ~5 second cold-start download).

> The `vercel.json` in the repository already rewrites `/api/*` to the backend URL. Update the rewrite destination to your deployed backend hostname before going to production.

---

## Security Notes

- Passwords are hashed with bcrypt via passlib. Plaintext passwords are never stored or logged anywhere.
- JWTs are signed with HS256. Rotate `JWT_SECRET_KEY` to immediately invalidate all existing sessions.
- Google ID tokens are verified server-side with `google-auth` before any user record is created or updated.
- LLM API keys travel from the browser to the backend in the HTTPS request body and are never written to a database, file, environment variable, or application log.
- `CORS` is currently `allow_origins=["*"]`. Restrict this to your frontend domain (`https://your-app.vercel.app`) before going to production.
- MongoDB credentials belong only in the `.env` file. Do not commit `.env` to version control.

---

## License

MIT
