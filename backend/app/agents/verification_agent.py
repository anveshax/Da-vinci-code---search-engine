"""
Verification Agent for ANVESHA.
Specializes in claim validation, test verification, code auditing,
citation grounding checks, and intermediate result validation.
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent, AgentExecutionContext, AgentExecutionResult
from app.core.ai_provider import ai_provider
from engine.citation_verifier import citation_verifier


class VerificationAgent(BaseAgent):
    """Specialized Agent for quality assurance, assertion checks, and grounding verification."""

    def __init__(self):
        super().__init__(
            agent_id="agent_verification",
            name="Verification Agent",
            role="Quality Assurance & Verification Auditor",
            description="Audits intermediate agent results, executes assertions, verifies citation grounding, and validates acceptance criteria.",
            capabilities=[
                "assertion_verification",
                "citation_grounding_audit",
                "test_validation",
                "security_audit",
                "acceptance_criteria_check"
            ],
            permissions=["read:workspace", "verify:artifacts"],
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
        claim_or_code = step_input.get("content") or step_input.get("output") or step_input.get("upstream_outputs", "")
        evidence_sources = step_input.get("sources") or []

        # Run automated grounding check if sources are present
        grounding_result = citation_verifier.verify_answer_grounding(
            str(claim_or_code),
            evidence_sources
        ) if evidence_sources else None

        system_prompt = (
            "You are the Anvesha Verification Agent. Your mandate is to rigorously verify "
            "that claims are supported by facts, code changes meet requirements, and no hallucinations exist."
        )
        prompt = (
            f"Content to Verify:\n{claim_or_code}\n\n"
            f"Automated Citation Audit:\n{grounding_result}\n\n"
            "Produce an audit report with: 1. Verification Verdict (PASS/FAIL/CONDITIONAL), "
            "2. Identified Inconsistencies or Hallucinations, 3. Corrective Recommendations."
        )

        response = await ai_provider.generate_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=1500
        )

        verdict_pass = "VERDICT: PASS" in response.upper() or "STATUS: PASS" in response.upper()

        return AgentExecutionResult(
            success=True,
            summary=f"Completed verification audit for step {step_id}",
            output={
                "audit_report": response,
                "grounding_audit": grounding_result,
                "verdict_pass": verdict_pass
            }
        )

    async def cleanup(self) -> None:
        pass
