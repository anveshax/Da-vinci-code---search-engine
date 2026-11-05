"""
Anvesha Voice Engine 3.0 Configuration.

Manages runtime audio constants, default providers, VAD sensitivity,
latency thresholds, and voice personas.
"""
import os
from typing import List, Dict, Any
from pydantic import BaseModel, Field


class VoiceEngineSettings(BaseModel):
    # Operating Modes
    DEFAULT_MODE: str = Field(default="pipeline", description="'pipeline' (Mode A) or 'realtime' (Mode B)")

    # Audio Transport & Processing
    SAMPLE_RATE: int = 16000  # 16 kHz mono standard for speech models
    AUDIO_CHANNELS: int = 1   # Mono
    FRAME_DURATION_MS: int = 20  # 20ms audio frame
    CHUNK_SIZE_BYTES: int = 640  # 16000 * 2 (16-bit) * 0.02 = 640 bytes per 20ms

    # Voice Activity Detection (VAD)
    VAD_ENERGY_THRESHOLD: float = 0.015  # RMS audio energy threshold
    VAD_SPEECH_START_FRAMES: int = 3     # ~60ms of continuous energy triggers speech start
    VAD_SILENCE_TIMEOUT_MS: int = 800    # 800ms trailing silence completes utterance
    VAD_MAX_UTTERANCE_MS: int = 25000    # 25 seconds maximum single utterance

    # Interruption & Barge-in
    BARGE_IN_ENABLED: bool = True
    BARGE_IN_MIN_ENERGY: float = 0.022   # Threshold to interrupt active TTS
    BARGE_IN_CONSECUTIVE_FRAMES: int = 4 # ~80ms speech to trigger immediate cutoff

    # STT Settings
    DEFAULT_STT_PROVIDER: str = Field(default="groq", description="groq, openai, gemini, or browser")
    GROQ_STT_MODEL: str = "whisper-large-v3-turbo"
    OPENAI_STT_MODEL: str = "whisper-1"
    STT_LANGUAGE: str = "auto"  # auto, en, hi, Hinglish

    # TTS Settings
    DEFAULT_TTS_PROVIDER: str = Field(default="edge", description="edge, openai, or browser")
    OPENAI_TTS_MODEL: str = "tts-1"
    OPENAI_TTS_VOICE: str = "alloy"
    DEFAULT_VOICE_PERSONA: str = "nova"
    TTS_STREAMING_CHUNK_WORDS: int = 8   # Words per chunk for low-latency streaming TTS

    # Session & Security
    SESSION_TIMEOUT_SECONDS: int = 1800  # 30 minutes idle timeout
    MAX_CONCURRENT_SESSIONS: int = 50
    ALLOW_BROWSER_FALLBACK: bool = True
    AUDIO_RETENTION_HOURS: int = 0       # 0 = zero permanent audio file retention

    # Governance & Safety
    REQUIRE_CONFIRMATION_FOR_ACTIONS: bool = True
    MAX_TRANSCRIPT_LENGTH: int = 4000


voice_settings = VoiceEngineSettings()
