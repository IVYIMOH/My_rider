# Sipi Rider — Architecture

This document describes how the Sipi Rider platform is structured and how data flows through it. It is a **line-by-line review** of the codebase in this repository, written to match what the code actually does today.

Related docs:

- [frontend.md](frontend.md) — the rider mobile/web app
- [admin.md](admin.md) — the admin console
- [backend.md](backend.md) — the backend API, data model, and integrations

---

## 1. System context

Sipi Rider connects three kinds of users:

- **Tourists / riders** — book a ride from the mobile app, chat with their driver, and view their ride history.
- **Drivers** — apply via the app, go online/offline, get assigned rides, and are verified by admins.
- **Admins** — manage pricing, verify drivers, and approve/suspend user accounts from the admin console.

```mermaid
flowchart LR
    subgraph "Clients"
        A["Rider App<br/><b>frontend/</b><br/>SvelteKit 5 · Capacitor · PWA"]
        C["Admin Console<br/><b>admin/</b><br/>SvelteKit 5 SPA"]
    end

    B["Backend API<br/><b>backend/</b><br/>Express (TypeScript)"]
    D[("SQLite<br/>sipi.db")]

    A -- "REST /api/*<br/>JWT bearer" --> B
    C -- "REST /api/*<br/>JWT bearer" --> B
    B --> D

    E["MTN Uganda<br/>Number Verification"] -. "phone check" .-> B
    F["Safaricom Daraja<br/>(Kenya)"] -. "phone check" .-> B
    G["Gmail SMTP<br/>(Nodemailer)"] -. "verification email" .-> B
    H["Google Maps JS API"] -. "maps" .-> A
```

Notes from the code review:

- Both web clients are **pure client-side SPAs** (`adapter-static` with `fallback: index.html`). There are no server-side load functions, hooks, or `+server.ts` routes anywhere — all data fetching happens in the browser.
- Both clients share the **same HTTP client pattern** (`$lib/http.ts`) and default `API_BASE` of `http://localhost:8080`.
- The **Express backend is the API both frontends are wired to**. Its endpoint contract matches the API client functions in `frontend/src/lib/api.ts` and `admin/src/lib/api.ts` exactly.
- A **second, older backend** also lives in `backend/` — a Go/Fiber port of a previous prototype. It is *not* what the frontends talk to and has an incompatible schema. See [backend.md](backend.md) §8.

---

## 2. Containers & deployment topology

```mermaid
flowchart TB
    subgraph "Mobile / Web"
        R["frontend/ (rider app)<br/>port 5173 (dev)<br/>static build → dist/ → Capacitor android/ ios/"]
        Adm["admin/ (console)<br/>port 5174 (dev)<br/>static build → dist/"]
    end

    subgraph "Backend host"
        API["backend/ Express API<br/>port 8080<br/>tsx src/index.ts"]
        DB[("sipi.db")]
        SMTP["Nodemailer → Gmail SMTP"]
        MTN["MTN Uganda verify API"]
        DARAJA["Safaricom Daraja API"]
    end

    R -- "fetch :8080/api/*" --> API
    Adm -- "fetch :8080/api/*" --> API
    API --> DB
    API --> SMTP
    API --> MTN
    API --> DARAJA

    style API fill:#f5f5f5
```

Key environment variables (`backend/.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP listen port |
| `DB_PATH` | `./sipi.db` | SQLite file |
| `JWT_SECRET` | dev default | HS256 signing secret |
| `PUBLIC_BASE_URL` | `http://localhost:5174` | Base URL for email verification links (admin app) |
| `VERIFY_TOKEN_TTL_MIN` | `60` | Verification token TTL |
| `SMTP_*` / `MAIL_FROM` | — | Gmail SMTP relay |
| `MTN_*` | — | MTN Uganda number verification |
| `DARAJA_*` | — | Safaricom (Kenya) number verification |
| `PHONE_MOCK` | `true` | Bypass operator verification in dev (must be `false` in prod) |

Client env vars:

| App | Variable | Default |
|---|---|---|
| frontend | `VITE_API_BASE_URL` | `http://localhost:8080` |
| frontend | `VITE_GOOGLE_MAPS_API_KEY` | (set in `.env`) |
| admin | `VITE_API_BASE_URL` | `http://localhost:8080` |

---

## 3. Component diagram (backend)

The Express backend is organized in the classic MVC style: routes → middleware → lib helpers → SQLite.

```mermaid
flowchart LR
    subgraph "Express app (src/app.ts)"
        subgraph "Routers"
            R1["auth<br/>src/routes/auth.ts"]
            R2["pricing<br/>src/routes/pricing.ts"]
            R3["rides<br/>src/routes/rides.ts"]
            R4["drivers<br/>src/routes/drivers.ts"]
            R5["profile<br/>src/routes/profile.ts"]
            R6["messages<br/>src/routes/messages.ts"]
            R7["admin<br/>src/routes/admin.ts"]
        end
        MW["middleware/auth.ts<br/>middleware/error.ts"]
    end

    subgraph "Lib (src/lib/)"
        L1["jwt.ts · password.ts<br/>tokens.ts · rateLimit.ts"]
        L2["mtn.ts · daraja.ts<br/>phone.ts"]
        L3["mailer.ts"]
        L4["fares.ts"]
    end

    subgraph "Data (src/db.ts)"
        D[(SQLite<br/>sipi.db)]
    end

    R1 --> MW
    R2 --> MW
    R3 --> MW
    R4 --> MW
    R5 --> MW
    R6 --> MW
    R7 --> MW

    R1 --> L1
    R1 --> L2
    R1 --> L3
    R3 --> L4
    R7 --> L4

    MW --> D
    R1 --> D
    R3 --> D
    R4 --> D
    R5 --> D
    R6 --> D
    R7 --> D
```

---

## 4. Identity & authentication

There are **two separate login paths** — one for riders (phone-first), one for admins (email-first). Both issue the same kind of HS256 JWT, validated by `backend/src/middleware/auth.ts` (`requireAuth`) and role-checked by `requireRole('admin' | 'driver')`.

```mermaid
flowchart LR
    subgraph "Rider path (phone-first)"
        P1["frontend<br/>PhoneLoginForm"] --> P2["POST /api/auth/phone-login"]
        P2 --> P3["Operator check<br/>MTN (UG) or Safaricom (KE)<br/>PHONE_MOCK in dev"]
        P3 --> P4["Find-or-create user<br/>role tourist/driver"]
        P4 --> P5["JWT issued → stored in<br/>localStorage sipi_rider_session"]
    end

    subgraph "Admin path (email-first)"
        A1["admin/ login page"] --> A2["POST /api/auth/login<br/>(or /register first)"]
        A2 --> A3["bcrypt password check<br/>blocks pending/suspended/unverified"]
        A3 --> A4["JWT issued → stored in<br/>localStorage sipi_admin_session"]
    end
```

**Registration + email verification (admin path):**

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant Admin as Admin app (5174)
    participant API as Express backend
    participant DB as SQLite
    participant SMTP as Gmail SMTP

    U->>Admin: Fill register form (role=admin)
    Admin->>API: POST /api/auth/register {name, email, password, role}
    API->>DB: insert users(status=active) + verification_tokens(hash, 60 min)
    API->>SMTP: send "verify your email" link (PUBLIC_BASE_URL?token=...)
    SMTP-->>U: email with token link
    U->>Admin: click link → /verify-email?token=...
    Admin->>API: GET /api/auth/verify-email?token=...
    API->>DB: validate + consume token, set email_verified=1
    API-->>Admin: success screen → "Log in"
    U->>Admin: login form
    Admin->>API: POST /api/auth/login
    API-->>Admin: { token, user } → goto /overview
```

**Phone verification (rider path):**

```mermaid
sequenceDiagram
    participant U as Rider (app)
    participant App as frontend (5173)
    participant API as Express backend
    participant OP as MTN / Daraja API
    participant DB as SQLite

    U->>App: enter +256 / +254 number
    App->>API: POST /api/auth/phone-login {phone, role}
    API->>API: rate limit (10/hr per phone)
    API->>OP: verify operator number (skipped if PHONE_MOCK)
    OP-->>API: verified
    API->>DB: find user by phone; create (role=tourist/driver) if new
    API-->>App: { token, user } → saved to localStorage
```

---

## 5. Ride lifecycle

The core business flow — a **ride** goes from `searching` → `active` → `completed` (or `cancelled`). Rider books, drivers see available rides and accept, the assigned driver completes it.

```mermaid
stateDiagram-v2
    [*] --> searching : rider POST /api/rides
    searching --> active : driver POST /api/rides/:id/accept
    active --> completed : driver POST /api/rides/:id/complete
    searching --> cancelled : rider POST /api/rides/:id/cancel
    active --> cancelled : rider POST /api/rides/:id/cancel
    completed --> [*]
    cancelled --> [*]
```

```mermaid
sequenceDiagram
    participant R as Rider (frontend)
    participant D as Driver (frontend)
    participant A as Backend API
    participant DB as SQLite

    Note over R,A: Fare quote (before login)
    R->>A: GET /api/pricing
    A-->>R: pricing config + vehicle classes
    R->>R: compute fare locally (fares.ts formula)

    Note over R,A: Ride request
    R->>A: POST /api/auth/phone-login (if no session)
    A-->>R: JWT
    R->>A: POST /api/rides {vehicleClassId, pickup, destination, ...}
    A->>DB: insert rides(status=searching)
    A-->>R: ride created → "Ride requested!"

    Note over D,A: Driver dispatch
    D->>A: GET /api/rides/available (role=driver)
    A-->>D: rides in searching state
    D->>A: POST /api/rides/:id/accept
    A->>DB: update status=active
    D->>A: POST /api/rides/:id/complete
    A->>DB: update status=completed
```

**Fare formula** (`backend/src/lib/fares.ts`):

```
fare = (base_fare + per_km × distance_km + per_minute × duration_min)
       × vehicle_class.multiplier
       × booking_fee
       × surge_multiplier
fare = max(fare, minimum_fare)
```

---

## 6. Driver onboarding & verification

```mermaid
sequenceDiagram
    participant D as Driver (frontend)
    participant API as Backend
    participant AD as Admin console
    participant DB as SQLite

    D->>API: POST /api/auth/phone-login (role=driver)
    API-->>D: JWT
    D->>API: POST /api/drivers/onboarding {fullName, phone, association, vehicleClassId}
    API->>DB: create/update drivers row (verified=0, pending)
    API-->>D: done → /driver dashboard

    Note over AD: Admin review
    AD->>API: GET /api/admin/drivers
    API-->>AD: drivers with verified flags
    AD->>API: PATCH /api/admin/drivers/:id {verified: true}
    API->>DB: verified=1
    AD-->>AD: driver now shows "Verified" badge
```

---

## 7. Messaging

Conversations are pairwise (`user_a`, `user_b`) and created on demand. This is a simple REST message inbox — there is **no websocket/push layer** in the codebase.

```mermaid
flowchart LR
    subgraph "Messages API (src/routes/messages.ts)"
        M1["GET /api/messages<br/>conversations w/ partner + last msg"]
        M2["POST /api/messages<br/>start or reuse conversation"]
        M3["GET /api/messages/:id<br/>thread (participants only)"]
        M4["POST /api/messages/:id<br/>send message"]
    end

    M1 --> C[(conversations)]
    M2 --> C
    M3 --> C
    M4 --> C
    C --> MSG[(messages)]
```

---

## 8. Admin operations

The admin console is the source of truth for **pricing**, **driver verification**, and **user moderation**.

| Concern | Read | Write |
|---|---|---|
| Pricing | `GET /api/admin/pricing` | `PUT /api/admin/pricing` |
| Driver verification | `GET /api/admin/drivers` | `PATCH /api/admin/drivers/:id` |
| User moderation | `GET /api/admin/users` | `PATCH /api/admin/users/:id` |

Admin flows, route-by-route, are documented in [admin.md](admin.md). Public pricing reads mirror these via `GET /api/pricing` and `GET /api/vehicle-classes`.

---

## 9. The Go/Fiber prototype (secondary backend)

`backend/cmd/` and `backend/internal/` contain a **Go port of a previous prototype** that predates the Express backend. Review findings:

- Framework: **Fiber v2**, JWT (`golang-jwt`), SQLite (`mattn/go-sqlite3`, CGO), UUIDs.
- Identity: **phone + OTP** with roles `citizen` / `driver` (no email/password, no admin).
- Domain: **bookings** (`pending → confirmed → declined → completed`), SOS alerts, ratings, and shareable trip links (`GET /api/trips/share/:token`).
- SMS: console-only stub (`services/sms.go` logs instead of sending).
- Routes are wired in `cmd/server/main.go` and mirror the Express feature set (drivers, bookings, auth) under a different contract.

```mermaid
flowchart TB
    subgraph "Go backend (cmd/server + internal/)"
        G1["config.Load()"] --> G2["database.Connect()<br/>(embedded 001_init.up.sql)"]
        G2 --> G3["services: Auth · Booking · Driver · Rating · SMS"]
        G3 --> G4["handlers: auth · booking · driver · driver_signup · rating · sos"]
        G4 --> G5["Fiber app :8080"]
    end
```

> **Important operational warning:** both backends default to port `8080` and `DB_PATH=./sipi.db`, but the Go schema (`users` keyed by `phone`, `bookings`, `otp_codes`) is **incompatible** with the Express schema (`users` keyed by `id` with `password_hash`, `rides`, `pricing`, `messages`). The on-disk `sipi.db` currently holds the Express/legacy shape. **Run only one backend against a database at a time** — see [backend.md](backend.md) §8 for the full comparison.

---

## 10. Cross-cutting concerns

- **State management:** each client keeps exactly one Svelte store — `session` (a JWT + user object) in `frontend/src/lib/auth.ts` and `admin/src/lib/auth.ts`. Persisted to `localStorage`.
- **HTTP client:** a thin `fetch` wrapper (`http<T>()`) in both apps that injects `Authorization: Bearer` and normalizes errors into `ApiError { status, code, message }`.
- **Rate limiting:** in-memory, fixed-window (`src/lib/rateLimit.ts`) — applied to `phone-login` (10/hr/phone) and `resend-verification` (3/hr). Not shared across processes; resets on restart.
- **Caching:** token caches for MTN/Daraja OAuth bearer tokens (in-memory, refreshed before expiry). No Redis, no job queue, no websockets.
- **PWA / offline:** the rider app registers a Workbox service worker (generateSW) and caches Google Maps scripts/tiles with a NetworkFirst strategy.
- **Security notes from review:**
  - The Go JWT parser does not enforce the `alg` on verification.
  - `.env` (gitignored) contains what look like live MTN/Daraja credentials — rotate if genuine.
  - `PHONE_MOCK=true` must be disabled in production.

---

## 11. Directory map

```
My_rider/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md   ← this file
│   ├── frontend.md
│   ├── admin.md
│   └── backend.md
├── frontend/
│   ├── capacitor.config.ts      # Capacitor 8 (android/ ios/)
│   ├── svelte.config.js         # adapter-static, SPA fallback
│   ├── vite.config.ts           # Tailwind v4 + VitePWA + port 5173
│   ├── tailwind.config.js       # legacy v3 tokens (app.css @theme is authoritative)
│   └── src/
│       ├── app.css              # Tailwind v4 @theme + custom utilities
│       ├── lib/                 # api.ts, auth.ts, http.ts, components/
│       └── routes/              # +page.svelte SPA screens (no server files)
├── admin/
│   ├── svelte.config.js         # adapter-static, SPA fallback
│   ├── vite.config.ts           # Tailwind v4 + port 5174
│   └── src/
│       ├── app.css
│       ├── lib/                 # api.ts, auth.ts, http.ts, types.ts
│       └── routes/
│           ├── (auth)/login     # login + register + verify
│           ├── (auth)/verify-email
│           └── (app)/           # overview, pricing, drivers, users
└── backend/
    ├── go.mod / cmd/ / internal/   # Go/Fiber prototype (f01578a, "previous prototype")
    ├── src/                        # Express/TypeScript backend (active)
    │   ├── app.ts                  # Express wiring + /api/health
    │   ├── config.ts               # env config
    │   ├── db.ts                   # schema + migration + seed
    │   ├── lib/                    # jwt, password, tokens, mailer, mtn, daraja, phone, fares, rateLimit
    │   ├── middleware/             # auth (JWT), error
    │   └── routes/                 # auth, pricing, rides, drivers, profile, messages, admin
    ├── .env.example
    └── sipi.db                     # SQLite (gitignored)
```
