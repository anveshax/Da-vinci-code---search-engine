"""
Automated Test Suite for ANVESHA Phase 3 Autonomous Agentic Intelligence:
- Module 8: Multi-Agent Orchestration & Agent Registry
- Module 9: Autonomous Planning & DAG Dependency Management
- Module 10: Intelligent Tool Registry & Security Sandbox
- Module 11: Persistent Multi-Tier Intelligence Memory & Semantic Retrieval
- Module 12: Workflow Automation Engine & Templates
- Module 13: Voice Assistant Controller Contracts
- Module 14: Self-Monitoring & Controlled Optimization
"""
import unittest
import asyncio
from backend.app.agents.registry import AgentRegistry
from backend.app.orchestrator.planner import TaskPlanner
from backend.app.orchestrator.tool_registry import tool_registry
from backend.app.memory.service import OrganizationalMemoryService
from backend.app.orchestrator.workflow_engine import workflow_engine
from backend.app.orchestrator.orchestrator import MultiAgentOrchestrator
from backend.app.core.self_optimizer import SelfOptimizer
from backend.app.governance.engine import CentralGovernanceEngine, GovernanceDecision
from backend.app.core.db import PlatformDB


class TestPhase3AgenticIntelligence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = AgentRegistry.get_instance()
        asyncio.run(cls.registry.initialize())

    def test_01_agent_registry_and_specialists(self):
        """Verify all specialized agents are registered with defined capabilities and permissions."""
        agents = self.registry.list_agents()
        self.assertGreaterEqual(len(agents), 9)

        agent_ids = {a.id for a in agents}
        self.assertIn("agent_data_analysis", agent_ids)
        self.assertIn("agent_planning", agent_ids)
        self.assertIn("agent_verification", agent_ids)
        self.assertIn("anvesha.agent.research", agent_ids)
        self.assertIn("anvesha.agent.code", agent_ids)
        self.assertIn("anvesha.agent.uiux", agent_ids)
        self.assertIn("anvesha.agent.document", agent_ids)
        self.assertIn("anvesha.agent.webdev", agent_ids)

        # Check permissions and capabilities are strictly typed
        data_agent = self.registry.get_agent("agent_data_analysis")
        self.assertIsNotNone(data_agent)
        self.assertIn("statistical_summary", data_agent.capabilities)
        self.assertIn("compute:analytics", data_agent.permissions)

    def test_02_autonomous_planner_technology_evaluation(self):
        """Verify planner breaks complex objective into dependency-ordered DAG steps."""
        goal = "Research a technology, compare available approaches, create a report and prepare a presentation."
        plan = TaskPlanner.plan_workflow(goal)

        self.assertEqual(plan["workflow_type"], "technology_evaluation_and_presentation")
        steps = plan["steps"]
        self.assertEqual(len(steps), 5)

        # Step 1: Research (no dependencies)
        self.assertEqual(steps[0]["step_index"], 1)
        self.assertEqual(steps[0]["assigned_agent_id"], "anvesha.agent.research")
        self.assertEqual(steps[0]["dependencies"], [])

        # Step 2: Data Analysis (depends on Step 1)
        self.assertEqual(steps[1]["step_index"], 2)
        self.assertEqual(steps[1]["assigned_agent_id"], "agent_data_analysis")
        self.assertEqual(steps[1]["dependencies"], [1])

        # Step 3: Verification (depends on 1 and 2)
        self.assertEqual(steps[2]["step_index"], 3)
        self.assertEqual(steps[2]["assigned_agent_id"], "agent_verification")
        self.assertEqual(steps[2]["dependencies"], [1, 2])

        # Step 4: Documentation Report (depends on 1, 2, 3)
        self.assertEqual(steps[3]["step_index"], 4)
        self.assertEqual(steps[3]["assigned_agent_id"], "anvesha.agent.document")

        # Step 5: Presentation Layout (depends on 4)
        self.assertEqual(steps[4]["step_index"], 5)
        self.assertEqual(steps[4]["assigned_agent_id"], "anvesha.agent.uiux")

    def test_03_tool_registry_and_sandbox_security(self):
        """Verify tool registry schemas and security sandbox blocking hostile execution."""
        tools = tool_registry.list_tools()
        self.assertGreaterEqual(len(tools), 5)
        tool_names = {t["name"] for t in tools}
        self.assertIn("web_search", tool_names)
        self.assertIn("searxng_search", tool_names)
        self.assertIn("internal_hybrid_search", tool_names)
        self.assertIn("read_workspace_file", tool_names)
        self.assertIn("execute_python_sandboxed", tool_names)
        self.assertIn("create_artifact", tool_names)

        # Test sandboxed execution allows safe math
        sandbox = tool_registry.get_tool("execute_python_sandboxed")
        safe_run = asyncio.run(sandbox["handler"](code="a = [x*2 for x in range(5)]\nprint('Total:', sum(a))"))
        self.assertTrue(safe_run["success"])
        self.assertIn("Total: 20", safe_run["output"])

        # Test sandboxed execution BLOCKS hostile system commands
        hostile_run = asyncio.run(sandbox["handler"](code="import os\nos.system('rm -rf /')"))
        self.assertFalse(hostile_run["success"])
        self.assertIn("denied", hostile_run["error"].lower())

    def test_04_persistent_memory_and_semantic_retrieval(self):
        """Verify memory records are stored, scoped, and retrieved via semantic similarity."""
        import uuid
        proj = PlatformDB.create_project(name=f"test_p3_{uuid.uuid4().hex[:6]}")
        test_pid = proj["id"]
        mem = OrganizationalMemoryService.add_memory(
            memory_type="procedural",
            title="Python Package Deployment Runbook",
            content="When deploying Python services, always use virtual environments and pin exact wheel hashes.",
            created_by="test_harness",
            project_id=test_pid
        )
        self.assertIn("id", mem)

        # Keyword query
        retrieved_lex = OrganizationalMemoryService.query_memory(
            query="virtual environments wheel hashes",
            memory_type="procedural",
            project_id=test_pid
        )
        self.assertGreaterEqual(len(retrieved_lex), 1)

        # Semantic query with paraphrased words
        retrieved_sem = OrganizationalMemoryService.search_memory_semantic(
            query="isolating packages during application release",
            memory_type="procedural",
            project_id=test_pid,
            limit=3
        )
        self.assertGreaterEqual(len(retrieved_sem), 1)
        titles = [r.get("title") for r in retrieved_sem]
        self.assertIn("Python Package Deployment Runbook", titles)

    def test_05_workflow_templates_and_instantiation(self):
        """Verify reusable workflow templates and execution instantiation."""
        templates = workflow_engine.list_templates()
        self.assertGreaterEqual(len(templates), 3)

        # Instantiate a workflow template
        task = asyncio.run(
            workflow_engine.instantiate_workflow(
                template_id="tech_evaluation_report",
                goal="Evaluate FastAPI vs Flask for enterprise microservices",
                project_id="default"
            )
        )
        self.assertIn("id", task)
        self.assertEqual(len(task.get("steps", [])), 4)

    def test_06_self_monitoring_and_governance(self):
        """Verify self-monitoring diagnostic report and governance approval policies."""
        report = SelfOptimizer.generate_system_health_and_optimization_report()
        self.assertIn("status", report)
        self.assertIn("execution_metrics", report)
        self.assertIn("active_recommendations", report)

        # Verify Central Governance evaluates permissions
        gov_pass = CentralGovernanceEngine.verify_action(
            agent_id="anvesha.agent.research",
            agent_permissions=["net:read"],
            action="web_search",
            parameters={"query": "test"},
            task_id="test_task_1",
            step_id="test_step_1",
        )
        self.assertEqual(gov_pass["decision"], GovernanceDecision.ALLOW.value)

        # High-risk action requires human approval
        gov_high_risk = CentralGovernanceEngine.verify_action(
            agent_id="anvesha.agent.code",
            agent_permissions=["write:workspace"],
            action="tool:code_exec",
            parameters={"code": "import os; os.system('env')"},
            task_id="test_task_1",
            step_id="test_step_2",
            auto_request_approval=False
        )
        self.assertEqual(gov_high_risk["decision"], GovernanceDecision.REQUIRE_APPROVAL.value)


if __name__ == "__main__":
    unittest.main()
