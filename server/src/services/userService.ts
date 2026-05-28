import * as userRepository from '../repositories/userRepository';
import { serialiseDecimals } from './helpers/serialise';
import { AppError } from './helpers/AppError';

// ══════════════════════════════════════════════════════════════
// USER SERVICE
// ══════════════════════════════════════════════════════════════

/**
 * Get a user's public profile (strips email and role).
 */
export async function getPublicProfile(id: string) {
  const user = await userRepository.findPublicProfileById(id);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  // Strip sensitive fields — never expose email or role publicly
  const { email, role, ...publicFields } = user as any;

  return publicFields;
}

/**
 * Update an authenticated user's own profile.
 */
export async function updateProfile(
  userId: string,
  data: {
    username?: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  },
) {
  const updated = await userRepository.updateProfile(userId, data);

  // Strip sensitive fields from the response
  const { email, role, ...publicFields } = updated as any;

  return publicFields;
}

/**
 * Internal helper — get full user row (used by other services, not exposed via API).
 */
export async function getUserById(id: string) {
  const user = await userRepository.findById(id);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return user;
}
