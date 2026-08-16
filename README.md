# Sipi Rider

A ride-hailing platform that connects travelers with verified taxi-association drivers in East Africa (Uganda & Kenya). The product centers on trust: drivers belong to known SACCOs/taxi associations, are verified by admins, and riders verify their phone numbers with their mobile operator (MTN Uganda / Safaricom Kenya) before booking.

## Monorepo layout

This repository is a monorepo with three apps plus a documentation folder:

```
My_rider/
├── frontend/        # SipiRider rider mobile/web app (SvelteKit + Tailwind + Capacitor)
├── admin/           # SipiRider Admin Console (SvelteKit + Tailwind)
├── backend/         # Backend API + database (TypeScript/Express)
└── docs/            # Architecture & per-system documentation
```

| Directory | What it is | Stack | Talks to |
|---|---|---|---|
| `frontend/` | Rider app — book rides, chat, driver dashboard | SvelteKit 5 (static SPA), Tailwind v4, Capacitor 8, PWA | `backend/` REST API (`:8080`) |
| `admin/` | Admin console — users, drivers, pricing | SvelteKit 5 (static SPA), Tailwind v4 | `backend/` REST API (`:8080`) |
| `backend/` | REST API + SQLite database | TypeScript/Express + better-sqlite3 | MTN & Safaricom APIs, Gmail SMTP |

## Quick start

### 1. Backend

```sh
cd backend
npm install
npm run dev        # tsx watch src/index.ts  →  http://localhost:8080
```

On first boot it creates/opens `sipi.db` and seeds demo users, vehicle classes, pricing, drivers, rides and messages. Copy `.env.example` to `.env` and fill in SMTP / MTN / Daraja credentials to enable real email + phone verification (defaults keep `PHONE_MOCK=true` so no external calls are made in dev).

### 2. Frontend (rider app)

```sh
cd frontend
npm install
npm run dev        # vite dev  →  http://localhost:5173
```

Set `VITE_API_BASE_URL` if the backend is not on `http://localhost:8080`. `VITE_GOOGLE_MAPS_API_KEY` is used for the map screens.

### 3. Admin console

```sh
cd admin
npm install
npm run dev        # vite dev  →  http://localhost:5174
```

The backend builds email-verification links against `PUBLIC_BASE_URL` (default `http://localhost:5174`, i.e. the admin dev server).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview, component & flow diagrams
- [docs/frontend.md](docs/frontend.md) — rider app
- [docs/admin.md](docs/admin.md) — admin console
- [docs/backend.md](docs/backend.md) — backend API, data model, integrations

## Scripts

Each app uses plain Vite/SvelteKit/tsx scripts (no workspaces tooling):

- **frontend:** `npm run dev`, `npm run build`, `npm run preview`, `npm run check`
- **admin:** `npm run dev`, `npm run build`, `npm run preview`, `npm run check`
- **backend:** `npm run dev` (watch), `npm start`, `npm run build`, `npm run typecheck`
