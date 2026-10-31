"""
Unit and Integration Test Suite for Anvesha Web Development & UI Engineering Workflow.

Verifies:
1. All 9 specialized agents registered in AgentRegistry
2. TaskPlanner DAG generation for web development requests
3. End-to-end execution across UI/UX, WebDev, Visual, and Testing agents
4. Output synthesis including component code, tokens, and QA validation
"""
import unittest
from app.agents.registry import AgentRegistry
from app.orchestrator.planner import TaskPlanner
from app.orchestrator.orchestrator import MultiAgentOrchestrator
from app.core.db import init_db


class TestWebDevWorkflow(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        init_db()
        self.registry = AgentRegistry.get_instance()
        await self.registry.initialize()
        self.orchestrator = MultiAgentOrchestrator()

    async def test_all_nine_agents_registered(self):
        agents = self.registry.list_agents()
        self.assertGreaterEqual(len(agents), 9, f"Expected at least 9 registered agents, found {len(agents)}")
        agent_ids = {a.id for a in agents}
        expected = {
            "anvesha.agent.research",
            "anvesha.agent.webdev",
            "anvesha.agent.uiux",
            "anvesha.agent.visual",
            "anvesha.agent.testing",
            "anvesha.agent.code",
            "anvesha.agent.document",
            "anvesha.agent.knowledge",
            "anvesha.agent.security",
        }
        self.assertTrue(expected.issubset(agent_ids), f"Missing core agents: {expected - agent_ids}")

    async def test_task_planner_web_dev_dag(self):
        goal = "Build a responsive monitoring dashboard with dark theme and metrics cards"
        plan = TaskPlanner.plan_workflow(goal)
        self.assertEqual(plan["workflow_type"], "web_development_and_ui")
        steps = plan["steps"]
        self.assertEqual(len(steps), 4)
        self.assertEqual(steps[0]["assigned_agent_id"], "anvesha.agent.uiux")
        self.assertEqual(steps[1]["assigned_agent_id"], "anvesha.agent.webdev")
        self.assertEqual(steps[2]["assigned_agent_id"], "anvesha.agent.visual")
        self.assertEqual(steps[3]["assigned_agent_id"], "anvesha.agent.testing")

    async def test_e2e_web_development_execution(self):
        goal = "Build a responsive analytics dashboard with dark theme and metrics cards"
        task = await self.orchestrator.create_and_plan_task(goal=goal, project_id="default")
        task_id = task["id"]

        completed = await self.orchestrator.execute_task(task_id)
        self.assertEqual(completed["status"], "completed")

        final_report = completed.get("final_output", "")
        self.assertIn("Web Development & UI Engineering Report", final_report)
        self.assertIn("UI/UX Design Specification", final_report)
        self.assertIn("QA, Accessibility & Responsive Validation", final_report)


if __name__ == "__main__":
    unittest.main()
