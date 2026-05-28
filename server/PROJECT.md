# Opinion Trading Marketplace — Project Context

This document is the single source of truth for this project. Read it fully before writing any code. It covers what the app is, every decision that has been made, what exists, what is left to build, and how every layer connects.

---

## What this app is

A prediction/opinion trading marketplace. Users buy and sell shares in opinions — e.g. "Will India win the 2026 World Cup?" Each opinion is a **Market**. Each market has two sides: **YES** and **NO**. Prices are probabilities between 0.01 and 0.99 and always sum to 1.00. If you buy YES shares at 0.40 and the market resolves YES, each share pays out 1.00 — giving you a 0.60 profit per share. If it resolves NO, shares are worth 0. Think Polymarket or Kalshi but built from scratch as a portfolio project.

Users trade with virtual currency. Every new account starts with 1000 coins. No real money involved.

---

## Tech stack — final decisions

Do not suggest alternatives. These are locked.

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, App Router, TypeScript, Tailwind CSS, React Query, Zustand |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Supabase Auth — Google OAuth only. No passwords, no email/password login. |
| Real-time | Socket.io for live price updates |
| Cache / Rate limiting | Redis via ioredis |
| Validation | Zod on all request bodies and params |
| Logging | Winston |
| Frontend deploy | Vercel |
| Backend deploy | Railway |
| DB hosting | Supabase |
| CI/CD | GitHub Actions |

---

## Monorepo structure

```
opinion-market/
├── backend/      ← Express + TypeScript (this folder)
└── frontend/     ← Next.js 14 (not yet started)
```

---

## Backend folder structure

```
backend/
├── prisma/
│   ├── schema.prisma          ← complete, validated, do not modify without reason
│   └── supabase_trigger.sql   ← run once in Supabase SQL editor on project setup
│
└── src/
    ├── app.ts                 ← Express app, mounts all routers
    ├── server.ts              ← starts HTTP server (not yet created)
    │
    ├── types/
    │   └── user.types.ts      ← PublicUserProfile, GetUserProfileResponse, ApiError
    │
    ├── middleware/
    │   ├── auth.ts            ← requireAuth, optionalAuth, requireAdmin (complete)
    │   ├── rateLimit.ts       ← not yet created
    │   └── errorHandler.ts    ← not yet created
    │
    ├── repositories/
    │   └── userRepository.ts  ← findPublicProfileById, existsById (complete)
    │
    ├── services/
    │   └── userService.ts     ← getPublicProfile (complete)
    │
    ├── controllers/           ← not yet created
    │
    ├── routes/
    │   └── users.ts           ← GET /:id/profile (complete, uses service directly — needs refactor to use controller)
    │
    └── lib/
        ├── prisma.ts          ← Prisma client singleton (assumed exists, not verified)
        └── supabase.ts        ← Supabase client (exists)
```

---

## Auth — how it works

Supabase handles all OAuth. The backend never issues tokens.

**First login flow:**
1. User clicks "Sign in with Google" on the frontend
2. Supabase handles the redirect, issues a JWT
3. A Postgres trigger (`supabase_trigger.sql`) fires on `auth.users` INSERT
4. The trigger creates a row in `public.users`, `public.wallets` (1000 coin balance), and `public.trader_stats` (all zeros) atomically
5. Frontend stores the JWT and sends it as `Authorization: Bearer <token>` on every API request

**Every protected request:**
1. `requireAuth` middleware reads the Bearer token
2. Calls `supabase.auth.getUser(token)` — Supabase verifies it
3. Looks up `req.user` from `public.users` by the Supabase UUID
4. Attaches `{ id, email, role }` to `req.user`
5. Route handler runs

**Key fact:** `User.id` in our database IS the Supabase auth UUID. Same value. No mapping needed.

**Middleware available:**
- `requireAuth` — blocks unauthenticated requests with 401
- `optionalAuth` — populates `req.user` if token present, continues anonymously if not
- `requireAdmin` — blocks non-ADMIN users with 403

---

## Database schema — all models

Schema file: `prisma/schema.prisma`. All migrations run via `prisma migrate deploy`.

### User
Public profile. `id` is the Supabase auth UUID. `role` is either `USER` or `ADMIN`. `isActive: false` = soft-banned. Never expose `email` or `role` in public API responses.

### Wallet
One-to-one with User. `balance` = spendable coins. `lockedBalance` = coins reserved for pending LIMIT orders. Available balance = `balance - lockedBalance`. Use `Decimal` arithmetic always — never `float`.

### Market
An opinion question. `yesPrice + noPrice = 1.00` always. Both stored as `Decimal(5,4)` — probabilities. `status` lifecycle: `DRAFT → OPEN → CLOSED → RESOLVED` (or `CANCELLED`). `totalVolume` and `yesPrice`/`noPrice` are updated on every trade execution.

### Order
A user's buy or sell intent. `side` = YES or NO. `type` = MARKET (execute now) or LIMIT (execute at price or better). `status` lifecycle: `PENDING → PARTIAL → FILLED` or `PENDING → CANCELLED`. `filledQty` tracks partial fills. `totalCost` is locked from wallet when order is placed.

### Trade
A matched pair of orders — the actual execution record. Has two foreign keys to Order: `buyOrderId` and `sellOrderId`. Prisma relation names: `"BuyOrderTrades"` and `"SellOrderTrades"` — these names are required to resolve the ambiguous relation error. Back-references on Order are `trades` (buy side) and `salesTrades` (sell side).

### Position
What a user currently holds. One row per `(userId, marketId, side)` — enforced by `@@unique`. `avgCost` recalculated as weighted average on each new purchase. `realisedPnl` accumulates when shares are sold.

### PriceHistory
Append-only time series. One row inserted per trade execution. Never updated. Powers the price chart. Index on `(marketId, side, timestamp)` for range queries.

### Resolution
Created when an admin resolves a market. `outcome` = YES, NO, or VOID. Stores payout totals and evidence URL.

### Transaction
Immutable financial ledger. Every coin movement creates a row. `balanceAfter` stored redundantly for audit without summing. `referenceId` + `referenceType` traces back to the causing entity.

### TraderStats
Denormalised aggregate. Updated on every trade close. Powers the leaderboard via simple `ORDER BY roi DESC`. Never recalculated from scratch — incrementally updated.

---

## Code architecture — the 5-layer pattern

Every feature follows this exact structure. Do not deviate.

```
types/           → TypeScript interfaces only. No logic.
routes/          → URL registration + middleware chain only. One line per endpoint.
controllers/     → req/res handling. Parse, validate with Zod, call service, respond.
services/        → Business logic. Calls repository. Shapes data. Enforces rules.
repositories/    → Prisma queries only. No business logic. Returns raw data or null.
```

**Rule:** A controller never imports Prisma. A repository never imports Express. A service never reads `req.body`.

### Request flow
```
HTTP request
  → route (which middleware? which controller?)
  → controller (valid input? call service)
  → service (allowed? shape data)
  → repository (query DB)
  → back up the chain
  → controller sends res.json()
```

### Decimal serialisation rule
All Prisma `Decimal` fields must be `.toString()` before going into a JSON response. Raw Prisma Decimals lose precision in `JSON.stringify`. This is done in the service layer, never the controller.

---

## API — all endpoints

### Built
- `GET /users/:id/profile` — public user profile with stats and recent markets

### To build (in this order)

**Auth**
- `GET /auth/me` — decode JWT, return current user's profile row
- `POST /auth/logout` — invalidate Supabase session

**Users**
- `PATCH /users/me` — update own profile (username, bio, displayName, avatarUrl)
- `GET /users/me/wallet` — own wallet balance, locked balance, available balance

**Markets**
- `GET /markets` — paginated list. Query params: `category`, `status`, `sort` (volume|closeAt), `search`, `page`, `limit`
- `GET /markets/:id` — single market detail with creator info
- `POST /markets` — create market. Body: title, description, category, tags, closeAt. Protected.
- `PATCH /markets/:id/publish` — DRAFT → OPEN. Creator or ADMIN only.
- `PATCH /markets/:id/close` — OPEN → CLOSED. ADMIN only.
- `POST /markets/:id/resolve` — CLOSED → RESOLVED. ADMIN only. Triggers payout.

**Orders**
- `POST /orders` — place order. Body: marketId, side, type, quantity, price. Runs matching engine. Protected. Rate limited (10/min).
- `GET /orders` — own order history. Query params: status, marketId, page, limit.
- `GET /orders/:id` — single order with trade history.
- `DELETE /orders/:id` — cancel PENDING order. Unlocks wallet funds.

**Portfolio**
- `GET /portfolio/positions` — all open positions with unrealised P&L
- `GET /portfolio/pnl` — summary: totalInvested, currentValue, realisedPnl, unrealisedPnl, roi
- `GET /portfolio/history` — paginated transaction history

**Prices**
- `GET /prices/:marketId/history` — time series. Query param: `interval` (1h|24h|7d|all)
- `GET /prices/:marketId/orderbook` — current pending orders grouped by price

**Leaderboard**
- `GET /leaderboard` — top traders by ROI. Query params: page, limit

**WebSocket events (Socket.io — not REST)**
- Client emits `join_market` with `marketId` → joins room `market:{marketId}`
- Client emits `leave_market` with `marketId` → leaves room
- Server emits `price_update` → `{ marketId, yesPrice, noPrice, volume, timestamp }` — fired from OrderService after every trade executes

---

## The order matching engine — most critical feature

Lives in `OrderService`. Called by the `POST /orders` controller.

**Algorithm (simplified limit order book):**
1. Validate order — market is OPEN, user has sufficient balance
2. Lock funds: add `totalCost` to `wallet.lockedBalance`, subtract from `wallet.balance`
3. Save order with status `PENDING`
4. Query for matching orders: if incoming is BUY YES at price P, find PENDING SELL YES orders on same market where price ≤ P, ordered by price ASC (best price first), then createdAt ASC (time priority)
5. Match greedily until incoming order is fully filled or no more matches
6. For each match: wrap in `prisma.$transaction()`:
   - Create `Trade` row
   - Update both orders' `filledQty` and `status` (PARTIAL or FILLED)
   - Update both users' wallets (debit buyer, credit seller)
   - Upsert both users' `Position` rows (recalculate avgCost)
   - Insert `PriceHistory` row
   - Update `Market.yesPrice`, `Market.noPrice`, `Market.totalVolume`
7. After transaction commits: emit `price_update` via Socket.io to `market:{marketId}` room
8. Update both users' `TraderStats` (fire and forget, non-critical)

**The DB transaction is all-or-nothing.** If any step inside fails, the entire trade rolls back. Socket.io broadcast only fires after successful commit.

**Price update rule:** new `yesPrice` = execution price of the last trade. `noPrice` = `1 - yesPrice`.

---

## Error response format

All errors return this shape:
```json
{ "error": "Human readable message", "code": "MACHINE_READABLE_CODE" }
```

HTTP status codes:
- `400` — invalid input (Zod validation failed)
- `401` — not authenticated
- `403` — authenticated but not authorised
- `404` — resource not found
- `409` — conflict (e.g. insufficient balance, market not open)
- `429` — rate limited
- `500` — unexpected server error

---

## Middleware

**Exists:**
- `requireAuth` — verifies Supabase JWT, populates `req.user`
- `optionalAuth` — same but non-blocking, continues anonymously if no token
- `requireAdmin` — checks `req.user.role === 'ADMIN'`

**Still to create:**
- `rateLimit.ts` — `apiLimiter` (100 req/15min global), `orderLimiter` (10 req/min for POST /orders)
- `errorHandler.ts` — global Express error handler, mounted last in app.ts

---

## Environment variables needed

```env
DATABASE_URL=          # Supabase pooled connection string (runtime)
DIRECT_URL=            # Supabase direct connection string (migrations only)
SUPABASE_URL=          # Your Supabase project URL
SUPABASE_ANON_KEY=     # Supabase anon/public key
SUPABASE_SERVICE_KEY=  # Supabase service role key (server-side only, never expose)
REDIS_URL=             # Redis connection string
FRONTEND_URL=          # e.g. http://localhost:3000 (for CORS)
PORT=                  # e.g. 4000
NODE_ENV=              # development | production
```

---

## What is not built yet

In priority order:

1. `src/server.ts` — HTTP server entry point
2. `src/middleware/rateLimit.ts`
3. `src/middleware/errorHandler.ts`
4. `src/lib/prisma.ts` — Prisma client singleton (verify it exists)
5. `src/lib/redis.ts` — ioredis client singleton
6. `src/lib/socket.ts` — Socket.io server setup
7. Refactor `src/routes/users.ts` to use a controller instead of inline handler
8. `src/controllers/userController.ts`
9. All remaining routes, controllers, services, repositories (see API section above)

---

## Conventions to follow

- All DB column names: `snake_case` via `@map()`
- All TypeScript: `camelCase`
- All route files: register URL and middleware only, no logic
- All Decimal fields: `.toString()` before JSON serialisation — done in the service layer
- All `prisma.$transaction()` for any operation touching more than one table
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- Every file has one job. If you are unsure where code belongs, re-read the 5-layer pattern above.
