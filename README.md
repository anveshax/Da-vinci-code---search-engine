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

## Milestone Roadmap

- [x] **Milestone 1**: Application Shell & Live Telemetry Connectivity
- [ ] **Milestone 2**: AST Ingestion & Symbol Hierarchy Parser
- [ ] **Milestone 3**: Interactive Node-Edge Dependency Graph
- [ ] **Milestone 4**: Change-Impact Analysis & Git Diff Inspector
- [ ] **Milestone 5**: Voice Assistant Interface
