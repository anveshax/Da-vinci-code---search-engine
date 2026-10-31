"""
Anvesha V2: Standardized Agent SDK Base Interfaces.

Defines the contract for all platform agents:
- BaseAgent lifecycle: initialize(), execute_step(), cleanup()
- AgentExecutionContext: Governed tool execution proxy
- AgentExecutionResult: Structured outcome with citations and audit trace
"""
import time
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Callable
from app.governance.engine import CentralGovernanceEngine, GovernanceDecision, ActionRequiresApprovalError, GovernanceViolationError
from app.core.db import PlatformDB


class AgentExecutionContext:
    """
    Execution context provided to agents during step execution.
    Forces all tool invocations through the Central Governance Engine.
    """

    def __init__(
        self,
        task_id: str,
        step_id: str,
        agent_id: str,
        permissions: List[str],
        tool_registry: Dict[str, Callable]
    ):
        self.task_id = task_id
        self.step_id = step_id
        self.agent_id = agent_id
        self.permissions = permissions
        self.tool_registry = tool_registry
        self.governance_audit: List[Dict[str, Any]] = []

    async def invoke_tool(self, action: str, parameters: Dict[str, Any]) -> Any:
        """
        Governed tool invocation proxy.
        1. Evaluates policy & risk via CentralGovernanceEngine.
        2. Halts if REQUIRE_APPROVAL or DENY.
        3. Executes tool function and returns result.
        """
        gov_report = CentralGovernanceEngine.verify_action(
            agent_id=self.agent_id,
            agent_permissions=self.permissions,
            action=action,
            parameters=parameters,
            task_id=self.task_id,
            step_id=self.step_id,
            auto_request_approval=True
        )
        self.governance_audit.append(gov_report)

        decision = gov_report.get("decision")
        if decision == GovernanceDecision.REQUIRE_APPROVAL.value:
            req = gov_report.get("approval_request") or {}
            raise ActionRequiresApprovalError(
                request_id=req.get("id", "appr_unknown"),
                action=action,
                risk_score=gov_report.get("risk_score", 75),
                explanation=gov_report.get("explanation", "Operation requires administrator approval.")
            )

        if decision == GovernanceDecision.DENY.value:
            raise GovernanceViolationError(f"Tool execution for '{action}' was denied by governance policy.")

        # Find tool handler
        tool_fn = self.tool_registry.get(action)
        if not tool_fn:
            raise ValueError(f"Agent '{self.agent_id}' does not have a registered handler for tool '{action}'.")

        # Execute tool
        import inspect
        if inspect.iscoroutinefunction(tool_fn):
            return await tool_fn(**parameters)
        return tool_fn(**parameters)


class AgentExecutionResult:
    """Structured response from an agent after executing a step."""

    def __init__(
        self,
        success: bool,
        summary: str,
        output: Dict[str, Any],
        citations: Optional[List[Any]] = None,
        governance_logs: Optional[List[Dict[str, Any]]] = None,
        error: Optional[str] = None
    ):
        self.success = success
        self.summary = summary
        self.output = output
        self.citations = citations or []
        self.governance_logs = governance_logs or []
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "summary": self.summary,
            "output": self.output,
            "citations": self.citations,
            "governance_logs": self.governance_logs,
            "error": self.error,
        }


class BaseAgent(ABC):
    """Abstract base class for all specialized Anvesha AI agents."""

    def __init__(
        self,
        agent_id: str,
        name: str,
        description: str,
        role: str,
        capabilities: List[str],
        permissions: List[str],
        model_provider: str = "auto",
        model_name: Optional[str] = None
    ):
        self.id = agent_id
        self.name = name
        self.description = description
        self.role = role
        self.capabilities = capabilities
        self.permissions = permissions
        self.model_provider = model_provider
        self.model_name = model_name
        self.tools: Dict[str, Callable] = {}

    def register_tool(self, action: str, handler: Callable) -> None:
        """Registers a callable tool function under a specific action identifier."""
        self.tools[action] = handler

    @abstractmethod
    async def initialize(self) -> None:
        """Called once during platform initialization to bind tools and verify environment."""
        pass

    @abstractmethod
    async def execute_step(
        self,
        task_id: str,
        step_id: str,
        input_payload: Dict[str, Any],
        context: AgentExecutionContext
    ) -> AgentExecutionResult:
        """Executes a planned subtask with governed tool execution."""
        pass

    async def cleanup(self) -> None:
        """Default teardown hook."""
        pass

    async def call_model(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.2
    ) -> Optional[str]:
        """
        Executes an independent model inference call for this specialized agent
        using the active AI provider (Google Gemini).
        """
        from app.core.ai_provider import ai_provider, create_provider_instance
        try:
            if self.model_provider != "auto":
                configs = ai_provider.get_configured_providers()
                cfg = configs.get(self.model_provider, {})
                if cfg.get("api_key"):
                    inst = create_provider_instance(
                        self.model_provider,
                        cfg["api_key"],
                        self.model_name or cfg.get("model"),
                        cfg.get("base_url")
                    )
                    return await inst.generate_chat(
                        messages,
                        system_prompt=system_prompt,
                        max_tokens=max_tokens,
                        temperature=temperature
                    )

            # Use active default provider (Gemini)
            primary, _ = ai_provider.get_primary_provider()
            if primary and primary.api_key:
                return await primary.generate_chat(
                    messages,
                    system_prompt=system_prompt,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"Agent {self.id} model call skipped or offline: {exc}")
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "role": self.role,
            "capabilities": self.capabilities,
            "permissions": self.permissions,
            "model_provider": self.model_provider,
            "model_name": self.model_name,
        }
