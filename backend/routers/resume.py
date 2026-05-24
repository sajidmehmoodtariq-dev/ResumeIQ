from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from services.scorer import _extract_text_from_pdf, score_against_jd

router = APIRouter(prefix="", tags=["resume"])


class ScoreRequest(BaseModel):
    resume_text: str
    jd_text: str


class CompareJobRequest(BaseModel):
    label: str | None = None
    jd_text: str


class CompareRequest(BaseModel):
    resume_text: str
    job_descriptions: list[CompareJobRequest]


@router.post("/resume/upload")
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


@router.post("/score")
def score_resume(body: ScoreRequest):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is empty")
    if not body.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is empty")

    return score_against_jd(resume_text=body.resume_text, jd_text=body.jd_text)


@router.post("/compare-jobs")
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
            raise HTTPException(
                status_code=400,
                detail=f"job_descriptions[{index - 1}].jd_text is empty",
            )

        result = score_against_jd(resume_text=body.resume_text, jd_text=job.jd_text)
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
