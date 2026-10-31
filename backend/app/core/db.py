"""
Database & Persistence Layer for Anvesha AI Intelligence Platform.

Uses Python's standard library sqlite3 to store:
- Workspaces and Projects with scoped instructions
- Persistent Conversations and Message History
- Conversation Branching & Forking
- Saved AI Artifacts (Architecture docs, Research reports, Technical specs)
- Reusable Prompt Library
- Bookmarks & Saved Knowledge
- Application Settings & Multi-Provider Credentials
- Extension Platform Registry & Isolated Key-Value Stores
- Extension Security Audit Logs
- Document & File Intelligence Chunks
"""
import os
import re
import json
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional

DB_DIR = Path(__file__).resolve().parents[2] / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "intelligence.db"


def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with row dictionary access, WAL mode, and concurrency timeouts."""
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


def init_db():
    """Initializes schema and seeds default data."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Projects / Workspaces
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                workspace_root TEXT NOT NULL,
                custom_instructions TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)

        # Conversations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                title TEXT NOT NULL,
                search_mode TEXT DEFAULT 'auto',
                ai_model TEXT,
                parent_conversation_id TEXT,
                branch_point_message_id TEXT,
                message_count INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        """)

        # Ensure conversations columns exist on existing databases
        conv_cols = [c[1] for c in cursor.execute("PRAGMA table_info(conversations)").fetchall()]
        if "message_count" not in conv_cols:
            cursor.execute("ALTER TABLE conversations ADD COLUMN message_count INTEGER DEFAULT 0")
        if "is_pinned" not in conv_cols:
            cursor.execute("ALTER TABLE conversations ADD COLUMN is_pinned INTEGER DEFAULT 0")

        # Messages
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources_json TEXT,
                citations_json TEXT,
                attachments_json TEXT,
                model TEXT,
                created_at REAL NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)

        # Ensure messages columns exist on existing databases
        msg_cols = [c[1] for c in cursor.execute("PRAGMA table_info(messages)").fetchall()]
        if "attachments_json" not in msg_cols:
            cursor.execute("ALTER TABLE messages ADD COLUMN attachments_json TEXT")
        if "model" not in msg_cols:
            cursor.execute("ALTER TABLE messages ADD COLUMN model TEXT")

        # Fast lookup indexes for conversations & messages
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_pinned_updated ON conversations(is_pinned DESC, updated_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at ASC)")

        # Artifacts
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS artifacts (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                conversation_id TEXT,
                title TEXT NOT NULL,
                artifact_type TEXT DEFAULT 'documentation',
                language TEXT DEFAULT 'markdown',
                content TEXT NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)

        # Prompt Library
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prompts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                prompt_text TEXT NOT NULL,
                is_builtin INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)

        # Bookmarks & Saved Knowledge
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bookmarks (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                title TEXT NOT NULL,
                item_type TEXT NOT NULL,
                content_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        """)

        # User / Platform Settings & AI Provider Credentials
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
        """)

        # Core Extension Registry
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS extensions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                manifest_json TEXT NOT NULL,
                installed INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 0,
                visible INTEGER DEFAULT 0,
                health_status TEXT DEFAULT 'healthy',
                health_message TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)

        # Isolated Extension Key-Value Storage
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS extension_storage (
                extension_id TEXT NOT NULL,
                storage_key TEXT NOT NULL,
                value_json TEXT NOT NULL,
                updated_at REAL NOT NULL,
                PRIMARY KEY (extension_id, storage_key),
                FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
            )
        """)

        # Security Audit Logs for Extensions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS extension_audit_logs (
                id TEXT PRIMARY KEY,
                extension_id TEXT NOT NULL,
                action TEXT NOT NULL,
                details_json TEXT NOT NULL,
                timestamp REAL NOT NULL
            )
        """)

        # Uploaded Documents & Intelligence Chunks
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL DEFAULT 'default',
                filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL,
                created_at REAL NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                page_number INTEGER,
                line_start INTEGER,
                line_end INTEGER,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            )
        """)

        # --- ANVESHA V2: Multi-Agent AI Governance Platform Tables ---

        # 1. Registered Agents
        cursor.execute("""
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
                status TEXT DEFAULT 'idle',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)

        # 2. Multi-Agent Tasks (Orchestration Goals)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS multi_agent_tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL DEFAULT 'default',
                conversation_id TEXT,
                goal TEXT NOT NULL,
                status TEXT DEFAULT 'planning',
                plan_dag_json TEXT NOT NULL,
                final_output TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # 3. Granular Task Steps
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS task_steps (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                step_index INTEGER NOT NULL,
                title TEXT NOT NULL,
                assigned_agent_id TEXT NOT NULL,
                dependencies_json TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                input_payload_json TEXT NOT NULL,
                output_payload_json TEXT,
                governance_status TEXT DEFAULT 'pending',
                started_at REAL,
                completed_at REAL,
                FOREIGN KEY (task_id) REFERENCES multi_agent_tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE CASCADE
            )
        """)

        # 4. Governed Agent Communication Ledger
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_messages (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                step_id TEXT,
                sender_id TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                message_type TEXT NOT NULL,
                content_json TEXT NOT NULL,
                governance_decision TEXT NOT NULL,
                timestamp REAL NOT NULL,
                FOREIGN KEY (task_id) REFERENCES multi_agent_tasks(id) ON DELETE CASCADE
            )
        """)

        # 5. Shared Organizational Memory
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organizational_memory (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL DEFAULT 'default',
                memory_type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at REAL NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # 6. Central Governance Policies
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS governance_policies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                target_action TEXT NOT NULL,
                condition_json TEXT NOT NULL,
                action_type TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)

        # 7. Human-in-the-Loop Approval Requests
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS approval_requests (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                step_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                action_requested TEXT NOT NULL,
                parameters_json TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_explanation TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                reviewed_by TEXT,
                review_reason TEXT,
                created_at REAL NOT NULL,
                resolved_at REAL,
                FOREIGN KEY (task_id) REFERENCES multi_agent_tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (step_id) REFERENCES task_steps(id) ON DELETE CASCADE,
                FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
            )
        """)

        # 8. Model Execution Telemetry for Adaptive Router & Optimizer
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS model_telemetry (
                id TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL,
                model_name TEXT NOT NULL,
                task_type TEXT NOT NULL,
                latency_ms INTEGER NOT NULL,
                tokens_used INTEGER DEFAULT 0,
                success INTEGER NOT NULL,
                error_message TEXT,
                created_at REAL NOT NULL
            )
        """)

        # 9. Adaptive Intent & Layout Classification Logs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS adaptive_intent_logs (
                id TEXT PRIMARY KEY,
                query_text TEXT NOT NULL,
                classified_type TEXT NOT NULL,
                complexity TEXT NOT NULL,
                confidence REAL NOT NULL,
                selected_layout TEXT NOT NULL,
                selected_model TEXT NOT NULL,
                user_override_layout TEXT,
                created_at REAL NOT NULL
            )
        """)

        # 10. Self-Optimization Recommendations with Human Approval Guardrail
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS optimization_recommendations (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                impact_level TEXT NOT NULL,
                metric_evidence TEXT NOT NULL,
                status TEXT DEFAULT 'pending_review',
                reviewed_by TEXT,
                created_at REAL NOT NULL,
                resolved_at REAL
            )
        """)

        # 11. Web Intelligence Crawler & Search Index Schema
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawler_seed_domains (
                id TEXT PRIMARY KEY,
                domain TEXT UNIQUE NOT NULL,
                enabled INTEGER DEFAULT 1,
                allowed_paths TEXT DEFAULT '["/"]',
                crawl_delay_sec REAL DEFAULT 1.0,
                max_depth INTEGER DEFAULT 3,
                max_pages INTEGER DEFAULT 100,
                robots_txt TEXT,
                robots_txt_status TEXT DEFAULT 'pending',
                robots_txt_updated_at REAL,
                total_crawled INTEGER DEFAULT 0,
                last_crawled_at REAL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawler_jobs (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                target_domains TEXT NOT NULL,
                total_discovered INTEGER DEFAULT 0,
                total_crawled INTEGER DEFAULT 0,
                total_indexed INTEGER DEFAULT 0,
                total_failed INTEGER DEFAULT 0,
                total_skipped INTEGER DEFAULT 0,
                current_url TEXT,
                progress_percent REAL DEFAULT 0.0,
                started_at REAL,
                finished_at REAL,
                error_message TEXT,
                config_json TEXT,
                created_at REAL NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawler_queue (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                url TEXT NOT NULL,
                normalized_url TEXT NOT NULL,
                domain TEXT NOT NULL,
                depth INTEGER DEFAULT 0,
                priority INTEGER DEFAULT 5,
                status TEXT DEFAULT 'queued',
                http_status INTEGER,
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                discovered_from_url TEXT,
                created_at REAL NOT NULL,
                completed_at REAL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawled_documents (
                id TEXT PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                canonical_url TEXT,
                domain TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                headings TEXT,
                content TEXT NOT NULL,
                language TEXT DEFAULT 'en',
                author TEXT,
                published_at TEXT,
                last_modified_at TEXT,
                content_hash TEXT NOT NULL,
                text_length INTEGER NOT NULL,
                word_count INTEGER NOT NULL,
                outbound_links_count INTEGER DEFAULT 0,
                crawl_timestamp REAL NOT NULL,
                etag TEXT,
                http_status INTEGER DEFAULT 200
            )
        """)

        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS crawled_documents_fts USING fts5(
                doc_id UNINDEXED,
                url,
                title,
                headings,
                content,
                domain,
                tokenize='porter unicode61'
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_crawled_docs_domain ON crawled_documents(domain)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_crawled_docs_ts ON crawled_documents(crawl_timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_crawler_queue_job ON crawler_queue(job_id, status)")

        # Semantic Vector Storage for Passage Retrieval
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawled_document_chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                url TEXT NOT NULL,
                canonical_url TEXT,
                domain TEXT NOT NULL,
                title TEXT NOT NULL,
                headings TEXT,
                heading_context TEXT,
                content TEXT NOT NULL,
                char_count INTEGER NOT NULL,
                word_count INTEGER NOT NULL,
                content_hash TEXT NOT NULL,
                embedding_blob BLOB,
                embedding_model TEXT,
                embedding_dim INTEGER,
                created_at REAL NOT NULL,
                FOREIGN KEY (document_id) REFERENCES crawled_documents(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON crawled_document_chunks(document_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_url ON crawled_document_chunks(url)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_domain ON crawled_document_chunks(domain)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_hash ON crawled_document_chunks(content_hash)")

        conn.commit()

        # Seed Default Project if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM projects")
        if cursor.fetchone()["cnt"] == 0:
            default_proj_id = "default"
            now = time.time()
            cursor.execute("""
                INSERT INTO projects (id, name, description, workspace_root, custom_instructions, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                default_proj_id,
                "Main Repository",
                "Primary codebase workspace",
                str(Path(__file__).resolve().parents[3]),
                "Follow clean architecture, write tests for new endpoints, maintain strict boundary security.",
                now,
                now
            ))
            conn.commit()

        # Seed Builtin Prompts if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM prompts WHERE is_builtin = 1")
        if cursor.fetchone()["cnt"] == 0:
            now = time.time()
            builtin_prompts = [
                (
                    str(uuid.uuid4()),
                    "Code Review & Security Audit",
                    "Security",
                    "Performs an exhaustive security review for injection, authorization, and memory flaws.",
                    "Review the following code for security vulnerabilities, path traversal risks, SSRF, prompt injection, and memory leaks. Provide clear remediations with line-by-line snippets.",
                    1,
                    now
                ),
                (
                    str(uuid.uuid4()),
                    "Architecture Refactoring Plan",
                    "Architecture",
                    "Breaks down complex monoliths into modular layered systems.",
                    "Analyze the following architectural patterns and propose a refactored clean design with decoupled boundaries, dependency injection, and testability.",
                    1,
                    now
                ),
                (
                    str(uuid.uuid4()),
                    "Unit Test Generator",
                    "Testing",
                    "Generates edge-case testing coverage.",
                    "Write exhaustive unit tests covering normal execution, edge cases, error conditions, and null/empty inputs. Use pytest/jest conventions.",
                    1,
                    now
                ),
                (
                    str(uuid.uuid4()),
                    "API Contract & OpenAPI Spec",
                    "API",
                    "Designs standard RESTful API specifications with strict validation.",
                    "Draft an OpenAPI 3.1 specification for this feature including request/response schemas, error handling (400, 401, 403, 404, 500), and rate-limiting headers.",
                    1,
                    now
                )
            ]
            cursor.executemany("""
                INSERT INTO prompts (id, title, category, description, prompt_text, is_builtin, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, builtin_prompts)
            conn.commit()

        # Seed Specialized Agents if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM agents")
        if cursor.fetchone()["cnt"] == 0:
            now = time.time()
            seed_agents = [
                (
                    "anvesha.agent.research",
                    "Research Agent",
                    "Researches live web sources, official documentation, security advisories, and library documentation.",
                    "Technical Researcher",
                    "You are the Anvesha Research Agent. Your job is to search the web, scrape verified sources, and provide factual, cited information without hallucinations.",
                    "auto",
                    None,
                    json.dumps(["web:search", "web:scrape_page"]),
                    json.dumps(["network:external_search", "network:http_fetch", "memory:write_semantic"]),
                    "idle",
                    now,
                    now
                ),
                (
                    "anvesha.agent.code",
                    "Code Intelligence Agent",
                    "Performs AST static analysis, dependency graph extraction, symbol indexing, and test coverage gap discovery.",
                    "Codebase Specialist",
                    "You are the Anvesha Code Intelligence Agent. You perform deep static analysis across Python, TypeScript, and JavaScript codebases, extracting syntax trees and dependencies.",
                    "auto",
                    None,
                    json.dumps(["code:ast_scan", "code:dependency_graph", "code:test_gaps", "code:inspect_file"]),
                    json.dumps(["workspace:read", "memory:write_semantic"]),
                    "idle",
                    now,
                    now
                ),
                (
                    "anvesha.agent.document",
                    "Document Intelligence Agent",
                    "Extracts and queries multi-format documentation (PDF, DOCX, Markdown, TXT) with page and line citations.",
                    "Document Specialist",
                    "You are the Anvesha Document Intelligence Agent. You parse complex documents, retrieve grounded chunks, and provide precise page and line references.",
                    "auto",
                    None,
                    json.dumps(["document:list", "document:query_chunks", "document:get_chunk"]),
                    json.dumps(["document:read", "memory:read_semantic"]),
                    "idle",
                    now,
                    now
                ),
                (
                    "anvesha.agent.knowledge",
                    "Knowledge Agent",
                    "Custodies and retrieves organizational memory: past architectural decisions, runbooks, and task memories.",
                    "Knowledge Custodian",
                    "You are the Anvesha Knowledge Agent. You retain and retrieve episodic task memories, procedural runbooks, and past governance decisions.",
                    "auto",
                    None,
                    json.dumps(["memory:query_episodic", "memory:query_procedural", "memory:query_decisions", "memory:record_decision"]),
                    json.dumps(["memory:read_all", "memory:write_decision", "memory:write_procedural"]),
                    "idle",
                    now,
                    now
                ),
                (
                    "anvesha.agent.security",
                    "Security Analysis Agent",
                    "Scans repository for hardcoded secrets, injection vectors, dangerous execution calls, and calculates risk scores.",
                    "Security Auditor",
                    "You are the Anvesha Security Analysis Agent. You rigorously audit codebases for hardcoded credentials, eval/exec execution, SSRF, and unvalidated inputs.",
                    "auto",
                    None,
                    json.dumps(["security:scan_secrets", "security:scan_dangerous_calls", "security:assess_risk"]),
                    json.dumps(["workspace:read", "security:audit", "governance:flag_risk"]),
                    "idle",
                    now,
                    now
                ),
            ]
            cursor.executemany("""
                INSERT INTO agents (id, name, description, role, system_prompt, model_provider, model_name, capabilities_json, permissions_json, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, seed_agents)
            conn.commit()

        # Seed Default Governance Policies if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM governance_policies")
        if cursor.fetchone()["cnt"] == 0:
            now = time.time()
            seed_policies = [
                (
                    "pol_file_modify",
                    "Code Modification Guardrail",
                    "Requires human approval before an agent can write, edit, or delete codebase files.",
                    "tool:file_modify",
                    json.dumps({"paths": ["*"], "require_review": True}),
                    "REQUIRE_APPROVAL",
                    "high",
                    1,
                    now,
                    now
                ),
                (
                    "pol_code_exec",
                    "Arbitrary Code Execution Firewall",
                    "Requires explicit human confirmation for runtime shell or dynamic script evaluation.",
                    "tool:code_exec",
                    json.dumps({"commands": ["*"], "require_review": True}),
                    "REQUIRE_APPROVAL",
                    "critical",
                    1,
                    now,
                    now
                ),
                (
                    "pol_ssrf_block",
                    "Anti-SSRF Network Protection",
                    "Immediately denies outbound network requests targeting private or cloud metadata IPs.",
                    "network:fetch",
                    json.dumps({"disallowed_hosts": ["127.0.0.1", "localhost", "169.254.169.254", "0.0.0.0"]}),
                    "DENY",
                    "critical",
                    1,
                    now,
                    now
                ),
                (
                    "pol_safe_read",
                    "Read-Only Inspection Allowlist",
                    "Permits read-only AST scans, test coverage gap checks, and search operations.",
                    "tool:read",
                    json.dumps({"operations": ["ast_scan", "dependencies", "test_gaps", "web_search", "memory_query"]}),
                    "ALLOW",
                    "low",
                    1,
                    now,
                    now
                ),
            ]
            cursor.executemany("""
                INSERT INTO governance_policies (id, name, description, target_action, condition_json, action_type, risk_level, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, seed_policies)
            conn.commit()

        # Seed Initial Procedural Organizational Memory if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM organizational_memory")
        if cursor.fetchone()["cnt"] == 0:
            now = time.time()
            seed_memories = [
                (
                    str(uuid.uuid4()),
                    "default",
                    "procedural",
                    "Standard Remediation: Hardcoded Secrets & Credentials",
                    "Never commit plaintext tokens or keys to Git. Move all credentials to `.env`, add `.env` to `.gitignore`, and access via configuration classes with type validation.",
                    json.dumps({"tags": ["security", "secrets", "cwe-798"], "author": "Security Policy Team"}),
                    "anvesha.agent.security",
                    now
                ),
                (
                    str(uuid.uuid4()),
                    "default",
                    "procedural",
                    "Standard Remediation: Dynamic Code Execution (eval/exec)",
                    "Avoid dynamic `eval()` or `exec()`. Replace with `ast.literal_eval()` for simple literal parsing or use safe, schema-validated JSON deserialization.",
                    json.dumps({"tags": ["security", "rce", "cwe-95"], "author": "Architecture Committee"}),
                    "anvesha.agent.security",
                    now
                ),
                (
                    str(uuid.uuid4()),
                    "default",
                    "semantic",
                    "Anvesha V2 Architectural Invariants",
                    "1. Centralized orchestration only; no uncontrolled agent-to-agent spawning.\n2. All agent tool calls pass through the Governance Engine.\n3. Human approval is mandatory for risk score >= 70.",
                    json.dumps({"tags": ["architecture", "governance", "invariants"], "author": "System Architect"}),
                    "orchestrator",
                    now
                ),
            ]
            cursor.executemany("""
                INSERT INTO organizational_memory (id, project_id, memory_type, title, content, metadata_json, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, seed_memories)
            conn.commit()


class PlatformDB:
    """Data Access Object providing transactional queries."""

    # --- Projects ---
    @staticmethod
    def list_projects() -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_project(project_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def create_project(name: str, description: str = "", workspace_root: str = "", custom_instructions: str = "") -> Dict[str, Any]:
        pid = str(uuid.uuid4())
        now = time.time()
        root = workspace_root or str(Path(__file__).resolve().parents[3])
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO projects (id, name, description, workspace_root, custom_instructions, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (pid, name, description, root, custom_instructions, now, now))
            conn.commit()
        return PlatformDB.get_project(pid)

    @staticmethod
    def delete_project(project_id: str) -> bool:
        if project_id == "default":
            return False  # Protect default project
        with get_db_connection() as conn:
            conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
        return True

    # --- Conversations ---
    @staticmethod
    def _format_conversation_dict(row: sqlite3.Row) -> Dict[str, Any]:
        c = dict(row)
        c["conversation_id"] = c.get("id")
        c["selected_mode"] = c.get("search_mode", "auto")
        c["selected_model"] = c.get("ai_model")
        c["message_count"] = c.get("message_count", 0) or 0
        c["is_pinned"] = bool(c.get("is_pinned", 0))
        return c

    @staticmethod
    def _format_message_dict(row: sqlite3.Row) -> Dict[str, Any]:
        m = dict(row)
        m["message_id"] = m.get("id")
        m["timestamp"] = m.get("created_at")
        if m.get("sources_json"):
            try:
                m["sources"] = json.loads(m["sources_json"])
            except Exception:
                m["sources"] = []
        else:
            m["sources"] = []

        if m.get("citations_json"):
            try:
                m["citations"] = json.loads(m["citations_json"])
            except Exception:
                m["citations"] = []
        else:
            m["citations"] = []

        if m.get("attachments_json"):
            try:
                m["attachments"] = json.loads(m["attachments_json"])
            except Exception:
                m["attachments"] = []
        else:
            m["attachments"] = []
        return m

    @staticmethod
    def generate_conversation_title(query: str) -> str:
        """Generates a clean, readable, Google-class title from user query."""
        if not query or not query.strip():
            return "New Search"
        clean = re.sub(r'^(what is|who is|how to|search for|tell me about|explain)\s+', '', query.strip(), flags=re.IGNORECASE)
        clean = re.sub(r'\s+', ' ', clean).strip()
        if not clean:
            clean = query.strip()
        if clean:
            clean = clean[0].upper() + clean[1:]
        if len(clean) > 55:
            words = clean[:55].rsplit(' ', 1)[0]
            clean = words if words else clean[:55]
        return clean or "New Search"

    @staticmethod
    def list_conversations(
        project_id: Optional[str] = None,
        search_query: Optional[str] = None,
        limit: int = 200
    ) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            if search_query and search_query.strip():
                return PlatformDB.search_conversations(search_query.strip(), project_id=project_id, limit=limit)

            if project_id and project_id != "all":
                rows = conn.execute(
                    """
                    SELECT * FROM conversations
                    WHERE project_id = ?
                    ORDER BY is_pinned DESC, updated_at DESC
                    LIMIT ?
                    """,
                    (project_id, limit)
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM conversations
                    ORDER BY is_pinned DESC, updated_at DESC
                    LIMIT ?
                    """,
                    (limit,)
                ).fetchall()
            return [PlatformDB._format_conversation_dict(r) for r in rows]

    @staticmethod
    def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
            if not row:
                return None
            conv = PlatformDB._format_conversation_dict(row)
            msg_rows = conn.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
                (conv_id,)
            ).fetchall()
            msgs = [PlatformDB._format_message_dict(m) for m in msg_rows]
            conv["messages"] = msgs
            conv["message_count"] = len(msgs)
            return conv

    @staticmethod
    def create_conversation(
        title: str,
        project_id: str = "default",
        search_mode: str = "auto",
        ai_model: Optional[str] = None,
        parent_id: Optional[str] = None,
        branch_point_id: Optional[str] = None,
        is_pinned: int = 0
    ) -> Dict[str, Any]:
        cid = str(uuid.uuid4())
        now = time.time()
        with get_db_connection() as conn:
            # Verify project exists, otherwise fallback to None for FK safety
            valid_proj_id = project_id
            if valid_proj_id:
                check = conn.execute("SELECT id FROM projects WHERE id = ?", (valid_proj_id,)).fetchone()
                if not check:
                    valid_proj_id = None

            conn.execute("""
                INSERT INTO conversations (
                    id, project_id, title, search_mode, ai_model,
                    parent_conversation_id, branch_point_message_id,
                    message_count, is_pinned, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
            """, (cid, valid_proj_id, title, search_mode, ai_model, parent_id, branch_point_id, is_pinned, now, now))
            conn.commit()
        return PlatformDB.get_conversation(cid)

    @staticmethod
    def rename_conversation(conv_id: str, new_title: str) -> Optional[Dict[str, Any]]:
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?", (new_title, now, conv_id))
            conn.commit()
        return PlatformDB.get_conversation(conv_id)

    @staticmethod
    def toggle_pin_conversation(conv_id: str, is_pinned: Optional[bool] = None) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            if is_pinned is not None:
                new_state = 1 if is_pinned else 0
            else:
                current = conn.execute("SELECT is_pinned FROM conversations WHERE id = ?", (conv_id,)).fetchone()
                if not current:
                    return None
                new_state = 1 if not current["is_pinned"] else 0

            now = time.time()
            conn.execute("UPDATE conversations SET is_pinned = ?, updated_at = ? WHERE id = ?", (new_state, now, conv_id))
            conn.commit()
        return PlatformDB.get_conversation(conv_id)

    @staticmethod
    def delete_conversation(conv_id: str) -> bool:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
            conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
            conn.commit()
        return True

    @staticmethod
    def clear_all_conversations(project_id: Optional[str] = None) -> int:
        with get_db_connection() as conn:
            if project_id and project_id != "all":
                conv_rows = conn.execute("SELECT id FROM conversations WHERE project_id = ?", (project_id,)).fetchall()
                conv_ids = [r["id"] for r in conv_rows]
                if conv_ids:
                    placeholders = ",".join("?" for _ in conv_ids)
                    conn.execute(f"DELETE FROM messages WHERE conversation_id IN ({placeholders})", conv_ids)
                    conn.execute(f"DELETE FROM conversations WHERE id IN ({placeholders})", conv_ids)
                deleted_count = len(conv_ids)
            else:
                cursor = conn.execute("SELECT COUNT(*) as cnt FROM conversations")
                deleted_count = cursor.fetchone()["cnt"]
                conn.execute("DELETE FROM messages")
                conn.execute("DELETE FROM conversations")
            conn.commit()
            return deleted_count

    @staticmethod
    def search_conversations(
        query: str,
        project_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        term = f"%{query.strip()}%"
        with get_db_connection() as conn:
            if project_id and project_id != "all":
                sql = """
                    SELECT DISTINCT c.* FROM conversations c
                    LEFT JOIN messages m ON c.id = m.conversation_id
                    WHERE (c.title LIKE ? OR m.content LIKE ?) AND c.project_id = ?
                    ORDER BY c.is_pinned DESC, c.updated_at DESC
                    LIMIT ?
                """
                rows = conn.execute(sql, (term, term, project_id, limit)).fetchall()
            else:
                sql = """
                    SELECT DISTINCT c.* FROM conversations c
                    LEFT JOIN messages m ON c.id = m.conversation_id
                    WHERE (c.title LIKE ? OR m.content LIKE ?)
                    ORDER BY c.is_pinned DESC, c.updated_at DESC
                    LIMIT ?
                """
                rows = conn.execute(sql, (term, term, limit)).fetchall()
            return [PlatformDB._format_conversation_dict(r) for r in rows]

    @staticmethod
    def fork_conversation(conv_id: str, branch_message_id: str, new_title: Optional[str] = None) -> Optional[Dict[str, Any]]:
        parent = PlatformDB.get_conversation(conv_id)
        if not parent:
            return None

        # Filter messages up to branch point
        parent_msgs = parent.get("messages", [])
        retained = []
        for m in parent_msgs:
            retained.append(m)
            if m["id"] == branch_message_id or m.get("message_id") == branch_message_id:
                break

        title = new_title or f"Branch of {parent['title']}"
        forked = PlatformDB.create_conversation(
            title=title,
            project_id=parent.get("project_id", "default"),
            search_mode=parent.get("search_mode", "auto"),
            ai_model=parent.get("ai_model"),
            parent_id=conv_id,
            branch_point_id=branch_message_id
        )

        with get_db_connection() as conn:
            for m in retained:
                new_mid = str(uuid.uuid4())
                conn.execute("""
                    INSERT INTO messages (id, conversation_id, role, content, sources_json, citations_json, attachments_json, model, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    new_mid,
                    forked["id"],
                    m["role"],
                    m["content"],
                    m.get("sources_json") or (json.dumps(m["sources"]) if m.get("sources") else None),
                    m.get("citations_json") or (json.dumps(m["citations"]) if m.get("citations") else None),
                    m.get("attachments_json") or (json.dumps(m["attachments"]) if m.get("attachments") else None),
                    m.get("model"),
                    m["created_at"]
                ))
            conn.execute("UPDATE conversations SET message_count = ? WHERE id = ?", (len(retained), forked["id"]))
            conn.commit()

        return PlatformDB.get_conversation(forked["id"])

    branch_conversation = fork_conversation

    # --- Messages ---
    @staticmethod
    def add_message(
        conversation_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
        citations: Optional[List[Dict[str, Any]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        conv_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        target_conv_id = conversation_id or conv_id
        mid = str(uuid.uuid4())
        now = time.time()
        sources_str = json.dumps(sources) if sources else None
        citations_str = json.dumps(citations) if citations else None
        attachments_str = json.dumps(attachments) if attachments else None

        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO messages (
                    id, conversation_id, role, content,
                    sources_json, citations_json, attachments_json, model, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (mid, target_conv_id, role, content, sources_str, citations_str, attachments_str, model, now))
            conn.execute("""
                UPDATE conversations
                SET updated_at = ?,
                    message_count = COALESCE(message_count, 0) + 1
                WHERE id = ?
            """, (now, target_conv_id))
            conn.commit()

        return {
            "id": mid,
            "message_id": mid,
            "conversation_id": target_conv_id,
            "role": role,
            "content": content,
            "sources": sources or [],
            "citations": citations or [],
            "attachments": attachments or [],
            "model": model,
            "created_at": now,
            "timestamp": now
        }

    # --- Artifacts ---
    @staticmethod
    def list_artifacts(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            if project_id:
                rows = conn.execute("SELECT * FROM artifacts WHERE project_id = ? ORDER BY updated_at DESC", (project_id,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM artifacts ORDER BY updated_at DESC").fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_artifact(artifact_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM artifacts WHERE id = ?", (artifact_id,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def save_artifact(
        title: str,
        content: str,
        artifact_type: str = "documentation",
        language: str = "markdown",
        project_id: str = "default",
        conversation_id: Optional[str] = None,
        artifact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        aid = artifact_id or str(uuid.uuid4())
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO artifacts (id, project_id, conversation_id, title, artifact_type, language, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    content = excluded.content,
                    artifact_type = excluded.artifact_type,
                    language = excluded.language,
                    updated_at = excluded.updated_at
            """, (aid, project_id, conversation_id, title, artifact_type, language, content, now, now))
            conn.commit()
        return PlatformDB.get_artifact(aid)

    create_artifact = save_artifact

    @staticmethod
    def delete_artifact(artifact_id: str) -> bool:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM artifacts WHERE id = ?", (artifact_id,))
            conn.commit()
        return True

    # --- Prompt Library ---
    @staticmethod
    def list_prompts() -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute("SELECT * FROM prompts ORDER BY is_builtin DESC, created_at DESC").fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def create_prompt(title: str, category: str, prompt_text: str, description: str = "") -> Dict[str, Any]:
        pid = str(uuid.uuid4())
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO prompts (id, title, category, description, prompt_text, is_builtin, created_at)
                VALUES (?, ?, ?, ?, ?, 0, ?)
            """, (pid, title, category, description, prompt_text, now))
            conn.commit()
        return {
            "id": pid,
            "title": title,
            "category": category,
            "description": description,
            "prompt_text": prompt_text,
            "is_builtin": 0,
            "created_at": now,
        }

    @staticmethod
    def delete_prompt(prompt_id: str) -> bool:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM prompts WHERE id = ? AND is_builtin = 0", (prompt_id,))
            conn.commit()
        return True

    # --- Bookmarks ---
    @staticmethod
    def list_bookmarks(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            if project_id:
                rows = conn.execute("SELECT * FROM bookmarks WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM bookmarks ORDER BY created_at DESC").fetchall()
            items = []
            for r in rows:
                item = dict(r)
                if item.get("content_json"):
                    item["data"] = json.loads(item["content_json"])
                items.append(item)
            return items

    @staticmethod
    def create_bookmark(title: str, item_type: str, data: Dict[str, Any], project_id: str = "default") -> Dict[str, Any]:
        bid = str(uuid.uuid4())
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO bookmarks (id, project_id, title, item_type, content_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (bid, project_id, title, item_type, json.dumps(data), now))
            conn.commit()
        return {"id": bid, "project_id": project_id, "title": title, "item_type": item_type, "data": data, "created_at": now}

    @staticmethod
    def delete_bookmark(bookmark_id: str) -> bool:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
            conn.commit()
        return True

    # --- Settings ---
    @staticmethod
    def get_settings() -> Dict[str, Any]:
        with get_db_connection() as conn:
            rows = conn.execute("SELECT * FROM settings").fetchall()
            result = {}
            for r in rows:
                try:
                    result[r["key"]] = json.loads(r["value_json"])
                except Exception:
                    result[r["key"]] = r["value_json"]
            return result

    @staticmethod
    def save_setting(key: str, value: Any) -> None:
        now = time.time()
        val_json = json.dumps(value)
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO settings (key, value_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
            """, (key, val_json, now))
            conn.commit()

    # --- Extensions Platform Registry ---
    @staticmethod
    def list_extensions() -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute("SELECT * FROM extensions ORDER BY name ASC").fetchall()
            results = []
            for r in rows:
                item = dict(r)
                item["installed"] = bool(item["installed"])
                item["enabled"] = bool(item["enabled"])
                item["visible"] = bool(item["visible"])
                try:
                    item["manifest"] = json.loads(item["manifest_json"])
                except Exception:
                    item["manifest"] = {}
                results.append(item)
            return results

    @staticmethod
    def get_extension(extension_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM extensions WHERE id = ?", (extension_id,)).fetchone()
            if not row:
                return None
            item = dict(row)
            item["installed"] = bool(item["installed"])
            item["enabled"] = bool(item["enabled"])
            item["visible"] = bool(item["visible"])
            try:
                item["manifest"] = json.loads(item["manifest_json"])
            except Exception:
                item["manifest"] = {}
            return item

    @staticmethod
    def register_extension(
        extension_id: str,
        name: str,
        version: str,
        manifest: Dict[str, Any],
        installed: bool = False,
        enabled: bool = False,
        visible: bool = False,
    ) -> Dict[str, Any]:
        now = time.time()
        manifest_str = json.dumps(manifest)
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO extensions (id, name, version, manifest_json, installed, enabled, visible, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    version = excluded.version,
                    manifest_json = excluded.manifest_json,
                    updated_at = excluded.updated_at
            """, (
                extension_id,
                name,
                version,
                manifest_str,
                1 if installed else 0,
                1 if enabled else 0,
                1 if visible else 0,
                now,
                now,
            ))
            conn.commit()
        return PlatformDB.get_extension(extension_id)

    @staticmethod
    def update_extension_state(
        extension_id: str,
        installed: Optional[bool] = None,
        enabled: Optional[bool] = None,
        visible: Optional[bool] = None,
        health_status: Optional[str] = None,
        health_message: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        ext = PlatformDB.get_extension(extension_id)
        if not ext:
            return None

        now = time.time()
        updates = []
        params = []

        if installed is not None:
            updates.append("installed = ?")
            params.append(1 if installed else 0)
            if not installed:
                updates.append("enabled = ?")
                params.append(0)

        if enabled is not None:
            if enabled and not ext["installed"] and installed is not True:
                raise ValueError("Cannot enable an extension that is not installed.")
            updates.append("enabled = ?")
            params.append(1 if enabled else 0)

        if visible is not None:
            updates.append("visible = ?")
            params.append(1 if visible else 0)

        if health_status is not None:
            updates.append("health_status = ?")
            params.append(health_status)

        if health_message is not None:
            updates.append("health_message = ?")
            params.append(health_message)

        if not updates:
            return ext

        updates.append("updated_at = ?")
        params.append(now)
        params.append(extension_id)

        sql = f"UPDATE extensions SET {', '.join(updates)} WHERE id = ?"
        with get_db_connection() as conn:
            conn.execute(sql, tuple(params))
            conn.commit()

        return PlatformDB.get_extension(extension_id)

    @staticmethod
    def delete_extension(extension_id: str) -> bool:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM extension_storage WHERE extension_id = ?", (extension_id,))
            conn.execute("DELETE FROM extensions WHERE id = ?", (extension_id,))
            conn.commit()
        return True

    # --- Isolated Extension Storage ---
    @staticmethod
    def get_extension_storage(extension_id: str, key: str) -> Optional[Any]:
        with get_db_connection() as conn:
            row = conn.execute(
                "SELECT value_json FROM extension_storage WHERE extension_id = ? AND storage_key = ?",
                (extension_id, key),
            ).fetchone()
            if not row:
                return None
            try:
                return json.loads(row["value_json"])
            except Exception:
                return row["value_json"]

    @staticmethod
    def list_extension_storage(extension_id: str) -> Dict[str, Any]:
        with get_db_connection() as conn:
            rows = conn.execute(
                "SELECT storage_key, value_json FROM extension_storage WHERE extension_id = ?",
                (extension_id,),
            ).fetchall()
            res = {}
            for r in rows:
                k = r["storage_key"]
                try:
                    res[k] = json.loads(r["value_json"])
                except Exception:
                    res[k] = r["value_json"]
            return res

    @staticmethod
    def set_extension_storage(extension_id: str, key: str, value: Any) -> None:
        now = time.time()
        val_json = json.dumps(value)
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO extension_storage (extension_id, storage_key, value_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(extension_id, storage_key) DO UPDATE SET
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
            """, (extension_id, key, val_json, now))
            conn.commit()

    @staticmethod
    def delete_extension_storage(extension_id: str, key: str) -> bool:
        with get_db_connection() as conn:
            conn.execute(
                "DELETE FROM extension_storage WHERE extension_id = ? AND storage_key = ?",
                (extension_id, key),
            )
            conn.commit()
        return True

    # --- Audit Logs ---
    @staticmethod
    def log_extension_audit(extension_id: str, action: str, details: Dict[str, Any]) -> Dict[str, Any]:
        lid = str(uuid.uuid4())
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO extension_audit_logs (id, extension_id, action, details_json, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (lid, extension_id, action, json.dumps(details), now))
            conn.commit()
        return {"id": lid, "extension_id": extension_id, "action": action, "details": details, "timestamp": now}

    @staticmethod
    def get_extension_audit_logs(extension_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            if extension_id:
                rows = conn.execute(
                    "SELECT * FROM extension_audit_logs WHERE extension_id = ? ORDER BY timestamp DESC LIMIT ?",
                    (extension_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM extension_audit_logs ORDER BY timestamp DESC LIMIT ?",
                    (limit,),
                ).fetchall()
            logs = []
            for r in rows:
                item = dict(r)
                try:
                    item["details"] = json.loads(item["details_json"])
                except Exception:
                    item["details"] = {}
                logs.append(item)
            return logs

    # --- Document & File Intelligence ---
    @staticmethod
    def save_document(
        doc_id: str,
        project_id: str,
        filename: str,
        file_type: str,
        file_size: int,
        chunks: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO documents (id, project_id, filename, file_type, file_size, chunk_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (doc_id, project_id, filename, file_type, file_size, len(chunks), now))

            for idx, c in enumerate(chunks):
                cid = str(uuid.uuid4())
                conn.execute("""
                    INSERT INTO document_chunks (id, document_id, chunk_index, content, page_number, line_start, line_end)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    cid,
                    doc_id,
                    idx,
                    c.get("text", ""),
                    c.get("page", 1),
                    c.get("line_start"),
                    c.get("line_end"),
                ))
            conn.commit()

        return {
            "id": doc_id,
            "project_id": project_id,
            "filename": filename,
            "file_type": file_type,
            "file_size": file_size,
            "chunk_count": len(chunks),
            "created_at": now,
        }

    @staticmethod
    def list_documents(project_id: str = "default") -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC",
                (project_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
            if not row:
                return None
            doc = dict(row)
            chunk_rows = conn.execute(
                "SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC",
                (doc_id,),
            ).fetchall()
            doc["chunks"] = [dict(c) for c in chunk_rows]
            return doc

    @staticmethod
    def delete_document(doc_id: str) -> bool:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM document_chunks WHERE document_id = ?", (doc_id,))
            conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            conn.commit()
        return True

    @staticmethod
    def search_document_chunks(query: str, project_id: str = "default", limit: int = 5) -> List[Dict[str, Any]]:
        tokens = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
        if not tokens:
            return []

        with get_db_connection() as conn:
            sql = """
                SELECT c.*, d.filename, d.file_type
                FROM document_chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE d.project_id = ?
            """
            rows = conn.execute(sql, (project_id,)).fetchall()
            scored = []
            for r in rows:
                content_lower = r["content"].lower()
                score = sum(content_lower.count(t) for t in tokens)
                if score > 0:
                    scored.append((score, dict(r)))

            scored.sort(key=lambda x: x[0], reverse=True)
            return [item[1] for item in scored[:limit]]

    # =========================================================================
    # ANVESHA V2: Multi-Agent AI Governance Data Access Methods
    # =========================================================================

    # --- Agents ---
    @staticmethod
    def list_agents() -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute("SELECT * FROM agents ORDER BY name ASC").fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["capabilities"] = json.loads(d["capabilities_json"])
                d["permissions"] = json.loads(d["permissions_json"])
                result.append(d)
            return result

    @staticmethod
    def get_agent(agent_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["capabilities"] = json.loads(d["capabilities_json"])
            d["permissions"] = json.loads(d["permissions_json"])
            return d

    @staticmethod
    def register_agent(
        agent_id: str,
        name: str,
        description: str,
        role: str,
        system_prompt: str,
        capabilities: List[str],
        permissions: List[str],
        model_provider: str = "auto",
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO agents (id, name, description, role, system_prompt, model_provider, model_name, capabilities_json, permissions_json, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    role=excluded.role,
                    system_prompt=excluded.system_prompt,
                    capabilities_json=excluded.capabilities_json,
                    permissions_json=excluded.permissions_json,
                    updated_at=excluded.updated_at
            """, (
                agent_id,
                name,
                description,
                role,
                system_prompt,
                model_provider,
                model_name,
                json.dumps(capabilities),
                json.dumps(permissions),
                now,
                now
            ))
            conn.commit()
        return PlatformDB.get_agent(agent_id)

    @staticmethod
    def update_agent_status(agent_id: str, status: str) -> None:
        now = time.time()
        with get_db_connection() as conn:
            conn.execute(
                "UPDATE agents SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, agent_id)
            )
            conn.commit()

    # --- Multi-Agent Tasks ---
    @staticmethod
    def create_multi_agent_task(
        goal: str,
        plan_dag: Dict[str, Any],
        project_id: str = "default",
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO multi_agent_tasks (id, project_id, conversation_id, goal, status, plan_dag_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'planning', ?, ?, ?)
            """, (
                task_id,
                project_id,
                conversation_id,
                goal,
                json.dumps(plan_dag),
                now,
                now
            ))
            conn.commit()
        return PlatformDB.get_multi_agent_task(task_id)

    @staticmethod
    def get_multi_agent_task(task_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM multi_agent_tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["plan_dag"] = json.loads(d["plan_dag_json"])
            d["steps"] = PlatformDB.get_task_steps(task_id)
            return d

    @staticmethod
    def update_multi_agent_task(task_id: str, status: str, final_output: Optional[str] = None) -> None:
        now = time.time()
        with get_db_connection() as conn:
            if final_output is not None:
                conn.execute(
                    "UPDATE multi_agent_tasks SET status = ?, final_output = ?, updated_at = ? WHERE id = ?",
                    (status, final_output, now, task_id)
                )
            else:
                conn.execute(
                    "UPDATE multi_agent_tasks SET status = ?, updated_at = ? WHERE id = ?",
                    (status, now, task_id)
                )
            conn.commit()

    @staticmethod
    def list_multi_agent_tasks(project_id: str = "default", limit: int = 20) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM multi_agent_tasks WHERE project_id = ? ORDER BY created_at DESC LIMIT ?",
                (project_id, limit)
            ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["plan_dag"] = json.loads(d["plan_dag_json"])
                result.append(d)
            return result

    # --- Task Steps ---
    @staticmethod
    def create_task_step(
        task_id: str,
        step_index: int,
        title: str,
        assigned_agent_id: str,
        dependencies: List[str],
        input_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        step_id = f"step_{step_index}_{uuid.uuid4().hex[:8]}"
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO task_steps (id, task_id, step_index, title, assigned_agent_id, dependencies_json, status, input_payload_json, governance_status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'pending')
            """, (
                step_id,
                task_id,
                step_index,
                title,
                assigned_agent_id,
                json.dumps(dependencies),
                json.dumps(input_payload)
            ))
            conn.commit()
        return PlatformDB.get_task_step(step_id)

    @staticmethod
    def get_task_step(step_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM task_steps WHERE id = ?", (step_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["dependencies"] = json.loads(d["dependencies_json"])
            d["input_payload"] = json.loads(d["input_payload_json"])
            d["output_payload"] = json.loads(d["output_payload_json"]) if d["output_payload_json"] else None
            return d

    @staticmethod
    def get_task_steps(task_id: str) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM task_steps WHERE task_id = ? ORDER BY step_index ASC",
                (task_id,)
            ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["dependencies"] = json.loads(d["dependencies_json"])
                d["input_payload"] = json.loads(d["input_payload_json"])
                d["output_payload"] = json.loads(d["output_payload_json"]) if d["output_payload_json"] else None
                result.append(d)
            return result

    @staticmethod
    def update_task_step(
        step_id: str,
        status: str,
        output_payload: Optional[Dict[str, Any]] = None,
        governance_status: Optional[str] = None,
        started_at: Optional[float] = None,
        completed_at: Optional[float] = None
    ) -> None:
        updates = ["status = ?"]
        params: List[Any] = [status]

        if output_payload is not None:
            updates.append("output_payload_json = ?")
            params.append(json.dumps(output_payload))
        if governance_status is not None:
            updates.append("governance_status = ?")
            params.append(governance_status)
        if started_at is not None:
            updates.append("started_at = ?")
            params.append(started_at)
        if completed_at is not None:
            updates.append("completed_at = ?")
            params.append(completed_at)

        params.append(step_id)
        sql = f"UPDATE task_steps SET {', '.join(updates)} WHERE id = ?"

        with get_db_connection() as conn:
            conn.execute(sql, tuple(params))
            conn.commit()

    # --- Governed Agent Messages ---
    @staticmethod
    def record_agent_message(
        task_id: str,
        sender_id: str,
        recipient_id: str,
        message_type: str,
        content: Dict[str, Any],
        governance_decision: str = "ALLOW",
        step_id: Optional[str] = None
    ) -> Dict[str, Any]:
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO agent_messages (id, task_id, step_id, sender_id, recipient_id, message_type, content_json, governance_decision, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                msg_id,
                task_id,
                step_id,
                sender_id,
                recipient_id,
                message_type,
                json.dumps(content),
                governance_decision,
                now
            ))
            conn.commit()
        return {
            "id": msg_id,
            "task_id": task_id,
            "step_id": step_id,
            "sender_id": sender_id,
            "recipient_id": recipient_id,
            "message_type": message_type,
            "content": content,
            "governance_decision": governance_decision,
            "timestamp": now
        }

    @staticmethod
    def list_agent_messages(task_id: str) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM agent_messages WHERE task_id = ? ORDER BY timestamp ASC",
                (task_id,)
            ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["content"] = json.loads(d["content_json"])
                result.append(d)
            return result

    # --- Shared Organizational Memory ---
    @staticmethod
    def add_organizational_memory(
        memory_type: str,
        title: str,
        content: str,
        metadata: Dict[str, Any],
        created_by: str,
        project_id: str = "default"
    ) -> Dict[str, Any]:
        mem_id = f"mem_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO organizational_memory (id, project_id, memory_type, title, content, metadata_json, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                mem_id,
                project_id,
                memory_type,
                title,
                content,
                json.dumps(metadata),
                created_by,
                now
            ))
            conn.commit()
        return {
            "id": mem_id,
            "project_id": project_id,
            "memory_type": memory_type,
            "title": title,
            "content": content,
            "metadata": metadata,
            "created_by": created_by,
            "created_at": now
        }

    @staticmethod
    def search_organizational_memory(
        query: str,
        memory_type: Optional[str] = None,
        project_id: str = "default",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        tokens = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
        with get_db_connection() as conn:
            if memory_type:
                rows = conn.execute(
                    "SELECT * FROM organizational_memory WHERE project_id = ? AND memory_type = ? ORDER BY created_at DESC",
                    (project_id, memory_type)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM organizational_memory WHERE project_id = ? ORDER BY created_at DESC",
                    (project_id,)
                ).fetchall()

            scored = []
            for r in rows:
                d = dict(r)
                d["metadata"] = json.loads(d["metadata_json"])
                if not tokens:
                    scored.append((1.0, d))
                    continue
                text = f"{d['title']} {d['content']}".lower()
                score = sum(text.count(t) for t in tokens)
                if score > 0:
                    scored.append((score, d))

            scored.sort(key=lambda x: x[0], reverse=True)
            return [item[1] for item in scored[:limit]]

    @staticmethod
    def list_organizational_memories(project_id: str = "default", memory_type: Optional[str] = None) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            if memory_type:
                rows = conn.execute(
                    "SELECT * FROM organizational_memory WHERE project_id = ? AND memory_type = ? ORDER BY created_at DESC",
                    (project_id, memory_type)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM organizational_memory WHERE project_id = ? ORDER BY created_at DESC",
                    (project_id,)
                ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["metadata"] = json.loads(d["metadata_json"])
                result.append(d)
            return result

    @staticmethod
    def delete_organizational_memory(memory_id: str) -> bool:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM organizational_memory WHERE id = ?", (memory_id,))
            conn.commit()
        return True

    # --- Governance Policies ---
    @staticmethod
    def list_governance_policies(active_only: bool = True) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            sql = "SELECT * FROM governance_policies"
            if active_only:
                sql += " WHERE is_active = 1"
            sql += " ORDER BY created_at ASC"
            rows = conn.execute(sql).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["condition"] = json.loads(d["condition_json"])
                result.append(d)
            return result

    @staticmethod
    def get_governance_policy(policy_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM governance_policies WHERE id = ?", (policy_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["condition"] = json.loads(d["condition_json"])
            return d

    @staticmethod
    def create_governance_policy(
        name: str,
        target_action: str,
        condition: Dict[str, Any],
        action_type: str,
        risk_level: str,
        description: str = "",
        policy_id: Optional[str] = None
    ) -> Dict[str, Any]:
        pid = policy_id or f"pol_{uuid.uuid4().hex[:8]}"
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO governance_policies (id, name, description, target_action, condition_json, action_type, risk_level, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    target_action=excluded.target_action,
                    condition_json=excluded.condition_json,
                    action_type=excluded.action_type,
                    risk_level=excluded.risk_level,
                    updated_at=excluded.updated_at
            """, (
                pid,
                name,
                description,
                target_action,
                json.dumps(condition),
                action_type,
                risk_level,
                now,
                now
            ))
            conn.commit()
        return PlatformDB.get_governance_policy(pid)

    @staticmethod
    def update_governance_policy(policy_id: str, is_active: Optional[bool] = None, action_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
        now = time.time()
        updates = ["updated_at = ?"]
        params: List[Any] = [now]
        if is_active is not None:
            updates.append("is_active = ?")
            params.append(1 if is_active else 0)
        if action_type is not None:
            updates.append("action_type = ?")
            params.append(action_type)
        params.append(policy_id)

        sql = f"UPDATE governance_policies SET {', '.join(updates)} WHERE id = ?"
        with get_db_connection() as conn:
            conn.execute(sql, tuple(params))
            conn.commit()
        return PlatformDB.get_governance_policy(policy_id)

    # --- Human-in-the-Loop Approvals ---
    @staticmethod
    def create_approval_request(
        task_id: str,
        step_id: str,
        agent_id: str,
        action_requested: str,
        parameters: Dict[str, Any],
        risk_score: int,
        risk_explanation: str
    ) -> Dict[str, Any]:
        req_id = f"appr_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO approval_requests (id, task_id, step_id, agent_id, action_requested, parameters_json, risk_score, risk_explanation, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """, (
                req_id,
                task_id,
                step_id,
                agent_id,
                action_requested,
                json.dumps(parameters),
                risk_score,
                risk_explanation,
                now
            ))
            conn.commit()
        return PlatformDB.get_approval_request(req_id)

    @staticmethod
    def get_approval_request(request_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM approval_requests WHERE id = ?", (request_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["parameters"] = json.loads(d["parameters_json"])
            return d

    @staticmethod
    def list_approval_requests(status: Optional[str] = None, task_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            clauses = []
            params: List[Any] = []
            if status:
                clauses.append("status = ?")
                params.append(status)
            if task_id:
                clauses.append("task_id = ?")
                params.append(task_id)

            sql = "SELECT * FROM approval_requests"
            if clauses:
                sql += " WHERE " + " AND ".join(clauses)
            sql += " ORDER BY created_at DESC"

            rows = conn.execute(sql, tuple(params)).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["parameters"] = json.loads(d["parameters_json"])
                result.append(d)
            return result

    @staticmethod
    def resolve_approval_request(
        request_id: str,
        decision: str,  # 'approved' or 'rejected'
        reviewed_by: str = "administrator",
        review_reason: str = ""
    ) -> Optional[Dict[str, Any]]:
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                UPDATE approval_requests
                SET status = ?, reviewed_by = ?, review_reason = ?, resolved_at = ?
                WHERE id = ?
            """, (decision, reviewed_by, review_reason, now, request_id))
            conn.commit()
        return PlatformDB.get_approval_request(request_id)

    # --- Adaptive OS Telemetry & Self-Optimization Methods ---

    @staticmethod
    def record_model_telemetry(
        provider_id: str,
        model_name: str,
        task_type: str,
        latency_ms: int,
        tokens_used: int = 0,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> str:
        tid = f"telem_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO model_telemetry (
                    id, provider_id, model_name, task_type, latency_ms, tokens_used, success, error_message, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (tid, provider_id, model_name, task_type, latency_ms, tokens_used, 1 if success else 0, error_message, now))
            conn.commit()
        return tid

    @staticmethod
    def get_model_telemetry_summary() -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            rows = conn.execute("""
                SELECT 
                    provider_id,
                    model_name,
                    COUNT(*) as total_calls,
                    AVG(latency_ms) as avg_latency_ms,
                    MIN(latency_ms) as min_latency_ms,
                    MAX(latency_ms) as max_latency_ms,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
                FROM model_telemetry
                GROUP BY provider_id, model_name
            """).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def log_adaptive_intent(
        query_text: str,
        classified_type: str,
        complexity: str,
        confidence: float,
        selected_layout: str,
        selected_model: str,
        user_override_layout: Optional[str] = None
    ) -> str:
        lid = f"intent_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO adaptive_intent_logs (
                    id, query_text, classified_type, complexity, confidence, selected_layout, selected_model, user_override_layout, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (lid, query_text[:200], classified_type, complexity, confidence, selected_layout, selected_model, user_override_layout, now))
            conn.commit()
        return lid

    @staticmethod
    def create_optimization_recommendation(
        category: str,
        title: str,
        description: str,
        impact_level: str,
        metric_evidence: Dict[str, Any]
    ) -> Dict[str, Any]:
        rid = f"rec_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO optimization_recommendations (
                    id, category, title, description, impact_level, metric_evidence, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?)
            """, (rid, category, title, description, impact_level, json.dumps(metric_evidence), now))
            conn.commit()
        return PlatformDB.get_optimization_recommendation(rid)

    @staticmethod
    def get_optimization_recommendation(rec_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            row = conn.execute("SELECT * FROM optimization_recommendations WHERE id = ?", (rec_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["metric_evidence"] = json.loads(d["metric_evidence"])
            return d

    @staticmethod
    def list_optimization_recommendations(status: Optional[str] = None) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            if status:
                rows = conn.execute("SELECT * FROM optimization_recommendations WHERE status = ? ORDER BY created_at DESC", (status,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM optimization_recommendations ORDER BY created_at DESC").fetchall()
            res = []
            for r in rows:
                d = dict(r)
                d["metric_evidence"] = json.loads(d["metric_evidence"])
                res.append(d)
            return res

    @staticmethod
    def update_optimization_recommendation_status(
        rec_id: str,
        new_status: str,  # 'approved' or 'rejected'
        reviewed_by: str = "administrator"
    ) -> Optional[Dict[str, Any]]:
        now = time.time()
        with get_db_connection() as conn:
            conn.execute("""
                UPDATE optimization_recommendations
                SET status = ?, reviewed_by = ?, resolved_at = ?
                WHERE id = ?
            """, (new_status, reviewed_by, now, rec_id))
            conn.commit()
        return PlatformDB.get_optimization_recommendation(rec_id)
