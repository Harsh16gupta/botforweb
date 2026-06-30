# botforweb SaaS

A multi-tenant Documentation Chatbot SaaS application. This platform allows software organizations to upload documentation files (.pdf, .md, .zip) and serve a secure, context-aware chatbot widget for their developers or clients.

The system enforces strict data isolation between tenants at the database layer (PostgreSQL Row-Level Security) and the vector store layer (isolated Qdrant collections).

---

## Architecture & Technology Stack

### 1. Backend (FastAPI)
* **API Framework**: FastAPI with Python 3.12+ (compatible up to Python 3.14).
* **Database**: PostgreSQL with Row-Level Security (RLS) policies.
* **ORM**: SQLAlchemy 2.0 (asyncio extension) with asyncpg driver.
* **Vector DB**: Qdrant (dynamic client utilizing fast dense/sparse hybrid search).
* **Reranking**: Cohere Rerank (`rerank-english-v3.0`).
* **Generation**: DeepSeek Chat (`deepseek-chat`) LLM completions.
* **Task Queue**: Celery with Redis for asynchronous file ingestion.

### 2. Frontend (Vite + React)
* **Core**: React 18, TypeScript, and Vite.
* **Styling**: Vanilla CSS for flexibility and glassmorphic premium UI elements.
* **Services**: Modular API client decoupled from UI components.

### 3. Infrastructure
* **Services**: Managed via Docker Compose (PostgreSQL, Qdrant, Redis).

---

## Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── api/             # API Router endpoints (Auth, Docs, Chat)
│   │   ├── core/            # Config, Security, Database context, RLS utils
│   │   ├── models/          # SQLAlchemy Database Models
│   │   ├── schemas/         # Pydantic validation schemas
│   │   ├── services/        # RAG pipeline logic (vector DB, Cohere, DeepSeek)
│   │   └── workers/         # Celery application & asynchronous worker tasks
│   ├── scripts/             # E2E Smoke testing scripts
│   └── tests/               # pytest suites (RLS checks, API endpoints, Celery)
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (Auth, Dashboard Sidebar, Chat, etc.)
│   │   ├── services/        # Centralized ApiService wrapper (api.ts)
│   │   ├── App.tsx          # Main controller orchestrating tabs & local state
│   │   └── index.css        # Vanilla CSS style guide (dark mode variables)
└── docker-compose.yml       # Infrastructure orchestration file (Postgres, Qdrant, Redis)
```

---

## Local Setup & Installation

### Prerequisites
* Docker and Docker Compose installed.
* Python 3.12+ installed.
* Node.js 18+ and npm installed.

### Step 1: Start Infrastructure Services
From the project root directory, launch Postgres, Qdrant, and Redis:
```bash
docker compose up -d
```

### Step 2: Configure & Launch Backend
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
4. Create a `.env` file in the `backend/` directory with the following variables:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/botforweb
   REDIS_URL=redis://localhost:6379/0
   QDRANT_URL=http://localhost:6333
   DEEPSEEK_API_KEY=your_deepseek_api_key
   COHERE_API_KEY=your_cohere_api_key
   JWT_SECRET_KEY=generate_a_secure_random_key_here
   ```
5. Apply database table initialization and run FastAPI:
   ```bash
   PYTHONPATH=. ./venv/bin/uvicorn app.main:app --port 8000 --reload
   ```

### Step 3: Run the Celery Worker
Keep the FastAPI server running and open a new terminal window to start the Celery worker process:
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. ./venv/bin/celery -A app.workers.celery_app worker --loglevel=info
```

### Step 4: Configure & Launch Frontend
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

## Verification & Testing

### Running Unit/Integration Tests
You can verify the database isolation policies and API controllers inside the virtual environment:
```bash
cd backend
pytest
```

### Running the E2E Smoke Test
To verify the complete ingestion queue flow, polling endpoints, and chatbot response citations against the real running backend, run:
```bash
cd backend
./venv/bin/python scripts/test_rag.py
```
This script signs up a dummy organization user, uploads CLI documentation, waits for Celery task completion, runs RAG queries, verifies source output, and cleans up database/vector points.
