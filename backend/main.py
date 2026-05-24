import base64
import io
import os
import numpy as np
import pdfplumber
from dotenv import load_dotenv
from auth import router as auth_router
from profile import router as profile_router
from config import WEIGHTS
from db import ensure_indexes
from extractor import skill_gap
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from llm_feedback import generate_resume_feedback
from pdf_generator import apply_substitutions, generate_resume_pdf
from sections import extract_sections
from fastembed import TextEmbedding

load_dotenv()

app = FastAPI(title="Resume API")

_model: TextEmbedding | None = None
_FASTEMBED_CACHE_DIR = os.path.join(os.path.dirname(__file__), ".fastembed_cache")


@app.on_event("startup")
def startup_event():
    # Keep startup lightweight; the model loads on first scoring request.
    ensure_indexes()
    print("Resume API started; fastembed will load lazily on demand.")


app.include_router(auth_router, prefix="/api")
app.include_router(profile_router, prefix="/api")


def get_model() -> TextEmbedding:
    global _model
    if _model is None:
        # fastembed uses ONNX and is much lighter than sentence-transformers + torch
        _model = TextEmbedding(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            cache_dir=_FASTEMBED_CACHE_DIR,
        )
    return _model


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


def _score_resume_against_jd(*, resume_text: str, jd_text: str) -> dict[str, object]:
    model = get_model()

    texts = [resume_text, jd_text]
    labels = ["resume", "jd"]

    detected = extract_sections(resume_text)
    for section_key in ("skills", "experience"):
        if section_key in detected:
            texts.append(detected[section_key])
            labels.append(f"section_{section_key}")

    embeddings = list(model.embed(texts))
    emb = dict(zip(labels, embeddings))

    semantic_score = _clamp(_cosine(emb["resume"], emb["jd"]))

    gaps = skill_gap(resume_text, jd_text)
    jd_skill_count = len(gaps["matched_skills"]) + len(gaps["missing_skills"])
    if jd_skill_count > 0:
        skill_coverage = round(len(gaps["matched_skills"]) / jd_skill_count * 100, 1)
    else:
        skill_coverage = 100.0

    score = round(
        semantic_score * WEIGHTS["semantic"]
        + skill_coverage * WEIGHTS["skill_coverage"],
        1,
    )

    section_scores = {}
    for section_key in ("skills", "experience"):
        label = f"section_{section_key}"
        if label in emb:
            section_scores[section_key] = _clamp(_cosine(emb[label], emb["jd"]))
        else:
            section_scores[section_key] = None

    return {
        "score": score,
        "semantic_score": semantic_score,
        "skill_coverage": skill_coverage,
        "section_scores": section_scores,
        **gaps,
    }


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
    provider: str | None = None
    model: str | None = None
    api_key: str | None = None


class CompareJobRequest(BaseModel):
    label: str | None = None
    jd_text: str


class CompareRequest(BaseModel):
    resume_text: str
    job_descriptions: list[CompareJobRequest]


@app.post("/api/score")
def score_resume(body: ScoreRequest):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is empty")
    if not body.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is empty")

    return _score_resume_against_jd(resume_text=body.resume_text, jd_text=body.jd_text)


@app.post("/api/compare-jobs")
def compare_jobs(body: CompareRequest):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is empty")
    if not body.job_descriptions:
        raise HTTPException(status_code=400, detail="job_descriptions is empty")
    if len(body.job_descriptions) > 3:
        raise HTTPException(status_code=400, detail="Provide at most 3 job descriptions")

    ranked_jobs = []
    for index, job in enumerate(body.job_descriptions, start=1):
        if not job.jd_text.strip():
            raise HTTPException(status_code=400, detail=f"job_descriptions[{index - 1}].jd_text is empty")

        result = _score_resume_against_jd(resume_text=body.resume_text, jd_text=job.jd_text)
        ranked_jobs.append(
            {
                "rank": index,
                "label": job.label or f"Job {index}",
                **result,
            }
        )

    ranked_jobs.sort(key=lambda item: item["score"], reverse=True)
    for rank, item in enumerate(ranked_jobs, start=1):
        item["rank"] = rank

    return {
        "ranked_jobs": ranked_jobs,
        "best_match": ranked_jobs[0] if ranked_jobs else None,
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
            provider=body.provider,
            model=body.model,
            api_key=body.api_key,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"suggestions": suggestions}


class AcceptedSub(BaseModel):
    original_bullet: str
    rewritten_bullet: str


class GeneratePDFRequest(BaseModel):
    resume_text: str
    accepted_substitutions: list[AcceptedSub]


@app.post("/api/generate-pdf")
def generate_pdf(body: GeneratePDFRequest):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is empty")
    if not body.accepted_substitutions:
        raise HTTPException(status_code=400, detail="No substitutions selected")

    subs = [s.model_dump() for s in body.accepted_substitutions]
    mutated = apply_substitutions(body.resume_text, subs)
    print(f"[PDF] resume_text length: {len(body.resume_text)}, subs: {len(subs)}, mutated length: {len(mutated)}")

    try:
        pdf_bytes = generate_resume_pdf(mutated)
        print(f"[PDF] generated {len(pdf_bytes)} bytes")
    except Exception as exc:
        print(f"[PDF] generation FAILED: {exc}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}") from exc

    if not pdf_bytes:
        print("[PDF] ERROR: pdf_bytes is empty after generation")
        raise HTTPException(status_code=500, detail="PDF generation produced empty output")

    print(f"[PDF] sending {len(pdf_bytes)} bytes as base64 JSON")
    return {"pdf_b64": base64.b64encode(pdf_bytes).decode("ascii")}
