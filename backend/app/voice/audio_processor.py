"""
Audio Processing & Conversion Utilities for Anvesha Voice.

Handles PCM16 byte manipulation, WAV container synthesis,
energy/RMS calculation, and audio validation.
"""
import math
import struct
import io
import wave
import base64
from typing import Tuple, Optional


class AudioProcessor:
    """Fast, lightweight audio processor with zero heavy external dependencies."""

    @staticmethod
    def calculate_rms(pcm_bytes: bytes) -> float:
        """
        Calculates Root-Mean-Square (RMS) amplitude of 16-bit signed PCM mono audio.
        Returns normalized float in range [0.0, 1.0].
        """
        if not pcm_bytes or len(pcm_bytes) < 2:
            return 0.0

        # Number of 16-bit samples
        num_samples = len(pcm_bytes) // 2
        if num_samples == 0:
            return 0.0

        # Unpack signed 16-bit little-endian integers
        fmt = f"<{num_samples}h"
        try:
            samples = struct.unpack(fmt, pcm_bytes[: num_samples * 2])
        except struct.error:
            return 0.0

        sum_squares = sum(s * s for s in samples)
        mean_square = sum_squares / num_samples
        rms = math.sqrt(mean_square)

        # Normalize relative to max int16 value (32767)
        return min(1.0, rms / 32767.0)

    @staticmethod
    def pcm16_to_wav(pcm_bytes: bytes, sample_rate: int = 16000, channels: int = 1) -> bytes:
        """
        Wraps raw PCM16 mono bytes into a valid RIFF/WAV container.
        """
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(2)  # 16-bit = 2 bytes
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_bytes)
        return buffer.getvalue()

    @staticmethod
    def extract_pcm_from_wav(wav_bytes: bytes) -> Tuple[bytes, int, int]:
        """
        Extracts raw PCM bytes and returns (pcm_data, sample_rate, channels).
        """
        try:
            buffer = io.BytesIO(wav_bytes)
            with wave.open(buffer, "rb") as wav_file:
                sample_rate = wav_file.getframerate()
                channels = wav_file.getnchannels()
                frames = wav_file.readframes(wav_file.getnframes())
                return frames, sample_rate, channels
        except Exception:
            return wav_bytes, 16000, 1

    @staticmethod
    def base64_to_bytes(b64_string: str) -> bytes:
        """Decodes base64 string safely."""
        # Strip data URL prefix if present (e.g. data:audio/wav;base64,...)
        if "," in b64_string:
            b64_string = b64_string.split(",", 1)[1]
        return base64.b64decode(b64_string)

    @staticmethod
    def bytes_to_base64(data: bytes, mime_type: Optional[str] = None) -> str:
        """Encodes bytes to base64 string with optional data URI prefix."""
        b64 = base64.b64encode(data).decode("ascii")
        if mime_type:
            return f"data:{mime_type};base64,{b64}"
        return b64

    @staticmethod
    def is_wav(data: bytes) -> bool:
        """Checks if data begins with RIFF WAV header."""
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"

    @staticmethod
    def is_webm(data: bytes) -> bool:
        """Checks if data has EBML WebM header (0x1A 0x45 0xDF 0xA3)."""
        return len(data) >= 4 and data[:4] == b"\x1a\x45\xdf\xa3"
