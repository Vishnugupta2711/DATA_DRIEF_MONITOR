# # backend/config.py
# import os
# from dotenv import load_dotenv

# load_dotenv()

# class Config:
#     # Gemini API Configuration
#     GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
#     ENABLE_GENAI = os.getenv("ENABLE_GENAI", "false").lower() == "true"
    
#     # Rate Limiting
#     GENAI_RATE_LIMIT_DELAY = int(os.getenv("GENAI_RATE_LIMIT_DELAY", "3"))
#     GENAI_MAX_RETRIES = int(os.getenv("GENAI_MAX_RETRIES", "2"))
    
#     # Database
#     DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./drift_monitor.db")
    
#     # Redis
#     REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
#     REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

# config = Config()

# backend/config.py
# backend/config.py

import os
from dotenv import load_dotenv

# ==================================================
# Environment File Loading Strategy
# ==================================================
# 1. If ENV_FILE is set → load that file
# 2. Otherwise default to ".env.dev"
# 3. Docker will inject env vars directly (dotenv not required but harmless)

env_file = os.getenv("ENV_FILE", ".env.dev")

if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    # Fallback: load default behavior (system env)
    load_dotenv()


class Config:

    # ==========================
    # GenAI Configuration
    # ==========================
    ENABLE_GENAI = os.getenv("ENABLE_GENAI", "false").lower() == "true"
    GENAI_PROVIDER = os.getenv("GENAI_PROVIDER", "groq")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    # ==========================
    # Rate Limiting
    # ==========================
    GENAI_RATE_LIMIT_DELAY = int(os.getenv("GENAI_RATE_LIMIT_DELAY", "5"))
    GENAI_MAX_RETRIES = int(os.getenv("GENAI_MAX_RETRIES", "2"))

    # ==========================
    # Database
    # ==========================
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in environment variables")

    # ==========================
    # Redis
    # ==========================
    REDIS_HOST = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

    # ==========================
    # Email Alerts
    # ==========================
    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASS = os.getenv("SMTP_PASS")


config = Config()