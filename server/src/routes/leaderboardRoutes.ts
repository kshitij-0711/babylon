import { Router } from "express";
import { getLeaderboard } from "../controllers/leaderboardController";

export const leaderboardRouter = Router();

// ──────────────────────────────────────────────────────────────
// LEADERBOARD ROUTES
// Pulls from denormalised TraderStats table — simple ORDER BY roi DESC.
// Public endpoint.
// ──────────────────────────────────────────────────────────────

// GET /leaderboard — top traders by ROI. Query: ?page, ?limit
leaderboardRouter.get("/", getLeaderboard);
