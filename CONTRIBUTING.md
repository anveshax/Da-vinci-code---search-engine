# Contributing to ANVESHA

Thank you for your interest in contributing to **ANVESHA (Codebase Intelligence Engine & Universal AI Search Platform)**! We welcome contributions from developers, researchers, and open-source enthusiasts.

---

## Code of Conduct

Please read and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) in all project interactions.

---

## Development Setup

### Prerequisites
* **Node.js**: >= 18.0.0
* **Python**: 3.12+
* **Git**: Installed and configured

### 1. Clone the Repository
```bash
git clone https://github.com/anveshax/Da-vinci-code---search-engine.git
cd Da-vinci-code---search-engine
```

### 2. Backend Setup (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 3. Frontend Setup (React 18 + Vite)
```bash
cd frontend
npm install
npm run dev
```
Dashboard: [http://localhost:5173](http://localhost:5173)

---

## Branching & Commit Guidelines

1. **Branch Naming**:
   - `feat/feature-name` for new features
   - `fix/bug-description` for bug fixes
   - `docs/documentation-update` for docs
   - `refactor/scope` for refactoring

2. **Commit Messages**:
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(scope): add new capability`
   - `fix(scope): resolve issue`
   - `docs(scope): update documentation`
   - `test(scope): add verification tests`

---

## Verification & Testing

Before submitting a Pull Request, always verify all automated test suites pass:

```bash
# 1. Frontend Production Build & TypeScript check
cd frontend && npm run build

# 2. 3D Globe Verification Suite
node scripts/verify-globe-implementation.mjs
node scripts/verify-globe-v3.mjs

# 3. Minimal Navigation Drawer Verification Suite
node scripts/verify-sidebar-drawer.mjs
```

---

## Submitting Pull Requests

1. Fork the repo and create your branch from `main`.
2. Ensure all tests and builds pass cleanly.
3. Open a Pull Request referencing any related issues or milestones.
4. Provide a clear description and screenshots of UI changes.
