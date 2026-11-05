"""
Voice API Endpoints for Anvesha Voice Engine 3.0.

Provides versioned REST endpoints and WebSocket stream for:
- Session lifecycle (create, fetch, terminate)
- Direct STT audio transcription
- Direct TTS speech synthesis
- Full-duplex WebSocket audio streaming
- Interruption and cancellation controls
- Provider & voice persona discovery
"""
import time
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, Path
from pydantic import BaseModel, Field

from app.voice.config import voice_settings
from app.voice.models import (
    VoiceSessionCreate,
    VoiceSessionResponse,
    TranscribeRequest,
    TranscribeResponse,
    SynthesizeRequest,
    SynthesizeResponse,
    VoicePersonaId,
)
from app.voice.voice_session import session_registry
from app.voice.provider_registry import voice_registry
from app.voice.audio_stream import WebSocketAudioStreamHandler
from app.voice.audio_processor import AudioProcessor
from app.voice.voice_personas import list_personas, get_persona

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice Engine 3.0"])


@router.post("/sessions", response_model=VoiceSessionResponse)
async def create_voice_session(req: VoiceSessionCreate):
    """
    Creates a new stateful voice interaction session.
    """
    session = await session_registry.create_session(
        mode=req.mode,
        persona=req.persona,
        language=req.language,
        project_id=req.project_id,
        conversation_id=req.conversation_id,
        stt_provider=req.stt_provider,
        tts_provider=req.tts_provider,
    )

    return VoiceSessionResponse(
        session_id=session.session_id,
        mode=session.mode,
        persona=session.persona,
        language=session.language,
        conversation_id=session.conversation_id,
        project_id=session.project_id,
        created_at=session.created_at,
        active=session.active,
        stt_provider=session.stt_provider,
        tts_provider=session.tts_provider,
        supported_voices=list_personas(),
    )


@router.get("/sessions/{session_id}", response_model=VoiceSessionResponse)
async def get_voice_session(session_id: str = Path(..., description="Unique voice session ID")):
    """
    Retrieves the status of an active voice session.
    """
    session = session_registry.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Voice session not found or expired.")

    return VoiceSessionResponse(
        session_id=session.session_id,
        mode=session.mode,
        persona=session.persona,
        language=session.language,
        conversation_id=session.conversation_id,
        project_id=session.project_id,
        created_at=session.created_at,
        active=session.active,
        stt_provider=session.stt_provider,
        tts_provider=session.tts_provider,
        supported_voices=list_personas(),
    )


@router.delete("/sessions/{session_id}")
async def delete_voice_session(session_id: str = Path(...)):
    """
    Terminates a voice session and frees associated resources.
    """
    success = await session_registry.close_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Voice session not found or already closed.")
    return {"status": "success", "session_id": session_id, "message": "Voice session closed."}


@router.post("/sessions/{session_id}/interrupt")
async def interrupt_voice_session(session_id: str = Path(...)):
    """
    Immediately interrupts ongoing generation and audio playback for the session.
    """
    session = session_registry.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Voice session not found.")

    was_active = await session.interruption_mgr.interrupt()
    return {"status": "interrupted", "session_id": session_id, "was_active": was_active}


@router.post("/sessions/{session_id}/cancel")
async def cancel_voice_session(session_id: str = Path(...)):
    """
    Cancels current execution turn.
    """
    return await interrupt_voice_session(session_id)


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(req: TranscribeRequest):
    """
    Direct endpoint for speech-to-text audio transcription.
    """
    try:
        raw_bytes = AudioProcessor.base64_to_bytes(req.audio_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio payload: {e}")

    # Determine provider
    stt_provider = voice_registry.get_stt_provider()
    try:
        res = await stt_provider.transcribe(
            audio_bytes=raw_bytes,
            audio_format=req.audio_format,
            language=req.language or "auto",
        )
        return res
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failure: {e}")


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize_speech(req: SynthesizeRequest):
    """
    Direct endpoint for text-to-speech synthesis.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    tts_provider = voice_registry.get_tts_provider()
    try:
        res = await tts_provider.synthesize(
            text=req.text,
            persona_id=req.persona.value,
            language=req.language,
            speed=req.speed,
            pitch=req.pitch,
        )
        return res
    except Exception as e:
        logger.error(f"Speech synthesis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Synthesis failure: {e}")


@router.get("/providers")
async def get_providers():
    """
    Lists available STT and TTS providers and their runtime health.
    """
    return voice_registry.get_provider_status()


@router.get("/voices")
async def get_voices():
    """
    Lists supported selectable voice personas with descriptions and styling.
    """
    return {"personas": list_personas()}


@router.get("/languages")
async def get_languages():
    """
    Lists supported spoken languages.
    """
    return {
        "languages": [
            {"code": "auto", "name": "Auto Detect (English / Hindi / Hinglish)"},
            {"code": "en", "name": "English"},
            {"code": "hi", "name": "Hindi (हिन्दी)"},
            {"code": "hinglish", "name": "Hinglish"},
        ]
    }


@router.websocket("/stream")
async def voice_stream_websocket(
    websocket: WebSocket,
    session_id: Optional[str] = Query(None),
    persona: str = Query("nova"),
    language: str = Query("auto"),
    project_id: str = Query("default"),
    conversation_id: Optional[str] = Query(None),
):
    """
    Bidirectional WebSocket endpoint for full-duplex real-time audio interaction.
    """
    await websocket.accept()

    # Retrieve or create session
    session = None
    if session_id:
        session = session_registry.get_session(session_id)

    if not session:
        try:
            persona_enum = VoicePersonaId(persona)
        except ValueError:
            persona_enum = VoicePersonaId.NOVA

        session = await session_registry.create_session(
            persona=persona_enum,
            project_id=project_id,
            conversation_id=conversation_id,
        )

    handler = WebSocketAudioStreamHandler(websocket, session)
    await handler.run()
