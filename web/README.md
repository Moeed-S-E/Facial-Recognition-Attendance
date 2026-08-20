# Web Client

The web client is a React application for organization owners, HR users, managers, and employees. It provides the local attendance dashboard, account directory, facial enrollment and verification screens, leave workflows, analytics, and notifications.

## Technologies

- React 18
- Vite
- Tailwind CSS
- Vitest

## Local setup

```bash
cd web
pnpm install
pnpm dev
```

The client runs at `http://localhost:5173` and connects to the local backend at `http://localhost:8000` by default.

## Environment

Copy `.env.example` to `.env.local` when custom values are needed:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the FastAPI server |
| `VITE_NOTIFICATION_WS_URL` | WebSocket URL for realtime notifications |

## Tests and build

```bash
pnpm test -- --run
pnpm build
```

## Application structure

- `src/screens/` contains the main pages.
- `src/components/` contains reusable interface components.
- `src/context/` contains authentication, attendance, and notification state.
- `src/lib/` contains API, offline storage, and formatting helpers.
