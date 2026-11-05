"""
Speech Synthesis (TTS) Providers for Anvesha Voice.

Provides low-latency, sentence-chunked streaming speech synthesis across:
1. Microsoft Edge Neural TTS (pure async WebSocket - zero extra dependencies)
2. OpenAI-compatible TTS (tts-1, tts-1-hd, Kokoro)
3. Browser Web Speech fallback

Includes sentence chunking for immediate first-audio-chunk playback.
"""
import io
import os
import re
import uuid
import json
import logging
import asyncio
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any, AsyncGenerator
import httpx
import websockets

from app.voice.config import voice_settings
from app.voice.models import SynthesizeResponse, VoicePersonaId
from app.voice.voice_personas import get_persona
from app.voice.audio_processor import AudioProcessor
from app.voice.language_detection import LanguageDetector

logger = logging.getLogger(__name__)


def clean_text_for_speech(text: str) -> str:
    """
    Strips markdown formatting, URLs, code blocks, and math symbols
    so speech synthesizers pronounce sentences naturally.
    """
    if not text:
        return ""

    # Remove code blocks ```...```
    cleaned = re.sub(r"```[\s\S]*?```", " Code snippet omitted. ", text)
    # Remove inline code `...`
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    # Remove markdown links [title](url) -> title
    cleaned = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", cleaned)
    # Remove bare URLs
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    # Remove markdown headers and bullets (#, *, -, >)
    cleaned = re.sub(r"^[#*->\s]+", "", cleaned, flags=re.MULTILINE)
    # Remove citation brackets like [1], [2], [3]
    cleaned = re.sub(r"\[\d+\]", "", cleaned)
    # Remove bold/italic markers
    cleaned = re.sub(r"[*_~]+", "", cleaned)
    # Clean redundant whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def split_sentences_for_streaming(text: str) -> List[str]:
    """
    Breaks a response into sentence-level chunks so synthesis begins immediately
    on the first sentence rather than waiting for the entire document.
    """
    clean = clean_text_for_speech(text)
    if not clean:
        return []

    # Regex splits by sentence boundary punctuation (. ! ? \n) followed by space or end
    raw_chunks = re.split(r"(?<=[.!?\n])\s+", clean)
    chunks = []
    current_acc = ""

    for chunk in raw_chunks:
        trimmed = chunk.strip()
        if not trimmed:
            continue
        # If chunk is very short (e.g. "Yes.", "Indeed."), merge with next to avoid micro-chunks
        if len(current_acc.split()) < 4 and len(current_acc) > 0:
            current_acc += " " + trimmed
        else:
            if current_acc:
                chunks.append(current_acc)
            current_acc = trimmed

    if current_acc:
        chunks.append(current_acc)

    return chunks if chunks else [clean]


class BaseTTSProvider(ABC):
    """Abstract base class for text-to-speech providers."""

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        persona_id: str = "nova",
        language: Optional[str] = None,
        speed: float = 1.0,
        pitch: float = 1.0,
    ) -> SynthesizeResponse:
        """Synthesizes text into audio."""
        pass

    @property
    @abstractmethod
    def provider_id(self) -> str:
        pass


class EdgeTTSProvider(BaseTTSProvider):
    """
    High-quality Microsoft Edge Neural TTS implemented via lightweight WebSocket protocol.
    Zero external heavy pip dependencies!
    Supports natural Hindi, Indian English, and US English neural voices.
    """

    TRUSTED_CLIENT_TOKEN = "6A5AA1D4EA654D9B83E15AB501ED872F"
    WSS_URL = (
        f"wss://speech.platform.bing.com/consumer/speech/synthesize/readahead/edge/v1"
        f"?TrustedClientToken={TRUSTED_CLIENT_TOKEN}"
    )

    @property
    def provider_id(self) -> str:
        return "edge"

    async def synthesize(
        self,
        text: str,
        persona_id: str = "nova",
        language: Optional[str] = None,
        speed: float = 1.0,
        pitch: float = 1.0,
    ) -> SynthesizeResponse:
        clean = clean_text_for_speech(text)
        if not clean:
            return SynthesizeResponse(audio_base64="", audio_format="mp3", duration_ms=0.0)

        persona = get_persona(persona_id)
        # Determine language & appropriate voice
        detected_lang, _ = LanguageDetector.detect_text_language(clean)
        lang_key = language if language in ["en", "hi", "hinglish"] else detected_lang
        voice_map = persona.get("edge_voices", {})
        voice_name = voice_map.get(lang_key, voice_map.get("en", "en-US-JennyNeural"))

        # Convert speed & pitch to SSML strings
        rate_pct = int((speed - 1.0) * 100)
        rate_str = f"{rate_pct:+d}%"

        # SSML Payload
        req_id = uuid.uuid4().hex
        ssml = (
            f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
            f"<voice name='{voice_name}'>"
            f"<prosody rate='{rate_str}' pitch='+0Hz'>"
            f"{clean}"
            f"</prosody></voice></speak>"
        )

        headers = {
            "Pragma": "no-cache",
            "Cache-Control": "no-cache",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
            ),
            "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        }

        audio_parts = []
        try:
            async with websockets.connect(
                self.WSS_URL,
                additional_headers=headers,
                max_size=10 * 1024 * 1024,
                close_timeout=5,
            ) as ws:
                # 1. Send speech.config
                config_msg = (
                    f"X-Timestamp:None\r\n"
                    f"Content-Type:application/json; charset=utf-8\r\n"
                    f"Path:speech.config\r\n\r\n"
                    f'{{"context":{{"synthesis":{{"audio":{{"metadataoptions":{{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"}},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}}}}}'
                )
                await ws.send(config_msg)

                # 2. Send SSML request
                ssml_msg = (
                    f"X-RequestId:{req_id}\r\n"
                    f"Content-Type:application/ssml+xml\r\n"
                    f"Path:ssml\r\n\r\n"
                    f"{ssml}"
                )
                await ws.send(ssml_msg)

                # 3. Read incoming audio frames until turn.end
                while True:
                    msg = await ws.recv()
                    if isinstance(msg, bytes):
                        # Audio chunk format: 2-byte header length, followed by header, followed by audio data
                        if len(msg) >= 2:
                            header_len = int.from_bytes(msg[:2], "big")
                            audio_data = msg[2 + header_len:]
                            audio_parts.append(audio_data)
                    elif isinstance(msg, str):
                        if "Path:turn.end" in msg:
                            break

        except Exception as e:
            logger.warning(f"Edge TTS connection error: {e}. Falling back to empty response.")
            return SynthesizeResponse(audio_base64="", audio_format="mp3", duration_ms=0.0)

        full_audio = b"".join(audio_parts)
        b64_audio = AudioProcessor.bytes_to_base64(full_audio)
        approx_duration = (len(clean.split()) / 2.5) * 1000.0

        return SynthesizeResponse(
            audio_base64=b64_audio,
            audio_format="mp3",
            duration_ms=approx_duration,
            sample_rate=24000,
        )


class OpenAITTSProvider(BaseTTSProvider):
    """OpenAI-compatible text-to-speech provider."""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "").strip()
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/") + "/audio/speech"

    @property
    def provider_id(self) -> str:
        return "openai"

    async def synthesize(
        self,
        text: str,
        persona_id: str = "nova",
        language: Optional[str] = None,
        speed: float = 1.0,
        pitch: float = 1.0,
    ) -> SynthesizeResponse:
        clean = clean_text_for_speech(text)
        if not clean:
            return SynthesizeResponse(audio_base64="", audio_format="mp3", duration_ms=0.0)

        if not self.api_key:
            raise ValueError("OpenAI API key not configured for TTS.")

        persona = get_persona(persona_id)
        voice = persona.get("openai_voice", "nova")

        payload = {
            "model": voice_settings.OPENAI_TTS_MODEL,
            "input": clean,
            "voice": voice,
            "speed": max(0.5, min(2.0, speed)),
            "response_format": "mp3",
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(self.base_url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI TTS error {resp.status_code}: {resp.text}")

            audio_bytes = resp.content
            b64_audio = AudioProcessor.bytes_to_base64(audio_bytes)
            approx_duration = (len(clean.split()) / 2.5) * 1000.0

            return SynthesizeResponse(
                audio_base64=b64_audio,
                audio_format="mp3",
                duration_ms=approx_duration,
                sample_rate=24000,
            )


class BrowserFallbackTTSProvider(BaseTTSProvider):
    """Fallback signaling client to speak using Web Speech API."""

    @property
    def provider_id(self) -> str:
        return "browser"

    async def synthesize(
        self,
        text: str,
        persona_id: str = "nova",
        language: Optional[str] = None,
        speed: float = 1.0,
        pitch: float = 1.0,
    ) -> SynthesizeResponse:
        return SynthesizeResponse(audio_base64="", audio_format="browser", duration_ms=0.0)
