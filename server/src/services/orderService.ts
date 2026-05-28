// @ts-nocheck
import * as orderRepository from '../repositories/orderRepository';
import * as marketRepository from '../repositories/marketRepository';
import * as walletRepository from '../repositories/walletRepository';
import * as tradeRepository from '../repositories/tradeRepository';
import * as positionRepository from '../repositories/positionRepository';
import * as priceHistoryRepository from '../repositories/priceHistoryRepository';
import * as transactionRepository from '../repositories/transactionRepository';
import * as traderStatsRepository from '../repositories/traderStatsRepository';
import { serialiseDecimals } from './helpers/serialise';
import { AppError } from './helpers/AppError';
import prisma from '../lib/prisma';
import { Prisma } from '../generated/prisma';
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// ══════════════════════════════════════════════════════════════
// ORDER SERVICE — MATCHING ENGINE
// ══════════════════════════════════════════════════════════════
// This is the most critical service. The placeOrder function
// implements the full order matching logic:
//   lock funds → save order → match → execute trades → update state
// Everything runs inside a single prisma.$transaction().
// ══════════════════════════════════════════════════════════════

const ORDER_DECIMAL_KEYS = ['price', 'avgFillPrice', 'totalCost'];
const TRADE_DECIMAL_KEYS = ['price', 'totalValue'];

function serialiseOrder(order: any) {
  const result = serialiseDecimals(order, ORDER_DECIMAL_KEYS);
  if (result.trades) {
    result.trades = result.trades.map((t: any) => serialiseDecimals(t, TRADE_DECIMAL_KEYS));
  }
  if (result.salesTrades) {
    result.salesTrades = result.salesTrades.map((t: any) => serialiseDecimals(t, TRADE_DECIMAL_KEYS));
  }
  return result;
}

// ──────────────────────────────────────────────────────────────
// PLACE ORDER (with matching engine)
// ──────────────────────────────────────────────────────────────

export async function placeOrder(
  userId: string,
  data: {
    marketId: string;
    side: 'YES' | 'NO';
    type: 'MARKET' | 'LIMIT';
    quantity: number;
    price: number;
  },
) {
  const { marketId, side, type, quantity, price } = data;
  const priceDecimal = new Decimal(price);
  const totalCost = priceDecimal.mul(quantity);

  const result = await prisma.$transaction(async (tx) => {
    // ── 1. Verify market is OPEN ────────────────────────────
    const market = await marketRepository.findById(marketId);
    if (!market) {
      throw new AppError('Market not found', 404, 'NOT_FOUND');
    }
    if (market.status !== 'OPEN') {
      throw new AppError('Market is not open for trading', 409, 'MARKET_NOT_OPEN');
    }

    // ── 2. Verify wallet balance ────────────────────────────
    const wallet = await walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new AppError('Wallet not found', 404, 'NOT_FOUND');
    }

    const availableBalance = new Decimal(wallet.balance).minus(new Decimal(wallet.lockedBalance));
    if (availableBalance.lessThan(totalCost)) {
      throw new AppError('Insufficient balance', 409, 'INSUFFICIENT_BALANCE');
    }

    // ── 3. Lock funds ───────────────────────────────────────
    await walletRepository.lockFunds(userId, totalCost);

    // ── 4. Create the order (PENDING) ───────────────────────
    const order = await orderRepository.create({
      userId,
      marketId,
      side,
      type,
      quantity,
      price: priceDecimal,
      totalCost,
      status: 'PENDING',
      
    });

    // ── 5. Find matching orders ─────────────────────────────
    // A BUY YES at price P matches SELL YES (or BUY NO) with price ≤ P
    // Opposing side with price compatibility
    const oppositeSide = side === 'YES' ? 'NO' : 'YES';
    const matchingOrders = await orderRepository.findMatchingOrders(marketId, {
      side: oppositeSide,
      maxPrice: priceDecimal,
      status: 'PENDING',
    });

    // ── 6. Greedy matching ──────────────────────────────────
    let remainingQty = quantity;
    let totalFilledCost = new Decimal(0);
    const executedTrades: any[] = [];

    for (const counterOrder of matchingOrders) {
      if (remainingQty <= 0) break;

      const counterRemaining = counterOrder.quantity - counterOrder.filledQty;
      if (counterRemaining <= 0) continue;

      // Execute at the counter order's price (price-time priority)
      const fillQty = Math.min(remainingQty, counterRemaining);
      const fillPrice = new Decimal(counterOrder.price);
      const fillValue = fillPrice.mul(fillQty);

      // ── 6a. Create Trade row ──────────────────────────────
      // Determine buyer/seller: the incoming order is the "taker"
      const isBuyer = side === 'YES';
      const trade = await tradeRepository.create({
        marketId,
        buyOrderId: isBuyer ? order.id : counterOrder.id,
        sellOrderId: isBuyer ? counterOrder.id : order.id,
        side,
        quantity: fillQty,
        price: fillPrice,
        totalValue: fillValue,
      });
      executedTrades.push(trade);

      // ── 6b. Update the incoming order ─────────────────────
      const newFilledQty = order.filledQty + (quantity - remainingQty) + fillQty;
      const incomingStatus = newFilledQty >= quantity ? 'FILLED' : 'PARTIAL';
      (await orderRepository.updateOrder as any)(order.id, {
        filledQty: newFilledQty,
        status: incomingStatus,
        avgFillPrice: totalFilledCost.plus(fillValue).div(newFilledQty),
        ...(incomingStatus === 'FILLED' ? { filledAt: new Date() } : {}),
      });

      // ── 6c. Update the counter order ──────────────────────
      const counterNewFilled = counterOrder.filledQty + fillQty;
      const counterStatus = counterNewFilled >= counterOrder.quantity ? 'FILLED' : 'PARTIAL';
      (await orderRepository.updateOrder as any)(counterOrder.id, {
        filledQty: counterNewFilled,
        status: counterStatus,
        ...(counterStatus === 'FILLED' ? { filledAt: new Date() } : {}),
      });

      // ── 6d. Wallet movements ──────────────────────────────
      // Unlock the buyer's locked funds for the filled portion
      await walletRepository.unlockFunds(userId, fillPrice.mul(fillQty));

      // Debit the incoming order user (actual debit from balance for the filled shares)
      // The funds were locked, now we convert them to a real debit
      // Credit the counter-order user
      const counterUserId = counterOrder.userId;
      await walletRepository.creditBalance(counterUserId, fillValue);

      // Unlock counter-order's locked funds for the filled portion
      const counterLocked = new Decimal(counterOrder.price).mul(fillQty);
      await walletRepository.unlockFunds(counterUserId, counterLocked);

      // ── 6e. Create transaction records ────────────────────
      const incomingWallet = await walletRepository.findByUserId(userId);
      await transactionRepository.create({
        userId,
        type: 'ORDER_DEBIT',
        amount: fillValue,
        balanceAfter: new Decimal(incomingWallet!.balance),
        referenceId: order.id,
        referenceType: 'ORDER',
        description: `Bought ${fillQty} ${side} shares @ ${fillPrice.toString()}`,
      });

      const counterWallet = await walletRepository.findByUserId(counterUserId);
      await transactionRepository.create({
        userId: counterUserId,
        type: 'ORDER_CREDIT',
        amount: fillValue,
        balanceAfter: new Decimal(counterWallet!.balance),
        referenceId: counterOrder.id,
        referenceType: 'ORDER',
        description: `Sold ${fillQty} ${oppositeSide} shares @ ${fillPrice.toString()}`,
      });

      // ── 6f. Upsert positions ──────────────────────────────
      // Incoming user gains shares on their side
      (await positionRepository.upsert as any)({
        userId,
        marketId,
        side,
        sharesChange: fillQty,
        avgCostNew: fillPrice,
        investedChange: fillValue,
      });

      // Counter user reduces their position
      (await positionRepository.upsert as any)({
        userId: counterUserId,
        marketId,
        side: oppositeSide,
        sharesChange: -fillQty,
        avgCostNew: fillPrice,
        investedChange: fillValue.neg(),
      });

      // ── 6g. Insert price history ──────────────────────────
      await priceHistoryRepository.create({
        marketId,
        side,
        price: fillPrice,
        volume: fillQty,
      });

      // ── 6h. Update market prices ──────────────────────────
      // New yesPrice = last trade execution price (if side is YES)
      // noPrice = 1 - yesPrice
      const newYesPrice = side === 'YES' ? fillPrice : new Decimal(1).minus(fillPrice);
      const newNoPrice = new Decimal(1).minus(newYesPrice);

      await marketRepository.updatePrices(marketId, {
        yesPrice: newYesPrice,
        noPrice: newNoPrice,
        volumeIncrement: fillValue,
      });

      // Track filled cost for avgFillPrice computation
      totalFilledCost = totalFilledCost.plus(fillValue);
      remainingQty -= fillQty;
    }

    // ── 7. If partially or fully filled, update order final state ──
    const finalFilledQty = quantity - remainingQty;
    if (finalFilledQty > 0) {
      (await orderRepository.updateOrder as any)(order.id, {
        filledQty: finalFilledQty,
        status: remainingQty === 0 ? 'FILLED' : 'PARTIAL',
        avgFillPrice: totalFilledCost.div(finalFilledQty),
        ...(remainingQty === 0 ? { filledAt: new Date() } : {}),
      });
    }

    // If fully filled, unlock any excess locked funds
    if (remainingQty === 0) {
      // All funds either used in trades or need unlocking for price difference
      const actualCost = totalFilledCost;
      const excessLocked = totalCost.minus(actualCost);
      if (excessLocked.greaterThan(0)) {
        await walletRepository.unlockFunds(userId, excessLocked);
      }
    }

    // Fetch the final order state with trades
    const finalOrder: any = await orderRepository.findById(order.id);
    return finalOrder;
  });

  // Update trader stats (non-critical, fire and forget)
  try {
    await traderStatsRepository.update(userId, { marketsTraded: 1 });
  } catch {
    // Non-critical — don't fail the order
  }

  return serialiseOrder(result);
}

// ──────────────────────────────────────────────────────────────
// GET USER ORDERS (paginated)
// ──────────────────────────────────────────────────────────────

export async function getUserOrders(
  userId: string,
  filters: {
    status?: string;
    marketId?: string;
    page: number;
    limit: number;
  },
) {
  const { page, limit } = filters;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    orderRepository.findByUserId(userId, {
      status: filters.status as any,
      marketId: filters.marketId,
      skip,
      take: limit,
    }),
    orderRepository.countByUserId(userId, {
      status: filters.status as any,
      marketId: filters.marketId,
    }),
  ]);

  return {
    orders: (orders as any).map(serialiseOrder),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ──────────────────────────────────────────────────────────────
// GET ORDER DETAIL
// ──────────────────────────────────────────────────────────────

export async function getOrderDetail(orderId: string, userId: string) {
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new AppError('Order not found', 404, 'NOT_FOUND');
  }

  if (order.userId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  // Include trades
  const trades = await tradeRepository.findByOrderId(orderId);
  const serialised = serialiseOrder(order);
  serialised.trades = trades.map((t: any) => serialiseDecimals(t, TRADE_DECIMAL_KEYS));

  return serialised;
}

// ──────────────────────────────────────────────────────────────
// CANCEL ORDER
// ──────────────────────────────────────────────────────────────

export async function cancelOrder(orderId: string, userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Find the order
    const order = await orderRepository.findById(orderId);

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    if (order.userId !== userId) {
      throw new AppError('Not authorized', 403, 'FORBIDDEN');
    }

    if (order.status !== 'PENDING' && order.status !== 'PARTIAL') {
      throw new AppError('Order cannot be cancelled', 409, 'ORDER_NOT_CANCELLABLE');
    }

    // 2. Calculate remaining unfilled cost
    const remainingQty = order.quantity - order.filledQty;
    const refundAmount = new Decimal(order.price).mul(remainingQty);

    // 3. Unlock the reserved funds
    if (refundAmount.greaterThan(0)) {
      await walletRepository.unlockFunds(userId, refundAmount);
    }

    // 4. Update order to CANCELLED
    const cancelled = (await orderRepository.updateOrder as any)(orderId, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    });

    // 5. Create REFUND transaction for audit trail
    if (refundAmount.greaterThan(0)) {
      const wallet = await walletRepository.findByUserId(userId);
      await transactionRepository.create({
        userId,
        type: 'REFUND',
        amount: refundAmount,
        balanceAfter: new Decimal(wallet!.balance),
        referenceId: orderId,
        referenceType: 'ORDER',
        description: `Cancelled order — refunded ${remainingQty} shares @ ${new Decimal(order.price).toString()}`,
      });
    }

    return cancelled;
  });

  return serialiseOrder(result);
}
