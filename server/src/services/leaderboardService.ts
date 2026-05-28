// @ts-nocheck
import * as traderStatsRepository from '../repositories/traderStatsRepository';
import { serialiseDecimals } from './helpers/serialise';

// ══════════════════════════════════════════════════════════════
// LEADERBOARD SERVICE
// ══════════════════════════════════════════════════════════════

const STATS_DECIMAL_KEYS = ['totalProfit', 'totalLoss', 'netPnl', 'roi'];

/**
 * Get paginated leaderboard ranked by ROI.
 * Joins TraderStats with User for display info.
 * All Decimal fields are serialised to strings.
 */
export async function getLeaderboard(pagination: { page: number; limit: number }) {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [traders, total] = await Promise.all([
    traderStatsRepository.getLeaderboard({ skip, take: limit }),
    traderStatsRepository.countAll(),
  ]);

  const serialisedTraders = traders.map((entry: any) => {
    const serialisedStats = serialiseDecimals(entry, STATS_DECIMAL_KEYS);

    // If the query joined user data, keep it but strip email/role
    if (serialisedStats.user) {
      const { email, role, ...publicUser } = serialisedStats.user;
      serialisedStats.user = publicUser;
    }

    return serialisedStats;
  });

  return {
    traders: serialisedTraders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
