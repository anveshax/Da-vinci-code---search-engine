"""
Advanced Codebase Intelligence Engine.

Performs static analysis, AST symbol extraction, dependency graph generation,
change impact analysis, test coverage gap detection, and security pattern scanning.

Supports:
- Python AST parsing via Python standard library `ast`
- TypeScript / JavaScript symbol extraction and import tracking
- In-memory incremental caching indexed by file modification times (mtime)
"""
import ast
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Set, Optional

# File extensions recognized as source code
CODE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css",
    ".md", ".yml", ".yaml", ".sh", ".sql", ".toml"
}

IGNORED_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__",
    "dist", "dist-ssr", "build", ".pytest_cache", ".idea", ".vscode"
}

# Regex for TS/JS imports
TS_IMPORT_PATTERN = re.compile(
    r"""(?:import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"])|(?:require\(['"]([^'"]+)['"]\))"""
)

# Regex for TS/JS symbols
TS_SYMBOL_PATTERNS = [
    (re.compile(r"^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)"), "function"),
    (re.compile(r"^\s*(?:async\s+)?function\s+([A-Za-z0-9_]+)"), "function"),
    (re.compile(r"^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)\s*="), "variable"),
    (re.compile(r"^\s*export\s+class\s+([A-Za-z0-9_]+)"), "class"),
    (re.compile(r"^\s*class\s+([A-Za-z0-9_]+)"), "class"),
    (re.compile(r"^\s*export\s+interface\s+([A-Za-z0-9_]+)"), "interface"),
    (re.compile(r"^\s*export\s+type\s+([A-Za-z0-9_]+)\s*="), "type"),
]


class CodebaseIntelligence:
    """
    In-memory static analysis and code intelligence engine.
    """

    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path).resolve()
        self._file_cache: Dict[str, Dict[str, Any]] = {}
        self._dependencies: Dict[str, Set[str]] = {}
        self._reverse_dependencies: Dict[str, Set[str]] = {}
        self._symbols: Dict[str, List[Dict[str, Any]]] = {}
        self._last_index_time: float = 0.0

        # Perform initial index scan
        self.reindex(force=True)

    def reindex(self, force: bool = False) -> Dict[str, Any]:
        """
        Indexes workspace files incrementally based on mtime.
        """
        scanned_count = 0
        updated_count = 0
        all_relative_paths: Set[str] = set()

        for root, dirs, files in os.walk(self.workspace_path):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]

            for filename in files:
                file_path = Path(root) / filename
                ext = file_path.suffix.lower()

                if ext not in CODE_EXTENSIONS:
                    continue

                try:
                    rel_path = file_path.relative_to(self.workspace_path).as_posix()
                    all_relative_paths.add(rel_path)
                    stat = file_path.stat()
                    mtime = stat.st_mtime
                    size = stat.st_size
                except (OSError, ValueError):
                    continue

                scanned_count += 1
                cached = self._file_cache.get(rel_path)

                if force or not cached or cached.get("mtime") != mtime:
                    # File changed or new
                    parsed_data = self._parse_file(file_path, rel_path, ext, size, mtime)
                    self._file_cache[rel_path] = parsed_data
                    updated_count += 1

        # Clean up deleted files
        stale_paths = set(self._file_cache.keys()) - all_relative_paths
        for p in stale_paths:
            del self._file_cache[p]

        # Rebuild dependency graphs
        self._rebuild_dependency_graphs()
        self._rebuild_symbol_table()

        return {
            "total_files": len(self._file_cache),
            "scanned": scanned_count,
            "updated": updated_count,
            "stale_removed": len(stale_paths),
        }

    def _parse_file(
        self,
        file_path: Path,
        rel_path: str,
        ext: str,
        size: int,
        mtime: float
    ) -> Dict[str, Any]:
        """Parses a single file for symbols, lines, and imports."""
        symbols: List[Dict[str, Any]] = []
        raw_imports: List[str] = []
        line_count = 0

        # Skip oversized files
        if size > 1_500_000:
            return {
                "rel_path": rel_path,
                "file_name": file_path.name,
                "ext": ext,
                "size": size,
                "mtime": mtime,
                "line_count": 0,
                "symbols": [],
                "raw_imports": [],
            }

        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            lines = content.splitlines()
            line_count = len(lines)

            if ext == ".py":
                symbols, raw_imports = self._parse_python(content, rel_path)
            elif ext in {".ts", ".tsx", ".js", ".jsx"}:
                symbols, raw_imports = self._parse_javascript_typescript(lines, rel_path)
        except Exception:
            pass

        return {
            "rel_path": rel_path,
            "file_name": file_path.name,
            "ext": ext,
            "size": size,
            "mtime": mtime,
            "line_count": line_count,
            "symbols": symbols,
            "raw_imports": raw_imports,
        }

    def _parse_python(self, content: str, rel_path: str):
        """Extracts AST symbols and imports from Python code."""
        symbols: List[Dict[str, Any]] = []
        raw_imports: List[str] = []

        try:
            tree = ast.parse(content)
        except SyntaxError:
            return symbols, raw_imports

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                doc = ast.get_docstring(node) or ""
                symbols.append({
                    "name": node.name,
                    "kind": "async_function" if isinstance(node, ast.AsyncFunctionDef) else "function",
                    "line": node.lineno,
                    "file": rel_path,
                    "docstring": doc.split("\n")[0] if doc else "",
                })
            elif isinstance(node, ast.ClassDef):
                doc = ast.get_docstring(node) or ""
                methods = [
                    m.name for m in node.body
                    if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))
                ]
                symbols.append({
                    "name": node.name,
                    "kind": "class",
                    "line": node.lineno,
                    "file": rel_path,
                    "docstring": doc.split("\n")[0] if doc else "",
                    "methods": methods,
                })
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    raw_imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    raw_imports.append(node.module)

        return symbols, raw_imports

    def _parse_javascript_typescript(self, lines: List[str], rel_path: str):
        """Extracts symbols and imports from TS/JS code."""
        symbols: List[Dict[str, Any]] = []
        raw_imports: List[str] = []

        for idx, line in enumerate(lines, start=1):
            clean = line.strip()

            # Check imports
            import_matches = TS_IMPORT_PATTERN.findall(line)
            for m in import_matches:
                target = m[0] or m[1]
                if target:
                    raw_imports.append(target)

            # Check symbols
            for pattern, kind in TS_SYMBOL_PATTERNS:
                match = pattern.search(clean)
                if match:
                    symbols.append({
                        "name": match.group(1),
                        "kind": kind,
                        "line": idx,
                        "file": rel_path,
                        "snippet": clean[:100],
                    })
                    break

        return symbols, raw_imports

    def _resolve_import_target(self, source_rel: str, raw_import: str) -> Optional[str]:
        """Attempts to resolve a raw import string to a relative workspace file path."""
        # Relative import (./ or ../)
        if raw_import.startswith("."):
            source_dir = Path(source_rel).parent
            candidate_base = (source_dir / raw_import).as_posix()
            possible_extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]
            for ext in possible_extensions:
                cand = candidate_base + ext
                # Clean path
                cand_norm = Path(cand).as_posix().lstrip("/")
                if cand_norm in self._file_cache:
                    return cand_norm

        # Python module import resolution (e.g. app.core.config -> backend/app/core/config.py)
        py_path = raw_import.replace(".", "/")
        for prefix in ["backend/", ""]:
            cand = f"{prefix}{py_path}.py"
            if cand in self._file_cache:
                return cand
            cand_init = f"{prefix}{py_path}/__init__.py"
            if cand_init in self._file_cache:
                return cand_init

        return None

    def _rebuild_dependency_graphs(self):
        """Builds directed graphs of forward and reverse file dependencies."""
        self._dependencies = {}
        self._reverse_dependencies = {}

        for rel_path in self._file_cache:
            self._dependencies[rel_path] = set()
            self._reverse_dependencies[rel_path] = set()

        for rel_path, info in self._file_cache.items():
            for raw_imp in info.get("raw_imports", []):
                target = self._resolve_import_target(rel_path, raw_imp)
                if target and target != rel_path:
                    self._dependencies[rel_path].add(target)
                    self._reverse_dependencies.setdefault(target, set()).add(rel_path)

    def _rebuild_symbol_table(self):
        """Indexes all symbols across files for fast symbol lookup."""
        self._symbols = {}
        for rel_path, info in self._file_cache.items():
            for sym in info.get("symbols", []):
                sym_name = sym["name"].lower()
                self._symbols.setdefault(sym_name, []).append(sym)

    def get_dependency_graph(self) -> Dict[str, Any]:
        """Returns nodes and edges formatted for visualization."""
        nodes = []
        edges = []

        for rel_path, info in self._file_cache.items():
            # Only include files with dependencies or non-trivial size
            dep_count = len(self._dependencies.get(rel_path, set()))
            rev_count = len(self._reverse_dependencies.get(rel_path, set()))

            nodes.append({
                "id": rel_path,
                "label": info["file_name"],
                "path": rel_path,
                "extension": info["ext"],
                "lines": info["line_count"],
                "dependencies_out": dep_count,
                "dependencies_in": rev_count,
            })

            for target in self._dependencies.get(rel_path, set()):
                edges.append({
                    "source": rel_path,
                    "target": target,
                })

        return {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "nodes": nodes,
            "edges": edges,
        }

    def analyze_impact(self, target_rel_path: str) -> Dict[str, Any]:
        """
        Determines direct and transitive dependents affected if target_rel_path is modified.
        """
        clean_target = target_rel_path.strip().lstrip("/")
        # Find exact or best matching relative path
        if clean_target not in self._file_cache:
            for p in self._file_cache:
                if p.endswith(clean_target) or clean_target in p:
                    clean_target = p
                    break

        if clean_target not in self._file_cache:
            return {
                "error": f"File '{target_rel_path}' not found in indexed codebase.",
                "target_file": target_rel_path,
                "affected_files": [],
            }

        # BFS traversal for reverse dependencies
        visited: Set[str] = set()
        queue = [clean_target]
        depth_map: Dict[str, int] = {clean_target: 0}

        while queue:
            curr = queue.pop(0)
            curr_depth = depth_map[curr]

            for parent in self._reverse_dependencies.get(curr, set()):
                if parent not in visited and parent != clean_target:
                    visited.add(parent)
                    depth_map[parent] = curr_depth + 1
                    queue.append(parent)

        affected = [
            {
                "file": p,
                "distance": depth_map.get(p, 1),
                "is_direct": depth_map.get(p, 1) == 1,
            }
            for p in sorted(visited, key=lambda x: depth_map.get(x, 1))
        ]

        # Classify risk
        count = len(affected)
        risk = "low"
        if count >= 6 or "config" in clean_target or "main.py" in clean_target:
            risk = "critical"
        elif count >= 3:
            risk = "medium"

        return {
            "target_file": clean_target,
            "total_affected": count,
            "impact_risk": risk,
            "direct_dependents": [a["file"] for a in affected if a["is_direct"]],
            "transitive_dependents": [a["file"] for a in affected if not a["is_direct"]],
            "affected_details": affected,
        }

    def analyze_test_gaps(self) -> Dict[str, Any]:
        """
        Scans for source code modules that lack corresponding test files.
        """
        source_modules: List[str] = []
        test_files: List[str] = []

        for p in self._file_cache:
            ext = self._file_cache[p]["ext"]
            if ext not in {".py", ".ts", ".tsx", ".js"}:
                continue

            lower = p.lower()
            is_test = (
                "test" in lower or
                "spec" in lower or
                p.startswith("tests/") or
                "/__tests__/" in lower
            )

            if is_test:
                test_files.append(p)
            else:
                source_modules.append(p)

        # Correlate source modules with test files
        gaps: List[Dict[str, Any]] = []
        covered: List[str] = []

        for mod in source_modules:
            name_stem = Path(mod).stem.lower()
            # Look for test file referencing this stem or directly importing it
            is_covered = False
            for tf in test_files:
                if name_stem in tf.lower():
                    is_covered = True
                    break
                # Check if test file imports the module
                if mod in self._dependencies.get(tf, set()):
                    is_covered = True
                    break

            if is_covered:
                covered.append(mod)
            else:
                info = self._file_cache[mod]
                gaps.append({
                    "file": mod,
                    "lines": info["line_count"],
                    "symbols_count": len(info["symbols"]),
                    "criticality": "high" if info["line_count"] > 100 or len(info["symbols"]) > 4 else "medium",
                })

        # Sort gaps by lines / criticality
        gaps.sort(key=lambda x: x["lines"], reverse=True)

        return {
            "total_source_modules": len(source_modules),
            "tested_modules": len(covered),
            "untested_modules": len(gaps),
            "coverage_percentage": round((len(covered) / max(len(source_modules), 1)) * 100, 1),
            "test_files_detected": test_files,
            "gaps": gaps[:50],
        }

    def scan_security_insights(self) -> List[Dict[str, Any]]:
        """
        Scans codebase for sensitive patterns, unsafe functions, and vulnerabilities.
        """
        findings: List[Dict[str, Any]] = []

        # Secret detection patterns
        secret_patterns = [
            (re.compile(r"""(?:api_key|apikey|secret|token|password)\s*[:=]\s*["']([A-Za-z0-9_\-]{16,})["']""", re.I), "Potential Hardcoded Credential", "high"),
            (re.compile(r"""(?:sk-[a-zA-Z0-9]{20,})"""), "OpenAI API Key Pattern", "high"),
            (re.compile(r"""(?:ghp_[a-zA-Z0-9]{20,})"""), "GitHub Personal Access Token", "high"),
        ]

        # Dangerous function calls
        dangerous_calls = [
            (re.compile(r"""\beval\s*\("""), "Dangerous eval() execution", "high"),
            (re.compile(r"""\bexec\s*\("""), "Dangerous exec() execution", "high"),
            (re.compile(r"""dangerouslySetInnerHTML"""), "Unsafe HTML Injection", "medium"),
        ]

        for rel_path, info in self._file_cache.items():
            # Skip test files, config files, and build artifacts
            if rel_path.startswith(".env") or "test" in rel_path:
                continue

            abs_path = self.workspace_path / rel_path
            try:
                with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                    for line_idx, line in enumerate(f, start=1):
                        stripped = line.strip()
                        if not stripped or stripped.startswith(("#", "//", "/*", "*")):
                            continue

                        # Check secrets
                        for pattern, rule_name, severity in secret_patterns:
                            if pattern.search(line):
                                findings.append({
                                    "file": rel_path,
                                    "line": line_idx,
                                    "rule": rule_name,
                                    "severity": severity,
                                    "snippet": stripped[:80],
                                    "recommendation": "Move secrets to .env and load via environment variables.",
                                })

                        # Check dangerous functions
                        for pattern, rule_name, severity in dangerous_calls:
                            if pattern.search(line):
                                findings.append({
                                    "file": rel_path,
                                    "line": line_idx,
                                    "rule": rule_name,
                                    "severity": severity,
                                    "snippet": stripped[:80],
                                    "recommendation": "Avoid using dynamic code execution; use safe alternative APIs.",
                                })
            except Exception:
                continue

        return findings

    def get_symbol_suggestions(self, prefix: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """Provides fast symbol & file autocomplete suggestions."""
        clean = prefix.strip().lower()
        if not clean:
            return []

        suggestions = []
        seen = set()

        # Match files
        for p in self._file_cache:
            if clean in p.lower():
                suggestions.append({
                    "name": self._file_cache[p]["file_name"],
                    "kind": "file",
                    "path": p,
                })
                seen.add(p)
                if len(suggestions) >= max_results:
                    return suggestions

        # Match symbols
        for sym_name, sym_list in self._symbols.items():
            if clean in sym_name:
                for s in sym_list:
                    key = f"{s['name']}:{s['file']}"
                    if key not in seen:
                        seen.add(key)
                        suggestions.append({
                            "name": s["name"],
                            "kind": s["kind"],
                            "path": s["file"],
                            "line": s.get("line", 1),
                        })
                        if len(suggestions) >= max_results:
                            return suggestions

        return suggestions
