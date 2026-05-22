import json
import os
from typing import Any
from urllib import error, request


OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
MAX_SUGGESTIONS = 5


class LLMFeedbackError(RuntimeError):
    pass


def _build_messages(*, resume_text: str, jd_text: str, skill_gap: dict[str, Any], experience_text: str) -> list[dict[str, str]]:
    system = (
        "You are a resume editor. Return only valid JSON. "
        "Your job is to rewrite existing experience bullet points so they better match the job description. "
        "Use only the facts available in the provided resume, experience section, and skill gap. "
        "Do not invent employers, titles, tools, metrics, or responsibilities. "
        "If the experience section does not contain enough evidence for a strong rewrite, return fewer suggestions. "
        "Avoid generic advice like 'tailor your resume' or 'highlight leadership'. "
        f"Cap the list at {MAX_SUGGESTIONS} suggestions."
    )

    user = {
        "resume_text": resume_text,
        "experience_section": experience_text,
        "job_description": jd_text,
        "skill_gap": skill_gap,
        "output_schema": {
            "suggestions": [
                {
                    "original_bullet": "string",
                    "rewritten_bullet": "string",
                    "target_skill": "string",
                    "reason": "string",
                    "jd_alignment": "string",
                }
            ]
        },
        "instructions": [
            "Only suggest rewrites for bullet points that already exist in the experience section.",
            "Keep each rewritten bullet specific and concrete.",
            "Identify the exact skill or qualification you are targeting as 'target_skill'.",
            "Prefer changes that close a real missing-skill or relevance gap from the skill_gap object.",
            "Do not repeat the same resume bullet more than once.",
            "Return at most 5 suggestions.",
            "Return a JSON object with a top-level suggestions array and no markdown fences.",
        ],
    }

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user, ensure_ascii=True)},
    ]


def _call_openai(messages: list[dict[str, str]]) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise LLMFeedbackError("OPENAI_API_KEY is not set")

    payload = {
        "model": DEFAULT_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }

    req = request.Request(
        OPENAI_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise LLMFeedbackError(f"OpenAI request failed: {detail}") from exc
    except error.URLError as exc:
        raise LLMFeedbackError(f"OpenAI request failed: {exc.reason}") from exc

    data = json.loads(raw)
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def _call_gemini(messages: list[dict[str, str]]) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise LLMFeedbackError("GEMINI_API_KEY is not set")

    model = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    # Extract system and user from OpenAI-style messages array
    system_text = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_text = next((m["content"] for m in messages if m["role"] == "user"), "")

    payload = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": [{"parts": [{"text": user_text}]}],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
        }
    }

    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise LLMFeedbackError(f"Gemini request failed: {detail}") from exc
    except error.URLError as exc:
        raise LLMFeedbackError(f"Gemini request failed: {exc.reason}") from exc

    data = json.loads(raw)
    try:
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise LLMFeedbackError("Unrecognized response format from Gemini") from exc


def generate_resume_feedback(*, resume_text: str, jd_text: str, skill_gap: dict[str, Any], experience_text: str) -> list[dict[str, str]]:
    messages = _build_messages(
        resume_text=resume_text,
        jd_text=jd_text,
        skill_gap=skill_gap,
        experience_text=experience_text,
    )

    provider = os.getenv("LLM_PROVIDER", "openai").lower().strip()
    
    if provider == "openai":
        payload = _call_openai(messages)
    elif provider == "gemini":
        payload = _call_gemini(messages)
    else:
        raise LLMFeedbackError(f"Unsupported LLM_PROVIDER '{provider}'. Supported: 'openai', 'gemini'.")

    suggestions = payload.get("suggestions", [])
    if not isinstance(suggestions, list):
        raise LLMFeedbackError("LLM response did not contain a suggestions array")

    normalized: list[dict[str, str]] = []
    for item in suggestions[:MAX_SUGGESTIONS]:
        if not isinstance(item, dict):
            continue
        original_bullet = str(item.get("original_bullet", "")).strip()
        rewritten_bullet = str(item.get("rewritten_bullet", "")).strip()
        target_skill = str(item.get("target_skill", "")).strip()
        reason = str(item.get("reason", "")).strip()
        jd_alignment = str(item.get("jd_alignment", "")).strip()
        if not original_bullet or not rewritten_bullet:
            continue
        normalized.append(
            {
                "original_bullet": original_bullet,
                "rewritten_bullet": rewritten_bullet,
                "target_skill": target_skill,
                "reason": reason,
                "jd_alignment": jd_alignment,
            }
        )

    return normalized
