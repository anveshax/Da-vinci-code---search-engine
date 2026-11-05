"""
WebSocket Audio Stream & Full-Duplex Connection Handler.

Coordinates binary PCM/WebM frame streaming, real-time VAD,
STT transcription dispatch, and live audio playback push.
"""
import json
import time
import asyncio
import logging
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect

from app.voice.config import voice_settings
from app.voice.models import VoiceEvent
from app.voice.voice_session import VoiceSession
from app.voice.voice_orchestrator import VoiceOrchestrator
from app.voice.provider_registry import voice_registry
from app.voice.audio_processor import AudioProcessor

logger = logging.getLogger(__name__)


class WebSocketAudioStreamHandler:
    """Handles bidirectional audio streaming session over a WebSocket."""

    def __init__(self, websocket: WebSocket, session: VoiceSession):
        self.ws = websocket
        self.session = session
        self.is_assistant_speaking = False
        self._orchestrator_task: Optional[asyncio.Task] = None

    async def run(self) -> None:
        """Main streaming loop."""
        await self.send_event(
            VoiceEvent(
                type="session_started",
                payload={
                    "session_id": self.session.session_id,
                    "mode": self.session.mode.value,
                    "persona": self.session.persona.value,
                    "conversation_id": self.session.conversation_id,
                    "sample_rate": voice_settings.SAMPLE_RATE,
                },
                session_id=self.session.session_id,
                timestamp=time.time(),
            )
        )

        try:
            while self.session.active:
                message = await self.ws.receive()

                if "text" in message and message["text"]:
                    await self._handle_text_packet(message["text"])
                elif "bytes" in message and message["bytes"]:
                    await self._handle_audio_bytes(message["bytes"])

        except WebSocketDisconnect:
            logger.info(f"Voice session {self.session.session_id}: Client disconnected.")
        except Exception as e:
            logger.error(f"Voice session {self.session.session_id} error: {e}", exc_info=True)
            try:
                await self.send_event(
                    VoiceEvent(type="error", payload={"message": str(e)}, timestamp=time.time())
                )
            except Exception:
                pass
        finally:
            await self._cleanup()

    async def _handle_text_packet(self, raw_text: str) -> None:
        """Processes JSON control messages from client."""
        try:
            packet = json.loads(raw_text)
            p_type = packet.get("type", "")

            if p_type == "interrupt":
                await self._handle_interruption("client_button")

            elif p_type == "text_input":
                # Direct user query sent via text in voice mode
                user_text = packet.get("text", "").strip()
                if user_text:
                    await self._dispatch_utterance(user_text)

            elif p_type == "transcript":
                # Interim or final transcript from client browser STT
                transcript = packet.get("transcript", "").strip()
                is_final = packet.get("is_final", False)
                if transcript and is_final:
                    await self._dispatch_utterance(transcript)

            elif p_type == "ping":
                await self.send_event(VoiceEvent(type="pong", timestamp=time.time()))

        except Exception as e:
            logger.warning(f"Invalid text frame received: {e}")

    async def _handle_audio_bytes(self, audio_data: bytes) -> None:
        """Processes incoming raw audio bytes (PCM16 16kHz mono)."""
        # Feed frame into Voice Activity Detector
        is_speech, completed_audio, is_barge_in = self.session.vad.process_frame(
            audio_data, is_assistant_speaking=self.is_assistant_speaking
        )

        # Handle Barge-In Interruption
        if is_barge_in and self.is_assistant_speaking:
            await self._handle_interruption("barge_in_vad")

        # Handle Speech Start
        if is_speech and not self.session.vad.utterance_start_time:
            await self.send_event(
                VoiceEvent(type="user_speech_start", timestamp=time.time(), session_id=self.session.session_id)
            )

        # Handle Completed Utterance (Trailing silence reached)
        if completed_audio:
            logger.info(f"Utterance complete ({len(completed_audio)} bytes). Running STT...")
            await self.send_event(
                VoiceEvent(type="listening", payload={"status": "Transcribing speech"}, timestamp=time.time())
            )

            # 1. Transcribe speech using active STT provider
            stt_provider = voice_registry.get_stt_provider(self.session.stt_provider)
            try:
                stt_res = await stt_provider.transcribe(
                    audio_bytes=completed_audio,
                    audio_format="pcm16",
                    language=self.session.language.value,
                )
                user_text = stt_res.text.strip()
                if not user_text:
                    logger.info("STT returned empty transcript (ambient noise). Resuming listening.")
                    return

                await self.send_event(
                    VoiceEvent(
                        type="final_transcript",
                        payload={"text": user_text, "language": stt_res.language, "confidence": stt_res.confidence},
                        session_id=self.session.session_id,
                        timestamp=time.time(),
                    )
                )

                # 2. Dispatch to orchestrator
                await self._dispatch_utterance(user_text)

            except Exception as e:
                logger.error(f"STT transcription failed: {e}", exc_info=True)
                await self.send_event(
                    VoiceEvent(type="error", payload={"message": f"Transcription error: {e}"}, timestamp=time.time())
                )

    async def _dispatch_utterance(self, text: str) -> None:
        """Launches the generation task in the background and pipes events to the socket."""
        # Cancel any previous task
        if self._orchestrator_task and not self._orchestrator_task.done():
            self._orchestrator_task.cancel()

        self.session.interruption_mgr.reset()
        self.is_assistant_speaking = True

        async def run_pipeline():
            try:
                gen = VoiceOrchestrator.process_utterance_stream(self.session, text)
                async for event in gen:
                    await self.send_event(event)
                    if event.type in ["speaking_completed", "interrupted", "error"]:
                        self.is_assistant_speaking = False
            except asyncio.CancelledError:
                self.is_assistant_speaking = False
                await self.send_event(
                    VoiceEvent(type="interrupted", payload={"reason": "cancelled"}, timestamp=time.time())
                )
            except Exception as e:
                self.is_assistant_speaking = False
                await self.send_event(
                    VoiceEvent(type="error", payload={"message": str(e)}, timestamp=time.time())
                )

        self._orchestrator_task = asyncio.create_task(run_pipeline())
        self.session.interruption_mgr.register_generation_task(self._orchestrator_task)

    async def _handle_interruption(self, reason: str) -> None:
        """Immediately halts assistant audio and generation."""
        logger.info(f"Interruption triggered: {reason}")
        self.is_assistant_speaking = False
        was_active = await self.session.interruption_mgr.interrupt()

        if self._orchestrator_task and not self._orchestrator_task.done():
            self._orchestrator_task.cancel()
            self._orchestrator_task = None

        await self.send_event(
            VoiceEvent(
                type="interrupted",
                payload={"reason": reason, "was_active": was_active},
                session_id=self.session.session_id,
                timestamp=time.time(),
            )
        )

    async def send_event(self, event: VoiceEvent) -> None:
        """Sends a JSON VoiceEvent over the WebSocket."""
        try:
            await self.ws.send_text(event.model_dump_json())
        except Exception as e:
            logger.debug(f"Failed to send event over ws: {e}")

    async def _cleanup(self) -> None:
        """Clean resource disposal."""
        if self._orchestrator_task and not self._orchestrator_task.done():
            self._orchestrator_task.cancel()
        await self.session.close()
