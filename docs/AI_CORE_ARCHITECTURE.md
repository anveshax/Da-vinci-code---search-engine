# Anvesha AI Intelligence Platform — Advanced AI Core Engine Architecture

## 1. Executive Summary

This architecture transforms Anvesha from a single-provider system into a **multi-provider, source-grounded, resilient AI developer platform**.

### Core Pillars
1. **Multi-Provider Unified Abstraction**: Supports Google Gemini API, Groq API, OpenRouter API, and custom OpenAI-compatible endpoints with identical interfaces.
2. **Transparent Resilient Fallback**: Automatic retries on rate limits (HTTP 429) and outages (HTTP 503), transparently shifting to configured fallback providers.
3. **Zero Leaked Secrets**: API credentials are saved encrypted on the backend, strictly masked in API responses, and never exposed in browser storage or client URLs.
4. **Intelligent Model Router**: Dynamically matches task intent (code analysis, fast web synthesis, multi-step deep research, direct conversation) to optimal model capabilities.
5. **Grounded 5-Mode Search Engine**:
   - `auto`: Routes dynamically based on intent.
   - `code`: Searches repository files, AST symbols, and line ranges.
   - `web`: Real public search results with verified domains (NO Wikipedia fallback).
   - `deep`: Multi-step query decomposition, iterative retrieval, and cross-verification.
   - `direct`: Pure model reasoning without simulated external queries.
6. **Document & File Intelligence**: Ingests PDF, DOCX, Markdown, Text, and Code files with page-level and line-level citation tracking.

---

## 2. Multi-Provider AI Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │          Anvesha AI Model Router             │
                  └───────┬──────────────────────────────┬───────┘
                          │                              │
                          ▼                              ▼
                 [Primary Provider]             [Fallback Provider]
                 (e.g., Groq / Gemini)          (e.g., OpenRouter / OpenAI)
                          │                              │
                          └──────────────┬───────────────┘
                                         ▼
                   Unified BaseAIProvider Interface
                   ├── stream_chat()     -> SSE Tokens
                   ├── generate_chat()   -> Full Text
                   └── check_health()    -> Latency & Status
```

### Supported Providers & Default Models
| Provider | Default Model | Base URL | Highlights |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | `gemini-2.5-flash` | `https://generativelanguage.googleapis.com/v1beta` | 1M+ token context, high reasoning |
| **Groq** | `llama-3.3-70b-versatile` | `https://api.groq.com/openai/v1` | Ultra-low latency, real-time streaming |
| **OpenRouter** | `meta-llama/llama-3.3-70b-instruct` | `https://openrouter.ai/api/v1` | Claude 3.5, DeepSeek, Llama 3.3 |
| **OpenAI-Compatible** | `gpt-4o-mini` | `https://api.openai.com/v1` / `http://localhost:11434/v1` | Ollama, vLLM, LocalAI, Azure |

---

## 3. Search Engine & Web Retrieval Pipeline

```
  User Query
      │
      ▼
  [Intent Classifier & Router]
      │
      ├── Code Query ──> [Codebase AST Scanner] ──> Indexed File Snippets
      ├── Doc Query  ──> [SQLite Document Chunks] ──> Page/Line Citations
      ├── Web Query  ──> [Search Engine Pipeline]
      │                   ├── Tavily API (if configured)
      │                   ├── Brave Search (if configured)
      │                   └── DuckDuckGo HTML Scraper (Zero-cost default)
      │                   (NO Wikipedia fallback)
      │
      ▼
  [Evidence Validator & Deduplicator]
      │
      ▼
  [Source-Grounded AI Synthesizer] ──> SSE Stream to Client with Citations
```

---

## 4. Environment Variables (`backend/.env.example`)

```bash
# --- Core Platform Settings ---
WORKSPACE_ROOT=/path/to/your/project
CORS_ORIGINS=https://da-vinci-code-search-engine.vercel.app,http://localhost:5173

# --- Primary AI Provider Settings (Optional fallback to SQLite dashboard) ---
AI_PROVIDER=groq
AI_API_KEY=gsk_your_groq_api_key_here
AI_PRIMARY_MODEL=llama-3.3-70b-versatile
AI_BASE_URL=https://api.groq.com/openai/v1

# --- Optional Secondary Providers ---
# GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
# OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here

# --- Optional Public Search API Keys ---
# TAVILY_API_KEY=tvly-your_tavily_key_here
# BRAVE_API_KEY=BSAYourBraveSearchKeyHere
```

---

## 5. Deployment Guide

### A. Frontend on Vercel
1. Set the root directory to `frontend`.
2. Configure Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend.onrender.com` (no trailing slash).
3. Build Command: `npm run build`
4. Output Directory: `dist`

### B. Backend on Render
1. Environment: Python 3.12
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `.env.example`.
