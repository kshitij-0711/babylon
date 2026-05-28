import prisma from '../lib/prisma';
import { MarketCategory, MarketStatus, Prisma } from 'prisma-client';

export interface MarketFilters {
  category?: MarketCategory;
  status?: MarketStatus;
  sort?: string;
  search?: string;
  skip: number;
  take: number;
}

const buildWhere = (filters: Omit<MarketFilters, 'sort' | 'skip' | 'take'>): Prisma.MarketWhereInput => {
  const where: Prisma.MarketWhereInput = {};

  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
};

const buildOrderBy = (sort?: string): Prisma.MarketOrderByWithRelationInput => {
  switch (sort) {
    case 'newest':
      return { createdAt: 'desc' };
    case 'oldest':
      return { createdAt: 'asc' };
    case 'volume':
      return { totalVolume: 'desc' };
    case 'closing_soon':
      return { closeAt: 'asc' };
    default:
      return { createdAt: 'desc' };
  }
};

const creatorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export const findMany = async (filters: MarketFilters) => {
  const where = buildWhere(filters);
  const orderBy = buildOrderBy(filters.sort);

  const [markets, total] = await prisma.$transaction([
    prisma.market.findMany({
      where,
      orderBy,
      skip: filters.skip,
      take: filters.take,
      include: {
        creator: { select: creatorSelect },
      },
    }),
    prisma.market.count({ where }),
  ]);

  return { markets, total };
};

export const findById = async (id: string) => {
  return prisma.market.findUnique({
    where: { id },
    include: {
      creator: { select: creatorSelect },
    },
  });
};

export const create = async (data: Prisma.MarketUncheckedCreateInput) => {
  return prisma.market.create({
    data,
    include: {
      creator: { select: creatorSelect },
    },
  });
};

export const updateStatus = async (
  id: string,
  status: MarketStatus,
  extra?: Prisma.MarketUpdateInput
) => {
  return prisma.market.update({
    where: { id },
    data: {
      status,
      ...extra,
    },
  });
};

export const updatePrices = async (
  id: string,
  yesPrice: any,
  noPrice: any,
  volumeIncrement: any
) => {
  return prisma.market.update({
    where: { id },
    data: {
      yesPrice,
      noPrice,
      totalVolume: { increment: volumeIncrement },
    },
  });
};

export const count = async (filters: Omit<MarketFilters, 'sort' | 'skip' | 'take'>) => {
  const where = buildWhere(filters);
  return prisma.market.count({ where });
};
