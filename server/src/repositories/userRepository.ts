import prisma from '../lib/prisma';

export const findById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
  });
};

export const findPublicProfileById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      _count: {
        select: { markets: true },
      },
    },
  });
};

export const updateProfile = async (
  id: string,
  data: {
    username?: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  }
) => {
  return prisma.user.update({
    where: { id },
    data,
  });
};

export const existsById = async (id: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  return user !== null;
};
