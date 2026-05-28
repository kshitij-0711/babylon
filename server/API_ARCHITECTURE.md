Since you're using Supabase Auth, /auth changes completely. Here's every API you need to build:

/auth — minimal, Supabase handles the heavy lifting
You don't build register, login, or refresh token. Supabase owns all of that. What you do build:
GET /auth/me — reads the JWT from the request header, decodes it, fetches the user's profile row from your users table and returns it. This is what the frontend calls on app load to know who is logged in.
POST /auth/logout — tells Supabase to invalidate the session server-side. Frontend also clears its local token.

/users
GET /users/:id/profile — public profile of any user. Username, display name, avatar, bio, markets created, join date. Used on leaderboard and market creator cards.
PATCH /users/me — update your own profile. Username, display name, bio, avatar URL. Protected route.
GET /users/me/wallet — your wallet's current balance, locked balance, and available balance. Frontend shows this in the nav bar.

/markets
GET /markets — paginated list of all open markets. Supports query params for filtering by category, sorting by volume or close date, and searching by title. This is your homepage feed.
GET /markets/:id — single market detail. Title, description, current yes/no prices, total volume, status, close date, creator info. Everything needed to render the market detail page.
POST /markets — create a new market. Takes title, description, category, tags, closeAt date. Creates it in DRAFT status. Protected route.
PATCH /markets/:id/publish — admin or creator promotes market from DRAFT to OPEN. Only then can people trade on it.
PATCH /markets/:id/close — marks market as CLOSED, trading stops. Either triggered manually by admin or automatically by a scheduled job when closeAt passes.
POST /markets/:id/resolve — admin only. Sets the outcome (YES/NO/VOID), triggers payout calculation, updates all winning positions, credits wallets. This is the most complex endpoint in the whole app.

/orders
POST /orders — the most important endpoint. Places a buy or sell order. Takes marketId, side (YES/NO), type (MARKET/LIMIT), quantity, price. Locks wallet funds, attempts matching, creates Trade rows if matched, broadcasts price update via Socket.io. Wraps everything in a DB transaction.
GET /orders — your own order history. Filterable by status (pending, filled, cancelled) and market. Used in portfolio page.
GET /orders/:id — single order detail with fill history.
DELETE /orders/:id — cancel a pending limit order. Unlocks the reserved wallet funds. Can only cancel your own PENDING orders.

/portfolio
GET /portfolio/positions — all your current open positions across all markets. Each position shows market title, side, shares held, average cost, current market price, unrealised P&L. This is the main portfolio dashboard data.
GET /portfolio/pnl — summary stats. Total invested, current value, total realised P&L, unrealised P&L, overall ROI. Single object, used for the stats cards at the top of the portfolio page.
GET /portfolio/history — paginated transaction history. Every wallet movement — deposits, order debits, trade payouts, fees. Used for the activity feed.

/prices
GET /prices/:marketId/history — time series of price points for a market. Accepts a query param for interval (1h, 24h, 7d, all). Returns an array of { timestamp, yesPrice, noPrice, volume } objects. This feeds your Recharts price chart.
GET /prices/:marketId/orderbook — the current live order book. All pending YES buy orders grouped by price, all pending NO buy orders grouped by price. Shows market depth. Optional but impressive feature for the detail page.
The WebSocket is not a REST endpoint — it's a persistent connection. Clients join a room named market:{id} on page load and receive price_update events pushed from the server whenever a trade executes. No polling needed.

/leaderboard
GET /leaderboard — top traders ranked by ROI. Pulls from the TraderStats table so it's a fast single query. Supports pagination and filtering by time period.