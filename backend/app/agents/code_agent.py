"""
Anvesha V2: Code Intelligence Agent.

Specialized in static code analysis, AST parsing, dependency mapping, and test coverage gap detection.
Uses CodebaseIntelligence engine to inspect files within workspace boundaries.
"""
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent, AgentExecutionContext, AgentExecutionResult
from engine.codebase_intelligence import CodebaseIntelligence
from app.core.config import settings


class CodeAgent(BaseAgent):
    """Inspects workspace code, extracts AST symbols, dependencies, and test gaps."""

    def __init__(self, workspace_path: Optional[str] = None):
        super().__init__(
            agent_id="anvesha.agent.code",
            name="Code Intelligence Agent",
            description="Performs AST static analysis, dependency graph extraction, symbol indexing, and test coverage gap discovery.",
            role="Codebase Specialist",
            capabilities=["code:ast_scan", "code:dependency_graph", "code:test_gaps", "code:inspect_file"],
            permissions=["workspace:read", "memory:write_semantic"],
            model_provider="auto"
        )
        ws = workspace_path or str(Path(__file__).resolve().parents[3])
        self.code_intel = CodebaseIntelligence(ws)

    async def initialize(self) -> None:
        self.register_tool("code:ast_scan", self._tool_ast_scan)
        self.register_tool("code:dependency_graph", self._tool_dependency_graph)
        self.register_tool("code:test_gaps", self._tool_test_gaps)
        self.register_tool("code:inspect_file", self._tool_inspect_file)

    def _tool_ast_scan(self, file_path: Optional[str] = None) -> Dict[str, Any]:
        self.code_intel.reindex()
        all_syms = self.code_intel._symbols or {}
        file_count = len(self.code_intel._file_cache)
        total_syms = sum(len(v) for v in all_syms.values())
        sample = [s["name"] for sym_list in list(all_syms.values())[:25] for s in sym_list[:1]]
        return {
            "total_files": file_count,
            "total_symbols": total_syms,
            "symbols_sample": sample
        }

    def _tool_dependency_graph(self) -> Dict[str, Any]:
        self.code_intel.reindex()
        return self.code_intel.get_dependency_graph()

    def _tool_test_gaps(self) -> Dict[str, Any]:
        self.code_intel.reindex()
        return self.code_intel.analyze_test_gaps()

    def _tool_inspect_file(self, file_path: str) -> Dict[str, Any]:
        target = (self.code_intel.root_path / file_path).resolve()
        if not str(target).startswith(str(self.code_intel.root_path.resolve())):
            raise ValueError("Path traversal outside workspace root is blocked.")
        if not target.exists() or not target.is_file():
            return {"file_path": file_path, "error": "File not found"}
        content = target.read_text(encoding="utf-8", errors="replace")
        return {"file_path": file_path, "content": content[:2000], "size": len(content)}

    async def execute_step(
        self,
        task_id: str,
        step_id: str,
        input_payload: Dict[str, Any],
        context: AgentExecutionContext
    ) -> AgentExecutionResult:
        action = input_payload.get("action", "ast_scan")
        file_path = input_payload.get("file_path")

        try:
            if action == "test_gaps":
                gaps = await context.invoke_tool("code:test_gaps", {})
                summary = f"Detected {gaps.get('untested_modules', 0)} untested modules. Overall test coverage estimate: {gaps.get('coverage_percentage', 0)}%."
                return AgentExecutionResult(
                    success=True,
                    summary=summary,
                    output=gaps,
                    governance_logs=context.governance_audit
                )

            if action == "dependencies":
                deps = await context.invoke_tool("code:dependency_graph", {})
                summary = f"Mapped dependency graph across {deps.get('total_files', 0)} codebase files."
                return AgentExecutionResult(
                    success=True,
                    summary=summary,
                    output=deps,
                    governance_logs=context.governance_audit
                )

            # Default: AST scan
            ast_data = await context.invoke_tool("code:ast_scan", {"file_path": file_path})

            # Real model reasoning step using Gemini
            model_analysis = await self.call_model(
                messages=[{
                    "role": "user",
                    "content": f"Analyze these codebase AST structure metrics:\n- Total symbols: {ast_data.get('total_symbols')}\n- Sample symbols: {ast_data.get('symbols_sample', [])[:15]}\nProvide a concise 2-sentence architectural summary of the codebase structure."
                }],
                system_prompt="You are the Anvesha Code Intelligence Agent, an expert software architect. Analyze codebase structure concisely and accurately."
            )

            summary = model_analysis or f"Codebase AST analysis completed. Identified {ast_data.get('total_symbols', 0)} symbols across workspace modules."
            return AgentExecutionResult(
                success=True,
                summary=summary,
                output={**ast_data, "ai_architectural_analysis": model_analysis},
                governance_logs=context.governance_audit
            )
        except Exception as e:
            return AgentExecutionResult(
                success=False,
                summary=f"Code analysis failed: {str(e)}",
                output={},
                error=str(e),
                governance_logs=context.governance_audit
            )
