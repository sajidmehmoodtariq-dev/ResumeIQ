import json
import re
from typing import Any
from urllib import error, request


MAX_SUGGESTIONS = 5

_OPENAI_URL    = "https://api.openai.com/v1/chat/completions"
_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions"


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


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return json.loads(match.group(1).strip())
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        return json.loads(match.group())
    raise LLMFeedbackError("Could not parse JSON from LLM response")


def _http_post(url: str, payload: dict, headers: dict) -> dict[str, Any]:
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise LLMFeedbackError(f"HTTP {exc.code}: {detail}") from exc
    except error.URLError as exc:
        raise LLMFeedbackError(str(exc.reason)) from exc


def _call_openai(messages: list[dict], api_key: str, model: str) -> dict[str, Any]:
    data = _http_post(
        _OPENAI_URL,
        {"model": model, "messages": messages, "temperature": 0.3, "response_format": {"type": "json_object"}},
        {"Authorization": f"Bearer {api_key}"},
    )
    return _parse_json(data["choices"][0]["message"]["content"])


def _call_anthropic(messages: list[dict], api_key: str, model: str) -> dict[str, Any]:
    system_text = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_text   = next((m["content"] for m in messages if m["role"] == "user"),   "")
    data = _http_post(
        _ANTHROPIC_URL,
        {
            "model": model,
            "max_tokens": 2048,
            "temperature": 0.3,
            "system": system_text,
            "messages": [{"role": "user", "content": user_text}],
        },
        {"x-api-key": api_key, "anthropic-version": "2023-06-01"},
    )
    return _parse_json(data["content"][0]["text"])


def _call_gemini(messages: list[dict], api_key: str, model: str) -> dict[str, Any]:
    system_text = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_text   = next((m["content"] for m in messages if m["role"] == "user"),   "")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    data = _http_post(
        url,
        {
            "systemInstruction": {"parts": [{"text": system_text}]},
            "contents": [{"parts": [{"text": user_text}]}],
            "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
        },
        {},
    )
    try:
        return _parse_json(data["candidates"][0]["content"]["parts"][0]["text"])
    except (KeyError, IndexError) as exc:
        raise LLMFeedbackError("Unrecognized response format from Gemini") from exc


def _call_groq(messages: list[dict], api_key: str, model: str) -> dict[str, Any]:
    data = _http_post(
        _GROQ_URL,
        {"model": model, "messages": messages, "temperature": 0.3, "response_format": {"type": "json_object"}},
        {"Authorization": f"Bearer {api_key}"},
    )
    return _parse_json(data["choices"][0]["message"]["content"])


_CALLERS = {
    "openai":    _call_openai,
    "anthropic": _call_anthropic,
    "google":    _call_gemini,
    "gemini":    _call_gemini,
    "groq":      _call_groq,
}


def generate_resume_feedback(
    *,
    resume_text: str,
    jd_text: str,
    skill_gap: dict[str, Any],
    experience_text: str,
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
) -> list[dict[str, str]]:
    messages = _build_messages(
        resume_text=resume_text,
        jd_text=jd_text,
        skill_gap=skill_gap,
        experience_text=experience_text,
    )

    if not provider:
        raise LLMFeedbackError("No provider specified. Select a provider and add your API key in Profile → API Keys.")
    if not api_key:
        raise LLMFeedbackError(f"No API key provided for '{provider}'. Add it in Profile → API Keys.")
    if not model:
        raise LLMFeedbackError(f"No model specified for '{provider}'.")

    resolved_provider = provider.lower().strip()
    caller = _CALLERS.get(resolved_provider)
    if not caller:
        raise LLMFeedbackError(f"Unsupported provider '{resolved_provider}'. Supported: {', '.join(_CALLERS)}")

    try:
        payload = caller(messages, api_key, model)
    except LLMFeedbackError:
        raise
    except Exception as exc:
        raise LLMFeedbackError(str(exc)) from exc

    suggestions = payload.get("suggestions", [])
    if not isinstance(suggestions, list):
        raise LLMFeedbackError("LLM response did not contain a suggestions array")

    normalized: list[dict[str, str]] = []
    for item in suggestions[:MAX_SUGGESTIONS]:
        if not isinstance(item, dict):
            continue
        original  = str(item.get("original_bullet",  "")).strip()
        rewritten = str(item.get("rewritten_bullet",  "")).strip()
        if not original or not rewritten:
            continue
        normalized.append({
            "original_bullet":  original,
            "rewritten_bullet": rewritten,
            "target_skill":     str(item.get("target_skill",  "")).strip(),
            "reason":           str(item.get("reason",        "")).strip(),
            "jd_alignment":     str(item.get("jd_alignment",  "")).strip(),
        })

    return normalized
