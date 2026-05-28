import prisma from '../lib/prisma';
import { Prisma } from '../generated/prisma';

export const findByUserId = async (userId: string) => {
  return prisma.traderStats.findUnique({
    where: { userId },
  });
};

export const update = async (
  userId: string,
  data: Prisma.TraderStatsUpdateInput
) => {
  return prisma.traderStats.update({
    where: { userId },
    data,
  });
};

export const getLeaderboard = async (skip: number, take: number) => {
  return prisma.traderStats.findMany({
    orderBy: { roi: 'desc' },
    skip,
    take,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });
};

export const countAll = async () => {
  return prisma.traderStats.count();
};
