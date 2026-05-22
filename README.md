# AI Resume Enhancer

An intelligent tool to analyze your resume against a job description, identify missing skills using NLP (`sentence-transformers`), and rewrite your experience bullet points using LLMs (Google Gemini / OpenAI). 

## Architecture

This project is decoupled into two parts:

- **Frontend:** React + Vite
- **Backend:** FastAPI, Python

## Getting Started

### Prerequisites

- Node.js
- Python 3.10+

### Backend Setup

1. `cd backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4. Install dependencies: `pip install -r requirements.txt`
5. Create a `.env` file based on your chosen LLM (e.g. `LLM_PROVIDER=gemini` and `GEMINI_API_KEY=your_key`).
6. Run the server: `uvicorn main:app --reload`

### Frontend Setup

1. `cd frontend`
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

## Deployment

- **Frontend:** You can deploy the `frontend` directory to Vercel (using the included `vercel.json`).
- **Backend:** You can deploy the `backend` directory to Render, Heroku, or Railway. 

  **Crucial Render Settings:**
  - **Build Command:** `pip install -r requirements.txt`
  - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - **Environment Variables:** Add `PYTHON_VERSION=3.11.9`, `LLM_PROVIDER=gemini`, and your `GEMINI_API_KEY`.

Be aware that Serverless environments like Vercel Functions have a hard cap on size (250MB), which PyTorch (used by `sentence-transformers`) exceeds.
