import re
from skills import ALIAS_MAP


def _build_pattern() -> re.Pattern:
    # Sort longest-first so "node.js" is tried before "node",
    # "spring boot" before "spring", "react native" before "react", etc.
    sorted_variants = sorted(ALIAS_MAP.keys(), key=len, reverse=True)

    # re.escape handles special chars in skill names (C++, C#, .NET, Node.js …).
    # The matched text then equals the original variant string, so ALIAS_MAP
    # lookup works: match.group(1).lower() == ALIAS_MAP key.
    escaped = [re.escape(v) for v in sorted_variants]

    # Word-boundary via negative lookbehind/lookahead — avoids matching "go"
    # inside "Django" or "r" inside "Docker".
    alternation = "|".join(escaped)
    return re.compile(
        r"(?<![a-zA-Z0-9_])(" + alternation + r")(?![a-zA-Z0-9_])",
        re.IGNORECASE,
    )


_PATTERN: re.Pattern = _build_pattern()


def extract_skills(text: str) -> set[str]:
    found: set[str] = set()
    for match in _PATTERN.finditer(text):
        raw = match.group(1).lower()
        canonical = ALIAS_MAP.get(raw)
        if canonical:
            found.add(canonical)
    return found


def skill_gap(resume_text: str, jd_text: str) -> dict:
    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(jd_text)
    return {
        "resume_skills":  sorted(resume_skills),
        "matched_skills": sorted(resume_skills & jd_skills),
        "missing_skills": sorted(jd_skills - resume_skills),
    }
