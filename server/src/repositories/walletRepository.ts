import prisma from '../lib/prisma';

export const findByUserId = async (userId: string) => {
  return prisma.wallet.findUnique({
    where: { userId },
  });
};

export const updateBalance = async (
  walletId: string,
  data: { balance?: any; lockedBalance?: any }
) => {
  return prisma.wallet.update({
    where: { id: walletId },
    data,
  });
};

export const lockFunds = async (userId: string, amount: any) => {
  return prisma.wallet.update({
    where: { userId },
    data: {
      balance: { decrement: amount },
      lockedBalance: { increment: amount },
    },
  });
};

export const unlockFunds = async (userId: string, amount: any) => {
  return prisma.wallet.update({
    where: { userId },
    data: {
      balance: { increment: amount },
      lockedBalance: { decrement: amount },
    },
  });
};

export const creditBalance = async (userId: string, amount: any) => {
  return prisma.wallet.update({
    where: { userId },
    data: {
      balance: { increment: amount },
    },
  });
};
