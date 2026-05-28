import prisma from '../lib/prisma';
import { OrderSide } from 'prisma-client';

export const create = async (data: {
  marketId: string;
  buyOrderId: string;
  sellOrderId: string;
  side: OrderSide;
  quantity: number;
  price: any;
  totalValue: any;
}) => {
  return prisma.trade.create({
    data,
  });
};

export const findByOrderId = async (orderId: string) => {
  return prisma.trade.findMany({
    where: {
      OR: [
        { buyOrderId: orderId },
        { sellOrderId: orderId },
      ],
    },
    orderBy: { executedAt: 'asc' },
  });
};
