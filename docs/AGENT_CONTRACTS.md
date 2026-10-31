# ANVESHA V2 — Standardized Agent Contracts & Protocols

---

## 1. Standard Agent Contract (`BaseAgent`)

Every agent participating in the ANVESHA Multi-Agent Governance Platform must adhere to the following strict contract.

### 1.1 Interface Definition

```python
class BaseAgent(ABC):
    id: str                 # Unique reverse-domain ID, e.g. "anvesha.agent.code"
    name: str               # Human-readable name
    description: str        # Semantic purpose and task suitability
    role: str               # Specialized discipline
    capabilities: List[str] # List of declared capabilities
    permissions: List[str]  # Minimum required permissions
    tools: Dict[str, Callable] # Registered tool functions

    @abstractmethod
    async def initialize(self) -> None:
        """Called once during platform startup to verify tool readiness."""
        pass

    @abstractmethod
    async def execute_step(
        self,
        task_id: str,
        step_id: str,
        input_payload: Dict[str, Any],
        context: AgentExecutionContext
    ) -> AgentExecutionResult:
        """
        Executes a planned subtask.
        All tool invocations inside execute_step MUST be routed through
        context.invoke_tool() to guarantee governance verification.
        """
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """Teardown connections, flush buffers, and release resources."""
        pass
```

### 1.2 Agent Execution State Machine

```
   ┌─────────┐
   │  IDLE   │◄─────────────────────────────┐
   └────┬────┘                              │
        │ Task Assigned                     │
        ▼                                   │
   ┌─────────┐                              │
   │ ASSIGNED│                              │
   └────┬────┘                              │
        │ Execution Starts                  │
        ▼                                   │
   ┌───────────┐                            │
   │ EXECUTING │                            │
   └────┬──────┴──────┐                     │
        │             │ Tool needs human    │
        │             │ approval            │
        │             ▼                     │
        │      ┌──────────────────┐         │
        │      │ WAITING_APPROVAL │         │
        │      └──────┬─────┬─────┘         │
        │             │     │               │
        │    Approved │     │ Rejected      │
        │             ▼     ▼               │
        │   ┌────────────┐ ┌────────┐       │
        │   │ (Resumes)  │ │ FAILED │       │
        │   └─────┬──────┘ └───┬────┘       │
        │         │            │            │
        ▼         ▼            ▼            │
   ┌───────────┐      ┌────────┐            │
   │ COMPLETED │      │ FAILED │────────────┘
   └───────────┘      └────────┘
```

---

## 2. Specialized Agent Contracts

### 2.1 Research Agent (`anvesha.agent.research`)
- **Role**: Technical Researcher & Grounding Specialist
- **Description**: Gathers verified external technical information, security advisories, remediation guidelines, and official library documentation using live search engines.
- **Capabilities**:
  - `web:search`: Queries Tavily, Brave, Exa, or DuckDuckGo.
  - `web:scrape_page`: Fetches and extracts main text from public documentation.
- **Declared Permissions**:
  - `network:external_search`
  - `network:http_fetch`
  - `memory:write_semantic`
- **Input Schema**:
  ```json
  {
    "query": "string (required)",
    "domains": "string[] (optional, e.g. ['cve.mitre.org', 'owasp.org'])",
    "max_results": "integer (default: 5)"
  }
  ```
- **Output Schema**:
  ```json
  {
    "summary": "string",
    "findings": [
      {
        "title": "string",
        "url": "string",
        "snippet": "string",
        "reliability_score": "number (0-1)"
      }
    ],
    "citations": ["string (URLs)"]
  }
  ```

---

### 2.2 Code Intelligence Agent (`anvesha.agent.code`)
- **Role**: Software Static Analysis & Codebase Architect
- **Description**: Inspects workspace code, parses Abstract Syntax Trees (AST), tracks symbol hierarchies, computes dependency graphs, and discovers test coverage gaps.
- **Capabilities**:
  - `code:ast_scan`: Extracts functions, classes, interfaces, and methods.
  - `code:dependency_graph`: Traces file-to-file and module import dependencies.
  - `code:test_gaps`: Discovers modules lacking corresponding test coverage.
  - `code:inspect_file`: Reads specific file contents within the workspace boundary.
- **Declared Permissions**:
  - `workspace:read`
  - `memory:write_semantic`
- **Input Schema**:
  ```json
  {
    "action": "'ast_scan' | 'dependencies' | 'test_gaps' | 'inspect_file'",
    "file_path": "string (optional)",
    "symbol_name": "string (optional)"
  }
  ```
- **Output Schema**:
  ```json
  {
    "action": "string",
    "summary": "string",
    "symbols": ["object (name, kind, line)"],
    "dependencies": ["object (source, targets)"],
    "test_gaps": ["object (file, lines, criticality)"],
    "file_content": "string (optional)"
  }
  ```

---

### 2.3 Document Intelligence Agent (`anvesha.agent.document`)
- **Role**: Multimodal File & Documentation Specialist
- **Description**: Processes uploaded enterprise documents (PDF, DOCX, Markdown, TXT), extracting page numbers, section headers, and exact line offsets for source grounding.
- **Capabilities**:
  - `document:list`: Lists all indexed documents in the active workspace.
  - `document:query_chunks`: Semantic and keyword retrieval of chunked text.
  - `document:get_chunk`: Retrieves exact chunk with page/line metadata.
- **Declared Permissions**:
  - `document:read`
  - `memory:read_semantic`
- **Input Schema**:
  ```json
  {
    "query": "string (required)",
    "document_id": "string (optional)",
    "max_chunks": "integer (default: 4)"
  }
  ```
- **Output Schema**:
  ```json
  {
    "matches": [
      {
        "document_name": "string",
        "page_number": "integer | null",
        "line_range": "string (e.g. 'L14-L45')",
        "content": "string"
      }
    ]
  }
  ```

---

### 2.4 Knowledge Agent (`anvesha.agent.knowledge`)
- **Role**: Institutional Memory Custodian
- **Description**: Retrieves and stores institutional knowledge, past team decisions, project-specific coding guidelines, and reusable procedural runbooks.
- **Capabilities**:
  - `memory:query_episodic`: Recalls previous multi-agent runs and solutions.
  - `memory:query_procedural`: Retrieves verified remediation runbooks and procedures.
  - `memory:query_decisions`: Checks past governance approvals and architectural decisions.
  - `memory:record_decision`: Stores new decision records with governance rationale.
- **Declared Permissions**:
  - `memory:read_all`
  - `memory:write_decision`
  - `memory:write_procedural`
- **Input Schema**:
  ```json
  {
    "memory_type": "'episodic' | 'semantic' | 'procedural' | 'decision'",
    "query": "string",
    "limit": "integer (default: 5)"
  }
  ```
- **Output Schema**:
  ```json
  {
    "memory_type": "string",
    "records": [
      {
        "id": "string",
        "title": "string",
        "content": "string",
        "created_by": "string",
        "timestamp": "number"
      }
    ]
  }
  ```

---

### 2.5 Security Analysis Agent (`anvesha.agent.security`)
- **Role**: Application Security & Vulnerability Auditor
- **Description**: Scans code for hardcoded secrets, injection vectors, unescaped queries, dangerous dynamic execution (`eval`, `exec`), and correlates findings with remediation advisories.
- **Capabilities**:
  - `security:scan_secrets`: Detects credentials, tokens, and API keys.
  - `security:scan_dangerous_calls`: Detects `eval`, `exec`, unvalidated subprocesses.
  - `security:assess_risk`: Computes composite vulnerability score and remediation priority.
- **Declared Permissions**:
  - `workspace:read`
  - `security:audit`
  - `governance:flag_risk`
- **Input Schema**:
  ```json
  {
    "scope": "'all' | 'secrets' | 'dangerous_calls' | 'file'",
    "target_path": "string (optional)"
  }
  ```
- **Output Schema**:
  ```json
  {
    "vulnerabilities": [
      {
        "id": "string",
        "rule": "string",
        "severity": "'low' | 'medium' | 'high' | 'critical'",
        "file": "string",
        "line": "integer",
        "snippet": "string",
        "cwe_reference": "string (optional)",
        "recommendation": "string"
      }
    ],
    "risk_summary": {
      "critical_count": "integer",
      "high_count": "integer",
      "medium_count": "integer",
      "low_count": "integer",
      "overall_score": "number (0-100)"
    }
  }
  ```

---

## 3. Governed Communication Gateway Protocol

Agents cannot communicate with each other peer-to-peer. All communications are mediated by the Gateway:

```
[Agent A] ──────> [Gateway Validation] ──────> [Governance Check] ──────> [Orchestrator] ──────> [Agent B]
                     - Schema Valid?              - ALLOW?
                     - Within Auth Scope?         - Risk Score <= 70?
                     - No Infinite Loop?          - Human Approval?
```

### 3.1 Message Frame Format
```json
{
  "message_id": "msg_f7a8b9c1",
  "task_id": "task_e4d2c1",
  "step_id": "step_02",
  "sender_id": "anvesha.agent.security",
  "recipient_id": "anvesha.agent.research",
  "message_type": "TASK_DELEGATION",
  "payload": {
    "query": "remediation for dangerous eval in python ast",
    "cwe": "CWE-95"
  },
  "governance": {
    "decision": "ALLOW",
    "risk_score": 15,
    "evaluated_at": 1730290000.123
  },
  "timestamp": 1730290000.123
}
```

---

## 4. Central Governance Decision Contract

When an agent requests a tool invocation or file operation, the Governance Engine evaluates:

```python
class GovernanceDecision(str, Enum):
    ALLOW = "ALLOW"                      # Safe; execute immediately
    DENY = "DENY"                        # Violates policy; block immediately
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"# High risk; block until human approves
```

### Risk Scoring Matrix
- **0 - 30 (Low Risk)**: Read-only operations, search queries, in-memory AST parsing. Decision: `ALLOW`.
- **31 - 70 (Medium Risk)**: Large-scale dependency tree scans, external web page deep scraping. Decision: `ALLOW` with audit log.
- **71 - 100 (High / Critical Risk)**: Any code modification, shell command execution, accessing secrets, or sensitive configuration modifications. Decision: `REQUIRE_APPROVAL`.
