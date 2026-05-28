import { Request, Response } from "express";
import * as marketService from "../services/marketService";
import * as marketResolutionService from "../services/marketResolutionService";
import { createMarketSchema, resolveMarketSchema } from "../validations/marketValidation";
import { marketFilterSchema } from "../validations/paginationValidation";

// ══════════════════════════════════════════════════════════════
// MARKET CONTROLLER
// ══════════════════════════════════════════════════════════════
// Markets are prediction questions users trade on.
// Lifecycle: DRAFT → OPEN → CLOSED → RESOLVED (or CANCELLED)
//
// yesPrice + noPrice = 1.00 always. Both Decimal(5,4).
// totalVolume and prices are updated on every trade execution.
//
// Controller handles HTTP only — business logic lives in services.
// Controller never imports Prisma. Validates with Zod, calls service.
// ══════════════════════════════════════════════════════════════

/**
 * GET /markets
 *
 * Paginated list of markets (homepage feed).
 * Query params: ?category, ?status, ?sort (volume|closeAt), ?search, ?page, ?limit
 *
 * Flow:
 * 1. Parse and validate query params with Zod.
 * 2. Call marketService.getMarkets(filters).
 * 3. Service builds Prisma query with proper where/orderBy/skip/take.
 * 4. Returns paginated list with metadata.
 *
 * PUBLIC endpoint.
 */
export const getAllMarkets = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { category, search, sort, status, page = "1", limit = "20" } = req.query;

    const filters = marketFilterSchema.parse(req.query);
    const result = await marketService.getMarkets(filters);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getAllMarkets:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * GET /markets/:id
 *
 * Single market detail with creator info.
 * Returns: title, description, yesPrice, noPrice, totalVolume, status,
 *          closeAt, creator info, tags, category.
 *
 * PUBLIC endpoint.
 */
export const getMarketById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const marketDetail = await marketService.getMarketDetail(id as string);

    return res.status(200).json({
      market: marketDetail
    });
  } catch (error) {
    console.error("Error in getMarketById:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * POST /markets
 *
 * Creates a new market in DRAFT status.
 * Body: { title, description, category, tags, closeAt }
 *
 * Flow:
 * 1. Read req.user.id (requireAuth).
 * 2. Validate body with Zod (createMarketSchema).
 * 3. Call marketService.createMarket(userId, validatedData).
 * 4. Service sets: creatorId, status=DRAFT, yesPrice=0.50, noPrice=0.50, totalVolume=0.
 * 5. Return the created market.
 *
 * Protected: auth required.
 */
export const createMarket = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const marketData = req.body;

    const validatedData = createMarketSchema.parse(marketData);
    const newMarket = await marketService.createMarket(userId, validatedData);

    return res.status(201).json({
      market: newMarket
    });
  } catch (error) {
    console.error("Error in createMarket:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * PATCH /markets/:id/publish
 *
 * Promotes market from DRAFT → OPEN. Only then can people trade on it.
 *
 * Flow:
 * 1. Read market id and req.user.
 * 2. Call marketService.publishMarket(id as string, userId).
 * 3. Service verifies: market exists, status === DRAFT, user is creator OR admin.
 * 4. Updates status to OPEN, sets openAt to now().
 *
 * Protected: creator or ADMIN only.
 */
export const publishMarket = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const updatedMarket = await marketService.publishMarket(id as string, userId);

    return res.status(200).json({
      market: updatedMarket
    });
  } catch (error) {
    console.error("Error in publishMarket:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * PATCH /markets/:id/close
 *
 * Marks market as CLOSED, trading stops. OPEN → CLOSED.
 * Either triggered manually by admin or automatically when closeAt passes.
 *
 * Flow:
 * 1. Read market id.
 * 2. Call marketService.closeMarket(id as string).
 * 3. Service: verifies market is OPEN, updates status to CLOSED,
 *    cancels all remaining PENDING orders, unlocks reserved wallet funds.
 *
 * Protected: ADMIN only.
 */
export const closeMarket = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const closedMarket = await marketService.closeMarket(id as string);

    return res.status(200).json({
      market: closedMarket
    });
  } catch (error) {
    console.error("Error in closeMarket:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * POST /markets/:id/resolve
 *
 * MOST COMPLEX ENDPOINT. Admin resolves the market — CLOSED → RESOLVED.
 * Body: { outcome: YES|NO|VOID, evidenceUrl?, notes? }
 *
 * Flow (all in a single prisma.$transaction()):
 *   1. VALIDATE: market exists, is CLOSED, not already resolved
 *   2. DETERMINE WINNERS: if YES → side=YES positions win; if VOID → refund all
 *   3. CALCULATE PAYOUTS: winners get 1.00 per share held
 *   4. CREDIT WALLETS: add payout to each winner's wallet.balance
 *   5. CREATE TRANSACTIONS: immutable audit rows for every coin movement
 *   6. CLOSE POSITIONS: set shares=0, record realisedPnl
 *   7. UPDATE TRADER STATS: increment wins/losses/roi in TraderStats
 *   8. CREATE RESOLUTION ROW: outcome, evidenceUrl, totalPayout, winnersCount
 *   9. UPDATE MARKET: status=RESOLVED, resolvedAt, resolvedBy, outcome
 *
 * After transaction commits:
 *   10. Emit Socket.io price_update to market:{id} room
 *
 * DB transaction is all-or-nothing. If any step fails, entire trade rolls back.
 * Socket.io broadcast only fires after successful commit.
 *
 * Protected: ADMIN only.
 */
export const resolveMarket = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { outcome, evidenceUrl, notes } = req.body;

    const validatedData = resolveMarketSchema.parse(req.body);
    const resolutionResult = await marketResolutionService.resolveMarket(id as string, { ...validatedData, resolvedBy: userId });

    return res.status(200).json({
      resolution: resolutionResult
    });
  } catch (error) {
    console.error("Error in resolveMarket:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};
