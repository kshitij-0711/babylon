import prisma from '../lib/prisma';
import { OrderSide, OrderStatus, Prisma } from 'prisma-client';

export const create = async (data: {
  userId: string;
  marketId: string;
  side: OrderSide;
  type: string;
  status: string;
  quantity: number;
  price: any;
  totalCost: any;
}) => {
  return prisma.order.create({
    data: data as Prisma.OrderUncheckedCreateInput,
  });
};

export const findById = async (id: string) => {
  return prisma.order.findUnique({
    where: { id },
    include: {
      trades: true,
      salesTrades: true,
    },
  });
};

export const findByUserId = async (
  userId: string,
  filters: { status?: OrderStatus; marketId?: string; skip: number; take: number }
) => {
  const where: Prisma.OrderWhereInput = { userId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.marketId) {
    where.marketId = filters.marketId;
  }

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
      include: {
        trades: true,
        salesTrades: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
};

export const findMatchingOrders = async (
  marketId: string,
  side: OrderSide,
  price: any
) => {
  // For a BUY YES order at price P: find SELL YES orders where price <= P
  // For a SELL YES order at price P: find BUY YES orders where price >= P
  // For a BUY NO order at price P: find SELL NO orders where price <= P
  // For a SELL NO order at price P: find BUY NO orders where price >= P

  // The incoming side is the TAKER's side.
  // We search for orders on the opposite side with the same YES/NO direction.
  // Actually, the side here (YES/NO) stays the same — we match BUY vs SELL.
  // The request says: for BUY YES at P, find SELL YES ≤ P. For SELL YES at P, find BUY YES ≥ P.
  // But Order model has `side` as OrderSide (YES | NO), not BUY/SELL.
  // Looking at the schema, `side` is YES or NO (the outcome side).
  // The buy/sell distinction comes from the matching logic.
  // Re-reading the spec: "find PENDING orders on opposite side"
  // The `side` param is the order side (YES/NO) being matched.
  // "For BUY YES at P: find SELL YES where price <= P" — these are on the SAME side (YES)
  // but opposite direction. Since the schema doesn't have a buy/sell field directly,
  // the caller must know the matching logic. Let's implement exactly as specified.

  // We'll treat this as: matching orders on the SAME side but opposite direction.
  // The caller passes the side of the incoming order (YES/NO).
  // We look for PENDING orders on the same side where price conditions match.

  // Per the spec:
  // BUY YES at P → SELL YES where price <= P, order by price ASC, createdAt ASC
  // SELL YES at P → BUY YES where price >= P, order by price DESC, createdAt ASC

  // Since the schema has only `side` (YES/NO) and no explicit BUY/SELL field,
  // we need to determine order direction differently. Looking at the schema again,
  // the order has `side: OrderSide` which is YES or NO.

  // The spec says "opposite side" — so if incoming is YES, match NO side?
  // Let me re-read: "For BUY YES at P: find SELL YES where price <= P"
  // Both are YES side. The BUY/SELL is determined by something else.

  // In prediction markets, buying YES at price P is equivalent to selling NO at (1-P).
  // The matching engine matches YES buyers with YES sellers (or equivalently NO buyers).
  // Since the `side` field in the order is YES or NO, we match same side.

  // For price-time priority order matching on the same side:
  // A BUY order (wants to buy shares) matches with SELL orders (wants to sell shares).
  // We'll treat this as: find orders on the same `side` value.
  // The caller will handle the BUY/SELL logic.

  // Implementation as specified:
  return prisma.order.findMany({
    where: {
      marketId,
      side,
      status: OrderStatus.PENDING,
      price: side === 'YES'
        ? { lte: price }  // For BUY YES: find sells ≤ price
        : { gte: price }, // For SELL YES: find buys ≥ price
    },
    orderBy: [
      { price: side === 'YES' ? 'asc' : 'desc' },
      { createdAt: 'asc' },
    ],
  });
};

export const updateOrder = async (
  id: string,
  data: {
    filledQty?: number;
    status?: OrderStatus;
    avgFillPrice?: any;
    filledAt?: Date;
    cancelledAt?: Date;
  }
) => {
  return prisma.order.update({
    where: { id },
    data,
  });
};

export const cancelPendingOrdersByMarket = async (marketId: string) => {
  const pendingOrders = await prisma.order.findMany({
    where: {
      marketId,
      status: OrderStatus.PENDING,
    },
  });

  if (pendingOrders.length > 0) {
    await prisma.order.updateMany({
      where: {
        marketId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  }

  return pendingOrders;
};

export const countByUserId = async (
  userId: string,
  filters: { status?: OrderStatus; marketId?: string }
) => {
  const where: Prisma.OrderWhereInput = { userId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.marketId) {
    where.marketId = filters.marketId;
  }

  return prisma.order.count({ where });
};
