import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// ── Route imports ──────────────────────────────────────────────
import { authRouter } from "./routes/authRoutes";
import { userRouter } from "./routes/userRoutes";
import { marketRouter } from "./routes/marketRoutes";
import { orderRouter } from "./routes/orderRoutes";
import { portfolioRouter } from "./routes/portfolioRoutes";
import { priceRouter } from "./routes/priceRoutes";
import { leaderboardRouter } from "./routes/leaderboardRoutes";

// ── Middleware imports ─────────────────────────────────────────
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimit";

dotenv.config();

const app = express();

// ── Global middleware ──────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(apiLimiter); // 100 req / 15 min global

// ── API Routes ─────────────────────────────────────────────────
// Auth:        GET /auth/me, POST /auth/logout
// Users:       GET /users/:id/profile, PATCH /users/me, GET /users/me/wallet
// Markets:     GET /markets, GET /markets/:id, POST /markets,
//              PATCH /markets/:id/publish, PATCH /markets/:id/close, POST /markets/:id/resolve
// Orders:      POST /orders (rate limited 10/min), GET /orders, GET /orders/:id, DELETE /orders/:id
// Portfolio:   GET /portfolio/positions, GET /portfolio/pnl, GET /portfolio/history
// Prices:      GET /prices/:marketId/history, GET /prices/:marketId/orderbook
// Leaderboard: GET /leaderboard

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/markets", marketRouter);
app.use("/orders", orderRouter);
app.use("/portfolio", portfolioRouter);
app.use("/prices", priceRouter);
app.use("/leaderboard", leaderboardRouter);

// ── Health check ───────────────────────────────────────────────
app.get("/", (req, res) => {
  return res.send("API Running");
});

// ── Global error handler (must be LAST) ────────────────────────
app.use(errorHandler);

export default app;
