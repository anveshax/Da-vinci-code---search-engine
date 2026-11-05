"""
Voice Personas for Anvesha Voice Engine 3.0.

Profiles define spoken cadence, personality directives,
and provider-specific voice names for Edge TTS and OpenAI TTS.
"""
from typing import Dict, Any, List
from app.voice.models import VoicePersonaId


VOICE_PERSONAS: Dict[str, Dict[str, Any]] = {
    VoicePersonaId.NOVA.value: {
        "id": "nova",
        "name": "Nova",
        "title": "Natural & Friendly",
        "description": "Warm, engaging, and conversational tone ideal for everyday exploration and general Q&A.",
        "gender": "female",
        "edge_voices": {
            "en": "en-US-JennyNeural",
            "hi": "hi-IN-SwaraNeural",
            "hinglish": "en-IN-NeerjaNeural",
        },
        "openai_voice": "nova",
        "speed": 1.05,
        "pitch": "+0Hz",
        "prompt_directive": "You are Nova, the friendly and engaging voice companion of Anvesha. Respond warmly and naturally, keeping spoken answers conversational, clear, and direct without verbose lists or markdown clutter.",
    },
    VoicePersonaId.ATLAS.value: {
        "id": "atlas",
        "name": "Atlas",
        "title": "Professional & Confident",
        "description": "Crisp, authoritative, and structured tone best suited for deep research, code analysis, and architecture.",
        "gender": "male",
        "edge_voices": {
            "en": "en-US-GuyNeural",
            "hi": "hi-IN-MadhurNeural",
            "hinglish": "en-IN-PrabhatNeural",
        },
        "openai_voice": "onyx",
        "speed": 1.0,
        "pitch": "-2Hz",
        "prompt_directive": "You are Atlas, the professional and analytical voice of Anvesha. Deliver crisp, structured, authoritative spoken explanations with clear reasoning and precision.",
    },
    VoicePersonaId.AURA.value: {
        "id": "aura",
        "name": "Aura",
        "title": "Calm & Warm",
        "description": "Gentle, patient, and soothing pacing perfect for learning, explanations, and thoughtful reflection.",
        "gender": "female",
        "edge_voices": {
            "en": "en-US-AriaNeural",
            "hi": "hi-IN-SwaraNeural",
            "hinglish": "en-IN-NeerjaExpressiveNeural",
        },
        "openai_voice": "shimmer",
        "speed": 0.95,
        "pitch": "+1Hz",
        "prompt_directive": "You are Aura, the calm and thoughtful voice of Anvesha. Speak gently, with comforting clarity and patience, breaking complex ideas down with effortless simplicity.",
    },
    VoicePersonaId.ECHO.value: {
        "id": "echo",
        "name": "Echo",
        "title": "Concise & Neutral",
        "description": "Rapid, minimalist, and direct tone delivering essential facts and quick status with zero filler.",
        "gender": "male",
        "edge_voices": {
            "en": "en-US-ChristopherNeural",
            "hi": "hi-IN-MadhurNeural",
            "hinglish": "en-IN-PrabhatNeural",
        },
        "openai_voice": "echo",
        "speed": 1.15,
        "pitch": "+0Hz",
        "prompt_directive": "You are Echo, the ultra-concise voice of Anvesha. Provide rapid, high-density, factual answers. Prioritize brevity and directness with minimal conversational filler.",
    },
    VoicePersonaId.CUSTOM.value: {
        "id": "custom",
        "name": "Custom",
        "title": "Configurable",
        "description": "User-tuned voice with custom rate, pitch, and chosen provider voice ID.",
        "gender": "neutral",
        "edge_voices": {
            "en": "en-US-EricNeural",
            "hi": "hi-IN-MadhurNeural",
            "hinglish": "en-IN-NeerjaNeural",
        },
        "openai_voice": "alloy",
        "speed": 1.0,
        "pitch": "+0Hz",
        "prompt_directive": "You are Anvesha Voice, a balanced and adaptive AI assistant. Answer queries clearly, conversationally, and accurately.",
    },
}


def get_persona(persona_id: str) -> Dict[str, Any]:
    """Retrieves persona definition with safe fallback to Nova."""
    return VOICE_PERSONAS.get(persona_id, VOICE_PERSONAS["nova"])


def list_personas() -> List[Dict[str, Any]]:
    """Returns list of all available voice personas."""
    return list(VOICE_PERSONAS.values())
