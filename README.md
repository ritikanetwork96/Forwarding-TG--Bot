# Telegram Forwarder & Publishing Platform

A production-ready Telegram Content Forwarding & Publishing Platform built as a high-performance, strictly typed TypeScript monorepo.

> **Status: Phase 1 (MVP Content Forwarding, Verification & Publishing Engine)**
> Complete Phase 1 MVP implementation according to [`docs/PHASE-1-ARCHITECTURE.md`](docs/PHASE-1-ARCHITECTURE.md). Features include full domain modeling, stateless token-versioned authentication, chat-type aware Telegram verification, manual multi-destination publishing (`forward` and `copy` modes), albums/media groups, aggregate state machine tracking, dual retry mechanisms, immutable publish logs, and a clean React administrative dashboard.

---

## 1. Phase 1 Implemented Features

### 🔐 1. Authentication & Session Strategy

- **Initial Setup:** `POST /api/auth/setup` creates the primary `owner` account. Endpoint automatically locks once the first owner exists.
- **Login:** `POST /api/auth/login` issues a signed JWT containing user ID, role, and current `tokenVersion`.
- **Stateless Revocation:** Each user has a persistent `tokenVersion`. Calling `POST /api/auth/logout` increments `tokenVersion`, instantly invalidating all existing tokens without needing Redis.
- **Role Authorization:** Owner/Admin role checking on administrative mutations.

### 🤖 2. Telegram Integration (grammY Abstraction)

- All Telegram Bot API interactions reside in `apps/api/src/telegram/` isolated from Express controllers.
- Single bot instance managed via `bot.ts` using `TELEGRAM_BOT_TOKEN`.
- Telegram error normalizer mapping raw errors to typed domain errors (`TelegramChatNotFoundError`, `TelegramNotAdminError`, `TelegramRateLimitError`, etc.).
- Media group / album debouncer with configurable debounce window (`ALBUM_DEBOUNCE_MS=600`).

### 🛡️ 3. Chat-Type Aware Destination Verification

- **Endpoint:** `POST /api/destinations/:id/verify`
- **Channels:** Probes for `botRole === 'administrator'` AND `can_post_messages === true`.
- **Supergroups:** Verifies `member`, `administrator`, or `creator`. Unrestricted members can publish. Forum topics do not require `can_manage_topics` to send messages.
- **Groups:** Verifies member can send messages.
- **Definitive Failures:** `kicked` or `left` statuses mark destination as `invalid`.
- **Transient Failures:** Network timeouts, Telegram 5xx, and 429 rate limits preserve database state and return `502 TELEGRAM_TEMPORARY_UNAVAILABLE` without corrupting destination status.

### 🚀 4. Multi-Destination Publish Engine & Aggregate State Machine

- **Endpoint:** `POST /api/publish/manual`
- Supports single messages, single media (photo, video, document), and multi-item albums (`sendMediaGroup`).
- Supports both `copy` (clean repost) and `forward` (original attribution) modes.
- Evaluates per-destination dispatches and maintains atomic aggregate states:
  - `published`: 100% of target destinations succeeded.
  - `partially_published`: Some destinations succeeded, some failed (never marked as simply published).
  - `failed`: 0% of destinations succeeded.
- Updates `deliverySummary` tracking `targetCount`, `successfulDestinationIds`, and `failedDestinationIds`.

### 🔄 5. Dual Retry Model

- **Bulk Retry:** `POST /api/publish/retry-failed/:messageId` retries all currently failed destinations for a post.
- **Targeted Retry:** `POST /api/publish/retry-log/:logId` retries a single destination attempt from a specific failed log entry.
- **Immutability:** Every retry attempt creates a brand new `PublishLog` entry. Historical logs are strictly preserved for audit trails.

### 💻 6. Web Admin Panel

- **Tech Stack:** React 18, TypeScript, Tailwind CSS, React Router v6, TanStack Query v5.
- **Setup & Login:** Dedicated authentication pages with token persistence.
- **Protected Routing:** `ProtectedRoute` guarding all admin views.
- **Categories:** Stream classification with create and archive actions.
- **Sources:** Inbound Telegram channel/chat registration.
- **Destinations:** Target management with interactive **Verify** action and live permission badge display.
- **Posts & Inbox:** Compose drafts, view album items, trigger manual publish modal with verified destination selection.
- **Publish Logs:** Live audit trail with execution times, raw error details, and Targeted Retry buttons.

---

## 2. Monorepo Repository Structure

```text
telegram-forwarder/
├── apps/
│   ├── api/                     # Node.js + Express REST API (Phase 1)
│   │   ├── src/
│   │   │   ├── config/          # Zod typed environment validation
│   │   │   ├── controllers/     # Express route controllers (auth, categories, destinations, posts, etc.)
│   │   │   ├── db/              # Mongoose connection & lifecycle
│   │   │   ├── middleware/      # Auth, authorization, error handler, request logger
│   │   │   ├── models/          # 7 Mongoose schemas (User, Category, Source, Destination, Rule, Message, PublishLog)
│   │   │   ├── routes/          # Mounted API routes (/api/auth, /api/destinations, /api/publish, etc.)
│   │   │   ├── services/        # Business logic services
│   │   │   ├── telegram/        # grammY bot, verifier, normalizer, debouncer, message service
│   │   │   ├── utils/           # Crypto, error hierarchy, response helpers
│   │   │   ├── app.ts           # Express application setup
│   │   │   └── server.ts        # Server entry point & graceful shutdown
│   │   ├── tests/               # 7 Vitest test suites (auth, categories, destinations, posts, publish, health, config)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                     # React 18 + Vite frontend (Phase 1)
│       ├── src/
│       │   ├── components/      # AdminLayout, ProtectedRoute, Badges
│       │   ├── context/         # AuthContext (session, login, setup, logout)
│       │   ├── pages/           # CategoriesPage, DestinationsPage, PostsPage, PublishLogsPage, SetupPage, LoginPage
│       │   ├── routes/          # React Router route tree
│       │   ├── services/        # Typed API clients
│       │   ├── App.tsx          # Root provider setup
│       │   └── main.tsx         # DOM entry point
│       ├── package.json
│       ├── vite.config.ts
│       └── tailwind.config.js
│
├── packages/
│   ├── shared/                  # Common TypeScript domain types, DTOs, enums, ErrorCodes
│   └── config/                  # Base tsconfig and lint presets
│
├── docs/
│   └── PHASE-1-ARCHITECTURE.md  # Approved blueprint & domain specifications
├── .env.example                 # Documented environment template
└── README.md
```

---

## 3. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable             | Description                              | Example                                        |
| :------------------- | :--------------------------------------- | :--------------------------------------------- |
| `PORT`               | API server listen port                   | `4000`                                         |
| `NODE_ENV`           | Environment mode                         | `development` / `production`                   |
| `MONGODB_URI`        | MongoDB connection URI                   | `mongodb://localhost:27017/telegram_forwarder` |
| `FRONTEND_URL`       | Allowed CORS origin                      | `http://localhost:5173`                        |
| `JWT_SECRET`         | Secret key for signing session tokens    | `min-16-chars-random-secret`                   |
| `JWT_EXPIRES_IN`     | JWT token validity window                | `7d`                                           |
| `TELEGRAM_BOT_TOKEN` | Bot API token from @BotFather            | `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`         |
| `ALBUM_DEBOUNCE_MS`  | Milliseconds to buffer media group items | `600`                                          |

---

## 4. Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Database

Ensure a local MongoDB server is running (e.g. via Docker):

```bash
docker run -d -p 27017:27017 --name mongo-forwarder mongo:7
```

### 3. Start Backend API

```bash
npm run dev -w @telegram-forwarder/api
```

Backend starts on `http://localhost:4000`.

### 4. Start Frontend Web Client

```bash
npm run dev -w @telegram-forwarder/web
```

Frontend starts on `http://localhost:5173`.

---

## 5. Verification & Testing

Run all quality checks across the entire monorepo:

```bash
# Type check all packages
npm run type-check

# Run ESLint
npm run lint

# Check Prettier formatting
npm run format:check

# Run all test suites
npm test

# Production build test
npm run build
```

---

## 6. Telegram Bot Setup Guide

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Run `/newbot` and follow instructions to obtain your bot token.
3. Add the token to `.env`: `TELEGRAM_BOT_TOKEN=your_token_here`.
4. In channels where the bot will publish:
   - Add the bot as an **Administrator**.
   - Ensure the **Post Messages** permission is enabled.
5. In the Web UI:
   - Navigate to **Destinations** -> **Add Destination**.
   - Enter your channel/group chat ID (e.g., `-1001234567890`).
   - Click **Verify** to validate bot rights in real time.

---

## 7. Render Deployment Target

The project is structured to deploy smoothly to **Render**:

- **Web Service (API):**
  - **Environment:** Node
  - **Build Command:** `npm install && npm run build:shared && npm run build:api`
  - **Start Command:** `npm run start -w @telegram-forwarder/api`
  - **Environment Variables:** Set `NODE_ENV=production`, `MONGODB_URI` (MongoDB Atlas), `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `FRONTEND_URL`.
- **Static Site (Web):**
  - **Build Command:** `npm install && npm run build:shared && npm run build:web`
  - **Publish Directory:** `apps/web/dist`
  - **Rewrite Rule:** `/*` -> `/index.html` (for client-side routing)

---

## 8. Phase 3 — Redis + BullMQ Queue & Worker Guide

Phase 3 introduces asynchronous, queue-backed publishing with dedicated BullMQ workers, exponential backoff retries, rate limiting, and real-time dashboard observability.

### 📦 1. Architecture Overview

```text
Source Message Ingestion
          ↓
     Rule Engine
          ↓
  Resolve Destinations
          ↓
 Enqueue BullMQ Jobs (One Job = One Destination)
          ↓
       Redis
          ↓
  PublishWorker (concurrency: 5, rate limiter: 20/s)
          ↓
   PublishService.publishSingleDestination
          ↓
     Telegram API
          ↓
  Immutable PublishLog + Concurrency-Safe Aggregate Status
```

### 🚀 2. Starting Redis Locally

#### Option A: Docker Compose (Recommended)

```bash
docker compose up -d redis
```

#### Option B: Standalone Docker

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

#### Option C: Native Windows or WSL

If using WSL or native Redis port:

```bash
sudo service redis-server start
```

### ⚙️ 3. Environment Configuration (`.env`)

```env
# Redis Connection
REDIS_URL=redis://localhost:6379

# Queue Concurrency & Rate Limiting
QUEUE_CONCURRENCY=5
QUEUE_MAX_JOBS_PER_SECOND=20

# Retry & Backoff Configuration
QUEUE_RETRY_ATTEMPTS=3
QUEUE_BACKOFF_DELAY_MS=1000

# BullMQ Job Retention
QUEUE_COMPLETED_RETENTION=500
QUEUE_FAILED_RETENTION=1000
```

### 🔍 4. Verifying Worker & Queue Health

- **Web Dashboard:** Open [http://localhost:5173](http://localhost:5173) and inspect the **BullMQ Publish Queue & Worker** panel showing live Redis status, worker status, and job count breakdown (`Waiting`, `Active`, `Completed`, `Failed`, `Delayed`).
- **REST Endpoint:** `GET /api/queue/status`
  ```json
  {
    "success": true,
    "data": {
      "redis": { "status": "connected" },
      "worker": { "status": "running", "concurrency": 5 },
      "queue": {
        "name": "publish-queue",
        "isPaused": false,
        "counts": {
          "waiting": 0,
          "active": 0,
          "completed": 5,
          "failed": 0,
          "delayed": 0,
          "paused": 0
        }
      }
    }
  }
  ```

### 🛠️ 5. Troubleshooting Redis Connection Failures

- **Graceful Fallback:** If Redis is down, the API server will not crash. It logs a warning and continues running.
- **Connection Test:** Check port 6379 accessibility via PowerShell:
  ```powershell
  Test-NetConnection -ComputerName localhost -Port 6379
  ```
- **External Redis URL:** For cloud Redis (e.g. Upstash, Redis Cloud), set `REDIS_URL=rediss://default:<password>@<host>:<port>` in `.env`.
