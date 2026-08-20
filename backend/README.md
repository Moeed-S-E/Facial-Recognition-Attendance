# Backend API

The backend is a Python service built with **FastAPI**. It provides authentication, organization and account management, facial enrollment and verification, attendance records, leave workflows, analytics, and realtime notifications.

## Technologies

- Python 3.11+
- FastAPI and Pydantic
- SQLAlchemy with SQLite by default and PostgreSQL support
- PyTorch, FaceNet, and ChromaDB for facial recognition
- Pytest for automated checks

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`. The interactive API documentation is available at `/docs` while the server is running.

## Demo data

```bash
python -m app.seed
```

This creates local sample organization, team, user, leave, and attendance data for development and testing.

## Configuration

The application reads settings from `.env`. The most useful local settings are:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Database connection | Local SQLite database |
| `CORS_ALLOWED_ORIGINS` | Browser origins allowed to call the API | Local web client origins |
| `NOTIFICATIONS_ENABLED` | Enable realtime notifications | `true` |
| `ATTENDANCE_RETENTION_MODE` | Evidence retention policy | `local-only` |
| `JWT_SECRET` | Optional development JWT secret | Process-local development value |

## Tests

```bash
pytest
```
