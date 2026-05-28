import { Request, Response } from "express";
import * as orderService from "../services/orderService";
import { placeOrderSchema } from "../validations/orderValidation";
import { orderFilterSchema } from "../validations/paginationValidation";

// ══════════════════════════════════════════════════════════════
// ORDER CONTROLLER
// ══════════════════════════════════════════════════════════════
// Orders = trading intent ("BUY YES 10 @ 0.65").
// The placeOrder endpoint is the most critical — it drives
// the matching engine, trade execution, price updates,
// wallet movements, and WebSocket broadcasts.
//
// All endpoints are protected (requireAuth).
// POST /orders is additionally rate-limited (10 req/min).
//
// Controller validates with Zod, calls OrderService.
// Controller never imports Prisma.
// ══════════════════════════════════════════════════════════════

/**
 * POST /orders — THE MOST IMPORTANT ENDPOINT
 *
 * Places a buy or sell order. Runs the matching engine.
 * Body: { marketId, side: YES|NO, type: MARKET|LIMIT, quantity, price }
 * Rate limited: 10 req/min via orderLimiter middleware.
 *
 * Full flow (called from OrderService, wrapped in prisma.$transaction()):
 *   1. Validate order — market is OPEN, user has sufficient balance
 *   2. Lock funds: add totalCost to wallet.lockedBalance, subtract from wallet.balance
 *   3. Save order with status PENDING
 *   4. Query matching orders:
 *      - BUY YES at price P → find PENDING SELL YES where price ≤ P
 *      - Ordered by: price ASC (best price first), then createdAt ASC (time priority)
 *   5. Match greedily until fully filled or no more matches
 *   6. For each match (inside the transaction):
 *      - Create Trade row
 *      - Update both orders' filledQty and status (PARTIAL or FILLED)
 *      - Update both users' wallets (debit buyer, credit seller)
 *      - Upsert both users' Position rows (recalculate avgCost)
 *      - Insert PriceHistory row
 *      - Update Market.yesPrice, Market.noPrice, Market.totalVolume
 *   7. After transaction commits: emit price_update via Socket.io to market:{marketId}
 *   8. Update both users' TraderStats (fire and forget, non-critical)
 *
 * Price update rule: new yesPrice = last trade execution price. noPrice = 1 - yesPrice.
 * DB transaction is all-or-nothing. Socket.io only fires after successful commit.
 *
 * Protected + Rate Limited.
 */
export const placeOrder = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { marketId, side, type, quantity, price } = req.body;

    const validatedData = placeOrderSchema.parse(req.body);
    const createdOrder = await orderService.placeOrder(userId, validatedData);

    return res.status(201).json({
      order: createdOrder
    });
  } catch (error) {
    console.error("Error in placeOrder:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * GET /orders
 *
 * Current user's order history.
 * Query params: ?status (PENDING|PARTIAL|FILLED|CANCELLED), ?marketId, ?page, ?limit
 *
 * Used on the portfolio page to show active and past orders.
 * Protected.
 */
export const getUserOrders = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { status, marketId, page = "1", limit = "20" } = req.query;

    const filters = orderFilterSchema.parse(req.query);
    const result = await orderService.getUserOrders(userId, filters);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getUserOrders:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * GET /orders/:id
 *
 * Single order detail with trade/fill history.
 * Shows the Order and all Trade rows that resulted from it.
 * Protected: can only view own orders.
 */
export const getOrderById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const orderDetail = await orderService.getOrderDetail(id as string, userId);

    return res.status(200).json({
      order: orderDetail
    });
  } catch (error) {
    console.error("Error in getOrderById:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * DELETE /orders/:id
 *
 * Cancel a PENDING order. Unlocks the reserved wallet funds.
 *
 * Flow:
 *   1. Verify the order belongs to req.user and status is PENDING
 *   2. Calculate remaining unfilled cost
 *   3. Unlock reserved funds: move from lockedBalance → balance
 *   4. Update order status to CANCELLED, set cancelledAt
 *   5. Create a REFUND Transaction row for the audit trail
 *
 * Protected: can only cancel own PENDING orders.
 */
export const cancelOrder = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const cancelledOrder = await orderService.cancelOrder(id as string, userId);

    return res.status(200).json({
      order: cancelledOrder
    });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};
