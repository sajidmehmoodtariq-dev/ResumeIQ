"""
Generate an updated resume PDF from plain text.

Flow:
  1. fuzzy_replace  — swap accepted bullets (robust to pdfplumber whitespace artifacts)
  2. generate_resume_pdf — render the mutated text to a byte-string PDF via ReportLab
"""

import html
import io
import re
from typing import Any

from rapidfuzz import fuzz, process
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

from sections import _HEADER_RE

# ── Bullet detection ───────────────────────────────────────────────────────
_BULLET_CHARS = re.compile(r"^[\s]*[•·\-\*►▸▪◦–—]\s*")
_DATE_HINT    = re.compile(
    r"\b(19|20)\d{2}\b"
    r"|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(?:19|20)\d{2}\b",
    re.IGNORECASE,
)


def _is_section_header(line: str) -> bool:
    return bool(_HEADER_RE.match(line.strip()))


def _is_bullet(line: str) -> bool:
    return bool(_BULLET_CHARS.match(line))


def _strip_bullet(line: str) -> str:
    return _BULLET_CHARS.sub("", line).strip()


def _esc(text: str) -> str:
    return html.escape(text)


# ── Fuzzy replacement ──────────────────────────────────────────────────────

def fuzzy_replace(text: str, old_bullet: str, new_bullet: str, threshold: int = 72) -> str:
    """
    Find the line in *text* that most closely matches *old_bullet* and
    replace it with *new_bullet*.  Returns text unchanged when no line
    exceeds *threshold* similarity.
    """
    old_norm = " ".join(old_bullet.split())
    lines    = text.split("\n")
    norms    = [" ".join(l.split()) for l in lines]

    result = process.extractOne(
        old_norm,
        norms,
        scorer=fuzz.ratio,
        score_cutoff=threshold,
    )
    if result is None:
        return text

    _match, _score, idx = result
    # Preserve any leading whitespace / bullet character the original line had
    prefix = _BULLET_CHARS.match(lines[idx])
    if prefix:
        lines[idx] = prefix.group(0) + new_bullet
    else:
        lines[idx] = new_bullet
    return "\n".join(lines)


def apply_substitutions(text: str, substitutions: list[dict[str, Any]]) -> str:
    for sub in substitutions:
        text = fuzzy_replace(text, sub["original_bullet"], sub["rewritten_bullet"])
    return text


# ── PDF styles ─────────────────────────────────────────────────────────────

def _make_styles() -> dict[str, ParagraphStyle]:
    def s(name, **kw) -> ParagraphStyle:
        return ParagraphStyle(name, **kw)

    return {
        "name": s("Name",
            fontName="Helvetica-Bold", fontSize=18,
            textColor=colors.HexColor("#111827"),
            alignment=TA_CENTER, spaceAfter=3,
        ),
        "contact": s("Contact",
            fontName="Helvetica", fontSize=9,
            textColor=colors.HexColor("#4b5563"),
            alignment=TA_CENTER, spaceAfter=2,
        ),
        "section": s("Section",
            fontName="Helvetica-Bold", fontSize=10,
            textColor=colors.HexColor("#111827"),
            spaceBefore=8, spaceAfter=3,
        ),
        "job_title": s("JobTitle",
            fontName="Helvetica-Bold", fontSize=10,
            textColor=colors.HexColor("#1f2937"),
            spaceBefore=5, spaceAfter=1,
        ),
        "meta": s("Meta",
            fontName="Helvetica-Oblique", fontSize=9,
            textColor=colors.HexColor("#6b7280"),
            spaceAfter=2,
        ),
        "bullet": s("Bullet",
            fontName="Helvetica", fontSize=9.5,
            textColor=colors.HexColor("#374151"),
            leftIndent=14, spaceAfter=2, leading=13,
        ),
        "normal": s("Normal",
            fontName="Helvetica", fontSize=9.5,
            textColor=colors.HexColor("#374151"),
            spaceAfter=2, leading=13,
        ),
    }


# ── PDF renderer ───────────────────────────────────────────────────────────

def generate_resume_pdf(text: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )
    st = _make_styles()
    story: list = []

    lines = text.split("\n")

    # ── Locate where the first named section begins ──────────────────────
    first_sec = next(
        (i for i, l in enumerate(lines) if _is_section_header(l)),
        None,
    )
    header_lines = [l.strip() for l in lines[: first_sec] if l.strip()] if first_sec else []
    body_lines   = lines[first_sec:] if first_sec is not None else lines

    # ── Render contact header ────────────────────────────────────────────
    if header_lines:
        story.append(Paragraph(_esc(header_lines[0]), st["name"]))
        for l in header_lines[1:]:
            story.append(Paragraph(_esc(l.replace("|", "  ·  ")), st["contact"]))
    story.append(Spacer(1, 6))

    # ── Render body ──────────────────────────────────────────────────────
    prev_blank   = True   # treat start-of-body like a blank line
    in_section   = False

    for raw in body_lines:
        stripped = raw.strip()

        if not stripped:
            prev_blank = True
            continue

        # Section header
        if _is_section_header(stripped):
            story.append(HRFlowable(
                width="100%", thickness=0.5,
                color=colors.HexColor("#d1d5db"),
                spaceBefore=6, spaceAfter=3,
            ))
            story.append(Paragraph(_esc(stripped.upper()), st["section"]))
            in_section  = True
            prev_blank  = False
            continue

        # Bullet point
        if _is_bullet(stripped):
            story.append(Paragraph(f"•  {_esc(_strip_bullet(stripped))}", st["bullet"]))
            prev_blank = False
            continue

        # Inside a section: short line after blank gap → job title / meta
        if in_section and prev_blank and len(stripped) < 90:
            if _DATE_HINT.search(stripped) or "|" in stripped or "@" in stripped:
                story.append(Paragraph(_esc(stripped), st["meta"]))
            else:
                story.append(Paragraph(_esc(stripped), st["job_title"]))
        else:
            story.append(Paragraph(_esc(stripped), st["normal"]))

        prev_blank = False

    doc.build(story)
    return buf.getvalue()
