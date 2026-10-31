"""
ANVESHA: Adaptive AI Operating System Test Suite.

Verifies:
1. AdaptiveTaskClassifier:
   - Task complexity (simple, moderate, complex, autonomous)
   - Execution strategies (direct_stream, deep_research_loop, dag_orchestration)
   - Risk evaluation & human approval triggering
   - Layout recommendation (search, deep_research, explorer, multi_agent, governance)
2. ModelRouter 2.0:
   - Multi-factor capability scoring
   - Latency telemetry recording & summaries
   - Transparent primary provider routing
3. SelfOptimizer:
   - Telemetry analytics (task stats, step bottlenecks, repeated errors)
   - Actionable recommendation generation
   - Strict human review guardrail enforcement
4. REST APIs:
   - /api/v2/adaptive/classify
   - /api/v2/adaptive/router-status
   - /api/v2/adaptive/optimization-report
   - /api/v2/adaptive/recommendations/{id}/action
   - /api/v2/adaptive/intent-logs
"""
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.core.db import PlatformDB, init_db
from app.core.adaptive_classifier import AdaptiveTaskClassifier
from app.core.model_router import model_router, MODEL_CAPABILITY_PROFILES
from app.core.self_optimizer import SelfOptimizer


class TestAdaptiveAIOS(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def test_01_adaptive_task_classification_autonomous(self):
        """Tests that a complex security and remediation prompt is classified as autonomous multi-agent."""
        prompt = "Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report."
        res = AdaptiveTaskClassifier.classify_task(prompt)

        self.assertEqual(res["task_type"], "multi_agent")
        self.assertEqual(res["complexity"], "autonomous")
        self.assertEqual(res["execution_strategy"], "dag_orchestration")
        self.assertEqual(res["recommended_layout"], "multi_agent")
        self.assertGreaterEqual(res["complexity_score"], 8)
        self.assertGreaterEqual(len(res["required_agents"]), 4)
        self.assertTrue(res["memory_requirements"]["episodic"])
        self.assertTrue(res["memory_requirements"]["procedural"])
        self.assertIn("anvesha.agent.code", res["required_agents"])
        self.assertIn("anvesha.agent.security", res["required_agents"])
        print("\nPASS: test_01_adaptive_task_classification_autonomous")

    def test_02_adaptive_task_classification_code_and_search(self):
        """Tests classification for code exploration and simple search."""
        # Code exploration query
        code_res = AdaptiveTaskClassifier.classify_task("Inspect AST symbols and dependency graph for codebase intelligence")
        self.assertEqual(code_res["task_type"], "code")
        self.assertEqual(code_res["recommended_layout"], "explorer")
        self.assertIn("anvesha.agent.code", code_res["required_agents"])

        # Simple search query
        search_res = AdaptiveTaskClassifier.classify_task("What is binary search algorithm?")
        self.assertEqual(search_res["complexity"], "simple")
        self.assertEqual(search_res["execution_strategy"], "direct_stream")
        self.assertEqual(search_res["recommended_layout"], "search")
        print("PASS: test_02_adaptive_task_classification_code_and_search")

    def test_03_high_risk_human_approval_detection(self):
        """Tests that destructive keywords trigger human approval requirement."""
        high_risk_prompt = "Delete outdated configuration files and execute shell drop tables"
        res = AdaptiveTaskClassifier.classify_task(high_risk_prompt)

        self.assertTrue(res["requires_human_approval"])
        self.assertGreaterEqual(res["risk_score"], 80)
        print("PASS: test_03_high_risk_human_approval_detection")

    def test_04_model_router_capabilities_and_telemetry(self):
        """Tests multi-factor model router profiles and telemetry persistence."""
        # Verify capability profiles
        self.assertIn("gemini", MODEL_CAPABILITY_PROFILES)
        self.assertIn("groq", MODEL_CAPABILITY_PROFILES)
        self.assertGreater(MODEL_CAPABILITY_PROFILES["gemini"]["context_window"], 500000)

        # Route a coding task
        routed = model_router.route_task("code")
        self.assertIn(routed["provider"], ["gemini", "groq", "openrouter", "openai_compatible"])
        self.assertTrue(bool(routed["reason"]))

        # Record telemetry
        telem_id = PlatformDB.record_model_telemetry(
            provider_id="gemini",
            model_name="gemini-3.1-flash-lite",
            task_type="code",
            latency_ms=450,
            tokens_used=120,
            success=True
        )
        self.assertTrue(telem_id.startswith("telem_"))

        summary = PlatformDB.get_model_telemetry_summary()
        self.assertGreaterEqual(len(summary), 1)
        gemini_summary = next((s for s in summary if s["provider_id"] == "gemini"), None)
        self.assertIsNotNone(gemini_summary)
        self.assertGreater(gemini_summary["total_calls"], 0)
        print("PASS: test_04_model_router_capabilities_and_telemetry")

    def test_05_self_optimization_engine_and_guardrail(self):
        """Tests that SelfOptimizer analyzes execution metrics and enforces governance safeguard."""
        report = SelfOptimizer.generate_system_health_and_optimization_report()

        self.assertEqual(report["status"], "healthy")
        self.assertIn("execution_metrics", report)
        self.assertIn("governance_safeguard", report)
        self.assertIn("human", report["governance_safeguard"].lower())
        self.assertGreaterEqual(len(report["active_recommendations"]), 1)

        # Verify recommendation structure
        rec = report["active_recommendations"][0]
        self.assertIn(rec["category"], ["performance", "prompt", "workflow", "model"])
        self.assertIn(rec["impact_level"], ["high", "medium", "low"])
        print("PASS: test_05_self_optimization_engine_and_guardrail")

    def test_06_adaptive_rest_apis(self):
        """Tests end-to-end HTTP endpoints for the Adaptive AI Operating System."""
        # 1. Classification endpoint
        res1 = self.client.post("/api/v2/adaptive/classify", json={
            "prompt": "Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report."
        })
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertEqual(data1["task_type"], "multi_agent")
        self.assertEqual(data1["complexity"], "autonomous")
        self.assertEqual(data1["recommended_layout"], "multi_agent")

        # 2. Router status endpoint
        res2 = self.client.get("/api/v2/adaptive/router-status")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(data2["status"], "active")
        self.assertIn("capability_matrix", data2)

        # 3. Optimization report endpoint
        res3 = self.client.get("/api/v2/adaptive/optimization-report")
        self.assertEqual(res3.status_code, 200)
        data3 = res3.json()
        self.assertIn("execution_metrics", data3)
        self.assertGreaterEqual(len(data3["active_recommendations"]), 1)

        # 4. Action recommendation endpoint
        rec_id = data3["active_recommendations"][0]["id"]
        res4 = self.client.post(f"/api/v2/adaptive/recommendations/{rec_id}/action", json={
            "decision": "approved",
            "reviewed_by": "lead_architect"
        })
        self.assertEqual(res4.status_code, 200)
        self.assertEqual(res4.json()["recommendation"]["status"], "approved")
        self.assertEqual(res4.json()["recommendation"]["reviewed_by"], "lead_architect")

        # 5. Intent logs endpoint
        res5 = self.client.get("/api/v2/adaptive/intent-logs?limit=5")
        self.assertEqual(res5.status_code, 200)
        logs = res5.json()
        self.assertGreaterEqual(len(logs), 1)
        print("PASS: test_06_adaptive_rest_apis")


if __name__ == "__main__":
    unittest.main()
