import os
from pathlib import Path
from typing import List

class Settings:
    PROJECT_NAME: str = "Codebase Intelligence Engine API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"

    # Base workspace directory (always resolves to project root)
    WORKSPACE_ROOT: str = str(Path(__file__).resolve().parents[3])

    # Allowed CORS origins for the frontend
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

settings = Settings()
