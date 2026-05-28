import { Request, Response } from "express";
import * as leaderboardService from "../services/leaderboardService";
import { paginationSchema } from "../validations/paginationValidation";

// ══════════════════════════════════════════════════════════════
// LEADERBOARD CONTROLLER
// ══════════════════════════════════════════════════════════════
// Pulls from the denormalised TraderStats table for fast reads.
// TraderStats is incrementally updated on every trade close —
// never recalculated from scratch. Simple ORDER BY roi DESC.
//
// Public endpoint.
// ══════════════════════════════════════════════════════════════

/**
 * GET /leaderboard
 *
 * Top traders ranked by ROI.
 * Query params: ?page, ?limit
 *
 * Returns traders with their stats:
 *   - username, displayName, avatarUrl (from User join)
 *   - totalTrades, winningTrades, losingTrades
 *   - totalProfit, totalLoss, netPnl, roi
 *   - marketsTraded
 *
 * Service queries TraderStats joined with User, ordered by roi DESC.
 * All Decimal fields are .toString() in the service layer.
 *
 * PUBLIC endpoint.
 */
export const getLeaderboard = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { page = "1", limit = "20" } = req.query;

    const pagination = paginationSchema.parse(req.query);
    const result = await leaderboardService.getLeaderboard(pagination);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getLeaderboard:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};
