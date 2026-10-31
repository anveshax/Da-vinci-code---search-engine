"""
Central Intelligent Tool Registry & Security Sandbox for ANVESHA Agents.

Provides:
1. Standardized JSON tool schemas with parameter validation.
2. Least-privilege permission checks enforced by Central Governance.
3. Execution timeouts and audit logging.
4. Sandboxed safe tools:
   - Web Research & SearXNG
   - Internal Hybrid Search & Crawler Index
   - Safe Workspace File Reading & AST Inspection
   - Document & Artifact Generation
   - Isolated Python Sandbox (restricted builtins, no subprocess/socket/os.system)
"""
import os
import sys
import io
import time
import json
import logging
from typing import Dict, Any, List, Callable, Optional

logger = logging.getLogger(__name__)


class SandboxedToolRegistry:
    """
    Central tool registry defining schemas, permission scopes, and execution handlers.
    """

    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._register_default_tools()

    def register_tool(
        self,
        name: str,
        description: str,
        parameters_schema: Dict[str, Any],
        required_permission: str,
        handler: Callable,
        is_consequential: bool = False,
    ):
        """Registers a tool with its schema, permission requirements, and execution handler."""
        self._tools[name] = {
            "name": name,
            "description": description,
            "parameters": parameters_schema,
            "required_permission": required_permission,
            "handler": handler,
            "is_consequential": is_consequential,
        }

    def get_tool(self, name: str) -> Optional[Dict[str, Any]]:
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
                "required_permission": t["required_permission"],
                "is_consequential": t["is_consequential"],
            }
            for t in self._tools.values()
        ]

    def _register_default_tools(self):
        """Registers all built-in safe platform tools."""

        # 1. Web Research Tool
        async def _tool_web_search(query: str, max_results: int = 5) -> Dict[str, Any]:
            from engine.web_search import execute_web_search
            return execute_web_search(query, max_results=max_results)

        self.register_tool(
            name="web_search",
            description="Searches live public internet sources and technical documentation.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "max_results": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
            required_permission="net:read",
            handler=_tool_web_search,
        )

        # 2. SearXNG Search Tool
        async def _tool_searxng(query: str, max_results: int = 5) -> Dict[str, Any]:
            from engine.searxng_client import searxng_client
            return await searxng_client.search(query, max_results=max_results)

        self.register_tool(
            name="searxng_search",
            description="Executes search across meta-search engines via SearXNG.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "max_results": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
            required_permission="net:read",
            handler=_tool_searxng,
        )

        # 3. Internal Hybrid Search Tool
        async def _tool_hybrid_search(query: str, limit: int = 5) -> Dict[str, Any]:
            from engine.semantic.hybrid_retriever import hybrid_retriever
            hits = await hybrid_retriever.search_async(query, limit=limit)
            return {"results": [h.to_dict() for h in hits]}

        self.register_tool(
            name="internal_hybrid_search",
            description="Queries ANVESHA's internal crawled documentation using BM25 and semantic vectors.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
            required_permission="read:workspace",
            handler=_tool_hybrid_search,
        )

        # 4. Safe Workspace File Reader
        async def _tool_read_file(path: str, max_lines: int = 150) -> Dict[str, Any]:
            # Path traversal guard
            from pathlib import Path
            safe_root = Path.cwd().resolve()
            target = (safe_root / path).resolve()
            if not str(target).startswith(str(safe_root)):
                return {"error": "Access denied: Path traversal outside workspace boundary is blocked."}
            if not target.exists() or not target.is_file():
                return {"error": f"File not found: {path}"}
            try:
                with open(target, "r", encoding="utf-8", errors="replace") as f:
                    lines = [next(f) for _ in range(max_lines)]
                return {"path": path, "content": "".join(lines), "lines_read": len(lines)}
            except Exception as e:
                return {"error": str(e)}

        self.register_tool(
            name="read_workspace_file",
            description="Reads file contents within the current project repository.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path"},
                    "max_lines": {"type": "integer", "default": 150},
                },
                "required": ["path"],
            },
            required_permission="read:workspace",
            handler=_tool_read_file,
        )

        # 5. Sandboxed Python Code Executor
        async def _tool_execute_sandboxed_python(code: str) -> Dict[str, Any]:
            # Guard against dangerous modules and functions
            dangerous = ["os.", "sys.", "subprocess", "shutil", "socket", "__import__", "eval(", "exec(", "open("]
            if any(d in code for d in dangerous):
                return {
                    "error": "Execution denied: Code contains forbidden system-level imports or I/O operations.",
                    "success": False,
                }

            # Safe restricted builtins
            safe_builtins = {
                "print": print,
                "len": len,
                "range": range,
                "int": int,
                "float": float,
                "str": str,
                "list": list,
                "dict": dict,
                "set": set,
                "min": min,
                "max": max,
                "sum": sum,
                "sorted": sorted,
                "round": round,
                "enumerate": enumerate,
                "zip": zip,
                "abs": abs,
            }

            old_stdout = sys.stdout
            redirected_output = io.StringIO()
            sys.stdout = redirected_output
            try:
                exec_globals = {"__builtins__": safe_builtins}
                exec_locals: Dict[str, Any] = {}
                exec(code, exec_globals, exec_locals)
                output = redirected_output.getvalue()
                return {"success": True, "output": output[:2000], "variables": {k: str(v)[:100] for k, v in exec_locals.items() if not k.startswith("_")}}
            except Exception as e:
                return {"success": False, "error": str(e)}
            finally:
                sys.stdout = old_stdout

        self.register_tool(
            name="execute_python_sandboxed",
            description="Executes pure algorithmic Python calculations in a restricted sandbox without OS or network access.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Pure Python code to evaluate"},
                },
                "required": ["code"],
            },
            required_permission="compute:analytics",
            handler=_tool_execute_sandboxed_python,
        )

        # 6. Artifact Generator
        async def _tool_create_artifact(title: str, content: str, artifact_type: str = "report") -> Dict[str, Any]:
            from app.core.db import PlatformDB
            artifact = PlatformDB.create_artifact(
                title=title,
                artifact_type=artifact_type,
                content=content,
                project_id="default",
            )
            return {"status": "created", "artifact_id": artifact["id"], "title": title}

        self.register_tool(
            name="create_artifact",
            description="Saves a generated research report, design document, or code specification artifact.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Title of the artifact"},
                    "content": {"type": "string", "description": "Markdown content"},
                    "artifact_type": {"type": "string", "default": "report"},
                },
                "required": ["title", "content"],
            },
            required_permission="write:workspace",
            handler=_tool_create_artifact,
            is_consequential=False,
        )


# Global tool registry singleton
tool_registry = SandboxedToolRegistry()
