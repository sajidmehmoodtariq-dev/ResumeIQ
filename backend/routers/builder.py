import asyncio
import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from services.scorer import _extract_text_from_pdf
from llm_feedback import LLMFeedbackError, parse_resume_to_json, rewrite_with_gemini

router = APIRouter(prefix="", tags=["builder"])


@router.post("/parse-resume")
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    provider: str = Form(...),
    model: str = Form(...),
    api_key: str = Form(...),
):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    resume_text = _extract_text_from_pdf(raw)
    if not resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from this PDF. Make sure the file has selectable text (not a scanned image).",
        )

    try:
        parsed = await asyncio.to_thread(
            parse_resume_to_json,
            resume_text=resume_text,
            provider=provider,
            model=model,
            api_key=api_key,
        )
    except LLMFeedbackError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return parsed


class RewriteRequest(BaseModel):
    target: str           # 'summary' | 'experience' | 'skills' | 'projects' | 'full'
    current_data: dict    # current section data as a dict
    full_context: str     # full resume serialised as plain text (for context)
    instruction: str      # user's custom prompt
    api_key: str
    model: str = "gemini-2.0-flash"


@router.post("/rewrite-section")
async def rewrite_section_endpoint(body: RewriteRequest):
    if not body.instruction.strip():
        raise HTTPException(status_code=400, detail="instruction is required")
    if not body.api_key.strip():
        raise HTTPException(status_code=400, detail="Gemini API key is required")

    try:
        result = await asyncio.to_thread(
            rewrite_with_gemini,
            target=body.target,
            current_data=json.dumps(body.current_data, ensure_ascii=False),
            full_context=body.full_context,
            instruction=body.instruction,
            api_key=body.api_key,
            model=body.model,
        )
    except LLMFeedbackError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return result
