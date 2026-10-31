"""
Unit and Integration Test Suite for ANVESHA V2: Hybrid Multi-Agent AI Governance Platform.
"""
import unittest
import asyncio
from fastapi.testclient import TestClient

from app.main import app
from app.core.db import init_db, PlatformDB
from app.agents.registry import AgentRegistry
from app.memory.service import OrganizationalMemoryService
from app.governance.engine import (
    CentralGovernanceEngine,
    GovernanceDecision,
    GovernanceViolationError,
    ActionRequiresApprovalError,
)
from app.orchestrator.orchestrator import MultiAgentOrchestrator
from app.orchestrator.gateway import GovernedGateway, GatewaySecurityError


class TestMultiAgentGovernance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def test_01_agent_registry_and_contracts(self):
        """Validates agent SDK, registry discovery, and specialized agent capabilities."""
        reg = AgentRegistry.get_instance()
        asyncio.run(reg.initialize())
        agents = reg.list_agents()
        self.assertGreaterEqual(len(agents), 5)

        agent_ids = [a.id for a in agents]
        self.assertIn("anvesha.agent.code", agent_ids)
        self.assertIn("anvesha.agent.security", agent_ids)
        self.assertIn("anvesha.agent.research", agent_ids)
        self.assertIn("anvesha.agent.document", agent_ids)
        self.assertIn("anvesha.agent.knowledge", agent_ids)

        # Check tool registration
        sec_agent = reg.get_agent("anvesha.agent.security")
        self.assertIsNotNone(sec_agent)
        self.assertIn("security:assess_risk", sec_agent.tools)
        print("PASS: test_agent_registry_and_contracts")

    def test_02_governance_engine_policy_decisions(self):
        """Verifies policy enforcement: ALLOW for reads, REQUIRE_APPROVAL for writes, DENY for SSRF."""
        # 1. Low-risk read action -> ALLOW
        res_allow = CentralGovernanceEngine.verify_action(
            agent_id="anvesha.agent.code",
            agent_permissions=["workspace:read"],
            action="tool:read",
            parameters={"operation": "ast_scan"},
            task_id="test_task",
            step_id="step_1",
            auto_request_approval=False
        )
        self.assertEqual(res_allow["decision"], GovernanceDecision.ALLOW.value)
        self.assertLessEqual(res_allow["risk_score"], 30)

        # 2. Critical SSRF attempt -> DENY
        with self.assertRaises(GovernanceViolationError):
            CentralGovernanceEngine.verify_action(
                agent_id="anvesha.agent.research",
                agent_permissions=["network:http_fetch"],
                action="network:fetch",
                parameters={"url": "http://169.254.169.254/latest/meta-data/"},
                task_id="test_task",
                step_id="step_2",
                auto_request_approval=False
            )

        # 3. High-risk file modify -> REQUIRE_APPROVAL
        res_approval = CentralGovernanceEngine.verify_action(
            agent_id="anvesha.agent.code",
            agent_permissions=["workspace:read"],
            action="tool:file_modify",
            parameters={"file_path": "backend/app/main.py"},
            task_id="test_task",
            step_id="step_3",
            auto_request_approval=False
        )
        self.assertEqual(res_approval["decision"], GovernanceDecision.REQUIRE_APPROVAL.value)
        self.assertGreaterEqual(res_approval["risk_score"], 70)
        print("PASS: test_governance_engine_policy_decisions")

    def test_03_organizational_memory_service(self):
        """Tests episodic, semantic, procedural, and decision memory persistence and retrieval."""
        # Add procedural runbook
        mem = OrganizationalMemoryService.add_memory(
            memory_type="procedural",
            title="Safe Database Connection Lifecycle",
            content="Always utilize context managers ('with get_db_connection() as conn:') to ensure deterministic closure.",
            created_by="anvesha.agent.knowledge",
            metadata={"category": "database", "verified": True}
        )
        self.assertIsNotNone(mem["id"])

        # Query procedural memory
        results = OrganizationalMemoryService.query_memory(
            query="database connection lifecycle",
            memory_type="procedural",
            limit=3
        )
        self.assertGreaterEqual(len(results), 1)
        self.assertTrue(any("Database" in r["title"] for r in results))
        print("PASS: test_organizational_memory_service")

    def test_04_human_in_the_loop_approval_flow(self):
        """Verifies full approval lifecycle: request creation -> admin resolution -> decision memory archive."""
        # Create prerequisite task and step for foreign key integrity
        task = PlatformDB.create_multi_agent_task(goal="Approval flow task", plan_dag={"steps": []})
        step = PlatformDB.create_task_step(
            task_id=task["id"],
            step_index=1,
            title="Dependency Modification Step",
            assigned_agent_id="anvesha.agent.code",
            dependencies=[],
            input_payload={"path": "package.json"}
        )

        # Create approval request
        req = PlatformDB.create_approval_request(
            task_id=task["id"],
            step_id=step["id"],
            agent_id="anvesha.agent.code",
            action_requested="tool:file_modify",
            parameters={"path": "package.json"},
            risk_score=85,
            risk_explanation="Package dependency modification requires review."
        )
        req_id = req["id"]

        # Resolve via Governance Engine
        resolved = CentralGovernanceEngine.resolve_human_approval(
            request_id=req_id,
            decision="approved",
            reviewed_by="admin_alice",
            review_reason="Approved dependency update."
        )
        self.assertEqual(resolved["status"], "approved")
        self.assertEqual(resolved["reviewed_by"], "admin_alice")

        # Verify decision memory record was archived
        decisions = OrganizationalMemoryService.query_memory("package.json", memory_type="decision")
        self.assertGreaterEqual(len(decisions), 1)
        print("PASS: test_human_in_the_loop_approval_flow")

    def test_05_governed_gateway_loop_prevention(self):
        """Verifies circular delegation prevention and maximum call depth enforcement."""
        task = PlatformDB.create_multi_agent_task(goal="Loop prevention task", plan_dag={"steps": []})
        task_id = task["id"]
        gateway = GovernedGateway()

        for i in range(5):
            gateway.route_message(
                task_id=task_id,
                sender_id="anvesha.agent.code",
                recipient_id="anvesha.agent.security",
                message_type="TASK_DELEGATION",
                content={"step": i}
            )

        with self.assertRaises(GatewaySecurityError):
            gateway.route_message(
                task_id=task_id,
                sender_id="anvesha.agent.code",
                recipient_id="anvesha.agent.security",
                message_type="TASK_DELEGATION",
                content={"step": 6}
            )
        print("PASS: test_governed_gateway_loop_prevention")

    def test_06_e2e_security_and_remediation_workflow(self):
        """
        Tests the required end-to-end workflow:
        'Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report.'
        """
        orchestrator = MultiAgentOrchestrator()

        # 1. Plan task
        task = asyncio.run(orchestrator.create_and_plan_task(
            goal="Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report."
        ))
        self.assertIsNotNone(task["id"])
        self.assertEqual(len(task["steps"]), 4)

        # 2. Execute task
        events = []
        async def event_collector(event_type, data):
            events.append((event_type, data))

        completed_task = asyncio.run(orchestrator.execute_task(task["id"], event_callback=event_collector))
        self.assertEqual(completed_task["status"], "completed")
        self.assertIsNotNone(completed_task["final_output"])
        self.assertIn("Executive Multi-Agent Intelligence & Governance Report", completed_task["final_output"])
        self.assertIn("anvesha.agent.security", completed_task["final_output"])
        self.assertIn("anvesha.agent.code", completed_task["final_output"])
        self.assertIn("anvesha.agent.research", completed_task["final_output"])

        # Check episodic memory stored
        memories = PlatformDB.list_organizational_memories(memory_type="episodic")
        self.assertTrue(any(task["id"] in str(m.get("metadata")) for m in memories))
        print("PASS: test_e2e_security_and_remediation_workflow")

    def test_07_governance_and_orchestrator_rest_apis(self):
        """Validates all REST API endpoints for multi-agent governance and orchestration."""
        # 1. GET /api/v2/governance/agents
        res = self.client.get("/api/v2/governance/agents")
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(res.json()["count"], 5)

        # 2. GET /api/v2/governance/policies
        res_pol = self.client.get("/api/v2/governance/policies")
        self.assertEqual(res_pol.status_code, 200)
        self.assertGreaterEqual(res_pol.json()["count"], 4)

        # 3. GET /api/v2/governance/memory
        res_mem = self.client.get("/api/v2/governance/memory?query=security")
        self.assertEqual(res_mem.status_code, 200)

        # 4. POST /api/v2/orchestrator/tasks
        res_task = self.client.post("/api/v2/orchestrator/tasks", json={
            "goal": "Scan codebase dependencies and map security surface",
            "project_id": "default"
        })
        self.assertEqual(res_task.status_code, 200)
        task_id = res_task.json()["task_id"]

        # 5. GET /api/v2/orchestrator/tasks/{task_id}
        res_get_task = self.client.get(f"/api/v2/orchestrator/tasks/{task_id}")
        self.assertEqual(res_get_task.status_code, 200)
        print("PASS: test_governance_and_orchestrator_rest_apis")


if __name__ == "__main__":
    print("Running Anvesha V2 Multi-Agent Governance Test Suite...")
    suite = unittest.TestLoader().loadTestsFromTestCase(TestMultiAgentGovernance)
    runner = unittest.TextTestRunner(verbosity=0)
    result = runner.run(suite)
    if result.wasSuccessful():
        print("\nALL 7 MULTI-AGENT GOVERNANCE TESTS PASSED SUCCESSFULLY!")
    else:
        exit(1)
