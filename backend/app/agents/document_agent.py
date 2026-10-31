"""
Anvesha V2: Document Intelligence Agent.

Specialized in processing, querying, and citing enterprise documents (PDF, DOCX, Markdown, TXT)
with exact page numbers and line range tracking.
"""
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent, AgentExecutionContext, AgentExecutionResult
from app.core.db import PlatformDB


class DocumentAgent(BaseAgent):
    """Retrieves grounded document intelligence with page and line citations."""

    def __init__(self):
        super().__init__(
            agent_id="anvesha.agent.document",
            name="Document Intelligence Agent",
            description="Extracts and queries multi-format documentation (PDF, DOCX, Markdown, TXT) with page and line citations.",
            role="Document Specialist",
            capabilities=["document:list", "document:query_chunks", "document:get_chunk"],
            permissions=["document:read", "memory:read_semantic"],
            model_provider="auto"
        )

    async def initialize(self) -> None:
        self.register_tool("document:list", self._tool_list_documents)
        self.register_tool("document:query_chunks", self._tool_query_chunks)
        self.register_tool("document:get_chunk", self._tool_get_chunk)

    def _tool_list_documents(self, project_id: str = "default") -> List[Dict[str, Any]]:
        return PlatformDB.list_documents(project_id)

    def _tool_query_chunks(self, query: str, project_id: str = "default", limit: int = 5) -> List[Dict[str, Any]]:
        return PlatformDB.search_document_chunks(query=query, project_id=project_id, limit=limit)

    def _tool_get_chunk(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return PlatformDB.get_document(doc_id)

    async def execute_step(
        self,
        task_id: str,
        step_id: str,
        input_payload: Dict[str, Any],
        context: AgentExecutionContext
    ) -> AgentExecutionResult:
        query = input_payload.get("query") or input_payload.get("goal") or "architecture"
        project_id = input_payload.get("project_id", "default")
        limit = int(input_payload.get("limit", 4))

        try:
            chunks = await context.invoke_tool(
                "document:query_chunks",
                {"query": query, "project_id": project_id, "limit": limit}
            )

            citations = []
            for c in chunks:
                loc = f"Page {c.get('page_number', 1)}"
                if c.get("line_start"):
                    loc += f", Lines L{c.get('line_start')}-L{c.get('line_end')}"
                citations.append({
                    "title": c.get("filename", "Document"),
                    "location": loc,
                    "snippet": c.get("content", "")[:200]
                })

            summary = f"Retrieved {len(chunks)} grounded document chunks for query: '{query}'."
            return AgentExecutionResult(
                success=True,
                summary=summary,
                output={"query": query, "chunks": chunks},
                citations=citations,
                governance_logs=context.governance_audit
            )
        except Exception as e:
            return AgentExecutionResult(
                success=False,
                summary=f"Document retrieval failed: {str(e)}",
                output={},
                error=str(e),
                governance_logs=context.governance_audit
            )
