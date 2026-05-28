import prisma from '../lib/prisma';
import { OrderSide } from 'prisma-client';

export const upsert = async (
  userId: string,
  marketId: string,
  side: OrderSide,
  data: {
    sharesIncrement: number;
    totalInvestedIncrement: any;
    newAvgCost: any;
  }
) => {
  return prisma.position.upsert({
    where: {
      userId_marketId_side: { userId, marketId, side },
    },
    create: {
      userId,
      marketId,
      side,
      shares: data.sharesIncrement,
      avgCost: data.newAvgCost,
      totalInvested: data.totalInvestedIncrement,
    },
    update: {
      shares: { increment: data.sharesIncrement },
      avgCost: data.newAvgCost,
      totalInvested: { increment: data.totalInvestedIncrement },
    },
  });
};

export const findByUserId = async (userId: string) => {
  return prisma.position.findMany({
    where: {
      userId,
      shares: { gt: 0 },
    },
    include: {
      market: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
};

export const findByMarketId = async (marketId: string) => {
  return prisma.position.findMany({
    where: { marketId },
  });
};

export const updateOnResolution = async (
  id: string,
  data: { shares: 0; realisedPnl: any }
) => {
  return prisma.position.update({
    where: { id },
    data: {
      shares: data.shares,
      realisedPnl: data.realisedPnl,
    },
  });
};
