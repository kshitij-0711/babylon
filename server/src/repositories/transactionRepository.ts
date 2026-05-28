import prisma from '../lib/prisma';
import { TransactionType } from '../generated/prisma';

export const create = async (data: {
  userId: string;
  type: TransactionType;
  amount: any;
  balanceAfter: any;
  referenceId?: string;
  referenceType?: string;
  description?: string;
}) => {
  return prisma.transaction.create({
    data,
  });
};

export const findByUserId = async (
  userId: string,
  skip: number,
  take: number
) => {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
};

export const countByUserId = async (userId: string) => {
  return prisma.transaction.count({
    where: { userId },
  });
};
