"""
Voice Provider Registry for Anvesha Voice Engine 3.0.

Discovers and instantiates active STT and TTS providers,
evaluates health status, and maintains provider fallbacks.
"""
import os
import logging
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.voice.config import voice_settings
from app.voice.speech_recognition import (
    BaseSTTProvider,
    GroqWhisperSTTProvider,
    OpenAIWhisperSTTProvider,
    GeminiAudioSTTProvider,
    BrowserRelaySTTProvider,
)
from app.voice.speech_synthesis import (
    BaseTTSProvider,
    EdgeTTSProvider,
    OpenAITTSProvider,
    BrowserFallbackTTSProvider,
)
from app.voice.voice_personas import list_personas

logger = logging.getLogger(__name__)


class VoiceProviderRegistry:
    """Singleton managing voice provider instances and selection."""

    _instance: Optional["VoiceProviderRegistry"] = None

    def __init__(self):
        self._stt_providers: Dict[str, BaseSTTProvider] = {}
        self._tts_providers: Dict[str, BaseTTSProvider] = {}
        self._initialize_providers()

    @classmethod
    def get_instance(cls) -> "VoiceProviderRegistry":
        if cls._instance is None:
            cls._instance = VoiceProviderRegistry()
        return cls._instance

    def _initialize_providers(self) -> None:
        """Initializes default available STT and TTS providers."""
        groq_key = os.getenv("GROQ_API_KEY", "").strip() or settings.AI_API_KEY
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

        # Register STT providers
        if groq_key:
            self._stt_providers["groq"] = GroqWhisperSTTProvider(api_key=groq_key)
        if openai_key:
            self._stt_providers["openai"] = OpenAIWhisperSTTProvider(api_key=openai_key)
        if gemini_key:
            self._stt_providers["gemini"] = GeminiAudioSTTProvider(api_key=gemini_key)
        self._stt_providers["browser"] = BrowserRelaySTTProvider()

        # Register TTS providers
        # Edge TTS is always available out of the box via Microsoft speech websocket
        self._tts_providers["edge"] = EdgeTTSProvider()
        if openai_key:
            self._tts_providers["openai"] = OpenAITTSProvider(api_key=openai_key)
        self._tts_providers["browser"] = BrowserFallbackTTSProvider()

    def get_stt_provider(self, preferred_id: Optional[str] = None) -> BaseSTTProvider:
        """Selects STT provider by preferred ID or optimal fallback."""
        if preferred_id and preferred_id in self._stt_providers:
            return self._stt_providers[preferred_id]

        # Preference hierarchy: Groq (ultra fast) -> Gemini -> OpenAI -> Browser
        for pid in ["groq", "gemini", "openai", "browser"]:
            if pid in self._stt_providers:
                return self._stt_providers[pid]

        return BrowserRelaySTTProvider()

    def get_tts_provider(self, preferred_id: Optional[str] = None) -> BaseTTSProvider:
        """Selects TTS provider by preferred ID or optimal fallback."""
        if preferred_id and preferred_id in self._tts_providers:
            return self._tts_providers[preferred_id]

        # Preference hierarchy: Edge (neural, zero-cost, multi-lingual) -> OpenAI -> Browser
        for pid in ["edge", "openai", "browser"]:
            if pid in self._tts_providers:
                return self._tts_providers[pid]

        return BrowserFallbackTTSProvider()

    def get_provider_status(self) -> Dict[str, Any]:
        """Returns non-sensitive health & availability status of voice providers."""
        return {
            "active_stt": self.get_stt_provider().provider_id,
            "active_tts": self.get_tts_provider().provider_id,
            "available_stt": list(self._stt_providers.keys()),
            "available_tts": list(self._tts_providers.keys()),
            "personas": list_personas(),
            "supported_languages": [
                {"code": "auto", "name": "Auto Detect (English / Hindi / Hinglish)"},
                {"code": "en", "name": "English"},
                {"code": "hi", "name": "Hindi (हिन्दी)"},
                {"code": "hinglish", "name": "Hinglish"},
            ],
        }


voice_registry = VoiceProviderRegistry.get_instance()
