import { Request, Response } from "express";
import * as priceService from "../services/priceService";
import { priceHistorySchema } from "../validations/paginationValidation";

// ══════════════════════════════════════════════════════════════
// PRICE CONTROLLER
// ══════════════════════════════════════════════════════════════
// Serves chart data and order book depth for market detail pages.
//
// Prices are NOT external — they come from executed trades.
// Every trade inserts a PriceHistory row (append-only, never updated).
// Index on (marketId, side, timestamp) for range queries.
//
// Both endpoints are public.
// ══════════════════════════════════════════════════════════════

/**
 * GET /prices/:marketId/history
 *
 * Time series of price points for the Recharts price chart.
 * Query param: ?interval (1h|24h|7d|all)
 *
 * Returns array of: [{ timestamp, yesPrice, noPrice, volume }, ...]
 * noPrice is always 1 - yesPrice (computed in service layer).
 * PriceHistory table has index on (marketId, side, timestamp) for fast range queries.
 *
 * PUBLIC endpoint.
 */
export const getPriceHistory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { marketId } = req.params;
    const { interval } = priceHistorySchema.parse(req.query);
    const history = await priceService.getPriceHistory(marketId as string, interval);

    return res.status(200).json({
      history
    });
  } catch (error) {
    console.error("Error in getPriceHistory:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * GET /prices/:marketId/orderbook
 *
 * Current pending orders grouped by price level — shows market depth.
 *
 * Returns:
 *   {
 *     bids: [{ price, quantity }, ...],  // BUY orders (highest first)
 *     asks: [{ price, quantity }, ...]   // SELL orders (lowest first)
 *   }
 *
 * Service queries PENDING orders for this market,
 * groups by price, sums quantities at each level.
 *
 * PUBLIC endpoint.
 */
export const getOrderBook = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { marketId } = req.params;

    const orderbook = await priceService.getOrderBook(marketId as string);

    return res.status(200).json({
      orderbook
    });
  } catch (error) {
    console.error("Error in getOrderBook:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};
