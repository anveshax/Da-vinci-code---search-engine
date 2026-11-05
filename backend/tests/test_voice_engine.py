"""
Comprehensive Unit & Integration Test Suite for Anvesha Voice Engine 3.0.
"""
import unittest
import asyncio
import io
import wave
import struct
import json
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.voice.config import voice_settings
from app.voice.models import VoiceMode, VoicePersonaId, VoiceLanguage
from app.voice.audio_processor import AudioProcessor
from app.voice.voice_activity import VoiceActivityDetector
from app.voice.language_detection import LanguageDetector
from app.voice.voice_personas import get_persona, list_personas
from app.voice.interruption_manager import InterruptionManager
from app.voice.conversation_context import VoiceConversationContext
from app.voice.voice_session import session_registry, VoiceSession
from app.voice.speech_synthesis import clean_text_for_speech, split_sentences_for_streaming
from app.voice.voice_orchestrator import VoiceOrchestrator
from app.voice.provider_registry import voice_registry


class TestAudioProcessor(unittest.TestCase):
    def test_calculate_rms_silence(self):
        silence = bytes(640)
        rms = AudioProcessor.calculate_rms(silence)
        self.assertEqual(rms, 0.0)

    def test_calculate_rms_tone(self):
        # Generate 16-bit sine wave chunk
        samples = [int(16000 * 0.5) for _ in range(320)]
        pcm = struct.pack(f"<{len(samples)}h", *samples)
        rms = AudioProcessor.calculate_rms(pcm)
        self.assertGreater(rms, 0.1)

    def test_pcm16_to_wav_and_extract(self):
        pcm = b"\x00\x01" * 160
        wav = AudioProcessor.pcm16_to_wav(pcm, sample_rate=16000, channels=1)
        self.assertTrue(AudioProcessor.is_wav(wav))

        extracted_pcm, rate, channels = AudioProcessor.extract_pcm_from_wav(wav)
        self.assertEqual(rate, 16000)
        self.assertEqual(channels, 1)
        self.assertEqual(len(extracted_pcm), len(pcm))

    def test_base64_roundtrip(self):
        data = b"anvesha-voice-audio-data"
        b64 = AudioProcessor.bytes_to_base64(data, mime_type="audio/wav")
        self.assertTrue(b64.startswith("data:audio/wav;base64,"))
        decoded = AudioProcessor.base64_to_bytes(b64)
        self.assertEqual(decoded, data)


class TestVoiceActivityDetector(unittest.TestCase):
    def setUp(self):
        self.vad = VoiceActivityDetector(
            energy_threshold=0.015,
            silence_timeout_ms=100,  # fast for test
            min_speech_frames=2,
            sample_rate=16000,
        )

    def test_speech_onset_and_trailing_silence(self):
        silence_frame = bytes(640)
        tone_samples = [int(15000) for _ in range(320)]
        speech_frame = struct.pack("<320h", *tone_samples)

        # 1. Feed silence -> not speaking
        is_sp, completed, barge = self.vad.process_frame(silence_frame)
        self.assertFalse(is_sp)
        self.assertIsNone(completed)

        # 2. Feed 2 speech frames -> speech onset
        self.vad.process_frame(speech_frame)
        is_sp, completed, barge = self.vad.process_frame(speech_frame)
        self.assertTrue(is_sp)
        self.assertIsNone(completed)

        # 3. Simulate trailing silence timeout
        self.vad.silence_start_time = 0.0  # Force timeout
        is_sp, completed, barge = self.vad.process_frame(silence_frame)
        self.assertFalse(is_sp)
        self.assertIsNotNone(completed)
        self.assertGreater(len(completed), 0)


class TestLanguageDetection(unittest.TestCase):
    def test_detect_english(self):
        lang, conf = LanguageDetector.detect_text_language("What are the key differences between React and Svelte?")
        self.assertEqual(lang, "en")

    def test_detect_devanagari_hindi(self):
        lang, conf = LanguageDetector.detect_text_language("नमस्ते, आज मौसम कैसा है?")
        self.assertEqual(lang, "hi")

    def test_detect_hinglish(self):
        lang, conf = LanguageDetector.detect_text_language("Yeh code explain karo aur mujhe batao error kya hai")
        self.assertEqual(lang, "hinglish")


class TestSpeechSynthesisUtils(unittest.TestCase):
    def test_clean_text_for_speech(self):
        raw = "Here is the result: [Anvesha Engine](https://example.com) with `code` and **bold** [1]."
        clean = clean_text_for_speech(raw)
        self.assertNotIn("https://", clean)
        self.assertNotIn("`", clean)
        self.assertNotIn("[1]", clean)
        self.assertIn("Anvesha Engine", clean)

    def test_split_sentences_for_streaming(self):
        text = "First sentence here. Second sentence starts now! What is third? Yes."
        sentences = split_sentences_for_streaming(text)
        self.assertGreater(len(sentences), 1)
        self.assertTrue(any("First sentence" in s for s in sentences))


class TestInterruptionManager(unittest.IsolatedAsyncioTestCase):
    async def test_interrupt_cancels_tasks(self):
        mgr = InterruptionManager("sess_test_123")

        async def dummy_coro():
            await asyncio.sleep(5)

        task1 = asyncio.create_task(dummy_coro())
        mgr.register_generation_task(task1)
        self.assertFalse(mgr.is_interrupted())

        was_active = await mgr.interrupt()
        await asyncio.sleep(0.01)
        self.assertTrue(was_active)
        self.assertTrue(mgr.is_interrupted())
        self.assertTrue(task1.cancelled() or task1.done())


class TestConversationContext(unittest.TestCase):
    def test_resolve_ordinal_source(self):
        ctx = VoiceConversationContext("test_conv_ordinal", project_id="test")
        ctx.turns.append({
            "role": "assistant",
            "content": "Here is the quantum computing overview.",
            "sources": [
                {"title": "IBM Quantum Research", "url": "https://ibm.com/quantum", "snippet": "IBM quantum specs"},
                {"title": "Google Sycamore Architecture", "url": "https://nature.com/articles/123", "snippet": "Quantum supremacy"},
                {"title": "MIT Technology Review", "url": "https://technologyreview.com", "snippet": "Future of qubits"},
            ],
            "citations": [],
        })

        # Test ordinal query
        res = ctx.resolve_source_reference("Tell me more about the second source")
        self.assertIsNotNone(res)
        self.assertEqual(res["title"], "Google Sycamore Architecture")

        # Test Hindi ordinal query
        res_hi = ctx.resolve_source_reference("Teesra source kya bolta hai")
        self.assertIsNotNone(res_hi)
        self.assertEqual(res_hi["title"], "MIT Technology Review")


class TestVoiceSessionLifecycle(unittest.IsolatedAsyncioTestCase):
    async def test_session_creation_and_expiration(self):
        sess = await session_registry.create_session(
            persona=VoicePersonaId.ATLAS,
            language=VoiceLanguage.EN,
        )
        self.assertIsNotNone(sess.session_id)
        self.assertEqual(sess.persona, VoicePersonaId.ATLAS)

        retrieved = session_registry.get_session(sess.session_id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.session_id, sess.session_id)

        # Force expiration
        sess.last_activity = 0.0
        self.assertTrue(sess.is_expired())

        # Cleanup
        closed = await session_registry.close_session(sess.session_id)
        self.assertTrue(closed)


class TestVoiceNavigationCommands(unittest.TestCase):
    def test_detect_navigation(self):
        cmd = VoiceOrchestrator.detect_navigation_command("Please go to web intelligence right now")
        self.assertIsNotNone(cmd)
        action, target, ack = cmd
        self.assertEqual(action, "navigate")
        self.assertEqual(target, "web_intelligence")

        theme_cmd = VoiceOrchestrator.detect_navigation_command("switch to dark mode please")
        self.assertIsNotNone(theme_cmd)
        action, target, ack = theme_cmd
        self.assertEqual(action, "theme")
        self.assertEqual(target, "dark")


class TestVoiceAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_providers_endpoint(self):
        res = self.client.get("/api/v2/voice/providers")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("active_stt", data)
        self.assertIn("active_tts", data)
        self.assertIn("personas", data)

    def test_voices_endpoint(self):
        res = self.client.get("/api/v2/voice/voices")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("personas", data)
        ids = [p["id"] for p in data["personas"]]
        self.assertIn("nova", ids)
        self.assertIn("atlas", ids)
        self.assertIn("aura", ids)
        self.assertIn("echo", ids)

    def test_languages_endpoint(self):
        res = self.client.get("/api/v2/voice/languages")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("languages", data)

    def test_session_rest_lifecycle(self):
        # 1. Create session
        create_res = self.client.post("/api/v2/voice/sessions", json={
            "persona": "aura",
            "language": "auto",
        })
        self.assertEqual(create_res.status_code, 200)
        sess = create_res.json()
        sess_id = sess["session_id"]
        self.assertTrue(sess_id.startswith("voice_sess_"))

        # 2. Get session
        get_res = self.client.get(f"/api/v2/voice/sessions/{sess_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["session_id"], sess_id)

        # 3. Interrupt session
        int_res = self.client.post(f"/api/v2/voice/sessions/{sess_id}/interrupt")
        self.assertEqual(int_res.status_code, 200)
        self.assertEqual(int_res.json()["status"], "interrupted")

        # 4. Delete session
        del_res = self.client.delete(f"/api/v2/voice/sessions/{sess_id}")
        self.assertEqual(del_res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
