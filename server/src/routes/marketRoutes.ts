import { Router } from "express";
import {
  getAllMarkets,
  getMarketById,
  createMarket,
  publishMarket,
  closeMarket,
  resolveMarket,
} from "../controllers/marketController";
import { requireAuth, requireAdmin } from "../middleware/auth";

export const marketRouter = Router();

// ──────────────────────────────────────────────────────────────
// MARKET ROUTES
// Lifecycle: DRAFT → OPEN → CLOSED → RESOLVED (or CANCELLED)
// yesPrice + noPrice = 1.00 always.
// ──────────────────────────────────────────────────────────────

// GET /markets — paginated list. Query: ?category, ?status, ?sort (volume|closeAt), ?search, ?page, ?limit
marketRouter.get("/", getAllMarkets);

// GET /markets/:id — single market detail with creator info
marketRouter.get("/:id", getMarketById);

// POST /markets — create market. Body: title, description, category, tags, closeAt. Protected.
marketRouter.post("/", requireAuth, createMarket);

// PATCH /markets/:id/publish — DRAFT → OPEN. Creator or ADMIN only.
marketRouter.patch("/:id/publish", requireAuth, publishMarket);

// PATCH /markets/:id/close — OPEN → CLOSED. ADMIN only.
marketRouter.patch("/:id/close", requireAuth, requireAdmin, closeMarket);

// POST /markets/:id/resolve — CLOSED → RESOLVED. ADMIN only. Triggers payout.
marketRouter.post("/:id/resolve", requireAuth, requireAdmin, resolveMarket);
