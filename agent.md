# AI Agent Onboarding & Development Guide

Welcome! If you are an AI coding agent tasked with developing, updating, or debugging this codebase, read this guide first. It ensures architectural consistency, security, and high code quality.

---

## How to Onboard Yourself (First Steps)
1. **Read the plan**: Read [plan.md](file:///home/harsh-gupta/Projects/botforweb/plan.md) to understand the current milestone, folder structure, and next steps.
2. **Inspect the Files**: Use `list_dir` on the project root to map out the current state.
3. **Run existing tests**: Run `pytest` inside the `backend` folder to ensure everything compiles and passes before you make changes.

---

## Codebase Architecture & Design Rules

### 1. Zero-Leakage Multi-Tenancy (CRITICAL)
This is a commercial SaaS. Data isolation between customers is our highest priority:
- **Database**: Every SQL query touching users, documents, conversations, or messages must filter by `organization_id`. We will enable PostgreSQL Row-Level Security (RLS) in Week 3.
- **Vector DB**: Each organization has an isolated Qdrant collection named `org_docs_{organization_id}`. Never mix tenant data in a single collection.

### 2. Hybrid RAG Pipeline
- **Dense Vectors**: 384 dimensions (`BAAI/bge-small-en-v1.5`), Cosine distance.
- **Sparse Vectors**: SPLADE token representations (`prithivida/Splade_PP_en_v1`).
- **Reranker**: Cohere Rerank (`rerank-english-v3.0`). Always limit context sent to LLMs (default `top_n = 3`).
- **Generation**: DeepSeek Chat completions (`deepseek-chat`).

### 3. Graceful Fallbacks (Mock Mode)
- External API keys (DeepSeek, Cohere, Stripe) may not be configured in local developer environments.
- **Rule**: Code must never crash due to missing keys. Always write graceful mocks/fallbacks. If keys are missing, log warnings and return sensible mock data.

### 4. Code Simplicity & Readability
- Keep code clean and self-contained. Avoid over-engineering.
- Write docstrings and type annotations for all new modules, routes, and functions.
- **No Emojis Rule**: Never add emojis to the codebase, including inline comments, docstrings, print statements, or documentation markdown files. Maintain a strictly professional style.
- **Commit Naming Rule**: Keep Git commit messages simple, concise, and descriptive (e.g., `feat: ...`, `fix: ...`, `style: ...`, `test: ...`).

### 5. Modular Frontend Architecture (No Monoliths)
- **Component Decomposition**: Never build monolithic views (e.g., writing all components, state, and fetch logic in a single `App.tsx` file). Break the UI down into small, single-responsibility components under `src/components/`.
- **API Service Layer**: Keep UI components decoupled from data fetching. Encapsulate all backend HTTP calls inside a dedicated API service class/helper (`src/services/api.ts`) and export a typed client instance.

---

## Verification and Testing Rules
- Do not mark tasks completed until you have verified them.
- **Write tests first or concurrently**: For every new API endpoint or backend service, add a corresponding test in `backend/tests/`.
- **Run E2E smoke tests**: After major API updates, launch the server and run:
  ```bash
  python backend/scripts/test_rag.py
  ```
  Ensure it completes with code `0`.
