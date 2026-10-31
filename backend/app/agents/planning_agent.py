"""
Planning Agent for ANVESHA.
Specializes in objective decomposition, dependency graph formulation,
resource allocation, and multi-agent workflow scheduling.
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent, AgentExecutionContext, AgentExecutionResult
from app.core.ai_provider import ai_provider


class PlanningAgent(BaseAgent):
    """Specialized Agent for goal decomposition and dependency graph construction."""

    def __init__(self):
        super().__init__(
            agent_id="agent_planning",
            name="Planning Agent",
            role="Autonomous Strategy & Workflow Architect",
            description="Decomposes user objectives into ordered subtasks, assigns optimal agents, and maps dependency constraints.",
            capabilities=[
                "task_decomposition",
                "dependency_graph_mapping",
                "resource_estimation",
                "critical_path_analysis",
                "execution_checkpointing"
            ],
            permissions=["plan:workflow", "read:workspace"],
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
        objective = step_input.get("objective") or step_input.get("query") or step_input.get("goal") or "Formulate plan"

        system_prompt = (
            "You are the Anvesha Planning Agent. Break down the user's high-level goal into an ordered "
            "step-by-step DAG (Directed Acyclic Graph) of subtasks. Assign each subtask to an appropriate specialist: "
            "Research Agent, Coding Agent, Data Analysis Agent, Verification Agent, UI/UX Agent, Documentation Agent, or Web Development Agent."
        )
        prompt = (
            f"User Goal: {objective}\n\n"
            "Format the response into:\n"
            "1. Executive Plan Overview\n"
            "2. Subtask Breakdown with Dependencies (Task ID, Assigned Agent, Dependencies, Acceptance Criteria)\n"
            "3. Critical Path & Potential Risks\n"
            "4. Required Human Approvals (if consequential actions are needed)"
        )

        response = await ai_provider.generate_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=1800
        )

        return AgentExecutionResult(
            success=True,
            summary=f"Formulated execution plan for: {objective[:60]}",
            output={
                "plan": response,
                "objective": objective,
                "status": "plan_formulated"
            }
        )

    async def cleanup(self) -> None:
        pass
