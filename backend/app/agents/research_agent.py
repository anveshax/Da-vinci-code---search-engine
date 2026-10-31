"""
Anvesha V2: Research Agent.

Specialized in external technical research, documentation lookups, and vulnerability remediation investigations.
Uses real search engines (Tavily, Brave, Exa, DuckDuckGo) via web_search.py with zero Wikipedia fallback.
"""
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent, AgentExecutionContext, AgentExecutionResult
from engine.web_search import execute_web_search, fetch_page_content_safe


class ResearchAgent(BaseAgent):
    """Gathers verified external technical information and official remediation advisories."""

    def __init__(self):
        super().__init__(
            agent_id="anvesha.agent.research",
            name="Research Agent",
            description="Researches live web sources, official documentation, security advisories, and library guides.",
            role="Technical Researcher",
            capabilities=["web:search", "web:scrape_page"],
            permissions=["network:external_search", "network:http_fetch", "memory:write_semantic"],
            model_provider="auto"
        )

    async def initialize(self) -> None:
        self.register_tool("web:search", self._tool_web_search)
        self.register_tool("web:scrape_page", self._tool_scrape_page)

    def _tool_web_search(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        res = execute_web_search(query, max_results=max_results)
        return res.get("results", [])

    async def _tool_scrape_page(self, url: str) -> Dict[str, Any]:
        text = await fetch_page_content_safe(url, max_chars=3000)
        return {"url": url, "content": text or ""}

    async def execute_step(
        self,
        task_id: str,
        step_id: str,
        input_payload: Dict[str, Any],
        context: AgentExecutionContext
    ) -> AgentExecutionResult:
        query = input_payload.get("query") or input_payload.get("goal") or "Python security remediation best practices"
        max_results = int(input_payload.get("max_results", 5))

        try:
            # Governed tool invocation
            search_results = await context.invoke_tool(
                "web:search",
                {"query": query, "max_results": max_results}
            )

            citations = [
                {"title": r.get("title", "External Source"), "url": r.get("url", ""), "snippet": r.get("snippet", "")}
                for r in search_results
            ]

            # Real model reasoning step using Gemini
            snippets_text = "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in search_results[:3]])
            model_analysis = await self.call_model(
                messages=[{
                    "role": "user",
                    "content": f"Based on these technical search results for '{query}':\n{snippets_text}\nSynthesize a concise 2-sentence technical remediation recommendation citing industry standards."
                }],
                system_prompt="You are the Anvesha Technical Research Agent. Synthesize verified industry standards and security advisories concisely."
            )

            summary_points = [
                f"- **[{r.get('title', 'Source')}]({r.get('url', '#')})**: {r.get('snippet', '')}"
                for r in search_results[:3]
            ]
            base_summary = f"Completed technical research for: '{query}'. Found {len(search_results)} verified external sources."
            if model_analysis:
                summary = f"{base_summary}\n\n**Research Synthesis:**\n{model_analysis}\n\n" + "\n".join(summary_points)
            else:
                summary = f"{base_summary}\n\n" + "\n".join(summary_points)

            return AgentExecutionResult(
                success=True,
                summary=summary,
                output={
                    "query": query,
                    "results_count": len(search_results),
                    "results": search_results,
                    "ai_research_synthesis": model_analysis
                },
                citations=citations,
                governance_logs=context.governance_audit
            )
        except Exception as e:
            return AgentExecutionResult(
                success=False,
                summary=f"Research step failed: {str(e)}",
                output={},
                error=str(e),
                governance_logs=context.governance_audit
            )
