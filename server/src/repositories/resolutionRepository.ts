import prisma from '../lib/prisma';
import { ResolutionOutcome } from '../generated/prisma';

export const create = async (data: {
  marketId: string;
  outcome: ResolutionOutcome;
  evidenceUrl?: string;
  notes?: string;
  totalPayout: any;
  winnersCount: number;
  resolvedBy: string;
}) => {
  return prisma.resolution.create({
    data,
  });
};

export const findByMarketId = async (marketId: string) => {
  return prisma.resolution.findUnique({
    where: { marketId },
  });
};
