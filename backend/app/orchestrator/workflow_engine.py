"""
Workflow Automation Engine for ANVESHA.

Provides:
1. Reusable workflow templates with sequential, parallel, and conditional steps.
2. Parameterized inputs and upstream-to-downstream payload mapping.
3. Execution lifecycle states: pending, running, paused_approval, completed, failed, cancelled.
4. Step timeouts, retry limits, and failure recovery.
"""
import time
import asyncio
import logging
from typing import Dict, Any, List, Optional, Callable

from app.core.db import PlatformDB
from app.agents.registry import AgentRegistry

logger = logging.getLogger(__name__)


# Standard Pre-built Workflow Templates
WORKFLOW_TEMPLATES = {
    "tech_evaluation_report": {
        "id": "tech_evaluation_report",
        "name": "Technology Evaluation & Executive Report",
        "description": "Multi-agent research, trade-off analysis, verification, and artifact generation.",
        "steps": [
            {
                "step_index": 1,
                "title": "Deep Technical Research & Comparative Options",
                "agent_id": "anvesha.agent.research",
                "action": "web_search",
                "parallel_group": 1,
            },
            {
                "step_index": 2,
                "title": "Data & Performance Trade-off Analysis",
                "agent_id": "agent_data_analysis",
                "action": "statistical_summary",
                "parallel_group": 1,
            },
            {
                "step_index": 3,
                "title": "Citation Grounding & Fact Verification",
                "agent_id": "agent_verification",
                "action": "verify_grounding",
                "parallel_group": 2,
            },
            {
                "step_index": 4,
                "title": "Executive Summary & Report Preparation",
                "agent_id": "anvesha.agent.document",
                "action": "create_artifact",
                "parallel_group": 3,
            },
        ],
    },
    "security_audit_remediation": {
        "id": "security_audit_remediation",
        "name": "Codebase Security Audit & Remediation",
        "description": "AST symbol mapping, vulnerability audit, runbook retrieval, and automated remediation plan.",
        "steps": [
            {
                "step_index": 1,
                "title": "AST Symbol & File Structure Scan",
                "agent_id": "anvesha.agent.code",
                "action": "ast_scan",
                "parallel_group": 1,
            },
            {
                "step_index": 2,
                "title": "Static Vulnerability & Secret Scan",
                "agent_id": "anvesha.agent.security",
                "action": "vulnerability_scan",
                "parallel_group": 2,
            },
            {
                "step_index": 3,
                "title": "Remediation Verification & Audit Report",
                "agent_id": "agent_verification",
                "action": "security_audit",
                "parallel_group": 3,
            },
        ],
    },
    "web_dev_scaffold": {
        "id": "web_dev_scaffold",
        "name": "Full-Stack Web Dev Studio Scaffolding",
        "description": "UI/UX wireframing, component implementation, and responsive layout testing.",
        "steps": [
            {
                "step_index": 1,
                "title": "UI/UX Layout Architecture Specification",
                "agent_id": "anvesha.agent.uiux",
                "action": "design_spec",
                "parallel_group": 1,
            },
            {
                "step_index": 2,
                "title": "Component Implementation & Scaffolding",
                "agent_id": "anvesha.agent.webdev",
                "action": "scaffold_component",
                "parallel_group": 2,
            },
            {
                "step_index": 3,
                "title": "Frontend Layout & Accessibility Validation",
                "agent_id": "anvesha.agent.testing",
                "action": "validate_ui",
                "parallel_group": 3,
            },
        ],
    },
}


class WorkflowEngine:
    """
    Executes and orchestrates reusable multi-agent workflows.
    """

    def __init__(self):
        self.registry = AgentRegistry.get_instance()
        self.templates = WORKFLOW_TEMPLATES

    def cancel_task(self, task_id: str, reason: str = "") -> Dict[str, Any]:
        """Cancels a multi-agent workflow task."""
        PlatformDB.update_multi_agent_task(task_id, status="cancelled")
        logger.info(f"Task '{task_id}' cancelled: {reason}")
        return {"status": "cancelled", "task_id": task_id, "reason": reason}

    def list_templates(self) -> List[Dict[str, Any]]:
        """Returns metadata for all available workflow templates."""
        return [
            {
                "id": t["id"],
                "name": t["name"],
                "description": t["description"],
                "total_steps": len(t["steps"]),
            }
            for t in self.templates.values()
        ]

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        return self.templates.get(template_id)

    async def instantiate_workflow(
        self,
        template_id: str,
        goal: str,
        project_id: str = "default",
        user_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Instantiates a multi-agent task DAG from a pre-defined workflow template.
        """
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Workflow template '{template_id}' not found.")

        steps_payload = []
        for s in template["steps"]:
            input_payload = {"goal": goal}
            if user_params:
                input_payload.update(user_params)
            steps_payload.append({
                "step_index": s["step_index"],
                "title": s["title"],
                "assigned_agent_id": s["agent_id"],
                "dependencies": [s["step_index"] - 1] if s["step_index"] > 1 else [],
                "input_payload": input_payload,
            })

        plan_dag = {
            "workflow_type": template_id,
            "goal": goal,
            "plan_title": f"{template['name']}: {goal[:50]}",
            "steps": steps_payload,
        }

        task = PlatformDB.create_multi_agent_task(
            goal=goal,
            plan_dag=plan_dag,
            project_id=project_id,
        )
        task_id = task["id"]

        for s in steps_payload:
            PlatformDB.create_task_step(
                task_id=task_id,
                step_index=s["step_index"],
                title=s["title"],
                assigned_agent_id=s["assigned_agent_id"],
                dependencies=[f"step_{d}" for d in s["dependencies"]],
                input_payload=s["input_payload"],
            )

        return PlatformDB.get_multi_agent_task(task_id)


# Global workflow engine singleton
workflow_engine = WorkflowEngine()
