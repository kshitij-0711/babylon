import { Request, Response } from "express";
import * as portfolioService from "../services/portfolioService";
import { paginationSchema } from "../validations/paginationValidation";

// ══════════════════════════════════════════════════════════════
// PORTFOLIO CONTROLLER
// ══════════════════════════════════════════════════════════════
// Personal trading dashboard — positions, P&L, and wallet
// transaction history. All endpoints are user-scoped
// (show only the authenticated user's data).
//
// Controller validates with Zod, calls service, sends response.
// All Decimal fields are .toString() in the service layer.
// ══════════════════════════════════════════════════════════════

/**
 * GET /portfolio/positions
 *
 * All open positions with unrealised P&L.
 * One row per (userId, marketId, side) — from the Position table.
 *
 * For each position, service computes:
 *   - market title and status
 *   - side (YES/NO)
 *   - shares held
 *   - avgCost per share (Decimal → toString)
 *   - current market price (yesPrice or noPrice depending on side)
 *   - unrealisedPnl = (currentPrice - avgCost) * shares
 *   - totalInvested (Decimal → toString)
 *
 * Protected.
 */
export const getPositions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;

    const positions = await portfolioService.getPositions(userId);

    return res.status(200).json({
      positions
    });
  } catch (error) {
    console.error("Error in getPositions:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * GET /portfolio/pnl
 *
 * Summary stats for the portfolio dashboard cards. Returns a single object:
 *   - totalInvested: sum of all position.totalInvested
 *   - currentValue: sum of (shares × currentMarketPrice)
 *   - realisedPnl: sum of all position.realisedPnl
 *   - unrealisedPnl: currentValue - totalInvested
 *   - roi: netPnl / totalInvested × 100
 *
 * Protected.
 */
export const getPortfolioPnl = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;

    const stats = await portfolioService.getPortfolioPnl(userId);

    return res.status(200).json({
      stats
    });
  } catch (error) {
    console.error("Error in getPortfolioPnl:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * GET /portfolio/history
 *
 * Paginated transaction history from the Transaction table.
 * Every wallet movement creates a Transaction row (immutable ledger).
 * Query params: ?page, ?limit
 *
 * Transaction types:
 *   DEPOSIT — initial coins on signup
 *   ORDER_DEBIT — coins locked when placing an order
 *   ORDER_CREDIT — coins returned on cancel / partial fill
 *   TRADE_PAYOUT — coins received from winning trades
 *   REFUND — coins returned on market VOID resolution
 *   FEE — platform fees (if applicable)
 *
 * Each entry: type, amount, balanceAfter, description, referenceId, createdAt.
 * balanceAfter is stored redundantly for audit without summing.
 *
 * Protected.
 */
export const getPortfolioHistory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { page = "1", limit = "20" } = req.query;

    const pagination = paginationSchema.parse(req.query);
    const result = await portfolioService.getTransactionHistory(userId, pagination);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getPortfolioHistory:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};
