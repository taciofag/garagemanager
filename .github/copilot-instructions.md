# Copilot Instructions for Garage Manager

## Project Overview
- **Purpose:** Manage auction car sales, rentals, and financial flows for a garage business.
- **Architecture:**
  - **Backend:** Python 3.11, FastAPI, SQLAlchemy, Pydantic, Alembic, Uvicorn
    - `app/routers/`: FastAPI endpoints (REST API)
    - `app/repositories/`: Data persistence (SQLAlchemy)
    - `app/services/`: Business logic (billing, summary, security)
    - `app/schemas/`: Pydantic models for request/response
    - `app/models/`: SQLAlchemy ORM models
    - `app/seed.py`: Initial data loader (frota, drivers, expenses, rentals, capital)
    - `uploads/`: Document storage (configurable via `UPLOADS_DIR`)
  - **Frontend:** React 18, Vite, TypeScript, React Query, TailwindCSS
    - `frontend/src/api/`: Axios REST client
    - `frontend/src/components/`: UI widgets, tables, DocumentManager
    - `frontend/src/context/`: AuthContext (JWT)
    - `frontend/src/pages/`: Main screens (dashboard, vehicles, rentals, etc.)

## Developer Workflows
- **Backend Setup:**
  - Create venv, install requirements, run Alembic migrations, start Uvicorn:
    ```powershell
    python -m venv .venv ; .venv\Scripts\activate ; pip install -r requirements.txt ; alembic upgrade head ; uvicorn app.main:app --reload
    ```
  - Seed example data:
    ```powershell
    python -m app.seed
    ```
- **Testing:**
  - Run all backend tests (pytest, async):
    ```powershell
    pytest --asyncio-mode=auto
    ```
- **Docker:**
  - Build and run all services:
    ```powershell
    docker-compose up --build
    ```
  - Scheduler calls `/billing/run` daily at 08:00 UTC.
  - For Postgres, set `DATABASE_URL` as described in `README.md`.
- **Frontend Setup:**
  - Install and run dev server:
    ```powershell
    cd frontend ; npm install ; npm run dev
    ```
  - Production build:
    ```powershell
    npm run build ; npm run preview
    ```
  - Set `VITE_API_BASE_URL` for API endpoint in production.

## Patterns & Conventions
- **CRUD:** All main entities (vehicles, drivers, rentals, expenses, capital, cash, billing) have full CRUD via REST endpoints and React forms.
- **Auth:** JWT-based, with admin/user scopes. Use `AuthContext` in frontend for login state.
- **Uploads:** Documents for vehicles, drivers, rentals are managed via `/documents` endpoints and stored in `uploads/`.
- **Testing:** Backend tests cover models, repositories, and main routes. SQLite in-memory for tests.
- **Financial Metrics:** `/summary` endpoints and React dashboard provide ROI, profit per vehicle, and other metrics.
- **Scheduler:** Automated weekly billing via `/billing/run` and Docker scheduler.

## Integration Points
- **API Docs:** Swagger at `/docs` (http://localhost:8000/docs)
- **Frontend-Backend:** Frontend proxies API requests to `/api` (see Vite config).
- **External DB:** SQLite by default, Postgres supported via Docker and env vars.

## Examples
- To add a new entity, create SQLAlchemy model, Pydantic schema, repository, router, and React page/form.
- For document uploads, use `/documents` endpoints and update `DocumentManager` in frontend.
- For new financial metrics, extend `services/summary.py` and corresponding frontend dashboard components.

---
_Last updated: 2025-09-29_
