"""
Anvesha Adaptive Intelligence Engine: Task & Intent Classifier.

Analyzes user queries to determine:
- Task complexity (simple, moderate, complex, autonomous)
- Appropriate model & configured provider
- Required specialized agents
- Required tools & permissions
- Context & organizational memory requirements
- Execution strategy (direct_stream, deep_research_loop, dag_orchestration)
- Human approval requirement & risk score
- Recommended adaptive workspace layout
"""
import re
import time
from typing import Dict, Any, List, Optional
from app.core.ai_provider import ai_provider, DEFAULT_MODELS
from app.core.db import PlatformDB


class AdaptiveTaskClassifier:
    """
    Evaluates incoming prompts and maps them to the optimal execution strategy,
    agent pipeline, and frontend workspace layout.
    """

    # Keyword dictionaries for pattern-based fast intent matching
    PATTERNS = {
        "web_dev": [
            r"\b(website|dashboard|component|landing page|web app|ui design|frontend code)\b",
            r"\b(build website|create dashboard|scaffold component|wireframe)\b",
        ],
        "multi_agent": [
            r"\b(analyze.*codebase.*security|security weaknesses.*remediation|prepare.*report)\b",
            r"\b(multi[- ]agent|orchestrat|delegate|audit.*remediate|collaborat)\b",
            r"\b(security.*audit|threat.*assessment|vulnerability.*scan)\b",
            r"\b(full.*audit|comprehensive.*analysis|remediation.*plan)\b",
        ],
        "code": [
            r"\b(ast|syntax|refactor|function|class|method|import|dependency|dependencies)\b",
            r"\b(file|directory|folder|repo|repository|traceback|coverage|unit test)\b",
            r"\b(python|javascript|typescript|fastapi|react|sql|sqlite|bug|error|exception)\b",
            r"\b(inspect|debug|fix|codebase|symbol|symbols)\b",
        ],
        "research": [
            r"\b(research|deep dive|literature|whitepaper|compare|comparison|benchmarks)\b",
            r"\b(state of the art|landscape|industry standards|owasp|architecture doc)\b",
            r"\b(in[- ]depth|investigate|survey)\b",
        ],
        "governance": [
            r"\b(governance|policy|policies|compliance|audit trail|approval|approvals)\b",
            r"\b(permission|permissions|organizational memory|runbook|runbooks)\b",
        ],
        "search": [
            r"\b(search|find|where is|locate|what is|how to|who is|explain|tell me)\b",
        ]
    }

    @classmethod
    def classify_task(
        cls,
        prompt: str,
        user_layout_preference: Optional[str] = None,
        user_provider_preference: Optional[str] = None,
        user_model_preference: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Classifies task complexity, execution requirements, and workspace layout.
        """
        p_lower = prompt.lower().strip()
        word_count = len(prompt.split())

        # 1. Match intent category
        scores = {category: 0 for category in cls.PATTERNS}
        scores["search"] = 1

        for category, patterns in cls.PATTERNS.items():
            for pat in patterns:
                matches = re.findall(pat, p_lower)
                if matches:
                    scores[category] += len(matches) * 2

        # Adjust score by specific intent markers
        if any(term in p_lower for term in ["security", "weakness", "remediation", "orchestrat", "dag"]):
            scores["multi_agent"] += 4
        if any(term in p_lower for term in ["def ", "class ", "import ", "error", "traceback"]):
            scores["code"] += 3
        if any(term in p_lower for term in ["cite", "sources", "deep research", "paper"]):
            scores["research"] += 3

        best_category = max(scores, key=lambda k: scores[k])

        # 2. Complexity determination
        if scores["multi_agent"] >= 4 or (word_count > 25 and ("code" in best_category or "research" in best_category)):
            complexity = "autonomous"
            complexity_score = 9
            strategy = "dag_orchestration"
        elif best_category == "research" or word_count > 15:
            complexity = "complex"
            complexity_score = 7
            strategy = "deep_research_loop"
        elif best_category == "web_dev":
            complexity = "complex"
            complexity_score = 8
            strategy = "dag_orchestration"
        elif best_category == "code":
            complexity = "moderate"
            complexity_score = 5
            strategy = "direct_stream"
        else:
            complexity = "simple"
            complexity_score = 2
            strategy = "direct_stream"

        # 3. Required Agents & Tools mapping
        required_agents = []
        required_tools = []
        memory_requirements = {"episodic": False, "procedural": False, "semantic": False}
        requires_approval = False
        risk_score = 15

        # Global High-Risk Security Guardrail Check
        if any(term in p_lower for term in ["delete", "overwrite", "drop", "execute", "shell", "rm ", "modify file", "drop tables"]):
            requires_approval = True
            risk_score = 90

        if best_category == "multi_agent" or complexity == "autonomous":
            required_agents = [
                "anvesha.agent.code",
                "anvesha.agent.security",
                "anvesha.agent.research",
                "anvesha.agent.knowledge"
            ]
            required_tools = [
                "code:ast_scan",
                "code:dependency_graph",
                "security:assess_risk",
                "web_search",
                "memory:retrieve"
            ]
            memory_requirements = {"episodic": True, "procedural": True, "semantic": True}
            if not requires_approval:
                risk_score = 75

        elif best_category == "web_dev":
            required_agents = [
                "anvesha.agent.uiux",
                "anvesha.agent.webdev",
                "anvesha.agent.visual",
                "anvesha.agent.testing"
            ]
            required_tools = [
                "uiux:generate_design_spec",
                "webdev:scaffold_component",
                "visual:apply_theme_tokens",
                "testing:check_responsive_layout"
            ]
            memory_requirements = {"semantic": True, "procedural": True, "episodic": True}
            risk_score = 30

        elif best_category == "code":
            required_agents = ["anvesha.agent.code"]
            required_tools = ["code:ast_scan", "code:dependency_graph", "code:test_gaps"]
            memory_requirements = {"semantic": True, "procedural": False, "episodic": False}
            risk_score = 25

        elif best_category == "research":
            required_agents = ["anvesha.agent.research"]
            required_tools = ["web_search", "web_scrape"]
            memory_requirements = {"episodic": True, "procedural": False, "semantic": True}
            risk_score = 20

        elif best_category == "governance":
            required_agents = ["anvesha.agent.knowledge"]
            required_tools = ["memory:retrieve", "governance:policy_check"]
            memory_requirements = {"procedural": True, "episodic": True, "semantic": False}
            risk_score = 40

        else:
            required_agents = ["anvesha.agent.research"]
            required_tools = ["web_search"]
            risk_score = 10

        # Enforce high risk score if approval is required
        if requires_approval:
            risk_score = max(risk_score, 90)

        # 4. Map recommended workspace layout
        layout_map = {
            "web_dev": "web_studio",
            "multi_agent": "multi_agent",
            "code": "explorer",
            "research": "deep_research",
            "governance": "governance",
            "search": "search",
        }
        recommended_layout = layout_map.get(best_category, "search")

        # 5. Resolve Model & Provider via configured providers
        configured = ai_provider.get_configured_providers()
        primary_inst, _ = ai_provider.get_primary_provider()
        
        active_provider = user_provider_preference or primary_inst.provider_id
        active_model = user_model_preference or primary_inst.model

        # Build classification rationale
        rationale = (
            f"Classified as {complexity.upper()} {best_category.upper()} workflow (Confidence: {min(98, 65 + scores[best_category] * 5)}%). "
            f"Strategy '{strategy}' selected using {len(required_agents)} specialized agent(s) and {active_provider.upper()} ({active_model})."
        )

        result = {
            "task_type": best_category,
            "complexity": complexity,
            "complexity_score": complexity_score,
            "confidence": min(0.98, round(0.65 + (scores[best_category] * 0.05), 2)),
            "recommended_layout": recommended_layout,
            "effective_layout": user_layout_preference or recommended_layout,
            "execution_strategy": strategy,
            "provider": active_provider,
            "model": active_model,
            "required_agents": required_agents,
            "required_tools": required_tools,
            "memory_requirements": memory_requirements,
            "requires_human_approval": requires_approval,
            "risk_score": risk_score,
            "rationale": rationale,
            "timestamp": time.time()
        }

        # Log intent for adaptive self-optimization learning
        PlatformDB.log_adaptive_intent(
            query_text=prompt,
            classified_type=best_category,
            complexity=complexity,
            confidence=result["confidence"],
            selected_layout=recommended_layout,
            selected_model=active_model,
            user_override_layout=user_layout_preference
        )

        return result
