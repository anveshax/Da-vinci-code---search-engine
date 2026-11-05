"""
Voice Conversation Context & Grounding Engine.

Maintains multi-turn context, resolves ordinal source references
(e.g., "tell me more about the second source"), and synchronizes
voice turns with PlatformDB and Organizational Memory.
"""
import re
import logging
from typing import List, Dict, Any, Optional
from app.core.db import PlatformDB
from app.memory.service import OrganizationalMemoryService

logger = logging.getLogger(__name__)

ORDINAL_MAP = {
    "first": 0, "1st": 0, "one": 0, "pehla": 0, "pehli": 0,
    "second": 1, "2nd": 1, "two": 1, "doosra": 1, "doosri": 1,
    "third": 2, "3rd": 2, "three": 2, "teesra": 2, "teesri": 2,
    "fourth": 3, "4th": 3, "four": 3, "chautha": 3,
    "fifth": 4, "5th": 4, "five": 4, "paanchva": 4,
}


class VoiceConversationContext:
    """Manages multi-turn conversation memory and contextual entity resolution."""

    def __init__(self, conversation_id: str, project_id: str = "default"):
        self.conversation_id = conversation_id
        self.project_id = project_id
        self.turns: List[Dict[str, Any]] = []
        self._load_existing_turns()

    def _load_existing_turns(self) -> None:
        """Loads previous turns from SQLite database if conversation exists."""
        try:
            conv = PlatformDB.get_conversation(self.conversation_id)
            if conv and "messages" in conv:
                for m in conv["messages"]:
                    self.turns.append({
                        "role": m.get("role", "user"),
                        "content": m.get("content", ""),
                        "sources": m.get("sources_json") or [],
                        "citations": m.get("citations_json") or [],
                    })
        except Exception as e:
            logger.warning(f"Could not load previous conversation history: {e}")

    def add_user_turn(self, text: str) -> None:
        """Appends user speech turn to local context and database."""
        self.turns.append({
            "role": "user",
            "content": text,
            "sources": [],
            "citations": [],
        })
        try:
            PlatformDB.add_message(
                conversation_id=self.conversation_id,
                role="user",
                content=text,
            )
        except Exception as e:
            logger.warning(f"Could not save user turn to DB: {e}")

    def add_assistant_turn(
        self,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
        citations: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None
    ) -> None:
        """Appends assistant spoken turn with grounding sources to context and DB."""
        clean_sources = sources or []
        clean_citations = citations or []
        self.turns.append({
            "role": "assistant",
            "content": content,
            "sources": clean_sources,
            "citations": clean_citations,
        })
        try:
            PlatformDB.add_message(
                conversation_id=self.conversation_id,
                role="assistant",
                content=content,
                sources=clean_sources,
                citations=clean_citations,
                model=model,
            )
        except Exception as e:
            logger.warning(f"Could not save assistant turn to DB: {e}")

    def resolve_source_reference(self, utterance: str) -> Optional[Dict[str, Any]]:
        """
        Resolves phrases like 'tell me more about the second source' or 'kya bola teesre source ne'
        to the exact referenced document/url from the previous assistant turn.
        """
        low = utterance.lower()
        if not ("source" in low or "link" in low or "result" in low or "pehle" in low or "doosre" in low):
            return None

        # Find latest assistant turn with sources
        last_sources = None
        for turn in reversed(self.turns):
            if turn["role"] == "assistant" and turn.get("sources"):
                last_sources = turn["sources"]
                break

        if not last_sources:
            return None

        # Check for ordinal matches
        for word, idx in ORDINAL_MAP.items():
            if re.search(r"\b" + re.escape(word) + r"\b", low):
                if idx < len(last_sources):
                    return last_sources[idx]

        return None

    def get_messages_for_llm(self, max_turns: int = 10) -> List[Dict[str, str]]:
        """Formats recent conversation turns for LLM chat completions."""
        recent = self.turns[-max_turns:] if len(self.turns) > max_turns else self.turns
        return [{"role": t["role"], "content": t["content"]} for t in recent]
