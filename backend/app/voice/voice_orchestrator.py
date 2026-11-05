"""
Central Voice Orchestrator for Anvesha Voice Engine 3.0.

Integrates:
- Adaptive Task Classifier & Model Router
- Web Search Aggregation & Hybrid Retrieval
- Research & Knowledge Platform Agents
- Governance Engine & Safety Validation
- Speech Synthesis Sentence Chunker
- Voice-based Application Navigation & Commands
"""
import re
import json
import time
import asyncio
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional, Tuple

from app.core.ai_provider import ai_provider
from app.core.model_router import model_router
from app.core.adaptive_classifier import AdaptiveTaskClassifier
from app.governance.engine import CentralGovernanceEngine, ActionRequiresApprovalError, GovernanceViolationError
from app.memory.service import OrganizationalMemoryService
from engine.web_search import execute_web_search
from engine.citation_verifier import citation_verifier
from app.voice.config import voice_settings
from app.voice.models import VoiceEvent, VoicePersonaId
from app.voice.voice_personas import get_persona
from app.voice.voice_session import VoiceSession
from app.voice.speech_synthesis import split_sentences_for_streaming, clean_text_for_speech
from app.voice.provider_registry import voice_registry

logger = logging.getLogger(__name__)

# Voice-based UI Navigation Matchers
NAV_PATTERNS = [
    (r"\b(go to|open|show|switch to)\s+(search|home|homepage)\b", "navigate", "search", "Switching to search homepage."),
    (r"\b(go to|open|show|switch to)\s+(history|past searches)\b", "navigate", "history", "Opening your search history."),
    (r"\b(go to|open|show|switch to)\s+(web intelligence|crawler|crawling)\b", "navigate", "web_intelligence", "Opening Web Intelligence and crawler workspace."),
    (r"\b(go to|open|show|switch to)\s+(web studio|studio|dev studio)\b", "navigate", "web_studio", "Opening Web Development Studio."),
    (r"\b(go to|open|show|switch to)\s+(codebase|explorer|code explorer)\b", "navigate", "explorer", "Opening Codebase Intelligence Explorer."),
    (r"\b(go to|open|show|switch to)\s+(deep research|research)\b", "navigate", "deep_research", "Opening Deep Research Workspace."),
    (r"\b(go to|open|show|switch to)\s+(governance|governance console|audit)\b", "navigate", "governance", "Opening Governance Console."),
    (r"\b(go to|open|show|switch to)\s+(settings|preferences)\b", "navigate", "settings", "Opening platform settings."),
    (r"\b(switch to|enable|activate)\s+(dark mode|dark theme)\b", "theme", "dark", "Switching to dark obsidian theme."),
    (r"\b(switch to|enable|activate)\s+(light mode|light theme)\b", "theme", "light", "Switching to light solar glass theme."),
]


class VoiceOrchestrator:
    """Coordinates intelligent voice execution across Anvesha services."""

    @staticmethod
    def detect_navigation_command(utterance: str) -> Optional[Tuple[str, str, str]]:
        """Checks if user speech is a voice UI command."""
        low = utterance.strip().lower()
        for pattern, action, target, spoken_ack in NAV_PATTERNS:
            if re.search(pattern, low):
                return action, target, spoken_ack
        return None

    @classmethod
    async def process_utterance_stream(
        cls,
        session: VoiceSession,
        user_utterance: str,
    ) -> AsyncGenerator[VoiceEvent, None]:
        """
        Orchestrates an incoming voice utterance end-to-end:
        1. Emits thinking state
        2. Checks voice navigation commands
        3. Resolves contextual source follow-ups
        4. Classifies intent via AdaptiveTaskClassifier
        5. Executes search or agent routing
        6. Streams spoken answer chunks + synthesized audio
        """
        session.touch()
        now = time.time()

        # Check interruption
        if session.interruption_mgr.is_interrupted():
            yield VoiceEvent(type="interrupted", payload={"reason": "cancelled before execution"}, timestamp=now)
            return

        yield VoiceEvent(
            type="thinking",
            payload={"utterance": user_utterance, "status": "Analyzing request"},
            session_id=session.session_id,
            timestamp=now,
        )

        # 1. Voice UI Navigation Check
        nav = cls.detect_navigation_command(user_utterance)
        if nav:
            action, target, spoken_ack = nav
            session.context.add_user_turn(user_utterance)
            session.context.add_assistant_turn(spoken_ack)

            yield VoiceEvent(
                type="agent_action",
                payload={"action": action, "target": target},
                session_id=session.session_id,
                timestamp=time.time(),
            )

            # Synthesize navigation acknowledgment
            tts_provider = voice_registry.get_tts_provider(session.tts_provider)
            synth = await tts_provider.synthesize(
                text=spoken_ack,
                persona_id=session.persona.value,
            )
            yield VoiceEvent(
                type="assistant_text_chunk",
                payload={"text": spoken_ack, "is_final": True},
                session_id=session.session_id,
                timestamp=time.time(),
            )
            if synth.audio_base64:
                yield VoiceEvent(
                    type="audio_chunk",
                    payload={"audio_base64": synth.audio_base64, "format": synth.audio_format, "text": spoken_ack},
                    session_id=session.session_id,
                    timestamp=time.time(),
                )
            yield VoiceEvent(type="speaking_completed", payload={}, session_id=session.session_id, timestamp=time.time())
            return

        # 2. Add user turn to context
        session.context.add_user_turn(user_utterance)

        # 3. Check for Ordinal Source Follow-Up
        referenced_source = session.context.resolve_source_reference(user_utterance)
        retrieved_sources: List[Dict[str, Any]] = []

        # 4. Adaptive Task & Intent Classification
        try:
            classification = AdaptiveTaskClassifier.classify_task(user_utterance)
            task_type = classification.get("task_type", "search")
            risk_score = classification.get("risk_score", 10)
        except Exception as e:
            logger.warning(f"Classification failed: {e}. Defaulting to search.")
            task_type = "search"
            risk_score = 10

        # 5. Governance verification for elevated risk actions
        if risk_score > 70 and voice_settings.REQUIRE_CONFIRMATION_FOR_ACTIONS:
            try:
                CentralGovernanceEngine.evaluate_agent_action(
                    agent_id="voice_orchestrator",
                    action_type="voice_privileged_tool",
                    target_resource=user_utterance,
                    risk_score=risk_score,
                )
            except (ActionRequiresApprovalError, GovernanceViolationError) as gv:
                gov_msg = f"Governance policy requires approval for this action: {gv}"
                yield VoiceEvent(type="error", payload={"message": gov_msg}, session_id=session.session_id, timestamp=time.time())
                return

        # 6. Gather Grounding Context
        grounding_context = ""

        if referenced_source:
            # User specifically asked about a previous source!
            title = referenced_source.get("title", "Previous Source")
            snippet = referenced_source.get("snippet", "")
            url = referenced_source.get("url", "")
            grounding_context = f"The user is asking about the following source from the previous turn:\nTitle: {title}\nSnippet: {snippet}\nURL: {url}\n"
            retrieved_sources = [referenced_source]
            yield VoiceEvent(
                type="agent_action",
                payload={"action": "grounding_follow_up", "source": referenced_source},
                session_id=session.session_id,
                timestamp=time.time(),
            )
        elif task_type in ["search", "web_dev", "code", "research"]:
            yield VoiceEvent(
                type="agent_action",
                payload={"action": "web_search", "query": user_utterance},
                session_id=session.session_id,
                timestamp=time.time(),
            )
            try:
                # Query web search
                search_res = await asyncio.to_thread(execute_web_search, user_utterance, max_results=4)
                results_list = search_res.get("results", []) if isinstance(search_res, dict) else []
                if results_list:
                    retrieved_sources = results_list
                    snippets = []
                    for i, r in enumerate(results_list[:4], 1):
                        snippets.append(f"[{i}] {r.get('title', '')}: {r.get('snippet', '')}")
                    grounding_context = "Web Search Results:\n" + "\n".join(snippets)
            except Exception as e:
                logger.warning(f"Web search execution error: {e}")

        # 7. Prompt Assembly with Persona Directives
        persona = get_persona(session.persona.value)
        system_directive = (
            f"{persona.get('prompt_directive', '')}\n"
            f"You are delivering spoken answers to a user over real-time voice. "
            f"Rules for spoken answers:\n"
            f"- Keep the explanation natural, conversational, and direct.\n"
            f"- Avoid markdown tables, bullet symbols, asterisks, or bare links.\n"
            f"- If mentioning sources, say 'According to [Source Name]' naturally.\n"
            f"- If the user speaks in Hindi or Hinglish, reply naturally in the same language.\n"
            f"- Limit spoken response to 2 to 4 concise, clear sentences unless deeply explaining."
        )

        conversation_history = session.context.get_messages_for_llm(max_turns=6)
        messages = [{"role": "system", "content": system_directive}]

        # Inject context into history
        if grounding_context:
            messages.append({"role": "system", "content": f"Context Information:\n{grounding_context}"})

        messages.extend(conversation_history)

        # 8. Generation & Low-Latency Sentence-Level Streaming TTS
        model_instance = model_router.get_model_for_task(task_type)
        tts_provider = voice_registry.get_tts_provider(session.tts_provider)

        accumulated_text = ""
        sentence_buffer = ""
        citations: List[Dict[str, Any]] = []

        try:
            # Stream tokens from LLM
            stream_gen = ai_provider.stream_chat_completion(
                messages=messages,
                model_override=model_instance.model_name if hasattr(model_instance, "model_name") else None,
                temperature=0.6,
                max_tokens=400,
            )

            async for chunk in stream_gen:
                if session.interruption_mgr.is_interrupted():
                    logger.info("Generation interrupted by user.")
                    yield VoiceEvent(type="interrupted", payload={"reason": "user barge-in"}, session_id=session.session_id, timestamp=time.time())
                    return

                accumulated_text += chunk
                sentence_buffer += chunk

                yield VoiceEvent(
                    type="assistant_text_chunk",
                    payload={"text": chunk, "is_final": False},
                    session_id=session.session_id,
                    timestamp=time.time(),
                )

                # Check if sentence buffer contains a complete sentence (. ! ? \n)
                sentences = split_sentences_for_streaming(sentence_buffer)
                if len(sentences) > 1:
                    ready_sentence = sentences[0]
                    sentence_buffer = " ".join(sentences[1:])

                    # Synthesize this sentence asynchronously
                    clean_sen = clean_text_for_speech(ready_sentence)
                    if clean_sen and not session.interruption_mgr.is_interrupted():
                        synth = await tts_provider.synthesize(
                            text=clean_sen,
                            persona_id=session.persona.value,
                        )
                        if synth.audio_base64 and not session.interruption_mgr.is_interrupted():
                            yield VoiceEvent(
                                type="audio_chunk",
                                payload={
                                    "audio_base64": synth.audio_base64,
                                    "format": synth.audio_format,
                                    "text": clean_sen,
                                    "duration_ms": synth.duration_ms,
                                },
                                session_id=session.session_id,
                                timestamp=time.time(),
                            )

            # Synthesize remainder sentence
            final_clean = clean_text_for_speech(sentence_buffer)
            if final_clean and not session.interruption_mgr.is_interrupted():
                synth = await tts_provider.synthesize(
                    text=final_clean,
                    persona_id=session.persona.value,
                )
                if synth.audio_base64 and not session.interruption_mgr.is_interrupted():
                    yield VoiceEvent(
                        type="audio_chunk",
                        payload={
                            "audio_base64": synth.audio_base64,
                            "format": synth.audio_format,
                            "text": final_clean,
                            "duration_ms": synth.duration_ms,
                        },
                        session_id=session.session_id,
                        timestamp=time.time(),
                    )

            # 9. Verify citations for displayed text
            if retrieved_sources:
                try:
                    verified = citation_verifier.verify_citations(accumulated_text, retrieved_sources)
                    citations = verified.get("citations", [])
                except Exception:
                    citations = []

            # 10. Record turn in context
            session.context.add_assistant_turn(
                content=accumulated_text,
                sources=retrieved_sources,
                citations=citations,
            )

            # Signal turn completion
            yield VoiceEvent(
                type="speaking_completed",
                payload={
                    "full_text": accumulated_text,
                    "sources": retrieved_sources,
                    "citations": citations,
                },
                session_id=session.session_id,
                timestamp=time.time(),
            )

        except asyncio.CancelledError:
            logger.info("Generation task was cancelled.")
            yield VoiceEvent(type="interrupted", payload={"reason": "cancelled"}, session_id=session.session_id, timestamp=time.time())
        except Exception as e:
            logger.error(f"Error generating voice response: {e}", exc_info=True)
            yield VoiceEvent(type="error", payload={"message": str(e)}, session_id=session.session_id, timestamp=time.time())
