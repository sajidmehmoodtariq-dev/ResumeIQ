import io
import os
import numpy as np
import pdfplumber
from dotenv import load_dotenv
import requests
from config import WEIGHTS
from extractor import skill_gap
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llm_feedback import generate_resume_feedback
from sections import extract_sections

load_dotenv()

app = FastAPI(title="Resume API")


def get_embedding(text: str) -> np.ndarray:
    """Gets embeddings via Gemini API to save local RAM."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")
    
    # Using the same model family already configured
    url = f"https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key={api_key}"
    
    payload = {
        "model": "models/embedding-001",
        "content": {"parts": [{"text": text or " "}]}
    }
    
    try:
        res = requests.post(url, json=payload, timeout=10)
        res.raise_for_status()
        return np.array(res.json()["embedding"]["values"], dtype=np.float32)
    except Exception as e:
        print(f"Embedding error: {e}")
        # Return a zero vector as fallback if API fails
        return np.zeros(768, dtype=np.float32)


@app.on_event("startup")
def startup_event():
    print("Backend started in API-only mode (Low RAM).")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Backend is running"}


def _extract_text_from_pdf(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


def _clamp(v: float) -> float:
    return round(max(0.0, min(1.0, v)) * 100, 1)


@app.post("/api/resume/upload")
async def upload_resume(file: UploadFile = File(None), text: str = Form(None)):
    if file is not None:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")
        raw = await file.read()
        resume_text = _extract_text_from_pdf(raw)
        source = "pdf"
    elif text is not None and text.strip():
        resume_text = text.strip()
        source = "paste"
    else:
        raise HTTPException(status_code=400, detail="Provide a PDF file or pasted text")

    return {"source": source, "text": resume_text}


class ScoreRequest(BaseModel):
    resume_text: str
    jd_text: str


class SkillGapRequest(BaseModel):
    resume_skills: list[str]
    matched_skills: list[str]
    missing_skills: list[str]


class FeedbackRequest(BaseModel):
    resume_text: str
    jd_text: str
    skill_gap: SkillGapRequest


@app.post("/api/score")
def score_resume(body: ScoreRequest):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is empty")
    if not body.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is empty")

    # ── Build batch of texts to embed ─────────────────────────────────────────
    labels = ["resume", "jd"]
    detected = extract_sections(body.resume_text)
    for section_key in ("skills", "experience"):
        if section_key in detected:
            labels.append(f"section_{section_key}")

    # Map labels to their respective texts for easier processing
    text_map = {
        "resume": body.resume_text,
        "jd": body.jd_text,
        "section_skills": detected.get("skills", ""),
        "section_experience": detected.get("experience", "")
    }

    # Use Gemini API to get embeddings for each required piece
    emb = {}
    for label in labels:
        emb[label] = get_embedding(text_map[label])

    # ── Semantic similarity (full resume vs JD) ───────────────────────────────
    semantic_score = _clamp(_cosine(emb["resume"], emb["jd"]))

    # ── Skill coverage ────────────────────────────────────────────────────────
    gaps = skill_gap(body.resume_text, body.jd_text)
    jd_skill_count = len(gaps["matched_skills"]) + len(gaps["missing_skills"])
    if jd_skill_count > 0:
        skill_coverage = round(len(gaps["matched_skills"]) / jd_skill_count * 100, 1)
    else:
        skill_coverage = 100.0  # no detectable skills in JD — don't penalise

    # ── Weighted composite ────────────────────────────────────────────────────
    score = round(
        semantic_score * WEIGHTS["semantic"]
        + skill_coverage * WEIGHTS["skill_coverage"],
        1,
    )

    # ── Section scores ────────────────────────────────────────────────────────
    section_scores = {}
    for section_key in ("skills", "experience"):
        label = f"section_{section_key}"
        if label in emb:
            section_scores[section_key] = _clamp(_cosine(emb[label], emb["jd"]))
        else:
            section_scores[section_key] = None

    return {
        "score":          score,
        "semantic_score": semantic_score,
        "skill_coverage": skill_coverage,
        "section_scores": section_scores,
        **gaps,
    }


@app.post("/api/feedback")
def improve_resume(body: FeedbackRequest):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is empty")
    if not body.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is empty")

    sections = extract_sections(body.resume_text)
    experience_text = sections.get("experience", body.resume_text).strip()

    try:
        skill_gap = (
            body.skill_gap.model_dump()
            if hasattr(body.skill_gap, "model_dump")
            else body.skill_gap.dict()
        )
        suggestions = generate_resume_feedback(
            resume_text=body.resume_text,
            jd_text=body.jd_text,
            skill_gap=skill_gap,
            experience_text=experience_text,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"suggestions": suggestions}
