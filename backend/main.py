import io
import os
import numpy as np
import pdfplumber
from dotenv import load_dotenv
from config import WEIGHTS
from extractor import skill_gap
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llm_feedback import generate_resume_feedback
from sections import extract_sections
from sentence_transformers import SentenceTransformer

load_dotenv()

app = FastAPI(title="Resume API")

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

    model = get_model()

    # ── Build batch of texts to embed in one shot ─────────────────────────────
    texts = [body.resume_text, body.jd_text]
    labels = ["resume", "jd"]

    detected = extract_sections(body.resume_text)
    for section_key in ("skills", "experience"):
        if section_key in detected:
            texts.append(detected[section_key])
            labels.append(f"section_{section_key}")

    embeddings = model.encode(texts, normalize_embeddings=True)
    emb = dict(zip(labels, embeddings))

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
