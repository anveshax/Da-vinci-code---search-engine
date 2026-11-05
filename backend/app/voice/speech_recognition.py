"""
Speech Recognition (STT) Providers for Anvesha Voice.

Provides a unified interface across:
1. Groq Whisper (ultra-fast ~250ms inference with whisper-large-v3-turbo)
2. OpenAI Whisper (whisper-1)
3. Gemini Multimodal Audio Transcription (accurate Hindi/English/Hinglish verbatim)
4. Client/Browser Relay fallback
"""
import io
import os
import json
import logging
import asyncio
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import httpx

from app.core.config import settings
from app.core.db import PlatformDB
from app.voice.config import voice_settings
from app.voice.models import TranscribeResponse
from app.voice.audio_processor import AudioProcessor
from app.voice.language_detection import LanguageDetector

logger = logging.getLogger(__name__)


class BaseSTTProvider(ABC):
    """Abstract base class for speech-to-text providers."""

    @abstractmethod
    async def transcribe(
        self,
        audio_bytes: bytes,
        audio_format: str = "wav",
        language: str = "auto"
    ) -> TranscribeResponse:
        """Transcribes raw audio bytes into text."""
        pass

    @property
    @abstractmethod
    def provider_id(self) -> str:
        pass


class GroqWhisperSTTProvider(BaseSTTProvider):
    """Groq ultra-fast Whisper transcription."""

    def __init__(self, api_key: Optional[str] = None, model: str = voice_settings.GROQ_STT_MODEL):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "").strip() or settings.AI_API_KEY
        self.model = model
        self.base_url = "https://api.groq.com/openai/v1/audio/transcriptions"

    @property
    def provider_id(self) -> str:
        return "groq"

    async def transcribe(
        self,
        audio_bytes: bytes,
        audio_format: str = "wav",
        language: str = "auto"
    ) -> TranscribeResponse:
        if not self.api_key:
            raise ValueError("Groq API key not configured for STT.")

        # Ensure WAV container
        if audio_format == "pcm16" or not AudioProcessor.is_wav(audio_bytes):
            wav_bytes = AudioProcessor.pcm16_to_wav(audio_bytes, sample_rate=voice_settings.SAMPLE_RATE)
        else:
            wav_bytes = audio_bytes

        files = {
            "file": ("audio.wav", wav_bytes, "audio/wav")
        }
        data = {
            "model": self.model,
            "response_format": "verbose_json",
            "temperature": "0.0"
        }
        if language and language != "auto":
            data["language"] = language

        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(self.base_url, files=files, data=data, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Groq Whisper STT error ({resp.status_code}): {resp.text}")
                raise RuntimeError(f"Groq Whisper error {resp.status_code}: {resp.text}")

            result = resp.json()
            text = result.get("text", "").strip()
            detected_lang = result.get("language", language)
            duration = float(result.get("duration", 0.0)) * 1000.0

            # Fallback language verification for Hinglish
            lang_code, _ = LanguageDetector.detect_text_language(text)
            final_lang = lang_code if lang_code == "hinglish" else (detected_lang or "en")

            return TranscribeResponse(
                text=text,
                language=final_lang,
                confidence=0.96,
                duration_ms=duration,
                is_final=True
            )


class OpenAIWhisperSTTProvider(BaseSTTProvider):
    """OpenAI standard Whisper transcription."""

    def __init__(self, api_key: Optional[str] = None, model: str = voice_settings.OPENAI_STT_MODEL):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "").strip()
        self.model = model
        self.base_url = "https://api.openai.com/v1/audio/transcriptions"

    @property
    def provider_id(self) -> str:
        return "openai"

    async def transcribe(
        self,
        audio_bytes: bytes,
        audio_format: str = "wav",
        language: str = "auto"
    ) -> TranscribeResponse:
        if not self.api_key:
            raise ValueError("OpenAI API key not configured for STT.")

        wav_bytes = (
            AudioProcessor.pcm16_to_wav(audio_bytes, sample_rate=voice_settings.SAMPLE_RATE)
            if (audio_format == "pcm16" or not AudioProcessor.is_wav(audio_bytes))
            else audio_bytes
        )

        files = {"file": ("audio.wav", wav_bytes, "audio/wav")}
        data = {"model": self.model, "response_format": "verbose_json"}
        if language and language != "auto":
            data["language"] = language

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(self.base_url, files=files, data=data, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI Whisper error {resp.status_code}: {resp.text}")

            result = resp.json()
            text = result.get("text", "").strip()
            detected_lang = result.get("language", "en")
            duration = float(result.get("duration", 0.0)) * 1000.0

            return TranscribeResponse(
                text=text,
                language=detected_lang,
                confidence=0.95,
                duration_ms=duration,
                is_final=True
            )


class GeminiAudioSTTProvider(BaseSTTProvider):
    """Gemini Multimodal Audio Transcription."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "").strip()
        self.model = "gemini-2.5-flash"  # standard multimodal flash

    @property
    def provider_id(self) -> str:
        return "gemini"

    async def transcribe(
        self,
        audio_bytes: bytes,
        audio_format: str = "wav",
        language: str = "auto"
    ) -> TranscribeResponse:
        if not self.api_key:
            raise ValueError("Gemini API key not configured for STT.")

        wav_bytes = (
            AudioProcessor.pcm16_to_wav(audio_bytes, sample_rate=voice_settings.SAMPLE_RATE)
            if (audio_format == "pcm16" or not AudioProcessor.is_wav(audio_bytes))
            else audio_bytes
        )

        b64_audio = AudioProcessor.bytes_to_base64(wav_bytes)

        prompt = (
            "Transcribe this speech verbatim. Do not translate. "
            "If the speaker speaks in Hindi, Hinglish, or English, retain the exact words spoken. "
            "Output only the transcribed text without any other commentary or notes."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "audio/wav",
                                "data": b64_audio
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 300
            }
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini Audio error {resp.status_code}: {resp.text}")

            res = resp.json()
            candidates = res.get("candidates", [])
            text = ""
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()

            detected_lang, _ = LanguageDetector.detect_text_language(text)

            return TranscribeResponse(
                text=text,
                language=detected_lang,
                confidence=0.92,
                duration_ms=0.0,
                is_final=True
            )


class BrowserRelaySTTProvider(BaseSTTProvider):
    """Fallback provider when transcription was done via browser SpeechRecognition."""

    @property
    def provider_id(self) -> str:
        return "browser"

    async def transcribe(
        self,
        audio_bytes: bytes,
        audio_format: str = "wav",
        language: str = "auto"
    ) -> TranscribeResponse:
        # Client-side transcription bypass
        return TranscribeResponse(
            text="",
            language=language or "en",
            confidence=1.0,
            duration_ms=0.0,
            is_final=True
        )
