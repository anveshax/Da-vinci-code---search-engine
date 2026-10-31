"""
ANVESHA V2: End-to-End Multi-Agent Demonstration Runner.

Goal:
"Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report."

Verifies:
1. TaskPlanner creates 4-step DAG.
2. Code Analysis Agent (anvesha.agent.code) inspects files & runs Gemini model analysis.
3. Security Agent (anvesha.agent.security) scans vulnerabilities & runs Gemini threat assessment.
4. Research Agent (anvesha.agent.research) researches remediation with DuckDuckGo search + Gemini synthesis with citations.
5. Knowledge Agent (anvesha.agent.knowledge) queries procedural runbooks + Gemini compliance verification.
6. Central Governance Engine validates policy rules for each step.
7. Central Orchestrator aggregates results into an authoritative executive report with source attribution.
"""
import asyncio
import json
import time
from app.core.db import PlatformDB, init_db
from app.agents.registry import AgentRegistry
from app.orchestrator.orchestrator import MultiAgentOrchestrator


async def run_live_demonstration():
    print("=" * 80)
    print("ANVESHA V2: HYBRID MULTI-AGENT ORCHESTRATION DEMONSTRATION")
    print("Goal: 'Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report.'")
    print("=" * 80)

    # 1. Initialize DB and Agent Registry
    init_db()
    registry = AgentRegistry.get_instance()
    await registry.initialize()

    agents = registry.list_agents()
    print(f"\n[1] Registered Specialized Agents ({len(agents)}):")
    for a in agents:
        print(f"  - {a.name} ({a.id}) | Role: {a.role} | Model: {a.model_provider}")

    # 2. Plan the Task via Central Orchestrator
    orchestrator = MultiAgentOrchestrator()
    goal = "Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report."
    
    task = await orchestrator.create_and_plan_task(goal=goal, project_id="default")
    task_id = task["id"]
    print(f"\n[2] Multi-Agent Task Planned (Task ID: {task_id}):")
    print(f"  - Plan Title: {task['plan_dag'].get('plan_title')}")
    print(f"  - Total Execution Steps: {len(task['steps'])}")

    for s in task["steps"]:
        print(f"    Step {s['step_index']}: {s['title']} -> Assigned to: {s['assigned_agent_id']}")

    # Event listener to monitor live progress
    async def event_logger(event_type: str, payload: dict):
        if event_type == "step_started":
            print(f"\n>>> [STEP START] Step {payload.get('step_index')}: {payload.get('title')} ({payload.get('agent_name')})")
        elif event_type == "step_completed":
            print(f">>> [STEP DONE] Step {payload.get('step_index')} completed successfully!")
            summary = payload.get('summary', '')
            # Print brief preview
            lines = summary.split("\n")
            preview = "\n    ".join(lines[:6])
            print(f"    Summary preview:\n    {preview}")
        elif event_type == "task_completed":
            print(f"\n>>> [TASK COMPLETED] All steps finished successfully!")

    # 3. Execute the Governed Workflow
    print("\n[3] Executing Governed Multi-Agent Workflow...")
    start_time = time.time()
    completed_task = await orchestrator.execute_task(task_id, event_callback=event_logger)
    elapsed = time.time() - start_time

    print("\n" + "=" * 80)
    print(f"DEMONSTRATION RESULTS (Execution Time: {elapsed:.2f}s, Status: {completed_task['status'].upper()})")
    print("=" * 80)

    # 4. Show Intermediate Outputs
    for step in completed_task.get("steps", []):
        print(f"\n--- STEP {step['step_index']}: {step['title']} ---")
        print(f"Assigned Agent: {step['assigned_agent_id']}")
        print(f"Governance Status: {step['governance_status']}")
        out = step.get("output_payload", {})
        print("Agent Summary:")
        print(out.get("summary", "N/A"))

    # 5. Show Final Synthesized Executive Report
    print("\n" + "#" * 80)
    print("FINAL SYNTHESIZED EXECUTIVE REPORT:")
    print("#" * 80)
    print(completed_task.get("final_output", "No output generated."))

    # 6. Audit Trail and Memory Verification
    audit_msgs = PlatformDB.list_agent_messages(task_id=task_id)
    print("\n" + "=" * 80)
    print(f"GOVERNANCE AUDIT TRAIL ({len(audit_msgs)} recorded events):")
    for msg in audit_msgs[:8]:
        print(f"  [{msg.get('created_at')}] {msg.get('sender_id')} -> {msg.get('recipient_id')} | Type: {msg.get('message_type')}")

    memories = PlatformDB.list_organizational_memories(project_id="default")[:3]
    print(f"\nORGANIZATIONAL MEMORIES STORED ({len(memories)} recent entries):")
    for m in memories:
        print(f"  - [{m['memory_type'].upper()}] {m['title']} (by {m['created_by']})")


if __name__ == "__main__":
    asyncio.run(run_live_demonstration())
