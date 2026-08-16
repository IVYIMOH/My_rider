# Frontend — Sipi Rider rider app

The rider-facing mobile app. Package name `sipirider`, in `frontend/`.

- **Framework:** SvelteKit 5 (runes) + Tailwind CSS v4, built as a **static SPA** (`adapter-static`, `fallback: index.html`)
- **Mobile:** Capacitor 8 (native `android/` and `ios/` folders wrap the static build)
- **PWA:** `vite-plugin-pwa` (generateSW + autoUpdate), Google Maps runtime caching
- **Maps:** Google Maps JS API via `@googlemaps/js-api-loader`
- **State:** one Svelte store — `session` (JWT) in `src/lib/auth.ts`
- **API base:** `VITE_API_BASE_URL` (default `http://localhost:8080`)

```mermaid
flowchart LR
    subgraph "frontend/"
        SRC["src/ (SvelteKit SPA)"]
    end
    V["vite.config.ts<br/>Tailwind v4 + VitePWA"] --> SRC
    C["capacitor.config.ts<br/>Capacitor 8"] --> SRC
    SRC --> API["Backend REST :8080"]
    SRC --> GM["Google Maps JS API"]
```

---

## 1. Screen map

```mermaid
flowchart TD
    HOME["/  — role picker<br/>Tourist vs Driver"]
    HOME -->|A Tourist| GS["/get-started — booking flow"]
    HOME -->|A Driver| OND["/onboarding/driver — driver signup"]

    subgraph "Rider tabs (BottomNav)"
        GS
        B["/bookings — ride history"]
        M["/map — explore (Kapchorwa)"]
        MSG["/messages — inbox"]
        P["/profile — account"]
    end

    OND --> DRV["/driver — driver dashboard"]
    GS --> B
    GS --> M
    GS --> MSG
    GS --> P
```

| Route | File | Purpose |
|---|---|---|
| `/` | `src/routes/+page.svelte` | Splash / role picker (Tourist → `/get-started`, Driver → `/onboarding/driver`) |
| `/get-started` | `src/routes/get-started/+page.svelte` | **Main booking flow** (see §3) |
| `/bookings` | `src/routes/bookings/+page.svelte` | My rides (phone-gated) |
| `/map` | `src/routes/map/+page.svelte` | Static map centered on Kapchorwa District (Sipi Falls) |
| `/messages` | `src/routes/messages/+page.svelte` | Conversation inbox (phone-gated) |
| `/profile` | `src/routes/profile/+page.svelte` | Account info + verification status (phone-gated) |
| `/driver` | `src/routes/driver/+page.svelte` | Driver home — online toggle, stats, rating |
| `/onboarding/driver` | `src/routes/onboarding/driver/+page.svelte` | Driver onboarding step 1 (name + phone → phone-login as driver → submit onboarding) |

There are **no `+page.server.ts`, `+server.ts`, hooks, or load functions** — every screen fetches data in a `$effect` and renders client-side. `PhoneGate` wraps anything that requires a session.

---

## 2. Client architecture

```mermaid
flowchart TB
    subgraph "Routes (screens)"
        R1["get-started"]
        R2["bookings"]
        R3["messages"]
        R4["driver"]
    end

    subgraph "lib/"
        A["api.ts — typed API functions"]
        H["http.ts — fetch wrapper, ApiError, API_BASE"]
        AU["auth.ts — session store, login/phoneLogin/logout"]
        C1["components/BottomNav.svelte"]
        C2["components/MapWrapper.svelte"]
        C3["components/PhoneGate.svelte"]
        C4["components/PhoneLoginForm.svelte"]
        C5["components/TopBar · Icon · ErrorState"]
    end

    R1 --> A
    R2 --> A
    R3 --> A
    R4 --> A
    A --> H
    A --> AU
    R1 --> C4
    R2 --> C3
    R3 --> C3
    R4 --> C3
    R1 --> C2
```

### HTTP layer (`src/lib/http.ts`)

`http<T>(path, {method, body, token})`:

1. Adds `Content-Type: application/json`; adds `Authorization: Bearer <token>` when a token is passed.
2. `fetch(API_BASE + path)`; network failure → `ApiError{status:0, code:'NETWORK_ERROR'}`.
3. Non-OK → parses `{error:{code,message}}` into `ApiError`.
4. `204` → `undefined`; otherwise returns parsed JSON.

### Session store (`src/lib/auth.ts`)

- `session = writable<Session | null>(readSession())`, persisted to `localStorage['sipi_rider_session']`.
- `isAuthenticated()` / `requireToken()` (throws `ApiError` 401 `NO_SESSION` when absent).
- `login(email, password)` → `POST /api/auth/login`.
- `phoneLogin(phone, role)` → `POST /api/auth/phone-login` (find-or-create; operator verified server-side).
- `logout()` clears store + localStorage.

### API surface used (`src/lib/api.ts`)

| Function | Call | Notes |
|---|---|---|
| `getPricing()` | `GET /api/pricing` | config + vehicle classes |
| `estimateFare(...)` | `POST /api/rides/estimate` | defined but **unused** — fares computed locally |
| `createRide(input)` | `POST /api/rides` | bearer |
| `getRides()` | `GET /api/rides` | bearer |
| `getDriverMe()` | `GET /api/drivers/me` | bearer |
| `setDriverOnline(online)` | `PATCH /api/drivers/me` | bearer |
| `submitDriverOnboarding(input)` | `POST /api/drivers/onboarding` | bearer |
| `getConversations()` | `GET /api/messages` | bearer |
| `getProfile()` | `GET /api/profile` | bearer |

---

## 3. Booking flow (`/get-started`)

The heart of the rider experience. A three-step client-side state machine driving a map screen with floating overlays:

```mermaid
stateDiagram-v2
    [*] --> empty
    empty --> select_vehicle : "Request a Driver"
    select_vehicle --> empty : Cancel
    select_vehicle --> requested : Confirm Request
    requested --> empty : Done
```

```mermaid
sequenceDiagram
    participant U as Rider
    participant S as Screen (flowStep state)
    participant A as Backend API
    participant L as localStorage session

    S->>A: GET /api/pricing (via $effect)
    A-->>S: {config, vehicleClasses}
    S->>S: compute fare per class (fares formula) + format money

    U->>S: taps "Request a Driver" → select_vehicle
    U->>S: selects vehicle class, taps "Confirm Request"
    S->>S: isAuthenticated()?
    alt no session
        S->>S: phoneStep = true (inline PhoneLoginForm)
        U->>A: POST /api/auth/phone-login {phone, role:"tourist"}
        A-->>L: {token, user} persisted
        S->>S: re-run confirmRequest()
    end
    S->>A: POST /api/rides {vehicleClassId, pickup:"Sheraton Kampala Hotel", destination:"Entebbe Airport Arrivals", distanceKm:41, durationMin:62}
    A-->>S: ride → status=searching
    S->>S: flowStep = requested ("Ride requested!")
```

Notes from review:

- The route is **hardcoded**: Sheraton Kampala → Entebbe Airport, `41 km / 62 min` (`routeKm`, `routeMin` constants).
- Fares are **computed on-device** from the pricing config (`computeFare`) — the `estimateFare` API helper exists but is unused.
- Booking requires a session; if absent a `PhoneLoginForm` is injected inline and the request retried after success.
- The map (`MapWrapper.svelte`) loads Google Maps with a custom teal style, renders an `AdvancedMarkerElement` at Sheraton Kampala, and shows a graceful fallback when no API key is configured.

---

## 4. Driver flows

### Onboarding (`/onboarding/driver`)

```mermaid
sequenceDiagram
    participant U as Driver
    participant F as frontend
    participant A as Backend

    U->>F: enter full name + phone (sample prefill)
    F->>A: POST /api/auth/phone-login {phone, role:"driver"}
    A-->>F: {token, user}
    F->>A: POST /api/drivers/onboarding {fullName, phone, association:"Taxi association (pending review)", vehicleClassId:"car"}
    A-->>F: created driver (verified=0)
    F->>F: goto /driver
```

The UI advertises a 4-step onboarding but only **step 1** is implemented; association and vehicle class are hardcoded sample values.

### Driver home (`/driver`)

```mermaid
sequenceDiagram
    participant D as Driver
    participant F as frontend
    participant A as Backend

    D->>F: /driver (PhoneGate role=driver)
    F->>A: GET /api/drivers/me
    A-->>F: {profile, stats}
    D->>F: toggle online
    F->>A: PATCH /api/drivers/me {online:bool}
    A-->>F: ok
```

Shows the driver identity card (name, association, verified badge), a stats grid (today earnings, online time, rating), and a map of Kampala. The driver screen is reachable only via onboarding — it is not one of the 5 bottom-nav tabs.

---

## 5. Styling & theming

- **Tailwind v4** via `@tailwindcss/vite`. Design tokens live in `src/app.css` `@theme`: primary/deep/light teal, `--color-bg`, success, text colors, borders, `--spacing-app: 412px`, font scale, and Inter.
- Custom utilities (`@utility`): `app-frame` (mobile frame, max-width 412px, centered phone on desktop), `field-label`, `field-input`, `btn-primary`, `card`, `chip`, `chip-active`.
- `tailwind.config.js` is a **vestigial v3-style** config whose hex values differ slightly from `app.css` (`#149AA0` vs `#14A4A0`, etc.); the `@theme` block is the effective source.
- Minor CSS quirks found: `btn-primary` contains an invalid `items-center: center;` line; `no-scrollbar` is used but never defined.

---

## 6. PWA & offline

`vite.config.ts` → `VitePWA`:

- `generateSW` / `autoUpdate` / `injectRegister: auto`; manifest name "Sipi Rider — Ride with locals you trust", portrait standalone, teal theme.
- Workbox `runtimeCaching` for `maps.googleapis.com` uses **NetworkFirst** (`google-maps-cache`, max 50 entries, 24h) so map assets never go stale offline.
- **Gap found:** the manifest references `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, but `static/` only contains `robots.txt` — the icons do not exist.

---

## 7. Environment & config files

| File | Notes |
|---|---|
| `vite.config.ts` | Tailwind v4, SvelteKit, VitePWA; dev port `5173`; `ssr.noExternal: ['@googlemaps/js-api-loader']` (CJS named-export fix) |
| `svelte.config.js` | `adapter-static` → `dist/` with `fallback: index.html` (SPA mode for Capacitor) |
| `capacitor.config.ts` | `appId: 'com.example.myapp'`, `appName: 'MyApp'`, `webDir: 'dist'` — **still default placeholders** |
| `.env` | `VITE_GOOGLE_MAPS_API_KEY` |
| `.npmrc` | `engine-strict=true` |

### Known gaps from the review

1. **API contract:** this app targets the Express backend (`rides`, `phone-login`, `pricing`, `messages`). If the backend is not running on `:8080`, every screen shows `NETWORK_ERROR`.
2. **PWA icons missing** from `static/`.
3. **Capacitor app ids/names** still placeholder (`com.example.myapp` / `MyApp`).
4. Onboarding is 1 of 4 planned steps; sample/hardcoded values used.
5. `estimateFare` API helper unused; `BottomNav` on `/driver` has no bound `activeTab`.
