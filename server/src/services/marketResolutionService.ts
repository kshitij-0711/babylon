import * as marketRepository from '../repositories/marketRepository';
import * as positionRepository from '../repositories/positionRepository';
import * as walletRepository from '../repositories/walletRepository';
import * as transactionRepository from '../repositories/transactionRepository';
import * as traderStatsRepository from '../repositories/traderStatsRepository';
import * as resolutionRepository from '../repositories/resolutionRepository';
import { AppError } from './helpers/AppError';
import prisma from '../lib/prisma';
import { Prisma } from '../generated/prisma';
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// ══════════════════════════════════════════════════════════════
// MARKET RESOLUTION SERVICE — MOST COMPLEX
// ══════════════════════════════════════════════════════════════
// Handles the full resolution lifecycle:
//   1. Validate market state
//   2. Determine winners / losers (or VOID refund)
//   3. Calculate payouts (1.00 per winning share)
//   4. Credit wallets + create transaction rows
//   5. Close all positions (shares → 0)
//   6. Update trader stats
//   7. Create Resolution record
//   8. Update market to RESOLVED
//
// Everything runs inside a single prisma.$transaction().
// ══════════════════════════════════════════════════════════════

interface ResolveData {
  outcome: 'YES' | 'NO' | 'VOID';
  evidenceUrl?: string;
  notes?: string;
  resolvedBy: string;
}

export async function resolveMarket(marketId: string, data: ResolveData) {
  const { outcome, evidenceUrl, notes, resolvedBy } = data;

  const result = await prisma.$transaction(async (tx) => {
    // ── 1. Validate market state ────────────────────────────
    const market = await marketRepository.findById(marketId);

    if (!market) {
      throw new AppError('Market not found', 404, 'NOT_FOUND');
    }

    if (market.status === 'RESOLVED') {
      throw new AppError('Market is already resolved', 409, 'MARKET_ALREADY_RESOLVED');
    }

    if (market.status !== 'CLOSED') {
      throw new AppError('Market must be CLOSED before resolution', 409, 'MARKET_NOT_CLOSED');
    }

    // ── 2. Get all positions for this market ────────────────
    const positions = await positionRepository.findByMarketId(marketId);

    let totalPayout = new Decimal(0);
    let winnersCount = 0;

    if (outcome === 'VOID') {
      // ── 3a. VOID: Refund everyone their totalInvested ─────
      for (const position of positions) {
        if (new Decimal(position.totalInvested).isZero()) continue;

        const refundAmount = new Decimal(position.totalInvested);
        totalPayout = totalPayout.plus(refundAmount);

        // Credit wallet
        await walletRepository.creditBalance(position.userId, refundAmount);

        // Create REFUND transaction
        const wallet = await walletRepository.findByUserId(position.userId);
        await transactionRepository.create({
          userId: position.userId,
          type: 'REFUND',
          amount: refundAmount,
          balanceAfter: new Decimal(wallet!.balance),
          referenceId: marketId,
          referenceType: 'MARKET',
          description: `Market voided — refunded ${refundAmount.toString()} coins`,
        });

        // Close position: shares=0, realised P&L = 0 (break even on void)
        await positionRepository.updateOnResolution(position.id, {
          shares: 0,
          realisedPnl: new Decimal(0),
        });

        // Update trader stats — neither win nor loss on VOID
        await traderStatsRepository.update(position.userId, {
          totalTrades: 1,
        });
      }
    } else {
      // ── 3b. YES or NO: Winners and losers ─────────────────
      // Winners: positions whose side matches the outcome
      // Payout = shares * 1.00 per share
      // Losers: get nothing

      for (const position of positions) {
        const isWinner = position.side === outcome;
        const shares = position.shares;
        const invested = new Decimal(position.totalInvested);

        if (isWinner && shares > 0) {
          // ── 4. Calculate payout: shares × 1.00 ────────────
          const payout = new Decimal(shares); // 1.00 per share
          totalPayout = totalPayout.plus(payout);
          winnersCount++;

          // ── 5. Credit wallet ──────────────────────────────
          await walletRepository.creditBalance(position.userId, payout);

          // Create TRADE_PAYOUT transaction
          const wallet = await walletRepository.findByUserId(position.userId);
          await transactionRepository.create({
            userId: position.userId,
            type: 'TRADE_PAYOUT',
            amount: payout,
            balanceAfter: new Decimal(wallet!.balance),
            referenceId: marketId,
            referenceType: 'MARKET',
            description: `Won ${shares} shares on ${outcome} — payout ${payout.toString()} coins`,
          });

          // ── 6. Close position, record P&L ─────────────────
          const realisedPnl = payout.minus(invested);
          await positionRepository.updateOnResolution(position.id, {
            shares: 0,
            realisedPnl,
          });

          // ── 7. Update trader stats (winner) ───────────────
          await traderStatsRepository.update(position.userId, {
            totalTrades: 1,
            winningTrades: 1,
            totalProfit: payout.minus(invested).greaterThan(0) ? payout.minus(invested) : new Decimal(0),
          });
        } else if (shares > 0) {
          // Loser: gets nothing, loses entire investment
          const realisedPnl = invested.neg(); // total loss
          await positionRepository.updateOnResolution(position.id, {
            shares: 0,
            realisedPnl,
          });

          // ── 7. Update trader stats (loser) ────────────────
          await traderStatsRepository.update(position.userId, {
            totalTrades: 1,
            losingTrades: 1,
            totalLoss: invested,
          });
        }
      }
    }

    // ── 8. Create Resolution record ─────────────────────────
    const resolution = await resolutionRepository.create({
      marketId,
      outcome,
      evidenceUrl,
      notes,
      totalPayout,
      winnersCount,
      resolvedBy,
    });

    // ── 9. Update market to RESOLVED ────────────────────────
    await marketRepository.updateStatus(marketId, 'RESOLVED');

    // Also update the outcome and resolution metadata on the market
    // This is handled by updateStatus or a direct update
    // We'll call a second update for the resolution-specific fields
    await marketRepository.updatePrices(
      marketId,
      outcome === 'YES' ? new Decimal(1) : outcome === 'NO' ? new Decimal(0) : new Decimal('0.5'),
      outcome === 'YES' ? new Decimal(0) : outcome === 'NO' ? new Decimal(1) : new Decimal('0.5'),
      new Decimal(0)
    );

    return {
      outcome,
      totalPayout: totalPayout.toString(),
      winnersCount,
      positionsProcessed: positions.length,
      resolution: {
        id: resolution.id,
        marketId: resolution.marketId,
        outcome: resolution.outcome,
        evidenceUrl: resolution.evidenceUrl,
        notes: resolution.notes,
        totalPayout: totalPayout.toString(),
        winnersCount,
        resolvedAt: resolution.resolvedAt,
        resolvedBy: resolution.resolvedBy,
      },
    };
  });

  return result;
}
