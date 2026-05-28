import { Router } from "express";
import {
  getPositions,
  getPortfolioPnl,
  getPortfolioHistory,
} from "../controllers/portfolioController";
import { requireAuth } from "../middleware/auth";

export const portfolioRouter = Router();

// ──────────────────────────────────────────────────────────────
// PORTFOLIO ROUTES
// Personal portfolio dashboard — positions, P&L, and wallet
// transaction history. All routes are user-scoped and protected.
// ──────────────────────────────────────────────────────────────

// GET /portfolio/positions — all open positions with unrealised P&L
portfolioRouter.get("/positions", requireAuth, getPositions);

// GET /portfolio/pnl — summary: totalInvested, currentValue, realisedPnl, unrealisedPnl, roi
portfolioRouter.get("/pnl", requireAuth, getPortfolioPnl);

// GET /portfolio/history — paginated transaction history
portfolioRouter.get("/history", requireAuth, getPortfolioHistory);
