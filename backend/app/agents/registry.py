"""
Anvesha V2: Standardized Agent Registry.

Manages agent registration, capability mapping, lifecycle states, and runtime resolution.
Holds all 9 specialized platform agents.
"""
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent
from app.agents.research_agent import ResearchAgent
from app.agents.code_agent import CodeAgent
from app.agents.document_agent import DocumentAgent
from app.agents.knowledge_agent import KnowledgeAgent
from app.agents.security_agent import SecurityAgent
from app.agents.ui_ux_agent import UIUXDesignAgent
from app.agents.web_dev_agent import WebDevelopmentAgent
from app.agents.visual_agent import VisualImplementationAgent
from app.agents.testing_agent import FrontendTestingAgent
from app.agents.data_analysis_agent import DataAnalysisAgent
from app.agents.planning_agent import PlanningAgent
from app.agents.verification_agent import VerificationAgent
from app.core.db import PlatformDB


class AgentRegistry:
    """Singleton registry holding active agent instances."""

    _instance: Optional["AgentRegistry"] = None

    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {}
        self._initialized = False

    @classmethod
    def get_instance(cls) -> "AgentRegistry":
        if cls._instance is None:
            cls._instance = AgentRegistry()
        return cls._instance

    async def initialize(self) -> None:
        """Instantiates and registers all specialized platform agents."""
        if self._initialized:
            return

        core_agents: List[BaseAgent] = [
            ResearchAgent(),
            CodeAgent(),
            DataAnalysisAgent(),
            PlanningAgent(),
            VerificationAgent(),
            UIUXDesignAgent(),
            DocumentAgent(),
            WebDevelopmentAgent(),
            VisualImplementationAgent(),
            FrontendTestingAgent(),
            KnowledgeAgent(),
            SecurityAgent(),
        ]

        for agent in core_agents:
            await agent.initialize()
            self._agents[agent.id] = agent
            # Sync to SQLite agents table
            PlatformDB.register_agent(
                agent_id=agent.id,
                name=agent.name,
                description=agent.description,
                role=agent.role,
                system_prompt=f"You are the Anvesha {agent.name}.",
                capabilities=agent.capabilities,
                permissions=agent.permissions,
                model_provider=agent.model_provider,
                model_name=agent.model_name
            )

        self._initialized = True

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        """Retrieves an active agent instance by its unique ID."""
        return self._agents.get(agent_id)

    def list_agents(self) -> List[BaseAgent]:
        """Returns all registered agent instances."""
        return list(self._agents.values())

    def find_agent_by_capability(self, capability: str) -> Optional[BaseAgent]:
        """Matches a requested tool or capability to a registered agent."""
        for agent in self._agents.values():
            if capability in agent.capabilities:
                return agent
        return None
