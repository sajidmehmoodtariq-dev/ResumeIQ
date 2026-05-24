import io
from datetime import datetime, timezone

import pdfplumber
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from auth import get_current_user
from db import resumes_collection

router = APIRouter(prefix="/profile", tags=["profile"])
MAX_RESUMES = 5


def _extract_pdf_text(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages).strip()


def _resume_out(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "label": doc.get("label") or doc.get("filename") or "Untitled",
        "filename": doc.get("filename"),
        "source": doc.get("source", "pdf"),
        "uploaded_at": doc["uploaded_at"].isoformat(),
        "text_preview": (doc.get("text") or "")[:160],
    }


@router.get("/resumes")
def list_resumes(current_user: dict = Depends(get_current_user)):
    docs = list(
        resumes_collection.find({"user_id": current_user["_id"]}).sort("uploaded_at", -1)
    )
    return [_resume_out(doc) for doc in docs]


@router.post("/resumes")
async def upload_resume(
    current_user: dict = Depends(get_current_user),
    file: UploadFile = File(None),
    text: str = Form(None),
    label: str = Form(None),
):
    count = resumes_collection.count_documents({"user_id": current_user["_id"]})
    if count >= MAX_RESUMES:
        raise HTTPException(
            status_code=400,
            detail=f"You can save at most {MAX_RESUMES} resumes. Delete one first.",
        )

    if file is not None:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")
        raw = await file.read()
        resume_text = _extract_pdf_text(raw)
        source = "pdf"
        filename = file.filename
        default_label = file.filename
    elif text and text.strip():
        resume_text = text.strip()
        source = "paste"
        filename = None
        default_label = "Pasted Resume"
    else:
        raise HTTPException(status_code=400, detail="Provide a PDF file or pasted text")

    doc = {
        "user_id": current_user["_id"],
        "label": (label.strip() if label and label.strip() else default_label),
        "filename": filename,
        "text": resume_text,
        "source": source,
        "uploaded_at": datetime.now(timezone.utc),
    }
    result = resumes_collection.insert_one(doc)
    created = resumes_collection.find_one({"_id": result.inserted_id})
    return _resume_out(created)


@router.get("/resumes/{resume_id}/text")
def get_resume_text(resume_id: str, current_user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid resume ID")

    doc = resumes_collection.find_one({"_id": oid, "user_id": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")

    return {"id": str(doc["_id"]), "label": doc.get("label", "Resume"), "text": doc["text"]}


@router.delete("/resumes/{resume_id}")
def delete_resume(resume_id: str, current_user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid resume ID")

    result = resumes_collection.delete_one({"_id": oid, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resume not found")

    return {"message": "Resume deleted"}
