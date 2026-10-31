"""
Anvesha V2: Knowledge Agent.

Specialized in institutional knowledge retrieval and retention across:
- Episodic Memory (past tasks and execution traces)
- Semantic Memory (architecture guidelines and documentation)
- Procedural Memory (remediation recipes and runbooks)
- Decision Memory (governance decisions and rationales)
"""
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent, AgentExecutionContext, AgentExecutionResult
from app.memory.service import OrganizationalMemoryService


class KnowledgeAgent(BaseAgent):
    """Custodies and queries shared organizational memory."""

    def __init__(self):
        super().__init__(
            agent_id="anvesha.agent.knowledge",
            name="Knowledge Agent",
            description="Custodies and retrieves organizational memory: past architectural decisions, runbooks, and task memories.",
            role="Knowledge Custodian",
            capabilities=["memory:query_episodic", "memory:query_procedural", "memory:query_decisions", "memory:record_decision"],
            permissions=["memory:read_all", "memory:write_decision", "memory:write_procedural"],
            model_provider="auto"
        )

    async def initialize(self) -> None:
        self.register_tool("memory:query_episodic", self._tool_query_episodic)
        self.register_tool("memory:query_procedural", self._tool_query_procedural)
        self.register_tool("memory:query_decisions", self._tool_query_decisions)
        self.register_tool("memory:record_decision", self._tool_record_decision)

    def _tool_query_episodic(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        return OrganizationalMemoryService.query_memory(query, memory_type="episodic", limit=limit)

    def _tool_query_procedural(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        return OrganizationalMemoryService.query_memory(query, memory_type="procedural", limit=limit)

    def _tool_query_decisions(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        return OrganizationalMemoryService.query_memory(query, memory_type="decision", limit=limit)

    def _tool_record_decision(self, title: str, decision: str, rationale: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return OrganizationalMemoryService.record_decision(
            title=title,
            decision=decision,
            rationale=rationale,
            governance_context=context or {},
            created_by=self.id
        )

    async def execute_step(
        self,
        task_id: str,
        step_id: str,
        input_payload: Dict[str, Any],
        context: AgentExecutionContext
    ) -> AgentExecutionResult:
        query = input_payload.get("query") or input_payload.get("goal") or "remediation"
        mem_type = input_payload.get("memory_type", "procedural")

        try:
            tool_name = f"memory:query_{mem_type}"
            if tool_name not in self.tools:
                tool_name = "memory:query_procedural"

            memories = await context.invoke_tool(tool_name, {"query": query, "limit": 4})

            # Real model reasoning step using Gemini
            mem_text = "\n".join([f"- {m.get('title')}: {m.get('content')}" for m in memories[:3]])
            model_analysis = await self.call_model(
                messages=[{
                    "role": "user",
                    "content": f"Based on these organizational procedural memories for '{query}':\n{mem_text}\nProvide a concise 2-sentence compliance recommendation matching team guidelines."
                }],
                system_prompt="You are the Anvesha Knowledge Custodian. You align technical tasks with organizational policy and runbooks."
            )

            items = [f"- **{m.get('title')}**: {m.get('content')}" for m in memories]
            base_summary = f"Retrieved {len(memories)} organizational memory entries for query: '{query}'."
            if model_analysis:
                summary = f"{base_summary}\n\n**Runbook Alignment:**\n{model_analysis}\n\n" + "\n".join(items)
            else:
                summary = f"{base_summary}\n\n" + "\n".join(items)

            return AgentExecutionResult(
                success=True,
                summary=summary,
                output={
                    "query": query,
                    "memories": memories,
                    "ai_runbook_alignment": model_analysis
                },
                governance_logs=context.governance_audit
            )
        except Exception as e:
            return AgentExecutionResult(
                success=False,
                summary=f"Knowledge retrieval failed: {str(e)}",
                output={},
                error=str(e),
                governance_logs=context.governance_audit
            )
