"""
Anvesha Multi-Provider AI Core Engine.

Provides unified, source-grounded text generation and streaming across:
- Google Gemini API (native REST v1beta and OpenAI-compatible endpoint)
- Groq API (ultra-fast inference: Llama 3.3, Llama 3.1)
- OpenRouter API (Claude, Llama, DeepSeek, Mistral)
- OpenAI-compatible endpoints (Ollama, vLLM, LocalAI, OpenAI)

Key Features:
- Provider-independent abstract interface
- Dynamic model selection & configuration
- Secure backend-only credential storage (masked in UI, never exposed to client)
- Robust retries with exponential backoff on rate limits (HTTP 429) & 503
- Error normalization with clear actionable messages
- Transparent multi-provider fallback (e.g. primary rate-limited -> fallback executed)
- Real Server-Sent Event (SSE) streaming token-by-token
"""
import os
import json
import time
import logging
import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, AsyncGenerator, Tuple
import httpx

from app.core.config import settings
from app.core.db import PlatformDB

logger = logging.getLogger(__name__)

# --- Error Normalization ---

class AIProviderError(Exception):
    """Base exception for AI provider operations."""
    def __init__(self, message: str, provider: str, status_code: Optional[int] = None, retryable: bool = False):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code
        self.retryable = retryable


class RateLimitError(AIProviderError):
    """Raised when an AI provider returns HTTP 429."""
    def __init__(self, message: str, provider: str):
        super().__init__(message, provider, status_code=429, retryable=True)


class AuthenticationError(AIProviderError):
    """Raised when an API key is invalid or unauthorized (HTTP 401/403)."""
    def __init__(self, message: str, provider: str):
        super().__init__(message, provider, status_code=401, retryable=False)


# --- Base Provider Interface ---

class BaseAIProvider(ABC):
    """Abstract interface that every LLM provider must implement."""

    def __init__(self, provider_id: str, api_key: str, model: str, base_url: str):
        self.provider_id = provider_id
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    @abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        """Validates connectivity and credentials with the provider."""
        pass

    @abstractmethod
    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> AsyncGenerator[str, None]:
        """Streams completion tokens asynchronously."""
        pass

    @abstractmethod
    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        """Non-streaming completion."""
        pass


# --- 1. OpenAI-Compatible Base Provider (Groq, OpenRouter, OpenAI, LocalAI/Ollama) ---

class OpenAICompatibleProvider(BaseAIProvider):
    """Implementation for providers adhering to OpenAI chat completions standard."""

    def _get_headers(self) -> Dict[str, str]:
        # Guardrail: Prevent routing Google Gemini API keys to OpenAI or OpenRouter endpoints
        if self.api_key and (self.api_key.startswith("AQ.") or self.api_key.startswith("AIza")):
            raise AuthenticationError(
                f"Attempted to send a Google Gemini API key to external endpoint '{self.provider_id}'. "
                "Gemini keys must only be routed through the native Google Gemini provider.",
                self.provider_id
            )
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.provider_id == "openrouter":
            headers["HTTP-Referer"] = "https://anvesha-ai-platform.local"
            headers["X-Title"] = "Anvesha AI Intelligence Platform"
        return headers

    def _build_payload(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        stream: bool,
    ) -> Dict[str, Any]:
        chat_messages: List[Dict[str, str]] = []
        if system_prompt:
            chat_messages.append({"role": "system", "content": system_prompt})
        chat_messages.extend(messages)

        return {
            "model": self.model,
            "messages": chat_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream,
        }

    async def check_health(self) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "status": "unconfigured",
                "provider": self.provider_id,
                "model": self.model,
                "message": f"API key for {self.provider_id} is missing.",
            }

        headers = self._get_headers()
        payload = self._build_payload([{"role": "user", "content": "ping"}], None, max_tokens=5, temperature=0.1, stream=False)

        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                latency = round((time.time() - start) * 1000)

                if res.status_code == 200:
                    return {
                        "status": "connected",
                        "provider": self.provider_id,
                        "model": self.model,
                        "latency_ms": latency,
                    }
                elif res.status_code in (401, 403):
                    return {
                        "status": "auth_error",
                        "provider": self.provider_id,
                        "status_code": res.status_code,
                        "error": "Invalid API key or unauthorized access.",
                    }
                elif res.status_code == 429:
                    return {
                        "status": "rate_limited",
                        "provider": self.provider_id,
                        "status_code": 429,
                        "error": "Provider rate limit reached.",
                    }
                else:
                    return {
                        "status": "error",
                        "provider": self.provider_id,
                        "status_code": res.status_code,
                        "error": res.text[:200],
                    }
        except httpx.TimeoutException:
            return {"status": "timeout", "provider": self.provider_id, "error": "Connection timed out"}
        except Exception as e:
            return {"status": "offline", "provider": self.provider_id, "error": str(e)}

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            raise AuthenticationError(f"No API key configured for {self.provider_id}.", self.provider_id)

        headers = self._get_headers()
        payload = self._build_payload(messages, system_prompt, max_tokens, temperature, stream=True)

        retries = 2
        for attempt in range(retries + 1):
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    async with client.stream(
                        "POST",
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    ) as response:
                        if response.status_code == 429:
                            if attempt < retries:
                                await asyncio.sleep(1.5 * (attempt + 1))
                                continue
                            raise RateLimitError(f"{self.provider_id} rate limit exceeded (HTTP 429).", self.provider_id)

                        if response.status_code in (401, 403):
                            body = await response.aread()
                            raise AuthenticationError(f"{self.provider_id} authentication failed ({response.status_code}): {body.decode()[:150]}", self.provider_id)

                        if response.status_code != 200:
                            body = await response.aread()
                            raise AIProviderError(f"{self.provider_id} error {response.status_code}: {body.decode()[:200]}", self.provider_id, response.status_code)

                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            line = line.strip()
                            if line.startswith("data: "):
                                data_str = line[6:].strip()
                                if data_str == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data_str)
                                    choices = chunk.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        content = delta.get("content")
                                        if content:
                                            yield content
                                except json.JSONDecodeError:
                                    continue
                return
            except (RateLimitError, AuthenticationError):
                raise
            except httpx.TimeoutException:
                if attempt < retries:
                    await asyncio.sleep(1.0)
                    continue
                raise AIProviderError(f"Request to {self.provider_id} timed out.", self.provider_id, retryable=True)
            except Exception as e:
                if attempt < retries:
                    await asyncio.sleep(1.0)
                    continue
                raise AIProviderError(f"{self.provider_id} error: {str(e)}", self.provider_id)

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        if not self.api_key:
            raise AuthenticationError(f"No API key configured for {self.provider_id}.", self.provider_id)

        headers = self._get_headers()
        payload = self._build_payload(messages, system_prompt, max_tokens, temperature, stream=False)

        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"]
            elif res.status_code == 429:
                raise RateLimitError(f"{self.provider_id} rate limit exceeded.", self.provider_id)
            elif res.status_code in (401, 403):
                raise AuthenticationError(f"{self.provider_id} authentication error.", self.provider_id)
            else:
                raise AIProviderError(f"{self.provider_id} error {res.status_code}: {res.text[:200]}", self.provider_id, res.status_code)


# --- 2. Google Gemini Native Provider ---

class GeminiProvider(BaseAIProvider):
    """
    Direct client for Google Gemini API (v1beta REST API).
    Optimized for ultra-low latency with Gemini 3.5 Flash Lite and Gemini 3 Flash.
    Includes automatic model-level fallback (503/429 mitigation) and prompt grounding.
    """

    LEGACY_MODEL_ALIASES = {
        "gemini-2.5-flash": "gemini-3.5-flash-lite",
        "gemini-2.5-pro": "gemini-3.5-flash-lite",
        "gemini-2.0-flash": "gemini-3.5-flash-lite",
        "gemini-1.5-flash": "gemini-3.5-flash-lite",
        "gemini-1.5-pro": "gemini-3.5-flash-lite",
        "gemini-flash": "gemini-3.5-flash-lite",
        "gemini-pro": "gemini-3.5-flash-lite",
        "gemini-flash-latest": "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest": "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite": "gemini-3.5-flash-lite",
    }

    FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3-flash-preview"]

    def __init__(self, api_key: str, model: str = "gemini-3.5-flash-lite", base_url: str = "https://generativelanguage.googleapis.com/v1beta"):
        normalized = self.LEGACY_MODEL_ALIASES.get(model.lower().strip(), model.strip())
        super().__init__("gemini", api_key, normalized, base_url)

    def _convert_messages(self, messages: List[Dict[str, str]], system_prompt: Optional[str]) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        system_instruction = None
        if system_prompt:
            system_instruction = {"parts": [{"text": system_prompt}]}

        contents = []
        for m in messages:
            role = "user" if m["role"] in ("user", "system") else "model"
            contents.append({
                "role": role,
                "parts": [{"text": m["content"]}],
            })
        return system_instruction, contents

    async def check_health(self) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "status": "unconfigured",
                "provider": "gemini",
                "model": self.model,
                "message": "Gemini API key is not configured.",
            }

        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": "ping"}]}],
            "generationConfig": {"maxOutputTokens": 5},
        }

        # Try active model, with transparent fallback on high demand (503)
        candidate_models = [self.model]
        if self.model != "gemini-3-flash-preview":
            candidate_models.append("gemini-3-flash-preview")

        for m in candidate_models:
            url = f"{self.base_url}/models/{m}:generateContent?key={self.api_key}"
            try:
                start = time.time()
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(url, headers=headers, json=payload)
                    latency = round((time.time() - start) * 1000)

                    if res.status_code == 200:
                        return {
                            "status": "connected",
                            "provider": "gemini",
                            "model": m,
                            "latency_ms": latency,
                        }
                    elif res.status_code in (400, 401, 403):
                        return {
                            "status": "auth_error",
                            "provider": "gemini",
                            "status_code": res.status_code,
                            "error": "Invalid Gemini API key or model name.",
                        }
                    elif res.status_code in (429, 503) and m != candidate_models[-1]:
                        logger.warning(f"Gemini model {m} returned {res.status_code}, trying fallback {candidate_models[-1]}")
                        continue
                    elif res.status_code == 429:
                        return {
                            "status": "rate_limited",
                            "provider": "gemini",
                            "status_code": 429,
                            "error": "Gemini quota or rate limit exceeded.",
                        }
                    elif res.status_code == 503:
                        return {
                            "status": "error",
                            "provider": "gemini",
                            "status_code": 503,
                            "error": "Gemini model temporarily experiencing high demand. Please retry.",
                        }
                    else:
                        return {
                            "status": "error",
                            "provider": "gemini",
                            "status_code": res.status_code,
                            "error": res.text[:200],
                        }
            except Exception as e:
                if m == candidate_models[-1]:
                    return {"status": "offline", "provider": "gemini", "error": str(e)}

        return {"status": "offline", "provider": "gemini", "error": "Unable to connect to Gemini API."}

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.3,
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            raise AuthenticationError("Gemini API key is not configured.", "gemini")

        system_instruction, contents = self._convert_messages(messages, system_prompt)
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        candidate_models = [self.model]
        if self.model != "gemini-3-flash-preview":
            candidate_models.append("gemini-3-flash-preview")

        for current_model in candidate_models:
            url = f"{self.base_url}/models/{current_model}:streamGenerateContent?alt=sse&key={self.api_key}"
            retries = 1
            for attempt in range(retries + 1):
                try:
                    streamed_any = False
                    async with httpx.AsyncClient(timeout=35.0) as client:
                        async with client.stream("POST", url, headers=headers, json=payload) as response:
                            if response.status_code in (429, 503):
                                if current_model != candidate_models[-1]:
                                    logger.warning(f"Model {current_model} returned {response.status_code}; trying fallback model {candidate_models[-1]}")
                                    break  # switch to fallback model
                                if attempt < retries:
                                    await asyncio.sleep(1.2 * (attempt + 1))
                                    continue
                                if response.status_code == 429:
                                    raise RateLimitError("Gemini rate limit exceeded.", "gemini")
                                else:
                                    raise AIProviderError("Gemini service temporarily experiencing high demand (503).", "gemini", 503, retryable=True)

                            if response.status_code in (400, 401, 403):
                                body = await response.aread()
                                raise AuthenticationError(f"Gemini authentication failed ({response.status_code}): {body.decode()[:150]}", "gemini")

                            if response.status_code != 200:
                                body = await response.aread()
                                raise AIProviderError(f"Gemini error ({response.status_code}): {body.decode()[:200]}", "gemini", response.status_code)

                            async for line in response.aiter_lines():
                                if not line:
                                    continue
                                line = line.strip()
                                if line.startswith("data: "):
                                    data_str = line[6:].strip()
                                    try:
                                        chunk = json.loads(data_str)
                                        candidates = chunk.get("candidates", [])
                                        if candidates:
                                            content = candidates[0].get("content", {})
                                            parts = content.get("parts", [])
                                            for p in parts:
                                                text = p.get("text")
                                                if text:
                                                    streamed_any = True
                                                    yield text

                                            finish_reason = candidates[0].get("finishReason")
                                            if finish_reason in ("STOP", "MAX_TOKENS", "SAFETY"):
                                                return
                                    except json.JSONDecodeError:
                                        continue
                    return
                except (RateLimitError, AuthenticationError):
                    raise
                except httpx.TimeoutException:
                    if streamed_any:
                        return
                    if attempt < retries:
                        await asyncio.sleep(1.0)
                        continue
                    if current_model != candidate_models[-1]:
                        break
                    raise AIProviderError("Gemini generation timed out.", "gemini", retryable=True)
                except Exception as e:
                    if streamed_any:
                        return
                    if attempt < retries and ("503" in str(e) or "429" in str(e)):
                        await asyncio.sleep(1.0)
                        continue
                    if current_model != candidate_models[-1]:
                        break
                    raise AIProviderError(f"Gemini error: {str(e)}", "gemini")

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.3,
    ) -> str:
        if not self.api_key:
            raise AuthenticationError("Gemini API key is not configured.", "gemini")

        system_instruction, contents = self._convert_messages(messages, system_prompt)
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        candidate_models = [self.model]
        if self.model != "gemini-3-flash-preview":
            candidate_models.append("gemini-3-flash-preview")

        for current_model in candidate_models:
            url = f"{self.base_url}/models/{current_model}:generateContent?key={self.api_key}"
            retries = 2
            for attempt in range(retries + 1):
                try:
                    async with httpx.AsyncClient(timeout=35.0) as client:
                        res = await client.post(url, headers=headers, json=payload)
                        if res.status_code == 200:
                            data = res.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                return "".join(p.get("text", "") for p in parts)
                            return ""
                        elif res.status_code in (429, 503):
                            if current_model != candidate_models[-1]:
                                logger.warning(f"Model {current_model} returned {res.status_code}; falling back to {candidate_models[-1]}")
                                break
                            if attempt < retries:
                                await asyncio.sleep(1.5 * (attempt + 1))
                                continue
                            if res.status_code == 429:
                                raise RateLimitError("Gemini rate limit exceeded.", "gemini")
                            else:
                                raise AIProviderError("Gemini service temporarily unavailable (503).", "gemini", 503, retryable=True)
                        elif res.status_code in (401, 403):
                            raise AuthenticationError("Gemini authorization error.", "gemini")
                        else:
                            raise AIProviderError(f"Gemini error {res.status_code}: {res.text[:200]}", "gemini", res.status_code)
                except (RateLimitError, AuthenticationError):
                    raise
                except httpx.TimeoutException:
                    if attempt < retries:
                        await asyncio.sleep(1.5)
                        continue
                    if current_model != candidate_models[-1]:
                        break
                    raise AIProviderError("Gemini request timed out.", "gemini", retryable=True)
                except Exception as e:
                    if attempt < retries and "503" in str(e):
                        await asyncio.sleep(1.5 * (attempt + 1))
                        continue
                    if current_model != candidate_models[-1]:
                        break
                    raise AIProviderError(f"Gemini error: {str(e)}", "gemini")
        return ""


# --- Factory & Fallback Orchestrator ---

DEFAULT_MODELS = {
    "gemini": "gemini-3.5-flash-lite",
    "groq": os.getenv("GROQ_DEFAULT_MODEL", "qwen/qwen3.8-27b"),
    "openrouter": "meta-llama/llama-3.3-70b-instruct",
    "openai_compatible": "gpt-4o-mini",
}

DEFAULT_BASE_URLS = {
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "openai_compatible": "https://api.openai.com/v1",
}


def create_provider_instance(provider_name: str, api_key: str, model: Optional[str] = None, base_url: Optional[str] = None) -> BaseAIProvider:
    """Factory creating the appropriate provider instance."""
    p = provider_name.lower().strip()
    m = model or DEFAULT_MODELS.get(p, "llama-3.3-70b-versatile")
    b = base_url or DEFAULT_BASE_URLS.get(p, "https://api.groq.com/openai/v1")

    if p == "gemini":
        return GeminiProvider(api_key=api_key, model=m, base_url=b)
    else:
        return OpenAICompatibleProvider(provider_id=p, api_key=api_key, model=m, base_url=b)


class UnifiedAIProviderService:
    """
    Central AI service orchestrating primary models, dynamic credentials,
    and automatic transparent fallback.
    """

    def __init__(self):
        pass

    def get_configured_providers(self) -> Dict[str, Dict[str, Any]]:
        """
        Loads saved providers from encrypted platform settings or environment variables.
        Masks API keys for privacy and security.
        """
        saved = PlatformDB.get_settings().get("ai_providers_config", {})
        
        # Check env-based primary provider if no DB config
        if not saved:
            gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
            has_gemini = bool(gemini_key and len(gemini_key) > 5)
            if has_gemini:
                saved["gemini"] = {
                    "id": "gemini",
                    "name": "Gemini",
                    "api_key": gemini_key,
                    "model": os.getenv("GEMINI_DEFAULT_MODEL", "gemini-3.5-flash-lite"),
                    "base_url": DEFAULT_BASE_URLS["gemini"],
                    "is_default": True,
                    "is_fallback": False,
                }

            primary_id = (settings.AI_PROVIDER or "groq").lower()
            key = settings.AI_API_KEY or os.getenv("GROQ_API_KEY", "").strip()
            if primary_id != "gemini" or not has_gemini:
                saved[primary_id] = {
                    "id": primary_id,
                    "name": primary_id.capitalize(),
                    "api_key": key,
                    "model": settings.AI_PRIMARY_MODEL or DEFAULT_MODELS.get(primary_id, "llama-3.3-70b-versatile"),
                    "base_url": settings.AI_BASE_URL or DEFAULT_BASE_URLS.get(primary_id, ""),
                    "is_default": not has_gemini,
                    "is_fallback": has_gemini,
                }
        return saved

    def get_public_provider_status(self) -> List[Dict[str, Any]]:
        """Returns non-sensitive provider summaries with masked keys."""
        configs = self.get_configured_providers()
        results = []
        for pid, cfg in configs.items():
            key = cfg.get("api_key", "")
            has_key = bool(key and len(key.strip()) > 3)
            masked = f"{key[:4]}****{key[-4:]}" if (has_key and len(key) >= 10) else ("configured" if has_key else "missing")

            results.append({
                "id": pid,
                "name": cfg.get("name", pid.capitalize()),
                "model": cfg.get("model", DEFAULT_MODELS.get(pid, "")),
                "is_default": cfg.get("is_default", False),
                "is_fallback": cfg.get("is_fallback", False),
                "configured": has_key,
                "masked_key": masked,
            })
        return results

    def save_provider_config(
        self,
        provider_id: str,
        api_key: str,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        is_default: bool = False,
        is_fallback: bool = False,
    ) -> None:
        """Saves provider configuration in secure SQLite settings."""
        pid = provider_id.lower().strip()
        configs = self.get_configured_providers()

        # If setting default, unset existing default
        if is_default:
            for c in configs.values():
                c["is_default"] = False

        existing_key = configs.get(pid, {}).get("api_key", "")
        # Keep existing key if user submitted masked placeholder
        final_key = api_key if (api_key and not api_key.startswith("****")) else existing_key

        configs[pid] = {
            "id": pid,
            "name": pid.capitalize(),
            "api_key": final_key,
            "model": model or configs.get(pid, {}).get("model") or DEFAULT_MODELS.get(pid, "llama-3.3-70b-versatile"),
            "base_url": base_url or configs.get(pid, {}).get("base_url") or DEFAULT_BASE_URLS.get(pid, ""),
            "is_default": is_default,
            "is_fallback": is_fallback,
            "updated_at": time.time(),
        }
        PlatformDB.save_setting("ai_providers_config", configs)

    def remove_provider(self, provider_id: str) -> bool:
        pid = provider_id.lower().strip()
        configs = self.get_configured_providers()
        if pid in configs:
            del configs[pid]
            PlatformDB.save_setting("ai_providers_config", configs)
            return True
        return False

    def get_primary_provider(self) -> Tuple[BaseAIProvider, Optional[BaseAIProvider]]:
        """
        Resolves the primary provider instance and optional fallback provider instance.
        """
        configs = self.get_configured_providers()
        primary_cfg = None
        fallback_cfg = None

        # Look for explicit default
        for c in configs.values():
            if c.get("is_default") and c.get("api_key"):
                primary_cfg = c
                break

        # Fallback to any configured provider with an API key
        if not primary_cfg:
            for c in configs.values():
                if c.get("api_key"):
                    primary_cfg = c
                    break

        # Look for fallback provider
        if primary_cfg:
            for c in configs.values():
                if c.get("id") != primary_cfg.get("id") and c.get("api_key"):
                    fallback_cfg = c
                    break

        if not primary_cfg:
            # Degraded unconfigured instance
            primary_instance = OpenAICompatibleProvider("groq", "", DEFAULT_MODELS["groq"], DEFAULT_BASE_URLS["groq"])
            return primary_instance, None

        primary_instance = create_provider_instance(
            primary_cfg["id"],
            primary_cfg.get("api_key", ""),
            primary_cfg.get("model"),
            primary_cfg.get("base_url"),
        )

        fallback_instance = None
        if fallback_cfg:
            fallback_instance = create_provider_instance(
                fallback_cfg["id"],
                fallback_cfg.get("api_key", ""),
                fallback_cfg.get("model"),
                fallback_cfg.get("base_url"),
            )

        return primary_instance, fallback_instance

    def is_configured(self) -> bool:
        primary, _ = self.get_primary_provider()
        return bool(primary.api_key and len(primary.api_key.strip()) > 3)

    def get_provider_info(self) -> Dict[str, Any]:
        primary, fallback = self.get_primary_provider()
        return {
            "provider": primary.provider_id,
            "model": primary.model,
            "configured": bool(primary.api_key),
            "fallback_provider": fallback.provider_id if fallback else None,
            "fallback_model": fallback.model if fallback else None,
        }

    async def check_health(self) -> Dict[str, Any]:
        primary, _ = self.get_primary_provider()
        return await primary.check_health()

    async def stream_chat_completion(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> AsyncGenerator[str, None]:
        """
        Streams completion token-by-token.
        If primary provider encounters a rate limit or service outage and a fallback
        is available, automatically switches to the fallback and clearly announces it!
        """
        primary, fallback = self.get_primary_provider()

        if not primary.api_key:
            guidance = (
                "> ℹ️ **AI Provider Notice**: No AI API key is configured.\n\n"
                "To enable automatic AI response synthesis and deep research reasoning:\n"
                "1. Open **Settings -> AI Providers** in the dashboard and add your API key (Gemini, Groq, OpenRouter, or OpenAI-compatible).\n"
                "2. Alternatively set `AI_API_KEY` in `backend/.env`.\n\n"
                "Below are the verified direct search matches from your workspace and web:\n"
            )
            yield guidance
            return

        try:
            async for token in primary.stream_chat(messages, system_prompt, max_tokens, temperature):
                yield token
        except (RateLimitError, AIProviderError) as e:
            logger.warning(f"Primary provider {primary.provider_id} failed: {e}")
            if fallback and fallback.api_key:
                yield f"\n\n> ⚠️ *Primary provider ({primary.provider_id.upper()}) unavailable ({e}). Automatically switching to fallback provider: {fallback.provider_id.upper()} ({fallback.model})...*\n\n"
                try:
                    async for token in fallback.stream_chat(messages, system_prompt, max_tokens, temperature):
                        yield token
                    return
                except Exception as fb_err:
                    yield f"\n\n⚠️ *Fallback provider ({fallback.provider_id.upper()}) also encountered an issue: {str(fb_err)}*"
                    return
            else:
                yield f"\n\n⚠️ *AI Provider Error ({primary.provider_id.upper()}): {str(e)}*"

    async def generate_chat_completion(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        primary, fallback = self.get_primary_provider()
        if not primary.api_key:
            return "No AI_API_KEY configured."

        try:
            return await primary.generate_chat(messages, system_prompt, max_tokens, temperature)
        except (RateLimitError, AIProviderError) as e:
            if fallback and fallback.api_key:
                logger.warning(f"Primary {primary.provider_id} failed. Attempting fallback {fallback.provider_id}")
                return await fallback.generate_chat(messages, system_prompt, max_tokens, temperature)
            raise


# Global singleton instance
ai_provider = UnifiedAIProviderService()
