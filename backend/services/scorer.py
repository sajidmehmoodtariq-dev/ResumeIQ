import io
import os

import numpy as np
import pdfplumber
from fastembed import TextEmbedding

from config import WEIGHTS
from extractor import skill_gap
from sections import extract_sections

_model: TextEmbedding | None = None
_FASTEMBED_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", ".fastembed_cache")


def get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            cache_dir=_FASTEMBED_CACHE_DIR,
        )
    return _model


def _extract_text_from_pdf(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


def _clamp(v: float) -> float:
    return round(max(0.0, min(1.0, v)) * 100, 1)


def score_against_jd(*, resume_text: str, jd_text: str) -> dict[str, object]:
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
