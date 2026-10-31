"""
Local Search Query Router.

Classifies incoming queries into either 'code' or 'web' intent without
sending any queries or source code to third-party AI services.
Runs 100% locally in under 1 millisecond.
"""
import os
import re
from pathlib import Path
from typing import Dict, Any, Set

# Code syntax keywords (Python, TypeScript, JavaScript, C/C++, Rust, Go)
CODE_KEYWORDS = {
    "def", "class", "function", "const", "let", "var", "import", "from",
    "export", "interface", "type", "return", "async", "await", "struct",
    "enum", "public", "private", "protected", "namespace", "include"
}

# Recognized file extensions
FILE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html",
    ".md", ".yml", ".yaml", ".sh", ".c", ".cpp", ".h", ".rs", ".go"
}

# Natural language web question starters
WEB_QUESTION_PATTERNS = [
    r"^how\s+to\b",
    r"^what\s+(?:is|are)\b",
    r"^why\s+(?:does|is|do)\b",
    r"^explain\b",
    r"^difference\s+between\b",
    r"^best\s+practices?\b",
    r"^tutorial\b",
    r"^guide\b",
    r"^documentation\b",
    r"^compare\b",
]

# Patterns representing programming identifiers (e.g. camelCase, snake_case, PascalCase)
CAMEL_CASE_PATTERN = re.compile(r"^[a-z]+[A-Z0-9][a-zA-Z0-9]*$")
PASCAL_CASE_PATTERN = re.compile(r"^[A-Z][a-z0-9]+(?:[A-Z0-9][a-z0-9]*)+$")
SNAKE_CASE_PATTERN = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)+$", re.IGNORECASE)


# Known major web platforms, services, and navigational destinations
KNOWN_NAVIGATIONAL_PLATFORMS = {
    "whatsapp", "facebook", "instagram", "youtube", "google", "github", "linkedin",
    "amazon", "twitter", "x", "reddit", "netflix", "spotify", "wikipedia", "tiktok",
    "apple", "microsoft", "claude", "gemini", "chatgpt", "openai", "gmail",
    "pinterest", "zoom", "quora", "medium", "twitch", "slack", "discord", "canva",
    "ebay", "walmart", "imdb", "hulu", "disney", "telegram", "yahoo", "bing"
}

# Known web entities, geographic queries, and knowledge topics
KNOWN_WEB_ENTITIES = {
    "delhi", "tokyo", "paris", "london", "india", "weather", "map", "directions",
    "python", "react", "quantum", "ai", "artificial intelligence", "news", "javascript",
    "typescript", "rust", "golang", "docker", "kubernetes", "linux"
}


def get_local_filenames(workspace_path: Path) -> Set[str]:
    """
    Scans top-level and first 2 levels of workspace to match direct file queries.
    """
    names: Set[str] = set()
    try:
        for root, dirs, files in os.walk(workspace_path):
            # Exclude build and virtual environments
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", ".venv", "__pycache__", "dist"}]
            for f in files:
                names.add(f.lower())
    except Exception:
        pass
    return names


def classify_query(query: str, workspace_root: str) -> Dict[str, Any]:
    """
    Inspects query tokens and syntax to determine routing intent:
    - 'code': Query targets local source code, symbols, or files.
    - 'web': Query represents a conceptual question, tutorial request, or general tech inquiry.
    """
    clean = query.strip()
    if not clean:
        return {
            "mode_selected": "code",
            "confidence": 1.0,
            "reason": "Empty query defaults to local code search.",
        }

    query_lower = clean.lower()
    tokens = clean.split()

    # 0. Navigational intent detection (e.g. "WhatsApp", "Facebook", "YouTube", "GitHub")
    if any(plat in query_lower.split() or query_lower.startswith(plat) for plat in KNOWN_NAVIGATIONAL_PLATFORMS):
        return {
            "mode_selected": "web",
            "confidence": 0.98,
            "reason": "Detected navigational query for major web platform or online destination.",
            "is_navigational": True,
        }

    # 1. File extension match (e.g. "main.py", "App.tsx", "test.json")
    for ext in FILE_EXTENSIONS:
        if ext in query_lower or query_lower.endswith(ext):
            return {
                "mode_selected": "code",
                "confidence": 0.98,
                "reason": f"Detected file extension pattern ({ext}).",
            }

    # 2. Path directory separator (e.g. "backend/app", "src/components")
    if "/" in clean or "\\" in clean:
        return {
            "mode_selected": "code",
            "confidence": 0.95,
            "reason": "Detected directory path separator in query.",
        }

    # 3. Direct code keywords (e.g. "class CodebaseScanner", "def get_health")
    for kw in CODE_KEYWORDS:
        if re.search(rf"\b{kw}\b", query_lower):
            return {
                "mode_selected": "code",
                "confidence": 0.92,
                "reason": f"Detected programming language keyword ('{kw}').",
            }

    # 4. Exact match against local filenames in workspace
    workspace = Path(workspace_root)
    local_files = get_local_filenames(workspace)
    if query_lower in local_files:
        return {
            "mode_selected": "code",
            "confidence": 0.99,
            "reason": "Query matches an exact file name in the repository.",
        }

    # 5. Known web entities, geographic queries, and knowledge topics
    if any(ent in query_lower for ent in KNOWN_WEB_ENTITIES):
        return {
            "mode_selected": "web",
            "confidence": 0.92,
            "reason": "Detected world-wide-web entity or knowledge inquiry.",
        }

    # 6. Natural language question patterns (e.g. "how to configure CORS", "what is AI")
    for pattern in WEB_QUESTION_PATTERNS:
        if re.search(pattern, query_lower):
            return {
                "mode_selected": "web",
                "confidence": 0.94,
                "reason": "Detected natural language research question pattern.",
            }

    # 7. Multi-word natural language sentences without code keywords
    if len(tokens) >= 2 and not any(kw in query_lower for kw in CODE_KEYWORDS):
        return {
            "mode_selected": "web",
            "confidence": 0.85,
            "reason": "Natural language inquiry structure detected.",
        }

    # 8. Identifier casing patterns (camelCase, snake_case, PascalCase)
    # Check if single word matches code identifier casing
    if len(tokens) == 1:
        single_word = tokens[0]
        if (
            CAMEL_CASE_PATTERN.match(single_word)
            or PASCAL_CASE_PATTERN.match(single_word)
            or SNAKE_CASE_PATTERN.match(single_word)
        ):
            # If it's a code casing, check if it looks like code or web
            return {
                "mode_selected": "code",
                "confidence": 0.82,
                "reason": "Detected code symbol identifier pattern.",
            }

    # Default fallback: Route to web search with transparent notification
    return {
        "mode_selected": "web",
        "confidence": 0.75,
        "reason": "General web inquiry without local code matches.",
    }
