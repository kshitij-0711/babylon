import { Router } from "express";
import { getPriceHistory, getOrderBook } from "../controllers/priceController";

export const priceRouter = Router();

// ──────────────────────────────────────────────────────────────
// PRICE ROUTES
// Price data feeds the Recharts chart and order book depth.
// Prices come from executed trades (PriceHistory — append-only).
// Both endpoints are public.
// ──────────────────────────────────────────────────────────────

// GET /prices/:marketId/history — time series. Query: ?interval (1h|24h|7d|all)
priceRouter.get("/:marketId/history", getPriceHistory);

// GET /prices/:marketId/orderbook — pending orders grouped by price
priceRouter.get("/:marketId/orderbook", getOrderBook);
