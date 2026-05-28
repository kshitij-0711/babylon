import prisma from '../lib/prisma';
import { OrderSide } from '../generated/prisma';

export const create = async (data: {
  marketId: string;
  side: OrderSide;
  price: any;
  volume: number;
}) => {
  return prisma.priceHistory.create({
    data,
  });
};

export const findByMarketId = async (marketId: string, since?: Date) => {
  return prisma.priceHistory.findMany({
    where: {
      marketId,
      ...(since ? { timestamp: { gte: since } } : {}),
    },
    orderBy: { timestamp: 'asc' },
  });
};
