# Facial Recognition Attendance

Facial Recognition Attendance is an open-source attendance application for organizations that want a local, self-hosted workflow for employee accounts, facial verification, attendance records, leave management, team visibility, and realtime notifications.

The project is designed for local development and self-hosted use. It runs with the included application services and keeps organization workflows under the operator's control.

## Stack

| Component | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, SQLite/PostgreSQL, WebSockets |
| Web client | React, Vite, Tailwind CSS |
| Mobile client | Flutter |
| Face recognition | FaceNet/PyTorch and ChromaDB |

## Features

- Organization and employee account management with role-based access.
- Facial enrollment and attendance verification.
- Attendance history, check-in/check-out, leave requests, and team views.
- Local persistence with SQLite by default and optional PostgreSQL support.
- Realtime notifications through a WebSocket endpoint.
- Consent-aware attendance evidence handling with local-only retention by default.

## Repository layout

```text
backend/   FastAPI API, database models, face recognition, and tests
web/       React/Vite browser application
mobile/    Flutter mobile application
scripts/   Local helper scripts
```

## Run locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`. The default database is local SQLite, so no external service is required for a basic start.

### Web client

```bash
cd web
pnpm install
pnpm dev
```

The web application runs at `http://localhost:5173` and uses `http://localhost:8000` as the default API base URL.

### Mobile client

```bash
cd mobile
flutter pub get
flutter run
```

Use the mobile README for Flutter-specific platform setup and device commands.

## Demo data

To create the sample organization and local demo accounts, run:

```bash
cd backend
python -m app.seed
```

The seed script creates sample organization, team, user, leave, and attendance records for local testing.

## Tests

Run backend tests with:

```bash
cd backend
pytest
```

Run web checks with:

```bash
cd web
pnpm test -- --run
pnpm build
```

## Contributing

Contributions are welcome. Please open an issue for substantial changes before submitting a pull request, keep changes focused, and include relevant tests.

## License

This project is released under the MIT License. See [LICENSE](./LICENSE).

## Privacy note

Facial recognition can be inaccurate and may be regulated depending on location and use. Review applicable requirements, provide an appropriate non-biometric alternative, and do not use attendance or recognition results as the sole basis for consequential employment decisions.
