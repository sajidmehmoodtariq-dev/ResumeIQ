"""
Resume PDF generator — ReportLab renderer.

Flow:
    1. apply_substitutions  — fuzzy-replace accepted bullets in raw text
    2. _parse_resume        — extract name, contact, structured sections
    3. generate_resume_pdf  — render directly with ReportLab → bytes
"""

import os
import re
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from rapidfuzz import fuzz, process
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

_LETTER_H_PX = 1056

from sections import _HEADER_RE

TEMPLATE_META = {
    "classic": {
        "name": "Classic",
        "ats": True,
        "columns": 1,
        "badge": "ATS Safe",
        "description": "Single column, top-to-bottom linear flow. ATS parsers read this perfectly.",
    },
    "modern": {
        "name": "Modern",
        "ats": True,
        "columns": 1,
        "badge": "ATS Friendly",
        "description": "Single column with accent header. Contemporary look, still ATS clean.",
    },
    "creative": {
        "name": "Creative",
        "ats": False,
        "columns": 2,
        "badge": "Design Forward",
        "description": "Two-column layout. Visually striking but ATS parsers may misread the column order.",
    },
}

# ── Regex helpers ─────────────────────────────────────────────────────────────

_BULLET_CHARS = re.compile(r"^[\s]*[•·\-\*►▸▪◦–—]\s*")
_DATE_HINT = re.compile(
    r"\b(19|20)\d{2}\b"
    r"|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(?:19|20)?\d{2,4}\b"
    r"|\bPresent\b|\bCurrent\b",
    re.IGNORECASE,
)

def _is_section_header(line: str) -> bool:
    return bool(_HEADER_RE.match(line.strip()))

def _is_bullet(line: str) -> bool:
    return bool(_BULLET_CHARS.match(line))

def _strip_bullet(line: str) -> str:
    return _BULLET_CHARS.sub("", line).strip()

# ── Fuzzy bullet replacement ──────────────────────────────────────────────────

def fuzzy_replace(text: str, old_bullet: str, new_bullet: str, threshold: int = 72) -> str:
    old_norm = " ".join(old_bullet.split())
    lines = text.split("\n")
    norms = [" ".join(l.split()) for l in lines]

    result = process.extractOne(old_norm, norms, scorer=fuzz.ratio, score_cutoff=threshold)
    if result is None:
        return text

    _match, _score, idx = result
    prefix = _BULLET_CHARS.match(lines[idx])
    lines[idx] = (prefix.group(0) if prefix else "") + new_bullet
    return "\n".join(lines)

def apply_substitutions(text: str, substitutions: list[dict[str, Any]]) -> str:
    for sub in substitutions:
        text = fuzzy_replace(text, sub["original_bullet"], sub["rewritten_bullet"])
    return text

# ── Resume text parser ────────────────────────────────────────────────────────

_SIDE_KEYWORDS = {
    "skill", "technical", "tool", "language", "certification",
    "summary", "objective", "profile", "competenc", "technolog",
}

def _parse_resume(text: str) -> dict:
    lines = text.strip().split("\n")

    first_sec_idx = next(
        (i for i, l in enumerate(lines) if _is_section_header(l)), None
    )

    header_block = [l.strip() for l in lines[:first_sec_idx] if l.strip()] if first_sec_idx else []
    name = header_block[0] if header_block else ""
    contact = header_block[1:] if len(header_block) > 1 else []

    sections: list[dict] = []
    if first_sec_idx is not None:
        current_title: str | None = None
        current_items: list[dict] = []
        prev_blank = True

        def _flush() -> None:
            if current_title is not None:
                items = current_items[:]
                while items and items[-1].get("type") == "blank":
                    items.pop()
                sections.append({"title": current_title, "entries": items})

        for line in lines[first_sec_idx:]:
            stripped = line.strip()
            if not stripped:
                if current_items and current_items[-1].get("type") != "blank":
                    current_items.append({"type": "blank", "text": ""})
                prev_blank = True
                continue

            if _is_section_header(stripped):
                _flush()
                current_title = stripped
                current_items = []
                prev_blank = True
                continue

            if _is_bullet(stripped):
                current_items.append({"type": "bullet", "text": _strip_bullet(stripped)})
            elif prev_blank and len(stripped) < 90 and (
                _DATE_HINT.search(stripped) or "|" in stripped
            ):
                current_items.append({"type": "meta", "text": stripped})
            elif prev_blank and len(stripped) < 90:
                current_items.append({"type": "subheading", "text": stripped})
            else:
                current_items.append({"type": "text", "text": stripped})

            prev_blank = False
        _flush()

    side_sections = [s for s in sections if any(kw in s["title"].lower() for kw in _SIDE_KEYWORDS)]
    main_sections = [s for s in sections if s not in side_sections]

    return {
        "name": name,
        "contact": contact,
        "sections": sections,
        "side_sections": side_sections,
        "main_sections": main_sections,
    }

# ── PDF rendering Styles ──────────────────────────────────────────────────────

def _story_paragraph(style: ParagraphStyle, text: str, bullet: str | None = None) -> Paragraph:
    return Paragraph(escape(text), style, bulletText=bullet)

def _make_styles(template: str) -> dict[str, ParagraphStyle]:
    styles = getSampleStyleSheet()
    
    # Base palette
    slate_dark = colors.HexColor("#0f172a")
    slate_grey = colors.HexColor("#334155")
    slate_light = colors.HexColor("#64748b")
    pure_black = colors.HexColor("#000000")
    pure_white = colors.HexColor("#ffffff")

    # Dynamic adjustments based on layout
    header_align = TA_CENTER
    if template == "modern":
        header_align = TA_LEFT

    return {
        "name": ParagraphStyle(
            "Name", fontName="Helvetica-Bold", fontSize=22, leading=24,
            alignment=header_align, textColor=pure_black, spaceAfter=4,
        ),
        "contact": ParagraphStyle(
            "Contact", fontName="Helvetica", fontSize=8.5, leading=10,
            alignment=header_align, textColor=slate_light, spaceAfter=2,
        ),
        "bar_name": ParagraphStyle(
            "BarName", fontName="Helvetica-Bold", fontSize=22, leading=24,
            alignment=TA_CENTER, textColor=pure_white, spaceAfter=6,
        ),
        "bar_contact": ParagraphStyle(
            "BarContact", fontName="Helvetica", fontSize=8.5, leading=10,
            alignment=TA_CENTER, textColor=pure_white, spaceAfter=2,
        ),
        "section": ParagraphStyle(
            "Section", fontName="Helvetica-Bold", fontSize=10, leading=11,
            textColor=slate_dark, spaceBefore=6, spaceAfter=2, uppercase=True,
        ),
        "subheading": ParagraphStyle(
            "Subheading", fontName="Helvetica-Bold", fontSize=9, leading=10.5,
            textColor=slate_dark, spaceBefore=3, spaceAfter=1,
        ),
        "meta": ParagraphStyle(
            "Meta", fontName="Helvetica-Oblique", fontSize=8.5, leading=10,
            textColor=slate_light, spaceAfter=2,
        ),
        "bullet": ParagraphStyle(
            "Bullet", fontName="Helvetica", fontSize=8.5, leading=10.5,
            leftIndent=10, firstLineIndent=0, textColor=slate_grey, spaceAfter=1,
        ),
        "text": ParagraphStyle(
            "Text", fontName="Helvetica", fontSize=8.5, leading=10.5,
            textColor=slate_grey, spaceAfter=1,
        ),
    }

def _build_section_flow(sections: list, styles: dict, compact: bool = False) -> list:
    """Helper to consistently build flowables for sections, handling spacing for 1-page limits."""
    story = []
    spacer_height = 0.04 * inch if compact else 0.06 * inch
    hr_thickness = 1 if compact else 1.5

    for section in sections:
        story.append(_story_paragraph(styles["section"], section["title"]))
        story.append(HRFlowable(width="100%", thickness=hr_thickness, color=colors.HexColor("#0f172a"), spaceBefore=1, spaceAfter=3))
        
        for item in section["entries"]:
            itype = item.get("type")
            itext = item.get("text", "")
            
            if itype == "blank":
                story.append(Spacer(1, 0.02 * inch))
            elif itype == "subheading":
                # If this section appears to be a Projects section, render subheadings
                # (project names) with a square bullet and bold styling.
                if "project" in section["title"].lower():
                    story.append(_story_paragraph(styles["subheading"], itext, bullet="■"))
                else:
                    story.append(_story_paragraph(styles["subheading"], itext))
            elif itype == "meta":
                story.append(_story_paragraph(styles["meta"], itext))
            elif itype == "bullet":
                story.append(_story_paragraph(styles["bullet"], itext, bullet="○"))
            else:
                story.append(_story_paragraph(styles["text"], itext))
        story.append(Spacer(1, spacer_height))
    return story

# ── Renderers ─────────────────────────────────────────────────────────────────

def _render_classic_story(parsed: dict, styles: dict) -> list:
    """Single column, top-to-bottom. Plain text headers. Hyper-compressed."""
    story = []
    story.append(_story_paragraph(styles["name"], parsed["name"] or "Resume"))
    
    contact_line = " | ".join(parsed["contact"])
    if contact_line:
        story.append(_story_paragraph(styles["contact"], contact_line))
    story.append(Spacer(1, 0.15 * inch))

    story.extend(_build_section_flow(parsed["sections"], styles, compact=True))
    return story


def _render_modern_story(parsed: dict, styles: dict) -> list:
    """Single column, but with a highly stylized, dark background header table."""
    story = []
    
    header_rows = [[_story_paragraph(styles["bar_name"], parsed["name"] or "Resume")]]
    contact_line = "  •  ".join(parsed["contact"])
    if contact_line:
        header_rows.append([_story_paragraph(styles["bar_contact"], contact_line)])

    header = Table(header_rows, colWidths=[7.3 * inch])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("TOPPADDING", (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(header)
    story.append(Spacer(1, 0.15 * inch))

    story.extend(_build_section_flow(parsed["sections"], styles, compact=True))
    return story


def _render_creative_story(parsed: dict, styles: dict) -> list:
    """
    Two-column layout matching the HTML topbar design. 
    Built using nested ReportLab tables to guarantee ATS parsing order (Left -> Right).
    """
    story = []
    
    # 1. Full-Width Header
    header_rows = [[_story_paragraph(styles["bar_name"], parsed["name"] or "Resume")]]
    contact_line = "  •  ".join(parsed["contact"])
    if contact_line:
        header_rows.append([_story_paragraph(styles["bar_contact"], contact_line)])

    header = Table(header_rows, colWidths=[7.7 * inch]) # Stretch full page width minus margins
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("TOPPADDING", (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(header)
    story.append(Spacer(1, 0.15 * inch))

    # 2. Build Columns
    left_flow = _build_section_flow(parsed["side_sections"], styles, compact=True)
    right_flow = _build_section_flow(parsed["main_sections"], styles, compact=True)

    # 3. Embed into a 2-Column Content Table
    # 32% Left (~2.3 in), 68% Right (~4.9 in) + Gutter
    content_table = Table([[left_flow, right_flow]], colWidths=[2.3 * inch, 5.1 * inch])
    content_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),      # Left col no left pad
        ("RIGHTPADDING", (0, 0), (0, 0), 15),    # Left col right gutter
        ("LEFTPADDING", (1, 0), (1, 0), 10),     # Right col left gutter
        ("RIGHTPADDING", (1, 0), (1, 0), 0),     # Right col no right pad
    ]))
    
    story.append(content_table)
    return story

# ── Entrypoints ───────────────────────────────────────────────────────────────

def _render_reportlab_pdf(text: str, template: str = "classic") -> bytes:
    if template not in TEMPLATE_META:
        template = "classic"

    buffer = BytesIO()
    
    # Margins optimized tight to guarantee 1-page fit
    margin_x = 0.4 * inch
    margin_y = 0.4 * inch
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=margin_x,
        rightMargin=margin_x,
        topMargin=margin_y,
        bottomMargin=margin_y,
    )

    parsed = _parse_resume(text)
    styles = _make_styles(template)

    if template == "modern":
        story = _render_modern_story(parsed, styles)
    elif template == "creative":
        story = _render_creative_story(parsed, styles)
    else:
        story = _render_classic_story(parsed, styles)

    doc.build(story)
    return buffer.getvalue()


def generate_resume_pdf(text: str, template: str = "classic") -> bytes:
    return _render_reportlab_pdf(text, template)


async def generate_resume_pdf_async(text: str, template: str = "classic") -> bytes:
    return _render_reportlab_pdf(text, template)