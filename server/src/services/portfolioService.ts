// @ts-nocheck
import * as positionRepository from '../repositories/positionRepository';
import * as transactionRepository from '../repositories/transactionRepository';
import { serialiseDecimals, serialiseDecimal } from './helpers/serialise';
import { Prisma } from 'prisma-client';
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// ══════════════════════════════════════════════════════════════
// PORTFOLIO SERVICE
// ══════════════════════════════════════════════════════════════

const POSITION_DECIMAL_KEYS = ['avgCost', 'totalInvested', 'realisedPnl'];
const TRANSACTION_DECIMAL_KEYS = ['amount', 'balanceAfter'];

// ──────────────────────────────────────────────────────────────
// GET POSITIONS (open positions with unrealised P&L)
// ──────────────────────────────────────────────────────────────

/**
 * Get all open positions (shares > 0) for the authenticated user.
 * Computes unrealisedPnl = (currentPrice - avgCost) * shares for each position.
 */
export async function getPositions(userId: string) {
  const positions = await positionRepository.findByUserId(userId);

  // Filter to only active positions (shares > 0)
  const activePositions = positions.filter((p: any) => p.shares > 0);

  return activePositions.map((position: any) => {
    // Determine current price based on side
    const market = position.market;
    const currentPrice = position.side === 'YES'
      ? new Decimal(market.yesPrice)
      : new Decimal(market.noPrice);

    const avgCost = new Decimal(position.avgCost);
    const unrealisedPnl = currentPrice.minus(avgCost).mul(position.shares);

    const serialised = serialiseDecimals(position, POSITION_DECIMAL_KEYS);

    // Serialise market decimal fields inline
    if (serialised.market) {
      serialised.market = serialiseDecimals(serialised.market, [
        'yesPrice',
        'noPrice',
        'totalVolume',
      ]);
    }

    return {
      ...serialised,
      currentPrice: currentPrice.toString(),
      unrealisedPnl: unrealisedPnl.toString(),
    };
  });
}

// ──────────────────────────────────────────────────────────────
// GET PORTFOLIO P&L SUMMARY
// ──────────────────────────────────────────────────────────────

/**
 * Aggregate stats across all positions:
 *   totalInvested, currentValue, realisedPnl, unrealisedPnl, roi
 */
export async function getPortfolioPnl(userId: string) {
  const positions = await positionRepository.findByUserId(userId);

  let totalInvested = new Decimal(0);
  let currentValue = new Decimal(0);
  let realisedPnl = new Decimal(0);

  for (const position of positions) {
    const posInvested = new Decimal(position.totalInvested);
    const posRealised = new Decimal(position.realisedPnl);

    totalInvested = totalInvested.plus(posInvested);
    realisedPnl = realisedPnl.plus(posRealised);

    if (position.shares > 0 && position.market) {
      const market = position.market as any;
      const currentPrice = position.side === 'YES'
        ? new Decimal(market.yesPrice)
        : new Decimal(market.noPrice);

      currentValue = currentValue.plus(currentPrice.mul(position.shares));
    }
  }

  const unrealisedPnl = currentValue.minus(totalInvested);
  const roi = totalInvested.greaterThan(0)
    ? realisedPnl.plus(unrealisedPnl).div(totalInvested).mul(100)
    : new Decimal(0);

  return {
    totalInvested: totalInvested.toString(),
    currentValue: currentValue.toString(),
    realisedPnl: realisedPnl.toString(),
    unrealisedPnl: unrealisedPnl.toString(),
    roi: roi.toDecimalPlaces(4).toString(),
  };
}

// ──────────────────────────────────────────────────────────────
// GET TRANSACTION HISTORY (paginated)
// ──────────────────────────────────────────────────────────────

/**
 * Paginated transaction history from the Transaction table.
 */
export async function getTransactionHistory(
  userId: string,
  pagination: { page: number; limit: number },
) {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    transactionRepository.findByUserId(userId, { skip, take: limit }),
    transactionRepository.countByUserId(userId),
  ]);

  const serialised = transactions.map((tx: any) =>
    serialiseDecimals(tx, TRANSACTION_DECIMAL_KEYS),
  );

  return {
    transactions: serialised,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
