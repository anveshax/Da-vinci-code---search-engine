"""
Data Analysis Agent for ANVESHA.
Specializes in metrics computation, tabular data processing, statistical aggregation,
and structured insights synthesis.
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent, AgentExecutionContext, AgentExecutionResult
from app.core.ai_provider import ai_provider


class DataAnalysisAgent(BaseAgent):
    """Specialized Agent for data inspection, metric analysis, and chart data formatting."""

    def __init__(self):
        super().__init__(
            agent_id="agent_data_analysis",
            name="Data Analysis Agent",
            role="Data & Statistical Intelligence Specialist",
            description="Analyzes tabular data, computes distributions, identifies trends, and produces structured analytical summaries.",
            capabilities=[
                "data_inspection",
                "statistical_summary",
                "trend_analysis",
                "chart_synthesis",
                "anomaly_detection"
            ],
            permissions=["read:workspace", "compute:analytics"],
            model_provider="gemini",
            model_name="gemini-3.5-flash-lite"
        )

    async def initialize(self) -> None:
        pass

    async def execute_step(
        self,
        task_id: str,
        step_id: str,
        input_payload: Dict[str, Any],
        context: AgentExecutionContext
    ) -> AgentExecutionResult:
        step_input = input_payload
        query = step_input.get("query") or step_input.get("instruction") or step_input.get("goal") or "Analyze dataset"
        raw_data = step_input.get("data") or step_input.get("context", "")

        system_prompt = (
            "You are the Anvesha Data Analysis Agent. Your responsibility is to analyze data, "
            "compute numerical insights, identify statistical outliers, and summarize metrics in structured tables."
        )
        prompt = (
            f"Objective: {query}\n\n"
            f"Data / Context:\n{raw_data}\n\n"
            "Provide a structured analysis with: 1. Key Metrics, 2. Observed Trends, 3. Statistical Distribution, 4. Actionable Insights."
        )

        response = await ai_provider.generate_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=1500
        )

        return AgentExecutionResult(
            success=True,
            summary=f"Completed statistical analysis for: {query[:60]}",
            output={
                "analysis": response,
                "summary": f"Completed statistical analysis for: {query[:60]}",
                "metrics_computed": True
            }
        )

    async def cleanup(self) -> None:
        pass
