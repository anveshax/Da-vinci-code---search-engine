"""
Anvesha V2: Security Analysis Agent.

Specialized in static vulnerability analysis, hardcoded secret discovery,
injection flaws, dangerous dynamic code execution (eval/exec), and risk assessment.
"""
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent, AgentExecutionContext, AgentExecutionResult
from engine.codebase_intelligence import CodebaseIntelligence


class SecurityAgent(BaseAgent):
    """Audits codebases for credentials, dynamic execution, injection, and security flaws."""

    def __init__(self, workspace_path: Optional[str] = None):
        super().__init__(
            agent_id="anvesha.agent.security",
            name="Security Analysis Agent",
            description="Scans repository for hardcoded secrets, injection vectors, dangerous execution calls, and calculates risk scores.",
            role="Security Auditor",
            capabilities=["security:scan_secrets", "security:scan_dangerous_calls", "security:assess_risk"],
            permissions=["workspace:read", "security:audit", "governance:flag_risk"],
            model_provider="auto"
        )
        ws = workspace_path or str(Path(__file__).resolve().parents[3])
        self.code_intel = CodebaseIntelligence(ws)

    async def initialize(self) -> None:
        self.register_tool("security:scan_secrets", self._tool_scan_secrets)
        self.register_tool("security:scan_dangerous_calls", self._tool_scan_dangerous_calls)
        self.register_tool("security:assess_risk", self._tool_assess_risk)

    def _tool_scan_secrets(self) -> List[Dict[str, Any]]:
        insights = self.code_intel.scan_security_insights()
        return [i for i in insights if "Secret" in i.get("rule", "") or "Key" in i.get("rule", "")]

    def _tool_scan_dangerous_calls(self) -> List[Dict[str, Any]]:
        insights = self.code_intel.scan_security_insights()
        return [i for i in insights if "eval" in i.get("rule", "").lower() or "exec" in i.get("rule", "").lower()]

    def _tool_assess_risk(self) -> Dict[str, Any]:
        all_insights = self.code_intel.scan_security_insights()
        critical_count = sum(1 for i in all_insights if i.get("severity") == "critical")
        high_count = sum(1 for i in all_insights if i.get("severity") == "high")
        med_count = sum(1 for i in all_insights if i.get("severity") == "medium")
        low_count = sum(1 for i in all_insights if i.get("severity") == "low")

        # Composite score calculation
        score = min(100, (critical_count * 30) + (high_count * 15) + (med_count * 5) + (low_count * 2))
        return {
            "total_findings": len(all_insights),
            "critical_count": critical_count,
            "high_count": high_count,
            "medium_count": med_count,
            "low_count": low_count,
            "overall_risk_score": score,
            "findings": all_insights
        }

    async def execute_step(
        self,
        task_id: str,
        step_id: str,
        input_payload: Dict[str, Any],
        context: AgentExecutionContext
    ) -> AgentExecutionResult:
        try:
            # Governed security assessment
            risk_report = await context.invoke_tool("security:assess_risk", {})

            findings = risk_report.get("findings", [])

            # Real model reasoning step using Gemini
            model_analysis = await self.call_model(
                messages=[{
                    "role": "user",
                    "content": f"Analyze these vulnerability scan findings:\nRisk Score: {risk_report.get('overall_risk_score')}/100\nTop Findings: {findings[:4]}\nProvide a concise 2-3 sentence threat assessment prioritizing critical remediation."
                }],
                system_prompt="You are the Anvesha Security Analysis Agent, a senior AppSec auditor. Evaluate exploitability and prioritized fixes."
            )

            summary_lines = [
                f"Security audit completed. Found {len(findings)} potential security findings.",
                f"- High/Critical Findings: {risk_report.get('high_count', 0)}",
                f"- Medium Findings: {risk_report.get('medium_count', 0)}",
                f"- Calculated Codebase Risk Score: {risk_report.get('overall_risk_score', 0)}/100"
            ]

            if model_analysis:
                summary_lines.append(f"\n**Security Threat Assessment:**\n{model_analysis}")
            elif findings:
                summary_lines.append("\n**Top Findings:**")
                for f in findings[:3]:
                    summary_lines.append(f"- **{f.get('rule')}** in `{f.get('file')}:{f.get('line')}`: {f.get('recommendation')}")

            return AgentExecutionResult(
                success=True,
                summary="\n".join(summary_lines),
                output={**risk_report, "ai_threat_assessment": model_analysis},
                governance_logs=context.governance_audit
            )
        except Exception as e:
            return AgentExecutionResult(
                success=False,
                summary=f"Security scan failed: {str(e)}",
                output={},
                error=str(e),
                governance_logs=context.governance_audit
            )
