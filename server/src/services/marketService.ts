// @ts-nocheck
import * as marketRepository from '../repositories/marketRepository';
import * as orderRepository from '../repositories/orderRepository';
import * as walletRepository from '../repositories/walletRepository';
import { serialiseDecimals } from './helpers/serialise';
import { AppError } from './helpers/AppError';
import prisma from '../lib/prisma';
import { Prisma } from '../generated/prisma';
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// ══════════════════════════════════════════════════════════════
// MARKET SERVICE
// ══════════════════════════════════════════════════════════════

const MARKET_DECIMAL_KEYS = ['yesPrice', 'noPrice', 'totalVolume'];

function serialiseMarket<T extends Record<string, any>>(market: T) {
  return serialiseDecimals(market, MARKET_DECIMAL_KEYS);
}

// ──────────────────────────────────────────────────────────────
// GET MARKETS (paginated list)
// ──────────────────────────────────────────────────────────────

export async function getMarkets(filters: {
  category?: string;
  status?: string;
  search?: string;
  sort?: string;
  page: number;
  limit: number;
}) {
  const { page, limit } = filters;
  const skip = (page - 1) * limit;

  const [markets, total] = await Promise.all([
    marketRepository.findMany({
      category: filters.category as any,
      status: filters.status as any,
      search: filters.search,
      sort: filters.sort,
      skip,
      take: limit,
    }),
    marketRepository.count({
      category: filters.category as any,
      status: filters.status as any,
      search: filters.search,
    }),
  ]);

  const serialisedMarkets = markets.map(serialiseMarket);

  return {
    markets: serialisedMarkets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ──────────────────────────────────────────────────────────────
// GET MARKET DETAIL
// ──────────────────────────────────────────────────────────────

export async function getMarketDetail(id: string) {
  const market = await marketRepository.findById(id);

  if (!market) {
    throw new AppError('Market not found', 404, 'NOT_FOUND');
  }

  return serialiseMarket(market);
}

// ──────────────────────────────────────────────────────────────
// CREATE MARKET (DRAFT)
// ──────────────────────────────────────────────────────────────

export async function createMarket(
  userId: string,
  data: {
    title: string;
    description: string;
    category?: string;
    tags?: string[];
    closeAt: string | Date;
    imageUrl?: string;
  },
) {
  const market = await marketRepository.create({
    creatorId: userId,
    title: data.title,
    description: data.description,
    category: data.category || 'OTHER',
    tags: data.tags || [],
    closeAt: new Date(data.closeAt),
    imageUrl: data.imageUrl,
    status: 'DRAFT',
    yesPrice: new Decimal('0.5000'),
    noPrice: new Decimal('0.5000'),
  });

  return serialiseMarket(market);
}

// ──────────────────────────────────────────────────────────────
// PUBLISH MARKET (DRAFT → OPEN)
// ──────────────────────────────────────────────────────────────

export async function publishMarket(id: string, userId: string) {
  const market = await marketRepository.findById(id);

  if (!market) {
    throw new AppError('Market not found', 404, 'NOT_FOUND');
  }

  if (market.status !== 'DRAFT') {
    throw new AppError('Market is not in DRAFT status', 409, 'MARKET_NOT_DRAFT');
  }

  if (market.creatorId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  const updated = await marketRepository.updateStatus(id, 'OPEN');

  return serialiseMarket(updated);
}

// ──────────────────────────────────────────────────────────────
// CLOSE MARKET (OPEN → CLOSED)
// Cancels all pending orders and unlocks funds.
// ──────────────────────────────────────────────────────────────

export async function closeMarket(id: string) {
  const market = await marketRepository.findById(id);

  if (!market) {
    throw new AppError('Market not found', 404, 'NOT_FOUND');
  }

  if (market.status !== 'OPEN') {
    throw new AppError('Market is not open', 409, 'MARKET_NOT_OPEN');
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update market status to CLOSED
    const closedMarket = await marketRepository.updateStatus(id, 'CLOSED');

    // 2. Get all pending orders for this market
    const pendingOrders = await orderRepository.cancelPendingOrdersByMarket(id);

    // 3. For each cancelled order, unlock the reserved funds
    for (const order of pendingOrders) {
      const remainingQty = order.quantity - order.filledQty;
      const lockedAmount = new Decimal(order.price).mul(remainingQty);

      if (lockedAmount.greaterThan(0)) {
        await walletRepository.unlockFunds(order.userId, lockedAmount);
      }
    }

    return closedMarket;
  });

  return serialiseMarket(result);
}
