# Garage Manager

Sistema completo para controle de compra e venda de carros de leilao, gestao de alugueis e fluxo de caixa.

## Stack
- Backend: Python 3.11, FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic, Uvicorn
- Banco: SQLite (dev) com suporte a Postgres
- Auth: JWT com escopos admin/user
- Testes: pytest + httpx
- Frontend: React 18 + Vite + TypeScript + React Query + TailwindCSS
- DevOps: Dockerfile e docker-compose com scheduler diario
- Anexos: Upload de documentos (salvos em `uploads/` via API `/documents`)

## Backend - Como rodar
```bash
python -m venv .venv
.venv\Scripts\activate  # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Documentacao Swagger: http://localhost:8000/docs

### Seed
```bash
python -m app.seed
```
Gera frota de exemplo, motoristas, despesas, alugueis, cobrancas, capital e livro-caixa.

### Testes
```bash
pytest --asyncio-mode=auto
```
SQLite em memoria. Cobertura de modelos, repositorios e rotas principais.

### Docker
```bash
docker-compose up --build
```
- `api` em http://localhost:8000
- `scheduler` chama `/billing/run` diariamente as 08:00 UTC
- `db` (Postgres) opcional. Para usar, defina `DATABASE_URL=postgresql+asyncpg://garage:garage@db:5432/garage`

### Uploads de documentos
- Diretorio padrao: `uploads/` (configuravel via `UPLOADS_DIR`)
- Endpoints `/documents` permitem anexar, listar, baixar e excluir arquivos para veiculos, motoristas e alugueis.

## Frontend - Como rodar
```bash
cd frontend
npm install
npm run dev
```
Aplicacao acessivel em http://localhost:5173 (proxy para a API em `/api`).

### Build de producao
```bash
npm run build
npm run preview
```
Defina `VITE_API_BASE_URL` para apontar a API em producao.

## Credenciais padrao
- admin: `admin@garage.local`
- senha: `change-me`

## Estrutura do projeto
```
app/
  routers/        # Endpoints FastAPI
  repositories/   # Persistencia
  services/       # Regras de negocio (billing, summary, security)
  schemas/        # Pydantic (Create/Update/Read)
  models/         # ORM SQLAlchemy
  seed.py         # Carga inicial
uploads/           # Armazenamento de documentos
frontend/
  src/
    api/          # Cliente Axios e chamadas REST
    components/   # Layout, tabelas, widgets, DocumentManager
    context/      # AuthContext (JWT)
    pages/        # Telas (dashboard, veiculos, alugueis etc.)
```

## Checklist atendido
- CRUD completo para veiculos, motoristas, alugueis, despesas, capital, caixa e cobrancas
- Filtros, paginacao e ordenacao nas rotas
- Metricas de resumo financeiro com ROI e lucro por veiculo
- Geracao semanal automatica de cobrancas (`/billing/run` + scheduler Docker)
- Painel React com login JWT, dashboard, formularios e anexos de documentos
- Testes unitarios/integrais no backend e scripts de seed prontos
