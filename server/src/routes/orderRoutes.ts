import { Router } from "express";
import {
  placeOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
} from "../controllers/orderController";
import { requireAuth } from "../middleware/auth";
import { orderLimiter } from "../middleware/rateLimit";

export const orderRouter = Router();

// ──────────────────────────────────────────────────────────────
// ORDER ROUTES
// Orders represent trading intent (e.g. "BUY YES 10 @ 0.65").
// All order routes are protected — you must be logged in to trade.
// POST /orders is additionally rate-limited at 10 req/min.
// ──────────────────────────────────────────────────────────────

// POST /orders — place order. Runs matching engine. Rate limited (10/min). Protected.
orderRouter.post("/", requireAuth, orderLimiter, placeOrder);

// GET /orders — own order history. Query: ?status, ?marketId, ?page, ?limit
orderRouter.get("/", requireAuth, getUserOrders);

// GET /orders/:id — single order with trade history
orderRouter.get("/:id", requireAuth, getOrderById);

// DELETE /orders/:id — cancel PENDING order. Unlocks wallet funds.
orderRouter.delete("/:id", requireAuth, cancelOrder);
