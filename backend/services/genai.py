from typing import List, Dict, Optional, Any
import logging
import json
import re
from backend.services.llm_client import call_llm

logger = logging.getLogger(__name__)

MAX_ITEMS = 15
MAX_RAW_LENGTH = 6000
MAX_COMPARE_PAYLOAD = 3000


def _clean_text(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    return text.strip()[:MAX_RAW_LENGTH]


async def _safe_llm_call(prompt: str, context: str) -> Optional[str]:
    try:
        result = await call_llm(prompt)

        if not result:
            logger.warning(f"GenAI {context} returned empty response")
            return "ℹ️ AI explanation is temporarily unavailable due to quota limits or connectivity issues."


        return result.strip()

    except Exception as e:
        logger.error(f"GenAI {context} failed: {e}")
        return "⚠️ AI service error. Please retry later."


# ================= EXPLANATION =================

async def explain_drift(drift_items: List[Any], summary: Dict[str, Any]) -> Optional[str]:
    top_items = drift_items[:MAX_ITEMS]

    prompt = (
        "You are a data reliability expert.\n"
        f"Drift events (top {len(top_items)}):\n{json.dumps(top_items, indent=2)}\n\n"
        f"Dataset summary:\n{json.dumps(summary, indent=2)}\n\n"
        "Explain what changed, why it matters, and potential impact on ML models.\n"
        "Keep it concise (3-5 sentences)."
    )

    return await _safe_llm_call(prompt, "explain_drift")


# ================= REMEDIATION =================

async def genai_remediation(drift: List[Any], severity: str) -> Optional[str]:
    top_drift = drift[:10]

    prompt = (
        "You are a Senior ML Ops Engineer.\n"
        f"Severity: {severity}\n"
        f"Detected drift:\n{json.dumps(top_drift, indent=2)}\n\n"
        "Suggest prioritized remediation steps.\n"
        "Return strictly a numbered list (max 5 items)."
    )

    return await _safe_llm_call(prompt, "genai_remediation")


# ================= EXEC SUMMARY =================

async def generate_executive_summary(
    drift: List[Any], trends: Dict[str, Any], severity: str
) -> Optional[str]:
    top_drift = drift[:10]

    prompt = (
        "You are an AI generating a business executive summary.\n"
        f"Severity: {severity}\n"
        f"Trend:\n{json.dumps(trends, indent=2)}\n"
        f"Drift:\n{json.dumps(top_drift, indent=2)}\n\n"
        "Write a 3-5 sentence summary covering:\n"
        "- What changed\n- Business risk\n- Recommended next step\n\n"
        "Keep it non-technical."
    )

    return await _safe_llm_call(prompt, "generate_executive_summary")


# ================= COMPARISON =================

async def genai_compare_insights(
    drift_payload: Dict[str, Any], severity: str
) -> Dict[str, Optional[str]]:
    payload_preview = json.dumps(drift_payload, indent=2)[:MAX_COMPARE_PAYLOAD]

    prompt = (
        "You are a Senior ML Engineer.\n"
        f"Severity: {severity}\n"
        f"Payload:\n{payload_preview}\n\n"
        "Return a valid JSON object with exactly these 3 keys:\n"
        '"executive_summary": A 2-3 sentence business summary,\n'
        '"explanation": A technical explanation of the drift,\n'
        '"remediation": A numbered list of action items.\n\n'
        "Do not include markdown or extra text outside JSON."
    )

    raw = await _safe_llm_call(prompt, "compare_insights")

    default = {
        "executive_summary": None,
        "explanation": None,
        "remediation": None,
    }

    if not raw:
        return default

    try:
        match = re.search(r"\{.*\}", raw, re.S)
        if not match:
            logger.warning("GenAI compare: no JSON detected")
            return {
                "executive_summary": None,
                "explanation": raw,
                "remediation": None,
            }

        parsed = json.loads(match.group())

        return {
            "executive_summary": parsed.get("executive_summary"),
            "explanation": parsed.get("explanation"),
            "remediation": parsed.get("remediation"),
        }

    except Exception as e:
        logger.error(f"GenAI compare JSON parse failed: {e}")
        return default
