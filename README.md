# Codebase Intelligence Engine (CIE)

A high-performance codebase analysis and architecture visualization studio built with **FastAPI** (Python 3.12) and **React 18 + TypeScript + Vite**.

---

## Architecture Overview

```
codebasec intelligemce engine/
├── backend/
│   ├── app/                    # FastAPI web service & endpoints (/api/health)
│   ├── engine/                 # Decoupled Code Analysis Engine (AST & Parsers)
│   └── requirements.txt        # Backend dependencies
│
├── frontend/
│   ├── src/                    # React 18 + TypeScript + Tailwind CSS UI
│   ├── vite.config.ts          # Vite configuration with /api reverse proxy
│   └── package.json            # Frontend dependencies
│
└── README.md
```

---

## Getting Started

### 1. Start the Backend Server (FastAPI)

```bash
# Navigate to the project root and activate virtual environment
cd "/home/amit/codebasec intelligemce engine"
backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* **Interactive API Documentation**: Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) in your browser.
* **Health Endpoint**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

### 2. Start the Frontend Development Server (Vite)

```bash
# In a separate terminal tab
cd "/home/amit/codebasec intelligemce engine/frontend"
npm run dev
```
* **Frontend Web Dashboard**: Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

---

## 🗺️ GitHub Milestone Roadmap

Track live progress, issues, and releases directly on [GitHub Milestones](https://github.com/anveshax/Da-vinci-code---search-engine/milestones).

| Milestone | Status | Description | Tracking |
| :--- | :---: | :--- | :---: |
| **Milestone 1: Core Architecture & Live Telemetry** | ✅ Complete | Application Shell, FastAPI backend, Vite React frontend, and Live Telemetry Connectivity. | [Milestone #1](https://github.com/anveshax/Da-vinci-code---search-engine/milestone/1) |
| **Milestone 2: Multi-Agent AI Search & Research Engine** | ✅ Complete | Universal multi-engine aggregation (Tavily, SearXNG, Bing, Google), query expansion, deep research multi-agent orchestration, SSE streaming synthesis, and visual media extraction. | [Milestone #2](https://github.com/anveshax/Da-vinci-code---search-engine/milestone/2) |
| **Milestone 3: 3D Earth Globe Visualizations & Graphics Engine** | ✅ Complete | Interactive WebGL Three.js Earth with 4 independent variants (V1 Classic, V2 Realistic Immersive, V3 Holographic Point-Cloud, V4 Cinematic Deep Space), orbit bloom nodes, real-time shader controls, and mobile responsive camera framing. | [Milestone #3](https://github.com/anveshax/Da-vinci-code---search-engine/milestone/3) |
| **Milestone 4: Minimal Google-Style UI & Collapsible Navigation Drawer** | ✅ Complete | Minimal full-width homepage layout, top-left hamburger menu trigger, collapsible overlay drawer with backdrop blur, keyboard navigation (Escape), and full access to all 9 navigation modules. | [Milestone #4](https://github.com/anveshax/Da-vinci-code---search-engine/milestone/4) |
| **Milestone 5: AST Ingestion, Codebase Intelligence & Dependency Graph** | 🔄 In Progress | Multi-language AST parsing, symbol hierarchy indexing, interactive node-edge dependency graph visualization, and Git diff change-impact inspector. | [Milestone #5](https://github.com/anveshax/Da-vinci-code---search-engine/milestone/5) |
| **Milestone 6: Voice Assistant & Multimodal Conversational Interface** | 📋 Planned | Voice query interaction, Gemini Live API audio streaming, text-to-speech feedback, and voice-assisted exploration. | [Milestone #6](https://github.com/anveshax/Da-vinci-code---search-engine/milestone/6) |
| **Milestone 7: Autonomous Agentic Workflows & Multi-Engine Extensions** | 📋 Planned | Plugin runtime ecosystem, external tool integrations, autonomous agent collaboration workflows, automated code verification, and security auditing. | [Milestone #7](https://github.com/anveshax/Da-vinci-code---search-engine/milestone/7) |
