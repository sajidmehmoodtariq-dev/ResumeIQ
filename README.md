# ResumeMatcher

An AI-powered resume analysis platform that scores your resume against job descriptions, surfaces skill gaps, rewrites experience bullets via LLM, and exports a polished PDF — all without storing your API keys on any server.

---

## Features

### Resume Ingestion

- Upload a PDF or paste plain text; text is extracted with pdfplumber
- Save resumes to your profile and reuse them across sessions

### Match Scoring

- Composite score: 60% semantic similarity (fastembed / all-MiniLM-L6-v2) + 40% skill coverage
- Per-section scores for Skills and Experience
- Full matched / missing skill breakdown

### Multi-JD Comparison

- Rank up to 3 job descriptions against one resume in a single request
- Best-match callout with score bars and per-role skill diff

### AI Resume Enhancement (BYOK)

- Rewrites existing experience bullets to close skill gaps — never fabricates facts
- Bring your own API key; choose from OpenAI, Anthropic, Google Gemini, or Groq
- Keys live in the browser (localStorage); they are sent per-request and never stored server-side

### PDF Export

- Select the suggestions you want to accept
- Fuzzy-matches accepted bullets back to the original text (handles pdfplumber whitespace artifacts)
- Renders a clean, styled PDF with ReportLab — no external binaries required

### Authentication

- Email / password registration and login
- Google OAuth (one-tap sign-in)
- Accounts created via Google can add a password later; existing password accounts can change it
- JWT sessions (7-day expiry by default)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6 |
| Styling | Pure CSS (CSS custom properties, no framework) |
| Backend | FastAPI, Python 3.11+ |
| Database | MongoDB Atlas (pymongo) |
| Embeddings | fastembed — ONNX-based, no PyTorch dependency |
| LLM routing | stdlib `urllib` — zero extra HTTP dependencies |
| PDF generation | ReportLab Platypus |
| Fuzzy matching | rapidfuzz |
| Auth | python-jose (JWT), passlib (bcrypt), Google OAuth2 |

---

## Architecture

``` bash
browser
  ├── React SPA (Vite)
  │     ├── AuthContext  — JWT + user state
  │     ├── App.jsx      — main tool (resume → JD → results → PDF)
  │     └── Profile.jsx  — saved resumes, BYOK key management, password settings
  │
  └── FastAPI (uvicorn)
        ├── /api/auth/*          — register, login, Google OAuth, set/change password
        ├── /api/profile/*       — saved resumes CRUD, /me
        ├── /api/resume/upload   — PDF extraction + text normalisation
        ├── /api/score           — semantic + skill-coverage scoring
        ├── /api/compare-jobs    — multi-JD ranking
        ├── /api/feedback        — LLM bullet rewriting (BYOK, key in request body)
        └── /api/generate-pdf    — fuzzy replace + ReportLab PDF render
```

LLM API keys flow exclusively from the browser → request body → LLM provider. The backend never reads them from environment variables and never persists them.

---

## Project Structure

``` bash
Resume/
├── backend/
│   ├── main.py            # FastAPI app, all /api/* endpoints
│   ├── auth.py            # JWT auth, Google OAuth, password management
│   ├── profile.py         # Saved resume CRUD, /api/profile/*
│   ├── llm_feedback.py    # BYOK LLM dispatch (OpenAI / Anthropic / Gemini / Groq)
│   ├── pdf_generator.py   # fuzzy_replace + ReportLab PDF renderer
│   ├── extractor.py       # Skill gap extraction
│   ├── sections.py        # Section header detection regex
│   ├── skills.py          # Canonical skill list
│   ├── config.py          # Env var loading, scoring weights
│   ├── db.py              # MongoDB connection + index setup
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Core tool page
    │   ├── App.css
    │   ├── main.jsx             # Router + AuthProvider setup
    │   ├── context/
    │   │   └── AuthContext.jsx  # useAuth() hook
    │   ├── components/
    │   │   ├── ProtectedRoute.jsx       # Redirects to /login if unauthenticated
    │   │   ├── ProtectedAuthRoute.jsx   # Redirects to /app if already authed
    │   │   └── GoogleAuthButton.jsx
    │   └── pages/
    │       ├── Home.jsx    # Landing page
    │       ├── Login.jsx
    │       ├── Signup.jsx
    │       └── Profile.jsx # Saved resumes + BYOK key vault + password settings
    ├── package.json
    └── vite.config.js
```

---

## Getting Started

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

JWT_SECRET_KEY=<generate-a-long-random-secret>

GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
```

Start the server:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs at `/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` and proxies `/api/*` to the backend (see `vite.config.js`).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB_NAME` | Yes | Database name |
| `JWT_SECRET_KEY` | Yes | Secret used to sign JWTs — use a long random string |
| `JWT_EXPIRES_MINUTES` | No | Token lifetime in minutes (default: `10080` = 7 days) |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 client ID from Google Cloud Console |

> LLM API keys (OpenAI, Anthropic, Gemini, Groq) are **not** environment variables. Users supply their own keys through the Profile page; keys are stored in browser localStorage and sent per-request.

---

## API Reference

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account with email + password |
| `POST` | `/api/auth/login` | Email / password login |
| `POST` | `/api/auth/google` | Google ID token → JWT |
| `GET` | `/api/auth/me` | Current user (requires Bearer token) |
| `POST` | `/api/auth/set-password` | Add password to a Google-only account |
| `POST` | `/api/auth/change-password` | Update existing password |

### Resume

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/resume/upload` | Upload PDF or submit pasted text |
| `POST` | `/api/score` | Score resume against one JD |
| `POST` | `/api/compare-jobs` | Rank resume against up to 3 JDs |
| `POST` | `/api/feedback` | Generate LLM bullet rewrites (BYOK) |
| `POST` | `/api/generate-pdf` | Apply accepted suggestions, return PDF |

### Profile

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/profile/resumes` | List saved resumes |
| `POST` | `/api/profile/resumes` | Save a new resume |
| `GET` | `/api/profile/resumes/{id}/text` | Retrieve extracted text of a saved resume |
| `DELETE` | `/api/profile/resumes/{id}` | Delete a saved resume |

---

## Scoring Model

The composite match score is a weighted sum of two signals:

``` bash
score = semantic_score × 0.60 + skill_coverage × 0.40
```

| Signal | Method |
|---|---|
| **Semantic similarity** | Cosine similarity of full-resume and JD embeddings (fastembed, all-MiniLM-L6-v2) |
| **Skill coverage** | `matched_skills / (matched_skills + missing_skills)` from keyword extraction |

Section-level scores (Skills section vs JD, Experience section vs JD) are computed separately and shown as informational metrics.

---

## BYOK — Bring Your Own Key

Users add their LLM API keys once in Profile → API Keys. Keys are stored in browser `localStorage` under the key `rm_byok`:

```json
{
  "openai":    { "key": "sk-...", "model": "gpt-4o-mini" },
  "anthropic": { "key": "sk-ant-...", "model": "claude-sonnet-4-6" },
  "google":    { "key": "AIza...", "model": "gemini-2.0-flash" },
  "groq":      { "key": "gsk_...", "model": "llama-3.1-70b-versatile" }
}
```

When the user requests AI enhancement, the frontend reads the active provider's key and passes it in the request body. The backend uses it only for the duration of that call.

### Supported Providers and Models

| Provider | Models |
|---|---|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` |
| Anthropic | `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| Google Gemini | `gemini-2.0-flash`, `gemini-flash-latest`, `gemini-1.5-pro`, `gemini-1.5-flash` |
| Groq | `llama-3.1-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768` |

---

## PDF Generation

The PDF pipeline runs entirely on the server using pure-Python libraries:

1. **Fuzzy replace** — `rapidfuzz.process.extractOne` (fuzz.ratio, threshold 72%) locates each accepted bullet in the original extracted text, tolerating pdfplumber whitespace artifacts and unicode dash variants.
2. **Render** — ReportLab Platypus rebuilds the document from scratch: contact header, section dividers, job title / meta / bullet classification heuristics.

No Chromium, no GTK, no WeasyPrint — the backend runs on any platform where Python runs.

---

## Deployment

### Frontend — Vercel

```bash
cd frontend
npm run build
# Deploy the dist/ directory, or connect the repo to Vercel
```

Set the `VITE_API_URL` environment variable if the backend is on a different domain, and update `vite.config.js` accordingly.

### Backend — Render / Railway / Fly.io

The backend has no heavy ML dependencies (fastembed uses ONNX, not PyTorch), so it comfortably fits within free-tier RAM limits.

1. Point the platform to the `backend/` directory.
2. Set the start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add the environment variables from the table above.
4. The fastembed model downloads to `.fastembed_cache/` on first use; mount a persistent disk or accept the cold-start download.

> **Note:** The frontend `vercel.json` already rewrites `/api/*` to the backend URL. Update the rewrite destination to your deployed backend hostname before deploying to production.

---

## Security Notes

- Passwords are hashed with bcrypt via passlib; plaintext passwords are never stored or logged.
- JWTs are signed with HS256. Rotate `JWT_SECRET_KEY` to invalidate all existing sessions.
- Google ID tokens are verified server-side using `google-auth` before any user record is created or updated.
- LLM API keys never touch the server's filesystem, database, or logs.
- CORS is currently set to `allow_origins=["*"]` for development. Restrict this to your frontend domain before going to production.

---

## License

MIT
