import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Automatically load backend/.env and root .env
_backend_env = Path(__file__).resolve().parents[2] / ".env"
_root_env = Path(__file__).resolve().parents[3] / ".env"
if _backend_env.exists():
    load_dotenv(dotenv_path=_backend_env)
elif _root_env.exists():
    load_dotenv(dotenv_path=_root_env)
else:
    load_dotenv()

class Settings:
    PROJECT_NAME: str = "Codebase Intelligence Engine API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"
    API_V2_PREFIX: str = "/api/v2"

    # AI Provider Settings (Groq, OpenRouter, OpenAI-compatible)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "groq").lower()
    AI_API_KEY: str = os.getenv("AI_API_KEY", "").strip()
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", "").strip()
    AI_PRIMARY_MODEL: str = os.getenv("AI_PRIMARY_MODEL", "").strip()

    # Optional Web Search API Keys
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "").strip()
    BRAVE_API_KEY: str = os.getenv("BRAVE_API_KEY", "").strip()
    EXA_API_KEY: str = os.getenv("EXA_API_KEY", "").strip()

    # Specialized External Intelligence & Scraping Providers
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "").strip()
    OPENALEX_API_KEY: str = os.getenv("OPENALEX_API_KEY", "").strip()
    OPENALEX_MAILTO: str = os.getenv("OPENALEX_MAILTO", "").strip()
    JINA_API_KEY: str = os.getenv("JINA_API_KEY", "").strip()
    FIRECRAWL_API_KEY: str = os.getenv("FIRECRAWL_API_KEY", "").strip()
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()

    # Provider Enable/Disable Controls
    ENABLE_GITHUB: bool = os.getenv("ENABLE_GITHUB", "true").lower() in ("true", "1", "yes")
    ENABLE_OPENALEX: bool = os.getenv("ENABLE_OPENALEX", "true").lower() in ("true", "1", "yes")
    ENABLE_JINA: bool = os.getenv("ENABLE_JINA", "true").lower() in ("true", "1", "yes")
    ENABLE_FIRECRAWL: bool = os.getenv("ENABLE_FIRECRAWL", "true").lower() in ("true", "1", "yes")
    ENABLE_GOOGLE_MAPS: bool = os.getenv("ENABLE_GOOGLE_MAPS", "true").lower() in ("true", "1", "yes")
    ENABLE_GROQ: bool = os.getenv("ENABLE_GROQ", "true").lower() in ("true", "1", "yes")

    # Base workspace directory (configurable via env, defaults to project root)
    WORKSPACE_ROOT: str = os.getenv("WORKSPACE_ROOT", str(Path(__file__).resolve().parents[3]))

    # Base allowed origins for local dev and the deployed Vercel frontend
    _base_origins: List[str] = [
        "https://da-vinci-code-search-engine.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Additional custom origins from CORS_ORIGINS environment variable
    _extra_origins = [
        orig.strip()
        for orig in os.getenv("CORS_ORIGINS", "").split(",")
        if orig.strip()
    ]

    ALLOWED_ORIGINS: List[str] = _base_origins + _extra_origins

    # Regex allowing all local development ports and Vercel deployments
    CORS_ORIGIN_REGEX: str = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^(https:\/\/.*\.vercel\.app|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$"
    )

settings = Settings()
