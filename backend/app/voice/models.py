"""
Data Models for Anvesha Voice Engine 3.0.
"""
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class VoiceMode(str, Enum):
    PIPELINE = "pipeline"    # Mode A: VAD -> STT -> LLM -> TTS -> Audio
    REALTIME = "realtime"    # Mode B: Multimodal bidirectional audio socket


class VoicePersonaId(str, Enum):
    NOVA = "nova"     # Natural & friendly
    ATLAS = "atlas"   # Professional & confident
    AURA = "aura"     # Calm & warm
    ECHO = "echo"     # Concise & neutral
    CUSTOM = "custom" # User configured


class VoiceLanguage(str, Enum):
    AUTO = "auto"
    EN = "en"
    HI = "hi"
    HINGLISH = "hinglish"


class VoiceSessionCreate(BaseModel):
    mode: VoiceMode = VoiceMode.PIPELINE
    persona: VoicePersonaId = VoicePersonaId.NOVA
    language: VoiceLanguage = VoiceLanguage.AUTO
    project_id: str = "default"
    conversation_id: Optional[str] = None
    stt_provider: Optional[str] = None
    tts_provider: Optional[str] = None


class VoiceSessionResponse(BaseModel):
    session_id: str
    mode: VoiceMode
    persona: VoicePersonaId
    language: VoiceLanguage
    conversation_id: str
    project_id: str
    created_at: float
    active: bool
    stt_provider: str
    tts_provider: str
    supported_voices: List[Dict[str, Any]] = []


class TranscriptSegment(BaseModel):
    text: str
    is_final: bool = False
    confidence: float = 1.0
    language: Optional[str] = None
    duration_ms: Optional[float] = None
    timestamp: float = Field(default_factory=float)


class TranscribeRequest(BaseModel):
    audio_base64: str
    audio_format: str = "pcm16"  # pcm16, wav, webm, mp3
    sample_rate: int = 16000
    language: Optional[str] = None
    session_id: Optional[str] = None


class TranscribeResponse(BaseModel):
    text: str
    language: str
    confidence: float = 1.0
    duration_ms: float = 0.0
    is_final: bool = True


class SynthesizeRequest(BaseModel):
    text: str
    persona: VoicePersonaId = VoicePersonaId.NOVA
    language: Optional[str] = None
    speed: float = 1.0
    pitch: float = 1.0
    volume: float = 1.0
    format: str = "mp3"  # mp3, wav, pcm


class SynthesizeResponse(BaseModel):
    audio_base64: str
    audio_format: str
    duration_ms: float = 0.0
    sample_rate: int = 24000


class VoiceEvent(BaseModel):
    type: str  # session_started, listening, user_speech_start, interim_transcript, final_transcript, thinking, agent_action, assistant_text_chunk, audio_chunk, speaking_started, speaking_completed, interrupted, error
    payload: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None
    timestamp: float = Field(default_factory=float)


class VoiceNavigationCommand(BaseModel):
    action: str  # navigate, toggle_theme, open_settings, search, deep_research
    target: Optional[str] = None
    query: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
