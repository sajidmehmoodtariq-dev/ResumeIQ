from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from llm_feedback import generate_resume_feedback
from sections import extract_sections

router = APIRouter(prefix="", tags=["feedback"])


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


@router.post("/feedback")
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
