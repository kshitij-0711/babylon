// @ts-nocheck
import * as priceHistoryRepository from '../repositories/priceHistoryRepository';
import * as orderRepository from '../repositories/orderRepository';
import { serialiseDecimals, serialiseDecimal } from './helpers/serialise';
import { AppError } from './helpers/AppError';
import { Prisma } from '../generated/prisma';
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// ══════════════════════════════════════════════════════════════
// PRICE SERVICE
// ══════════════════════════════════════════════════════════════

/**
 * Maps interval strings to millisecond durations for time filtering.
 */
const INTERVAL_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  'all': 0, // no filter
};

// ──────────────────────────────────────────────────────────────
// PRICE HISTORY
// ──────────────────────────────────────────────────────────────

/**
 * Get time-series price data for the Recharts chart.
 * Filters by interval. For each point computes noPrice = 1 - yesPrice.
 */
export async function getPriceHistory(marketId: string, interval: string) {
  const ms = INTERVAL_MS[interval];
  if (ms === undefined) {
    throw new AppError('Invalid interval. Use 1h, 24h, 7d, or all', 400, 'INVALID_INTERVAL');
  }

  const since = ms > 0 ? new Date(Date.now() - ms) : undefined;

  const history = await (priceHistoryRepository.findByMarketId as any)(marketId, since);

  return history.map((point: any) => ({
    id: point.id,
    timestamp: point.timestamp,
    yesPrice: new Decimal(point.price).toString(),
    noPrice: new Decimal(1).minus(new Decimal(point.price)).toString(),
    volume: point.volume,
    side: point.side,
  }));
}

// ──────────────────────────────────────────────────────────────
// ORDER BOOK
// ──────────────────────────────────────────────────────────────

/**
 * Get order book depth for a market.
 * Groups PENDING orders by price level, returns bids (BUY YES, highest first)
 * and asks (SELL / BUY NO, lowest first).
 */
export async function getOrderBook(marketId: string) {
  const pendingOrders = await orderRepository.findMatchingOrders(marketId, {
    status: 'PENDING',
  });

  // Aggregate by price level and side
  const bidsMap = new Map<string, number>();
  const asksMap = new Map<string, number>();

  for (const order of pendingOrders) {
    const priceKey = new Decimal(order.price).toString();
    const remainingQty = order.quantity - order.filledQty;

    if (remainingQty <= 0) continue;

    if (order.side === 'YES') {
      // YES buy orders are bids
      bidsMap.set(priceKey, (bidsMap.get(priceKey) || 0) + remainingQty);
    } else {
      // NO buy orders are asks (opposing side)
      asksMap.set(priceKey, (asksMap.get(priceKey) || 0) + remainingQty);
    }
  }

  // Convert maps to sorted arrays
  const bids = Array.from(bidsMap.entries())
    .map(([price, quantity]) => ({ price, quantity }))
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); // highest first

  const asks = Array.from(asksMap.entries())
    .map(([price, quantity]) => ({ price, quantity }))
    .sort((a, b) => parseFloat(a.price) - parseFloat(b.price)); // lowest first

  return { bids, asks };
}
