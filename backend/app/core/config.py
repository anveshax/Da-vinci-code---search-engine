import os
from pathlib import Path
from typing import List

class Settings:
    PROJECT_NAME: str = "Codebase Intelligence Engine API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"

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

settings = Settings()
