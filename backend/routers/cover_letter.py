import asyncio
import base64

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from llm_feedback import LLMFeedbackError, generate_cover_letter
from pdf_generator import generate_cover_letter_pdf

router = APIRouter(tags=["cover-letter"])


class CoverLetterRequest(BaseModel):
    resume_text: str
    jd_text: str
    provider: str
    model: str
    api_key: str


class CoverLetterPdfRequest(BaseModel):
    cover_letter: str


@router.post("/cover-letter")
async def cover_letter_endpoint(body: CoverLetterRequest):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is empty")
    if not body.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is empty")
    try:
        text = await asyncio.to_thread(
            generate_cover_letter,
            resume_text=body.resume_text,
            jd_text=body.jd_text,
            provider=body.provider,
            model=body.model,
            api_key=body.api_key,
        )
    except LLMFeedbackError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cover letter generation failed: {exc}") from exc
    return {"cover_letter": text}


@router.post("/cover-letter-pdf")
async def cover_letter_pdf_endpoint(body: CoverLetterPdfRequest):
    if not body.cover_letter.strip():
        raise HTTPException(status_code=400, detail="cover_letter is empty")
    try:
        pdf_bytes = await asyncio.to_thread(generate_cover_letter_pdf, body.cover_letter)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}") from exc
    return {"pdf_b64": base64.b64encode(pdf_bytes).decode("ascii")}
