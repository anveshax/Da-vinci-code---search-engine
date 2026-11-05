"""
Interruption & Barge-In Manager for Anvesha Voice.

Handles race-free interruption of:
- Active LLM text generation tasks
- Streaming TTS synthesis jobs
- WebSocket audio queue playback
- Synchronizing conversation transcript state up to the interruption point
"""
import asyncio
import logging
from typing import Optional, Set

logger = logging.getLogger(__name__)


class InterruptionManager:
    """
    Manages active task cancellation and clean state transitions during user barge-in.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._active_generation_task: Optional[asyncio.Task] = None
        self._active_tts_tasks: Set[asyncio.Task] = set()
        self._is_interrupted: bool = False
        self._interruption_lock = asyncio.Lock()

    def register_generation_task(self, task: asyncio.Task) -> None:
        """Registers the current LLM response generation task."""
        self._active_generation_task = task
        self._is_interrupted = False

    def register_tts_task(self, task: asyncio.Task) -> None:
        """Registers an asynchronous TTS chunk synthesis task."""
        self._active_tts_tasks.add(task)
        task.add_done_callback(lambda t: self._active_tts_tasks.discard(t))

    async def interrupt(self) -> bool:
        """
        Executes immediate cancellation of active generation and speech playback.
        Returns True if an active response was interrupted.
        """
        async with self._interruption_lock:
            self._is_interrupted = True
            was_active = False

            # 1. Cancel LLM generation task
            if self._active_generation_task and not self._active_generation_task.done():
                logger.info(f"Session {self.session_id}: Cancelling active LLM generation task.")
                self._active_generation_task.cancel()
                was_active = True
                self._active_generation_task = None

            # 2. Cancel all pending TTS synthesis tasks
            for tts_task in list(self._active_tts_tasks):
                if not tts_task.done():
                    tts_task.cancel()
                    was_active = True
            self._active_tts_tasks.clear()

            return was_active

    def is_interrupted(self) -> bool:
        """Returns True if the current response cycle has been interrupted."""
        return self._is_interrupted

    def reset(self) -> None:
        """Resets interruption flag for a new user turn."""
        self._is_interrupted = False
