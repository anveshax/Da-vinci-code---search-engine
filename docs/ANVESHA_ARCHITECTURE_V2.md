# ANVESHA V2 — Hybrid Multi-Agent AI Governance Platform
## System Architecture Specification

---

## 1. Executive Summary & Vision

**ANVESHA V2** evolves the Codebase Intelligence Engine from a single-query AI search and code analysis system into a **Hybrid Multi-Agent AI Governance Platform** (Problem Statement 2: Multi-Agent AI Governance Platform). 

Modern enterprise AI systems require multiple autonomous agents collaborating to solve complex, multifaceted engineering problems. However, unconstrained agent-to-agent interactions introduce severe risks: hallucinated execution paths, unauthorized tool invocations, privilege escalation, circular delegation loops, data leakage, and opaque decision-making.

ANVESHA V2 addresses this with a **Central Orchestrator** paired with an authoritative, real-time **Central Governance Engine** and **Governed Communication Gateway**. All agent operations, inter-agent messages, tool executions, and memory accesses are strictly audited, risk-scored, and subjected to policy decisions (`ALLOW`, `DENY`, or `REQUIRE_APPROVAL` with human-in-the-loop intervention).

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                      ANVESHA V2 MULTI-AGENT GOVERNANCE PLATFORM                   │
└───────────────────────────────────────────────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        ▼                                                                 ▼
┌───────────────────────────────┐                       ┌───────────────────────────────┐
│       FRONTEND CONSOLE        │                       │     EXISTING CAPABILITIES     │
│  - Multi-Agent Workspace      │                       │  - 3D Earth Globe             │
│  - Task Execution Timeline    │                       │  - Spatial Audio & Haptics    │
│  - Governance & Audit Center  │                       │  - 5-Mode Intelligence Search │
│  - Human Approval Drawer      │                       │  - Extension Side Panel       │
│  - Organizational Memory      │                       │  - Document Intelligence      │
└───────────────────────────────┘                       └───────────────────────────────┘
                │                                                       │
                ▼                                                       ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                            CENTRAL ORCHESTRATOR                                   │
│  - Request Decomposition & Intent Analysis    - Dynamic Execution DAG Planner     │
│  - Agent Selection & Delegation               - Result Synthesis & Attribution    │
└───────────────────────────────────────────────────────────────────────────────────┘
          │                                                       ▲
          │ Governed Gateway                                      │ Verified Feedback
          ▼                                                       │
┌───────────────────────────────┐                       ┌───────────────────────────────┐
│   GOVERNED AGENT GATEWAY      │                       │   CENTRAL GOVERNANCE ENGINE   │
│  - Message Schema Validation  │                       │  - Policy Verification Engine │
│  - Task-Scoped Token Auth     │◄─────────────────────►│  - Risk Scoring (Low/Med/High)│
│  - Circular Loop Detection    │                       │  - Human-in-the-Loop Approval │
│  - Execution Timeouts         │                       │  - Tamper-Evident Audit Log   │
└───────────────────────────────┘                       └───────────────────────────────┘
          │                                                       ▲
          ▼                                                       │ Tool Action Check
┌─────────────────────────────────────────────────────────────────┴─────────────────┐
│                            SPECIALIZED AGENT SYSTEM                               │
│                                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Research Agent  │  │   Code Agent     │  │  Document Agent  │                 │
│  │ (Tavily/Exa/Brave│  │(AST/Deps/Impact/ │  │(PDF/DOCX/Code    │                 │
│  │  Web Scraper)    │  │ File Inspection) │  │ Parser & Chunks) │                 │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘                 │
│  ┌──────────────────┐  ┌──────────────────┐                                       │
│  │  Knowledge Agent │  │  Security Agent  │                                       │
│  │ (Org Memory/     │  │ (Vulnerability/  │                                       │
│  │  Procedural DB)  │  │  Secrets/CVE)    │                                       │
│  └──────────────────┘  └──────────────────┘                                       │
└───────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        SHARED ORGANIZATIONAL MEMORY                               │
│  - Episodic Memory: Historical multi-agent tasks, runs, and conversation logs     │
│  - Semantic Memory: Vectorized & indexed codebase context, documents, and repos   │
│  - Procedural Memory: Verified runbooks, remediation recipes, and execution flows │
│  - Decision Memory: Log of governance approvals, rejections, and rationales       │
└───────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                     FOUNDATIONAL STORAGE & INFRASTRUCTURE                         │
│  - SQLite Database (WAL Mode, Foreign Key Enforcement, ACID Compliance)           │
│  - Multi-Provider AI Engine (Gemini REST v1beta, Groq, OpenRouter, Local Ollama)  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Subsystems & Responsibilities

### 2.1 Central Multi-Agent Orchestrator
The Orchestrator is the single entry point for complex multi-agent goals.
1. **Goal Decomposition**: Analyzes high-level user prompts (e.g., *"Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report"*) into a structured Directed Acyclic Graph (DAG) of subtasks.
2. **Dynamic Task Scheduling**: Evaluates task dependencies. Tasks with no mutual dependencies execute concurrently; dependent tasks wait for upstream outputs.
3. **Agent Assignment**: Matches each subtask to the most capable agent based on registered capabilities, model strengths, and current load.
4. **Execution Supervision**: Enforces wall-clock timeouts, monitors agent heartbeats, and handles retries or fallbacks if an agent fails.
5. **Synthesis Engine**: Aggregates intermediate evidence, validates grounding citations, and formats the final executive report with clear agent attribution badges.

### 2.2 Standardized Agent SDK & Registry
All agents conform to an authoritative `BaseAgent` contract:
- **Identity & Metadata**: Unique ID, display name, version, semantic description, and operational state (`IDLE`, `ASSIGNED`, `EXECUTING`, `WAITING_APPROVAL`, `COMPLETED`, `FAILED`).
- **Declared Capabilities & Tools**: Agents register specific executable tools (e.g., `code:ast_scan`, `security:detect_secrets`, `web:tavily_search`, `memory:query_procedural`).
- **Required Permissions**: Minimum viable permissions declared up front.
- **Model Binding**: Configurable model parameters (e.g., Groq for rapid code inspection, Gemini for deep synthesis).

#### Initial 5 Specialized Agents:
1. **Research Agent (`anvesha.agent.research`)**: Queries real web search engines (Tavily, Brave, Exa, DuckDuckGo) and deep-scrapes technical articles, RFCs, and remediation advisories.
2. **Code Intelligence Agent (`anvesha.agent.code`)**: Performs static AST parsing, symbol extraction, import hierarchy mapping, dependency graphing, and test gap analysis.
3. **Document Intelligence Agent (`anvesha.agent.document`)**: Extracts and indexes multi-format documents (PDF, DOCX, Markdown, TXT) with precise page and line citations.
4. **Knowledge Agent (`anvesha.agent.knowledge`)**: Interacts with the Shared Organizational Memory; recalls past project decisions, architectural rules, and reusable procedures.
5. **Security Analysis Agent (`anvesha.agent.security`)**: Scans for hardcoded secrets, injection vectors, dangerous dynamic execution (`eval`, `exec`), and correlates findings with remediation benchmarks.

### 2.3 Governed Agent Communication Gateway
To prevent rogue agent behavior:
- **No Direct Agent-to-Agent Spawning**: Agents cannot invoke or message other agents directly. All communications pass through the Gateway.
- **Message Validation**: Every message is validated against strict JSON schemas before delivery.
- **Anti-Loop Defense**: Tracks execution depth and call frequency to prevent recursive delegation loops. Maximum task delegation depth is capped at 5 levels.
- **Information Scoping**: Agents only receive context relevant to their assigned subtask; sensitive credentials and unrelated organizational data are filtered out.

### 2.4 Central Governance & Policy Engine
Acts as an authoritative firewall for all agent actions:
- **Decision Matrix**:
  - `ALLOW`: The tool invocation or action is safe and within the agent's declared scope.
  - `DENY`: The action violates platform security policy (e.g., path traversal, SSRF to private IP, credential tampering). Execution is immediately halted.
  - `REQUIRE_APPROVAL`: The action carries high risk (e.g., executing code, modifying codebase files, accessing production secrets). The engine pauses execution, creates an `ApprovalRequest` record, and notifies the human operator.
- **Risk Assessment**: Real-time heuristic scoring (Low: 0-30, Medium: 31-70, High: 71-100) based on target resource, network access, and potential destructive impact.
- **Human-in-the-Loop Console**: A dedicated approval UI where operators can review the requesting agent, tool parameters, risk explanation, and choose to Approve or Reject with an audit explanation.

### 2.5 Shared Organizational Memory Service
Multi-agent teams must retain institutional knowledge across runs:
1. **Episodic Memory**: Full audit traces of past orchestration runs, agent thoughts, subtask inputs, and outputs.
2. **Semantic Memory**: Contextual knowledge embeddings and indexed documents across the user's workspace.
3. **Procedural Memory**: Curated runbooks, coding conventions, approved remediation procedures, and architectural blueprints.
4. **Decision Memory**: Every governance approval or rejection, complete with operator rationale, timestamp, and security implications.

### 2.6 Audit, Observability & Real-Time Monitoring
- **Tamper-Evident Event Ledger**: Every state transition, tool call, governance check, and error is recorded in SQLite with microsecond timestamps.
- **Live SSE Streaming**: Orchestration progress, agent status changes, and governance events stream live to the frontend via Server-Sent Events (`/api/v2/governance/stream`).

---

## 3. Technology Stack & Integration Points

| Layer | Component | Technologies |
|---|---|---|
| **Frontend** | Single Page Application | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **3D & Audio** | Experience Layer | Three.js (Earth Globe), Web Audio API (Spatial Audio), Vibration API (Haptics) |
| **Backend** | API & Orchestration | FastAPI, Python 3.12, Uvicorn, AsyncIO, SSE Starlette |
| **AI Providers** | Unified Inference | Google Gemini REST v1beta, Groq, OpenRouter, Local Ollama/vLLM |
| **Storage** | Persistence | SQLite (WAL mode, Foreign Keys enabled, ACID transactions) |
| **Search & Web**| External Grounding | Tavily AI, Brave Search, Exa AI, DuckDuckGo HTML Scraper, Httpx with anti-SSRF |
| **Document Engine**| File Intelligence | Native Python XML zip parser (DOCX), Zlib stream decompressor (PDF) |
