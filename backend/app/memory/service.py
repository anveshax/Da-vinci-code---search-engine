"""
Anvesha V2: Shared Organizational Memory Service.

Provides scoped, persistent institutional memory across four distinct categories:
1. Episodic Memory: Historical multi-agent task execution traces and outcomes.
2. Semantic Memory: Architectural context, project documentation, and codebase knowledge.
3. Procedural Memory: Verified runbooks, remediation recipes, and execution workflows.
4. Decision Memory: Log of governance decisions, approvals, and rationale.

Includes role-based access control, source attribution, and lexical keyword retrieval.
"""
import time
from typing import Dict, Any, List, Optional
from app.core.db import PlatformDB


class MemoryAccessDeniedError(Exception):
    """Raised when an agent attempts an unauthorized memory read or write."""
    pass


class OrganizationalMemoryService:
    """Core runtime service for organizational knowledge retention."""

    VALID_MEMORY_TYPES = {"episodic", "semantic", "procedural", "decision"}

    @staticmethod
    def add_memory(
        memory_type: str,
        title: str,
        content: str,
        created_by: str,
        metadata: Optional[Dict[str, Any]] = None,
        project_id: str = "default",
        agent_permissions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Stores a new memory record with source attribution and permission verification.
        """
        if memory_type not in OrganizationalMemoryService.VALID_MEMORY_TYPES:
            raise ValueError(f"Invalid memory_type: '{memory_type}'. Valid types: {OrganizationalMemoryService.VALID_MEMORY_TYPES}")

        # Check write permissions if called by an agent
        if agent_permissions is not None:
            required_perm = f"memory:write_{memory_type}"
            if "memory:write_all" not in agent_permissions and required_perm not in agent_permissions:
                raise MemoryAccessDeniedError(f"Agent '{created_by}' lacks permission '{required_perm}' to write {memory_type} memory.")

        meta = metadata or {}
        meta["recorded_at"] = time.time()
        meta["author"] = created_by

        return PlatformDB.add_organizational_memory(
            memory_type=memory_type,
            title=title,
            content=content,
            metadata=meta,
            created_by=created_by,
            project_id=project_id
        )

    @staticmethod
    def query_memory(
        query: str,
        memory_type: Optional[str] = None,
        requesting_agent_id: Optional[str] = None,
        agent_permissions: Optional[List[str]] = None,
        project_id: str = "default",
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieves relevant memory records, enforcing scoped permissions.
        """
        if memory_type and memory_type not in OrganizationalMemoryService.VALID_MEMORY_TYPES:
            raise ValueError(f"Invalid memory_type: '{memory_type}'.")

        # Check read permissions if called by an agent
        if agent_permissions is not None:
            if "memory:read_all" not in agent_permissions:
                if memory_type and f"memory:read_{memory_type}" not in agent_permissions:
                    raise MemoryAccessDeniedError(
                        f"Agent '{requesting_agent_id}' lacks permission to read '{memory_type}' memory."
                    )

        return PlatformDB.search_organizational_memory(
            query=query,
            memory_type=memory_type,
            project_id=project_id,
            limit=limit
        )

    @staticmethod
    def list_memories(
        project_id: str = "default",
        memory_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Lists all memory entries for administration and dashboard views."""
        return PlatformDB.list_organizational_memories(project_id=project_id, memory_type=memory_type)

    @staticmethod
    def search_memory_semantic(
        query: str,
        project_id: str = "default",
        memory_type: Optional[str] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves memories using semantic vector similarity when exact keywords differ.
        """
        all_memories = PlatformDB.list_organizational_memories(project_id=project_id, memory_type=memory_type)
        if not all_memories or not query.strip():
            return []

        from engine.semantic.embeddings import get_embedding_provider
        provider = get_embedding_provider()
        try:
            texts = [f"{m.get('title', '')} {m.get('content', '')}" for m in all_memories]
            all_vectors = provider.embed_batch([query.strip()] + texts)
            q_vec = all_vectors[0]
            m_vecs = all_vectors[1:]

            scored = []
            for mem, m_vec in zip(all_memories, m_vecs):
                sim = sum(a * b for a, b in zip(q_vec, m_vec))
                scored.append((sim, mem))
            scored.sort(key=lambda x: x[0], reverse=True)
            return [dict(m, semantic_score=round(s, 4)) for s, m in scored[:limit]]
        except Exception:
            # Fallback to standard lexical search
            return PlatformDB.search_organizational_memory(query=query, memory_type=memory_type, project_id=project_id, limit=limit)

    @staticmethod
    def record_decision(
        title: str,
        decision: str,
        rationale: str,
        governance_context: Dict[str, Any],
        created_by: str = "governance_engine",
        project_id: str = "default"
    ) -> Dict[str, Any]:
        """Convenience method to archive governance decisions into decision memory."""
        content = f"Decision: {decision}\nRationale: {rationale}\nContext: {governance_context}"
        return OrganizationalMemoryService.add_memory(
            memory_type="decision",
            title=title,
            content=content,
            created_by=created_by,
            metadata=governance_context,
            project_id=project_id
        )
