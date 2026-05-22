import re

# Each entry: canonical section key → list of plain-text header variants (lowercase).
# Sorted longest-first within each group so the regex alternation is greedy.
_SECTION_MAP: dict[str, list[str]] = {
    "skills": [
        "technical proficiencies",
        "tools and technologies",
        "tools & technologies",
        "technical expertise",
        "technical skills",
        "core competencies",
        "skills summary",
        "key skills",
        "tech stack",
        "competencies",
        "proficiencies",
        "technologies",
        "expertise",
        "skills",
    ],
    "experience": [
        "professional experience",
        "relevant experience",
        "employment history",
        "work experience",
        "career history",
        "work history",
        "experience",
    ],
    "summary": [
        "professional summary",
        "executive summary",
        "career summary",
        "career objective",
        "professional profile",
        "about me",
        "objective",
        "summary",
        "profile",
    ],
    "education": [
        "educational background",
        "academic background",
        "academic history",
        "education",
    ],
    "projects": [
        "personal projects",
        "notable projects",
        "open source",
        "projects",
    ],
}

# Flat phrase → canonical key lookup
_PHRASE_KEY: dict[str, str] = {
    phrase: key
    for key, phrases in _SECTION_MAP.items()
    for phrase in phrases
}

# Single regex that matches a line consisting solely of a section header.
# re.MULTILINE so ^ / $ match line boundaries; re.IGNORECASE for all-caps PDFs.
_all_phrases = sorted(_PHRASE_KEY, key=len, reverse=True)
_HEADER_RE = re.compile(
    r"^[ \t]*(" + "|".join(re.escape(p) for p in _all_phrases) + r")[ \t]*:?[ \t]*$",
    re.IGNORECASE | re.MULTILINE,
)


def extract_sections(text: str) -> dict[str, str]:
    """Return {canonical_key: section_text} for every detected section."""
    matches = list(_HEADER_RE.finditer(text))
    if not matches:
        return {}

    sections: dict[str, str] = {}
    for i, match in enumerate(matches):
        phrase = match.group(1).strip().lower()
        key = _PHRASE_KEY.get(phrase)
        if key is None or key in sections:  # skip unknown or duplicate
            continue
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if content:
            sections[key] = content

    return sections
