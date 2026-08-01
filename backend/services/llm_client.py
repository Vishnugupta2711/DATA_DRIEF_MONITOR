# import os
# import asyncio
# import logging
# import httpx

# logger = logging.getLogger(__name__)

# ENABLE_GENAI = os.getenv("ENABLE_GENAI", "false").lower() == "true"
# PROVIDER = os.getenv("GENAI_PROVIDER", "groq")
# GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# MAX_RETRIES = 3
# TIMEOUT = 20.0

# async def call_llm(prompt: str) -> str | None:
#     if not ENABLE_GENAI:
#         logger.warning("GenAI disabled")
#         return None

#     headers = {
#         "Authorization": f"Bearer {GROQ_API_KEY}",
#         "Content-Type": "application/json",
#     }

#     payload = {
#         "model": GROQ_MODEL,
#         "messages": [{"role": "user", "content": prompt}],
#         "temperature": 0.4,
#         "max_tokens": 800,
#     }

#     async with httpx.AsyncClient(timeout=TIMEOUT) as client:
#         for attempt in range(1, MAX_RETRIES + 1):
#             try:
#                 r = await client.post(GROQ_URL, headers=headers, json=payload)

#                 if r.status_code != 200:
#                     logger.error(f"Groq error attempt {attempt}: {r.text}")
#                     await asyncio.sleep(2 * attempt)
#                     continue

#                 data = r.json()
#                 return data["choices"][0]["message"]["content"].strip()

#             except Exception as e:
#                 logger.error(f"Groq exception attempt {attempt}: {e}")
#                 await asyncio.sleep(2 * attempt)

#     logger.error("Groq failed after retries")
#     return None


# backend/services/llm_client.py

import asyncio
import logging
import httpx

from backend.config import config

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

MAX_RETRIES = config.GENAI_MAX_RETRIES
TIMEOUT = 20.0


async def call_llm(prompt: str) -> str | None:
    if not config.ENABLE_GENAI:
        logger.warning("GenAI disabled")
        return None

    if not config.GROQ_API_KEY:
        logger.error("GROQ_API_KEY is not set")
        return None

    headers = {
        "Authorization": f"Bearer {config.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": config.GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
        "max_tokens": 800,
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = await client.post(
                    GROQ_URL,
                    headers=headers,
                    json=payload
                )

                # 🔴 Immediate fail on invalid API key
                if response.status_code == 401:
                    logger.error("Invalid Groq API key (401 Unauthorized)")
                    return None

                if response.status_code != 200:
                    logger.error(
                        f"Groq error attempt {attempt}: {response.text}"
                    )
                    await asyncio.sleep(2 * attempt)
                    continue

                data = response.json()
                return data["choices"][0]["message"]["content"].strip()

            except Exception as e:
                logger.error(
                    f"Groq exception attempt {attempt}: {str(e)}"
                )
                await asyncio.sleep(2 * attempt)

    logger.error("Groq failed after retries")
    return None