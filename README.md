# VIN-matrix

VIN-matrix is a Django + React CRM for automotive service and parts workflows: visits/orders, inventory, payments, CRM reminders, analytics, and integrations.

## Quick start with Docker

1. Copy environment defaults:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set a unique `SECRET_KEY`, database password, host names, CORS, and CSRF origins.
3. Build and run the full stack:
   ```bash
   docker compose up --build
   ```
4. Open the app at `http://localhost`.
5. Optional demo account/data:
   ```bash
   docker compose exec backend python manage.py seed_demo
   ```
   Demo login: `demo` / `demo12345`.

## Services

`docker-compose.yml` runs:

- `db` — PostgreSQL 15 with a healthcheck and `/backups` mount.
- `backend` — Django served by Gunicorn.
- `frontend` — Vite build served by Nginx.
- `nginx` — edge reverse proxy for frontend, `/api/`, `/admin/`, `/docs/`, `/schema/`, static and media routes.

## Local backend development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DEBUG=True SECRET_KEY=dev-only python manage.py migrate
DEBUG=True SECRET_KEY=dev-only python manage.py seed_demo
DEBUG=True SECRET_KEY=dev-only python manage.py runserver
```

## Local frontend development

```bash
cd frontend
npm ci
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` when the API is not reachable through the same origin.

## Security defaults

Production defaults are intentionally strict:

- `DEBUG=False` unless explicitly enabled.
- `SECRET_KEY` is required when `DEBUG=False`.
- `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and `CORS_ALLOWED_ORIGINS` are environment-driven allowlists.
- CORS no longer allows every origin by default.

## API documentation

Swagger UI is available at `/docs/`; the raw OpenAPI schema is available at `/schema/`.

## Tests and CI

Backend smoke tests cover JWT auth, visits, payments, and inventory:

```bash
cd backend
python manage.py test apps.core.tests
```

Frontend build validation:

```bash
cd frontend
npm run build
```

GitHub Actions runs both jobs on push and pull requests.

## Production operations

- Run Django with Gunicorn behind the included Nginx reverse proxy.
- Ship container stdout/stderr to your platform log collector.
- Keep `DEBUG=False` and use real host/CORS/CSRF allowlists.
- Back up PostgreSQL regularly, for example:
  ```bash
  docker compose exec db pg_dump -U "$DB_USER" "$DB_NAME" > backups/vin_matrix_$(date +%F).sql
  ```
- Restore drill example:
  ```bash
  docker compose exec -T db psql -U "$DB_USER" "$DB_NAME" < backups/vin_matrix_YYYY-MM-DD.sql
  ```
- Monitor HTTP 5xx rate, Gunicorn restarts, DB disk usage, backup freshness, and application error logs.
