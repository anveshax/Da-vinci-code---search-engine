"""
Codebase Scanner & Search Engine.

This engine module is strictly separated from FastAPI and handles:
- File tree discovery and filtering (ignoring node_modules, .git, .venv, etc.)
- Fast real text and regex search across source code files
- AST & syntax symbol extraction (Classes, Functions, Interfaces, Types)
- Secure, boundary-checked file content retrieval
"""
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

# File extensions recognized as source code or text
VALID_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css",
    ".md", ".yml", ".yaml", ".sh", ".c", ".cpp", ".h", ".hpp",
    ".rs", ".go", ".java", ".sql", ".env", ".toml", ".txt"
}

# Directories to ignore
IGNORED_DIRECTORIES = {
    ".git", "node_modules", ".venv", "venv", "__pycache__",
    "dist", "dist-ssr", "build", ".pytest_cache", ".idea", ".vscode"
}


class CodebaseScanner:
    """
    Decoupled engine scanner for inspecting codebase directories.
    Can be run from API routes, CLI scripts, or background workers.
    """

    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path).resolve()

    def get_engine_status(self) -> Dict[str, Any]:
        """
        Returns status information about the analysis engine without running a full scan.
        """
        exists = self.workspace_path.exists()
        is_dir = self.workspace_path.is_dir() if exists else False

        return {
            "engine": "AST-Codebase-Scanner",
            "version": "0.2.0",
            "status": "ready",
            "workspace_path": str(self.workspace_path),
            "valid_directory": exists and is_dir,
        }

    def search(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """
        Executes a real search across filenames, symbols, and source code content.
        Returns authentic matches with file paths, line numbers, and snippets.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        results: List[Dict[str, Any]] = []
        query_lower = clean_query.lower()
        query_pattern = re.compile(re.escape(clean_query), re.IGNORECASE)

        # Regex patterns to detect code symbols
        symbol_pattern = re.compile(
            r"^\s*(?:def|class|function|const|let|var|interface|type|enum)\s+([A-Za-z0-9_]+)",
            re.IGNORECASE
        )

        for root, dirs, files in os.walk(self.workspace_path):
            # Prune ignored directories in-place
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRECTORIES and not d.startswith(".")]

            for filename in files:
                file_path = Path(root) / filename
                rel_path = file_path.relative_to(self.workspace_path).as_posix()

                # 1. Filename match
                if query_lower in filename.lower():
                    results.append({
                        "file_path": str(file_path),
                        "relative_path": rel_path,
                        "line_number": 1,
                        "column": 1,
                        "match_type": "filename",
                        "symbol_name": filename,
                        "snippet": rel_path,
                    })
                    if len(results) >= max_results:
                        return results

                # Only inspect text source files
                ext = file_path.suffix.lower()
                if ext not in VALID_EXTENSIONS:
                    continue

                # Skip files larger than 1.5MB to maintain responsiveness
                try:
                    if file_path.stat().st_size > 1_500_000:
                        continue
                except OSError:
                    continue

                # 2. Content & Symbol matching
                try:
                    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                        for line_idx, line in enumerate(f, start=1):
                            if query_pattern.search(line):
                                sym_match = symbol_pattern.search(line)
                                match_type = "symbol" if sym_match else "content"
                                symbol_name = sym_match.group(1) if sym_match else None

                                results.append({
                                    "file_path": str(file_path),
                                    "relative_path": rel_path,
                                    "line_number": line_idx,
                                    "column": (line.lower().find(query_lower) + 1),
                                    "match_type": match_type,
                                    "symbol_name": symbol_name,
                                    "snippet": line.strip(),
                                })

                                if len(results) >= max_results:
                                    return results
                except (IOError, UnicodeDecodeError):
                    continue

        return results

    def get_file_content(self, relative_path: str) -> Optional[Dict[str, Any]]:
        """
        Reads file content securely, strictly ensuring the file is inside the workspace.
        """
        clean_rel = Path(relative_path).as_posix().lstrip("/")
        target_path = (self.workspace_path / clean_rel).resolve()

        # Security sandbox check: Prevent path traversal (e.g. ../../etc/passwd)
        try:
            target_path.relative_to(self.workspace_path)
        except ValueError:
            return None

        if not target_path.is_file():
            return None

        try:
            with open(target_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            lines = content.splitlines()
            return {
                "relative_path": clean_rel,
                "file_name": target_path.name,
                "content": content,
                "total_lines": len(lines),
                "size_bytes": target_path.stat().st_size,
                "extension": target_path.suffix.lower(),
            }
        except IOError:
            return None
