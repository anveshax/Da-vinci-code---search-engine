"""
Voice Activity Detection (VAD) & End-of-Utterance Detector.

Analyzes continuous audio frame streams in real-time to detect:
1. Speech start (onset) within 100-150 ms.
2. Trailing silence (offset / end of utterance).
3. Barge-in interruption while assistant audio is actively rendering.
"""
import time
from typing import Optional, List, Tuple
from app.voice.config import voice_settings
from app.voice.audio_processor import AudioProcessor


class VoiceActivityDetector:
    """
    Stateful real-time VAD engine processing 20ms audio frames.
    """

    def __init__(
        self,
        energy_threshold: float = voice_settings.VAD_ENERGY_THRESHOLD,
        silence_timeout_ms: int = voice_settings.VAD_SILENCE_TIMEOUT_MS,
        min_speech_frames: int = voice_settings.VAD_SPEECH_START_FRAMES,
        sample_rate: int = voice_settings.SAMPLE_RATE,
    ):
        self.energy_threshold = energy_threshold
        self.silence_timeout_ms = silence_timeout_ms
        self.min_speech_frames = min_speech_frames
        self.sample_rate = sample_rate

        # Runtime states
        self.is_speaking = False
        self.consecutive_speech_frames = 0
        self.silence_start_time: Optional[float] = None
        self.utterance_start_time: Optional[float] = None
        self.pre_buffer: List[bytes] = []  # Keep ~200ms pre-speech frames to avoid clipping first consonant
        self.active_utterance_frames: List[bytes] = []

    def reset(self) -> None:
        """Resets detector state and clears audio buffers."""
        self.is_speaking = False
        self.consecutive_speech_frames = 0
        self.silence_start_time = None
        self.utterance_start_time = None
        self.pre_buffer.clear()
        self.active_utterance_frames.clear()

    def process_frame(
        self, frame_bytes: bytes, is_assistant_speaking: bool = False
    ) -> Tuple[bool, Optional[bytes], bool]:
        """
        Processes a single audio frame (typically 20ms / 640 bytes PCM16).

        Returns:
            (is_speaking, completed_utterance_pcm, is_barge_in)
        """
        energy = AudioProcessor.calculate_rms(frame_bytes)
        now = time.time()

        # Adapt threshold if assistant is speaking to prevent acoustic leakage
        active_threshold = (
            voice_settings.BARGE_IN_MIN_ENERGY if is_assistant_speaking else self.energy_threshold
        )
        is_speech_frame = energy >= active_threshold

        # Maintain rolling pre-buffer (~10 frames = 200ms)
        self.pre_buffer.append(frame_bytes)
        if len(self.pre_buffer) > 10:
            self.pre_buffer.pop(0)

        # Barge-in flag
        is_barge_in = False

        if is_speech_frame:
            self.consecutive_speech_frames += 1
            self.silence_start_time = None

            # Check if threshold crossed to start speech
            if not self.is_speaking and self.consecutive_speech_frames >= self.min_speech_frames:
                self.is_speaking = True
                self.utterance_start_time = now
                # Include pre-buffer frames so first phoneme isn't clipped
                self.active_utterance_frames = list(self.pre_buffer)
                if is_assistant_speaking and voice_settings.BARGE_IN_ENABLED:
                    is_barge_in = True

            if self.is_speaking:
                self.active_utterance_frames.append(frame_bytes)
                if is_assistant_speaking and self.consecutive_speech_frames >= voice_settings.BARGE_IN_CONSECUTIVE_FRAMES:
                    is_barge_in = True
        else:
            self.consecutive_speech_frames = 0

            if self.is_speaking:
                self.active_utterance_frames.append(frame_bytes)

                if self.silence_start_time is None:
                    self.silence_start_time = now
                elif (now - self.silence_start_time) * 1000 >= self.silence_timeout_ms:
                    # Utterance complete!
                    completed_audio = b"".join(self.active_utterance_frames)
                    self.reset()
                    return False, completed_audio, False

        # Max utterance safety guard (~25 seconds)
        if self.is_speaking and self.utterance_start_time and (now - self.utterance_start_time) * 1000 >= voice_settings.VAD_MAX_UTTERANCE_MS:
            completed_audio = b"".join(self.active_utterance_frames)
            self.reset()
            return False, completed_audio, False

        return self.is_speaking, None, is_barge_in
