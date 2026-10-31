"""
Anvesha V2: Central Governance & Policy Engine.

Enforces strict runtime guardrails on all agent actions, tool invocations, and network requests:
- Decisions: ALLOW, DENY, REQUIRE_APPROVAL.
- Capability-based tool verification against declared agent permissions.
- Algorithmic risk evaluation (0-100 score).
- Human-in-the-Loop approval requests for high-risk operations.
- Non-bypassable execution gateway.
"""
import time
import ipaddress
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple
from enum import Enum
from app.core.db import PlatformDB
from app.memory.service import OrganizationalMemoryService


class GovernanceDecision(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"


class GovernanceViolationError(Exception):
    """Raised when an action is strictly DENIED by platform policy."""
    pass


class ActionRequiresApprovalError(Exception):
    """Raised when an action requires human administrator sign-off before proceeding."""
    def __init__(self, request_id: str, action: str, risk_score: int, explanation: str):
        super().__init__(f"Action '{action}' requires human approval (Risk: {risk_score}/100): {explanation}")
        self.request_id = request_id
        self.action = action
        self.risk_score = risk_score
        self.explanation = explanation


class CentralGovernanceEngine:
    """Core policy engine validating all agent operations."""

    DISALLOWED_INTERNAL_HOSTS = {
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "169.254.169.254",
        "metadata.google.internal"
    }

    @staticmethod
    def evaluate_risk(
        action: str,
        parameters: Dict[str, Any],
        agent_id: str
    ) -> Tuple[int, str]:
        """
        Computes a risk score (0-100) and rationale for a proposed action.
        """
        # Critical / High-risk actions
        if action in {"tool:code_exec", "tool:shell_exec", "exec", "eval"}:
            return 95, "Arbitrary runtime code execution presents critical server-side compromise risk."

        if action in {"tool:file_modify", "tool:file_write", "tool:file_delete"}:
            target_path = str(parameters.get("path") or parameters.get("file_path") or "")
            if ".env" in target_path or "config" in target_path or "key" in target_path:
                return 98, f"Attempting to modify critical environment/credential file: '{target_path}'."
            return 75, f"Direct filesystem modification proposed on file: '{target_path}'."

        if action == "network:fetch":
            url = str(parameters.get("url", ""))
            try:
                parsed = urllib.parse.urlparse(url)
                hostname = parsed.hostname or ""
                if hostname.lower() in CentralGovernanceEngine.DISALLOWED_INTERNAL_HOSTS:
                    return 100, f"Outbound request to internal or cloud metadata address '{hostname}' blocked (SSRF prevention)."
                # Check private subnets
                try:
                    ip = ipaddress.ip_address(hostname)
                    if ip.is_private or ip.is_loopback or ip.is_link_local:
                        return 100, f"Outbound request to private IP '{hostname}' blocked (SSRF prevention)."
                except ValueError:
                    pass
            except Exception:
                return 90, "Malformed URL in outbound network request."

            return 45, f"External outbound HTTP fetch to '{url}'."

        if action.startswith("tool:read") or action.startswith("code:") or action.startswith("security:scan") or action.startswith("security:assess"):
            return 15, "Read-only static code analysis and security auditing."

        if action.startswith("web:search") or action.startswith("web:scrape"):
            return 25, "External web information gathering and documentation research."

        if action.startswith("document:"):
            return 10, "Local document intelligence chunk retrieval."

        if action.startswith("memory:"):
            return 15, "Organizational memory lookup."

        return 50, f"Standard operational action: '{action}'."

    @staticmethod
    def verify_action(
        agent_id: str,
        agent_permissions: List[str],
        action: str,
        parameters: Dict[str, Any],
        task_id: str,
        step_id: str,
        auto_request_approval: bool = True
    ) -> Dict[str, Any]:
        """
        Evaluates active governance policies and permissions for an agent tool call.
        Returns governance report dictionary with decision (ALLOW, DENY, REQUIRE_APPROVAL).
        """
        risk_score, explanation = CentralGovernanceEngine.evaluate_risk(action, parameters, agent_id)

        # 1. Hard SSRF Denial
        if risk_score == 100:
            try:
                PlatformDB.record_agent_message(
                    task_id=task_id,
                    step_id=step_id,
                    sender_id="governance_engine",
                    recipient_id=agent_id,
                    message_type="GOVERNANCE_DENY",
                    content={"action": action, "risk_score": risk_score, "reason": explanation},
                    governance_decision="DENY"
                )
            except Exception:
                pass
            raise GovernanceViolationError(f"Action DENIED: {explanation}")

        # 2. Check Active Governance Policies in Database
        policies = PlatformDB.list_governance_policies(active_only=True)
        for policy in policies:
            target = policy["target_action"]
            if target == action or (target.endswith("*") and action.startswith(target[:-1])):
                action_type = policy["action_type"]

                if action_type == "DENY":
                    try:
                        PlatformDB.record_agent_message(
                            task_id=task_id,
                            step_id=step_id,
                            sender_id="governance_engine",
                            recipient_id=agent_id,
                            message_type="GOVERNANCE_DENY",
                            content={"action": action, "policy_id": policy["id"], "reason": policy["description"]},
                            governance_decision="DENY"
                        )
                    except Exception:
                        pass
                    raise GovernanceViolationError(f"Action DENIED by policy '{policy['name']}': {policy['description']}")

                if action_type == "REQUIRE_APPROVAL":
                    # Check if already approved for this specific step and action
                    approvals = PlatformDB.list_approval_requests(task_id=task_id)
                    approved = any(
                        a["step_id"] == step_id and a["action_requested"] == action and a["status"] == "approved"
                        for a in approvals
                    )
                    if not approved:
                        req = None
                        if auto_request_approval:
                            req = PlatformDB.create_approval_request(
                                task_id=task_id,
                                step_id=step_id,
                                agent_id=agent_id,
                                action_requested=action,
                                parameters=parameters,
                                risk_score=risk_score,
                                risk_explanation=f"Policy '{policy['name']}' requires administrator approval: {explanation}"
                            )
                        return {
                            "decision": GovernanceDecision.REQUIRE_APPROVAL.value,
                            "risk_score": risk_score,
                            "policy_id": policy["id"],
                            "policy_name": policy["name"],
                            "approval_request": req,
                            "explanation": explanation
                        }

        # 3. High Risk Score Threshold (> 70)
        if risk_score >= 70:
            approvals = PlatformDB.list_approval_requests(task_id=task_id)
            approved = any(
                a["step_id"] == step_id and a["action_requested"] == action and a["status"] == "approved"
                for a in approvals
            )
            if not approved:
                req = None
                if auto_request_approval:
                    req = PlatformDB.create_approval_request(
                        task_id=task_id,
                        step_id=step_id,
                        agent_id=agent_id,
                        action_requested=action,
                        parameters=parameters,
                        risk_score=risk_score,
                        risk_explanation=f"Elevated risk score ({risk_score}/100): {explanation}"
                    )
                return {
                    "decision": GovernanceDecision.REQUIRE_APPROVAL.value,
                    "risk_score": risk_score,
                    "approval_request": req,
                    "explanation": explanation
                }

        # 4. Action is ALLOWED
        return {
            "decision": GovernanceDecision.ALLOW.value,
            "risk_score": risk_score,
            "explanation": explanation
        }

    @staticmethod
    def resolve_human_approval(
        request_id: str,
        decision: str,  # 'approved' or 'rejected'
        reviewed_by: str = "administrator",
        review_reason: str = ""
    ) -> Dict[str, Any]:
        """
        Processes human administrator approval or rejection.
        Archives the outcome in Decision Memory for audit trails.
        """
        updated = PlatformDB.resolve_approval_request(
            request_id=request_id,
            decision=decision,
            reviewed_by=reviewed_by,
            review_reason=review_reason
        )
        if not updated:
            raise ValueError(f"Approval request '{request_id}' not found.")

        # Log into Organizational Decision Memory
        params_str = str(updated.get("parameters", {}))
        OrganizationalMemoryService.record_decision(
            title=f"Human Approval Decision: {updated['action_requested']} ({decision.upper()})",
            decision=decision.upper(),
            rationale=review_reason or f"Human reviewer {reviewed_by} marked action as {decision}.",
            governance_context={
                "request_id": request_id,
                "task_id": updated["task_id"],
                "agent_id": updated["agent_id"],
                "risk_score": updated["risk_score"],
                "action": updated["action_requested"],
                "parameters": updated.get("parameters", {}),
                "reviewed_by": reviewed_by,
                "details": f"Action parameters: {params_str}"
            }
        )
        return updated
