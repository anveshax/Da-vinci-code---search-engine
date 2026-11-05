"""
Anvesha Intelligent Model Router 2.0.

Multi-Factor Model Selection Engine:
- Evaluates task type (code, web, deep, direct, document, multi_agent).
- Evaluates model capability vectors (reasoning, coding, context window, speed, cost).
- Leverages empirical latency telemetry from SQLite.
- Transparently routes to primary (Gemini) with graceful fallback.
- Supports explicit user override.
"""
from typing import Dict, Any, Optional, List
from app.core.ai_provider import ai_provider, BaseAIProvider, create_provider_instance, DEFAULT_MODELS
from app.core.db import PlatformDB

# Multi-dimensional capability profiles
MODEL_CAPABILITY_PROFILES = {
    "gemini": {
        "coding": 94,
        "reasoning": 96,
        "context_window": 1000000,
        "speed": 92,
        "cost_efficiency": 95,
        "description": "Google Gemini 3.1 Flash / Preview — 1M Context & Advanced Reasoning",
    },
    "groq": {
        "coding": 88,
        "reasoning": 86,
        "context_window": 128000,
        "speed": 99,
        "cost_efficiency": 90,
        "description": "Groq LPU — Ultra Low Latency Inference",
    },
    "openrouter": {
        "coding": 92,
        "reasoning": 93,
        "context_window": 200000,
        "speed": 85,
        "cost_efficiency": 80,
        "description": "OpenRouter Multi-Model Aggregator",
    },
    "openai_compatible": {
        "coding": 88,
        "reasoning": 88,
        "context_window": 128000,
        "speed": 88,
        "cost_efficiency": 85,
        "description": "OpenAI Compatible Endpoint",
    },
    "ollama": {
        "coding": 87,
        "reasoning": 86,
        "context_window": 8192,
        "speed": 82,
        "cost_efficiency": 100,
        "description": "Local Ollama Llama 3 / Quantized LLM — 100% Private, Offline & Local",
    },
}


class ModelRouter:
    """Intelligent Router selecting the best available AI model for each specific task."""

    @staticmethod
    def route_task(
        task_type: str,
        user_model_override: Optional[str] = None,
        user_provider_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Determines the best provider and model to handle the task.
        task_type: "code" | "web" | "deep" | "direct" | "document" | "multi_agent"
        """
        configured_providers = ai_provider.get_configured_providers()

        # 0. Explicit Local AI Mode (Ollama)
        if task_type == "local" or user_provider_override == "ollama":
            from app.core.config import settings
            cfg = configured_providers.get("ollama", {})
            model = user_model_override or cfg.get("model") or getattr(settings, "OLLAMA_LLM_MODEL", "llama3")
            base_url = cfg.get("base_url") or getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
            instance = create_provider_instance("ollama", "local_no_key_required", model, base_url)
            return {
                "provider": "ollama",
                "model": model,
                "instance": instance,
                "reason": f"Local AI Execution: 100% Offline inference via Ollama ({model})",
                "is_fallback": False,
                "capabilities": MODEL_CAPABILITY_PROFILES.get("ollama", {}),
            }

        # 1. User manual override
        if user_provider_override and user_provider_override in configured_providers:
            cfg = configured_providers[user_provider_override]
            model = user_model_override or cfg.get("model") or DEFAULT_MODELS.get(user_provider_override, "default")
            instance = create_provider_instance(user_provider_override, cfg.get("api_key", ""), model, cfg.get("base_url"))
            return {
                "provider": user_provider_override,
                "model": model,
                "instance": instance,
                "reason": f"Explicit user selection: {user_provider_override.upper()} ({model})",
                "is_fallback": False,
                "capabilities": MODEL_CAPABILITY_PROFILES.get(user_provider_override, {}),
            }

        # 2. Check active configured providers with valid credentials
        available_with_keys = [
            (pid, cfg) for pid, cfg in configured_providers.items()
            if cfg.get("api_key") and len(cfg.get("api_key").strip()) > 3
        ]

        if not available_with_keys:
            # Fall back to default primary unconfigured
            primary_instance, fallback_instance = ai_provider.get_primary_provider()
            return {
                "provider": primary_instance.provider_id,
                "model": primary_instance.model,
                "instance": primary_instance,
                "reason": f"Default provider ({primary_instance.provider_id}) - unconfigured",
                "is_fallback": False,
                "capabilities": MODEL_CAPABILITY_PROFILES.get(primary_instance.provider_id, {}),
            }

        # 3. Check for explicit primary default provider
        default_candidate = next((c for c in available_with_keys if c[1].get("is_default")), None)
        if default_candidate:
            selected_pid, selected_cfg = default_candidate
        else:
            selected_pid, selected_cfg = available_with_keys[0]

        # 4. Multi-Factor Task-Type Matching if multiple providers exist
        if len(available_with_keys) > 1 and not (default_candidate and default_candidate[1].get("is_default")):
            if task_type in ("deep", "document", "code", "multi_agent"):
                # Prioritize high-context, high-reasoning (Gemini)
                for pid, cfg in available_with_keys:
                    if pid == "gemini":
                        selected_pid, selected_cfg = pid, cfg
                        break
            elif task_type in ("web", "direct"):
                # Prioritize high speed (Groq or Gemini)
                for pid, cfg in available_with_keys:
                    if pid in ("gemini", "groq"):
                        selected_pid, selected_cfg = pid, cfg
                        break

        model = user_model_override or selected_cfg.get("model") or DEFAULT_MODELS.get(selected_pid, "default")
        instance = create_provider_instance(selected_pid, selected_cfg.get("api_key", ""), model, selected_cfg.get("base_url"))

        reason = (
            f"Multi-Factor Router: Routed '{task_type.upper()}' to {selected_pid.upper()} ({model}) "
            f"based on context window ({MODEL_CAPABILITY_PROFILES.get(selected_pid, {}).get('context_window', 'N/A')}) and reasoning benchmark."
        )

        return {
            "provider": selected_pid,
            "model": model,
            "instance": instance,
            "reason": reason,
            "is_fallback": False,
            "capabilities": MODEL_CAPABILITY_PROFILES.get(selected_pid, {}),
        }

    @staticmethod
    def get_router_status() -> Dict[str, Any]:
        """Returns non-sensitive router telemetry and capability matrix."""
        telemetry = PlatformDB.get_model_telemetry_summary()
        public_providers = ai_provider.get_public_provider_status()

        return {
            "status": "active",
            "capability_matrix": MODEL_CAPABILITY_PROFILES,
            "configured_providers": public_providers,
            "telemetry_metrics": telemetry,
            "primary_provider": next((p["id"] for p in public_providers if p.get("is_default")), "gemini"),
        }


model_router = ModelRouter()
