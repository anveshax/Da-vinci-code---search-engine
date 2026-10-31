# ANVESHA V2 — Migration & Phased Evolution Plan

---

## 1. Non-Destructive Evolution Principles

1. **Zero Data Loss**: Existing SQLite databases (`platform.db` / `intelligence.db`) must preserve all existing tables (`projects`, `conversations`, `messages`, `artifacts`, `prompts`, `bookmarks`, `settings`, `extensions`, `extension_storage`, `extension_audit_logs`, `documents`, `document_chunks`).
2. **Backward Compatibility**: Existing REST endpoints (`/api/search`, `/api/v2/search/stream`, `/api/v2/platform/*`, `/api/v2/extensions/*`, `/api/v2/documents/*`, `/api/v2/ai/providers/*`) will continue functioning without breaking changes.
3. **Component Encapsulation**: Existing core engines (`CodebaseIntelligence`, `DocumentParser`, `WebSearchEngine`, `UnifiedAIProviderService`) are preserved as underlying capabilities and wrapped as standardized tools for the new specialized agents.
4. **UI Continuity**: The primary navigation, 3D Earth Globe, spatial audio, search bar, and extension side panel remain fully functional. The Multi-Agent Governance Platform is seamlessly integrated as a primary operational workspace.

---

## 2. Database Schema Migration Plan

We will add 7 new relational tables in SQLite (`backend/app/core/db.py`) using `CREATE TABLE IF NOT EXISTS` so existing installations upgrade automatically without destructive alters:

### 2.1 Schema Additions
```sql
-- 1. Agent Registry
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    role TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    model_provider TEXT DEFAULT 'auto',
    model_name TEXT,
    capabilities_json TEXT NOT NULL,
    permissions_json TEXT NOT NULL,
    status TEXT DEFAULT 'idle', -- idle, assigned, executing, waiting_approval, error
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

-- 2. Multi-Agent Orchestration Tasks
CREATE TABLE IF NOT EXISTS multi_agent_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'default',
    conversation_id TEXT,
    goal TEXT NOT NULL,
    status TEXT DEFAULT 'planning', -- planning, in_progress, paused_approval, completed, failed
    plan_dag_json TEXT NOT NULL,    -- serialized execution graph with dependencies
    final_output TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 3. Granular Task Steps (Subtasks assigned to agents)
CREATE TABLE IF NOT EXISTS task_steps (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    assigned_agent_id TEXT NOT NULL,
    dependencies_json TEXT NOT NULL, -- list of step_ids required before this step runs
    status TEXT DEFAULT 'pending',   -- pending, ready, running, waiting_approval, completed, failed
    input_payload_json TEXT NOT NULL,
    output_payload_json TEXT,
    governance_status TEXT DEFAULT 'pending', -- pending, allowed, approved, denied
    started_at REAL,
    completed_at REAL,
    FOREIGN KEY (task_id) REFERENCES multi_agent_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 4. Governed Communication Ledger
CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    step_id TEXT,
    sender_id TEXT NOT NULL,     -- agent ID or 'orchestrator' or 'system'
    recipient_id TEXT NOT NULL,  -- agent ID or 'orchestrator' or 'system'
    message_type TEXT NOT NULL,  -- task_delegation, step_result, tool_call, memory_query, alert
    content_json TEXT NOT NULL,
    governance_decision TEXT NOT NULL, -- ALLOW, DENY, REQUIRE_APPROVAL
    timestamp REAL NOT NULL,
    FOREIGN KEY (task_id) REFERENCES multi_agent_tasks(id) ON DELETE CASCADE
);

-- 5. Shared Organizational Memory
CREATE TABLE IF NOT EXISTS organizational_memory (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'default',
    memory_type TEXT NOT NULL, -- episodic, semantic, procedural, decision
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_by TEXT NOT NULL,  -- agent_id or 'user' or 'governance'
    created_at REAL NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 6. Governance Policies
CREATE TABLE IF NOT EXISTS governance_policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    target_action TEXT NOT NULL,    -- e.g., 'tool:file_modify', 'tool:code_exec', 'network:external'
    condition_json TEXT NOT NULL,
    action_type TEXT NOT NULL,      -- ALLOW, DENY, REQUIRE_APPROVAL
    risk_level TEXT NOT NULL,       -- low, medium, high, critical
    is_active INTEGER DEFAULT 1,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

-- 7. Human-in-the-Loop Approval Requests
CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    action_requested TEXT NOT NULL,
    parameters_json TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    risk_explanation TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by TEXT,
    review_reason TEXT,
    created_at REAL NOT NULL,
    resolved_at REAL,
    FOREIGN KEY (task_id) REFERENCES multi_agent_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (step_id) REFERENCES task_steps(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
```

---

## 3. Implementation Phases

```
Phase 1: Architecture & Contracts (Complete)
   │
Phase 2: Database Layer Extensions (Schema + PlatformDB CRUD methods)
   │
Phase 3: Agent SDK & 5 Specialized Agents
   │
Phase 4: Shared Organizational Memory Service
   │
Phase 5: Central Governance Engine & Human-in-the-Loop Approvals
   │
Phase 6: Multi-Agent Orchestrator & Task Execution DAG
   │
Phase 7: Backend API Endpoints & SSE Streaming (/api/v2/orchestrator/*, /api/v2/governance/*)
   │
Phase 8: Frontend UI Components (MultiAgentWorkspace, GovernanceConsole, ApprovalModal)
   │
Phase 9: Comprehensive Testing & End-to-End Verification
```

### Detailed Phase Breakdown

#### Phase 1: Architecture, Documentation & Contracts
- Publish `docs/ANVESHA_ARCHITECTURE_V2.md`.
- Publish `docs/MIGRATION_PLAN.md`.
- Publish `docs/AGENT_CONTRACTS.md`.

#### Phase 2: Database Schema & Core Persistence
- Update `backend/app/core/db.py` to create the 7 new tables on startup.
- Add helper methods to `PlatformDB`:
  - `register_agent()`, `list_agents()`, `get_agent()`.
  - `create_orchestrator_task()`, `update_task_status()`, `get_task()`.
  - `create_task_step()`, `update_task_step()`.
  - `log_agent_message()`, `list_agent_messages()`.
  - `add_memory()`, `search_memories()`.
  - `create_governance_policy()`, `list_policies()`.
  - `create_approval_request()`, `resolve_approval_request()`, `list_pending_approvals()`.

#### Phase 3: Standardized Agent SDK & Specialized Agents
- Create `backend/app/agents/base.py`:
  - Abstract `BaseAgent` class with lifecycle methods: `initialize()`, `execute_step()`, `cleanup()`.
  - Standardized JSON input/output schemas.
- Implement 5 Specialized Agents in `backend/app/agents/`:
  - `research_agent.py`: Uses Tavily/Brave/Exa/DuckDuckGo from `web_search.py`.
  - `code_agent.py`: Uses `CodebaseIntelligence` for AST scanning and symbol indexing.
  - `document_agent.py`: Queries document chunks and parsed PDF/DOCX files.
  - `knowledge_agent.py`: Connects with Organizational Memory.
  - `security_agent.py`: Uses secret scanning, dangerous call detectors, and CVE remediation databases.
- Create `backend/app/agents/registry.py` for dynamic lookup and capability resolution.

#### Phase 4: Shared Organizational Memory Service
- Create `backend/app/memory/service.py`:
  - Scoped storage for Episodic, Semantic, Procedural, and Decision memory.
  - Access control: Agents can only query categories matching their declared permissions.
  - Attribution tracking (which agent recorded the memory, source citations).

#### Phase 5: Central Governance Engine
- Create `backend/app/governance/engine.py`:
  - Action verification pipeline: checks policy conditions before tool execution.
  - Risk evaluator: computes risk score (0-100) based on action parameters.
  - Interceptor: emits `REQUIRE_APPROVAL` if risk score > 70 or matching high-risk policies.
  - Non-bypassable: tools must be executed through the engine wrapper.

#### Phase 6: Central Multi-Agent Orchestrator
- Create `backend/app/orchestrator/orchestrator.py`:
  - Request decomposition planner.
  - Dependency-aware step scheduler (async concurrency where dependencies are satisfied).
  - Governed Gateway for agent messaging.
  - Result aggregator combining findings into a final report.

#### Phase 7: REST & SSE Streaming APIs
- Create `backend/app/api/orchestrator.py`:
  - `POST /api/v2/orchestrator/tasks`: Launch multi-agent task.
  - `GET /api/v2/orchestrator/tasks/{task_id}`: Retrieve task status and DAG.
  - `GET /api/v2/orchestrator/tasks/{task_id}/stream`: Real-time SSE event stream.
- Create `backend/app/api/governance.py`:
  - `GET /api/v2/governance/policies`: List governance rules.
  - `POST /api/v2/governance/policies`: Create/update rule.
  - `GET /api/v2/governance/approvals`: List pending human approvals.
  - `POST /api/v2/governance/approvals/{id}/resolve`: Approve or reject high-risk action.
  - `GET /api/v2/governance/audit-logs`: Audit stream.
  - `GET /api/v2/governance/memory`: Query organizational memory.

#### Phase 8: Frontend UI Integration
- Update `frontend/src/types/api.ts` with multi-agent types (`AgentRecord`, `MultiAgentTask`, `TaskStep`, `GovernancePolicy`, `ApprovalRequest`, `MemoryRecord`).
- Add API methods in `frontend/src/services/api.ts`.
- Create `frontend/src/components/MultiAgentWorkspace.tsx`:
  - Goal input box.
  - Live visual Task Execution DAG & Agent Activity Timeline.
  - Agent status cards (Research, Code, Document, Knowledge, Security).
  - Human Approval Drawer with Approve/Reject buttons.
  - Real-time audit log stream.
- Create `frontend/src/components/GovernanceConsole.tsx`:
  - Policy management and risk threshold configuration.
  - Organizational Memory explorer.
- Integrate views into `App.tsx` and `AppSidebar.tsx` with dedicated navigation pills.

#### Phase 9: Verification & E2E Testing
- Create `backend/tests/test_multi_agent_governance.py`:
  - Unit tests for Agent SDK & Registry.
  - Unit tests for Governance Engine (ALLOW, DENY, REQUIRE_APPROVAL).
  - Unit tests for Organizational Memory.
  - End-to-end integration test of the full workflow:
    *"Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report."*
- Run frontend production build (`npm run build`).
