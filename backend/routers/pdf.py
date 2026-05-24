import asyncio
import base64
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pdf_generator import apply_substitutions, generate_resume_pdf_async

router = APIRouter(prefix="", tags=["pdf"])
logger = logging.getLogger(__name__)


class AcceptedSub(BaseModel):
    original_bullet: str
    rewritten_bullet: str


class GeneratePDFRequest(BaseModel):
    resume_text: str
    accepted_substitutions: list[AcceptedSub]
    template: str = "classic"

@router.post("/generate-pdf")
async def generate_pdf(body: GeneratePDFRequest):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is empty")
    if not body.accepted_substitutions:
        raise HTTPException(status_code=400, detail="No substitutions selected")

    subs = [s.model_dump() for s in body.accepted_substitutions]
    mutated = apply_substitutions(body.resume_text, subs)

    try:
        pdf_bytes = await generate_resume_pdf_async(mutated, body.template)
    except Exception as exc:
        logger.exception(
            "PDF generation failed (template=%s, resume_len=%s, substitutions=%s)",
            body.template,
            len(body.resume_text),
            len(subs),
        )
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc!r}") from exc

    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="PDF generation produced empty output")

    return {"pdf_b64": base64.b64encode(pdf_bytes).decode("ascii")}
