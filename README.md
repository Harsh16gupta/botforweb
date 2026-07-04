# botforweb SaaS

A multi-tenant Documentation Chatbot SaaS application. This platform allows software organizations to upload documentation files (.pdf, .md, .zip) and serve a secure, context-aware chatbot widget for their developers or clients.

The system enforces strict data isolation between tenants at the database layer (PostgreSQL Row-Level Security) and the vector store layer (isolated Qdrant collections).

---

## Architecture and Technology Stack

### 1. Backend (FastAPI)
* **API Framework**: FastAPI with Python 3.12+ (compatible up to Python 3.14).
* **Database**: PostgreSQL with Row-Level Security (RLS) policies.
* **ORM**: SQLAlchemy 2.0 (asyncio extension) with asyncpg driver.
* **Vector DB**: Qdrant (dynamic client utilizing fast dense/sparse hybrid search).
* **Reranking**: Cohere Rerank (rerank-english-v3.0).
* **Generation**: DeepSeek Chat (deepseek-chat) LLM completions.
* **Task Queue**: Celery with Redis for asynchronous file ingestion.
* **Observability**: OpenTelemetry middleware and Langfuse SDK integration for token tracking, latency, and costs.
* **Real-time Guardrails**: Confidence Scorer and LLM-as-a-judge Hallucination Guard.

### 2. Frontend (Vite + React)
* **Core**: React 18, TypeScript, and Vite.
* **Styling**: Vanilla CSS for flexibility and glassmorphic premium UI elements.
* **Services**: Modular API client (ApiService) decoupled from UI components.

### 3. Infrastructure
* **Services**: Managed via Docker Compose (PostgreSQL, Qdrant, Redis, Jaeger).

---

## Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── api.py           # Registers the v1 API routes
│   │   │       └── endpoints/
│   │   │           ├── auth.py      # Endpoints for user/organization signup and login
│   │   │           ├── chat.py      # RAG query, conversation management, and history endpoints
│   │   │           └── documents.py # Document upload, delete, and list endpoints
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic settings loading env variables
│   │   │   ├── context.py           # Thread-local tenant context
│   │   │   ├── database.py          # SQLAlchemy engine, session maker, and RLS initialization
│   │   │   ├── observability.py     # OpenTelemetry and Langfuse tracing initialization
│   │   │   └── security.py          # JWT, password hashing, and authentication dependencies
│   │   ├── models/
│   │   │   └── models.py            # SQLAlchemy Database Models (Organization, User, Document, etc.)
│   │   ├── schemas/
│   │   │   ├── auth.py              # Pydantic schemas for authentication
│   │   │   ├── chat.py              # Pydantic schemas for chat requests and responses
│   │   │   └── document.py          # Pydantic schemas for documents
│   │   ├── services/
│   │   │   ├── ingestion/
│   │   │   │   ├── manager.py       # Manages file routing, parsing, and collection ingestion
│   │   │   │   ├── markdown.py      # Parses markdown and ZIP files with frontmatter cleaning
│   │   │   │   ├── pdf.py           # Extracts text from PDFs using pypdf
│   │   │   │   └── splitter.py      # Custom recursive character splitter
│   │   │   ├── reranker.py          # Integrates Cohere Rerank API
│   │   │   └── vector_db.py         # Manages Qdrant client, isolated collections, and hybrid search
│   │   └── workers/
│   │       ├── celery_app.py        # Celery application configuration
│   │       └── tasks.py             # Celery background tasks for asynchronous ingestion
│   ├── scripts/
│   │   └── test_rag.py              # E2E Smoke testing script
│   └── tests/
│       ├── conftest.py              # Pytest fixtures and test database setup (SQLite)
│       ├── eval_dataset.json        # 50 QA dataset pairs for RAG quality audit
│       ├── test_api.py              # Integrations tests for signup, login, upload, and mock RAG query
│       ├── test_async.py            # Asynchronous ingestion testing
│       ├── test_eval.py             # RAG Automated Quality Evaluation Suite
│       └── test_rls.py              # Tests Row-Level Security tenant context resolution
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ApiKeys/
│   │   │   │   └── ApiKeyManager.tsx    # Clipboard copy of organization API keys
│   │   │   ├── Auth/
│   │   │   │   └── AuthCard.tsx         # Tabbed authentication layout for login and signup
│   │   │   ├── Chat/
│   │   │   │   └── ChatSandbox.tsx      # RAG query testbed highlighting confidence and faithfulness
│   │   │   ├── Dashboard/
│   │   │   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   │   │   └── StatsCards.tsx       # KPI summaries
│   │   │   └── Documents/
│   │   │       └── DocumentManager.tsx  # Drag-and-drop document uploader with ingestion status updates
│   │   ├── services/
│   │   │   └── api.ts               # Decoupled api.ts client handling all backend requests
│   │   ├── App.tsx                  # Root component orchestration tabs and state
│   │   ├── App.css
│   │   ├── index.css                # Premium vanilla CSS styling guide
│   │   └── main.tsx
│   └── tsconfig.json
└── docker-compose.yml
```

---

## Local Setup and Installation

### Prerequisites
* Docker and Docker Compose installed.
* Python 3.12+ installed.
* Node.js 18+ and npm installed.

### Step 1: Start Infrastructure Services
From the project root directory, launch PostgreSQL, Qdrant, Redis, and Jaeger:
```bash
docker compose up -d
```

### Step 2: Configure and Launch Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory with the following variables (update with your API keys):
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@localhost:5432/botforweb
   REDIS_URL=redis://localhost:6379/0
   QDRANT_URL=http://localhost:6333
   DEEPSEEK_API_KEY=your_deepseek_api_key
   COHERE_API_KEY=your_cohere_api_key
   JWT_SECRET_KEY=generate_a_secure_random_key_here

   # Observability Settings (Optional)
   ENABLE_OBSERVABILITY=true
   JAEGER_OTLP_ENDPOINT=http://localhost:4317
   LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
   LANGFUSE_SECRET_KEY=your_langfuse_secret_key
   LANGFUSE_HOST=https://cloud.langfuse.com
   ```
5. Apply database table initialization and run FastAPI:
   ```bash
   PYTHONPATH=. ./venv/bin/uvicorn app.main:app --port 8000 --reload
   ```
   Note: The database tables and Row-Level Security (RLS) policies are automatically initialized during the FastAPI app startup lifecycle hook.

### Step 3: Run the Celery Worker
Keep the FastAPI server running and open a new terminal window to start the Celery worker process:
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. ./venv/bin/celery -A app.workers.celery_app worker --loglevel=info
```

### Step 4: Configure and Launch Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev -- --port 3001
   ```
4. Open your browser and navigate to `http://localhost:3001` to access the Admin Console.

---

## Real-Time Guardrails and Observability

### 1. Confidence Scorer
When a query is received, the retrieved context chunks are scored by Qdrant and Cohere Rerank. If the maximum similarity/rerank score is below 0.6, a disclaimer is automatically appended to the response: *"I am not highly confident in this answer because it's not well-documented."*

### 2. Hallucination Guard (Faithfulness Check)
Before returning the generated answer, an LLM-as-a-judge fact-checker assesses the answer against the retrieved context to calculate a faithfulness score. If the score is below 0.7, a warning is prepended to the answer warning the user that it may contain unsupported details.

### 3. OpenTelemetry and Langfuse
* **OpenTelemetry**: Tracks incoming FastAPI requests and logs spans to a local Jaeger instance (accessible at `http://localhost:16686`).
* **Langfuse**: Traces LLM calls, costs, latency, and prompt/generation tokens.

---

## Verification and Testing

### Running Unit and Integration Tests
To verify database isolation policies, API controllers, security credentials, and asynchronous tasks, run pytest inside the virtual environment:
```bash
cd backend
PYTHONPATH=. ./venv/bin/pytest
```

### Running the RAG Quality Evaluation Suite
To audit RAG accuracy metrics (Faithfulness and Answer Relevance) against a QA dataset of 50 test cases, run:
```bash
cd backend
PYTHONPATH=. ./venv/bin/pytest tests/test_eval.py -s
```
If DeepSeek credentials are not set, it gracefully defaults to mock evaluation scoring.

### Running the E2E Smoke Test
To verify the complete ingestion queue flow, polling endpoints, and chatbot response citations against a running backend, run:
```bash
cd backend
PYTHONPATH=. ./venv/bin/python scripts/test_rag.py
```
This script signs up a dummy organization user, uploads a markdown file, waits for Celery task completion, queries the chatbot, verifies sources, and cleans up database/vector points.
