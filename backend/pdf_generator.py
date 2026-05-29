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

_BULLET_CHARS = re.compile(r"^[\s]*[•·\-\*►▸▪◦–—■●▶]\s*")
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
    "skill", "technical", "tool", "language",
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
    slate_dark  = colors.HexColor("#0f172a")
    slate_grey  = colors.HexColor("#334155")
    slate_light = colors.HexColor("#64748b")
    pure_black  = colors.HexColor("#000000")
    pure_white  = colors.HexColor("#ffffff")

    # Modern is a single-column layout that must fit everything on one page —
    # use tighter font sizes and spacing throughout.
    tight = (template == "modern")

    body_size   = 8    if tight else 8.5
    body_lead   = 10   if tight else 10.5
    body_after  = 0    if tight else 1
    sec_before  = 2    if tight else 6
    sec_after   = 1    if tight else 2
    sec_size    = 9    if tight else 10
    sub_before  = 1    if tight else 3
    sub_after   = 0    if tight else 1
    meta_lead   = 9.5  if tight else 10
    meta_after  = 1    if tight else 2

    return {
        "name": ParagraphStyle(
            "Name", fontName="Helvetica-Bold", fontSize=22, leading=24,
            alignment=TA_CENTER, textColor=pure_black, spaceAfter=4,
        ),
        "contact": ParagraphStyle(
            "Contact", fontName="Helvetica", fontSize=8.5, leading=10,
            alignment=TA_CENTER, textColor=slate_light, spaceAfter=2,
        ),
        "bar_name": ParagraphStyle(
            "BarName", fontName="Helvetica-Bold",
            fontSize=20 if tight else 22, leading=22 if tight else 24,
            alignment=TA_CENTER, textColor=pure_white, spaceAfter=4 if tight else 6,
        ),
        "bar_contact": ParagraphStyle(
            "BarContact", fontName="Helvetica",
            fontSize=8 if tight else 8.5, leading=meta_lead,
            alignment=TA_CENTER, textColor=pure_white, spaceAfter=2,
        ),
        "section": ParagraphStyle(
            "Section", fontName="Helvetica-Bold", fontSize=sec_size, leading=sec_size + 1,
            textColor=slate_dark, spaceBefore=sec_before, spaceAfter=sec_after, uppercase=True,
        ),
        "subheading": ParagraphStyle(
            "Subheading", fontName="Helvetica-Bold", fontSize=body_size + 0.5, leading=body_lead,
            textColor=slate_dark, spaceBefore=sub_before, spaceAfter=sub_after,
        ),
        "meta": ParagraphStyle(
            "Meta", fontName="Helvetica-Oblique", fontSize=body_size, leading=meta_lead,
            textColor=slate_light, spaceAfter=meta_after,
        ),
        "bullet": ParagraphStyle(
            "Bullet", fontName="Helvetica", fontSize=body_size, leading=body_lead,
            leftIndent=10, firstLineIndent=0, textColor=slate_grey, spaceAfter=body_after,
        ),
        "text": ParagraphStyle(
            "Text", fontName="Helvetica", fontSize=body_size, leading=body_lead,
            textColor=slate_grey, spaceAfter=body_after,
        ),
    }

def _build_section_flow(
    sections: list,
    styles: dict,
    compact: bool = False,
    skills_columns: int = 3,
    available_width: float = 7.7 * inch,
    spacer_h: float | None = None,
) -> list:
    story = []
    if spacer_h is None:
        spacer_h = 0.04 * inch if compact else 0.06 * inch
    hr_thickness  = 1 if compact else 1.5
    hr_space_after = 2 if compact else 3

    for section in sections:
        story.append(_story_paragraph(styles["section"], section["title"]))
        story.append(
            HRFlowable(
                width="100%", thickness=hr_thickness,
                color=colors.HexColor("#0f172a"), spaceBefore=0, spaceAfter=hr_space_after,
            )
        )

        is_skills = any(
            kw in section["title"].lower()
            for kw in ("skill", "technical", "tool", "language")
        )

        if is_skills:
            # ── Group items by category (subheadings mark new categories) ──
            groups: list[dict] = []
            current_cat: str | None = None
            current_skills: list[str] = []

            for item in section["entries"]:
                itype = item.get("type")
                itext = item.get("text", "").strip()
                if not itext or itype == "blank":
                    continue
                if itype == "subheading":
                    groups.append({"name": current_cat, "skills": current_skills})
                    current_cat = itext
                    current_skills = []
                elif itype == "bullet":
                    current_skills.append(itext)
                elif itype == "text":
                    if "," in itext:
                        current_skills.extend(s.strip() for s in itext.split(",") if s.strip())
                    else:
                        current_skills.append(itext)

            groups.append({"name": current_cat, "skills": current_skills})
            groups = [g for g in groups if g["skills"]]

            # Render each category as "Category Name: skill1, skill2, skill3"
            for grp in groups:
                skill_str = escape(", ".join(grp["skills"]))
                if grp["name"]:
                    line = f"<b>{escape(grp['name'])}</b>: {skill_str}"
                else:
                    line = skill_str
                story.append(Paragraph(line, styles["text"]))
        else:
            # ── Regular section entries ───────────────────────────────────
            for item in section["entries"]:
                itype = item.get("type")
                itext = item.get("text", "")

                if itype == "blank":
                    story.append(Spacer(1, 0.02 * inch))
                elif itype == "subheading":
                    if "project" in section["title"].lower():
                        story.append(_story_paragraph(styles["subheading"], itext, bullet="●"))
                    else:
                        story.append(_story_paragraph(styles["subheading"], itext))
                elif itype == "meta":
                    story.append(_story_paragraph(styles["meta"], itext))
                elif itype == "bullet":
                    story.append(_story_paragraph(styles["bullet"], itext, bullet="•"))
                else:
                    story.append(_story_paragraph(styles["text"], itext))

        story.append(Spacer(1, spacer_h))
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

    story.extend(_build_section_flow(parsed["sections"], styles, compact=True,
                                     skills_columns=3, available_width=7.7 * inch))
    return story


def _render_modern_story(parsed: dict, styles: dict) -> list:
    """Single column — full-bleed dark header, then body with built-in side margins."""
    story = []
    page_w = 8.5 * inch
    margin = 0.4 * inch
    body_w = page_w - 2 * margin  # 7.7"

    header_rows = [[_story_paragraph(styles["bar_name"], parsed["name"] or "Resume")]]
    contact_line = "  •  ".join(parsed["contact"])
    if contact_line:
        header_rows.append([_story_paragraph(styles["bar_contact"], contact_line)])

    header = Table(header_rows, colWidths=[page_w])
    header.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(header)
    story.append(Spacer(1, 0.08 * inch))

    # Wrap body in a full-page-width table where padding provides the side margins.
    # colWidths must be page_w (not body_w) so:
    #   content area = page_w - leftPad - rightPad = 8.5 - 0.4 - 0.4 = 7.7" ✓
    body_flow = _build_section_flow(
        parsed["sections"], styles, compact=True,
        skills_columns=3, available_width=body_w,
        spacer_h=0.015 * inch,
    )
    body_wrapper = Table([[body_flow]], colWidths=[page_w])
    body_wrapper.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (0, 0), margin),
        ("RIGHTPADDING",  (0, 0), (0, 0), margin),
        ("TOPPADDING",    (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("VALIGN",        (0, 0), (0, 0), "TOP"),
    ]))
    story.append(body_wrapper)
    return story


def _render_creative_story(parsed: dict, styles: dict) -> list:
    """Two-column layout with full-bleed dark header (zero doc margins for creative)."""
    story = []
    page_w = 8.5 * inch
    margin = 0.4 * inch
    body_w = page_w - 2 * margin  # 7.7"

    # 1. Full-bleed header
    header_rows = [[_story_paragraph(styles["bar_name"], parsed["name"] or "Resume")]]
    contact_line = "  •  ".join(parsed["contact"])
    if contact_line:
        header_rows.append([_story_paragraph(styles["bar_contact"], contact_line)])

    header = Table(header_rows, colWidths=[page_w])
    header.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("TOPPADDING",    (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(header)
    story.append(Spacer(1, 0.12 * inch))

    # 2. Build two columns — widths fit within the 7.7" body area
    left_w  = 2.3 * inch
    right_w = 5.1 * inch
    left_flow  = _build_section_flow(parsed["side_sections"], styles, compact=True,
                                     skills_columns=2, available_width=left_w)
    right_flow = _build_section_flow(parsed["main_sections"], styles, compact=True,
                                     skills_columns=3, available_width=right_w)

    content_table = Table([[left_flow, right_flow]], colWidths=[left_w, right_w])
    content_table.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (0, 0), 0),
        ("RIGHTPADDING",  (0, 0), (0, 0), 15),
        ("LEFTPADDING",   (1, 0), (1, 0), 10),
        ("RIGHTPADDING",  (1, 0), (1, 0), 0),
    ]))

    # 3. Wrap with side margins (doc margins are 0 for creative)
    body_wrapper = Table([[content_table]], colWidths=[page_w])
    body_wrapper.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (0, 0), margin),
        ("RIGHTPADDING",  (0, 0), (0, 0), margin),
        ("TOPPADDING",    (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("VALIGN",        (0, 0), (0, 0), "TOP"),
    ]))

    story.append(body_wrapper)
    return story

# ── Entrypoints ───────────────────────────────────────────────────────────────

def _render_reportlab_pdf(text: str, template: str = "classic") -> bytes:
    if template not in TEMPLATE_META:
        template = "classic"

    buffer = BytesIO()

    margin = 0.4 * inch
    # Modern + Creative: zero top/left/right so the header bar bleeds to all edges.
    # The story functions add side margins internally via padded wrapper tables.
    # Classic: standard 0.4" margins on all sides.
    if template in ("modern", "creative"):
        doc = SimpleDocTemplate(
            buffer, pagesize=letter,
            leftMargin=0, rightMargin=0, topMargin=0, bottomMargin=margin,
        )
    else:
        doc = SimpleDocTemplate(
            buffer, pagesize=letter,
            leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin,
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


def generate_cover_letter_pdf(text: str) -> bytes:
    buffer = BytesIO()
    margin = 1.0 * inch
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
    )
    body_style = ParagraphStyle(
        "CLBody",
        fontName="Helvetica",
        fontSize=11,
        leading=17,
        spaceAfter=10,
        textColor=colors.HexColor("#1f2937"),
    )
    story = []
    for para in text.strip().split("\n\n"):
        clean = para.strip()
        if clean:
            story.append(Paragraph(escape(clean.replace("\n", "<br/>")), body_style))
    doc.build(story)
    return buffer.getvalue()