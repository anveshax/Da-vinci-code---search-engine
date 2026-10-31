"""
Anvesha V2: Central Multi-Agent Task Planner.

Decomposes complex user goals into a Directed Acyclic Graph (DAG) of specialized subtasks
with defined dependencies, agent assignments, and input payloads across all 9 specialized agents.
"""
from typing import Dict, Any, List


class TaskPlanner:
    """Creates dependency-aware execution plans for multi-agent workflows."""

    @staticmethod
    def plan_workflow(goal: str, project_id: str = "default") -> Dict[str, Any]:
        """
        Analyzes a goal and returns a structured plan DAG.
        Routes to:
        1. Web Development & UI Engineering Workflow
        2. Codebase Security Audit & Remediation Workflow
        3. Deep Research & Fact Synthesis Workflow
        4. Hybrid Technical Investigation Workflow
        """
        clean_goal = goal.strip().lower()

        # Dedicated Workflow: Technology Evaluation, Comparison, Report & Presentation
        if "compare" in clean_goal and ("report" in clean_goal or "presentation" in clean_goal or "approach" in clean_goal or "technology" in clean_goal):
            return {
                "workflow_type": "technology_evaluation_and_presentation",
                "goal": goal,
                "plan_title": f"Technology Evaluation & Report: {goal[:50]}",
                "steps": [
                    {
                        "step_index": 1,
                        "title": "Deep Technical Research & Comparative Options",
                        "assigned_agent_id": "anvesha.agent.research",
                        "dependencies": [],
                        "input_payload": {"query": goal, "max_results": 6}
                    },
                    {
                        "step_index": 2,
                        "title": "Data & Performance Trade-off Matrix Synthesis",
                        "assigned_agent_id": "agent_data_analysis",
                        "dependencies": [1],
                        "input_payload": {"query": f"Trade-off matrix and metrics for: {goal}"}
                    },
                    {
                        "step_index": 3,
                        "title": "Grounding Audit & Citation Verification",
                        "assigned_agent_id": "agent_verification",
                        "dependencies": [1, 2],
                        "input_payload": {"query": f"Verify claims for: {goal}"}
                    },
                    {
                        "step_index": 4,
                        "title": "Executive Summary & Technical Report Preparation",
                        "assigned_agent_id": "anvesha.agent.document",
                        "dependencies": [1, 2, 3],
                        "input_payload": {"query": goal}
                    },
                    {
                        "step_index": 5,
                        "title": "Presentation Deck Layout & Visual Wireframing",
                        "assigned_agent_id": "anvesha.agent.uiux",
                        "dependencies": [4],
                        "input_payload": {"goal": f"Slide deck presentation for: {goal}"}
                    }
                ]
            }

        # 1. Web Development & UI Engineering Workflow
        web_keywords = ["website", "dashboard", "component", "ui", "design", "frontend", "build app", "create page", "landing page", "web app"]
        if any(w in clean_goal for w in web_keywords) and "security" not in clean_goal:
            return {
                "workflow_type": "web_development_and_ui",
                "goal": goal,
                "plan_title": f"Web Development & UI Workflow: {goal[:50]}",
                "steps": [
                    {
                        "step_index": 1,
                        "title": "UI/UX Design Specification & Responsive Layout Architecture",
                        "assigned_agent_id": "anvesha.agent.uiux",
                        "dependencies": [],
                        "input_payload": {
                            "goal": goal,
                            "theme": "dark" if "light" not in clean_goal else "light"
                        }
                    },
                    {
                        "step_index": 2,
                        "title": "Full-Stack Code Implementation & Scaffolding",
                        "assigned_agent_id": "anvesha.agent.webdev",
                        "dependencies": [1],
                        "input_payload": {
                            "goal": goal,
                            "component_name": "WebStudioDashboard",
                        }
                    },
                    {
                        "step_index": 3,
                        "title": "Visual Implementation & Design System Token Integration",
                        "assigned_agent_id": "anvesha.agent.visual",
                        "dependencies": [2],
                        "input_payload": {
                            "component_name": "WebStudioDashboard",
                            "theme": "dark" if "light" not in clean_goal else "light"
                        }
                    },
                    {
                        "step_index": 4,
                        "title": "Frontend Responsive Layout & Accessibility Validation",
                        "assigned_agent_id": "anvesha.agent.testing",
                        "dependencies": [3],
                        "input_payload": {
                            "component_name": "WebStudioDashboard",
                        }
                    },
                ]
            }

        # 2. Dedicated Workflow: Codebase Security Audit & Remediation
        if "security" in clean_goal and ("codebase" in clean_goal or "repo" in clean_goal or "analyze" in clean_goal or "audit" in clean_goal):
            return {
                "workflow_type": "security_audit_and_remediation",
                "goal": goal,
                "plan_title": "Codebase Security Audit & Remediation Plan",
                "steps": [
                    {
                        "step_index": 1,
                        "title": "Codebase Structure & AST Symbol Mapping",
                        "assigned_agent_id": "anvesha.agent.code",
                        "dependencies": [],
                        "input_payload": {
                            "action": "ast_scan",
                            "goal": "Map workspace functions, classes, and structure"
                        }
                    },
                    {
                        "step_index": 2,
                        "title": "Static Vulnerability & Secret Audit",
                        "assigned_agent_id": "anvesha.agent.security",
                        "dependencies": [1],
                        "input_payload": {
                            "scope": "all",
                            "goal": "Scan codebase for credentials, dangerous execution, and insecure patterns"
                        }
                    },
                    {
                        "step_index": 3,
                        "title": "External Remediation Method Research",
                        "assigned_agent_id": "anvesha.agent.research",
                        "dependencies": [2],
                        "input_payload": {
                            "query": "OWASP remediation for hardcoded secrets and dangerous code execution in Python",
                            "max_results": 4
                        }
                    },
                    {
                        "step_index": 4,
                        "title": "Organizational Procedural Runbook Retrieval",
                        "assigned_agent_id": "anvesha.agent.knowledge",
                        "dependencies": [2],
                        "input_payload": {
                            "memory_type": "procedural",
                            "query": "remediation guidelines and security standards",
                            "limit": 3
                        }
                    },
                ]
            }

        # 3. Dedicated Workflow: Deep Technical Research & Evidence Synthesis
        if "research" in clean_goal or "deep" in clean_goal or "investigate" in clean_goal:
            return {
                "workflow_type": "deep_research_synthesis",
                "goal": goal,
                "plan_title": f"Deep Technical Research: {goal[:50]}",
                "steps": [
                    {
                        "step_index": 1,
                        "title": "Multi-Source Public Web & Documentation Investigation",
                        "assigned_agent_id": "anvesha.agent.research",
                        "dependencies": [],
                        "input_payload": {"query": goal, "max_results": 6}
                    },
                    {
                        "step_index": 2,
                        "title": "Workspace Code & AST Reference Correlation",
                        "assigned_agent_id": "anvesha.agent.code",
                        "dependencies": [1],
                        "input_payload": {"action": "ast_scan", "goal": goal}
                    },
                    {
                        "step_index": 3,
                        "title": "Organizational Memory & Institutional Runbook Correlation",
                        "assigned_agent_id": "anvesha.agent.knowledge",
                        "dependencies": [1, 2],
                        "input_payload": {"query": goal, "memory_type": "procedural"}
                    },
                    {
                        "step_index": 4,
                        "title": "Structured Knowledge Synthesis & Document Preparation",
                        "assigned_agent_id": "anvesha.agent.document",
                        "dependencies": [1, 2, 3],
                        "input_payload": {"query": goal}
                    }
                ]
            }

        # 4. Generic Multi-Agent Investigation Workflow
        return {
            "workflow_type": "hybrid_investigation",
            "goal": goal,
            "plan_title": f"Investigation: {goal[:50]}",
            "steps": [
                {
                    "step_index": 1,
                    "title": "Codebase & Workspace Context Discovery",
                    "assigned_agent_id": "anvesha.agent.code",
                    "dependencies": [],
                    "input_payload": {"action": "ast_scan", "goal": goal}
                },
                {
                    "step_index": 2,
                    "title": "Technical Documentation & Web Investigation",
                    "assigned_agent_id": "anvesha.agent.research",
                    "dependencies": [],
                    "input_payload": {"query": goal, "max_results": 4}
                },
                {
                    "step_index": 3,
                    "title": "Organizational Memory & Best Practice Correlation",
                    "assigned_agent_id": "anvesha.agent.knowledge",
                    "dependencies": [1, 2],
                    "input_payload": {"query": goal, "memory_type": "procedural"}
                }
            ]
        }
