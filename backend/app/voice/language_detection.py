"""
Language & Code-Switching Detection for Anvesha Voice.

Handles multi-lingual voice detection across:
- English (en-US, en-IN)
- Hindi (Devanagari script)
- Hinglish (Romanized Hindi + English code-switching)
"""
import re
from typing import Dict, Any, Tuple

# Common Hinglish marker words written in Roman script
HINGLISH_MARKERS = {
    "kya", "kyu", "kyun", "kaise", "kaha", "kahan", "kab", "kaun",
    "hai", "hain", "hoga", "hogi", "batao", "samjhao", "dhoondo",
    "mujhe", "mera", "meri", "hum", "aap", "tum", "accha", "theek",
    "aur", "lekin", "bhi", "yeh", "woh", "karo", "karna", "chahiye",
    "namaste", "shukriya", "dhanbad", "pata", "kaam", "bolo", "sunao"
}

# Unicode range for Devanagari (Hindi)
DEVANAGARI_RANGE = re.compile(r"[\u0900-\u097F]")


class LanguageDetector:
    """Detects spoken language and Hinglish code-switching."""

    @staticmethod
    def detect_text_language(text: str) -> Tuple[str, float]:
        """
        Detects language from text transcript.
        Returns (language_code, confidence).
        Possible codes: 'hi' (Devanagari Hindi), 'hinglish' (Roman Hindi/English), 'en' (English).
        """
        if not text or not text.strip():
            return "en", 1.0

        clean = text.strip().lower()

        # Check for Devanagari script characters
        devanagari_chars = len(DEVANAGARI_RANGE.findall(clean))
        total_chars = len(clean.replace(" ", ""))

        if total_chars > 0 and (devanagari_chars / total_chars) > 0.25:
            return "hi", 0.95

        # Check for Hinglish vocabulary in Roman text
        words = re.findall(r"\b[a-z]+\b", clean)
        if words:
            hinglish_count = sum(1 for w in words if w in HINGLISH_MARKERS)
            ratio = hinglish_count / len(words)
            if ratio >= 0.15 or hinglish_count >= 2:
                return "hinglish", 0.90

        return "en", 0.95

    @staticmethod
    def get_tts_voice_locale(detected_lang: str) -> str:
        """
        Maps detected language to optimal voice locale.
        """
        if detected_lang == "hi":
            return "hi-IN"
        if detected_lang == "hinglish":
            return "hi-IN"  # Indian neural voice speaks romanized Hinglish with natural Indian cadence
        return "en-US"
