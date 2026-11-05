"""
Voice Session Lifecycle & State Management.

Tracks active sessions, timeouts, audio buffers,
and provides thread-safe execution locks.
"""
import time
import uuid
import asyncio
import logging
from typing import Dict, Any, Optional
from app.core.db import PlatformDB
from app.voice.config import voice_settings
from app.voice.models import VoiceMode, VoicePersonaId, VoiceLanguage
from app.voice.interruption_manager import InterruptionManager
from app.voice.conversation_context import VoiceConversationContext
from app.voice.voice_activity import VoiceActivityDetector

logger = logging.getLogger(__name__)


class VoiceSession:
    """Represents a single active voice interaction session."""

    def __init__(
        self,
        session_id: str,
        mode: VoiceMode = VoiceMode.PIPELINE,
        persona: VoicePersonaId = VoicePersonaId.NOVA,
        language: VoiceLanguage = VoiceLanguage.AUTO,
        project_id: str = "default",
        conversation_id: Optional[str] = None,
        stt_provider: Optional[str] = None,
        tts_provider: Optional[str] = None,
    ):
        self.session_id = session_id
        self.mode = mode
        self.persona = persona
        self.language = language
        self.project_id = project_id
        self.conversation_id = conversation_id or str(uuid.uuid4())
        self.stt_provider = stt_provider or voice_settings.DEFAULT_STT_PROVIDER
        self.tts_provider = tts_provider or voice_settings.DEFAULT_TTS_PROVIDER

        self.created_at = time.time()
        self.last_activity = time.time()
        self.active = True

        # Components
        self.interruption_mgr = InterruptionManager(session_id)
        self.context = VoiceConversationContext(self.conversation_id, project_id=project_id)
        self.vad = VoiceActivityDetector()
        self.session_lock = asyncio.Lock()

        # Ensure conversation exists in DB
        self._ensure_conversation_in_db()

    def _ensure_conversation_in_db(self) -> None:
        """Ensures conversation record exists in SQLite."""
        try:
            existing = PlatformDB.get_conversation(self.conversation_id)
            if not existing:
                PlatformDB.create_conversation(
                    title=f"Voice Assistant ({self.persona.value.capitalize()})",
                    project_id=self.project_id,
                    search_mode="auto",
                )
        except Exception as e:
            logger.warning(f"Could not initialize conversation record: {e}")

    def touch(self) -> None:
        """Updates last activity timestamp."""
        self.last_activity = time.time()

    def is_expired(self) -> bool:
        """Checks if session has timed out."""
        return (time.time() - self.last_activity) > voice_settings.SESSION_TIMEOUT_SECONDS

    async def close(self) -> None:
        """Closes session and frees active tasks."""
        self.active = False
        await self.interruption_mgr.interrupt()
        self.vad.reset()


class SessionRegistry:
    """Manages active voice sessions across the backend."""

    _instance: Optional["SessionRegistry"] = None

    def __init__(self):
        self._sessions: Dict[str, VoiceSession] = {}
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> "SessionRegistry":
        if cls._instance is None:
            cls._instance = SessionRegistry()
        return cls._instance

    async def create_session(
        self,
        mode: VoiceMode = VoiceMode.PIPELINE,
        persona: VoicePersonaId = VoicePersonaId.NOVA,
        language: VoiceLanguage = VoiceLanguage.AUTO,
        project_id: str = "default",
        conversation_id: Optional[str] = None,
        stt_provider: Optional[str] = None,
        tts_provider: Optional[str] = None,
    ) -> VoiceSession:
        async with self._lock:
            # Clean expired sessions
            self._cleanup_expired()

            session_id = f"voice_sess_{uuid.uuid4().hex[:12]}"
            session = VoiceSession(
                session_id=session_id,
                mode=mode,
                persona=persona,
                language=language,
                project_id=project_id,
                conversation_id=conversation_id,
                stt_provider=stt_provider,
                tts_provider=tts_provider,
            )
            self._sessions[session_id] = session
            return session

    def get_session(self, session_id: str) -> Optional[VoiceSession]:
        session = self._sessions.get(session_id)
        if session and not session.is_expired():
            session.touch()
            return session
        elif session and session.is_expired():
            asyncio.create_task(session.close())
            self._sessions.pop(session_id, None)
            return None
        return None

    async def close_session(self, session_id: str) -> bool:
        async with self._lock:
            session = self._sessions.pop(session_id, None)
            if session:
                await session.close()
                return True
            return False

    def _cleanup_expired(self) -> None:
        now = time.time()
        expired_ids = [
            sid for sid, s in self._sessions.items()
            if (now - s.last_activity) > voice_settings.SESSION_TIMEOUT_SECONDS
        ]
        for sid in expired_ids:
            s = self._sessions.pop(sid, None)
            if s:
                asyncio.create_task(s.close())


session_registry = SessionRegistry.get_instance()
