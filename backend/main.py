import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import ensure_indexes
from auth import router as auth_router
from profile import router as profile_router
from routers.resume import router as resume_router
from routers.feedback import router as feedback_router
from routers.pdf import router as pdf_router
from routers.cover_letter import router as cover_letter_router
from routers.builder import router as builder_router

load_dotenv()

app = FastAPI(title="Resume API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    ensure_indexes()


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Backend is running"}


app.include_router(auth_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(resume_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")
app.include_router(pdf_router, prefix="/api")
app.include_router(cover_letter_router, prefix="/api")
app.include_router(builder_router, prefix="/api")
